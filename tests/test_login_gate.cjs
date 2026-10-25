// Cổng đăng nhập: chưa đăng nhập thì không thấy bài học. Chạy: NODE_PATH=$(npm root -g) node tests/test_login_gate.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8127);
(async()=>{const b=await chromium.launch();try{const ctx=await b.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;let body={courses:[],grades:[]};
if(p.endsWith('/login'))body={token:'t',must_change_pin:false};if(p.endsWith('/pwa/me'))body={uid:'hs01',student_name:'An',class_code:'9A',grade:9};
r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
const vis=s=>pg.isVisible(s);
await pg.goto('http://localhost:8127/');await pg.waitForTimeout(900);
assert(await vis('#gate'),'T1 cổng phải hiện khi chưa đăng nhập');
assert(!(await vis('#main'))&&!(await vis('.bottom-nav'))&&!(await vis('#status')),'T1 nội dung bài học phải ẩn');
assert(!(await pg.evaluate(()=>/Hôm nay|Môn học/.test(document.body.innerText))),'T1 không lộ chữ của bài học');
assert.strictEqual(await pg.getAttribute('#gate-teacher','href'),'./teacher.html','T2 liên kết giáo viên');
await pg.click('#gate-student');await pg.waitForTimeout(300);
assert(await pg.evaluate(()=>document.getElementById('login-dialog').open),'T3 hộp thoại đăng nhập mở');
await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(1200);
assert(!(await vis('#gate'))&&(await vis('#main')),'T4 đăng nhập xong vào được bài học');
await pg.reload();await pg.waitForTimeout(900);assert(!(await vis('#gate'))&&(await vis('#main')),'T5 tải lại vẫn giữ phiên');
await pg.evaluate(()=>document.getElementById('logout').click());await pg.waitForTimeout(600);
assert((await vis('#gate'))&&!(await vis('#main')),'T6 đăng xuất quay về cổng');
await pg.reload();await pg.waitForTimeout(900);assert(await vis('#gate'),'T7 tải lại sau đăng xuất vẫn là cổng');
assert.deepStrictEqual(errs,[],'không lỗi trang');
console.log('ALL 7 LOGIN GATE TESTS PASSED');}finally{await b.close();srv.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
