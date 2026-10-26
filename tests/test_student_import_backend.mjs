// Thêm học sinh với mã tự đặt, kiểm tra trùng, nhập hàng loạt.
import assert from 'node:assert/strict';
import worker, {getOrCreateSigningKeys, createFirebaseCustomToken, MockDONamespace} from '../worker/index.js';
import {validateStudentInput} from '../worker/students.js';
const kp = await getOrCreateSigningKeys(); const BASE = 'https://mock-rtdb.firebaseio.com';
const store = {students_auth: {}};
globalThis.fetch = async (url, init = {}) => {
  const u = typeof url === 'string' ? url : url.url; const m = (init.method || 'GET').toUpperCase();
  if (u.includes('oauth2.googleapis.com/token')) return new Response(JSON.stringify({access_token: 'x', expires_in: 3600}));
  if (u.startsWith(BASE)) {
    const parts = u.slice(BASE.length).replace(/^\//, '').replace(/\.json.*$/, '').split('/');
    if (parts[0] === 'students_auth') {
      if (parts.length === 1) return new Response(JSON.stringify(store.students_auth));
      const id = decodeURIComponent(parts[1]);
      if (m === 'GET') return new Response(JSON.stringify(store.students_auth[id] ?? null)); // RTDB thật trả 200 + null khi thiếu
      if (m === 'PUT') { store.students_auth[id] = JSON.parse(init.body); return new Response('{}'); }
    }
  }
  return new Response('{}', {status: 404});
};
const env = {GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_DATABASE_URL: BASE, FIREBASE_CLIENT_EMAIL: 'a@b.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k'};
const tok = await createFirebaseCustomToken('teacher_admin_01', {role: 'teacher', admin: true, name: 'GV'}, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY_ID);
const call = async (path, body, auth = true) => { const r = await worker.fetch(new Request('http://localhost' + path, {method: 'POST', headers: {'Content-Type': 'application/json', ...(auth ? {Authorization: 'Bearer ' + tok} : {})}, body: JSON.stringify(body)}), env); return {status: r.status, body: await r.json()}; };

// Kiểm tra dữ liệu thuần
assert.equal(validateStudentInput({name: 'An', grade: 9, class_code: '9a1', student_id: ' HS-An_01 '}).student.id, 'hs-an_01', 'mã chuẩn hóa chữ thường');
assert.equal(validateStudentInput({name: 'An', grade: 9, class_code: '9a1'}).student.id, null);
for (const bad of ['ab', 'Nguyễn', 'a b', '_abc', 'x'.repeat(21), 'a/b']) assert.match(validateStudentInput({name: 'An', grade: 9, class_code: '9A', student_id: bad}).error, /Mã học sinh/, bad);
assert.match(validateStudentInput({name: '', grade: 9, class_code: '9A'}).error, /Họ và tên/);
assert.match(validateStudentInput({name: 'A', grade: 5, class_code: '9A'}).error, /Khối/);
assert.match(validateStudentInput({name: 'A', grade: 9, class_code: 'lớp 9'}).error, /Mã lớp/);
assert.match(validateStudentInput({name: 'A', grade: 9, class_code: '9A', pin: '123'}).error, /tối thiểu 6/);

// Thêm một học sinh với mã tự đặt
let r = await call('/api/teacher/students', {student_id: 'hs9a01', name: '  Nguyễn  Văn An ', grade: 9, class_code: '9a1', pin: '246810'});
assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.id, 'hs9a01'); assert.equal(r.body.pin, '246810');
assert.equal(store.students_auth.hs9a01.name, 'Nguyễn Văn An'); assert.equal(store.students_auth.hs9a01.class_code, '9A1'); assert.ok(store.students_auth.hs9a01.pin_hash && !('pin' in store.students_auth.hs9a01), 'chỉ lưu băm PIN');
// Trùng mã -> 409, không ghi đè
r = await call('/api/teacher/students', {student_id: 'HS9A01', name: 'Người khác', grade: 9, class_code: '9A1'});
assert.equal(r.status, 409); assert.match(r.body.detail, /đã tồn tại/); assert.equal(store.students_auth.hs9a01.name, 'Nguyễn Văn An');
// Không đặt mã -> tự sinh (kể cả khi RTDB trả 200 + null)
r = await call('/api/teacher/students', {name: 'Trần Bình', grade: 9, class_code: '9A1'});
assert.equal(r.status, 200); assert.match(r.body.id, /^hs[a-z0-9]{6}$/); assert.match(r.body.pin, /^\d{6}$/);
assert.equal((await call('/api/teacher/students', {name: 'A', grade: 9, class_code: '9A'}, false)).status, 403, 'cần quyền giáo viên');

// Nhập hàng loạt
r = await call('/api/teacher/students/import', {students: [
  {student_id: 'hs9a02', name: 'Lê Cường', grade: 9, class_code: '9A1', pin: '135790'},
  {student_id: 'hs9a01', name: 'Trùng với có sẵn', grade: 9, class_code: '9A1'},
  {name: 'Phạm Dung', grade: 9, class_code: '9A1'},
  {student_id: 'hs9a02', name: 'Trùng trong file', grade: 9, class_code: '9A1'},
  {student_id: 'bad id', name: 'Sai mã', grade: 9, class_code: '9A1'},
  {name: 'Sai khối', grade: 3, class_code: '9A1'}]});
assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.created, 2); assert.equal(r.body.failed, 4);
const byIndex = Object.fromEntries(r.body.results.map(x => [x.index, x]));
assert.equal(byIndex[0].ok, true); assert.equal(byIndex[0].pin, '135790'); assert.equal(byIndex[2].ok, true); assert.match(byIndex[2].pin, /^\d{6}$/);
assert.match(byIndex[1].error, /đã tồn tại/); assert.match(byIndex[3].error, /trùng trong file/); assert.match(byIndex[4].error, /Mã học sinh/); assert.match(byIndex[5].error, /Khối/);
assert.equal(Object.keys(store.students_auth).length, 4, 'chỉ các dòng hợp lệ được ghi');
assert.equal((await call('/api/teacher/students/import', {students: []})).status, 400);
assert.equal((await call('/api/teacher/students/import', {students: Array.from({length: 301}, (_, i) => ({name: 'A' + i, grade: 9, class_code: '9A'}))})).status, 400);
console.log('STUDENT IMPORT BACKEND OK');
