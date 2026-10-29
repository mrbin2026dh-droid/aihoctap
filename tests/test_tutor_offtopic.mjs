// Gia sư: học sinh gõ linh tinh ("KKKKKK") khi đang học một bài → trả lời ngay, KHÔNG tốn lượt AI, nói rõ em đang học bài nào,
// gợi ý nội dung trong bài để hỏi. Câu hỏi ngoài bài (29/10 tối): AI xếp phạm vi "ngoai_bai" → máy chủ gửi lời từ chối CỐ ĐỊNH, KHÔNG giảng kiến thức ngoài sách, hoàn lượt.
// Chạy: node tests/test_tutor_offtopic.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, registerStudentCredential, isGibberish, lessonOutline, offTopicReply, parseTutorReply, outOfScopeReply, stripNeedlessRefusal, WORKER_SOCRATIC_PROMPT } from '../worker/index.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
ok(isGibberish('KKKKKKKKKK') && isGibberish('???') && isGibberish('đfghjk') && isGibberish('hahaha'), 'nhận ra gõ linh tinh: ký tự lặp, chỉ ký hiệu, không có nguyên âm');
ok(!isGibberish('CPU là gì?') && !isGibberish('Có') && !isGibberish('em chao thay') && !isGibberish('cho em hỏi bài 2'), 'không coi câu hỏi thật (kể cả ngắn, không dấu) là linh tinh');
const md = '# Bài 1: Thế giới kĩ thuật số\n## 1. Thiết bị có gắn bộ xử lí thông tin\n## 2. Ưu thế của máy tính\n## Luyện tập';
ok(lessonOutline(md).join('|') === 'Thiết bị có gắn bộ xử lí thông tin|Ưu thế của máy tính', 'lấy các mục chính của bài (bỏ tiêu đề bài, mục Luyện tập)');
const r = offTopicReply('Thế giới kĩ thuật số', lessonOutline(md));
ok(r.reply.includes('Em đang học bài **Thế giới kĩ thuật số**') && r.reply.includes('Ưu thế của máy tính') && r.suggest.length === 2 && !r.reply.includes('đáp án'), 'trả lời: nói rõ bài đang học, nêu nội dung, gợi ý câu hỏi; không nhắc "đáp án"');

