// Token học sinh hết hạn (401): mở thẳng đăng nhập với mã đã điền, giữ nháp. Chạy: NODE_PATH=$(npm root -g) node tests/test_session_expiry.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8172);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
let expired=false;
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let status=200,body={schema_version:1,revision:'r',courses:[]};
 if(u.endsWith('/login'))body={token:'t',must_change_pin:false};else if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nguyễn Văn Nam',class_code:'9A',grade:9};
 else if(expired&&(u.endsWith('/pwa/progress')||u.endsWith('/pwa/attempts')||u.endsWith('/pwa/ai-quota'))){status=401;body={detail:'Token đã hết hạn.'}}
 else if(u.endsWith('/pwa/progress'))body={attempts:[]};
 r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8172/');await pg.waitForTimeout(500);
await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(900);
assert(await pg.isVisible('#account'),'đã đăng nhập');
expired=true;await pg.click('[data-tab="progress"]');await pg.waitForTimeout(600);
assert(await pg.isVisible('#login-dialog'),'mở thẳng đăng nhập, không hộp thoại phụ');assert(!(await pg.isVisible('#msg-dialog')),'không có hộp thoại thứ hai');assert((await pg.textContent('#login-help')).includes('hết hạn'));assert.strictEqual(await pg.inputValue('#student-code'),'hs01','mã đã điền');assert.strictEqual(await pg.inputValue('#student-pin'),'','PIN không được điền');
assert(!(await pg.isVisible('#account')),'đã thoát phiên');assert.strictEqual(errs.length,0,errs.join(';'));
console.log('SESSION EXPIRY OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
