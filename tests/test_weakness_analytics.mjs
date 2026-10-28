// Phân tích điểm yếu: lưu từng câu ở máy chủ, giáo viên xem báo cáo, học sinh chỉ thấy chủ đề cần ôn, không lộ câu đúng/sai.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential, createFirebaseCustomToken, analyzeAttempts, reviewTopicsForStudent} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const people = {hs_a:'Học sinh A', hs_b:'Học sinh B', hs_c:'Học sinh C'};
for (const [id, name] of Object.entries(people)) await registerStudentCredential(id, '123456', salt, {name, grade:9, class_code:'9A'});
const mkQ = (id, prompt, topic, extra={}) => ({id, prompt, topic, kind:'choice', options:{A:'Đúng A', B:'Sai B', C:'Sai C'}, hint:'', ...extra});
const lesson = {course_id:'tin9', lesson_id:'bai1', title:'Bài 1', content_markdown:'Nội dung bài 1.', questions:[mkQ('q1','Câu một?','Phần cứng'), mkQ('q2','Câu hai?','Phần cứng'), mkQ('q3','Câu ba?','Mạng')]};
const exam = {course_id:'tin9', lesson_id:'exam_1', title:'Kiểm tra 1', content_markdown:'KT', questions:[mkQ('q1','KT câu một?','Bảo mật')]};
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  TEST_LESSONS:{'tin9:bai1':lesson, 'tin9:exam_1':exam},
  TEST_PACKAGES_PRIVATE:{'tin9:bai1':{questions:[{id:'q1',correct_answer:'A'},{id:'q2',correct_answer:'A'},{id:'q3',correct_answer:'A'}]}, 'tin9:exam_1':{questions:[{id:'q1',correct_answer:'A'}]}}};
const call = async (method, path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method, headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body: body ? JSON.stringify(body) : undefined}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
const tok = async id => (await call('POST', '/login', {student_id:id, pin:'123456'})).body.token;
const submit = (t, lessonId, n, answers) => call('POST', '/pwa/attempts', {attempt_id:`att_${lessonId}_${n}`, course_id:'tin9', lesson_id:lessonId, answers, version:'v1'}, t);

const ta = await tok('hs_a'), tb = await tok('hs_b'), tc = await tok('hs_c');
const a1 = await submit(ta, 'bai1', 1, {q1:'B', q2:'C', q3:'A'});          // sai Phần cứng x2, đúng Mạng
assert.equal(a1.status, 200, JSON.stringify(a1.body));
assert.ok(!('per_question' in a1.body) && !('feedback' in a1.body), 'ack không được lộ từng câu');
await submit(tb, 'bai1', 1, {q1:'A', q3:'A'});                              // q2 bỏ trống
await submit(tc, 'bai1', 1, {q1:'B', q2:'B', q3:'B'});                      // sai hết, cùng chọn B
const ex = await submit(ta, 'exam_1', 1, {q1:'B'}); assert.equal(ex.status, 200, JSON.stringify(ex.body));

const admin = await createFirebaseCustomToken('teacher_admin_01', {role:'teacher', admin:true, name:'GV'}, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY_ID);
assert.equal((await call('GET', '/pwa/teacher/analytics')).status, 401, 'không token bị từ chối');
assert.equal((await call('GET', '/pwa/teacher/analytics', null, ta)).status, 403, 'học sinh không xem được báo cáo giáo viên');
const rep = await call('GET', '/pwa/teacher/analytics', null, admin);
assert.equal(rep.status, 200, JSON.stringify(rep.body));
const L = rep.body.lessons.find(l => l.lesson_id === 'bai1');
assert.equal(L.students, 3); assert.equal(L.attempts, 3);
assert.equal(L.avg_percent, Math.round((100*(1/3) + 100*(2/3) + 0) / 3), 'điểm trung bình lớp');
const q1 = L.questions.find(q => q.id === 'q1'), q2 = L.questions.find(q => q.id === 'q2'), q3 = L.questions.find(q => q.id === 'q3');
assert.deepEqual([q1.answered, q1.correct, q1.percent], [3, 1, 33]);
assert.deepEqual([q2.answered, q2.correct, q2.blank, q2.percent], [3, 0, 1, 0]);
assert.equal(q2.level, 'weak'); assert.equal(q3.level, 'fair');
assert.equal(q1.top_wrong.key, 'B'); assert.equal(q1.top_wrong.count, 2); assert.equal(q1.top_wrong.text, 'Sai B', 'đáp án sai phổ biến nhất');
assert.equal(L.questions[0].id, 'q2', 'câu yếu nhất xếp đầu');
assert.deepEqual(rep.body.classes, ['9A'], 'danh sách lớp để lọc'); assert.equal(rep.body.class_filter, null);
const sa = rep.body.students.find(x => x.uid === 'hs_a'); assert.ok(sa.items.length === 2 && sa.items[0].percent <= sa.items[1].percent && sa.last_at > 0, 'chi tiết từng bài của học sinh');
const none = await call('GET', '/pwa/teacher/analytics?class=ZZ', null, admin); assert.equal(none.body.total_attempts, 0, 'lọc lớp khác -> rỗng'); assert.equal(none.body.class_filter, 'ZZ');
assert.equal((await call('GET', '/pwa/teacher/analytics?class=9a', null, admin)).body.total_attempts, 4, 'lọc lớp không phân biệt hoa thường');
const hw = rep.body.topics.find(t => t.topic === 'Phần cứng'), net = rep.body.topics.find(t => t.topic === 'Mạng');
assert.deepEqual([hw.correct, hw.total, hw.percent], [1, 6, 17]); assert.equal(net.percent, 67);
assert.equal(rep.body.topics[0].topic, 'Bảo mật', 'chủ đề yếu nhất xếp đầu');
assert.equal(rep.body.students[0].name, 'Học sinh C', 'học sinh cần hỗ trợ nhất xếp đầu');
assert.deepEqual(rep.body.students.find(s => s.uid === 'hs_a').weak_topics.map(t => t.topic).sort(), ['Bảo mật', 'Phần cứng']);

