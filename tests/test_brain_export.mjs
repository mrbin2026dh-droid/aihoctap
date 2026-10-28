// Bộ não AI (VPS): Worker ghi học sinh hỏi Gia sư gì (rút gọn, không ghi câu trả lời) và chỉ cho máy chủ có BRAIN_KEY lấy về.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_br', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f92', {name:'Lê Bình', grade:9, class_code:'9B'});
const KEY = 'brain-key-0123456789abcdefXYZ';
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io', BRAIN_KEY:KEY,
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  TEST_LESSONS:{'tin9:bai1':{course_id:'tin9', lesson_id:'bai1', title:'Bài 1', content_markdown:'Bit là đơn vị nhỏ nhất.', questions:[]}}};
const req = async (path, o = {}) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:o.method || 'GET', headers:{'Content-Type':'application/json', ...(o.headers || {})}, body:o.body ? JSON.stringify(o.body) : undefined}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, i) => String(u).includes('generativelanguage') ? new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Bit là đơn vị nhỏ nhất của thông tin.'}]}}]}), {status:200}) : realFetch(u, i);
try {
  const t = (await req('/login', {method:'POST', body:{student_id:'hs_br', pin:'123456'}})).body.token;
  const t0 = Date.now() - 1;
  assert.equal((await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t}, body:{course_id:'tin9', lesson_id:'bai1', message:'Bit và byte khác nhau thế nào ạ?'}})).status, 200);
  assert.equal((await req('/brain/export')).status, 403, 'không có khóa → từ chối');
  assert.equal((await req('/brain/export', {headers:{'X-Brain-Key':'sai-khoa-0123456789abcdefgh'}})).status, 403, 'sai khóa → từ chối');
  const ex = await req('/brain/export?since=' + t0, {headers:{'X-Brain-Key':KEY}});
  assert.equal(ex.status, 200); const it = ex.body.items.at(-1);
  assert.ok(it.uid === 'hs_br' && it.lop === '9B' && it.lesson === 'bai1' && it.q.includes('Bit và byte') && it.blocked === false && !JSON.stringify(ex.body).includes('đơn vị nhỏ nhất của thông tin'), 'ghi câu hỏi + lớp + bài, không ghi câu trả lời');
  assert.equal((await req('/brain/export?since=' + (Date.now() + 1000), {headers:{'X-Brain-Key':KEY}})).body.items.length, 0, 'lấy tăng dần theo mốc thời gian');
  await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t}, body:{mode:'exam_review', message:'Nhận xét', review:{title:'T', items:[]}}});
  assert.equal((await req('/brain/export?since=' + t0, {headers:{'X-Brain-Key':KEY}})).body.items.length, 1, 'nhận xét bài thi không ghi vào nhật ký câu hỏi');
} finally { globalThis.fetch = realFetch; }
console.log('BRAIN EXPORT OK');
