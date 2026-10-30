// Gia sư "học có hướng dẫn" (30/10 tối) – sửa 4 lỗi thấy trong ảnh hội thoại thật:
//  1. Em đáp "không?" (sai) → Gia sư vẫn "Đúng rồi em nhé!" rồi nói điều ngược lại (chiều lòng).
//  2. Em chưa nộp bài → Gia sư viết "Bộ xử lí thông tin (CPU) … được ví như bộ não" = lộ phương án.
//  3. "đáp án đó chĩnh xác", "Đáp án là gì?" phải đi đường trả lời mẫu (không gọi AI).
//  4. AI phải tự đánh giá câu trả lời của em (danh_gia) trước khi viết; quy tắc hỏi mở, một bước, quay về câu hỏi chính.
// Chạy: node tests/test_tutor_guided.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, registerStudentCredential, isAnswerBegging, fixPraise, isHedgedAnswer, optionPairLeak, parseTutorReply, tutorScopeRules, TUTOR_JSON_SCHEMA, PAIR_LEAK_FALLBACK } from '../worker/index.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };

// 1. Chống chiều lòng
const IMG4 = 'Đúng rồi em nhé! Robot hút bụi có tích hợp bộ xử lí thông tin và cảm biến để tự động hóa hoạt động. Theo em, máy giặt tự động có gắn bộ xử lí thông tin hay không?';
ok(fixPraise(IMG4, 'sai', 'không').startsWith('Chưa đúng em ạ') && !/Đúng rồi/.test(fixPraise(IMG4, 'sai', 'không')), 'ảnh 4: AI đánh giá "sai" mà mở đầu "Đúng rồi" → thay bằng "Chưa đúng em ạ", giữ phần giải thích');
ok(fixPraise(IMG4, 'dung', 'không?').startsWith('Em đang đoán phải không?'), 'em trả lời kiểu đoán ("không?") → không khen, hỏi em vì sao nghĩ vậy (dù AI chấm "dung")');
ok(fixPraise('Chính xác! CPU thực hiện lệnh.', 'dung', 'CPU thực hiện các câu lệnh') === 'Chính xác! CPU thực hiện lệnh.', 'em trả lời đúng, rõ ràng → giữ lời khen');
ok(fixPraise('Đúng rồi. Em hỏi rất hay.', 'mot_phan', 'trong tivi').startsWith('Em đúng một phần'), 'đúng một phần → nói rõ "đúng một phần"');
ok(fixPraise('CPU là bộ xử lí.', 'sai', 'x') === 'CPU là bộ xử lí.', 'không có câu khen ở đầu → giữ nguyên');
ok(isHedgedAnswer('không?') && isHedgedAnswer('có ạ?') && isHedgedAnswer('chắc là có') && !isHedgedAnswer('không') && !isHedgedAnswer('Không có bộ xử lí thì sao?'), 'nhận ra câu trả lời kiểu đoán');

// 2. Lộ phương án qua câu ghép
const Q = { prompt: "Bộ phận nào sau đây đóng vai trò là 'bộ não' của các thiết bị kĩ thuật số, chịu trách nhiệm xử lý dữ liệu và thực hiện các lệnh?", options: { A: 'Bộ vi xử lí (CPU)', B: 'Màn hình hiển thị', C: 'Vỏ kim loại bảo vệ', D: 'Dây nguồn cung cấp điện' } };
ok(optionPairLeak('Bộ xử lí thông tin (CPU) là trung tâm điều khiển và thực hiện các câu lệnh, được ví như bộ não của thiết bị.', Q), 'ảnh 2: "(CPU) … được ví như bộ não" → lộ phương án');
ok(optionPairLeak('Màn hình hiển thị không phải là bộ não.', Q), 'loại trừ một lựa chọn bằng mô tả câu hỏi cũng là lộ');
ok(optionPairLeak('CPU chịu trách nhiệm xử lí dữ liệu và thực hiện các lệnh.', Q), 'ghép nội dung lựa chọn với 2 cụm từ của câu hỏi (lý = lí) → lộ');
ok(!optionPairLeak('Em hãy xem lại mục 1 để tìm xem bộ phận nào được ví như "bộ não" của thiết bị kĩ thuật số nhé. Vì sao em lại chọn phương án đó?', Q), 'ảnh 1: gợi ý tìm "bộ não" trong bài, không nêu lựa chọn → không chặn');
ok(!optionPairLeak('Robot hút bụi có tích hợp bộ xử lí thông tin. Theo em, máy giặt có không?', Q), 'ảnh 4: câu hỏi phụ không chạm lựa chọn → không chặn');
ok(!optionPairLeak('CPU là bộ não.', null) && !optionPairLeak('CPU là bộ não.', { prompt: 'Thông tin là gì?', options: { A: 'Dữ liệu' } }), 'không có câu hỏi đang làm → không áp quy tắc');

// 3. Xin đáp án kiểu mới → đường trả lời mẫu
for (const t of ['đáp án đó chĩnh xác', 'Đáp án là gì?', 'phương án em chọn có đúng không', 'em chọn vậy đúng không ạ', 'vậy đáp án câu này là gì']) ok(isAnswerBegging(t), 'bắt xin đáp án: ' + t);
for (const t of ['bộ xử lý câu lệnh', 'trong tivi kỹ thuật số', 'không?', 'Đáp án sai thì em nên ôn phần nào?', 'Kết quả xử lí thông tin là gì?']) ok(!isAnswerBegging(t), 'không bắt câu trả lời/câu hỏi học: ' + t);

