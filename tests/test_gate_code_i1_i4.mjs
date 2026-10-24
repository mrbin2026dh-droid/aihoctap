/**
 * Verification Suite for Gate Code fixes I1–I4:
 * - I1: Real Service Account to Google OAuth2 access token exchange via Web Crypto assertion,
 *       token caching in memory, and Authorization: Bearer <oauth_token> on RTDB requests.
 * - I2: ALLOWED_ORIGIN is strictly mandatory (fail-closed 500 if missing, no hardcoded personal domain).
 * - I3: context.grade strict coercion to integer 1..12 (blocks 200KB payload prompt injection).
 * - I4:
 *   a) Gemini quota count does NOT increment on 400 Bad Request or 502 Gateway Error; only on 200.
 *   b) packageKey uses non-regex delimiter ':' (prevents collision between 'a_b'+'c' and 'a'+'b_c').
 *   c) RTDB read failure in /api/submit returns 502 Bad Gateway, not 404 Not Found.
 */

import assert from 'node:assert/strict';
import worker, {
  MockDONamespace,
  registerStudentCredential,
  setPrivatePackage,
  getOrFetchGoogleOAuthToken
} from '../worker/index.js';
import { IdValidationContract, SecurityConfigContract, TutorContract } from '../worker/contracts.js';

console.log('=== RUNNING VERIFICATION SUITE FOR I1–I4 ===');

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
await registerStudentCredential('hs_i_test', '1234', '1234567890abcdef1234567890abcdef', {
  name: 'Học sinh Test I',
  grade: 6,
  class_code: '6A'
});

// Setup package with ':' delimiter
setPrivatePackage('tin6:bai1', {
  questions: [{ id: 'q1', correct_answer: 'A' }]
});

const baseEnv = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: rsaKeypair,
  MOCK_MODE: true,
  ALLOW_EPHEMERAL_DEV_KEYS: true,
  ALLOWED_ORIGIN: 'https://myschool.edu.vn',
  FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
  TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'
};

// Log in student to get JWT token
const loginRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_i_test', pin: '1234' })
}), baseEnv);
assert.equal(loginRes.status, 200);
const { token: studentToken } = await loginRes.json();

// ---------------------------------------------------------------------------
// 1. TEST I2: ALLOWED_ORIGIN STRICTLY MANDATORY (NO HARDCODED PERSONAL DOMAIN)
// ---------------------------------------------------------------------------
console.log('\n[1/4] Testing I2: ALLOWED_ORIGIN mandatory invariant...');

// In production (MOCK_MODE false), missing ALLOWED_ORIGIN must return 500
const envMissingOrigin = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: rsaKeypair,
  FIREBASE_DATABASE_URL: 'https://test-rtdb.firebaseio.com'
  // NO ALLOWED_ORIGIN
};
const resMissingOrigin = await worker.fetch(new Request('http://localhost/api/health'), envMissingOrigin);
assert.equal(resMissingOrigin.status, 500, 'Missing ALLOWED_ORIGIN in production must return 500 Fail-Closed');
const errDataOrigin = await resMissingOrigin.json();
assert.match(errDataOrigin.detail, /ALLOWED_ORIGIN/i);
console.log('  PASS I2: Missing ALLOWED_ORIGIN strictly returns 500 Fail-Closed.');

// ---------------------------------------------------------------------------
// 2. TEST I3: context.grade STRICT COERCION (BLOCKS 200KB INJECTION)
// ---------------------------------------------------------------------------
console.log('\n[2/4] Testing I3: context.grade coercion & prompt injection prevention...');

assert.equal(TutorContract.coerceGrade(6), 6);
assert.equal(TutorContract.coerceGrade('9'), 9);
assert.equal(TutorContract.coerceGrade('12'), 12);
assert.equal(TutorContract.coerceGrade('x'.repeat(200000)), 6, '200KB payload must coerce to default 6');
assert.equal(TutorContract.coerceGrade(-5), 6, 'Negative grade must coerce to 6');
assert.equal(TutorContract.coerceGrade(15), 6, 'Grade > 12 must coerce to 6');
assert.equal(TutorContract.coerceGrade(null), 6);
assert.equal(TutorContract.coerceGrade(undefined), 6);

