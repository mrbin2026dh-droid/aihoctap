// Hạn mức hỏi Gia sư AI (thầy hỏi 30/10: "quá 20 câu thì AI phải từ chối; số lần tính theo NGÀY hay theo BÀI?").
// Trả lời bằng mã (worker/index.js): đếm theo NGÀY giờ Việt Nam (khóa ai:count:<ngày>:<mã em>), CỘNG DỒN MỌI BÀI, về 0 lúc 00:00 giờ VN.
// Thứ tự ưu tiên: hạn mức riêng của em > hạn mức của lớp > hạn mức mặc định; "+5 lượt" chỉ có hiệu lực trong ngày.
// Không trừ lượt: câu xin đáp án / hỏi xác nhận khi đang làm câu, gõ linh tinh, câu ngoài bài, không tìm thấy bài.
// Chạy: node tests/test_tutor_quota.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, registerStudentCredential, vnDay } from '../worker/index.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const md1 = '# Bài 1: Thế giới kĩ thuật số\n## 1. Thiết bị có gắn bộ xử lí thông tin\nCPU là bộ xử lí trung tâm.', md2 = '# Bài 2: Thông tin trong giải quyết vấn đề\n## 1. Vai trò của thông tin\nThông tin giúp ra quyết định.';
const GATE = new MockDONamespace();
const env = { GATE_DO: GATE, SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k',
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Thế giới kĩ thuật số', content_markdown: md1, questions: [{ id: 'q1', prompt: 'Bộ phận nào là bộ não?', options: { A: 'CPU', B: 'Màn hình' } }] },
    'tin9:bai2': { course_id: 'tin9', lesson_id: 'bai2', title: 'Thông tin trong giải quyết vấn đề', content_markdown: md2, questions: [] } } };
const doSet = body => GATE.get().fetch(new Request('http://do/ai-settings-set', { method: 'POST', body: JSON.stringify(body) }));
const login = async (id, cls) => { await registerStudentCredential(id, '123456', (id + '0123456789abcdef0123456789abcdef').replace(/[^0-9a-f]/g, '0').slice(0, 32), { name: 'Học sinh thử', grade: 9, class_code: cls });
  const r = await worker.fetch(new Request('http://localhost/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: id, pin: '123456' }) }), env); return (await r.json()).token; };
const ask = async (tok, body) => { const r = await worker.fetch(new Request('http://localhost/api/pwa/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }), env); return { status: r.status, body: await r.json() }; };
const quota = async tok => (await (await worker.fetch(new Request('http://localhost/api/pwa/ai-quota', { headers: { Authorization: 'Bearer ' + tok } }), env)).json());
let calls = 0, scope = 'bai_nay'; const real = globalThis.fetch;
globalThis.fetch = async (u, o) => { if (!String(u).includes('generativelanguage')) return real(u, o); calls++;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pham_vi: scope, xin_dap_an: false, danh_gia: 'khong_phai_tra_loi', tra_loi: scope === 'bai_nay' ? 'Theo bài, em hiểu thế nào?' : '' }) }] } }] }), { status: 200 }); };

await doSet({ default_limit: 3 });   // thầy đặt 3 cho dễ thử (thật: 20)
const t = await login('hsq1', '9A');
let q = await quota(t); ok(q.limit === 3 && q.remaining === 3 && q.date === vnDay(), 'hạn mức mặc định 3 câu/ngày, ngày tính theo giờ VN');
ok((await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'CPU là gì?' })).status === 200, 'câu 1 (bài 1): trả lời');
ok((await ask(t, { course_id: 'tin9', lesson_id: 'bai2', message: 'Thông tin là gì?' })).status === 200, 'câu 2 (bài 2): trả lời');
// Không trừ lượt
const c0 = calls;
await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'cho em đáp án câu 1' });
await ask(t, { course_id: 'tin9', lesson_id: 'bai1', question_id: 'q1', message: 'em nghĩ là CPU đúng không?' });
await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'KKKKKKKKK' });
scope = 'ngoai_bai'; await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'Đội bóng nào vô địch World Cup?' }); scope = 'bai_nay';
q = await quota(t); ok(q.used === 2 && q.remaining === 1, 'xin đáp án, hỏi xác nhận, gõ linh tinh, câu ngoài bài: KHÔNG trừ lượt (đã dùng 2/3)');
ok(calls === c0 + 1, 'chỉ câu ngoài bài gọi AI (để xếp phạm vi) rồi được hoàn lượt; 3 câu kia trả lời mẫu không gọi AI');
ok((await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'Bộ xử lí làm gì?' })).status === 200, 'câu 3: trả lời (đủ 3/3)');
const r4 = await ask(t, { course_id: 'tin9', lesson_id: 'bai2', message: 'Vai trò của thông tin?' });
ok(r4.status === 429 && r4.body.error === 'AI_LIMIT_REACHED' && /hết 3 lượt/.test(r4.body.detail) && /hôm nay/.test(r4.body.detail), 'câu 4 (đổi sang bài khác): TỪ CHỐI 429 "hết 3 lượt … hôm nay" → đếm theo NGÀY, cộng dồn mọi bài, đổi bài không được thêm lượt');
const c1 = calls; await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'Bộ nhớ là gì?' });
ok(calls === c1, 'đã hết lượt: không gọi AI nữa (không tốn tiền khóa Gemini)');
ok((await ask(t, { course_id: 'tin9', lesson_id: 'bai1', message: 'xin đáp án' })).body.answer_request, 'hết lượt vẫn nhận trả lời mẫu (xin đáp án) – không cần AI');
// Thầy cộng thêm lượt trong ngày
await GATE.storage.put(`ai:grant:${vnDay()}:hsq1`, 5);
q = await quota(t); ok(q.limit === 8 && q.remaining === 5, 'thầy bấm "+5 lượt": hạn mức hôm nay 3 + 5 = 8');
// Sang ngày mới
const now = Date.now; Date.now = () => now() + 24 * 3600e3;
const t2 = await login('hsq1', '9A');   // phiên cũ hết hạn sau 24 giờ → đăng nhập lại
q = await quota(t2); ok(q.used === 0 && q.limit === 3 && q.remaining === 3, 'sang ngày mới (00:00 giờ VN): về 0, "+5 lượt" hôm qua hết hiệu lực');
ok((await ask(t2, { course_id: 'tin9', lesson_id: 'bai1', message: 'CPU là gì?' })).status === 200, 'ngày mới hỏi lại được');
Date.now = now;
// Ưu tiên: lớp và từng em
await doSet({ class_limits: { '9B': 1 }, student_limits: { hsq3: 5 } });
const tb = await login('hsq2', '9B'), tc = await login('hsq3', '9B');
ok((await quota(tb)).limit === 1 && (await quota(tc)).limit === 5, 'hạn mức riêng của em (5) > hạn mức lớp 9B (1) > mặc định (3)');
await ask(tb, { course_id: 'tin9', lesson_id: 'bai1', message: 'CPU là gì?' });
ok((await ask(tb, { course_id: 'tin9', lesson_id: 'bai1', message: 'Bộ nhớ là gì?' })).status === 429, 'lớp 9B hạn mức 1: câu thứ 2 bị từ chối');
// Khóa AI trong giờ kiểm tra
await doSet({ exam_mode: true });
const re = await ask(tc, { course_id: 'tin9', lesson_id: 'bai1', message: 'CPU là gì?' });
ok(re.status === 429 && re.body.error === 'AI_DISABLED_IN_EXAM', 'bật "Khóa AI trong khi kiểm tra": mọi em bị từ chối');
globalThis.fetch = real;
console.log('TUTOR QUOTA OK ' + n);
