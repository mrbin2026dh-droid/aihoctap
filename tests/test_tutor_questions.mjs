// Gia sư AI tự nhận ra câu hỏi đang làm từ dữ liệu bài học; thêm câu mới không cần sửa mã.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_tq', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', {name:'Nam', grade:9, class_code:'9A'});
const mkQ = (id, prompt, topic) => ({id, prompt, topic, kind:'choice', options:{A:`${id} lựa chọn một`, B:`${id} lựa chọn hai`}, hint:''});
const lesson = {course_id:'tin9', lesson_id:'bai1', title:'Bài 1', content_markdown:'CPU là bộ xử lý trung tâm.', questions:[mkQ('q1','Câu MỘT là gì?','Phần cứng'), mkQ('q2','Câu HAI là gì?','Mạng')]};
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS', TEST_LESSONS:{'tin9:bai1':lesson}};
const call = async (path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:JSON.stringify(body)}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
const t = (await call('/login', {student_id:'hs_tq', pin:'123456'})).body.token;
const realFetch = globalThis.fetch; let captured = null;
globalThis.fetch = async (url, init) => { if (String(url).includes('generativelanguage')) { captured = JSON.parse(init.body); return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Em hãy xem lại phần CPU trong bài nhé. Theo em CPU làm nhiệm vụ gì?'}]}}]}), {status:200}); } return realFetch(url, init); };
const sysFor = async body => { captured = null; const r = await call('/pwa/tutor', {course_id:'tin9', lesson_id:'bai1', message:'Em chưa hiểu', ...body}, t); assert.equal(r.status, 200, JSON.stringify(r.body)); return captured.systemInstruction.parts[0].text; };
try {
  const s1 = await sysFor({question_id:'q1'});
  assert.ok(s1.includes('Câu MỘT là gì?') && !s1.includes('Câu HAI là gì?'), 'nhận đúng câu 1');
  assert.ok(s1.includes('Chủ đề kiến thức của câu hỏi: Phần cứng'));
  assert.ok(s1.includes('q1 lựa chọn một') && s1.includes('KHÔNG được đọc lại'), 'có các lựa chọn công khai kèm lệnh cấm lộ');
  const s2 = await sysFor({question_id:'q2', selected_option:'B'});
  assert.ok(s2.includes('Câu HAI là gì?') && !s2.includes('Câu MỘT là gì?'), 'nhận đúng câu 2');
  assert.ok(s2.includes('Học sinh đang tạm chọn B') && s2.includes('không nói chọn đúng hay sai'));
  const bad = await sysFor({question_id:'q2', selected_option:'Z'});
  assert.ok(!bad.includes('tạm chọn'), 'lựa chọn không tồn tại bị bỏ qua');
  // Giáo viên thêm câu 3 vào bài (chỉ đổi dữ liệu) -> gia sư tự biết
  lesson.questions.push(mkQ('q3', 'Câu BA là gì?', 'An toàn'));
  const s3 = await sysFor({question_id:'q3'});
  assert.ok(s3.includes('Câu BA là gì?') && s3.includes('An toàn'), 'câu mới được nhận ra, không cần sửa mã');
  const none = await sysFor({});
  assert.ok(!none.includes('CÂU HỎI HỌC SINH ĐANG LÀM'), 'hỏi chung thì không gắn câu hỏi');
  const unknown = await sysFor({question_id:'q99'});
  assert.ok(!unknown.includes('CÂU HỎI HỌC SINH ĐANG LÀM'), 'mã câu không có thì bỏ qua');
  assert.ok(!/correct_answer|Đáp án đúng/.test(JSON.stringify(captured)), 'không gửi đáp án');
} finally { globalThis.fetch = realFetch; }
console.log('TUTOR QUESTIONS OK');
