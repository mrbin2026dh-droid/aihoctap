// Bài kiểm tra Thử/Thật phía máy chủ: tạo đề, giao theo lớp, phiên có hạn, lưu nháp, nộp, chấm điểm từng câu, giới hạn lượt, hết giờ.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential, createFirebaseCustomToken} from '../worker/index.js';
import {validateExamInput, questionOrder, gradeExam, examState} from '../worker/exams.js';

// ---------- Hàm thuần ----------
const mkQ = (i, over = {}) => ({id: 'q' + i, kind: 'choice', prompt: 'Câu ' + i + '?', options: {A: 'Đúng', B: 'Sai', C: 'Sai nữa'}, correct_answer: 'A', points: 1, topic: i % 2 ? 'Phần cứng' : 'Mạng', hint: '', ...over});
const base = (over = {}) => ({title: 'Kiểm tra 15 phút', grade: 9, mode: 'real', kind: '15m', minutes: 15, opens_at: 1000, closes_at: 1000 + 3_600_000, max_attempts: 1, shuffle: false, reveal: 'after-submit', status: 'open', questions: [mkQ(1), mkQ(2)], ...over});
assert.ok(validateExamInput(base()).exam);
for (const [label, over, re] of [
  ['thiếu tiêu đề', {title: ''}, /tiêu đề/], ['lớp sai', {grade: 5}, /Lớp/], ['hình thức sai', {mode: 'x'}, /Thử hoặc Thật/], ['thiếu phút', {minutes: 0}, /Thời gian/],
  ['đóng trước mở', {closes_at: 500}, /Giờ đóng/], ['khoảng ngắn hơn thời lượng', {minutes: 120}, /ngắn hơn/], ['lần làm', {max_attempts: 0}, /Số lần làm/], ['không câu', {questions: []}, /chưa có câu/],
  ['điểm 0', {questions: [mkQ(1, {points: 0})]}, /điểm phải lớn hơn 0/], ['điểm 3 số lẻ', {questions: [mkQ(1, {points: 0.333})]}, /2 chữ số/],
  ['đáp án ngoài lựa chọn', {questions: [mkQ(1, {correct_answer: 'D'})]}, /đáp án đúng/], ['một lựa chọn', {questions: [mkQ(1, {options: {A: 'x'}})]}, /ít nhất 2/], ['trùng mã', {questions: [mkQ(1), mkQ(1)]}, /trùng/]
]) assert.match(validateExamInput(base(over)).error || '', re, label);
assert.ok(validateExamInput({...base({mode: 'trial'}), minutes: undefined, opens_at: undefined, closes_at: undefined}).exam, 'đề thử không cần giờ');
const ex = validateExamInput(base({shuffle: true, questions: Array.from({length: 8}, (_, i) => mkQ(i + 1))})).exam;
assert.deepEqual(questionOrder(ex, 'a'), questionOrder(ex, 'a'), 'cùng seed cùng thứ tự');
assert.notDeepEqual(questionOrder(ex, 'a'), questionOrder(ex, 'b'), 'khác seed khác thứ tự');
assert.deepEqual([...questionOrder(ex, 'a')].sort(), ex.questions.map(q => q.id).sort(), 'không mất câu');
assert.equal(examState({status: 'open', mode: 'real', opens_at: 10, closes_at: 20}, 5), 'upcoming');
assert.equal(examState({status: 'open', mode: 'real', opens_at: 10, closes_at: 20}, 25), 'closed');
assert.equal(examState({status: 'draft', mode: 'trial'}, 0), 'draft');

