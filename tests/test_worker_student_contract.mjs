// Hợp đồng ứng dụng học sinh <-> Worker thật (chế độ thử): mọi trường mà app.js đọc phải có mặt.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('hs_ct', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', {name:'Nguyễn Văn Nam', grade:9, class_code:'9A'});
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, ALLOWED_ORIGIN:'https://mrbin2026dh-droid.github.io',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  TEST_CATALOG:{schema_version:1, revision:'r1', courses:[{id:'tin9', subject_id:'tin-hoc', subject_name:'Tin học', title:'Tin học 9', grade:9, lessons:[{id:'bai1', title:'Bài 1', version:'v1', question_count:2}]}]},
  TEST_LESSONS:{'tin9:bai1':{course_id:'tin9', lesson_id:'bai1', version:'v1', title:'Bài 1', content_markdown:'# Bài 1', questions:[{id:'q1', prompt:'Hỏi 1', kind:'choice', options:{A:'a', B:'b'}}, {id:'q2', prompt:'Hỏi 2', kind:'choice', options:{A:'a', B:'b'}}]}},
  TEST_PACKAGES_PRIVATE:{'tin9:bai1':{questions:[{id:'q1', correct_answer:'A', hint:'Nghĩ lại.'}, {id:'q2', correct_answer:'B'}]}}};
const call = async (path, o = {}, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:o.method || 'GET', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:o.body ? JSON.stringify(o.body) : undefined}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
const login = await call('/login', {method:'POST', body:{student_id:'hs_ct', pin:'123456'}});
assert.equal(login.status, 200); assert.ok(login.body.token); const t = login.body.token;
const me = await call('/pwa/me', {}, t); assert.equal(me.status, 200);
for (const k of ['uid', 'student_name', 'class_code', 'grade']) assert.ok(me.body[k] !== undefined, '/pwa/me thiếu ' + k + ': ' + JSON.stringify(me.body));
const cat = await call('/pwa/catalog'); assert.equal(cat.status, 200); assert.ok(Array.isArray(cat.body.courses));
const les = await call('/pwa/lessons/tin9/bai1/v1', {}, t); assert.equal(les.status, 200, JSON.stringify(les.body));
for (const k of ['course_id', 'lesson_id', 'version', 'title', 'content_markdown', 'questions']) assert.ok(les.body[k] !== undefined, 'lesson thiếu ' + k);
assert.ok(!JSON.stringify(les.body).includes('correct_answer'), 'bài học công khai không được lộ đáp án');
const att = await call('/pwa/attempts', {method:'POST', body:{attempt_id:'a1', course_id:'tin9', lesson_id:'bai1', version:'v1', answers:{q1:'B', q2:'B'}}}, t);
assert.equal(att.status, 200, JSON.stringify(att.body));
for (const k of ['attempt_id', 'status', 'correct', 'total']) assert.ok(att.body[k] !== undefined, 'ack thiếu ' + k);
assert.equal(att.body.status, 'submitted'); assert.equal(att.body.version, 'v1');
assert.equal(att.body.feedback, undefined, 'không được lộ đúng/sai từng câu (chống dò đáp án)');
assert.equal(att.body.correct, 1);
assert.ok(!JSON.stringify(att.body).includes('correct_answer'), 'không được gửi đáp án');
const again = await call('/pwa/attempts', {method:'POST', body:{attempt_id:'a1', course_id:'tin9', lesson_id:'bai1', version:'v1', answers:{q1:'B', q2:'B'}}}, t);
assert.equal(again.status, 200, 'nộp lại cùng attempt_id phải idempotent: ' + JSON.stringify(again.body));
const prog = await call('/pwa/progress', {}, t); assert.equal(prog.status, 200); assert.ok(Array.isArray(prog.body.attempts));
const q = await call('/pwa/ai-quota', {}, t); assert.equal(q.status, 200, JSON.stringify(q.body));
for (const k of ['used', 'limit', 'remaining', 'locked']) assert.ok(q.body[k] !== undefined, 'ai-quota thiếu ' + k);
console.log('WORKER STUDENT CONTRACT OK');
