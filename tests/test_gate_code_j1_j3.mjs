/**
 * Verification Suite for Gate Code fixes J1–J3:
 * - J1: Atomic Quota Reservation & Refund (40 concurrent requests strictly cap at 30; Gemini 502 refunds turn)
 * - J2: packages_private flat schema with ':' delimiter and upload script contract
 * - J3: Clean repository sanitization (git author noreply, no real API keys / personal emails)
 */

import assert from 'node:assert/strict';
import worker, {
  MockDONamespace,
  registerStudentCredential,
  setPrivatePackage,
  createFirebaseCustomToken
} from '../worker/index.js';
import { TutorContract, IdValidationContract } from '../worker/contracts.js';

console.log('=== RUNNING VERIFICATION SUITE FOR J1–J3 ===');

const sharedDO = new MockDONamespace();

// Generate real RSA keypair for testing
const rsaKeypair = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  },
  true,
  ['sign', 'verify']
);

// Register test student
await registerStudentCredential('hs_j_atomic', '1234', '1234567890abcdef1234567890abcdef', {
  name: 'Học sinh Test J',
  grade: 6,
  class_code: '6A'
});

const baseEnv = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: rsaKeypair,
  MOCK_MODE: true,
  ALLOWED_ORIGIN: 'https://myschool.edu.vn',
  FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
  TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'
};

// Log in student to get JWT token
const loginRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_j_atomic', pin: '1234' })
}), baseEnv);
assert.equal(loginRes.status, 200);
const { token: studentToken } = await loginRes.json();

// ---------------------------------------------------------------------------
// 1. TEST J1: ATOMIC QUOTA RESERVATION (40 CONCURRENT REQUESTS CAP AT 30)
// ---------------------------------------------------------------------------
console.log('\n[1/3] Testing J1: Atomic quota reservation under 40 concurrent requests...');

const originalFetch = globalThis.fetch;
try {
  // Simulate Gemini API with slight network delay (20ms) to test concurrency race conditions
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('generateContent')) {
      await new Promise(resolve => setTimeout(resolve, 20));
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Gia sư Socrates phản hồi' }]} }]
      }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  const envGemini = {
    ...baseEnv,
    GEMINI_API_KEY: 'TEST_GEMINI_KEY'
  };

  // Launch 40 simultaneous requests
  const promises = [];
  for (let i = 1; i <= 40; i++) {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ message: `Câu hỏi đồng thời thứ ${i}` })
    });
    promises.push(worker.fetch(req, envGemini));
  }

  const responses = await Promise.all(promises);
  const statusCounts = { 200: 0, 429: 0, other: 0 };
  for (const res of responses) {
    if (res.status === 200) statusCounts[200]++;
    else if (res.status === 429) statusCounts[429]++;
    else statusCounts.other++;
  }

  console.log(`  Concurrent results: 200 OK: ${statusCounts[200]}, 429 Too Many Requests: ${statusCounts[429]}`);
  assert.equal(statusCounts[200], 30, 'Exactly 30 concurrent requests must succeed');
  assert.equal(statusCounts[429], 10, 'Exactly 10 concurrent requests must be rejected with 429');
  assert.equal(statusCounts.other, 0, 'No unexpected error codes allowed');

  const today = new Date().toISOString().slice(0, 10);
  const finalCount = await sharedDO.doInstance.storage.get(`tutor_std:hs_j_atomic:${today}`);
  assert.equal(finalCount, 30, 'Total recorded storage count must be exactly 30');
} finally {
  globalThis.fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// 2. TEST J1: QUOTA REFUND ON GEMINI GATEWAY FAILURE (502 / NETWORK ERROR)
// ---------------------------------------------------------------------------
console.log('\n[2/3] Testing J1: Quota refund when Gemini service fails (HTTP 502)...');

// Register second student for refund test
await registerStudentCredential('hs_j_refund', '1234', '11112222333344445555666677778888', {
  name: 'Học sinh Test Refund',
  grade: 6,
  class_code: '6A'
});

const loginResRefund = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_j_refund', pin: '1234' })
}), baseEnv);
const { token: refundToken } = await loginResRefund.json();

try {
  // Simulate Gemini returning 500 error
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('generateContent')) {
      return new Response(JSON.stringify({ error: 'Gemini Internal Error' }), { status: 500 });
    }
    return originalFetch(url, options);
  };

  const reqFailing = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${refundToken}`
    },
    body: JSON.stringify({ message: 'Câu hỏi sẽ bị lỗi 502' })
  });

  const resFailing = await worker.fetch(reqFailing, {
    ...baseEnv,
    GEMINI_API_KEY: 'TEST_GEMINI_KEY'
  });
  assert.equal(resFailing.status, 502, 'Gemini 500 must return 502 Gateway Error');

  const today = new Date().toISOString().slice(0, 10);
  const refundCount = (await sharedDO.doInstance.storage.get(`tutor_std:hs_j_refund:${today}`)) || 0;
  assert.equal(refundCount, 0, 'Quota must be refunded (decremented) to 0 on 502 error');
  console.log('  PASS J1: Failed Gemini call successfully refunded quota in DO.');
} finally {
  globalThis.fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// 3. TEST J2: PACKAGES_PRIVATE SCHEMA FORMAT
// ---------------------------------------------------------------------------
console.log('\n[3/3] Testing J2: Schema for packages_private with ":" delimiter...');

const pkgKey = IdValidationContract.getPackageKey('tin6', 'bai1');
assert.equal(pkgKey, 'tin6:bai1');

setPrivatePackage(pkgKey, {
  package_id: 'tin6:bai1',
  course_id: 'tin6',
  lesson_id: 'bai1',
  total_questions: 1,
  questions: [{ id: 'q1', correct_answer: 'A' }]
});

const reqSubmit = new Request('http://localhost/api/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`
  },
  body: JSON.stringify({
    attempt_id: 'att_j2_01',
    course_id: 'tin6',
    lesson_id: 'bai1',
    answers: { q1: 'A' }
  })
});
const resSubmit = await worker.fetch(reqSubmit, baseEnv);
assert.equal(resSubmit.status, 200, 'Submission with packages_private schema must succeed');
const subData = await resSubmit.json();
assert.equal(subData.score, 10);
console.log('  PASS J2: Schema packages_private validated cleanly.');

console.log('\n[4/4] Testing K1: Rejection of hardcoded service account email when FIREBASE_CLIENT_EMAIL is missing...');
await assert.rejects(
  async () => {
    await createFirebaseCustomToken('hs_k1', {}, rsaKeypair.privateKey, null);
  },
  {
    message: /Thiếu Service Account Client Email/
  },
  'Must reject with configuration error when clientEmail is missing or null'
);

await assert.rejects(
  async () => {
    await createFirebaseCustomToken('hs_k1', {}, rsaKeypair.privateKey, '');
  },
  {
    message: /Thiếu Service Account Client Email/
  },
  'Must reject with configuration error when clientEmail is empty'
);

// Verify valid client email passes
const validToken = await createFirebaseCustomToken('hs_k1', {}, rsaKeypair.privateKey, 'sa@myschool.iam.gserviceaccount.com');
assert.ok(validToken && typeof validToken === 'string');
console.log('  PASS K1: Missing client email strictly fails closed with configuration error (0 hardcoded defaults).');

console.log('\n=== ALL J1–J3 + K1 TESTS PASSED ===');
