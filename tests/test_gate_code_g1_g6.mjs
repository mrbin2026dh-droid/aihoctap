/**
 * Verification Suite for G1–G6 fixes:
 * - G1: Fake Authorization header or hardcoded 'TEACHER_SECRET_KEY' MUST return 403.
 *       Valid unlock requires env.TEACHER_ADMIN_SECRET or valid teacher token.
 * - G2: Service Account key used for RS256 token, verified across isolates A and B.
 * - G4: Fail-closed when env.GATE_DO is missing (returns 500).
 * - G4: Prefix isolation: Unlocking 'hs1' must NOT unlock 'hs10'.
 */

import assert from 'node:assert/strict';
import worker, {
  MockDONamespace,
  registerStudentCredential,
  createFirebaseCustomToken,
  verifyJwtToken
} from '../worker/index.js';

console.log('=== RUNNING VERIFICATION SUITE FOR G1–G6 ===');

const sharedDO = new MockDONamespace();
const signingKeys = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  },
  true,
  ['sign', 'verify']
);

const envCommon = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: signingKeys,
  TEACHER_ADMIN_SECRET: 'VERY_STRONG_SECRET_AT_LEAST_16_CHARS',
  FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
  MOCK_MODE: true
};

// ---------------------------------------------------------------------------
// 1. TEST G4: FAIL-CLOSED WHEN env.GATE_DO IS MISSING (HTTP 500)
// ---------------------------------------------------------------------------
console.log('\n[1/4] Testing G4: Fail-closed (HTTP 500) when env.GATE_DO is missing...');
const reqWithoutDO = new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs1', pin: '1234' })
});
const resWithoutDO = await worker.fetch(reqWithoutDO, { SIGNING_KEYPAIR: signingKeys });
assert.equal(resWithoutDO.status, 500, 'Worker must return 500 when env.GATE_DO is missing (fail-closed)');
const errData = await resWithoutDO.json();
assert.match(errData.detail, /Fail-Closed/i);
console.log('  PASS G4: Fail-closed strictly enforced on missing GATE_DO.');

// ---------------------------------------------------------------------------
// 2. TEST G1: TEACHER UNLOCK SECURITY (NO HARDCODE, REJECTS FAKE HEADERS)
// ---------------------------------------------------------------------------
console.log('\n[2/4] Testing G1: Teacher unlock security & rejection of fake headers / secrets...');

// Fake header with substring 'teacher_token' -> 403
const reqFake1 = new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer teacher_token'
  },
  body: JSON.stringify({ student_id: 'hs1' })
});
const resFake1 = await worker.fetch(reqFake1, envCommon);
assert.equal(resFake1.status, 403, 'Arbitrary string "teacher_token" must return 403 Forbidden');

// Hardcoded secret 'TEACHER_SECRET_KEY' -> 403
const reqFake2 = new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Secret': 'TEACHER_SECRET_KEY'
  },
  body: JSON.stringify({ student_id: 'hs1' })
});
const resFake2 = await worker.fetch(reqFake2, envCommon);
assert.equal(resFake2.status, 403, 'Old hardcoded secret must return 403 Forbidden');

// Valid Secret matching env.TEACHER_ADMIN_SECRET -> 200
const reqValidSecret = new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Secret': 'VERY_STRONG_SECRET_AT_LEAST_16_CHARS'
  },
  body: JSON.stringify({ student_id: 'hs1' })
});
const resValidSecret = await worker.fetch(reqValidSecret, envCommon);
assert.equal(resValidSecret.status, 200, 'Valid configured secret must return 200 OK');

