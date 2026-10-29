// AI cho Thảo luận: gợi ý câu hỏi thảo luận theo bài học; tổng hợp ý kiến cả lớp (KHÔNG gửi tên/mã học sinh).
// Chạy: node tests/test_tl_ai.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, buildTlSummaryPrompt } from '../worker/index.js';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
let prompts = [], gen = () => '{}';
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', TEACHER_AI_DAILY: 10,
  FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  MOCK_GEMINI: p => { prompts.push(p); return gen(p); },
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Thế giới kĩ thuật số', content_markdown: '# Bài 1\nInternet giúp tìm kiếm thông tin, học tập, giải trí.', questions: [] } } };
const call = async (body, headers = { 'X-Admin-Secret': 'TEST_SECRET_KEY_AT_LEAST_16_CHARS' }) => { const r = await worker.fetch(new Request('http://localhost/api/teacher/ai-tl', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env); return { status: r.status, body: await r.json().catch(() => ({})) }; };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };

ok((await call({ mode: 'goi_y', course_id: 'tin9', lesson_id: 'bai1' }, {})).status === 403, 'chưa đăng nhập giáo viên → từ chối');
gen = () => JSON.stringify({ slides: [{ type: 'cloud', text: 'Một từ về Internet?' }, { type: 'poll', text: 'Em dùng Internet để làm gì nhất?', opts: ['Học', 'Chơi'] }, { type: 'xx', text: 'bỏ' }, { type: 'open', text: '' }] });
const g = await call({ mode: 'goi_y', course_id: 'tin9', lesson_id: 'bai1', n: 4 });
ok(g.status === 200 && g.body.slides.length === 2 && g.body.slides[1].opts.length === 2, 'gợi ý câu hỏi thảo luận: lọc loại lạ, câu trống');
ok(prompts.at(-1).includes('Internet giúp tìm kiếm') && prompts.at(-1).includes('THẢO LUẬN'), 'gợi ý bám nội dung bài học trên máy chủ');
ok((await call({ mode: 'goi_y', course_id: 'tin9', lesson_id: 'khong' })).status === 404, 'bài không có → báo');

const body = { title: 'Khởi động bài 1', slides: [{ type: 'cloud', text: 'Một từ?', people: 3, words: [{ w: 'học tập', n: 2 }] }, { type: 'open', text: 'Ý kiến?', people: 2, texts: ['Tìm tài liệu nhanh', 'Dễ bị nghiện game'] }, { type: 'poll', text: 'Chọn', people: 3, opts: ['A', 'B'], counts: [1, 2] }, { type: 'scale', text: 'Tự đánh giá', people: 3, items: ['Hiểu bài'], avg: [3.7] }] };
const sp = buildTlSummaryPrompt(body);
ok(sp.includes('học tập (2)') && sp.includes('- Dễ bị nghiện game') && sp.includes('A: 1; B: 2') && sp.includes('Hiểu bài: 3.7'), 'tổng hợp: gửi AI từ khóa, ý kiến, bình chọn, thang điểm');
gen = () => JSON.stringify({ tong_ket: 'Lớp thấy Internet giúp học tập nhưng lo nghiện game.', trang: [{ so: 2, nhom: [{ ten: 'Lợi ích học tập', so_y: 1, vi_du: 'Tìm tài liệu nhanh' }], luu_y: 'Làm rõ cách dùng an toàn' }] });
const s = await call(body);
ok(s.status === 200 && s.body.tong_ket.includes('nghiện game') && s.body.trang[0].nhom[0].ten === 'Lợi ích học tập', 'tổng hợp trả tóm tắt + nhóm ý chính');
ok((await call({ slides: [] })).status === 400, 'chưa có kết quả → báo');
gen = () => 'rác';
ok((await call(body)).status === 502, 'AI trả rác → báo thử lại');
console.log('TL AI OK ' + n);
