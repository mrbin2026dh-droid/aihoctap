// Gia sư: học sinh gõ linh tinh ("KKKKKK") khi đang học một bài → trả lời ngay, KHÔNG tốn lượt AI, nói rõ em đang học bài nào,
// gợi ý nội dung trong bài để hỏi; câu hỏi lạc bài → prompt dặn AI từ chối khéo + gợi ý nội dung bài (không dùng câu "không thể cung cấp đáp án").
// Chạy: node tests/test_tutor_offtopic.mjs
import assert from 'node:assert/strict';
import worker, { MockDONamespace, registerStudentCredential, isGibberish, lessonOutline, offTopicReply } from '../worker/index.js';
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
  TEST_LESSONS: { 'tin9:bai1': { course_id: 'tin9', lesson_id: 'bai1', title: 'Thế giới kĩ thuật số', content_markdown: md + '\nCPU là bộ xử lý trung tâm.', questions: [] } } };
const call = async (path, body, headers = {}) => { const res = await worker.fetch(new Request('http://localhost/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env); return { status: res.status, body: await res.json().catch(() => ({})) }; };
const t = (await call('/login', { student_id: 'hs_ot', pin: '123456' })).body.token;
let gemini = 0, sys = ''; const real = globalThis.fetch;
globalThis.fetch = async (u, o) => { if (String(u).includes('generativelanguage')) { gemini++; sys = JSON.parse(o.body).systemInstruction.parts[0].text; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Em đang học bài Thế giới kĩ thuật số. Em muốn tìm hiểu bộ xử lí thông tin không?' }] } }] }), { status: 200 }); } return real(u, o); };
const a = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'KKKKKKKKKK' }, { Authorization: 'Bearer ' + t });
ok(a.status === 200 && a.body.off_topic && a.body.reply.includes('Thế giới kĩ thuật số') && a.body.suggest.length && gemini === 0, 'gõ "KKKKKKKKKK": trả lời ngay theo bài đang học, gợi ý câu hỏi, không gọi AI (không tốn lượt)');
const b = await call('/pwa/tutor', { course_id: 'tin9', lesson_id: 'bai1', message: 'Đội bóng nào vô địch World Cup?' }, { Authorization: 'Bearer ' + t });
ok(b.status === 200 && gemini === 1 && sys.includes('BÀI EM ĐANG HỌC: "Thế giới kĩ thuật số"') && sys.includes('Ưu thế của máy tính') && sys.includes('KHÔNG từ chối cụt'), 'câu hỏi lạc bài: AI được dặn nói rõ bài đang học, gợi ý nội dung bài, từ chối khéo');
globalThis.fetch = real;
console.log('TUTOR OFFTOPIC OK ' + n);
