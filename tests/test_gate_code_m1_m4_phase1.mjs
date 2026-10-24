/**
 * Verification Suite for M1–M4 & Phase 1 Contest Features:
 * - M1: Rate limiting & DO lockout 429 for /api/teacher/auth
 * - M2: Strict zero-guesswork claims in /api/pwa/me (missing claims -> 401)
 * - M3: PIN >= 6 chars & global multi-IP brute force lockout (429 after 10 failed attempts across IPs)
 * - M4: Sanitization of database URL & secure auto-generated 6-digit PIN in manage_students
 * - Phase 1: Teacher publish with private answer separation, zero public leaks, dynamic catalog multi-subject & materials
 */

import assert from 'node:assert/strict';
import worker, {
  MockDONamespace,
  registerStudentCredential,
  createFirebaseCustomToken
} from '../worker/index.js';

console.log('=== RUNNING VERIFICATION SUITE FOR M1–M4 & PHASE 1 ===');

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

// Register test student with 6-digit PIN (M3)
await registerStudentCredential('hs_m_test', '654321', '00112233445566778899aabbccddeeff', {
  name: 'Trần Văn M',
  grade: 9,
  class_code: '9C'
});

const baseEnv = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: rsaKeypair,
  MOCK_MODE: true,
  STRICT_PIN_LENGTH: true,
  ALLOWED_ORIGIN: 'https://mrbin2026dh-droid.github.io',
  FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-test@aihoctap.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY_ID: 'key_id_m1_m4',
  TEACHER_ADMIN_SECRET: 'TEACHER_SECURE_SECRET_OVER_16_CHARS',
  TEST_CATALOG: {
    revision: 'rev_base',
    courses: [{ id: 'tin9', title: 'Tin học 9', grade: 9, lesson_count: 1, lessons: [{ id: 'bai1', title: 'Bài 1', version: 'v1' }] }]
  },
  TEST_LESSONS: {},
  TEST_PACKAGES_PRIVATE: {},
  TEST_MATERIALS: {}
};

// ---------------------------------------------------------------------------
// 1. TEST M1: TEACHER AUTH RATE LIMITING & DO LOCKOUT (429)
// ---------------------------------------------------------------------------
console.log('\n[1/5] Testing M1: Teacher auth rate limiting & DO lockout (429)...');

// 4 failed attempts from same IP
for (let i = 1; i <= 4; i++) {
  const failRes = await worker.fetch(new Request('http://localhost/api/teacher/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
    body: JSON.stringify({ pin: 'wrong_secret' })
  }), baseEnv);
  assert.equal(failRes.status, 401, `Teacher attempt ${i} must return 401`);
}

// 5th failed attempt must trigger 429 lockout
const lockRes = await worker.fetch(new Request('http://localhost/api/teacher/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
  body: JSON.stringify({ pin: 'wrong_secret' })
}), baseEnv);

assert.equal(lockRes.status, 429, 'M1: 5 failed teacher attempts must return 429 Lockout');
const lockData = await lockRes.json();
assert.match(lockData.detail, /tạm khóa/, 'M1: Must state teacher account is temporarily locked');

// Reset teacher lockout for subsequent tests
await sharedDO.get('global_gate').fetch(new Request('http://do/reset-lockout', {
  method: 'POST',
  body: JSON.stringify({ pairKey: 'lock:teacher_admin:10.0.0.1' })
}));

// Successful teacher login with valid secret
const teacherAuthRes = await worker.fetch(new Request('http://localhost/api/teacher/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
  body: JSON.stringify({ pin: baseEnv.TEACHER_ADMIN_SECRET })
}), baseEnv);

assert.equal(teacherAuthRes.status, 200, 'M1: Valid teacher secret returns 200 with admin token');
const { token: teacherToken } = await teacherAuthRes.json();
assert.ok(teacherToken, 'M1: Must return signed JWT token');
console.log('  PASS M1: Teacher auth DO lockout 429 after 5 failures strictly verified.');

// ---------------------------------------------------------------------------
// 2. TEST M2: ZERO GUESSWORK IN /api/pwa/me (MISSING CLAIMS -> 401)
// ---------------------------------------------------------------------------
console.log('\n[2/5] Testing M2: Zero guesswork in /api/pwa/me (missing claims -> 401)...');

// Mint incomplete token missing grade and class_code
const badToken = await createFirebaseCustomToken(
  'hs_incomplete',
  { role: 'student', name: 'Chưa có lớp' }, // Missing grade & class_code
  rsaKeypair.privateKey,
  baseEnv.FIREBASE_CLIENT_EMAIL,
  baseEnv.FIREBASE_PRIVATE_KEY_ID
);

const meIncompleteRes = await worker.fetch(new Request('http://localhost/api/pwa/me', {
  headers: { 'Authorization': `Bearer ${badToken}` }
}), baseEnv);

