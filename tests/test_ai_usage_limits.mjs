/**
 * Test Suite: AI Usage Limits & Monitoring (A9 / B7)
 * Tests:
 * 1. vnDay(now) correctly computes UTC+7 (Asia/Ho_Chi_Minh) date string
 * 2. Default limit 10: 10 allowed, 11th triggers AI_LIMIT_REACHED (429)
 * 3. Hierarchy: student_limits overrides class_limits overrides default_limit
 * 4. Grant extra: adding +3 allows 3 more queries
 * 5. Lock student: returns AI_LOCKED and does not consume count
 * 6. Exam mode: returns AI_DISABLED_IN_EXAM
 * 7. Concurrency: 5 parallel requests with limit 3 -> exactly 3 succeed, 2 rejected
 * 8. Refund: failed call refunds 1 count
 * 9. Privacy invariant: zero chat content or student prompts stored in DO
 * 10. Teacher routes: 403 for non-teacher, CSV export with formula injection protection
 * 11. Student route: GET /api/pwa/ai-quota returns quota status
 */

import assert from 'node:assert/strict';
import worker, {
  vnDay,
  effectiveLimit,
  getOrCreateSigningKeys,
  createFirebaseCustomToken,
  MockDONamespace
} from '../worker/index.js';

console.log('=== RUNNING AI USAGE LIMITS & MONITORING TESTS (A9 / B7) ===\n');

// -------------------------------------------------------------
// [1/11] TEST TIMEZONE HELPER: vnDay (UTC+7)
// -------------------------------------------------------------
console.log('[1/11] Testing vnDay() timezone calculation (UTC+7)...');
// 2026-10-24 17:30:00 UTC is 2026-10-25 00:30:00 UTC+7
const utcDate = Date.UTC(2026, 9, 24, 17, 30, 0); // month 9 is October
const computedVnDay = vnDay(utcDate);
assert.equal(computedVnDay, '2026-10-25', '17:30 UTC must roll over to next day 2026-10-25 in Vietnam (UTC+7)');
console.log('  PASS vnDay: Vietnam day computed accurately.');

// -------------------------------------------------------------
// [2/11] TEST effectiveLimit HIERARCHY
// -------------------------------------------------------------
console.log('\n[2/11] Testing effectiveLimit hierarchy (student > class > default)...');
const settings = {
  default_limit: 10,
  class_limits: { '9A': 15, '6B': 5 },
  student_limits: { 'hs_special': 25, 'hs_restricted': 2 }
};

// Case a: default
assert.equal(effectiveLimit(settings, 'hs_normal', undefined, 0), 10);
// Case b: class override
assert.equal(effectiveLimit(settings, 'hs_normal', '9A', 0), 15);
// Case c: student override beats class override
assert.equal(effectiveLimit(settings, 'hs_restricted', '9A', 0), 2);
// Case d: grant extra
assert.equal(effectiveLimit(settings, 'hs_restricted', '9A', 3), 5);
console.log('  PASS effectiveLimit: Hierarchy strictly verified.');

// Setup test environment
const signingKeys = await getOrCreateSigningKeys();
const sharedDONamespace = new MockDONamespace();

const teacherToken = await createFirebaseCustomToken(
  'teacher_ai_admin',
  { role: 'teacher', admin: true, name: 'Thầy Giáo' },
  signingKeys.privateKey,
  'firebase-adminsdk-eval@aihoctap.iam.gserviceaccount.com'
);

const studentToken = await createFirebaseCustomToken(
  'student_limit_user_1',
  { role: 'student', grade: 9, class_code: '9A', name: 'Học Sinh 1' },
  signingKeys.privateKey,
  'firebase-adminsdk-eval@aihoctap.iam.gserviceaccount.com'
);

const testEnv = {
  GATE_DO: sharedDONamespace,
  SIGNING_KEYPAIR: signingKeys,
  KEY_ENC_SECRET: 'super-secret-key-encryption-passphrase-32b',
  ALLOWED_ORIGIN: 'https://mrbin2026dh-droid.github.io',
  MOCK_MODE: true
};

const doStub = sharedDONamespace.get(sharedDONamespace.idFromName('default'));

// -------------------------------------------------------------
// [3/11] TEST DEFAULT LIMIT (10 ALLOWED, 11th AI_LIMIT_REACHED)
// -------------------------------------------------------------
console.log('\n[3/11] Testing default limit 10 in DO reservation...');
for (let i = 1; i <= 10; i++) {
  const res = await doStub.fetch('http://do/reserve-gemini-limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: 'hs_test_limit_10' })
  });
  const data = await res.json();
  assert.equal(data.allowed, true, `Query ${i} must be allowed`);
}

