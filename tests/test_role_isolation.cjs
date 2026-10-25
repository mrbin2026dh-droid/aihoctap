// Cách ly vai trò học sinh/giáo viên. Chạy: NODE_PATH=$(npm root -g) node tests/test_role_isolation.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8129);
const B='http://localhost:8129';
(async()=>{const b=await chromium.launch();try{
const mk=async()=>{const ctx=await b.newContext({viewport:{width:1200,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={courses:[]};
if(u.endsWith('/login'))body={token:'t',must_change_pin:false};if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nam',class_code:'9A',grade:9};
if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/teacher/students'))body=[];
r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});return {ctx,pg}};
const studentLogin=async pg=>{await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(900)};
// R1: phiên giáo viên cũ + học sinh đăng nhập → trang giáo viên đòi đăng nhập, học sinh không thấy liên kết giáo viên
{const {ctx,pg}=await mk();await pg.goto(B+'/index.html');
await pg.evaluate(()=>{sessionStorage.setItem('aisgk-pwa-teacher','teacher-token');sessionStorage.setItem('aisgk-pwa-teacher-must-change','false')});
await pg.reload();await pg.waitForTimeout(400);await studentLogin(pg);
assert(!(await pg.isVisible('.teacher-link')),'R1 học sinh không thấy liên kết Góc Giáo viên');
assert.strictEqual(await pg.evaluate(()=>sessionStorage.getItem('aisgk-pwa-teacher')),null,'R1 token giáo viên phải bị xóa khi học sinh đăng nhập');
await pg.goto(B+'/teacher.html');await pg.waitForTimeout(700);
assert(!(await pg.isVisible('#editor')),'R2 học sinh không được thấy giao diện giáo viên');assert(await pg.isVisible('#auth-section'),'R2 phải hiện form đăng nhập giáo viên');await ctx.close()}
// R3: phiên giáo viên cũ nhưng máy đã có phiên học sinh (token còn sót) → vẫn đòi đăng nhập
{const {ctx,pg}=await mk();await pg.goto(B+'/index.html');await studentLogin(pg);
await pg.evaluate(()=>{sessionStorage.setItem('aisgk-pwa-teacher','stale');sessionStorage.setItem('aisgk-pwa-teacher-must-change','false')});
await pg.goto(B+'/teacher.html');await pg.waitForTimeout(700);
assert(!(await pg.isVisible('#editor')),'R3 token sót không được mở giao diện giáo viên');await ctx.close()}
// R4: giáo viên đăng nhập → phiên học sinh bị xóa → quay lại trang học sinh thấy cổng
{const {ctx,pg}=await mk();await pg.goto(B+'/index.html');await studentLogin(pg);
await pg.goto(B+'/teacher.html');await pg.waitForTimeout(500);
await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(1000);
assert(await pg.isVisible('#editor'),'R4 giáo viên vào được sau khi đăng nhập');
await pg.goto(B+'/index.html');await pg.waitForTimeout(800);assert(await pg.isVisible('#gate'),'R4 phiên học sinh đã bị xóa → cổng đăng nhập');await ctx.close()}
console.log('ALL 4 ROLE ISOLATION TESTS PASSED');}finally{await b.close();srv.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