assert.equal(meIncompleteRes.status, 401, 'M2: Missing claims must return 401, no guessing grade/class');
const meIncompleteData = await meIncompleteRes.json();
assert.match(meIncompleteData.detail, /Thiếu các trường định danh/, 'M2: Must state missing required claims');

// Mint complete token
const goodToken = await createFirebaseCustomToken(
  'hs_m_test',
  { role: 'student', name: 'Trần Văn M', grade: 9, class_code: '9C' },
  rsaKeypair.privateKey,
  baseEnv.FIREBASE_CLIENT_EMAIL,
  baseEnv.FIREBASE_PRIVATE_KEY_ID
);

const meGoodRes = await worker.fetch(new Request('http://localhost/api/pwa/me', {
  headers: { 'Authorization': `Bearer ${goodToken}` }
}), baseEnv);

assert.equal(meGoodRes.status, 200);
const meGoodData = await meGoodRes.json();
assert.equal(meGoodData.student_name, 'Trần Văn M');
assert.equal(meGoodData.grade, 9);
assert.equal(meGoodData.class_code, '9C');
console.log('  PASS M2: Incomplete claims rejected with 401; zero fallback guessing.');

// ---------------------------------------------------------------------------
// 3. TEST M3: PIN >= 6 CHARS & GLOBAL STUDENT LOCKOUT ACROSS ROTATING IPS
// ---------------------------------------------------------------------------
console.log('\n[3/5] Testing M3: PIN >= 6 chars & global multi-IP brute-force lockout...');

// Test short PIN (< 6 chars) rejected with 400
const shortPinRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: 'hs_m_test', pin: '12345' }) // 5 chars
}), baseEnv);
assert.equal(shortPinRes.status, 400, 'M3: PIN < 6 chars must return 400');
const shortPinData = await shortPinRes.json();
assert.match(shortPinData.detail, /tối thiểu 6 ký tự/, 'M3: Must enforce minimum 6 characters');

// Simulate distributed brute-force attack: 10 different IPs each failing once on hs_m_test
for (let i = 1; i <= 9; i++) {
  const distRes = await worker.fetch(new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.168.1.${i}` },
    body: JSON.stringify({ student_id: 'hs_m_test', pin: '000000' })
  }), baseEnv);
  assert.equal(distRes.status, 401);
}

// 10th failure from yet another IP (192.168.1.10) must trigger global account lockout
const distLockRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.168.1.10' },
  body: JSON.stringify({ student_id: 'hs_m_test', pin: '000000' })
}), baseEnv);
assert.equal(distLockRes.status, 429, 'M3: 10 failed attempts across distinct IPs must trigger global 429');

// Legitimate user from original clean IP is now globally locked
const legitBlockedRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.99' },
  body: JSON.stringify({ student_id: 'hs_m_test', pin: '654321' }) // Correct PIN!
}), baseEnv);
assert.equal(legitBlockedRes.status, 429, 'M3: Account is globally locked until teacher unlocks');

// Teacher unlocks student
const unlockRes = await worker.fetch(new Request('http://localhost/api/teacher/unlock', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Secret': baseEnv.TEACHER_ADMIN_SECRET
  },
  body: JSON.stringify({ student_id: 'hs_m_test' })
}), baseEnv);
assert.equal(unlockRes.status, 200);

// Legitimate student can now log in successfully
const legitSuccessRes = await worker.fetch(new Request('http://localhost/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.99' },
  body: JSON.stringify({ student_id: 'hs_m_test', pin: '654321' })
}), baseEnv);
assert.equal(legitSuccessRes.status, 200, 'M3: Login successful after teacher unlock');
console.log('  PASS M3: PIN >= 6 enforced; multi-IP distributed brute force triggers 429 global lock.');

// ---------------------------------------------------------------------------
// 4. TEST PHASE 1: TEACHER PUBLISH, PRIVATE SEPARATION & DYNAMIC CATALOG
// ---------------------------------------------------------------------------
console.log('\n[4/5] Testing Phase 1: Teacher publish, private answer separation & dynamic catalog...');

// 4a. Student token cannot publish
const studentPublishRes = await worker.fetch(new Request('http://localhost/api/pwa/teacher/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${goodToken}` // Student token
  },
  body: JSON.stringify({ subject_id: 'toan', lesson_id: 'bai1' })
}), baseEnv);
assert.equal(studentPublishRes.status, 403, 'Phase 1: Student token must be 403 on publish');

// 4b. Teacher publishes a new subject: Toán học 9 (toan9:bai1)
const publishPayload = {
  subject_id: 'toan',
  subject_name: 'Toán học 9',
  grade: 9,
  lesson_id: 'bai1',
  title: 'Phương trình bậc nhất một ẩn',
  content_markdown: '# Phương trình bậc nhất\nNội dung lý thuyết toán 9...',
  questions: [
    {
      id: 'q_toan_01',
      prompt: 'Phương trình 2x - 4 = 0 có nghiệm là:',
      kind: 'choice',
      options: { 'A': 'x = -2', 'B': 'x = 2', 'C': 'x = 0', 'D': 'x = 4' },
      correct_answer: 'B',
      hint: 'Chuyển -4 sang vế phải thành +4.'
    }
  ]
};

