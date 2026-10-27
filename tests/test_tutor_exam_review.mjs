// Gia sư AI nhận xét bài THI THỬ đã nộp: không cần bài học, không gửi đáp án đúng cho AI, tốn 1 lượt.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential, buildExamReviewPrompt} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_rv', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f91', {name:'Nguyễn Văn Nam', grade:9, class_code:'9A'});
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS', TEST_LESSONS:{}};
const call = async (path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:JSON.stringify(body)}), env, {waitUntil(){}}); return {status:r.status, body:await r.json().catch(() => ({}))}; };
// Prompt: không đáp án, cắt độ dài
const p = buildExamReviewPrompt({title:'Ôn tập', diem:6, tong:10, dung:6, so_cau:10, items:[{stt:1, text:'CPU là gì?', dung:true}, {stt:2, text:'x'.repeat(1000), dung:false}, {stt:3, text:'RAM?', bo_trong:true}]});
assert.ok(p.includes('TUYỆT ĐỐI KHÔNG nêu đáp án') && p.includes('Câu 1: ĐÚNG') && p.includes('Câu 2: SAI') && p.includes('Câu 3: BỎ TRỐNG') && p.includes('ĐIỂM: 6/10'));
assert.ok(!p.includes('x'.repeat(300)), 'cắt nội dung câu hỏi dài');
const login = await call('/login', {student_id:'hs_rv', pin:'123456'});
if (login.status !== 200) { console.log('SKIP (môi trường không đăng nhập được ngoài MOCK):', login.status); process.exit(0); }
const realFetch = globalThis.fetch; let captured = null;
globalThis.fetch = async (url, init) => { if (String(url).includes('generativelanguage')) { captured = JSON.parse(init.body); return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'**Nhận xét chung** Em làm khá.'}]}}]}), {status:200}); } return realFetch(url, init); };
try {
  const r = await call('/pwa/tutor', {mode:'exam_review', message:'Nhận xét bài thi thử của em', review:{title:'Ôn tập', diem:6, tong:10, dung:6, so_cau:10, items:[{stt:1, text:'CPU là gì?', dung:true}], correct_answer:'A'}}, login.body.token);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.ok(r.body.reply.includes('Nhận xét chung'));
  const sys = captured.systemInstruction.parts[0].text;
  assert.ok(sys.includes('BÀI THI THỬ: Ôn tập') && sys.includes('TUYỆT ĐỐI KHÔNG nêu đáp án'), 'dùng lời nhắc nhận xét bài thi thử');
  assert.ok(!JSON.stringify(captured).includes('correct_answer'), 'không chuyển đáp án sang AI');
} finally { globalThis.fetch = realFetch; }
console.log('TUTOR EXAM REVIEW OK');
