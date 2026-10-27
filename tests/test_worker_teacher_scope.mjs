// Kiểm thử phân quyền giáo viên lớp (Scope: class) trên Cloudflare Worker
import assert from 'node:assert/strict';
import worker, { MockDONamespace } from '../worker/index.js';

const kp = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);
const pkp = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);

const URL_SHEET = 'https://script.google.com/macros/s/TEST/exec';
const teachers = {
  gv01: { pin: '123456', ten: 'Thầy Nam', lop: ['9A'], ma: 'GV01' }
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (String(u).startsWith(URL_SHEET)) {
    const b = JSON.parse(o?.body || '{}');
    if (b.action === 'gv_login') {
      const t = teachers[String(b.ma || '').toLowerCase()];
      if (!t) return new Response(JSON.stringify({ ok: false, error: 'Không tìm thấy giáo viên.' }), { status: 200 });
      if (t.pin !== b.pin) return new Response(JSON.stringify({ ok: false, error: 'Mã PIN chưa đúng.' }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, teacher: { ma: t.ma, ten: t.ten, lop: t.lop } }), { status: 200 });
    }
  }
  return realFetch(u, o);
};

const env = {
  GATE_DO: new MockDONamespace(),
  SIGNING_KEYPAIR: kp,
  MOCK_MODE: true,
  SHEET_LOGIN_URL: URL_SHEET,
  ALLOWED_ORIGIN: 'https://mrbin2026dh-droid.github.io',
  FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com',
  PRESENCE_CLIENT_EMAIL: 'p@day-hoc.iam.gserviceaccount.com',
  PRESENCE_KEYPAIR: pkp,
  FIREBASE_PRIVATE_KEY_ID: 'k',
  TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'
};

const call = async (path, o = {}, token) => {
  const r = await worker.fetch(new Request('http://localhost' + path, {
    method: o.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: o.body ? JSON.stringify(o.body) : undefined
  }), env);
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// 1. gv_login giả trả lớp ['9A'] → /api/teacher/auth {teacher_code:'GV01', pin:'123456'} → 200, token có claims.scope='class'
console.log('--- Test 1: Đăng nhập giáo viên lớp ---');
let r = await call('/api/teacher/auth', { method: 'POST', body: { teacher_code: 'GV01', pin: '123456' } });
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.ok(r.body.token, 'Phải có token');
assert.equal(r.body.must_change, false);
assert.deepEqual(r.body.classes, ['9A']);

const payload = JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString());
assert.equal(payload.claims.scope, 'class', 'claims.scope phải là class');
assert.equal(payload.claims.role, 'teacher');
assert.deepEqual(payload.claims.classes, ['9A']);
const teacherToken = r.body.token;
console.log('PASS Test 1');

// 2. Token giáo viên lớp gọi POST /api/pwa/teacher/exams với class_code '9B' → 403; '9A' → 200
console.log('--- Test 2: Phân quyền tạo đề theo lớp ---');
const exam9B = {
  title: 'Kiểm tra 9B',
  grade: 9,
  class_code: '9B',
  mode: 'trial',
  questions: [{ id: 'q1', kind: 'choice', prompt: '1+1=?', options: { A: '2', B: '3' }, correct_answer: 'A', points: 10 }]
};
let r9B = await call('/api/pwa/teacher/exams', { method: 'POST', body: exam9B }, teacherToken);
assert.equal(r9B.status, 403, 'Tạo đề lớp 9B phải bị 403');

const exam9A = {
  title: 'Kiểm tra 9A',
  grade: 9,
  class_code: '9A',
  mode: 'trial',
  questions: [{ id: 'q1', kind: 'choice', prompt: '1+1=?', options: { A: '2', B: '3' }, correct_answer: 'A', points: 10 }]
};
let r9A = await call('/api/pwa/teacher/exams', { method: 'POST', body: exam9A }, teacherToken);
assert.equal(r9A.status, 200, 'Tạo đề lớp 9A phải 200: ' + JSON.stringify(r9A.body));
console.log('PASS Test 2');

// 3. Token giáo viên lớp gọi /api/pwa/teacher/publish → 403
console.log('--- Test 3: Chặn giáo viên lớp gọi endpoint quản trị publish ---');
let rPub = await call('/api/pwa/teacher/publish', {
  method: 'POST',
  body: { subject_id: 'tin-hoc', grade: 9, lesson_id: 'b1', title: 'Bài 1', content_markdown: '# Hi', questions: [] }
}, teacherToken);
assert.equal(rPub.status, 403, 'Giáo viên lớp publish phải bị 403');
console.log('PASS Test 3');

