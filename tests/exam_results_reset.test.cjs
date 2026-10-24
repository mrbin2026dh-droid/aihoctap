const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../frontend/app.js'), 'utf8');
const start = source.indexOf('function resetLegacyExamResults(');
assert.ok(start >= 0, 'Result cleanup migration must exist');
const end = source.indexOf('\nresetLegacyExamResults();', start);
assert.ok(end > start, 'Migration runs before application startup');
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {data, getItem:key=>data.get(key) ?? null,
    setItem:(key,value)=>data.set(key,value), removeItem:key=>data.delete(key)};
}
test('cleanup removes cached results and queued old submissions only', () => {
  const store = storage({AISGK_SUBMISSIONS:'old results',aisgk_offline_submissions:'old queue',
    ai_sgk_student_auth:'login',AISGK_CUSTOM_EXAMS:'definitions',ai_sgk_user_progress:'learning',ai_sgk_documents:'documents'});
  assert.equal(context.resetLegacyExamResults(store),true);
  assert.equal(store.getItem('AISGK_SUBMISSIONS'),null);
  assert.equal(store.getItem('aisgk_offline_submissions'),null);
  for (const [key,value] of Object.entries({ai_sgk_student_auth:'login',AISGK_CUSTOM_EXAMS:'definitions',ai_sgk_user_progress:'learning',ai_sgk_documents:'documents'}))
    assert.equal(store.getItem(key),value);
});
test('reload preserves new results and queued submissions after cleanup', () => {
  const store = storage();
  context.resetLegacyExamResults(store);
  store.setItem('AISGK_SUBMISSIONS','new result');
  store.setItem('aisgk_offline_submissions','new pending result');
  assert.equal(context.resetLegacyExamResults(store),false);
  assert.equal(store.getItem('AISGK_SUBMISSIONS'),'new result');
  assert.equal(store.getItem('aisgk_offline_submissions'),'new pending result');
});
test('storage failures do not crash initialization or mark incomplete cleanup done', () => {
  assert.equal(context.resetLegacyExamResults({getItem(){throw Error('blocked');}}),false);
  const store=storage({AISGK_SUBMISSIONS:'old'});
  const broken={...store,removeItem(){throw Error('blocked');}};
  assert.equal(context.resetLegacyExamResults(broken),false);
  assert.equal(context.resetLegacyExamResults(store),true);
});
test('partial removal or marker failure retries safely on next startup', () => {
  for (const failure of ['second_remove', 'marker']) {
    const store=storage({AISGK_SUBMISSIONS:'old',aisgk_offline_submissions:'pending'});
    const broken={...store,
      removeItem(key) { if (failure==='second_remove' && key==='aisgk_offline_submissions') throw Error('blocked'); store.removeItem(key); },
      setItem(key,value) { if (failure==='marker') throw Error('blocked'); store.setItem(key,value); }
    };
    assert.equal(context.resetLegacyExamResults(broken),false);
    assert.equal(context.resetLegacyExamResults(store),true);
    assert.equal(store.getItem('AISGK_SUBMISSIONS'),null);
    assert.equal(store.getItem('aisgk_offline_submissions'),null);
  }
});
const statsStart=source.indexOf('function calculateRealStudentStats(');
const statsEnd=source.indexOf('\nclass StudentDataAdapter',statsStart);
vm.runInContext(source.slice(statsStart,statsEnd),context);
context.getCurriculumToc=()=>Array(17).fill({});
test('a stored legacy average alone cannot recreate deleted exam scores', () => {
  const stats=context.calculateRealStudentStats({average_score:10},9);
  assert.equal(stats.average_score,0);
  assert.equal(stats.score_count,0);
});
test('actual textbook quiz results still contribute after clearing exams', () => {
  const stats=context.calculateRealStudentStats({average_score:10,progress:{lessons:{one:{quiz_score:7.5,quiz_completed:true}}}},9);
  assert.equal(stats.average_score,7.5);
  assert.equal(stats.score_count,1);
});
