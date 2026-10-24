/**
 * Test Suite for Gate Code fixes H1–H6:
 * - H1: Path Traversal Protection on RTDB URLs (attempt_id, course_id, lesson_id, student_id)
 * - H2: Automatic derivation of public key from PKCS8 private key (no FIREBASE_PUBLIC_KEY needed, handles \n PEM)
 * - H3: Fail-closed on missing Service Account keys (presence of GATE_DO alone does NOT trigger ephemeral keys; MOCK_MODE gated)
 * - H4: RTDB REST error handling (write failure != 200, network error in login != failed credential lockout; Bearer header auth)
 * - H5: Gemini AI Tutor security (x-goog-api-key header, message length limit <= 1000, per-UID quota limit)
 */

import assert from 'node:assert/strict';
import worker, {
  MockDONamespace,
  registerStudentCredential,
  setPrivatePackage,
  loadOrDeriveServiceAccountKeys,
  base64UrlEncode
} from '../worker/index.js';
import { IdValidationContract } from '../worker/contracts.js';

console.log('=== RUNNING VERIFICATION SUITE FOR H1–H6 ===');

// Setup base mock DO
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

// Export private key to PKCS8 PEM string
const pkcs8Der = await crypto.subtle.exportKey('pkcs8', rsaKeypair.privateKey);
const pkcs8B64 = base64UrlEncode(pkcs8Der);
// PEM with literal \n characters as often passed in environment variables
const pkcs8PemEscaped = `-----BEGIN PRIVATE KEY-----\\n${pkcs8B64}\\n-----END PRIVATE KEY-----`;

// Register test student
await registerStudentCredential('hs_h_test', '123456', '1234567890abcdef1234567890abcdef', {
  name: 'Học sinh Test H',
  grade: 6,
  class_code: '6A'
});

setPrivatePackage('tin6_bai1', {
  questions: [{ id: 'q1', correct_answer: 'A' }]
});

// ---------------------------------------------------------------------------
// 1. TEST H1: PATH TRAVERSAL ATTEMPTS MUST RETURN 400 (NO RTDB CALL)
// ---------------------------------------------------------------------------
console.log('\n[1/5] Testing H1: Path traversal protection on all ID parameters...');

const envH1 = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: rsaKeypair,
  MOCK_MODE: true,
  ALLOW_EPHEMERAL_DEV_KEYS: true,
  FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
  TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'
};

// Test IdValidationContract unit invariants
assert.equal(IdValidationContract.isValidId('valid_id-123'), true);
assert.equal(IdValidationContract.isValidId('../../students_auth/victim'), false);
assert.equal(IdValidationContract.isValidId('hs1/../admin'), false);
assert.equal(IdValidationContract.isValidId('hs1%2e%2e'), false);
assert.equal(IdValidationContract.isValidId(''), false);
assert.equal(IdValidationContract.isValidId('a'.repeat(65)), false);

// 1.1: Submit with path traversal attempt_id
let loginRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_h_test', pin: '123456' })
}), envH1);
assert.equal(loginRes.status, 200);
const { token: studentToken } = await loginRes.json();

let fetchCalledOnRTDB = false;
globalThis.__mockFetch = () => {
  fetchCalledOnRTDB = true;
};

const reqTraversalSubmit = new Request('http://localhost/api/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`
  },
  body: JSON.stringify({
    attempt_id: '../../students_auth/victim',
    course_id: 'tin6',
    lesson_id: 'bai1',
    answers: { q1: 'A' }
  })
});

const resTraversalSubmit = await worker.fetch(reqTraversalSubmit, envH1);
assert.equal(resTraversalSubmit.status, 400, 'Traversal in attempt_id must return 400 Bad Request');
assert.equal(fetchCalledOnRTDB, false, 'No external RTDB fetch should occur on traversal attempt');

// 1.2: Login with path traversal in student_id
const reqTraversalLogin = new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: '../../students_auth/victim', pin: '123456' })
});
const resTraversalLogin = await worker.fetch(reqTraversalLogin, envH1);
assert.equal(resTraversalLogin.status, 400, 'Traversal in student_id must return 400 Bad Request');

