// Worker ↔ Bộ não đa agent (VPS): AI chấm tự luận đi qua agent khi có AGENT_URL; agent lỗi/chậm → đường cũ (Gemini).
// AI soạn câu hỏi: agent kiểm đề tự giải lại, loại câu sai đáp án. Kiểm tra AI hiện trạng thái agent.
// Chạy: node tests/test_agent_bridge.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, registerStudentCredential } from '../worker/index.js';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
await registerStudentCredential('hs_ag', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f77', { name: 'Học sinh thử', grade: 9, class_code: '9A' });
let geminiCalls = 0;
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', ESSAY_DAILY: 20, TEACHER_AI_DAILY: 20,
  FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  AGENT_URL: 'https://agent.test/', AGENT_KEY: 'agent-secret',
  MOCK_GEMINI: p => { geminiCalls++; return /BÀI LÀM CỦA HỌC SINH/.test(p) ? JSON.stringify({ items: [{ diem: 0.25, nhan_xet: 'đường cũ' }], tong_ket: 'cũ' })
    : JSON.stringify({ questions: [{ text: '1 byte bằng bao nhiêu bit?', options: { A: '4', B: '8', C: '16', D: '2' }, answer: 'B', level: 'Biết', topic: 'Đơn vị' }, { text: 'CPU là gì?', options: { A: 'Bộ xử lý', B: 'Màn hình', C: 'Chuột', D: 'Bàn phím' }, answer: 'C', level: 'Biết', topic: 'Phần cứng' }] }); },
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Bài 1', content_markdown: '# Bài 1\nCPU là bộ xử lý trung tâm. 1 byte = 8 bit.', questions: [] } } };
const call = async (path, body, headers = {}) => { const r = await worker.fetch(new Request('http://localhost/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env); return { status: r.status, body: await r.json().catch(() => ({})) }; };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
const realFetch = globalThis.fetch; const agentReqs = []; let agentMode = 'ok';
globalThis.fetch = async (u, o = {}) => {
  const s = String(u);
  if (s.startsWith('https://agent.test')) {
    agentReqs.push({ path: new URL(s).pathname, key: o.headers?.['X-Agent-Key'], body: o.body ? JSON.parse(o.body) : null });
    if (agentMode === 'down') return new Response('{"detail":"lỗi"}', { status: 502 });
    if (o.headers?.['X-Agent-Key'] !== 'agent-secret') return new Response('{"detail":"Sai khóa agent."}', { status: 401 });
    const p = new URL(s).pathname;
    if (p === '/grade') return new Response(JSON.stringify({ items: JSON.parse(o.body).items.map(() => ({ diem: 0.75, nhan_xet: 'Agent: em nêu được ý kiểm tra nguồn.', can_xem_lai: false })), tong_ket: 'Phần tự luận: 0.75/1 điểm.' }), { status: 200 });
    if (p === '/verify-questions') return new Response(JSON.stringify({ ket_qua: [{ giu: true }, { giu: false, ly_do: 'agent tự giải ra A, khác đáp án đã ghi C' }], giu: 1, loai: 1 }), { status: 200 });
    if (p === '/status') return new Response(JSON.stringify({ version: '1.0.0', models: ['gemini-3.5-flash-lite'], khoa: [{ khoa: '…AAAA' }], thong_ke: { cham_24h: 3, can_xem_lai: 1 } }), { status: 200 });
  }
  if (s.includes('generativelanguage')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), { status: 200 });
  if (s.includes('cdn-cgi/trace')) return new Response('colo=IAD\nloc=US\n', { status: 200 });
  return realFetch(u, o);
};
try {
  const t = (await call('/login', { student_id: 'hs_ag', pin: '123456' })).body.token;
  const H = { Authorization: 'Bearer ' + t };
  const essay = { title: 'Thi thử', items: [{ text: 'Nêu cách kiểm tra tin tức.', guide: '- Kiểm tra nguồn (0,5đ)\n- So sánh nguồn khác (0,5đ)', answer: 'Em xem trang đăng tin có chính thống không.', max: 1 }] };
  let r = await call('/pwa/exam-essay', essay, H);
  ok(r.status === 200 && r.body.nguon === 'agent' && r.body.items[0].diem === 0.75 && /Agent/.test(r.body.items[0].nhan_xet), 'có agent → chấm qua Bộ não đa agent ' + JSON.stringify(r.body));
  ok(geminiCalls === 0, 'không gọi Gemini trực tiếp khi agent chấm được');
  const g = agentReqs.find(x => x.path === '/grade');
  ok(g.key === 'agent-secret' && g.body.items[0].guide.includes('Kiểm tra nguồn') && g.body.items[0].max === 1, 'gửi agent: khóa bảo vệ, đề, gợi ý, bài làm, điểm tối đa');
  ok(!JSON.stringify(g.body).includes('Học sinh thử'), 'không gửi tên học sinh cho agent');

  agentMode = 'down';
  r = await call('/pwa/exam-essay', essay, H);
  ok(r.status === 200 && r.body.nguon !== 'agent' && geminiCalls === 1, 'agent lỗi → tự dùng đường cũ (Gemini trực tiếp), học sinh vẫn được chấm');

  agentMode = 'ok';
  const T = { 'X-Admin-Secret': 'TEST_SECRET_KEY_AT_LEAST_16_CHARS' };
  r = await call('/teacher/ai-questions', { course_id: 'tin9', lesson_id: 'bai1', counts: { 'Biết': 2 } }, T);
  ok(r.status === 200 && r.body.questions.length === 1 && r.body.questions[0].text.startsWith('1 byte'), 'agent kiểm đề loại câu sai đáp án ' + JSON.stringify(r.body).slice(0, 200));
  ok(/loại 1 câu/.test(r.body.kiem_tra || ''), 'báo giáo viên số câu bị loại');
  const v = agentReqs.find(x => x.path === '/verify-questions');
  ok(v.body.questions.length === 2 && v.body.lesson.includes('CPU'), 'gửi agent kiểm đề kèm nội dung bài');

  agentMode = 'down';
  r = await call('/teacher/ai-questions', { course_id: 'tin9', lesson_id: 'bai1', counts: { 'Biết': 2 } }, T);
  ok(r.status === 200 && r.body.questions.length === 2 && !r.body.kiem_tra, 'agent lỗi → giữ nguyên câu AI soạn (như trước)');

  agentMode = 'ok';
  r = await call('/teacher/ai-check', {}, T);
  ok(r.body.agent?.ok && r.body.agent.version === '1.0.0' && r.body.agent.thong_ke.cham_24h === 3, 'Kiểm tra AI hiện trạng thái Bộ não agent');
  agentMode = 'down';
  r = await call('/teacher/ai-check', {}, T);
  ok(r.body.agent && r.body.agent.ok === false, 'agent không kết nối được → Kiểm tra AI báo rõ');
  ok(/không trả lời|502/.test(r.body.agent.ly_do || ''), 'Kiểm tra AI nêu lý do agent lỗi: ' + r.body.agent.ly_do);
  // Dán secret thừa tiền tố / xuống dòng Windows / thiếu https:// → vẫn chạy
  agentMode = 'ok'; env.AGENT_KEY = 'AGENT_KEY=agent-secret\r\n'; env.AGENT_URL = ' agent.test/ ';
  r = await call('/teacher/ai-check', {}, T);
  ok(r.body.agent?.ok, 'secret dán thừa "AGENT_KEY=", xuống dòng, thiếu https:// → vẫn kết nối được');
  env.AGENT_KEY = 'khoa-sai';
  r = await call('/teacher/ai-check', {}, T);
  ok(r.body.agent.ok === false && /401/.test(r.body.agent.ly_do) && r.body.agent.do_dai_khoa === 8, 'khóa sai → báo "HTTP 401: khóa AGENT_KEY ở Worker khác khóa trên VPS" + độ dài khóa');
  env.AGENT_KEY = 'agent-secret';
  delete env.AGENT_URL;
  r = await call('/teacher/ai-check', {}, T);
  ok(r.body.agent === null, 'chưa cài agent → agent = null');
} finally { globalThis.fetch = realFetch; }
console.log('AGENT BRIDGE OK ' + n);