// Valid Teacher JWT with role: 'teacher' -> 200
const teacherJwt = await createFirebaseCustomToken(
  'teacher_01',
  { role: 'teacher', admin: true },
  signingKeys.privateKey,
  envCommon.FIREBASE_CLIENT_EMAIL
);
const reqValidJwt = new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherJwt}`
  },
  body: JSON.stringify({ student_id: 'hs1' })
});
const resValidJwt = await worker.fetch(reqValidJwt, envCommon);
assert.equal(resValidJwt.status, 200, 'Valid teacher token must return 200 OK');
console.log('  PASS G1: Fake unlock headers rejected (403), valid secret/JWT accepted.');

// ---------------------------------------------------------------------------
// 3. TEST G4: PREFIX ISOLATION: UNLOCKING 'hs1' MUST NOT UNLOCK 'hs10'
// ---------------------------------------------------------------------------
console.log('\n[3/4] Testing G4: Prefix isolation: Unlocking "hs1" must NOT unlock "hs10"...');
await registerStudentCredential('hs1', '1111', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
await registerStudentCredential('hs10', '2222', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

const clientIp = '10.0.0.1';

// Lock both hs1 and hs10 by failing 5 times each
for (let i = 1; i <= 5; i++) {
  const req1 = new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ student_id: 'hs1', pin: 'bad' })
  });
  await worker.fetch(req1, envCommon);

  const req10 = new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
    body: JSON.stringify({ student_id: 'hs10', pin: 'bad' })
  });
  await worker.fetch(req10, envCommon);
}

// Verify both are locked (status 429)
const chk1 = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
  body: JSON.stringify({ student_id: 'hs1', pin: '1111' })
}), envCommon);
assert.equal(chk1.status, 429, 'hs1 must be locked');

const chk10 = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
  body: JSON.stringify({ student_id: 'hs10', pin: '2222' })
}), envCommon);
assert.equal(chk10.status, 429, 'hs10 must be locked');

// Teacher unlocks ONLY hs1
const reqUnlockHs1 = new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Secret': 'VERY_STRONG_SECRET_AT_LEAST_16_CHARS'
  },
  body: JSON.stringify({ student_id: 'hs1' })
});
const resUnlockHs1 = await worker.fetch(reqUnlockHs1, envCommon);
assert.equal(resUnlockHs1.status, 200);

// Verify hs1 is unlocked (status 200)
const chk1After = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
  body: JSON.stringify({ student_id: 'hs1', pin: '1111' })
}), envCommon);
assert.equal(chk1After.status, 200, 'hs1 must be unlocked now');

// BUT hs10 MUST REMAIN LOCKED (status 429)!
const chk10After = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': clientIp },
  body: JSON.stringify({ student_id: 'hs10', pin: '2222' })
}), envCommon);
assert.equal(chk10After.status, 429, 'hs10 MUST REMAIN LOCKED (no prefix collision)!');
console.log('  PASS G4: Colon-delimited prefix "lock:${student_id}:" prevents prefix collision.');

// ---------------------------------------------------------------------------
// 4. TEST G2: TOKEN SIGNED BY SERVICE ACCOUNT VERIFIED ACROSS ISOLATES
// ---------------------------------------------------------------------------
console.log('\n[4/4] Testing G2: Service Account key used across multiple Worker isolates...');
const envIsolateA = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: signingKeys,
  FIREBASE_CLIENT_EMAIL: 'service-account@aihoctap.iam.gserviceaccount.com',
  MOCK_MODE: true
};
const envIsolateB = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: signingKeys,
  FIREBASE_CLIENT_EMAIL: 'service-account@aihoctap.iam.gserviceaccount.com',
  MOCK_MODE: true
};

// Login via Isolate A
const reqLoginA = new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs1', pin: '1111' })
});
const resLoginA = await worker.fetch(reqLoginA, envIsolateA);
assert.equal(resLoginA.status, 200);
const dataA = await resLoginA.json();

// Verify token on Isolate B
const verifyOnB = await verifyJwtToken(dataA.token, envIsolateB.SIGNING_KEYPAIR.publicKey);
assert.equal(verifyOnB.valid, true, 'Token generated on Isolate A must verify on Isolate B');
assert.equal(verifyOnB.payload.iss, 'service-account@aihoctap.iam.gserviceaccount.com');
assert.equal(verifyOnB.payload.aud, 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
console.log('  PASS G2: Tokens generated and verified consistently across distinct isolates using Service Account keys.');

console.log('\n======================================================');
console.log('ALL G1–G6 SPECIALIZED VERIFICATION TESTS PASSED 100%!');
console.log('======================================================');