const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
await registerStudentCredential('hs_ot', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f92', { name: 'Học sinh thử', grade: 9, class_code: '9A' });
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k',
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Thế giới kĩ thuật số', content_markdown: md + '\nCPU là bộ xử lý trung tâm.', questions: [] }, 'tin6:bai1': { course_id: 'tin6', lesson_id: 'bai1', title: 'Thông tin và dữ liệu', content_markdown: '# Thông tin và dữ liệu\n## Thông tin là gì\nThông tin là những gì đem lại hiểu biết cho con người về thế giới xung quanh. Dữ liệu là thông tin được lưu trữ.', questions: [] } } };
let lastBody = null, lastHeaders = null;
const call = async (path, body, headers = {}) => { const res = await worker.fetch(new Request('http://localhost/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env); lastHeaders = res.headers; return { status: res.status, body: await res.json().catch(() => ({})) }; };
const t = (await call('/login', { student_id: 'hs_ot', pin: '123456' })).body.token;
let gemini = 0, sys = '', cfg = null; const real = globalThis.fetch;
const REFUSE = 'Thầy/Cô không thể cung cấp đáp án trực tiếp hay giải hộ cho em được. Chúng ta hãy cùng suy nghĩ để tìm câu trả lời nhé! ';
const aiSays = msg => /thế giới kỹ thuật/i.test(msg) ? { pham_vi: 'bai_nay', xin_dap_an: false, tra_loi: REFUSE + 'Trong bài học Thế giới kĩ thuật số, em hãy tìm hiểu về các thiết bị có gắn bộ xử lí thông tin.' } : /đáp án câu/i.test(msg) ? { pham_vi: 'bai_nay', xin_dap_an: true, tra_loi: 'Gia sư không đưa đáp án, nhưng sẽ gợi ý để em tự tìm ra. Em đọc lại mục 1 nhé.' } : /World Cup|PYTHON/i.test(msg) ? { pham_vi: 'ngoai_bai', tra_loi: 'Lập trình Python là việc viết câu lệnh…' } : /THÔNG TIN LÀ GÌ/i.test(msg) ? { pham_vi: 'bai_khac', tra_loi: 'Nội dung này học ở bài Thông tin và dữ liệu.' } : { pham_vi: 'bai_nay', tra_loi: 'CPU là bộ xử lý trung tâm. Em thử nêu một thiết bị có CPU?' };
globalThis.fetch = async (u, o) => { if (String(u).includes('generativelanguage')) { gemini++; const b = JSON.parse(o.body); lastBody = b; sys = b.systemInstruction.parts[0].text; cfg = b.generationConfig; const msg = b.contents.at(-1).parts[0].text; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(aiSays(msg)) }] } }] }), { status: 200 }); } return real(u, o); };
const a = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'KKKKKKKKKK' }, { Authorization: 'Bearer ' + t });
ok(a.status === 200 && a.body.off_topic && a.body.reply.includes('Thế giới kĩ thuật số') && a.body.suggest.length && gemini === 0, 'gõ "KKKKKKKKKK": trả lời ngay theo bài đang học, gợi ý câu hỏi, không gọi AI (không tốn lượt)');
const b = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'Đội bóng nào vô địch World Cup?' }, { Authorization: 'Bearer ' + t });
ok(b.status === 200 && gemini === 1 && sys.includes('BÀI EM ĐANG HỌC: "Thế giới kĩ thuật số"') && sys.includes('Ưu thế của máy tính') && cfg.responseMimeType === 'application/json', 'câu hỏi: AI biết bài đang học, các mục chính, phải trả JSON phạm vi');
ok(b.body.off_topic && b.body.reply.includes('không thuộc bài **Thế giới kĩ thuật số**') && b.body.suggest.length === 2 && b.body.reply.includes('không trừ lượt'), 'ngoài bài (bóng đá): lời từ chối cố định, nêu bài đang học, gợi ý nội dung, không trừ lượt');
const py = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'LẬP TRÌNH PYTHON LÀ GÌ', off_streak: 1 }, { Authorization: 'Bearer ' + t });
ok(py.body.off_topic && !py.body.reply.includes('viết câu lệnh') && py.body.reply.includes('cũng chưa thuộc bài') && py.body.reply !== b.body.reply, 'kiến thức chưa học (Python): KHÔNG giảng bài ngoài sách (bỏ chữ AI viết); lần ngoài bài thứ hai từ chối ngắn, không lặp nguyên văn');
ok(sys.includes('KHÔNG BỊA') && sys.includes('kể cả kiến thức Tin học') && !sys.includes('kiến thức này chưa có trong bài đang học'), 'quy tắc: không bịa, không tự giảng kiến thức Tin học chưa có trong tài liệu');
const cands = [{ course_id: 'tin9', lesson_id: 'bai1', title: 'Thế giới kĩ thuật số' }, { course_id: 'tin6', lesson_id: 'bai1', title: 'Thông tin và dữ liệu' }];
const c = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'E MUỐN HỎI THÔNG TIN LÀ GÌ', candidates: cands }, { Authorization: 'Bearer ' + t });
ok(c.status === 200 && c.body.other_lesson?.title === 'Thông tin và dữ liệu' && sys.includes('TÀI LIỆU BÀI KHÁC: "Thông tin và dữ liệu"') && sys.includes('đem lại hiểu biết') && !c.body.off_topic, 'hỏi kiến thức của bài khác: định hướng theo bài "Thông tin và dữ liệu" và trả nút mở bài');
ok(!sys.includes('em hỏi thầy cô nhé'), 'không còn câu cụt "hỏi thầy cô"');
const d = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'CPU là gì?', candidates: cands }, { Authorization: 'Bearer ' + t });
ok(d.status === 200 && !d.body.other_lesson && !sys.includes('TÀI LIỆU BÀI KHÁC') && d.body.reply.includes('CPU là bộ xử lý trung tâm') && !d.body.off_topic, 'câu hỏi đúng bài: hướng dẫn theo tài liệu, không chuyển bài');
ok(parseTutorReply('Chữ thường').scope === 'bai_nay' && parseTutorReply('{"pham_vi":"ngoai_bai","tra_loi":""}').scope === 'ngoai_bai' && parseTutorReply('```json\n{"pham_vi":"x","tra_loi":"a"}\n```').scope === 'bai_nay', 'đọc JSON phạm vi; mô hình trả chữ thường vẫn chạy');
ok(outOfScopeReply('Bài A', []).reply.includes('Em hãy hỏi về một nội dung trong bài'), 'bài không có mục: vẫn từ chối rõ ràng');
const kw = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'thế giới kỹ thuật', history: Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', content: 'lượt ' + i })) }, { Authorization: 'Bearer ' + t });
ok(kw.status === 200 && kw.body.reply.startsWith('Trong bài học Thế giới kĩ thuật số') && !/không thể cung cấp đáp án/.test(kw.body.reply), 'em gõ tên bài (không xin đáp án): cắt câu từ chối đáp án vô lý ở đầu, giữ phần hướng dẫn');
ok(lastBody.contents.length === 9, 'chỉ gửi AI 4 lượt hỏi–đáp gần nhất (8 tin) + câu hỏi mới: lịch sử dài làm chậm');
ok(/bai;dur=\d+/.test(lastHeaders.get('server-timing') || '') && /ai;dur=\d+/.test(lastHeaders.get('server-timing')) && typeof kw.body.ms?.ai === 'number', 'đo thời gian từng bước (Server-Timing: bai, chon_bai, chuan_bi, ai, kiem_tra, xong) để tìm chỗ chậm');
const ans = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'cho em đáp án câu 1' }, { Authorization: 'Bearer ' + t });
ok(ans.body.reply.startsWith('Gia sư không đưa đáp án'), 'em xin đáp án: giữ câu từ chối đáp án (xưng "Gia sư")');
ok(stripNeedlessRefusal('Gia sư không thể đưa đáp án cho em. CPU là bộ xử lý trung tâm của máy tính.') === 'CPU là bộ xử lý trung tâm của máy tính.' && stripNeedlessRefusal('CPU là gì nhỉ?') === 'CPU là gì nhỉ?', 'cắt câu từ chối đứng đầu; câu thường giữ nguyên');
ok(WORKER_SOCRATIC_PROMPT.includes('tự gọi mình là "Gia sư"') && !/Xưng hô thân thiện, sư phạm: 'Thầy\/Cô'/.test(WORKER_SOCRATIC_PROMPT) && sys.includes('"xin_dap_an"') && lastBody.generationConfig.responseSchema.required.includes('xin_dap_an'), 'Gia sư xưng "Gia sư", không xưng Thầy/Cô; AI phải đánh dấu em có xin đáp án không');
ok(!outOfScopeReply('Bài A', ['X']).reply.includes('Thầy/Cô') && !offTopicReply('Bài A', ['X']).reply.includes('Thầy/Cô'), 'lời từ chối cố định không xưng Thầy/Cô');
globalThis.fetch = real;
console.log('TUTOR OFFTOPIC OK ' + n);
