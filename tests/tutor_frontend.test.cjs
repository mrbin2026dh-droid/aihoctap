const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
function section(start, end) {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0, `Missing source marker: ${start}`);
  const limit = source.indexOf(end, offset + start.length);
  assert.ok(limit >= 0, `Missing end marker: ${end}`);
  return source.slice(offset, limit);
}
function harness(evaluation = { is_correct: false }) {
  const nodes = {};
  const state = {
    grade: 9, lessonId: 1, activeTab: 'quiz', currentQuestionIndex: 0,
    lessonData: { quiz: [{ id: 'q1', cau_hoi: 'Question' }, { id: 'q2' }] },
    userSelections: { q1: 'B' }, evaluatedQuestions: evaluation ? { q1: evaluation } : {},
    questionAttempts: { q1: 2 },
  };
  const context = vm.createContext({
    state, customContext: null, console: { warn() {} }, API_BASE: '/api',
    document: { getElementById(id) {
      return nodes[id] ||= { textContent: '', disabled: false, style: {},
        classList: { add() {}, remove() {} },
        addEventListener(type, handler) { this.handler = handler; } };
    } },
    renderApp() {}, showCompletionScreen() { context.completed = true; },
    openPopup() {}, sendChatMessage(message, ctx) { context.sent = { message, ctx }; },
    evaluateCurrentQuestion(qid) { context.graded = qid; },
    getOrCreateStudentSession() { return 'student'; },
  });
  return { context, nodes, state };
}
function bindListener(h, id) {
  vm.runInContext(section(`document.getElementById("${id}").addEventListener`, '\n  });') + '\n  });', h.context);
  return h.nodes[id].handler;
}

test('wrong answer retries current question while preserving hint attempts', async () => {
  const h = harness();
  await bindListener(h, 'btnActionQuestion')();
  assert.equal(h.state.currentQuestionIndex, 0);
  assert.equal(h.state.evaluatedQuestions.q1, undefined);
  assert.equal(h.state.userSelections.q1, undefined);
  assert.equal(h.state.questionAttempts.q1, 2);
});
test('network failure retries grading the retained choice', async () => {
  const h = harness({ is_network_error: true });
  await bindListener(h, 'btnActionQuestion')();
  assert.equal(h.context.graded, 'q1');
  assert.equal(h.state.currentQuestionIndex, 0);
  assert.equal(h.state.userSelections.q1, 'B');
});
test('correct answer advances normally', async () => {
  const h = harness({ is_correct: true });
  await bindListener(h, 'btnActionQuestion')();
  assert.equal(h.state.currentQuestionIndex, 1);
});
test('feedback tutor receives the real selected choice', () => {
  const h = harness();
  bindListener(h, 'btnFeedbackAskSocrates')();
  assert.equal(h.context.sent.ctx.student_choice, 'B');
  assert.match(h.context.sent.message, /phương án B/);
});
test('ordinary tutor receives the real selected choice', () => {
  const h = harness();
  vm.runInContext(section('let contextPayload = null;', '    const chatGrade') .replace(/\s*try\s*\{\s*$/, '') + '\nglobalThis.payload = contextPayload;', h.context);
  assert.equal(h.context.payload.student_choice, 'B');
});
test('restart clears attempts alongside quiz answers', () => {
  const h = harness();
  bindListener(h, 'btnRestartQuiz')();
  assert.equal(Object.keys(h.state.questionAttempts).length, 0);
});
test('offline grading counts exactly one attempt', async () => {
  const h = harness(null);
  h.state.lessonData.quiz[0].dap_an_dung = 'A';
  h.context.fetch = async () => { throw new Error('offline'); };
  vm.runInContext(section('async function evaluateCurrentQuestion(qid)', '\n// 11.'), h.context);
  await h.context.evaluateCurrentQuestion('q1');
  assert.equal(h.state.questionAttempts.q1, 3);
});
test('wrong answer action displays retry label', () => {
  const h = harness();
  Object.assign(h.context, { isEvaluated: true, userChoice: 'B', qid: 'q1', quiz: h.state.lessonData.quiz });
  vm.runInContext(section('const btnPrev = document.getElementById("btnPrevQuestion");', '\n  // Cập nhật Thanh tiến độ'), h.context);
  assert.match(h.nodes.btnActionText.textContent, /Thử lại/);
});
test('network failure does not label the answer wrong or offer misconception hints', () => {
  const h = harness({ is_network_error: true, feedback: 'Không thể kết nối máy chủ.' });
  Object.assign(h.context, { isEvaluated: true, qid: 'q1' });
  vm.runInContext(section('const feedbackBox = document.getElementById("feedbackBox");', '\n  // Nút Điều hướng'), h.context);
  assert.match(h.nodes.feedbackTitle.textContent, /Chưa thể kiểm tra/);
  assert.doesNotMatch(h.nodes.feedbackTitle.textContent, /Chưa chính xác/);
  assert.equal(h.nodes.feedbackDesc.textContent, 'Không thể kết nối máy chủ.');
  assert.equal(h.nodes.feedbackSourceTag.textContent, '');
  assert.equal(h.nodes.feedbackSocratesAction.style.display, 'none');
});