// Verify in Worker /api/tutor endpoint with Gemini mock
let capturedPrompt = '';
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('generateContent')) {
      const body = JSON.parse(options.body);
      capturedPrompt = body.contents?.[0]?.parts?.[0]?.text || '';
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Gia sư phản hồi' }]} }]
      }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  const maliciousPayload = 'MALICIOUS_INJECTION_'.repeat(10000); // ~200KB
  const reqTutorAttack = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      message: 'Giải thích giúp em câu hỏi này',
      context: { grade: maliciousPayload }
    })
  });

  const resTutorAttack = await worker.fetch(reqTutorAttack, {
    ...baseEnv,
    GEMINI_API_KEY: 'TEST_GEMINI_KEY'
  });
  assert.equal(resTutorAttack.status, 200);
  assert.ok(!capturedPrompt.includes('MALICIOUS_INJECTION'), 'Prompt must NOT contain malicious context.grade payload');
  assert.ok(capturedPrompt.includes('lớp 6'), 'Prompt must contain safely coerced grade (lớp 6)');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('  PASS I3: 200KB context.grade payload strictly neutralized and coerced.');

// ---------------------------------------------------------------------------
// 3. TEST I4: GEMINI COUNTER TIMING, PACKAGE DELIMITER & RTDB READ 502
// ---------------------------------------------------------------------------
console.log('\n[3/4] Testing I4: Counter timing, delimiter ":" and RTDB 502 vs 404...');

// 3.1: Delimiter ':' prevents collision
const key1 = IdValidationContract.getPackageKey('a_b', 'c');
const key2 = IdValidationContract.getPackageKey('a', 'b_c');
assert.notEqual(key1, key2, 'Keys "a_b:c" and "a:b_c" must NOT collide');
assert.equal(key1, 'a_b:c');
assert.equal(key2, 'a:b_c');

