const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../frontend/app.js'), 'utf8');
function progress(evaluatedQuestions) {
  const nodes = {};
  const start = source.indexOf('  // Cập nhật Thanh tiến độ Sidebar');
  const end = source.indexOf('  renderPromptSuggestions();', start);
  vm.runInNewContext(source.slice(start, end), {
    state: { evaluatedQuestions }, quiz: [{id:'q1'}, {id:'q2'}],
    document: { getElementById(id) { return nodes[id] ||= {style:{}}; } },
  });
  return nodes;
}
test('new students start at zero verified quiz progress', () => {
  assert.equal(progress({}).roadmapProgressPercent.textContent, '0%');
});
test('wrong answers and network failures do not count as mastered questions', () => {
  assert.equal(progress({q1:{is_correct:false}, q2:{is_network_error:true}}).roadmapProgressPercent.textContent, '0%');
});
test('only current quiz verified correct answers count toward progress', () => {
  const nodes = progress({q1:{is_correct:true}, oldQuestion:{is_correct:true}});
  assert.equal(nodes.roadmapProgressPercent.textContent, '50%');
  assert.equal(nodes.roadmapProgressSubtext.textContent, 'Đã làm đúng 1/2 câu hỏi');
});
test('teacher grade switching stays in the lesson instead of reopening management', () => {
  const start = source.indexOf('  if (studentAuthState && studentAuthState.isLoggedIn',source.indexOf('async function switchGrade'));
  const end = source.indexOf('  updateHeaderLessonInfo();',start);
  let selected;
  vm.runInNewContext(source.slice(start,end),{
    studentAuthState:{isLoggedIn:true,isBlocked:false},state:{teacherUnlocked:true,teacherToken:'real-session'},
    switchView(tab){selected=tab;}
  });
  assert.equal(selected,'theory');
});
