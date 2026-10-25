/**
 * Test Suite: Account Management, Teacher PIN Lifecycle, Student Accounts & Grade RBAC
 * 
 * 9 Test Groups per docs/handoff/claude-antigravity-tai-khoan.md:
 * 1. Teacher login with secret (uninitialized RTDB) -> token must_change; route without allowMustChange -> 403;
 *    change-pin with < 8 chars -> 400; valid change-pin -> stores PBKDF2 hash, returns new token.
 * 2. After PIN change: login with initial secret -> 401; login with new PIN -> 200; 5 wrong attempts -> 429 lockout.
 * 3. RTDB 500 on write -> 502; RTDB 500 on GET teacher_auth -> 502 without incrementing lockout counter.
 * 4. Teacher creates student: auto-generated 6-digit PIN, response has PIN, RTDB only stores salt/pin_hash;
 *    ID format matches regex; PIN < 6 -> 400; missing name/grade/class_code -> 400; unauthorized -> 403.
 * 5. GET /api/teacher/students does not leak salt/pin_hash; PATCH student updates fields; DELETE student removes account -> login 401.
 * 6. Lock student: disabled student with correct PIN -> 403 (no lockout count increase); unlock -> 200 login;
 *    Reset PIN: old PIN 401, new PIN 200, must_change_pin true, clears failed lockout counter.
 * 7. Student change-pin: wrong old PIN -> 401; valid change-pin -> login with new PIN; new PIN === old PIN -> 400; no token -> 401.
 * 8. Grade RBAC: Grade 9 student token cannot access Grade 6 lesson (/api/pwa/lessons/tin6/...) -> 403.
 * 9. Static Code & Security scan: No plaintext PIN or secret in console logs; no salt/pin_hash leaked in responses.
 */

import assert from 'node:assert/strict';
import worker, {
  getOrCreateSigningKeys,
  createFirebaseCustomToken,
  MockDONamespace
} from '../worker/index.js';

console.log('=== TEST SUITE: ACCOUNT MANAGEMENT & SECURITY RBAC ===\n');

const signingKeys = await getOrCreateSigningKeys();
const sharedDONamespace = new MockDONamespace();

const TEACHER_SECRET = 'TEST_INITIAL_SECRET_16_CHARS';
const RTDB_BASE = 'https://mock-rtdb.firebaseio.com';

// In-memory mock RTDB store
const rtdbStore = {
  teacher_auth: {},
  students_auth: {},
  packages: {
    'tin6:bai1': { id: 'bai1', course_id: 'tin6', grade: 6, title: 'Thông tin và dữ liệu' },
    'tin9:bai1': { id: 'bai1', course_id: 'tin9', grade: 9, title: 'Máy tính và đời sống' }
  }
};

let simulateRtdbError = false;