const req11 = await doStub.fetch('http://do/reserve-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_test_limit_10' })
});
const data11 = await req11.json();
assert.equal(data11.allowed, false, '11th query must be rejected');
assert.equal(data11.reason, 'AI_LIMIT_REACHED', 'Reason must be AI_LIMIT_REACHED');
assert(data11.detail.includes('10 lượt'), 'Detail must indicate limit reached');
console.log('  PASS: Default 10 limit capped and 11th rejected with AI_LIMIT_REACHED.');

// -------------------------------------------------------------
// [4/11] TEST GRANT EXTRA (+3 QUERIES)
// -------------------------------------------------------------
console.log('\n[4/11] Testing grant extra (+3 queries)...');
const grantRes = await doStub.fetch('http://do/ai-grant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_test_limit_10', extra: 3 })
});
assert.equal(grantRes.status, 200);

// Now query 11, 12, 13 should succeed
for (let i = 11; i <= 13; i++) {
  const res = await doStub.fetch('http://do/reserve-gemini-limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: 'hs_test_limit_10' })
  });
  const data = await res.json();
  assert.equal(data.allowed, true, `Query ${i} with grant must be allowed`);
}

// 14th should be rejected
const req14 = await doStub.fetch('http://do/reserve-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_test_limit_10' })
});
assert.equal((await req14.json()).allowed, false, '14th query after +3 grant must be rejected');
console.log('  PASS: Grant extra queries successfully applied.');

// -------------------------------------------------------------
// [5/11] TEST LOCK STUDENT
// -------------------------------------------------------------
console.log('\n[5/11] Testing lock student...');
await doStub.fetch('http://do/ai-lock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_locked_user', locked: true })
});

const lockReserve = await doStub.fetch('http://do/reserve-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_locked_user' })
});
const lockData = await lockReserve.json();
assert.equal(lockData.allowed, false);
assert.equal(lockData.reason, 'AI_LOCKED');
console.log('  PASS: Locked student rejected with AI_LOCKED.');

// -------------------------------------------------------------
// [6/11] TEST EXAM MODE
// -------------------------------------------------------------
console.log('\n[6/11] Testing exam mode...');
await doStub.fetch('http://do/ai-settings-set', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ exam_mode: true })
});

const examReserve = await doStub.fetch('http://do/reserve-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_normal_any' })
});
const examData = await examReserve.json();
assert.equal(examData.allowed, false);
assert.equal(examData.reason, 'AI_DISABLED_IN_EXAM');

// Turn off exam mode
await doStub.fetch('http://do/ai-settings-set', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ exam_mode: false })
});
console.log('  PASS: Exam mode blocks queries with AI_DISABLED_IN_EXAM.');

// -------------------------------------------------------------
// [7/11] TEST CONCURRENCY (5 PARALLEL REQUESTS, LIMIT 3)
// -------------------------------------------------------------
console.log('\n[7/11] Testing atomic concurrency (5 parallel, limit 3)...');
await doStub.fetch('http://do/ai-settings-set', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_limits: { 'hs_concur_3': 3 } })
});

const concurPromises = Array.from({ length: 5 }, () =>
  doStub.fetch('http://do/reserve-gemini-limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: 'hs_concur_3' })
  }).then(r => r.json())
);

const concurResults = await Promise.all(concurPromises);
const allowedCount = concurResults.filter(r => r.allowed === true).length;
const rejectedCount = concurResults.filter(r => r.allowed === false).length;
assert.equal(allowedCount, 3, 'Exactly 3 concurrent requests must be allowed');
assert.equal(rejectedCount, 2, 'Exactly 2 concurrent requests must be rejected');
console.log('  PASS: Atomic reservation locks slot cleanly under concurrency.');

// -------------------------------------------------------------
// [8/11] TEST REFUND GEMINI LIMIT
// -------------------------------------------------------------
console.log('\n[8/11] Testing quota refund...');
await doStub.fetch('http://do/refund-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_concur_3' })
});

// Now 1 more query should be allowed
const retryAfterRefund = await doStub.fetch('http://do/reserve-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_concur_3' })
});
assert.equal((await retryAfterRefund.json()).allowed, true, 'Query must be allowed after refund');
console.log('  PASS: Quota refund restored 1 slot.');

// -------------------------------------------------------------
// [9/11] TEST PRIVACY INVARIANT (ZERO CHAT/PROMPT IN DO)
// -------------------------------------------------------------
console.log('\n[9/11] Testing privacy invariant in DO storage...');
const allStoredKeys = await sharedDONamespace.storage.list();
for (const [, v] of allStoredKeys.entries()) {
  const jsonStr = JSON.stringify(v);
  assert(!jsonStr.includes('Mạng máy tính là gì'), 'No chat content stored in DO storage');
  assert(!jsonStr.includes('message'), 'No message object stored in DO keys storage');
}
console.log('  PASS: Zero chat contents stored in DO storage (privacy invariant).');

