// Gia sư AI: căn cứ trả lời lấy từ bài học trên máy chủ (không tin trình duyệt), không gửi đáp án cho AI.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_tg', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', {name:'Nguyễn Văn Nam', grade:9, class_code:'9A'});
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  TEST_LESSONS:{'tin9:bai1':{course_id:'tin9', lesson_id:'bai1', title:'Bài 1', content_markdown:'CPU là bộ xử lý trung tâm của máy tính.', questions:[{id:'q1', prompt:'Bộ phận nào là bộ não?', options:{A:'CPU', B:'Màn hình'}}]}},
  TEST_PACKAGES_PRIVATE:{'tin9:bai1':{questions:[{id:'q1', correct_answer:'A'}]}}};
const call = async (path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:JSON.stringify(body)}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
const t = (await call('/login', {student_id:'hs_tg', pin:'123456'})).body.token;
const realFetch = globalThis.fetch; let captured = null;
globalThis.fetch = async (url, init) => { if (String(url).includes('generativelanguage')) { captured = JSON.parse(init.body); return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Em thử nghĩ xem bộ phận xử lý là gì?'}]}}]}), {status:200, headers:{'Content-Type':'application/json'}}); } return realFetch(url, init); };
try {
  const noToken = await call('/pwa/tutor', {course_id:'tin9', lesson_id:'bai1', message:'Giúp em'});
  assert.equal(noToken.status, 401, 'không có token phải bị từ chối');
  const ok = await call('/pwa/tutor', {course_id:'tin9', lesson_id:'bai1', question_id:'q1', message:'Câu này là gì?', context:{curriculum_text:'TRÌNH DUYỆT TỰ BỊA'}}, t);
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.ok(ok.body.reply);
  const sys = captured.systemInstruction.parts[0].text;
  assert.ok(sys.includes('CPU là bộ xử lý trung tâm'), 'phải có nội dung bài học từ máy chủ');
  assert.ok(sys.includes('Bộ phận nào là bộ não?'), 'phải có câu hỏi hiện tại từ máy chủ');
  assert.ok(!sys.includes('TRÌNH DUYỆT TỰ BỊA'), 'không tin nội dung do trình duyệt gửi khi đã có bài học trên máy chủ');
  assert.ok(sys.includes('Chỉ dùng thông tin trong TÀI LIỆU BÀI HỌC'), 'có quy tắc căn cứ');
  assert.ok(!/correct_answer|Đáp án đúng/.test(JSON.stringify(captured)), 'không gửi đáp án cho AI');
  assert.equal(captured.generationConfig.temperature, 0.3);
} finally { globalThis.fetch = realFetch; }
console.log('TUTOR GROUNDING OK');
