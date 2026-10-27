// AI cho giáo viên: soạn câu hỏi theo ma trận (bám bài học, câu hợp lệ, xáo đáp án, giáo viên lớp xác minh qua Sheet, giới hạn lượt)
// và gợi ý chấm thực hành theo tiêu chí; Gia sư biết chủ đề yếu; nhận xét thi thử theo chủ đề.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential, cleanGeneratedQuestions, parseJsonLoose, buildExamReviewPrompt, weakTopicsLine, buildQuestionGenPrompt} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_ai', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f91', {name:'Nguyễn Văn Nam', grade:9, class_code:'9A'});
let prompts = [], gen = () => '[]';
const SHEET = 'https://script.google.com/macros/s/TEST/exec';
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io', SHEET_LOGIN_URL:SHEET, TEACHER_AI_DAILY:3,
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  MOCK_GEMINI: p => { prompts.push(p); return gen(p); },
  TEST_LESSONS:{'tin9:bai1':{course_id:'tin9', lesson_id:'bai1', title:'Thế giới kĩ thuật số', content_markdown:'# Bài 1\nCPU là bộ xử lý trung tâm. Bit là đơn vị nhỏ nhất.', questions:[]}}};
const realFetch = globalThis.fetch; const sheetCalls = [];
globalThis.fetch = async (u, o) => { if (String(u).startsWith(SHEET)) { const b = JSON.parse(o.body); sheetCalls.push(b); return new Response(JSON.stringify(b.ma === 'GV01' && b.pin === '111111' ? {ok:true, teacher:{ma:'GV01', ten:'Cô Hoa', lop:['9A']}} : {ok:false, error:'Mã giáo viên hoặc PIN chưa đúng.'}), {status:200}); } return realFetch(u, o); };
const call = async (path, body, headers = {}) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:'POST', headers:{'Content-Type':'application/json', ...headers}, body:JSON.stringify(body)}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
const ADMIN = {'X-Admin-Secret':'TEST_SECRET_KEY_AT_LEAST_16_CHARS'};
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
try {
  // hàm thuần
  const q4 = cleanGeneratedQuestions([
    {text:'CPU là gì?', options:{A:'Bộ xử lý', B:'Bộ nhớ', C:'Màn hình', D:'Chuột'}, answer:'A', level:'Biết', topic:'Phần cứng', explain:'CPU xử lý lệnh'},
    {text:'Thiếu phương án', options:{A:'x', B:'y'}, answer:'A'},
    {text:'Trùng phương án', options:{A:'x', B:'x', C:'y', D:'z'}, answer:'A'},
    {text:'Đáp án lạ', options:{A:'1', B:'2', C:'3', D:'4'}, answer:'E'},
    {text:'cpu là gì?', options:{A:'1', B:'2', C:'3', D:'4'}, answer:'B'}], () => 0.5);
  ok(q4.length === 1 && q4[0].options[q4[0].answer] === 'Bộ xử lý' && q4[0].level === 'Biết' && q4[0].ai === true, 'lọc câu AI soạn: bỏ câu thiếu/trùng phương án, đáp án lạ, câu trùng; giữ đúng đáp án sau khi xáo');
  let seq = [0.9, 0.1, 0.5, 0.3], i = 0; const moved = cleanGeneratedQuestions([{text:'Q', options:{A:'đúng', B:'b', C:'c', D:'d'}, answer:'A'}], () => seq[i++ % 4]);
  ok(moved[0].answer !== 'A' && moved[0].options[moved[0].answer] === 'đúng', 'xáo vị trí đáp án đúng (AI hay dồn vào A)');
  ok(parseJsonLoose('```json\n[{"a":1}]\n```')[0].a === 1 && parseJsonLoose('Đây: {"items":[1]} xong').items[0] === 1, 'đọc JSON lẫn chữ');
  const pr = buildQuestionGenPrompt({title:'B1', content:'CPU', counts:{'Biết':2, 'Hiểu':1, 'Vận dụng':1}});
  ok(pr.includes('Biết: 2 câu') && pr.includes('Vận dụng: 1 câu') && pr.includes('CPU'), 'prompt có ma trận + tài liệu bài học');
  const rv = buildExamReviewPrompt({title:'T', items:[{stt:1, text:'a', dung:true, topic:'Mã nhị phân'}, {stt:2, text:'b', dung:false, topic:'Mã nhị phân'}, {stt:3, text:'c', dung:false, topic:'Dữ liệu số'}]});
  ok(rv.includes('Mã nhị phân: đúng 1/2 câu (50%)') && rv.includes('Dữ liệu số: đúng 0/1') && rv.includes('[Mã nhị phân]'), 'nhận xét thi thử: tổng hợp theo chủ đề');
  ok(weakTopicsLine(['Mã nhị phân (40%)', '', 'x"\ny']).includes('Mã nhị phân (40%); x  y') && weakTopicsLine([]) === '', 'dòng chủ đề yếu cho Gia sư (lọc ký tự lạ)');

  // endpoint soạn đề
  ok((await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':1}})).status === 403, 'chưa đăng nhập giáo viên → từ chối');
  ok((await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':1}, gv_ma:'GV01', gv_pin:'sai'})).status === 403, 'giáo viên lớp sai PIN → từ chối (Sheet xác minh)');
  gen = () => JSON.stringify([{text:'Bit là gì?', options:{A:'Đơn vị nhỏ nhất', B:'Bộ nhớ', C:'Ổ cứng', D:'CPU'}, answer:'A', level:'Biết', topic:'Mã nhị phân', explain:'Theo bài'}]);
  const r1 = await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':1, 'Hiểu':0}}, ADMIN);
ok(r1.status === 200 && r1.body.questions.length === 1 && r1.body.questions[0].topic === 'Mã nhị phân' && r1.body.questions[0].options[r1.body.questions[0].answer] === 'Đơn vị nhỏ nhất', 'quản trị: AI soạn câu hợp lệ kèm chủ đề, mức độ');
  ok(prompts.at(-1).includes('Bit là đơn vị nhỏ nhất') && prompts.at(-1).includes('Biết: 1 câu'), 'AI soạn bám nội dung bài học thật trên máy chủ');
  ok((await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':0}}, ADMIN)).status === 400, 'không chọn câu nào → báo');
  ok((await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'khong-co', counts:{'Biết':1}}, ADMIN)).status === 404, 'bài không có → báo');
  const r2 = await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Hiểu':2}, gv_ma:'GV01', gv_pin:'111111'});
  ok(r2.status === 200 && sheetCalls.some(c => c.action === 'gv_login' && c.ma === 'GV01'), 'giáo viên lớp dùng được (Mã + PIN xác minh qua Google Sheet)');
  gen = () => 'không phải JSON';
  ok((await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':1}, gv_ma:'GV01', gv_pin:'111111'})).status === 502, 'AI trả rác → báo thử lại, không lưu câu lỗi');
  await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':1}, gv_ma:'GV01', gv_pin:'111111'});
  ok((await call('/teacher/ai-questions', {course_id:'tin9', lesson_id:'bai1', counts:{'Biết':1}, gv_ma:'GV01', gv_pin:'111111'})).status === 429, 'quá số lượt AI trong ngày → báo (mỗi giáo viên riêng)');

  // gợi ý chấm thực hành
  gen = () => JSON.stringify({items:[{diem:9, nhan_xet:'Dùng đúng hàm SUM'}, {diem:0.6, nhan_xet:'Chưa định dạng'}], tong_ket:'Em làm khá tốt.'});
  const p1 = await call('/teacher/ai-practical', {kind:'excel', task:'Tính tổng', rubric:[{mo_ta:'Dùng hàm SUM', diem:2}, {mo_ta:'Định dạng', diem:1}], evidence:'D11: =SUM(D2:D10)', auto:[{mo_ta:'D11 có SUM', ok:true}]}, ADMIN);
  ok(p1.status === 200 && p1.body.items[0].diem === 2 && p1.body.items[1].diem === 0.5 && p1.body.tong_ket, 'gợi ý điểm từng tiêu chí, không vượt điểm tối đa, làm tròn 0,25');
  ok(prompts.at(-1).includes('D11 có SUM: ĐẠT') && prompts.at(-1).includes('=SUM(D2:D10)') && prompts.at(-1).includes('Giáo viên sẽ duyệt'), 'AI dựa trên bằng chứng + kết quả kiểm tra tự động; giáo viên quyết định');
  ok((await call('/teacher/ai-practical', {kind:'excel', rubric:[]}, ADMIN)).status === 400, 'chưa có tiêu chí → báo');

  // Gia sư nhận chủ đề yếu
  delete env.SHEET_LOGIN_URL; const t = (await call('/login', {student_id:'hs_ai', pin:'123456'})).body.token;
  let sys = null; globalThis.fetch = async (u, o) => { if (String(u).includes('generativelanguage')) { sys = JSON.parse(o.body).systemInstruction.parts[0].text; return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Bit là đơn vị nhỏ nhất của thông tin.'}]}}]}), {status:200}); } return realFetch(u, o); };
  const tr = await call('/pwa/tutor', {course_id:'tin9', lesson_id:'bai1', message:'Bit là gì?', context:{weak_topics:['Mã nhị phân (40%)']}}, {Authorization:'Bearer ' + t});
  ok(tr.status === 200 && sys.includes('BẢN ĐỒ NĂNG LỰC') && sys.includes('Mã nhị phân (40%)'), 'Gia sư biết em còn yếu chủ đề nào (từ Bản đồ năng lực)');
} finally { globalThis.fetch = realFetch; }
console.log('TEACHER AI OK', n);