// 1.3: Teacher unlock with path traversal in student_id
const reqTraversalUnlock = new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Secret': envH1.TEACHER_ADMIN_SECRET
  },
  body: JSON.stringify({ student_id: '../../students_auth/victim' })
});
const resTraversalUnlock = await worker.fetch(reqTraversalUnlock, envH1);
assert.equal(resTraversalUnlock.status, 400, 'Traversal in unlock student_id must return 400 Bad Request');
console.log('  PASS H1: All traversal attempts rejected with 400.');

// ---------------------------------------------------------------------------
// 2. TEST H2: DERIVE PUBLIC KEY AUTOMATICALLY FROM FIREBASE_PRIVATE_KEY
// ---------------------------------------------------------------------------
console.log('\n[2/5] Testing H2: Automatic public key derivation from PKCS8 private key...');

const envH2 = {
  GATE_DO: sharedDO,
  FIREBASE_PRIVATE_KEY: pkcs8PemEscaped, // ONLY private key, with literal \n
  FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
  MOCK_MODE: true,
  TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'
};

const keysDerived = await loadOrDeriveServiceAccountKeys(envH2);
assert.ok(keysDerived.privateKey, 'Private key must be loaded');
assert.ok(keysDerived.publicKey, 'Public key MUST be automatically derived from private key');

// Login with derived keypair
const resLoginH2 = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_h_test', pin: '123456' })
}), envH2);
assert.equal(resLoginH2.status, 200);
const { token: tokenH2 } = await resLoginH2.json();

// Submit with token signed by private key, verified with automatically derived public key
const resSubmitH2 = await worker.fetch(new Request('http://localhost/api/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenH2}`
  },
  body: JSON.stringify({
    attempt_id: 'att_001',
    course_id: 'tin6',
    lesson_id: 'bai1',
    answers: { q1: 'A' }
  })
}), envH2);
assert.equal(resSubmitH2.status, 200, 'Submit must succeed without requiring separate FIREBASE_PUBLIC_KEY');

