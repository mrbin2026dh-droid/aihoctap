// Gia sư đúng với MỌI bài, không viết riêng cho một bài (30/10 tối, thầy yêu cầu "cấm hardcode cứng 1 bài").
// Dữ liệu: toàn bộ bài có câu hỏi trong data/curriculum_v2_simple (Tin 6, Tin 9), đọc tự động – thêm bài mới là test tự chạy thêm.
// Kiểm: (1) mã nguồn Worker không còn luật viết riêng cho câu/bài nào; (2) chặn lộ đáp án bằng so chữ chạy đúng trên mọi câu;
// (3) qua Worker thật (AI giả): mỗi bài, Gia sư nhận đúng tài liệu của bài đó, không lẫn bài khác; AI kiểm duyệt nhận đúng đáp án của từng câu;
// lời lộ đáp án (lời giải thích sau khi chấm của chính câu đó) không bao giờ đến tay em.
// Chạy: node tests/test_tutor_all_lessons.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import worker, { MockDONamespace, registerStudentCredential, answerLeak, optionPairLeak, sanitizeWorkerOutput, PAIR_LEAK_FALLBACK } from '../worker/index.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };

// 1. Không còn luật viết riêng cho một bài/câu trong Worker
const src = fs.readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).map(l => l.replace(/\s*\/\/.*$/, '')).join('\n').replace(/Bộ não AI/g, '');
for (const bad of ['ánh sáng màu đỏ', 'tiếp thu nhanh', 'ghi nhớ bền vững', 'nhanh\\s*chóng\\s+hay', 'thu\\s*nhận["\'»]?\\s*,', 'bộ não', '[\'"]cpu[\'"]', 'tin9_b', 'tin6_b'])
  ok(!new RegExp(bad, 'i').test(code), 'Worker không có luật riêng chứa: ' + bad);

// 2. Nạp mọi bài có câu hỏi
const base = fileURLToPath(new URL('../data/curriculum_v2_simple/', import.meta.url));
const lessons = [];
for (const g of fs.readdirSync(base)) for (const f of fs.readdirSync(path.join(base, g))) {
  const d = JSON.parse(fs.readFileSync(path.join(base, g, f), 'utf8'));
  const qs = (d.quiz || []).filter(q => q.lua_chon && q.dap_an_dung && q.lua_chon[q.dap_an_dung]);
  if (qs.length) lessons.push({ course: g, lesson: f.replace('.json', ''), title: d.title, md: d.content_markdown, qs });
}
const allQ = lessons.flatMap(l => l.qs.map(q => ({ l, q, Q: { prompt: q.cau_hoi, options: q.lua_chon }, correct: q.lua_chon[q.dap_an_dung] })));
ok(lessons.length >= 13 && allQ.length >= 50, `nạp ${lessons.length} bài, ${allQ.length} câu hỏi (Tin 6 + Tin 9)`);

// 3. Lớp so chữ trên mọi câu
const miss = [], fp = [];
for (const { q, Q, correct } of allQ) {
  for (const leak of [`Đáp án đúng là: ${correct}.`, `${correct} chính là điều câu hỏi nhắc tới.`, `Theo bài, ${correct.toLowerCase()} nhé em.`])
    if (!(answerLeak(leak, Q, correct) || optionPairLeak(leak, Q))) miss.push(q.id + ': ' + leak);
  const so = (String(q.section_ref || '').match(/Mục\s*\d+/) || ['phần liên quan'])[0];
  const safe = `Em hãy đọc lại ${so} trong bài, rồi tự đối chiếu từng lựa chọn với điều câu hỏi mô tả. Vì sao em nghĩ vậy?`;
  if (answerLeak(safe, Q, correct) || optionPairLeak(safe, Q)) fp.push(q.id + ': ' + safe);
  // Nêu cả tên mục: chỉ được chặn khi chính tên mục chứa tên riêng / nguyên cụm của đáp án (vd mục "Hàm COUNTIF…" khi đáp án là COUNTIF)
  const titled = `Em hãy đọc lại ${q.section_ref || so}, rồi tự đối chiếu từng lựa chọn. Vì sao em nghĩ vậy?`;
  if ((answerLeak(titled, Q, correct) || optionPairLeak(titled, Q)) && !answerLeak(String(q.section_ref || ''), Q, correct)) fp.push(q.id + ' (tên mục): ' + titled);
}
ok(miss.length === 0, `nêu nội dung đáp án (3 cách viết × ${allQ.length} câu) đều bị chặn` + (miss.length ? '\n' + miss.join('\n') : ''));
ok(fp.length === 0, `gợi ý đọc lại mục của bài + hỏi gợi mở (${allQ.length} câu) không bị chặn nhầm` + (fp.length ? '\n' + fp.join('\n') : ''));
const expl = allQ.filter(({ Q, correct, q }) => { const t = String(q.giai_thich_su_pham || ''); return answerLeak(t, Q, correct) || optionPairLeak(t, Q); }).length;
console.log(`     (tham khảo) lời giải thích sau chấm bị lớp so chữ chặn: ${expl}/${allQ.length}; phần còn lại do AI kiểm duyệt (lớp 2) xét`);
ok(expl >= Math.floor(allQ.length * 0.45), 'lớp so chữ chặn được ít nhất 45% lời giải thích có đáp án (diễn đạt khác do lớp AI kiểm duyệt)');
ok(sanitizeWorkerOutput(`Đúng vậy, ${allQ[0].correct}.`, 'em hỏi', { question: allQ[0].Q, correct_answer_text: allQ[0].correct }).modified, 'bộ lọc chung (sanitize) dùng cùng luật khi biết câu hỏi');