// -------------------------------------------------------------
// [10/11] TEST TEACHER ROUTES & CSV EXPORT
// -------------------------------------------------------------
console.log('\n[10/11] Testing teacher management routes & CSV security...');
// Non-teacher must be rejected with 403
const nonTeacherReq = new Request('http://localhost/api/teacher/ai-settings', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${studentToken}` }
});
const nonTeacherRes = await worker.fetch(nonTeacherReq, testEnv);
assert.equal(nonTeacherRes.status, 403, 'Non-teacher must be forbidden (403)');

// Teacher reads stats as CSV
// Add a student with formula injection attack in student_id
await doStub.fetch('http://do/reserve-gemini-limit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: '=cmd|/c calc!A0' })
});

const csvReq = new Request('http://localhost/api/teacher/ai-stats?format=csv', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${teacherToken}` }
});
const csvRes = await worker.fetch(csvReq, testEnv);
assert.equal(csvRes.status, 200);
assert.equal(csvRes.headers.get('Content-Type'), 'text/csv; charset=utf-8');
const csvText = await csvRes.text();
assert(csvText.includes('student_id,used,limit,date'), 'CSV header present');
assert(csvText.includes("''=cmd|/c calc!A0") || csvText.includes("'=cmd") || csvText.includes("'="), 'CSV formula injection must be sanitized with leading apostrophe');
console.log('  PASS: Teacher routes and CSV formula injection protection verified.');

// -------------------------------------------------------------
// [11/11] TEST STUDENT ROUTE GET /api/pwa/ai-quota
// -------------------------------------------------------------
console.log('\n[11/11] Testing student quota check route GET /api/pwa/ai-quota...');
const quotaReq = new Request('http://localhost/api/pwa/ai-quota', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${studentToken}` }
});
const quotaRes = await worker.fetch(quotaReq, testEnv);
assert.equal(quotaRes.status, 200);
const quotaData = await quotaRes.json();
assert('used' in quotaData, 'Must have used count');
assert('limit' in quotaData, 'Must have limit');
assert('locked' in quotaData, 'Must have locked status');
assert('exam_mode' in quotaData, 'Must have exam_mode status');
console.log('  PASS: Student quota route verified.');

// -------------------------------------------------------------
// [12] TEST MOCK DATE.NOW ACROSS 17:00 UTC (T1 VERIFICATION)
// -------------------------------------------------------------
console.log('\n[12] Testing simulated Date.now rollover at 17:30 UTC -> 2026-10-25 VN...');
const realDateNow = Date.now;
Date.now = () => Date.UTC(2026, 9, 24, 17, 30, 0);
try {
  const mockDayRes = await doStub.fetch('http://do/reserve-gemini-limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: 'hs_t_time_rollover' })
  });
  assert.equal(mockDayRes.status, 200);
  const data = await mockDayRes.json();
  assert.equal(data.allowed, true);
  const recordedCount = await sharedDONamespace.storage.get('ai:count:2026-10-25:hs_t_time_rollover');
  assert.equal(recordedCount, 1, 'Counter must be recorded under Vietnam date 2026-10-25');
  console.log('  PASS: Rollover at 17:30 UTC strictly records in 2026-10-25 VN day.');
} finally {
  Date.now = realDateNow;
}

// -------------------------------------------------------------
// [13] TEST SANITIZE CLASS & STUDENT LIMITS IN /ai-settings-set
// -------------------------------------------------------------
console.log('\n[13] Testing limits sanitization (0-200, valid IDs only)...');
const setRes = await doStub.fetch('http://do/ai-settings-set', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    class_limits: { '6A': 15, 'invalid../id': 99, '7B': -5, '8C': 300, '9A': '25.8' },
    student_limits: { 'hs_valid': 20, 'bad*id': 50, 'hs_negative': -10 }
  })
});
assert.equal(setRes.status, 200);
const setData = await setRes.json();
assert.equal(setData.settings.class_limits['6A'], 15);
assert.equal(setData.settings.class_limits['9A'], 25, 'Float must be floored to integer');
assert.equal(setData.settings.class_limits['invalid../id'], undefined, 'Path traversal ID must be discarded');
assert.equal(setData.settings.class_limits['7B'], undefined, 'Negative limit must be discarded');
assert.equal(setData.settings.class_limits['8C'], undefined, 'Limit > 200 must be discarded');
assert.equal(setData.settings.student_limits['hs_valid'], 20);
assert.equal(setData.settings.student_limits['bad*id'], undefined, 'Invalid student ID must be discarded');
assert.equal(setData.settings.student_limits['hs_negative'], undefined, 'Negative student limit must be discarded');
console.log('  PASS: class_limits and student_limits sanitized to integer 0-200 with valid IDs only.');

console.log('\n======================================================');
console.log('ALL AI USAGE LIMITS & MONITORING TESTS PASSED 100%!');
console.log('======================================================');
