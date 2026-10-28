// Gia sư khi học sinh CHƯA chọn bài: tự tìm bài khớp câu hỏi nhất trong các bài của khối em và dùng làm căn cứ;
// không khớp bài nào → không gọi AI, không trừ lượt, mời chọn bài.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential, routeLesson} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_auto', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f94', {name:'An', grade:9, class_code:'9A'});
const LESSONS = {
  'tin9:b1': {course_id:'tin9', lesson_id:'b1', title:'Thế giới kĩ thuật số', content_markdown:'Bộ vi xử lí có trong máy tính, điện thoại, máy giặt thông minh.', questions:[]},
  'tin9:b2': {course_id:'tin9', lesson_id:'b2', title:'Mã nhị phân và đơn vị đo thông tin', content_markdown:'Mã nhị phân dùng hai kí hiệu 0 và 1. 1 byte gồm 8 bit.', questions:[]},
  'tin9:b3': {course_id:'tin9', lesson_id:'b3', title:'Đánh giá chất lượng thông tin', content_markdown:'Các tiêu chí: tính mới, tính chính xác, tính đầy đủ, tính sử dụng được.', questions:[]}};
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://aihoctap.online',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS', TEST_LESSONS:LESSONS};
const req = async (path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:body ? 'POST' : 'GET', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:body ? JSON.stringify(body) : undefined}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
const L = Object.values(LESSONS);
ok(routeLesson('1 byte bằng bao nhiêu bit?', L).index === 1, 'chọn đúng bài Mã nhị phân cho câu về byte/bit');
ok(routeLesson('Nồi cơm điện có bộ vi xử lí không?', L).index === 0, 'chọn đúng bài Thế giới kĩ thuật số');
ok(routeLesson('tính chính xác của thông tin là gì', L).index === 2, 'chọn đúng bài Đánh giá chất lượng thông tin');
ok(routeLesson('bit', L).index === 1, 'câu hỏi 1 từ khóa hiếm vẫn tìm được bài');
ok(routeLesson('Hôm nay trời đẹp quá, đi chơi không?', L).index === -1 && routeLesson('', L).index === -1, 'câu không liên quan / rỗng → không chọn bài nào');
let sys = ''; const realFetch = globalThis.fetch; let calls = 0;
globalThis.fetch = async (u, o) => { if (String(u).includes('generativelanguage')) { calls++; sys = JSON.parse(o.body).systemInstruction.parts[0].text; return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Em thử nhớ lại 1 byte có mấy bit nhé?'}]}}]}), {status:200}); } return realFetch(u, o); };
try {
  const t = (await req('/login', {student_id:'hs_auto', pin:'123456'})).body.token; ok(!!t, 'đăng nhập');
  const cands = [{course_id:'tin9', lesson_id:'b1'}, {course_id:'tin9', lesson_id:'b2'}, {course_id:'tin9', lesson_id:'b3'}, {course_id:'tin9', lesson_id:'khong_co'}, {course_id:'../x', lesson_id:'y'}];
  const q0 = (await req('/pwa/ai-quota', null, t)).body.used;
  const r = await req('/pwa/tutor', {message:'1 byte bằng bao nhiêu bit?', candidates:cands}, t);
  ok(r.status === 200 && r.body.lesson?.lesson_id === 'b2' && r.body.lesson.title.includes('Mã nhị phân'), 'chưa chọn bài → máy chủ tự chọn bài Mã nhị phân, báo lại cho app');
  ok(sys.includes('1 byte gồm 8 bit') && sys.includes('TÀI LIỆU BÀI HỌC'), 'Gia sư trả lời dựa trên nội dung đúng bài đó (không bịa)');
  const before = calls; const q1 = (await req('/pwa/ai-quota', null, t)).body.used;
  const r2 = await req('/pwa/tutor', {message:'Hôm nay trời đẹp, đi chơi không?', candidates:cands}, t);
  ok(r2.status === 200 && r2.body.no_match && calls === before && (await req('/pwa/ai-quota', null, t)).body.used === q1, 'không khớp bài nào → không gọi AI, không trừ lượt, mời chọn bài');
  ok(q1 === q0 + 1, 'câu tìm được bài vẫn tính 1 lượt như bình thường');
  const r3 = await req('/pwa/tutor', {course_id:'tin9', lesson_id:'b3', message:'Tính mới là gì?'}, t);
  ok(r3.status === 200 && !r3.body.lesson && sys.includes('tính sử dụng được'), 'đã chọn bài thì dùng đúng bài đã chọn như cũ');
} finally { globalThis.fetch = realFetch; }
console.log('TUTOR AUTO LESSON OK', n);