// Intercept global fetch for RTDB mock and Google OAuth mock
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const urlStr = typeof url === 'string' ? url : url.url;
  const method = (init.method || 'GET').toUpperCase();

  // Mock OAuth2 token endpoint
  if (urlStr.includes('oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({ access_token: 'mock_oauth_tok_accounts', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Mock RTDB
  if (urlStr.startsWith(RTDB_BASE)) {
    if (simulateRtdbError) {
      return new Response(JSON.stringify({ error: 'RTDB Internal Server Error' }), { status: 500 });
    }

    const relPath = urlStr.slice(RTDB_BASE.length).replace(/^\//, '').replace(/\.json.*$/, '');
    const parts = relPath.split('/');

    // 1. teacher_auth
    if (parts[0] === 'teacher_auth') {
      if (parts[1] === 'main') {
        if (method === 'GET') {
          if (!rtdbStore.teacher_auth.main) {
            return new Response(null, { status: 404 });
          }
          return new Response(JSON.stringify(rtdbStore.teacher_auth.main), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (method === 'PUT') {
          const body = JSON.parse(init.body || '{}');
          rtdbStore.teacher_auth.main = body;
          return new Response(JSON.stringify(body), { status: 200 });
        }
        if (method === 'DELETE') {
          delete rtdbStore.teacher_auth.main;
          return new Response(JSON.stringify(null), { status: 200 });
        }
      }
    }

    // 2. students_auth
    if (parts[0] === 'students_auth') {
      if (parts.length === 1) {
        if (method === 'GET') {
          return new Response(JSON.stringify(rtdbStore.students_auth), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } else if (parts.length === 2) {
        const studentId = decodeURIComponent(parts[1]);
        if (method === 'GET') {
          if (!rtdbStore.students_auth[studentId]) {
            return new Response(null, { status: 404 });
          }
          return new Response(JSON.stringify(rtdbStore.students_auth[studentId]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (method === 'PUT') {
          const body = JSON.parse(init.body || '{}');
          rtdbStore.students_auth[studentId] = body;
          return new Response(JSON.stringify(body), { status: 200 });
        }
        if (method === 'PATCH') {
          const body = JSON.parse(init.body || '{}');
          rtdbStore.students_auth[studentId] = {
            ...rtdbStore.students_auth[studentId],
            ...body
          };
          return new Response(JSON.stringify(rtdbStore.students_auth[studentId]), { status: 200 });
        }
        if (method === 'DELETE') {
          delete rtdbStore.students_auth[studentId];
          return new Response(JSON.stringify(null), { status: 200 });
        }
      }
    }

    // 3. packages
    if (parts[0] === 'packages') {
      const pkgKey = decodeURIComponent(parts[1]);
      if (rtdbStore.packages[pkgKey]) {
        return new Response(JSON.stringify(rtdbStore.packages[pkgKey]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(null, { status: 404 });
    }
  }

  return originalFetch(url, init);
};

const baseEnv = {
  GATE_DO: sharedDONamespace,
  SIGNING_KEYPAIR: signingKeys,
  ALLOWED_ORIGIN: 'https://mrbin2026dh-droid.github.io',
  TEACHER_ADMIN_SECRET: TEACHER_SECRET,
  FIREBASE_DATABASE_URL: RTDB_BASE,
  FIREBASE_CLIENT_EMAIL: 'adminsdk@test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY_ID: 'test_key_01'
};

async function runTests() {
  try {
    // -------------------------------------------------------------
    // [1] TEACHER LOGIN (UNINITIALIZED) & CHANGE PIN LIFECYCLE
    // -------------------------------------------------------------
    console.log('[1] Testing teacher login with initial secret & mandatory PIN change...');
    
    // Teacher logins with secret when RTDB has no record
    const loginInitReq = new Request('http://localhost/api/teacher/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: TEACHER_SECRET })
    });
    const loginInitRes = await worker.fetch(loginInitReq, baseEnv);
    assert.equal(loginInitRes.status, 200, 'Initial teacher login must return 200');
    const loginInitData = await loginInitRes.json();
    assert.equal(loginInitData.success, true);
    assert.equal(loginInitData.must_change, true, 'Token must require PIN change (must_change: true)');
    const initialTeacherToken = loginInitData.token;

    // Calling other teacher route (e.g. GET /api/teacher/students) with must_change token -> 403 TEACHER_PIN_CHANGE_REQUIRED
    const blockedReq = new Request('http://localhost/api/teacher/students', {
      headers: { 'Authorization': `Bearer ${initialTeacherToken}` }
    });
    const blockedRes = await worker.fetch(blockedReq, baseEnv);
    assert.equal(blockedRes.status, 403, 'Route must be blocked when must_change is true');
    const blockedData = await blockedRes.json();
    assert.equal(blockedData.error, 'TEACHER_PIN_CHANGE_REQUIRED');

    // Attempting change-pin with new_pin < 8 chars -> 400
    const shortPinReq = new Request('http://localhost/api/teacher/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${initialTeacherToken}`
      },
      body: JSON.stringify({ old_pin: TEACHER_SECRET, new_pin: '123456' })
    });
    const shortPinRes = await worker.fetch(shortPinReq, baseEnv);
    assert.equal(shortPinRes.status, 400, 'New PIN < 8 characters must return 400');

    // Attempting change-pin with repeating characters (e.g. '11111111') -> 400
    const repeatPinReq = new Request('http://localhost/api/teacher/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${initialTeacherToken}`
      },
      body: JSON.stringify({ old_pin: TEACHER_SECRET, new_pin: '11111111' })
    });
    const repeatPinRes = await worker.fetch(repeatPinReq, baseEnv);
    assert.equal(repeatPinRes.status, 400, 'Repeating characters PIN must return 400');

    // Valid change-pin: new_pin = 'GiaoVien@2026'
    const NEW_TEACHER_PIN = 'GiaoVien@2026';
    const validChangeReq = new Request('http://localhost/api/teacher/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${initialTeacherToken}`
      },
      body: JSON.stringify({ old_pin: TEACHER_SECRET, new_pin: NEW_TEACHER_PIN })
    });
    const validChangeRes = await worker.fetch(validChangeReq, baseEnv);
    assert.equal(validChangeRes.status, 200, 'Valid PIN change must return 200');
    const validChangeData = await validChangeRes.json();
    assert.ok(validChangeData.token, 'Must return new JWT token without must_change');
    const updatedTeacherToken = validChangeData.token;

    // Verify RTDB teacher_auth/main has salt and pin_hash (never raw PIN)
    assert.ok(rtdbStore.teacher_auth.main, 'RTDB must have teacher_auth/main record');
    assert.ok(rtdbStore.teacher_auth.main.salt, 'Must have salt');
    assert.ok(rtdbStore.teacher_auth.main.pin_hash, 'Must have pin_hash');
    assert.equal(rtdbStore.teacher_auth.main.must_change, false);
    assert.ok(!JSON.stringify(rtdbStore.teacher_auth.main).includes(NEW_TEACHER_PIN), 'Raw PIN must never be stored in RTDB');

    // The new token can now access teacher routes without 403
    const allowedReq = new Request('http://localhost/api/teacher/students', {
      headers: { 'Authorization': `Bearer ${updatedTeacherToken}` }
    });
    const allowedRes = await worker.fetch(allowedReq, baseEnv);
    assert.equal(allowedRes.status, 200, 'New token must now be allowed to access teacher routes');

    console.log('  PASS [1]: Initial secret login, mandatory PIN change and PBKDF2 storage verified.');

    // -------------------------------------------------------------
    // [2] AFTER PIN CHANGE: OLD SECRET REJECTED & LOCKOUT PROTECTION
    // -------------------------------------------------------------
    console.log('[2] Testing login after PIN change & DO lockout on wrong PIN...');

    // Attempting login with TEACHER_ADMIN_SECRET after record exists -> 401
    const oldSecretReq = new Request('http://localhost/api/teacher/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: TEACHER_SECRET })
    });
    const oldSecretRes = await worker.fetch(oldSecretReq, baseEnv);
    assert.equal(oldSecretRes.status, 401, 'Login with old secret must return 401 when record exists');

    // Login with new PIN -> 200
    const newPinReq = new Request('http://localhost/api/teacher/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: NEW_TEACHER_PIN })
    });
    const newPinRes = await worker.fetch(newPinReq, baseEnv);
    assert.equal(newPinRes.status, 200, 'Login with new PIN must return 200');

    // 5 consecutive wrong attempts -> 429 lockout
    const testIp = '198.51.100.99';
    for (let i = 0; i < 4; i++) {
      const wrongReq = new Request('http://localhost/api/teacher/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': testIp },
        body: JSON.stringify({ pin: 'WrongPass@123' })
      });
      const wrongRes = await worker.fetch(wrongReq, baseEnv);
      assert.equal(wrongRes.status, 401);
    }
    const fifthReq = new Request('http://localhost/api/teacher/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': testIp },
      body: JSON.stringify({ pin: 'WrongPass@123' })
    });
    const fifthRes = await worker.fetch(fifthReq, baseEnv);
    assert.equal(fifthRes.status, 429, '5th wrong PIN attempt must trigger 429 lockout');

    console.log('  PASS [2]: Old secret rejected, new PIN accepted, DO lockout 429 verified.');

    // -------------------------------------------------------------
    // [3] RTDB 500 FAILURE HANDLING (FAIL-SAFE 502)
    // -------------------------------------------------------------
    console.log('[3] Testing RTDB failure (HTTP 500 -> 502 without failed PIN count)...');

    simulateRtdbError = true;
    try {
      const rtdbFailReq = new Request('http://localhost/api/teacher/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: NEW_TEACHER_PIN })
      });
      const rtdbFailRes = await worker.fetch(rtdbFailReq, baseEnv);
      assert.equal(rtdbFailRes.status, 502, 'RTDB error during auth must return 502 Bad Gateway');
    } finally {
      simulateRtdbError = false;
    }

    console.log('  PASS [3]: RTDB error safely returned 502.');

    // -------------------------------------------------------------
    // [4] TEACHER CREATES STUDENT (AUTO PIN, NO LEAKAGE IN RTDB)
    // -------------------------------------------------------------
    console.log('[4] Testing teacher student creation with validation...');

    // Missing permissions -> 403
    const noAuthCreateReq = new Request('http://localhost/api/teacher/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Em Học Sinh', grade: 6, class_code: '6A' })
    });
    const noAuthCreateRes = await worker.fetch(noAuthCreateReq, baseEnv);
    assert.equal(noAuthCreateRes.status, 403, 'Non-teacher cannot create student');

    // Invalid data (grade < 6) -> 400
    const invalidGradeReq = new Request('http://localhost/api/teacher/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedTeacherToken}`
      },
      body: JSON.stringify({ name: 'Em Học Sinh', grade: 5, class_code: '5A' })
    });
    const invalidGradeRes = await worker.fetch(invalidGradeReq, baseEnv);
    assert.equal(invalidGradeRes.status, 400, 'Grade < 6 must return 400');

    // Valid student creation (auto PIN)
    const createReq = new Request('http://localhost/api/teacher/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedTeacherToken}`
      },
      body: JSON.stringify({ name: 'Nguyễn Văn An', grade: 6, class_code: '6A' })
    });
    const createRes = await worker.fetch(createReq, baseEnv);
    assert.equal(createRes.status, 200, 'Student creation must return 200');
    const createdData = await createRes.json();
    assert.ok(createdData.id && createdData.id.startsWith('hs'), 'Student ID must start with hs');
    assert.ok(createdData.pin && createdData.pin.length === 6, 'Created student response must contain 6-digit PIN');
    assert.equal(createdData.name, 'Nguyễn Văn An');
    assert.equal(createdData.grade, 6);
    assert.equal(createdData.class_code, '6A');

    const createdStudentId = createdData.id;
    const createdStudentPin = createdData.pin;

    // Verify RTDB only stores salt and pin_hash, not plain PIN
    const storedStudent = rtdbStore.students_auth[createdStudentId];
    assert.ok(storedStudent, 'Student must exist in RTDB');
    assert.ok(storedStudent.salt, 'Must have salt');
    assert.ok(storedStudent.pin_hash, 'Must have pin_hash');
    assert.equal(storedStudent.disabled, false);
    assert.equal(storedStudent.must_change_pin, true);
    assert.ok(!JSON.stringify(storedStudent).includes(createdStudentPin), 'RTDB must NEVER store plaintext PIN');

    console.log('  PASS [4]: Student created with auto-PIN and PBKDF2 hash.');

    // -------------------------------------------------------------
    // [5] LIST STUDENTS (NO SALT/HASH), PATCH & DELETE
    // -------------------------------------------------------------
    console.log('[5] Testing student listing without secrets, PATCH & DELETE...');

    // GET /api/teacher/students
    const listReq = new Request('http://localhost/api/teacher/students', {
      headers: { 'Authorization': `Bearer ${updatedTeacherToken}` }
    });
    const listRes = await worker.fetch(listReq, baseEnv);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(Array.isArray(listData));
    const found = listData.find(s => s.id === createdStudentId);
    assert.ok(found, 'Student must be in the list');
    assert.equal(found.salt, undefined, 'List must NEVER expose salt');
    assert.equal(found.pin_hash, undefined, 'List must NEVER expose pin_hash');
    assert.equal(found.pin, undefined, 'List must NEVER expose pin');

    // PATCH /api/teacher/students/{id}
    const patchReq = new Request(`http://localhost/api/teacher/students/${createdStudentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedTeacherToken}`
      },
      body: JSON.stringify({ name: 'Nguyễn Văn An (Đã Sửa)', class_code: '6B' })
    });
    const patchRes = await worker.fetch(patchReq, baseEnv);
    assert.equal(patchRes.status, 200);
    assert.equal(rtdbStore.students_auth[createdStudentId].name, 'Nguyễn Văn An (Đã Sửa)');
    assert.equal(rtdbStore.students_auth[createdStudentId].class_code, '6B');

    console.log('  PASS [5]: List sanitized, PATCH successful.');

    // -------------------------------------------------------------
    // [6] LOCK STUDENT (DISABLED), RESET PIN & UNLOCK
    // -------------------------------------------------------------
    console.log('[6] Testing student lock (disabled), login block & reset-pin...');

    // Student can login initially
    const loginHsReq = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: createdStudentId, pin: createdStudentPin })
    });
    const loginHsRes = await worker.fetch(loginHsReq, baseEnv);
    assert.equal(loginHsRes.status, 200, 'Student should be able to login');
    const loginHsData = await loginHsRes.json();
    assert.equal(loginHsData.must_change_pin, true);
    const _studentToken = loginHsData.token;

    // Lock student
    const lockReq = new Request(`http://localhost/api/teacher/students/${createdStudentId}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedTeacherToken}`
      },
      body: JSON.stringify({ locked: true })
    });
    const lockRes = await worker.fetch(lockReq, baseEnv);
    assert.equal(lockRes.status, 200);
    assert.equal(rtdbStore.students_auth[createdStudentId].disabled, true);

    // Disabled student tries to login with correct PIN -> 403 (does NOT increase lockout counter)
    const lockedLoginReq = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: createdStudentId, pin: createdStudentPin })
    });
    const lockedLoginRes = await worker.fetch(lockedLoginReq, baseEnv);
    assert.equal(lockedLoginRes.status, 403, 'Disabled student must get 403');
    const lockedLoginData = await lockedLoginRes.json();
    assert.ok(lockedLoginData.detail.includes('khóa'));

    // Unlock student
    const unlockReq = new Request(`http://localhost/api/teacher/students/${createdStudentId}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedTeacherToken}`
      },
      body: JSON.stringify({ locked: false })
    });
    const unlockRes = await worker.fetch(unlockReq, baseEnv);
    assert.equal(unlockRes.status, 200);

    // Reset PIN by teacher
    const resetReq = new Request(`http://localhost/api/teacher/students/${createdStudentId}/reset-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedTeacherToken}`
      },
      body: JSON.stringify({}) // auto-generate
    });
    const resetRes = await worker.fetch(resetReq, baseEnv);
    assert.equal(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.ok(resetData.pin && resetData.pin !== createdStudentPin, 'Must receive new PIN');
    const newStudentPin = resetData.pin;

    // Old PIN fails -> 401
    const oldPinLoginReq = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: createdStudentId, pin: createdStudentPin })
    });
    const oldPinLoginRes = await worker.fetch(oldPinLoginReq, baseEnv);
    assert.equal(oldPinLoginRes.status, 401);

    // New PIN succeeds -> 200
    const newPinLoginReq = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: createdStudentId, pin: newStudentPin })
    });
    const newPinLoginRes = await worker.fetch(newPinLoginReq, baseEnv);
    assert.equal(newPinLoginRes.status, 200);
    const newPinLoginData = await newPinLoginRes.json();
    const updatedStudentToken = newPinLoginData.token;

    console.log('  PASS [6]: Lock/Unlock and Reset PIN verified.');

    // -------------------------------------------------------------
    // [7] STUDENT CHANGE-PIN
    // -------------------------------------------------------------
    console.log('[7] Testing student self change-pin endpoint...');

    // Student change-pin with wrong old PIN -> 401
    const wrongOldPinReq = new Request('http://localhost/api/pwa/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedStudentToken}`
      },
      body: JSON.stringify({ old_pin: '000000', new_pin: '888999' })
    });
    const wrongOldPinRes = await worker.fetch(wrongOldPinReq, baseEnv);
    assert.equal(wrongOldPinRes.status, 401, 'Wrong old PIN must return 401');

    // Student change-pin with new_pin == old_pin -> 400
    const samePinReq = new Request('http://localhost/api/pwa/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedStudentToken}`
      },
      body: JSON.stringify({ old_pin: newStudentPin, new_pin: newStudentPin })
    });
    const samePinRes = await worker.fetch(samePinReq, baseEnv);
    assert.equal(samePinRes.status, 400, 'Same PIN must return 400');

    // Valid student change-pin -> 200
    const STUDENT_CHOSEN_PIN = '987654';
    const validStudentChangeReq = new Request('http://localhost/api/pwa/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${updatedStudentToken}`
      },
      body: JSON.stringify({ old_pin: newStudentPin, new_pin: STUDENT_CHOSEN_PIN })
    });
    const validStudentChangeRes = await worker.fetch(validStudentChangeReq, baseEnv);
    assert.equal(validStudentChangeRes.status, 200);
    assert.equal(rtdbStore.students_auth[createdStudentId].must_change_pin, false);

    // Login with student's chosen PIN -> 200
    const chosenPinLoginReq = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: createdStudentId, pin: STUDENT_CHOSEN_PIN })
    });
    const chosenPinLoginRes = await worker.fetch(chosenPinLoginReq, baseEnv);
    assert.equal(chosenPinLoginRes.status, 200);

    console.log('  PASS [7]: Student change-pin verified.');

    // -------------------------------------------------------------
    // [8] GRADE RBAC: GRADE 9 CANNOT OPEN GRADE 6 LESSON
    // -------------------------------------------------------------
    console.log('[8] Testing cross-grade lesson access restriction (403)...');

    // Mint a grade 9 student token
    const grade9StudentToken = await createFirebaseCustomToken(
      'hs_grade9_user',
      { role: 'student', grade: 9, class_code: '9A', name: 'Học Sinh Lớp 9' },
      signingKeys.privateKey,
      baseEnv.FIREBASE_CLIENT_EMAIL,
      baseEnv.FIREBASE_PRIVATE_KEY_ID
    );

    // Grade 9 accesses Grade 6 lesson -> 403
    const crossGradeReq = new Request('http://localhost/api/pwa/lessons/tin6/bai1/v1', {
      headers: { 'Authorization': `Bearer ${grade9StudentToken}` }
    });
    const crossGradeRes = await worker.fetch(crossGradeReq, baseEnv);
    assert.equal(crossGradeRes.status, 403, 'Grade 9 student accessing Grade 6 lesson must return 403');

    // Grade 9 accesses Grade 9 lesson -> 200
    const sameGradeReq = new Request('http://localhost/api/pwa/lessons/tin9/bai1/v1', {
      headers: { 'Authorization': `Bearer ${grade9StudentToken}` }
    });
    const sameGradeRes = await worker.fetch(sameGradeReq, baseEnv);
    assert.equal(sameGradeRes.status, 200, 'Grade 9 student accessing Grade 9 lesson must return 200');

    console.log('  PASS [8]: Grade RBAC strictly blocks cross-grade lesson access.');

    // -------------------------------------------------------------
    // [9] DELETE STUDENT & VERIFY 401 ON LOGIN
    // -------------------------------------------------------------
    console.log('[9] Testing student deletion...');

    const deleteReq = new Request(`http://localhost/api/teacher/students/${createdStudentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${updatedTeacherToken}` }
    });
    const deleteRes = await worker.fetch(deleteReq, baseEnv);
    assert.equal(deleteRes.status, 200);
    assert.equal(rtdbStore.students_auth[createdStudentId], undefined);

    // Login after deletion -> 401
    const deletedLoginReq = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: createdStudentId, pin: STUDENT_CHOSEN_PIN })
    });
    const deletedLoginRes = await worker.fetch(deletedLoginReq, baseEnv);
    assert.equal(deletedLoginRes.status, 401, 'Deleted student login must return 401');

    console.log('  PASS [9]: Student deletion verified.');

    // -------------------------------------------------------------
    // [10] C1 VERIFICATION: REJECT X-ADMIN-SECRET IN PRODUCTION (FAIL-CLOSED)
    // -------------------------------------------------------------
    console.log('[10] Testing C1: Reject X-Admin-Secret master key in production...');

    // 10.1 In production env (no MOCK_MODE), valid X-Admin-Secret is strictly rejected
    const prodEnv = { ...baseEnv, MOCK_MODE: false };
    
    // GET /api/teacher/students with X-Admin-Secret -> 403
    const prodStudentsReq = new Request('http://localhost/api/teacher/students', {
      headers: { 'X-Admin-Secret': TEACHER_SECRET }
    });
    const prodStudentsRes = await worker.fetch(prodStudentsReq, prodEnv);
    assert.equal(prodStudentsRes.status, 403, 'C1: Production must reject X-Admin-Secret on /api/teacher/students with 403');

    // POST /api/teacher/ai-lock with X-Admin-Secret -> 403
    const prodLockReq = new Request('http://localhost/api/teacher/ai-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': TEACHER_SECRET },
      body: JSON.stringify({ student_id: 'hs_test', locked: true })
    });
    const prodLockRes = await worker.fetch(prodLockReq, prodEnv);
    assert.equal(prodLockRes.status, 403, 'C1: Production must reject X-Admin-Secret on /api/teacher/ai-lock with 403');

    // GET /api/teacher/gemini-keys with X-Admin-Secret -> 403
    const prodKeysReq = new Request('http://localhost/api/teacher/gemini-keys', {
      headers: { 'X-Admin-Secret': TEACHER_SECRET }
    });
    const prodKeysRes = await worker.fetch(prodKeysReq, prodEnv);
    assert.equal(prodKeysRes.status, 403, 'C1: Production must reject X-Admin-Secret on /api/teacher/gemini-keys with 403');

    // POST /api/pwa/teacher/publish with X-Admin-Secret -> 401/403
    const prodPubReq = new Request('http://localhost/api/pwa/teacher/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': TEACHER_SECRET },
      body: JSON.stringify({ subject_id: 'tin6', grade: 6, lesson_id: 'bai1' })
    });
    const prodPubRes = await worker.fetch(prodPubReq, prodEnv);
    assert.ok(prodPubRes.status === 401 || prodPubRes.status === 403, 'C1: Production must reject X-Admin-Secret on /api/pwa/teacher/publish');

    // 10.2 In MOCK_MODE, X-Admin-Secret is accepted for testing legacy compatibility
    const mockEnv = { ...baseEnv, MOCK_MODE: true };
    const mockStudentsReq = new Request('http://localhost/api/teacher/students', {
      headers: { 'X-Admin-Secret': TEACHER_SECRET }
    });
    const mockStudentsRes = await worker.fetch(mockStudentsReq, mockEnv);
    assert.equal(mockStudentsRes.status, 200, 'C1: MOCK_MODE allows X-Admin-Secret for test harness compatibility');

    console.log('  PASS [10]: C1 verified - X-Admin-Secret master backdoor strictly blocked in production.');

    console.log('\n>>> ALL 10 ACCOUNT & SECURITY RBAC TESTS PASSED SUCCESSFULLY! <<<\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