// ---------- Máy chủ ----------
const kp = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const people = {ha: ['Học sinh A', 9, '9A'], hb: ['Học sinh B', 9, '9A'], hc: ['Học sinh C', 9, '9B'], hd: ['Học sinh D', 8, '8A']};
for (const [id, [name, grade, cls]] of Object.entries(people)) await registerStudentCredential(id, '123456', salt, {name, grade, class_code: cls});
const env = {GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, GEMINI_API_KEY: 'k', ALLOWED_ORIGIN: 'https://x.github.io',
  FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'};
const call = async (method, path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: body ? JSON.stringify(body) : undefined}), env); return {status: r.status, body: await r.json().catch(() => ({}))}; };
const login = async id => (await call('POST', '/login', {student_id: id, pin: '123456'})).body.token;
const [ta, tb, tc, td] = await Promise.all(['ha', 'hb', 'hc', 'hd'].map(login));
const admin = await createFirebaseCustomToken('teacher_admin_01', {role: 'teacher', admin: true, name: 'GV'}, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY_ID);
const realNow = Date.now; let offset = 0; Date.now = () => realNow() + offset;
try {
  const T0 = Date.now();
  // Quyền
  assert.equal((await call('POST', '/pwa/teacher/exams', base())).status, 401);
  assert.equal((await call('POST', '/pwa/teacher/exams', base(), ta)).status, 403, 'học sinh không tạo được đề');
  assert.equal((await call('GET', '/pwa/exams')).status, 401);
  assert.equal((await call('POST', '/pwa/teacher/exams', {...base(), questions: [mkQ(1, {points: 0})]}, admin)).status, 400);

  // Đề thật: 8 câu trắc nghiệm 1 điểm + 1 tự luận 2 điểm = 10 điểm; lớp 9A; trộn câu; tối đa 2 lần; 30 phút
  const questions = [...Array.from({length: 8}, (_, i) => mkQ(i + 1)), {id: 'tl1', kind: 'text', prompt: 'Giải thích.', options: {}, points: 2, topic: 'Thiết bị số'}];
  const draft = await call('POST', '/pwa/teacher/exams', {...base({questions, shuffle: true, minutes: 30, opens_at: T0 - 60_000, closes_at: T0 + 3_600_000, max_attempts: 2, class_codes: ['9A'], status: 'draft'})}, admin);
  assert.equal(draft.status, 200, JSON.stringify(draft.body)); const id = draft.body.exam_id; assert.match(id, /^exam_[a-f0-9]{12}$/);
  assert.deepEqual((await call('GET', '/pwa/exams', null, ta)).body.exams, [], 'đề nháp học sinh không thấy');
  assert.equal((await call('POST', `/pwa/teacher/exams/${id}/status`, {status: 'bad'}, admin)).status, 400);
  assert.equal((await call('POST', `/pwa/teacher/exams/${id}/status`, {status: 'open'}, admin)).status, 200);
  const edit = await call('GET', `/pwa/teacher/exams/${id}`, null, admin);
  assert.equal(edit.body.questions[0].correct_answer, 'A', 'giáo viên xem được đáp án để sửa');
  const listT = (await call('GET', '/pwa/teacher/exams', null, admin)).body.exams; assert.equal(listT[0].state, 'open'); assert.equal(listT[0].total_points, 10); assert.equal(listT[0].submissions, 0);

  // Giao đúng đối tượng
  const la = (await call('GET', '/pwa/exams', null, ta)).body.exams;
  assert.equal(la.length, 1); assert.equal(la[0].state, 'open'); assert.equal(la[0].attempts_left, 2); assert.ok(!JSON.stringify(la).includes('correct_answer'));
  assert.deepEqual((await call('GET', '/pwa/exams', null, tc)).body.exams, [], 'khác lớp học không thấy');
  assert.deepEqual((await call('GET', '/pwa/exams', null, td)).body.exams, [], 'khác khối không thấy');
  assert.equal((await call('POST', '/pwa/exams/start', {exam_id: id}, tc)).status, 404, 'khác lớp không vào được');

  // Bắt đầu thi: không lộ đáp án, trộn riêng từng học sinh, vào lại thì tiếp tục đúng phiên
  const sa = await call('POST', '/pwa/exams/start', {exam_id: id}, ta); assert.equal(sa.status, 200, JSON.stringify(sa.body));
  assert.equal(sa.body.questions.length, 9); assert.equal(sa.body.deadline - sa.body.started_at, 30 * 60_000, 'đồng hồ do máy chủ tính'); assert.equal(sa.body.resumed, false);
  assert.ok(sa.body.questions.every(q => !('correct_answer' in q)), 'đề gửi học sinh không có đáp án');
  const sb = await call('POST', '/pwa/exams/start', {exam_id: id}, tb);
  assert.notDeepEqual(sa.body.questions.map(q => q.id), sb.body.questions.map(q => q.id), 'mỗi học sinh một thứ tự');
  const again = await call('POST', '/pwa/exams/start', {exam_id: id}, ta); assert.equal(again.body.resumed, true); assert.equal(again.body.attempt_id, sa.body.attempt_id); assert.deepEqual(again.body.questions.map(q => q.id), sa.body.questions.map(q => q.id));

  // Lưu nháp: lọc dữ liệu rác
  const saved = await call('PUT', '/pwa/exams/save', {exam_id: id, attempt_id: sa.body.attempt_id, answers: {q1: 'a', q2: 'B', q3: 'Z', zzz: 'A', tl1: 'Máy tính có CPU.'}}, ta);
  assert.equal(saved.status, 200);
  assert.equal((await call('PUT', '/pwa/exams/save', {exam_id: id, attempt_id: 'khac', answers: {}}, ta)).status, 409, 'sai mã phiên');
  const resume = await call('POST', '/pwa/exams/start', {exam_id: id}, ta); assert.deepEqual(resume.body.answers, {q1: 'A', q2: 'B', tl1: 'Máy tính có CPU.'}, 'khôi phục bài đã lưu, bỏ câu không hợp lệ');

  // Nộp: q1..q6 đúng (6 điểm); q7, q8 bỏ trống; tự luận chưa chấm -> 6/10
  const answers = {q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A', q6: 'A', tl1: 'Máy tính có CPU.'};
  const done = await call('POST', '/pwa/exams/submit', {exam_id: id, attempt_id: sa.body.attempt_id, answers}, ta);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.deepEqual([done.body.earned, done.body.total_points, done.body.score, done.body.correct, done.body.total, done.body.needs_review], [6, 10, 6, 6, 8, true]);
  assert.equal(done.body.answers_key.q1, 'A', 'cấu hình hiện đáp án sau nộp'); assert.ok(!('per_question' in done.body));
  const dup = await call('POST', '/pwa/exams/submit', {exam_id: id, attempt_id: sa.body.attempt_id, answers: {q1: 'B'}}, ta);
  assert.equal(dup.body.score, 6, 'nộp lại cùng phiên trả cùng kết quả'); assert.equal((await call('GET', '/pwa/exams', null, ta)).body.exams[0].attempts_used, 1);
  // Lần 2 được, lần 3 bị chặn
  const s2 = await call('POST', '/pwa/exams/start', {exam_id: id}, ta); assert.equal(s2.status, 200); assert.notEqual(s2.body.attempt_id, sa.body.attempt_id);
  await call('POST', '/pwa/exams/submit', {exam_id: id, attempt_id: s2.body.attempt_id, answers: {q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A', q6: 'A', q7: 'A', q8: 'A'}}, ta);
  const s3 = await call('POST', '/pwa/exams/start', {exam_id: id}, ta); assert.equal(s3.status, 403); assert.match(s3.body.detail, /hết số lần/);
  const l3 = (await call('GET', '/pwa/exams', null, ta)).body.exams[0]; assert.deepEqual([l3.attempts_used, l3.attempts_left, l3.best_score], [2, 0, 8]);
  assert.equal((await call('GET', `/pwa/exams/review?exam_id=${id}`, null, ta)).body.answers_key.q2, 'A');

  // Dữ liệu tách khỏi luyện tập; báo cáo giáo viên có điểm yếu của đề
  const prog = await call('GET', '/pwa/progress', null, ta); assert.ok(prog.body.attempts.every(x => !x.exam_id), 'tiến độ luyện tập không lẫn bài thi');
  const rep = (await call('GET', '/pwa/teacher/analytics', null, admin)).body; const L = rep.lessons.find(l => l.lesson_id === id);
  assert.ok(L, 'báo cáo gồm đề kiểm tra'); assert.equal(L.title, 'Kiểm tra 15 phút'); assert.equal(L.questions.find(q => q.id === 'q7').correct, 1, 'báo cáo lấy lần nộp mới nhất của học sinh');
  assert.ok(rep.topics.some(t => t.topic === 'Phần cứng'), 'chủ đề của câu hỏi được tính');
  assert.equal((await call('GET', '/pwa/teacher/exams', null, admin)).body.exams[0].submissions, 2);

  // Hết giờ: nộp muộn chỉ tính phần đã lưu; phiên bỏ dở được máy chủ tự nộp
  const sb2 = sb.body; await call('PUT', '/pwa/exams/save', {exam_id: id, attempt_id: sb2.attempt_id, answers: {q1: 'A', q2: 'A'}}, tb);
  offset = 30 * 60_000 + 20_000; // quá hạn nhưng còn trong ân hạn 30 giây
  const okGrace = await call('PUT', '/pwa/exams/save', {exam_id: id, attempt_id: sb2.attempt_id, answers: {q1: 'A', q2: 'A', q3: 'A'}}, tb); assert.equal(okGrace.status, 200, 'trong ân hạn vẫn lưu được');
  offset = 30 * 60_000 + 40_000; // quá ân hạn
  assert.equal((await call('PUT', '/pwa/exams/save', {exam_id: id, attempt_id: sb2.attempt_id, answers: {q1: 'A'}}, tb)).status, 403, 'quá ân hạn không lưu nữa');
  const late = await call('POST', '/pwa/exams/submit', {exam_id: id, attempt_id: sb2.attempt_id, answers: {q1: 'A', q2: 'A', q3: 'A', q4: 'A', q5: 'A', q6: 'A', q7: 'A', q8: 'A'}}, tb);
  assert.equal(late.status, 200); assert.equal(late.body.late, true); assert.equal(late.body.correct, 3, 'chỉ tính 3 câu đã lưu, bỏ đáp án gửi muộn');
  offset = 0;
  // Phiên bỏ dở: học sinh không nộp, quá hạn rồi vào lại -> bài cũ được tự nộp
  const sc = await call('POST', '/pwa/exams/start', {exam_id: id}, tb); assert.equal(sc.status, 200);
  await call('PUT', '/pwa/exams/save', {exam_id: id, attempt_id: sc.body.attempt_id, answers: {q1: 'A'}}, tb);
  assert.equal((await call('GET', '/pwa/exams', null, tb)).body.exams[0].attempts_used, 1);
  offset = 40 * 60_000;
  const lb = (await call('GET', '/pwa/exams', null, tb)).body.exams[0]; assert.equal(lb.in_progress, false);
  const re = await call('POST', '/pwa/exams/start', {exam_id: id}, tb);
  assert.equal(re.status, 403, 'sau giờ đóng phiên bỏ dở được tự nộp và không mở lượt mới');
  offset = 0;
  const attemptsB = (await call('GET', '/pwa/teacher/exams', null, admin)).body.exams[0].submissions; assert.equal(attemptsB, 4, 'bài bỏ dở đã được tự nộp (2 của A + 2 của B)');

  // Chưa mở / đã đóng
  await call('POST', '/pwa/teacher/exams', {...base({questions: [mkQ(1)], opens_at: T0 + 3_600_000, closes_at: T0 + 7_200_000, minutes: 30, status: 'open'}), exam_id: 'exam_sau'}, admin);
  assert.equal((await call('POST', '/pwa/exams/start', {exam_id: 'exam_sau'}, ta)).body.detail, 'Bài kiểm tra chưa đến giờ mở.');
  const closedExam = await call('POST', '/pwa/teacher/exams', {...base({questions: [mkQ(1)], opens_at: T0 - 7_200_000, closes_at: T0 - 3_600_000, minutes: 30, status: 'open'}), exam_id: 'exam_cu'}, admin);
  assert.equal((await call('POST', '/pwa/exams/start', {exam_id: closedExam.body.exam_id}, ta)).status, 403);
  await call('POST', `/pwa/teacher/exams/exam_sau/status`, {status: 'closed'}, admin);
  offset = 3_700_000; assert.equal((await call('POST', '/pwa/exams/start', {exam_id: 'exam_sau'}, ta)).body.detail, 'Bài kiểm tra đã đóng.'); offset = 0;

  // Đề Thử: làm nhiều lần, không giờ, không đồng hồ; đáp án theo cấu hình never
  const trial = await call('POST', '/pwa/teacher/exams', {title: 'Thử chương 1', grade: 9, mode: 'trial', reveal: 'never', status: 'open', questions: [mkQ(1), mkQ(2)]}, admin); assert.equal(trial.status, 200);
  for (let i = 0; i < 4; i++) {
    const st = await call('POST', '/pwa/exams/start', {exam_id: trial.body.exam_id}, ta); assert.equal(st.status, 200); assert.equal(st.body.deadline, null);
    const sub = await call('POST', '/pwa/exams/submit', {exam_id: trial.body.exam_id, attempt_id: st.body.attempt_id, answers: {q1: 'A', q2: i % 2 ? 'A' : 'B'}}, ta);
    assert.equal(sub.status, 200); assert.equal(sub.body.mode, 'trial'); assert.equal(sub.body.answers_key, undefined, 'cấu hình never không lộ đáp án');
  }
  assert.equal((await call('GET', `/pwa/exams/review?exam_id=${trial.body.exam_id}`, null, ta)).status, 403);
  const tl = (await call('GET', '/pwa/exams', null, ta)).body.exams.find(e => e.exam_id === trial.body.exam_id); assert.deepEqual([tl.attempts_used, tl.attempts_left, tl.best_score], [4, null, 10]);
} finally { Date.now = realNow; }
console.log('EXAM BACKEND OK');
