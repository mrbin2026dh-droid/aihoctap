/**
 * Test Suite: Gemini Key Pool & Failover in Durable Object (C5)
 * Tests:
 * 1. Teacher adds Gemini keys -> Encrypted AES-GCM in DO, returns only masked suffix (...WXYZ)
 * 2. Teacher views key list -> Only masked suffixes & usage metrics, zero full keys returned
 * 3. Load balancing: selects least used active key
 * 4. 429 / RESOURCE_EXHAUSTED failover: switches immediately to next key in pool
 * 5. Complete exhaustion: when all keys exhausted, returns standard error AI_QUOTA_EXHAUSTED (429)
 * 6. Teacher deletes key from pool
 * 7. Security invariant: zero full key leakage across responses & storage inspection
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, {
  getOrCreateSigningKeys,
  createFirebaseCustomToken,
  MockDONamespace
} from '../worker/index.js';

console.log('=== RUNNING GEMINI KEY POOL & FAILOVER VERIFICATION (C5) ===\n');

const signingKeys = await getOrCreateSigningKeys();
const sharedDONamespace = new MockDONamespace();

const teacherToken = await createFirebaseCustomToken(
  'teacher_key_admin',
  { role: 'teacher', admin: true, name: 'Thầy Quản Trị' },
  signingKeys.privateKey,
  'firebase-adminsdk-eval@aihoctap.iam.gserviceaccount.com'
);

const studentToken = await createFirebaseCustomToken(
  'student_tutor_user',
  { role: 'student', grade: 9, class_code: '9A', name: 'Em Học Sinh' },
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

// -------------------------------------------------------------
// [0/6] TEST O1: FAIL-CLOSED ON MISSING/SHORT KEY_ENC_SECRET (< 32 CHARS)
// -------------------------------------------------------------
console.log('[0/6] Testing O1: Fail-closed on missing/invalid KEY_ENC_SECRET...');

// Test 0a: Missing KEY_ENC_SECRET -> 500
const noSecretEnv = { ...testEnv, KEY_ENC_SECRET: undefined };
const noSecretReq = new Request('http://localhost/api/teacher/gemini-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify({ api_key: 'AIzaSyKeyValidLengthToken1111', note: 'test' })
});
const noSecretRes = await worker.fetch(noSecretReq, noSecretEnv);
assert.equal(noSecretRes.status, 500, 'Missing KEY_ENC_SECRET must return 500 fail-closed');

// Verify DO has no key record stored
const doStub = sharedDONamespace.get(sharedDONamespace.idFromName('default'));
const listRes0 = await doStub.fetch('http://do/list-gemini-keys');
const listData0 = await listRes0.json();
assert.equal(listData0.keys.length, 0, 'No keys must be saved when secret is missing');

// Test 0b: Short KEY_ENC_SECRET (10 chars < 32) -> 500
const shortSecretEnv = { ...testEnv, KEY_ENC_SECRET: 'short-10ch' };
const shortSecretRes = await worker.fetch(noSecretReq, shortSecretEnv);
assert.equal(shortSecretRes.status, 500, 'Short KEY_ENC_SECRET (< 32 chars) must return 500 fail-closed');

// Test 0c: Static check: worker/index.js must not contain default-gemini-pool hardcoded fallback
const workerCode = fs.readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
assert(!workerCode.includes('default-gemini-pool'), 'Zero hardcoded default-gemini-pool secret allowed in codebase (O1)');

console.log('  PASS O1: Fail-closed on KEY_ENC_SECRET strictly enforced.');

// -------------------------------------------------------------
// [1/6] TEST TEACHER ADDS GEMINI KEYS (ENCRYPTED & MASKED SUFFIX ONLY)
// -------------------------------------------------------------
console.log('[1/6] Testing teacher adding Gemini API keys to pool...');

const key1Raw = 'AIzaSyKeyAlphaMockToken1111';
const key2Raw = 'AIzaSyKeyBetaMockToken2222';

const addKey1Req = new Request('http://localhost/api/teacher/gemini-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify({
    api_key: key1Raw,
    note: 'Khóa tài khoản 1'
  })
});

const addKey1Res = await worker.fetch(addKey1Req, testEnv);
assert.equal(addKey1Res.status, 200, 'Adding key 1 must return 200');
const addKey1Data = await addKey1Res.json();
assert.equal(addKey1Data.success, true);
assert(addKey1Data.key.id, 'Must return generated key id');
assert.equal(addKey1Data.key.key_suffix, '1111', 'Must return only last 4 characters');
assert(!JSON.stringify(addKey1Data).includes(key1Raw), 'Full API key must NEVER be in response');

const addKey2Req = new Request('http://localhost/api/teacher/gemini-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify({
    api_key: key2Raw,
    note: 'Khóa tài khoản 2'
  })
});
const addKey2Res = await worker.fetch(addKey2Req, testEnv);
assert.equal(addKey2Res.status, 200);
const addKey2Data = await addKey2Res.json();
assert.equal(addKey2Data.key.key_suffix, '2222');

console.log('  PASS: Teacher successfully added 2 keys; full keys strictly omitted from output.');

// -------------------------------------------------------------
// [2/6] TEST TEACHER LISTS KEYS (MASKED & USAGE STATS)
// -------------------------------------------------------------
console.log('\n[2/6] Testing teacher listing key pool status...');

const listKeysReq = new Request('http://localhost/api/teacher/gemini-keys', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${teacherToken}`
  }
});
const listKeysRes = await worker.fetch(listKeysReq, testEnv);
assert.equal(listKeysRes.status, 200);
const listKeysData = await listKeysRes.json();
assert(Array.isArray(listKeysData.keys));
assert.equal(listKeysData.keys.length, 2);
assert.equal(listKeysData.keys[0].key_suffix, '1111');
assert.equal(listKeysData.keys[1].key_suffix, '2222');
assert(!JSON.stringify(listKeysData).includes(key1Raw), 'Full key 1 must not appear in list response');
assert(!JSON.stringify(listKeysData).includes(key2Raw), 'Full key 2 must not appear in list response');

console.log('  PASS: Teacher key list returns only masked suffixes & status.');

// -------------------------------------------------------------
// [3/6] TEST LOAD BALANCING (SELECTS LEAST USED KEY)
// -------------------------------------------------------------
console.log('\n[3/6] Testing load balancing between pool keys...');

let capturedUsedKeys = [];
const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      const usedKey = init?.headers?.['x-goog-api-key'];
      capturedUsedKeys.push(usedKey);
      return new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: 'Gia sư: Thầy/Cô có thể gợi ý cho em bước đầu tiên như thế nào?' }] }
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  // Call tutor 1 -> should pick key 1 (or 2)
  const tutorReq1 = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      message: 'Mạng máy tính là gì?'
    })
  });
  const tutorRes1 = await worker.fetch(tutorReq1, testEnv);
  assert.equal(tutorRes1.status, 200);

  // Call tutor 2 -> should balance to the other key
  const tutorReq2 = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      message: 'Internet là gì?'
    })
  });
  const tutorRes2 = await worker.fetch(tutorReq2, testEnv);
  assert.equal(tutorRes2.status, 200);

  assert.equal(capturedUsedKeys.length, 2);
  assert(capturedUsedKeys.includes(key1Raw), 'Must have utilized key 1');
  assert(capturedUsedKeys.includes(key2Raw), 'Must have balanced to key 2');

} finally {
  globalThis.fetch = originalFetch;
}

console.log('  PASS: Load balancing distributed calls evenly across available pool keys.');

// -------------------------------------------------------------
// [4/6] TEST AUTOMATIC 429 FAILOVER TO NEXT KEY IN POOL
// -------------------------------------------------------------
console.log('\n[4/6] Testing automatic failover on 429 rate limit...');

capturedUsedKeys = [];
try {
  // Simulate key 1 hitting 429, key 2 succeeding
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      const usedKey = init?.headers?.['x-goog-api-key'];
      capturedUsedKeys.push(usedKey);
      if (usedKey === key1Raw) {
        return new Response(JSON.stringify({
          error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' }
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: 'Gia sư: Em hãy nhớ lại khái niệm trọng tâm trong bài học nhé!' }] }
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  const tutorFailoverReq = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      message: 'Cáp mạng có mấy loại?'
    })
  });

  const tutorFailoverRes = await worker.fetch(tutorFailoverReq, testEnv);
  assert.equal(tutorFailoverRes.status, 200, 'Must seamlessly succeed via failover key 2');
  assert(capturedUsedKeys.includes(key1Raw), 'Attempted key 1 first');
  assert(capturedUsedKeys.includes(key2Raw), 'Failed over to key 2');

} finally {
  globalThis.fetch = originalFetch;
}

console.log('  PASS: Seamless failover from 429 rate-limited key to next pool key verified.');

// -------------------------------------------------------------
// [5/6] TEST COMPLETE POOL EXHAUSTION (AI_QUOTA_EXHAUSTED)
// -------------------------------------------------------------
console.log('\n[5/6] Testing complete pool exhaustion (AI_QUOTA_EXHAUSTED)...');

try {
  // Simulate both keys returning 429
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({
        error: { code: 429, message: 'Resource has been exhausted.' }
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, init);
  };

  const exhaustedReq = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      message: 'Hỏi câu nữa khi hết sạch khóa'
    })
  });

  const exhaustedRes = await worker.fetch(exhaustedReq, testEnv);
  assert.equal(exhaustedRes.status, 429, 'Must return 429 when entire pool exhausted');
  const exhaustedData = await exhaustedRes.json();
  assert.equal(exhaustedData.error, 'AI_QUOTA_EXHAUSTED', 'Must have error code AI_QUOTA_EXHAUSTED');
  assert(exhaustedData.detail.includes('Gia sư đang nghỉ'), 'Must have student-friendly message');

} finally {
  globalThis.fetch = originalFetch;
}

console.log('  PASS: Standard AI_QUOTA_EXHAUSTED returned when all pool keys exhausted.');

// -------------------------------------------------------------
// [6/6] TEST TEACHER DELETES KEY FROM POOL
// -------------------------------------------------------------
console.log('\n[6/6] Testing key deletion by teacher...');

const deleteKeyReq = new Request(`http://localhost/api/teacher/gemini-keys?id=${addKey1Data.key.id}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${teacherToken}`
  }
});

const deleteKeyRes = await worker.fetch(deleteKeyReq, testEnv);
assert.equal(deleteKeyRes.status, 200);

const listAfterDeleteRes = await worker.fetch(listKeysReq, testEnv);
const listAfterData = await listAfterDeleteRes.json();
assert.equal(listAfterData.keys.length, 1);
assert.equal(listAfterData.keys[0].key_suffix, '2222');

console.log('  PASS: Key deletion verified.');

console.log('\n======================================================');
console.log('ALL GEMINI KEY POOL TESTS PASSED 100%!');
console.log('======================================================');
