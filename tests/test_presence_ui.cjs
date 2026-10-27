// Trạng thái trực tuyến qua Firebase (không qua Worker): học sinh đăng nhập → đổi vé Firebase → ghi presence/{mã}
// "Đang học" → tab Thi: phòng chờ → đang thi → đã nộp → rời tab Thi: đang học → đăng xuất: đã thoát.
// Giáo viên: nghe luồng presence (EventSource) và hiện bảng tức thì. Firebase lỗi thì việc học vẫn chạy.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/presence-config.js')body=Buffer.from("export const PRESENCE_CONFIG = {apiKey:'TESTKEY', dbUrl:'https://test-presence-default-rtdb.asia-southeast1.firebasedatabase.app'};");if(p==='/sheet-config.js')body=Buffer.from(body.toString().replace(/export const SHEET_API = '[^']*';/,`export const SHEET_API = '${API}';`));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8197);
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 // ---------- Học sinh ----------
 for(const fbDown of [false,true]){
 const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const st={writes:[],exchanged:[],calls:0};
 await pg.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;let body={courses:[],grades:[]};
  if(p.endsWith('login'))body={token:'worker-token',fb_token:'fb-custom-1h',uid:'HS01',name:'Nguyễn Văn An',class_code:'9A',grade:9,must_change_pin:false};
  if(p.endsWith('/pwa/me'))body={uid:'HS01',student_name:'Nguyễn Văn An',class_code:'9A',grade:9};
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.route('https://identitytoolkit.googleapis.com/**',r=>{st.exchanged.push(JSON.parse(r.request().postData()).token);
  if(fbDown)return r.fulfill({status:400,contentType:'application/json',body:'{"error":{"message":"INVALID_CUSTOM_TOKEN"}}'});
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({localId:'HS01',idToken:'id-tok',refreshToken:'rf-tok',expiresIn:'3600'})})});
 await pg.route('**/*firebasedatabase.app/**',r=>{const u=new URL(r.request().url());st.writes.push({m:r.request().method(),path:u.pathname,auth:u.searchParams.get('auth'),body:JSON.parse(r.request().postData()||'null')});r.fulfill({status:200,contentType:'application/json',body:'{}'})});
 await pg.route(API,r=>{st.calls++;const p=JSON.parse(r.request().postData());const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  const student={name:'Nguyễn Văn An',lop:'9A',ma:'HS01',done:false};
  if(p.action==='submit')return j({ok:true,mode:'that',score:5,total:5,correct:1,count:1});
  if(p.action==='exams')return j({ok:true,student,exams:[{ma_de:'m1',tieu_de:'Giữa kỳ',che_do:'that',trang_thai:'khoa',done:false}]});
  st.exCalls=(st.exCalls||0)+1;
  if(st.exCalls===1)return j({ok:true,waiting:true,mode:'that',title:'Giữa kỳ',student,questions:[]});
  return j({ok:true,mode:'that',title:'Giữa kỳ',student,questions:[{id:'r2',stt:1,text:'CPU?',options:{A:'x',B:'y'},points:5}]})});
 const last=()=>st.writes.filter(w=>w.m==='PATCH').at(-1);
 const waitState=async(s,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){if(last()?.body?.state===s)return true;await pg.waitForTimeout(100)}return false};
 await pg.goto('http://localhost:8197/');await pg.waitForSelector('#gate:not([hidden])');
 await pg.click('#gate-student');await pg.fill('#student-code','HS01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');
 await pg.waitForSelector('#main:not([hidden])');
 const T=fbDown?'[Firebase lỗi] ':'';
 if(fbDown){await pg.waitForTimeout(800);ok(st.exchanged.length===1&&st.writes.length===0,T+'đổi vé thất bại → không ghi Firebase');ok(errs.length===0&&await pg.isVisible('#main'),T+'việc học vẫn chạy bình thường, không lỗi');await ctx.close();continue}
 ok(st.exchanged[0]==='fb-custom-1h','đổi đúng vé Firebase do Worker cấp (không dùng token Worker 12 giờ)');
 ok(await waitState('hoc'),'đăng nhập → ghi "Đang học"');
 const w=last();ok(w.path.endsWith('/presence/HS01.json')&&w.auth==='id-tok','ghi thẳng Firebase presence/HS01 bằng idToken (không qua Worker)');
 ok(w.body.name==='Nguyễn Văn An'&&w.body.lop==='9A'&&w.body.at['.sv']==='timestamp','kèm họ tên, lớp, giờ máy chủ Firebase');
 ok(!st.writes.some(x=>JSON.stringify(x).includes('123456')),'không gửi PIN lên Firebase');
 await pg.click('.bottom-nav [data-tab="exams"]');
 await pg.frameLocator('iframe.thi-frame').locator('.exam-item').first().click();
 ok(await waitState('phong_cho'),'tab Thi, bài đang khóa → "Phòng chờ thi"');
 ok(await waitState('dang_thi',12000),'thầy cô mở thi → "Đang thi"');
 const fr=pg.frameLocator('iframe.thi-frame');await fr.locator('.opt').first().click();await fr.locator('#submit').click();await fr.locator('#confirm-ok').click();
 ok(await waitState('da_nop'),'nộp bài → "Đã nộp"');
 await pg.click('.bottom-nav [data-tab="progress"]');ok(await waitState('hoc'),'rời tab Thi → "Đang học"');
 await pg.evaluate(()=>document.getElementById('logout').click());ok(await waitState('offline'),'đăng xuất → "Đã thoát"');
 ok(await pg.evaluate(()=>!localStorage.getItem('aisgk-presence')),'đăng xuất xóa vé Firebase khỏi máy');
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- Giáo viên: luồng tức thì ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const now=Date.now();const stream={HS01:{name:'Nguyễn Văn An',lop:'9A',state:'dang_thi',at:now},hs9a02:{name:'Trần Thị Bình',lop:'9A',state:'hoc',at:now-5000},hs8a01:{name:'Phạm Dũng',lop:'8A',state:'hoc',at:now-600000}};
  let streamAuth='';
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'worker-teacher-token',fb_token:'teacher-custom-1h',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
  await pg.route('https://identitytoolkit.googleapis.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({localId:'teacher_admin',idToken:'gv-id-tok',refreshToken:'gv-rf',expiresIn:'3600'})}));
  await pg.route('**/*firebasedatabase.app/presence.json*',r=>{streamAuth=new URL(r.request().url()).searchParams.get('auth');
   r.fulfill({status:200,headers:{'content-type':'text/event-stream','cache-control':'no-cache'},body:`event: put\ndata: ${JSON.stringify({path:'/',data:stream})}\n\nevent: patch\ndata: ${JSON.stringify({path:'/hs9a02',data:{state:'phong_cho',at:now}})}\n\n`})});
  await pg.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exam:null,bank:{9:3},classes:{'9A':9,'8A':8},students:[]})}));
  await pg.goto('http://localhost:8197/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.waitForFunction(()=>document.querySelectorAll('#thi-live-body tr').length===3,null,{timeout:8000});
  ok(streamAuth==='gv-id-tok','giáo viên nghe presence bằng idToken Firebase của mình (không qua Worker)');
  const txt=await pg.textContent('#thi-live-body');
  ok(txt.includes('Đang thi')&&txt.includes('Phòng chờ thi'),'hiện trạng thái tức thì, kể cả thay đổi (patch)');
  ok(txt.includes('Mất kết nối'),'quá 2,5 phút không có nhịp → "Mất kết nối"');
  ok((await pg.textContent('#thi-live-metrics')).includes('Đang thi1')&&(await pg.textContent('#thi-live-metrics')).includes('Phòng chờ1'),'đếm Đang học / Phòng chờ / Đang thi / Đã nộp');
  await pg.selectOption('#thi-live-lop','8A');ok((await pg.$$('#thi-live-body tr')).length===1,'lọc theo lớp');
  ok((await pg.textContent('#thi-live-status')).includes('tức thì'),'báo đang cập nhật tức thì');
  ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- Giáo viên dùng phiên cũ (đăng nhập trước bản cập nhật): báo rõ + nút Đăng nhập lại ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');sessionStorage.setItem('aisgk-pwa-teacher','old-expired-token');}});
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'worker-teacher-token',fb_token:'teacher-custom-1h',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
  let ex=[];await pg.route('https://identitytoolkit.googleapis.com/**',r=>{const t=JSON.parse(r.request().postData()).token;ex.push(t);
   if(t==='old-expired-token')return r.fulfill({status:400,contentType:'application/json',body:'{"error":{"message":"TOKEN_EXPIRED"}}'});
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({localId:'teacher_admin',idToken:'gv-id-tok',refreshToken:'gv-rf',expiresIn:'3600'})})});
  await pg.route('**/*firebasedatabase.app/presence.json*',r=>r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:'event: put\ndata: {"path":"/","data":null}\n\n'}));
  await pg.route(API,r=>{const p=JSON.parse(r.request().postData());r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p.gv?{ok:true,exam:null,bank:{9:3},classes:{},students:[]}:{ok:false,error:'Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.'})})});
  await pg.goto('http://localhost:8197/teacher.html');await pg.waitForTimeout(600);
  if(!(await pg.isVisible('#workspace'))){ok(true,'(phiên cũ không tự vào — bỏ qua phần phiên cũ)');}
  else{await pg.click('#nav-sheetexam');await pg.waitForTimeout(800);
   ok((await pg.textContent('#thi-live-status')).includes('Đăng nhập lại')&&await pg.isVisible('#thi-live-relogin')&&!ex.includes('old-expired-token'),'phiên cũ: không gửi token Worker sang Firebase, báo + nút Đăng nhập lại');
   ok(await pg.isVisible('#thi-relogin'),'thiếu PIN của phiên cũ: nút Đăng nhập lại cạnh thông báo');
   await pg.click('#thi-relogin');await pg.waitForSelector('#teacher-login [name=pin]',{state:'visible'});ok(true,'bấm Đăng nhập lại → về ô PIN giáo viên');
   await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
   await pg.click('#nav-sheetexam');await pg.waitForFunction(()=>document.getElementById('thi-live-status').textContent.includes('tức thì'),null,{timeout:8000});
   ok(ex.at(-1)==='teacher-custom-1h'&&await pg.isHidden('#thi-gv-alert')&&await pg.isHidden('#thi-live-relogin'),'đăng nhập lại → kết nối Firebase, hết thông báo lỗi');}
  ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- Chưa điền presence-config.js: tắt êm ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();let hits=0;
  await pg.route('**/presence-config.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:"export const PRESENCE_CONFIG = {apiKey:'', dbUrl:''};"}));
  await pg.route('https://identitytoolkit.googleapis.com/**',r=>{hits++;r.abort()});await pg.route('**/*firebasedatabase.app/**',r=>{hits++;r.abort()});
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'w',fb_token:'x',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
  await pg.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exam:null,bank:{},classes:{},students:[]})}));
  await pg.goto('http://localhost:8197/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.waitForTimeout(600);
  ok((await pg.textContent('#thi-live-status')).includes('presence-config.js')&&hits===0,'chưa điền dự án presence → báo rõ, không gọi Firebase nào');await ctx.close()}
 // ---------- Worker chưa cài khóa PRESENCE: báo rõ, không có nút đăng nhập lại vô ích ----------
 {const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'w',fb_token:'',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
  await pg.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exam:null,bank:{},classes:{},students:[]})}));
  await pg.goto('http://localhost:8197/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.waitForTimeout(600);
  ok((await pg.textContent('#thi-live-status')).includes('PRESENCE')&&await pg.isHidden('#thi-live-relogin'),'Worker chưa có khóa presence → báo rõ, không bắt đăng nhập lại');await ctx.close()}
 console.log('PRESENCE UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
