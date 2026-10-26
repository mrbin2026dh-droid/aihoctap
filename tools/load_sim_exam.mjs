// Mô phỏng N học sinh cùng đăng nhập, vào thi, tự lưu nhiều lần, nộp bài (Worker chạy trong Node, bộ nhớ thay Firebase).
// Đo thời gian CPU/yêu cầu và số lỗi. KHÔNG đo độ trễ mạng thật tới Firebase/Cloudflare.
import worker, {MockDONamespace, registerStudentCredential, createFirebaseCustomToken} from '../worker/index.js';
const N = Number(process.argv[2] || 100), SAVES = Number(process.argv[3] || 20);
const kp = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
for (let i = 0; i < N; i++) await registerStudentCredential('hs' + i, '123456', salt, {name: 'HS ' + i, grade: 9, class_code: '9A'});
const env = {GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'};
const stats = {}; const errs = {};
const call = async (tag, method, path, body, token, ip) => {
  const t0 = performance.now();
  const r = await worker.fetch(new Request('http://localhost/api' + path, {method, headers: {'Content-Type': 'application/json', 'CF-Connecting-IP': ip || '203.0.113.9', ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: body ? JSON.stringify(body) : undefined}), env);
  const ms = performance.now() - t0; (stats[tag] ||= []).push(ms);
  const data = await r.json().catch(() => ({})); if (r.status >= 400) (errs[tag + ' ' + r.status] ||= []).push(data.detail || '');
  return {status: r.status, body: data};
};
const admin = await createFirebaseCustomToken('teacher_admin_01', {role: 'teacher', admin: true, name: 'GV'}, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY_ID);
const T0 = Date.now(); const qs = Array.from({length: 20}, (_, i) => ({id: 'q' + (i + 1), kind: 'choice', prompt: 'Câu ' + (i + 1), options: {A: 'a', B: 'b', C: 'c', D: 'd'}, correct_answer: 'A', points: 0.5, topic: 'T' + (i % 4)}));
const ex = await call('teacher-save', 'POST', '/pwa/teacher/exams', {title: 'Tải thử', grade: 9, mode: 'real', kind: '15m', minutes: 45, opens_at: T0 - 6e4, closes_at: T0 + 36e5, max_attempts: 1, shuffle: true, reveal: 'after-submit', status: 'open', class_codes: [], questions: qs}, admin);
const id = ex.body.exam_id;
const t0 = performance.now();
const student = async i => {
  const ip = '203.0.113.9'; // cả trường dùng chung một địa chỉ mạng
  const lg = await call('login', 'POST', '/login', {student_id: 'hs' + i, pin: '123456'}, null, ip); if (lg.status !== 200) return;
  const tk = lg.body.token;
  await call('list', 'GET', '/pwa/exams', null, tk, ip);
  const st = await call('start', 'POST', '/pwa/exams/start', {exam_id: id}, tk, ip); if (st.status !== 200) return;
  const answers = {};
  for (let k = 0; k < SAVES; k++) { answers[qs[k % qs.length].id] = 'ABCD'[(i + k) % 4]; await call('save', 'PUT', '/pwa/exams/save', {exam_id: id, attempt_id: st.body.attempt_id, answers, leaves: 0}, tk, ip); }
  await call('submit', 'POST', '/pwa/exams/submit', {exam_id: id, attempt_id: st.body.attempt_id, answers}, tk, ip);
};
await Promise.all(Array.from({length: N}, (_, i) => student(i)));
const total = performance.now() - t0;
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(0);
console.log(`N=${N} học sinh, ${SAVES} lần lưu/bạn, tổng ${(total / 1000).toFixed(1)}s (CPU tuần tự một luồng Node)`);
for (const [k, a] of Object.entries(stats)) console.log(k.padEnd(12), 'số yêu cầu', String(a.length).padStart(5), ' trung bình', (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1).padStart(7), 'ms  p95', pct(a, .95).padStart(6), 'ms');
console.log('LỖI:', Object.keys(errs).length ? Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, `${v.length}x, ví dụ: ${v[0]}`])) : 'không');