// 4. Qua Worker thật, từng bài
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);

const TEST_LESSONS = {}, TEST_PACKAGES_PRIVATE = {};
for (const l of lessons) {
  const pub = { course_id: l.course, lesson_id: l.lesson, title: l.title, content_markdown: l.md, questions: l.qs.map(q => ({ id: q.id, prompt: q.cau_hoi, options: q.lua_chon })) };
  TEST_LESSONS[`${l.course}:${l.lesson}`] = pub; TEST_LESSONS[`${l.course}_${l.lesson}`] = pub;
  TEST_PACKAGES_PRIVATE[`${l.course}_${l.lesson}`] = { questions: l.qs.map(q => ({ id: q.id, correct_answer: q.dap_an_dung })) };
}
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEST_LESSONS, TEST_PACKAGES_PRIVATE, AI_DEFAULT_LIMIT: 100000 };
// Hạn mức Gia sư 10 lượt/em/ngày: đổi tài khoản thử sau mỗi 5 lượt (mỗi lượt tối đa 2 lần gọi AI)
let auth = null, used = 99, sid = 0;
const nextStudent = async () => { const id = 'hs_all_' + (++sid); await registerStudentCredential(id, '123456', (sid.toString(16).padStart(4, '0') + 'a1b2c3d4e5f60718293a4b5c6d7e').slice(0, 32), { name: 'Học sinh thử', grade: 9, class_code: '9A' });
  const login = await worker.fetch(new Request('http://localhost/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: id, pin: '123456' }) }), env);
  auth = { Authorization: 'Bearer ' + (await login.json()).token }; used = 0; };
const call = async body => { if (used >= 4) await nextStudent(); used++; const r = await worker.fetch(new Request('http://localhost/api/pwa/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(body) }), env); return { status: r.status, body: await r.json() }; };
let plan = null, sys = '', judged = []; const real = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (!String(u).includes('generativelanguage')) return real(u, o);
  const b = JSON.parse(o.body), text = b.contents.at(-1).parts[0].text;
  if (text.startsWith('Bạn là bộ kiểm duyệt')) { judged.push(text); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ lo: plan.leaky.includes(text.split('LỜI GIA SƯ:\n')[1]?.slice(0, 40)) }) }] } }] }), { status: 200 }); }
  sys = b.systemInstruction.parts[0].text;
  const reply = plan.replies.shift() ?? plan.safe;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pham_vi: 'bai_nay', xin_dap_an: false, danh_gia: 'khong_phai_tra_loi', tra_loi: reply }) }] } }] }), { status: 200 });
};
// 4a. Mỗi bài: hỏi khái niệm theo mục đầu tiên của chính bài đó → AI nhận đúng tài liệu bài đó, không lẫn bài khác
const wrongCtx = [];
for (const l of lessons) {
  const head = (l.md.match(/^#{2,3}\s+(?:\d+[.)]\s*)?(.+)$/m) || [])[1] || l.title;
  plan = { replies: [], safe: `Theo bài, ${head} là nội dung chính. Em hiểu thế nào?`, leaky: '' };
  const r = await call({ course_id: l.course, lesson_id: l.lesson, message: `${head} là gì?` });
  const others = lessons.filter(x => x !== l && !l.md.includes(x.title));
  if (r.status !== 200 || !sys.includes(`BÀI EM ĐANG HỌC: "${l.title}"`) || !sys.includes(head) || others.some(x => sys.includes(`BÀI EM ĐANG HỌC: "${x.title}"`))) wrongCtx.push(`${l.course}/${l.lesson}`);
}
ok(wrongCtx.length === 0, `hỏi khái niệm ở ${lessons.length} bài: Gia sư dùng đúng tài liệu của bài đang học` + (wrongCtx.length ? ': ' + wrongCtx.join(', ') : ''));
// 4b. Mỗi câu hỏi: AI định viết lời giải thích có đáp án → không đến tay em; kiểm duyệt nhận đúng đáp án của câu đó
const leaked = [], badLetter = [];
for (const { l, q, correct } of allQ) {
  const leakyText = String(q.giai_thich_su_pham || `Đáp án là ${correct}.`).replace(/^(Chính xác|Đúng rồi|Tuyệt vời|Rất chuẩn|Rất tốt|Rất xuất sắc)[!.]\s*/i, '');
  plan = { replies: [leakyText, leakyText], safe: 'Em đọc lại mục liên quan rồi tự đối chiếu các lựa chọn nhé. Em loại được lựa chọn nào trước?', leaky: leakyText };
  judged = [];
  const r = await call({ course_id: l.course, lesson_id: l.lesson, question_id: q.id, message: 'em chưa hiểu câu này' });
  if (r.status !== 200 || r.body.reply.includes(leakyText.slice(0, 40))) leaked.push(q.id);
  if (!(r.body.guard?.cau && r.body.guard?.dap_an && r.body.guard?.kiem_duyet)) badLetter.push(q.id + ' (guard ' + JSON.stringify(r.body.guard) + ')');
  if (judged.length && !judged.every(t => t.includes(`ĐÁP ÁN ĐÚNG: ${q.dap_an_dung}`) && t.includes(q.cau_hoi.slice(0, 40)))) badLetter.push(q.id);
}
ok(leaked.length === 0, `${allQ.length} câu ở ${lessons.length} bài: lời có đáp án không đến tay em (so chữ + AI kiểm duyệt)` + (leaked.length ? ': ' + leaked.join(', ') : ''));
ok(badLetter.length === 0, 'AI kiểm duyệt nhận đúng câu hỏi và đáp án của từng câu (tra từ kho đáp án riêng ở máy chủ)' + (badLetter.length ? ': ' + badLetter.join(', ') : ''));
// 4c. Lời gợi ý an toàn đi thẳng tới em ở mọi câu
const blocked = [];
for (const { l, q } of allQ) {
  const safe = 'Em đọc lại mục liên quan trong bài rồi tự đối chiếu các lựa chọn nhé. Em loại được lựa chọn nào trước, vì sao?';
  plan = { replies: [safe], safe, leaky: '' };
  const r = await call({ course_id: l.course, lesson_id: l.lesson, question_id: q.id, message: 'gợi ý giúp em' });
  if (r.body.reply !== safe) blocked.push(q.id);
}
ok(blocked.length === 0, `gợi ý an toàn đến tay em nguyên văn ở ${allQ.length} câu (không chặn nhầm)` + (blocked.length ? ': ' + blocked.join(', ') : ''));
ok(PAIR_LEAK_FALLBACK.length > 0, 'có lời thay thế an toàn khi phải chặn');
// 4d. Hỏi xác nhận "em nghĩ là <đáp án> đúng không?" ở mọi câu → trả lời mẫu, không qua AI, không "Chính xác!"
const confirmed = [];
for (const { l, q, correct } of allQ) {
  plan = { replies: ['Chính xác! ' + correct], safe: 'x', leaky: '' }; const before = plan.replies.length;
  const r = await call({ course_id: l.course, lesson_id: l.lesson, question_id: q.id, message: `em nghĩ là ${correct} đúng không?` });
  if (!r.body.answer_request || /chính xác|đúng rồi/i.test(r.body.reply) || plan.replies.length !== before) confirmed.push(q.id);
}
ok(confirmed.length === 0, `"em nghĩ là <đáp án> đúng không?" ở ${allQ.length} câu: trả lời mẫu "không xác nhận đúng hay sai khi em chưa nộp bài", không gọi AI` + (confirmed.length ? ': ' + confirmed.join(', ') : ''));
globalThis.fetch = real;
console.log('TUTOR ALL LESSONS OK ' + n);
