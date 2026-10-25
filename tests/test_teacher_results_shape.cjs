const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8141);
(async()=>{const b=await chromium.launch();const pg=await (await b.newContext({serviceWorkers:'block'})).newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={courses:[]};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/teacher/students'))body=[];
if(u.includes('/pwa/teacher/results'))body=[{uid:'u1',lesson_id:'bai-1'},{uid:'u2',student_name:'Nam',class_code:'9A',course_id:'tin-hoc-9',lesson_id:'b2',correct:3,total:4,answers:{q1:'A'}}];
r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8141/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(1000);
const n=await pg.locator('#teacher-results article').count();assert.strictEqual(n,2);assert.deepStrictEqual(errs,[]);console.log('RESULTS SHAPE TEST PASSED',n);await b.close();srv.close()})().catch(e=>{console.error(e.message);process.exit(1)});