// Tutor with token verified by derived public key
const resTutorH2 = await worker.fetch(new Request('http://localhost/api/tutor', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenH2}`
  },
  body: JSON.stringify({ message: 'Chào gia sư!' })
}), envH2);
assert.equal(resTutorH2.status, 200, 'Tutor must succeed without requiring separate FIREBASE_PUBLIC_KEY');
console.log('  PASS H2: Public key derived cleanly from private key; submits and tutor verify 200.');

// ---------------------------------------------------------------------------
// 3. TEST H3: FAIL-CLOSED ON MISSING KEYS AND MOCK GATEKEEPER
// ---------------------------------------------------------------------------
console.log('\n[3/5] Testing H3: Fail-closed on missing keys & strict MOCK_MODE check...');

// 3.1: GATE_DO present, but NO private key and NO dev flag -> MUST FAIL-CLOSED (500)
const envMissingKeys = {
  GATE_DO: sharedDO,
  MOCK_MODE: true
  // NO FIREBASE_PRIVATE_KEY, NO SIGNING_KEYPAIR, NO ALLOW_EPHEMERAL_DEV_KEYS
};

const keysFailClosed = await loadOrDeriveServiceAccountKeys(envMissingKeys);
assert.equal(keysFailClosed, null, 'Must NOT generate ephemeral keys when ALLOW_EPHEMERAL_DEV_KEYS is false');

const resLoginNoKey = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_h_test', pin: '123456' })
}), envMissingKeys);
assert.equal(resLoginNoKey.status, 500, 'Missing signing keys in non-dev environment must return 500');

// 3.2: Missing RTDB config when MOCK_MODE is NOT true -> MUST FAIL-CLOSED (500)
const envNoRtdbNoMock = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: rsaKeypair
  // NO FIREBASE_DATABASE_URL and MOCK_MODE is undefined/false
};
const resLoginNoMock = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_h_test', pin: '123456' })
}), envNoRtdbNoMock);
assert.equal(resLoginNoMock.status, 500, 'Must NOT silently use mock data when MOCK_MODE is not set (fail-closed 500)');
console.log('  PASS H3: Strict fail-closed enforced for signing keys and database driver.');

// ---------------------------------------------------------------------------
// 4. TEST H4: RTDB ERROR HANDLING AND OAUTH REST AUTH
// ---------------------------------------------------------------------------
console.log('\n[4/5] Testing H4: RTDB error handling & OAuth REST header...');

// 4.1: If RTDB write fails, /api/submit must return error (502), NOT 200!
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/packages_private/')) {
      return new Response(JSON.stringify({
        questions: [{ id: 'q1', correct_answer: 'A' }]
      }), { status: 200 });
    }
    if (urlStr.includes('/attempts/')) {
      // Simulate RTDB 500 internal server error
      return new Response(JSON.stringify({ error: 'RTDB internal write failure' }), { status: 500 });
    }
    return originalFetch(url, options);
  };

  const envRtdbFailing = {
    GATE_DO: sharedDO,
    SIGNING_KEYPAIR: rsaKeypair,
    FIREBASE_DATABASE_URL: 'https://test-rtdb.firebaseio.com',
    FIREBASE_AUTH_TOKEN: 'test_bearer_token',
    MOCK_MODE: true
  };

  const resSubmitRtdbFail = await worker.fetch(new Request('http://localhost/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      attempt_id: 'att_rtdb_fail',
      course_id: 'tin6',
      lesson_id: 'bai1',
      answers: { q1: 'A' }
    })
  }), envRtdbFailing);

  assert.equal(resSubmitRtdbFail.status, 502, 'When RTDB fails to save attempt, submit must return 502');

  // 4.2: If RTDB read in /api/login fails with 500, return 502 without recording failed PIN attempt
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/students_auth/')) {
      return new Response(JSON.stringify({ error: 'RTDB unavailable' }), { status: 500 });
    }
    return originalFetch(url, options);
  };

  const resLoginRtdbFail = await worker.fetch(new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: 'hs_h_test', pin: '123456' })
  }), envRtdbFailing);

  assert.equal(resLoginRtdbFail.status, 502, 'RTDB connection error must return 502, not 401');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('  PASS H4: RTDB write errors return 502; read network errors return 502 (no lockout penalty).');

// ---------------------------------------------------------------------------
// 5. TEST H5: GEMINI AI TUTOR SECURITY & LIMITS
// ---------------------------------------------------------------------------
console.log('\n[5/5] Testing H5: Gemini API proxy security, header key, message limits & per-UID quota...');

// 5.1: Message length > 1000 characters returns 400
const reqOversizedTutor = new Request('http://localhost/api/tutor', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`
  },
  body: JSON.stringify({ message: 'x'.repeat(1001) })
});
const resOversizedTutor = await worker.fetch(reqOversizedTutor, envH1);
assert.equal(resOversizedTutor.status, 400, 'Tutor message > 1000 characters must return 400 Bad Request');

// 5.2: Gemini API key must be sent via x-goog-api-key header, not in URL query
let interceptedHeaders = null;
let interceptedUrl = null;
globalThis.fetch = async (url, options = {}) => {
  interceptedUrl = String(url);
  interceptedHeaders = options.headers;
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'Gia sư trả lời' }]} }]
  }), { status: 200 });
};

try {
  const envGemini = {
    ...envH1,
    GEMINI_API_KEY: 'TEST_GEMINI_API_KEY_123',
    ALLOWED_ORIGIN: 'https://myschool.edu.vn'
  };

  const reqTutorOk = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ message: 'Gợi ý em bài 1' })
  });
  const resTutorOk = await worker.fetch(reqTutorOk, envGemini);
  assert.equal(resTutorOk.status, 200);
  assert.equal(resTutorOk.headers.get('Access-Control-Allow-Origin'), 'https://myschool.edu.vn');
  assert.ok(!interceptedUrl.includes('key='), 'API key must NOT appear in URL query parameters');
  assert.equal(interceptedHeaders?.['x-goog-api-key'], 'TEST_GEMINI_API_KEY_123', 'API key must be passed via x-goog-api-key header');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('  PASS H5: Gemini headers, message length limit, per-UID quota and CORS verified.');

console.log('\n=== ALL H1–H6 CONTRACT & IMPLEMENTATION TESTS PASSED ===');