// 3.2: Counter does NOT increment on 400 Bad Request
const countBefore400 = (await sharedDO.doInstance.storage.get(`tutor_std:hs_i_test:${new Date().toISOString().slice(0, 10)}`)) || 0;
const reqBadMessage = new Request('http://localhost/api/tutor', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`
  },
  body: JSON.stringify({ message: '' }) // Invalid empty message -> 400
});
const resBadMessage = await worker.fetch(reqBadMessage, baseEnv);
assert.equal(resBadMessage.status, 400);
const countAfter400 = (await sharedDO.doInstance.storage.get(`tutor_std:hs_i_test:${new Date().toISOString().slice(0, 10)}`)) || 0;
assert.equal(countAfter400, countBefore400, 'Failed 400 request must NOT increment daily quota');

// 3.3: Counter does NOT increment on 502 Gemini gateway failure
try {
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('generateContent')) {
      return new Response(JSON.stringify({ error: 'Gemini server overloaded' }), { status: 503 });
    }
    return originalFetch(url, options);
  };

  const reqFailingGemini = new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ message: 'Chào gia sư!' })
  });
  const resFailingGemini = await worker.fetch(reqFailingGemini, {
    ...baseEnv,
    GEMINI_API_KEY: 'TEST_GEMINI_KEY'
  });
  assert.equal(resFailingGemini.status, 502);
  const countAfter502 = (await sharedDO.doInstance.storage.get(`tutor_std:hs_i_test:${new Date().toISOString().slice(0, 10)}`)) || 0;
  assert.equal(countAfter502, countBefore400, 'Failed 502 request must NOT increment daily quota');
} finally {
  globalThis.fetch = originalFetch;
}

// 3.4: RTDB read failure in /api/submit returns 502, not 404
try {
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/packages_private/')) {
      return new Response(JSON.stringify({ error: 'RTDB Internal Error' }), { status: 500 });
    }
    return originalFetch(url, options);
  };

  const reqSubmitRtdb500 = new Request('http://localhost/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      attempt_id: 'att_i4_test',
      course_id: 'tin6',
      lesson_id: 'bai1',
      answers: { q1: 'A' }
    })
  });

  const resSubmitRtdb500 = await worker.fetch(reqSubmitRtdb500, {
    ...baseEnv,
    FIREBASE_DATABASE_URL: 'https://test-rtdb.firebaseio.com',
    MOCK_MODE: false
  });
  assert.equal(resSubmitRtdb500.status, 502, 'RTDB 500 error when fetching question package must return 502, NOT 404');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('  PASS I4: Delimiter, quota commit timing and RTDB read 502 verified.');

// ---------------------------------------------------------------------------
// 4. TEST I1: GOOGLE OAUTH2 ACCESS TOKEN GENERATION & RTDB BEARER HEADER
// ---------------------------------------------------------------------------
console.log('\n[4/4] Testing I1: Service account to OAuth2 access token exchange & RTDB headers...');

let oauthTokenEndpointCalled = false;
let assertionReceived = '';
let rtdbAuthHeaderReceived = '';

try {
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/oauth2/v4/token') || urlStr.includes('/token')) {
      oauthTokenEndpointCalled = true;
      const params = new URLSearchParams(options.body);
      assertionReceived = params.get('assertion') || '';
      return new Response(JSON.stringify({
        access_token: 'mock_google_oauth2_access_token_xyz_123',
        expires_in: 3600,
        token_type: 'Bearer'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (urlStr.includes('test-rtdb.firebaseio.com')) {
      rtdbAuthHeaderReceived = options.headers?.['Authorization'] || '';
      if (urlStr.includes('/packages_private/')) {
        return new Response(JSON.stringify({
          questions: [{ id: 'q1', correct_answer: 'A' }]
        }), { status: 200 });
      }
      if (urlStr.includes('/attempts/')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
    }
    return originalFetch(url, options);
  };

  const envOAuthTest = {
    ...baseEnv,
    FIREBASE_DATABASE_URL: 'https://test-rtdb.firebaseio.com',
    FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
    GOOGLE_OAUTH2_TOKEN_URL: 'https://oauth2.googleapis.com/token',
    MOCK_MODE: false
  };

  const reqOAuthSubmit = new Request('http://localhost/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      attempt_id: 'att_oauth_test',
      course_id: 'tin6',
      lesson_id: 'bai1',
      answers: { q1: 'A' }
    })
  });

  const resOAuthSubmit = await worker.fetch(reqOAuthSubmit, envOAuthTest);
  assert.equal(resOAuthSubmit.status, 200);
  assert.ok(oauthTokenEndpointCalled, 'Google OAuth token endpoint must be called to mint access token');
  assert.ok(assertionReceived.length > 50, 'Valid RS256 assertion JWT must be posted to token endpoint');
  assert.equal(rtdbAuthHeaderReceived, 'Bearer mock_google_oauth2_access_token_xyz_123', 'RTDB requests must use Bearer OAuth access token');

  // Verify memory caching: subsequent call must reuse token without re-calling token endpoint
  oauthTokenEndpointCalled = false;
  const tokenCached = await getOrFetchGoogleOAuthToken(envOAuthTest, rsaKeypair.privateKey);
  assert.equal(tokenCached, 'mock_google_oauth2_access_token_xyz_123');
  assert.equal(oauthTokenEndpointCalled, false, 'Cached token must be reused within expiration window');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('  PASS I1: Google OAuth2 token exchange via RS256 assertion, memory caching and RTDB Bearer header verified.');

console.log('\n=== ALL I1–I4 AUDIT CONDITIONS VERIFIED SUCCESSFULLY ===');