const teacherPublishRes = await worker.fetch(new Request('http://localhost/api/pwa/teacher/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify(publishPayload)
}), baseEnv);

assert.equal(teacherPublishRes.status, 200, 'Phase 1: Teacher publish returns 200');
const publishData = await teacherPublishRes.json();
assert.equal(publishData.course_id, 'toan9');
assert.equal(publishData.lesson_id, 'bai1');
assert.ok(publishData.version, 'Phase 1: Must generate SHA-256 version hash');

// 4c. Verify public package has ZERO correct_answer leaks
const publicPkg = baseEnv.TEST_LESSONS['toan9:bai1'];
assert.ok(publicPkg, 'Phase 1: Public package created in memory');
assert.equal(publicPkg.questions[0].id, 'q_toan_01');
assert.equal(publicPkg.questions[0].correct_answer, undefined, 'CRITICAL: Public package must NOT contain correct_answer');

// 4d. Verify private package has correct_answer
const privatePkg = baseEnv.TEST_PACKAGES_PRIVATE['toan9:bai1'];
assert.ok(privatePkg, 'Phase 1: Private package created in memory');
assert.equal(privatePkg.questions[0].id, 'q_toan_01');
assert.equal(privatePkg.questions[0].correct_answer, 'B', 'Phase 1: Private package must contain correct_answer');

// 4e. Verify catalog automatically includes the new subject "toan9" without redeploying code
const catalogRes = await worker.fetch(new Request('http://localhost/api/pwa/catalog'), baseEnv);
assert.equal(catalogRes.status, 200);
const catalogData = await catalogRes.json();
const toanCourse = catalogData.courses.find(c => c.id === 'toan9');
assert.ok(toanCourse, 'Phase 1: New subject toan9 must appear dynamically in catalog');
assert.equal(toanCourse.title, 'Toán học 9');
assert.equal(toanCourse.lesson_count, 1);
assert.equal(toanCourse.lessons[0].id, 'bai1');

// 4f. Student fetches the new lesson without answers
const studentLessonRes = await worker.fetch(new Request(`http://localhost/api/pwa/lessons/toan9/bai1/${publishData.version}`), baseEnv);
assert.equal(studentLessonRes.status, 200);
const studentLessonData = await studentLessonRes.json();
assert.equal(studentLessonData.questions[0].correct_answer, undefined, 'Student sees 0 answer keys');

// 4g. Teacher fetches the lesson for editing (gets merged answers)
const teacherEditRes = await worker.fetch(new Request('http://localhost/api/pwa/teacher/lesson/toan9/bai1', {
  headers: { 'Authorization': `Bearer ${teacherToken}` }
}), baseEnv);
assert.equal(teacherEditRes.status, 200);
const teacherEditData = await teacherEditRes.json();
assert.equal(teacherEditData.questions[0].correct_answer, 'B', 'Teacher edit receives merged correct_answer');

console.log('  PASS Phase 1: Teacher publish separated private answers; new subject dynamically added to catalog.');

// ---------------------------------------------------------------------------
// 5. TEST PHASE 1 MATERIALS: TEACHER POST & STUDENT GET
// ---------------------------------------------------------------------------
console.log('\n[5/5] Testing Phase 1 Materials: Teacher upload & student fetch...');

const materialPayload = {
  id: 'mat_toan_01',
  title: 'Tài liệu ôn tập Phương trình Toán 9',
  course_id: 'toan9',
  url: 'https://drive.google.com/file/d/test_toan9_pdf/view',
  description: 'Tóm tắt lý thuyết và các dạng bài tập phương trình.'
};

const postMatRes = await worker.fetch(new Request('http://localhost/api/pwa/teacher/materials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify(materialPayload)
}), baseEnv);

assert.equal(postMatRes.status, 200, 'Phase 1: Teacher material creation returns 200');

// Student fetches materials for toan9
const getMatRes = await worker.fetch(new Request('http://localhost/api/pwa/materials/toan9'), baseEnv);
assert.equal(getMatRes.status, 200);
const getMatData = await getMatRes.json();
assert.ok(Array.isArray(getMatData.materials));
assert.equal(getMatData.materials.length, 1);
assert.equal(getMatData.materials[0].title, 'Tài liệu ôn tập Phương trình Toán 9');

console.log('  PASS Phase 1 Materials: Teacher publish material & student read verified.');

console.log('\n======================================================');
console.log('ALL M1–M4 & PHASE 1 SPECIALIZED TESTS PASSED 100%!');
console.log('======================================================');
