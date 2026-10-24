const assert = require('node:assert/strict');
const {test} = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../frontend/app.js'), 'utf8');
test('local browser uses its own origin API on every server port', () => {
  const start = source.indexOf('const getBackendPool =');
  const end = source.indexOf('const getApiBase', start);
  const context = vm.createContext({ localStorage:{getItem(){return null;}},window:{location:{hostname:'localhost',port:'41235',origin:'http://localhost:41235'}},console });
  assert.equal(vm.runInContext(source.slice(start,end)+'getBackendPool()[0]',context), 'http://localhost:41235/api');
});
test('lesson dashboards load server-created exam titles without Firebase', async () => {
  const start = source.indexOf('async function getTeacherExamsForGrade');
  const end = source.indexOf('// ============================================================================', start);
  let called = false;
  const context = vm.createContext({ URLSearchParams, console,fetchExamsFromFirebase: async()=>[],localStorage:{getItem(){return null;}},getExamApiRoot:()=>'/api', fetch:async url=>{called=url;return {ok:true,json:async()=>({success:true,exams:[{grade:9,title:'Server exam',target_classes:['9A']}]})};} });
  vm.runInContext(source.slice(start,end),context);
  const exams = await context.getTeacherExamsForGrade(9,'9A');
  assert.ok(called);
  assert.equal(exams[0]?.title, 'Server exam');
});
test('teacher analytics reads authenticated HTTP data without Firebase', async () => {
  const start = source.indexOf('class StudentDataAdapter');
  const end = source.indexOf('const studentDataAdapter', start);
  const context = vm.createContext({console,initFirebaseApp(){}, state:{teacherToken:'teacher-session'},getExamApiRoot:()=>'/api',getTeacherExamsForGrade:async()=>[],fetch:async(url,options)=>{
    assert.equal(options.headers.Authorization, 'Bearer teacher-session');
    return {ok:true,json:async()=>({success:true,data:{students:[{full_name:'Local student'}],kpi:{total_students:1}}})};
  }});
  vm.runInContext(source.slice(start,end)+'globalThis.adapter = new StudentDataAdapter();',context);
  const overview = await context.adapter.getClassOverview(9,'9A');
  assert.equal(overview.kpi.total_students,1);
  assert.equal(overview.students[0].full_name,'Local student');
});
test('available Firebase roster and recorded scores remain the analytics source', async () => {
  const start = source.indexOf('class StudentDataAdapter');
  const end = source.indexOf('const studentDataAdapter', start);
  let backendCalls = 0;
  const context = vm.createContext({console,initFirebaseApp(){},state:{teacherToken:'teacher-session'},
    firebase:{database:()=>({ref:()=>({once:async()=>({exists:()=>true,val:()=>({cloud1:{full_name:'Cloud student',student_code:'999999',is_blocked:true,presence:{online:true}}})})})})},
    getTeacherExamsForGrade:async()=>[],calculateRealStudentStats:()=>({progress_percent:50,average_score:7,score_count:1,completed_lessons:1,status:'learning',topics:[]}),
    fetch:async()=>{backendCalls++;throw Error('must preserve successful Firebase data');}
  });
  vm.runInContext(source.slice(start,end)+'globalThis.adapter = new StudentDataAdapter();',context);
  const overview = await context.adapter.getClassOverview(9,'9A');
  assert.equal(backendCalls,0);
  assert.equal(overview.students[0].average_score,7);
  assert.equal(overview.students[0].score_count,1);
  assert.equal(overview.students[0].presence.online,true);
  assert.equal(overview.students[0].is_blocked,true);
});
test('server exam source preserves Firebase-only exam records', async () => {
  const start = source.indexOf('async function getTeacherExamsForGrade');
  const end = source.indexOf('// ============================================================================',start);
  const context = vm.createContext({console,URLSearchParams,localStorage:{getItem:()=>null},getExamApiRoot:()=>'/api',
    fetch:async()=>({ok:true,json:async()=>({exams:[{exam_id:'local',grade:9,target_classes:['9A']}]})}),
    fetchExamsFromFirebase:async()=>[{exam_id:'cloud',grade:9,target_classes:['9A']}]
  });
  vm.runInContext(source.slice(start,end),context);
  assert.deepEqual(Array.from(await context.getTeacherExamsForGrade(9,'9A'),e=>e.exam_id),['local','cloud']);
});


test('cloud analytics counts a submitted zero and never invents improvement', async () => {
  const start = source.indexOf('class StudentDataAdapter');
  const end = source.indexOf('const studentDataAdapter', start);
  const records = {zero:{full_name:'Zero',stats:{progress_percent:0,average_score:0,score_count:1,status:'learning',topics:[]}},fresh:{full_name:'Fresh',stats:{progress_percent:0,average_score:0,score_count:0,status:'not_started',topics:[]}}};
  const context = vm.createContext({console,initFirebaseApp(){},state:{teacherToken:'session'},
    firebase:{database:()=>({ref:()=>({once:async()=>({exists:()=>true,val:()=>records})})})},
    getTeacherExamsForGrade:async()=>[],calculateRealStudentStats:s=>s.stats});
  vm.runInContext(source.slice(start,end)+'globalThis.adapter = new StudentDataAdapter();',context);
  const overview = await context.adapter.getClassOverview(9,'9A');
  assert.equal(overview.kpi.needs_support_count,1);
  assert.equal(overview.kpi.improved_count,0);
  assert.equal(overview.donut_progress.learning,1);
  assert.equal(overview.donut_progress.not_started,1);
  const advice = await context.adapter.getAIPedagogicalAdvice(9,'9A');
  assert.match(advice.critical_concerns,/1 học sinh cần/);
  assert.doesNotMatch(advice.general_assessment,/chưa hoàn thành bài luyện tập nào/);
});
