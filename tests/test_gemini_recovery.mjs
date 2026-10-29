// AI gặp lỗi không phải 429 (503 quá tải, 404 sai tên mô hình, 403 khóa bị từ chối): Gia sư tự thử lại / đổi mô hình dự phòng
// trước khi báo lỗi; báo lỗi nói rõ nguyên nhân. Giáo viên có nút "Kiểm tra AI" để thấy mã lỗi từng khóa × mô hình.
// Chạy: node tests/test_gemini_recovery.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, registerStudentCredential, geminiOnce } from '../worker/index.js';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
await registerStudentCredential('hs_rc', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f99', { name: 'Học sinh thử', grade: 9, class_code: '9A' });
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'envkey', GEMINI_MODEL: 'main-model', GEMINI_FALLBACK_MODEL: 'fb-model', ALLOWED_ORIGIN: 'https://x.github.io',
  FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Bài 1', content_markdown: 'CPU là bộ xử lý trung tâm.', questions: [] } } };
const call = async (path, body, headers = {}) => { const r = await worker.fetch(new Request('http://localhost/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const realFetch = globalThis.fetch;
/** @type {(model:string, n:number, key:string) => number} */ let plan = () => 200;
const calls = [];
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (s.includes('generativelanguage')) {
    const model = s.split('/models/')[1].split(':')[0], key = o.headers['x-goog-api-key'];
    calls.push({ model, key }); const st = plan(model, calls.length, key);
    if (st === 200) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Em thử nghĩ xem CPU làm gì?' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: { code: st, message: st === 403 ? 'API key not valid. Please pass a valid API key. AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : st === 404 ? 'models/main-model is not found' : 'The model is overloaded.' } }), { status: st });
  }
  return realFetch(u, o);
};
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
try {
  const t = (await call('/login', { student_id: 'hs_rc', pin: '123456' })).body.token;
  const H = { Authorization: 'Bearer ' + t };
  const ask = () => call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'CPU là gì?' }, H);

  calls.length = 0; plan = (m, i) => (i === 1 ? 503 : 200);
  let r = await ask();
  ok(r.status === 200 && r.body.reply, 'Gia sư: Gemini 503 một lần → tự thử lại, học sinh vẫn nhận câu trả lời ' + JSON.stringify(r.body));
  ok(calls.length === 2 && calls.every(c => c.model === 'main-model'), 'thử lại đúng mô hình chính trước');

  calls.length = 0; plan = m => (m === 'main-model' ? 404 : 200);
  r = await ask();
  ok(r.status === 200 && calls.at(-1).model === 'fb-model', 'Gia sư: sai tên mô hình chính (404) → chuyển mô hình dự phòng');

  calls.length = 0; plan = () => 503;
  r = await ask();
  ok(r.status === 502 && /quá tải/.test(r.body.detail), 'Gia sư: AI quá tải mãi → báo rõ "quá tải", không treo ' + r.body.detail);
  ok(calls.length <= 5, 'thử có giới hạn (' + calls.length + ' lần)');

  calls.length = 0; plan = () => 403;
  r = await ask();
  ok(r.status === 502 && /từ chối/.test(r.body.detail), 'Gia sư: khóa bị từ chối → báo rõ ' + r.body.detail);

  // geminiOnce (AI chấm tự luận, AI soạn câu hỏi): 503 rồi được → trả lời
  calls.length = 0; plan = (m, i) => (i === 1 ? 503 : 200);
  const stub = env.GATE_DO.get(env.GATE_DO.idFromName('gate'));
  const txt = await geminiOnce({ ...env, MOCK_GEMINI: undefined }, stub, 'Xin chào', { json: false });
  ok(txt && calls.length === 2 && calls[1].model === 'fb-model', 'AI chấm: 503 → thử mô hình dự phòng, chấm được');

  // Kiểm tra AI cho giáo viên
  calls.length = 0; plan = m => (m === 'main-model' ? 403 : 200);
  r = await call('/teacher/ai-check', {}, { 'X-Admin-Secret': 'TEST_SECRET_KEY_AT_LEAST_16_CHARS' });
  ok(r.status === 200 && Array.isArray(r.body.results), 'Kiểm tra AI: trả danh sách kết quả ' + JSON.stringify(r.body).slice(0, 200));
  const envRows = r.body.results.filter(x => x.nguon === 'Khóa mặc định của máy chủ');
  ok(envRows.length === 2 && envRows.find(x => x.mo_hinh === 'main-model').ma === 403 && envRows.find(x => x.mo_hinh === 'fb-model').ok, 'Kiểm tra AI: mỗi khóa × mô hình chính / dự phòng có mã riêng');
  ok(!JSON.stringify(r.body).includes('envkey') && !/AIza[0-9A-Za-z_-]{20,}/.test(JSON.stringify(r.body)), 'Kiểm tra AI: không lộ khóa');
  r = await call('/teacher/ai-check', {});
  ok(r.status === 403, 'Kiểm tra AI: chưa đăng nhập giáo viên → từ chối');
} finally { globalThis.fetch = realFetch; }
console.log('GEMINI RECOVERY OK ' + n);
