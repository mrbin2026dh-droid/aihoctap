// Đổi PIN ở hệ thống học → PIN hệ thống thi (Firebase) đổi theo; PIN lệch → tab Thi báo cho học sinh, không im lặng.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_fb_pin_sync.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8194);
const st={fbPw:'123456',updates:0};
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP aihoc.test 127.0.0.1']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 const ctx=await b.newContext({serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(process.env.DBG)console.log('CONSOLE',m.type(),m.text())});pg.on('request',q=>{if(process.env.DBG&&q.url().includes('/api/'))console.log('REQ',q.method(),q.url())});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(u.endsWith('/login'))return j({token:'t'});if(u.endsWith('/pwa/me'))return j({uid:'hs01',student_name:'An',grade:9,class_code:'9A'});
  if(u.endsWith('/pwa/change-pin'))return j({ok:true});if(u.endsWith('catalog'))return j({schema_version:1,revision:'r',courses:[]});return j({exams:[],attempts:[],results:[],items:[],courses:[],grades:[]})});
 await pg.route('https://identitytoolkit.googleapis.com/**',r=>{const u=r.request().url(),body=JSON.parse(r.request().postData());const j=(s,x)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(x)});
  if(u.includes('accounts:update')){if(body.idToken!=='id-1')return j(400,{error:{message:'INVALID_ID_TOKEN'}});st.fbPw=body.password;st.updates++;return j(200,{localId:'fb1',idToken:'id-1',refreshToken:'rf',expiresIn:'3600'})}
  if(body.password!==st.fbPw)return j(400,{error:{message:'INVALID_LOGIN_CREDENTIALS'}});return j(200,{localId:'fb1',idToken:'id-1',refreshToken:'rf',expiresIn:'3600'})});
 await pg.route('https://*.firebasedatabase.app/**',r=>r.fulfill({status:200,contentType:'application/json',body:'null'}));
 const login=async pin=>{await pg.click('#gate-student').catch(()=>{});await pg.evaluate(()=>{const d=document.getElementById('login-dialog');if(!d.open)d.showModal()});
  await pg.fill('#student-code','HS01');await pg.fill('#student-pin',pin);await pg.click('#login-form button[type=submit]');await pg.waitForFunction(()=>!document.getElementById('login-dialog').open,null,{timeout:6000});await pg.waitForTimeout(500)};
 await pg.goto('http://aihoc.test:8194/');await pg.waitForSelector('#gate:not([hidden])');
 await login('123456');ok(Boolean(await pg.evaluate(()=>localStorage.getItem('aisgk-fb'))),'đăng nhập: có phiên hệ thống thi');
 // Đổi PIN qua form (form có thể đang ẩn trong trang tài khoản → điền và gửi bằng script)
 await pg.evaluate(()=>{const f=document.getElementById('student-change-pin-form');f.querySelector('[name=old_pin]').value='123456';f.querySelector('[name=new_pin]').value='654321';f.querySelector('[name=confirm_pin]').value='654321';f.requestSubmit()});
 await pg.waitForFunction(()=>/Đã đổi mã PIN|CHƯA đổi/.test(document.getElementById('student-change-pin-status').textContent),null,{timeout:8000});
 await pg.waitForFunction(()=>!document.querySelector('#student-change-pin-form button[type=submit]').disabled,null,{timeout:8000});await pg.waitForTimeout(200);
 ok(st.fbPw==='654321'&&st.updates===1,'đổi PIN học tập → PIN hệ thống thi đổi theo (accounts:update)');
 ok((await pg.textContent('#student-change-pin-status')).includes('Đã đổi mã PIN'),'báo đổi PIN thành công');
 // Mở Tổng quan (nút đồng bộ chuyển vào bảng) rồi đăng xuất → máy dùng chung: em sau phải đăng nhập được
 await pg.click('button[data-tab=progress]').catch(()=>{});await pg.waitForTimeout(400);
 // Đăng xuất, đăng nhập bằng PIN mới → vẫn vào được hệ thống thi
 await pg.evaluate(()=>document.getElementById('logout').click());await pg.waitForTimeout(400);
 await login('654321');ok(Boolean(await pg.evaluate(()=>localStorage.getItem('aisgk-fb'))),'đăng nhập lại bằng PIN mới vẫn có phiên hệ thống thi');
 // PIN hai hệ thống lệch (thầy cô đặt lại một bên) → tab Thi báo rõ
 await pg.evaluate(()=>document.getElementById('logout').click());await pg.waitForTimeout(400);st.fbPw='999999';
 await login('654321');ok(!(await pg.evaluate(()=>localStorage.getItem('aisgk-fb'))),'PIN lệch → không có phiên hệ thống thi');
 await pg.click('button[data-tab=exams]');await pg.waitForSelector('.exam-fb-warn',{timeout:8000});
 ok((await pg.textContent('.exam-fb-warn')).includes('báo thầy cô kiểm tra mã PIN thi'),'tab Thi báo "chưa vào được hệ thống thi" thay vì im lặng');
 // Đổi PIN mà hệ thống thi lỗi → báo rõ
 await pg.route('https://identitytoolkit.googleapis.com/**',r=>r.fulfill({status:503,body:'down'}));
 await pg.evaluate(()=>{const f=document.getElementById('student-change-pin-form');f.querySelector('[name=old_pin]').value='654321';f.querySelector('[name=new_pin]').value='111222';f.querySelector('[name=confirm_pin]').value='111222';f.requestSubmit()});
 await pg.waitForFunction(()=>/CHƯA đổi được PIN hệ thống thi/.test(document.getElementById('student-change-pin-status').textContent),null,{timeout:8000});
 ok(true,'hệ thống thi lỗi khi đổi PIN → báo "CHƯA đổi được PIN hệ thống thi"');
 ok(errs.length===0,'không lỗi trang: '+errs.join(' | '));
 console.log(`FB PIN SYNC OK (${n} kiểm tra)`);
}catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await b.close();srv.close()}})();