// 4. PIN quản trị vẫn đăng nhập như cũ, admin:true
console.log('--- Test 4: Quản trị viên đăng nhập bằng PIN ---');
let rAdmin = await call('/api/teacher/auth', { method: 'POST', body: { pin: env.TEACHER_ADMIN_SECRET } });
assert.equal(rAdmin.status, 200, JSON.stringify(rAdmin.body));
assert.ok(rAdmin.body.token);
const adminPayload = JSON.parse(Buffer.from(rAdmin.body.token.split('.')[1], 'base64url').toString());
assert.equal(adminPayload.claims.admin, true);

let rAdminPub = await call('/api/pwa/teacher/publish', {
  method: 'POST',
  body: { subject_id: 'tin-hoc', subject_name: 'Tin học', grade: 9, lesson_id: 'b1', title: 'Bài 1', content_markdown: '# Hi', questions: [] }
}, rAdmin.body.token);
assert.notEqual(rAdminPub.status, 403, 'Quản trị viên không bị 403');
console.log('PASS Test 4');

// 5. Thêm kiểm tra: endpoint quản trị khác (gemini-keys, students, ai-limits) chặn giáo viên lớp (403)
console.log('--- Test 5: Các endpoint quản trị khác chặn giáo viên lớp ---');
let rKeys = await call('/api/teacher/gemini-keys', { method: 'GET' }, teacherToken);
assert.equal(rKeys.status, 403, 'gemini-keys phải 403 với giáo viên lớp');

let rStudents = await call('/api/teacher/students', { method: 'GET' }, teacherToken);
assert.equal(rStudents.status, 403, 'students phải 403 với giáo viên lớp');

let rAi = await call('/api/teacher/ai-limits', { method: 'GET' }, teacherToken);
assert.equal(rAi.status, 403, 'ai-limits phải 403 với giáo viên lớp');

// 6. Tài liệu: giáo viên lớp 9 chỉ được đăng vào khối 9, khối 6 bị 403
console.log('--- Test 6: Phân quyền đăng tài liệu theo khối ---');
let rMat6 = await call('/api/pwa/teacher/materials', {
  method: 'POST',
  body: { id: 'mat01', title: 'Tài liệu Tin 6', course_id: 'tin-hoc-6', drive_url: 'https://drive.google.com/file/d/1234567890abcdef/view' }
}, teacherToken);
assert.equal(rMat6.status, 403, 'Đăng tài liệu khối 6 phải bị 403');

let rMat9 = await call('/api/pwa/teacher/materials', {
  method: 'POST',
  body: { id: 'mat02', title: 'Tài liệu Tin 9', course_id: 'tin-hoc-9', drive_url: 'https://drive.google.com/file/d/1234567890abcdef/view' }
}, teacherToken);
assert.equal(rMat9.status, 200, 'Đăng tài liệu khối 9 phải 200: ' + JSON.stringify(rMat9.body));
console.log('PASS Test 6');

// 7. Danh sách bài kiểm tra & Chi tiết bài: chỉ xem được bài của lớp mình
console.log('--- Test 7: Lọc danh sách bài & Chi tiết theo lớp ---');
let listRes = await call('/api/pwa/teacher/exams', { method: 'GET' }, teacherToken);
assert.equal(listRes.status, 200);
assert.ok(Array.isArray(listRes.body.exams));
// Đề 9A đã tạo ở Test 2 phải có trong danh sách
const has9A = listRes.body.exams.some(e => e.title === 'Kiểm tra 9A');
assert.ok(has9A, 'Danh sách phải chứa đề lớp 9A');
// Nếu có đề lớp khác thì giáo viên 9A không được thấy
for (const ex of listRes.body.exams) {
  const codes = (ex.class_codes || []).map(c => String(c).toUpperCase());
  assert.ok(codes.includes('9A'), 'Mọi đề trả về phải thuộc lớp 9A');
}

// Xem chi tiết đề 9A:
const exam9A_id = r9A.body.exam_id;
let get9A = await call(`/api/pwa/teacher/exams/${exam9A_id}`, { method: 'GET' }, teacherToken);
assert.equal(get9A.status, 200, 'Xem đề 9A phải 200');

console.log('PASS Test 7');

console.log('ALL TEACHER SCOPE TESTS PASSED!');
