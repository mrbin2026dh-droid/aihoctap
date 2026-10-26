// Thanh chọn vai trò Học sinh | Giáo viên ở màn đăng nhập (chưa đăng nhập). Chạy: NODE_PATH=$(npm root -g) node tests/test_role_switch.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8139);
const U='http://localhost:8139/';
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
// màu hiệu dụng của chữ và nền (đi ngược cây DOM tới nền không trong suốt)
const colors=(pg,sel)=>pg.evaluate(s=>{const parse=v=>{const m=v.match(/[\d.]+/g).map(Number);return {rgb:m.slice(0,3),a:m.length>3?m[3]:1}};
 const e=document.querySelector(s);const fg=parse(getComputedStyle(e).color).rgb;let n=e,bg=[255,255,255];while(n){const c=parse(getComputedStyle(n).backgroundColor);if(c.a>=.99){bg=c.rgb;break}n=n.parentElement}return {fg,bg}},sel);
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++};
try{for(const scheme of ['light','dark'])for(const [w,h] of [[320,568],[360,640],[390,844],[1280,800]]){
 const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',colorScheme:scheme});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;let body={courses:[],grades:[]};
  if(p.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(p.endsWith('/login'))body={token:'t',must_change_pin:false};if(p.endsWith('/pwa/me'))body={uid:'hs01',student_name:'An',class_code:'9A',grade:9};
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 const tag=`[${scheme} ${w}]`;
 // --- Học sinh
 await pg.goto(U);await pg.waitForSelector('#gate:not([hidden])');await pg.click('#gate-student');await pg.waitForFunction(()=>document.getElementById('login-dialog').open);
 const sw='#login-dialog .role-switch';
 ok(await pg.locator(sw).isVisible(),tag+' thanh vai trò hiện trong hộp thoại học sinh');
 ok((await pg.innerText(sw+' [aria-current=page]')).trim()==='Học sinh',tag+' đoạn đang chọn là Học sinh');
 ok(await pg.getAttribute(sw+' a','href')==='./teacher.html',tag+' liên kết sang giáo viên');
 ok((await pg.innerText(sw+' a')).trim()==='Giáo viên',tag+' nhãn Giáo viên đủ dấu');
 for(const el of await pg.$$(sw+' > *')){const bx=await el.boundingBox();ok(bx.height>=47.5,tag+' đoạn cao >=48px: '+bx.height)}
 for(const s of ['#login-dialog .reveal','#login-dialog .dialog-close']){const bx=await pg.locator(s).boundingBox();ok(bx.width>=47.5&&bx.height>=47.5,tag+' '+s+' >=48px: '+bx.width+'x'+bx.height)}
 ok((await pg.innerText('#login-help')).trim()==='Mã học sinh và mã PIN do giáo viên cấp.',tag+' câu hướng dẫn ngắn');
 for(const [s,min] of [[sw+' [aria-current=page]',4.5],[sw+' a',4.5]]){const c=await colors(pg,s);const r=ratio(c.fg,c.bg);ok(r>=min,tag+` tương phản ${s} ${r.toFixed(2)}`)}
 ok(!(await pg.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),tag+' học sinh không tràn ngang');
 ok(((await pg.innerText('#msg-title')).trim()!==''),tag+' tiêu đề hộp thông báo không rỗng');
 // bfcache: Back khôi phục PIN cũ thì phải xóa
 await pg.fill('#student-pin','123456');await pg.evaluate(()=>{document.getElementById('login-error').textContent='Sai';window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))});
 ok(await pg.inputValue('#student-pin')===''&&(await pg.innerText('#login-error')).trim()==='',tag+' Back xóa PIN và lỗi');
 // --- Giáo viên
 await pg.goto(U+'teacher.html');await pg.waitForSelector('#auth-section');
 const ts='#auth-section .role-switch';
 ok(await pg.locator(ts).isVisible(),tag+' thanh vai trò hiện ở trang giáo viên');
 ok((await pg.innerText(ts+' [aria-current=page]')).trim()==='Giáo viên',tag+' đoạn đang chọn là Giáo viên');
 ok(await pg.getAttribute(ts+' a','href')==='./',tag+' liên kết về học sinh');
 ok((await pg.innerText(ts+' a')).trim()==='Học sinh',tag+' nhãn Học sinh');
 ok(await pg.locator('.t-auth-back').count()===0,tag+' đã bỏ liên kết Góc học sinh cuối form');
 for(const el of await pg.$$(ts+' > *')){const bx=await el.boundingBox();ok(bx.height>=47.5,tag+' (GV) đoạn cao >=48px')}
 const rv=await pg.locator('#auth-section .t-reveal').boundingBox();ok(rv.width>=47.5&&rv.height>=47.5,tag+' Hiện PIN giáo viên >=48px: '+rv.width+'x'+rv.height);
 for(const [s,min] of [[ts+' [aria-current=page]',4.5],[ts+' a',4.5]]){const c=await colors(pg,s);const r=ratio(c.fg,c.bg);ok(r>=min,tag+` (GV) tương phản ${s} ${r.toFixed(2)}`)}
 ok(!(await pg.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)),tag+' giáo viên không tràn ngang');
 ok(await pg.locator('#teacher-must-change-section .role-switch').count()===0,tag+' màn đổi PIN lần đầu không có thanh vai trò');
 await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 ok(await pg.inputValue('#teacher-pin')==='',tag+' Back xóa PIN giáo viên');
 await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(900);
 ok(!(await pg.locator('.role-switch').first().isVisible().catch(()=>false)),tag+' đăng nhập xong thanh vai trò ẩn');
 ok(errs.length===0,tag+' không lỗi trang: '+errs);
 await ctx.close()}
// bấm thanh thật: Giáo viên -> trang giáo viên; Học sinh -> cổng học sinh, không giữ PIN
{const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const pg=await ctx.newPage();await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"courses":[],"grades":[]}'}));
 await pg.goto(U);await pg.waitForSelector('#gate:not([hidden])');await pg.click('#gate-student');await pg.fill('#student-pin','123456');await Promise.all([pg.waitForURL(/teacher\.html/),pg.click('#login-dialog .role-switch a')]);
 ok(await pg.locator('#auth-section').isVisible(),'bấm Giáo viên mở trang đăng nhập giáo viên');
 ok(await pg.inputValue('#teacher-pin')==='','PIN không mang sang trang giáo viên');
 await Promise.all([pg.waitForURL(u=>!/teacher\.html/.test(u.toString())),pg.click('#auth-section .role-switch a')]);
 await pg.waitForSelector('#gate:not([hidden])');ok(true,'bấm Học sinh về cổng học sinh');await ctx.close()}
console.log(`ALL ${n} ROLE SWITCH CHECKS PASSED`)}finally{await b.close();srv.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