// Học sinh: chỉ thấy chủ đề cần ôn của bài luyện tập, không thấy bài kiểm tra, không thấy từng câu
const prog = await call('GET', '/pwa/progress', null, ta);
assert.equal(prog.status, 200);
assert.ok(prog.body.attempts.every(x => !('per_question' in x) && !('student_name' in x)), 'tiến độ không lộ từng câu');
assert.deepEqual(prog.body.review.map(r => r.topic), ['Phần cứng'], 'chỉ gợi ý chủ đề luyện tập còn yếu');
assert.deepEqual([prog.body.review[0].correct, prog.body.review[0].total], [0, 2]);
assert.ok(!JSON.stringify(prog.body).includes('Câu một?'), 'không trả nội dung câu sai');
// Bản đồ năng lực: MỌI chủ đề (kể cả chủ đề đã vững), kèm bài để ôn; không có nội dung câu
assert.ok(Array.isArray(prog.body.mastery) && prog.body.mastery.length >= 1, 'progress trả mastery (bản đồ năng lực)');
assert.ok(prog.body.mastery.every(m => typeof m.percent === 'number' && m.total > 0 && Array.isArray(m.lessons) && m.lessons[0].lesson_id === 'bai1'), 'mỗi chủ đề có %, số câu, bài để ôn');
assert.ok(prog.body.mastery.length >= prog.body.review.length, 'mastery gồm cả chủ đề đã vững (review chỉ chủ đề yếu)');
// Học sinh B (đúng 2/3, có 1 câu bỏ trống thuộc Phần cứng): 1/2 Phần cứng
const progB = await call('GET', '/pwa/progress', null, tb);
assert.deepEqual([progB.body.review[0].topic, progB.body.review[0].percent], ['Phần cứng', 50]);

// Hàm thuần: dữ liệu cũ không có per_question vẫn không làm hỏng báo cáo
const legacy = analyzeAttempts([{uid:'x', course_id:'tin9', lesson_id:'bai1', correct:2, total:3, submitted_at:1}], {'tin9:bai1':lesson});
assert.equal(legacy.lessons[0].avg_percent, 67); assert.deepEqual(legacy.lessons[0].questions, []);
assert.deepEqual(reviewTopicsForStudent([{course_id:'tin9', lesson_id:'bai1', correct:2, total:3}], {'tin9:bai1':lesson}), []);
// Chỉ tính bài nộp mới nhất của mỗi học sinh
const two = analyzeAttempts([
  {uid:'x', course_id:'tin9', lesson_id:'bai1', correct:0, total:3, submitted_at:1, per_question:{q1:{ok:false,a:'B'}}},
  {uid:'x', course_id:'tin9', lesson_id:'bai1', correct:3, total:3, submitted_at:2, per_question:{q1:{ok:true,a:'A'}}}], {'tin9:bai1':lesson});
assert.equal(two.lessons[0].questions[0].percent, 100); assert.equal(two.lessons[0].attempts, 2);
console.log('WEAKNESS ANALYTICS OK');