// 4. Quy tắc gửi AI
const rules = tutorScopeRules('Thế giới kĩ thuật số', ['Thiết bị có gắn bộ xử lí thông tin'], false);
ok(rules.includes('"danh_gia"') && rules.includes('Tuyệt đối không khen rồi nói điều ngược') && rules.includes('MỘT bước nhỏ') && rules.includes('câu hỏi mở'), 'quy tắc: tự đánh giá trước khi viết, không khen sai, mỗi lượt một bước, hỏi mở');
ok(TUTOR_JSON_SCHEMA.required.includes('danh_gia') && TUTOR_JSON_SCHEMA.propertyOrdering.indexOf('danh_gia') < TUTOR_JSON_SCHEMA.propertyOrdering.indexOf('tra_loi'), 'JSON bắt buộc "danh_gia", đứng trước "tra_loi" (quyết định trước khi viết)');
ok(parseTutorReply('{"pham_vi":"bai_nay","xin_dap_an":false,"danh_gia":"sai","tra_loi":"a"}').verdict === 'sai' && parseTutorReply('{"pham_vi":"bai_nay","tra_loi":"a"}').verdict === 'khong_phai_tra_loi', 'đọc "danh_gia"; thiếu thì coi là không phải câu trả lời');

// 5. Chạy qua Worker thật (AI giả)
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
await registerStudentCredential('hs_gd', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f93', { name: 'Học sinh thử', grade: 9, class_code: '9A' });
const md = '# Bài 1: Thế giới kĩ thuật số\n## 1. Thiết bị có gắn bộ xử lí thông tin\nBộ xử lí thông tin (CPU) được ví như bộ não của thiết bị số. Robot hút bụi, máy giặt tự động có gắn bộ xử lí thông tin.';
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k',
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Thế giới kĩ thuật số', content_markdown: md, questions: [{ id: 'q1', ...Q }] } } };
const call = async (body, headers = {}) => { const res = await worker.fetch(new Request('http://localhost/api/pwa/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env); return { status: res.status, body: await res.json() }; };
const login = await worker.fetch(new Request('http://localhost/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: 'hs_gd', pin: '123456' }) }), env);
const auth = { Authorization: 'Bearer ' + (await login.json()).token };
let replies = [], sys = '', calls = 0; const real = globalThis.fetch;
globalThis.fetch = async (u, o) => { if (String(u).includes('generativelanguage')) { calls++; sys = JSON.parse(o.body).systemInstruction.parts[0].text; const j = replies.shift(); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(j) }] } }] }), { status: 200 }); } return real(u, o); };
replies = [{ pham_vi: 'bai_nay', xin_dap_an: false, danh_gia: 'sai', tra_loi: IMG4 }];
const r1 = await call({ course_id: 'tin9', lesson_id: 'bai1', message: 'không' }, auth);
ok(r1.status === 200 && r1.body.reply.startsWith('Chưa đúng em ạ') && sys.includes('"danh_gia"'), 'qua Worker: AI chấm "sai" mà khen → em nhận "Chưa đúng em ạ…"');
replies = [{ pham_vi: 'bai_nay', xin_dap_an: false, danh_gia: 'dung', tra_loi: 'Bộ xử lí thông tin (CPU) là trung tâm điều khiển và thực hiện các câu lệnh, được ví như bộ não của thiết bị.' },
           { pham_vi: 'bai_nay', xin_dap_an: false, danh_gia: 'dung', tra_loi: 'Em đã nêu đúng chức năng: xử lí và thực hiện lệnh. Giờ em đối chiếu từng lựa chọn xem lựa chọn nào làm được việc đó nhé?' }];
const r2 = await call({ course_id: 'tin9', lesson_id: 'bai1', question_id: 'q1', selected_option: 'A', message: 'bộ xử lý câu lệnh' }, auth);
ok(r2.status === 200 && !/CPU|bộ não/i.test(r2.body.reply) && r2.body.reply.includes('nêu đúng chức năng') && calls === 3 && sys.includes('MỤC TIÊU CUỘC TRÒ CHUYỆN'), 'qua Worker: lời ghép "(CPU) … bộ não" bị chặn, AI viết lại khen đúng ý, không gọi tên lựa chọn');
replies = [{ pham_vi: 'bai_nay', xin_dap_an: false, danh_gia: 'dung', tra_loi: 'CPU được ví như bộ não.' }, { pham_vi: 'bai_nay', xin_dap_an: false, danh_gia: 'dung', tra_loi: 'Đúng, CPU chính là bộ não.' }];
const r3 = await call({ course_id: 'tin9', lesson_id: 'bai1', question_id: 'q1', message: 'bộ não là gì vậy' }, auth);
ok(r3.body.reply === PAIR_LEAK_FALLBACK, 'AI viết lại vẫn lộ → dùng lời thay thế an toàn');
const c0 = calls; const r4 = await call({ course_id: 'tin9', lesson_id: 'bai1', question_id: 'q1', message: 'đáp án đó chĩnh xác' }, auth);
ok(r4.body.answer_request === true && calls === c0, '"đáp án đó chĩnh xác": trả lời mẫu ngay, không gọi AI, không trừ lượt');
globalThis.fetch = real;
console.log('TUTOR GUIDED OK ' + n);
