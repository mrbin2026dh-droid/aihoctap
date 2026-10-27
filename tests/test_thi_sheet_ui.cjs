// thi.html: Mã HS + PIN → Lấy đề → chọn đáp án (nháp lưu máy) → hộp thoại xác nhận → Nộp → điểm. Apps Script được giả lập.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(body.toString().replace(/export const SHEET_API = '[^']*';/,`export const SHEET_API = '${API}';`));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(f)]||'x');r.end(body)}).listen(8195);
const st={calls:[],busyOnce:true,done:false};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:360,height:740},{width:1280,height:800}]){
 st.done=false;st.calls=[];st.busyOnce=true;
 const ctx=await b.newContext({viewport:vp});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route(API,r=>{const p=JSON.parse(r.request().postData());st.calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(p.pin!=='123456')return j({ok:false,error:'Mã PIN chưa đúng.'});
  const student={name:'Nguyễn Văn An',lop:'9A',ma:'hs9a01',done:st.done};
  if(p.action==='exam')return j({ok:true,student,questions:[{id:'r2',stt:1,text:'CPU là gì?',options:{A:'Bộ xử lý',B:'Bộ nhớ'},points:5},{id:'r3',stt:2,text:'Excel là?',options:{A:'Soạn thảo',B:'Bảng tính'},points:5}]});
  if(p.action==='submit'){if(st.busyOnce){st.busyOnce=false;return r.fulfill({status:200,contentType:'text/html',body:'<html>bận</html>'})}st.done=true;return j({ok:true,score:5,total:10,correct:1,count:2})}
  j({ok:false,error:'?'})});
 await pg.goto('http://localhost:8195/thi.html');
 await pg.click('#login button[type=submit]');ok((await pg.textContent('#login-error')).includes('Nhập Mã học sinh')&&await pg.getAttribute('#ma','aria-invalid')==='true','bỏ trống mã → báo dưới trường');
 await pg.fill('#ma','hs9a01');await pg.fill('#pin','000000');await pg.click('#login button[type=submit]');
 await pg.waitForFunction(()=>document.getElementById('login-error').textContent.includes('PIN'));ok(true,'sai PIN → hiện "Mã PIN chưa đúng."');
 await pg.fill('#pin','123456');await pg.click('#login button[type=submit]');await pg.waitForSelector('#exam:not([hidden])');
 ok((await pg.textContent('#who')).includes('Nguyễn Văn An — Lớp 9A — 2 câu'),'lấy đề: hiện tên, lớp, số câu');
 ok(await pg.locator('.q').count()===2,'hiện 2 câu');
 await pg.click('.opt:has(input[name=r2][value=A])');
 ok((await pg.evaluate(()=>localStorage.getItem('thi-nhap-hs9a01')||'')).includes('"r2":"A"'),'chọn đáp án → nháp lưu trên máy');
 await pg.reload();await pg.fill('#ma','hs9a01');await pg.fill('#pin','123456');await pg.click('#login button[type=submit]');await pg.waitForSelector('#exam:not([hidden])');
 ok(await pg.isChecked('input[name=r2][value=A]'),'tải lại trang → khôi phục bài làm dở');
 const overflow=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth);ok(!overflow,`không tràn ngang ở ${vp.width}px`);
 const small=await pg.evaluate(()=>[...document.querySelectorAll('button:not([hidden]), .opt')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<48).length);ok(small===0,'nút và phương án cao ≥ 48px');
 await pg.click('#submit');ok(await pg.evaluate(()=>document.getElementById('confirm').open)&&(await pg.textContent('#confirm-text')).includes('1/2'),'bấm Nộp → hộp thoại xác nhận "mới làm 1/2 câu"');
 await pg.click('#confirm-cancel');ok(!(await pg.evaluate(()=>document.getElementById('confirm').open)),'Làm tiếp → đóng hộp thoại, chưa nộp');
 await pg.click('#submit');await pg.click('#confirm-ok');await pg.waitForSelector('#result:not([hidden])',{timeout:15000});
 ok((await pg.textContent('#result-score')).includes('5 / 10'),'Apps Script bận lần đầu → tự thử lại → hiện 5 / 10 điểm');
 const sub=st.calls.filter(c=>c.action==='submit').at(-1);ok(sub.answers.r2==='A'&&sub.ma==='hs9a01','gửi đúng bài làm');
 ok(!(await pg.evaluate(()=>localStorage.getItem('thi-nhap-hs9a01'))),'nộp xong xóa nháp');
 await pg.click('#done');await pg.fill('#ma','hs9a01');await pg.fill('#pin','123456');await pg.click('#login button[type=submit]');await pg.waitForSelector('#result:not([hidden])');
 ok((await pg.textContent('#result-title')).includes('đã nộp bài này rồi'),'đăng nhập lại sau khi nộp → báo đã nộp, không cho làm lại');
 ok(errs.length===0,'không lỗi trang '+errs.join('|'));await ctx.close();}
 // Màn hình đầu không còn nút "Vào bài thi"; tab Thi nhúng thi.html?auto=1 và vào thẳng đề bằng tài khoản vừa đăng nhập
 {const c=await b.newContext({serviceWorkers:'block'});const p=await c.newPage();await p.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"schema_version":1,"revision":"r","courses":[]}'}));
  await p.goto('http://localhost:8195/');await p.waitForSelector('#gate:not([hidden])');ok((await p.locator('#gate-exam').count())===0,'màn hình đầu: đã bỏ nút "Vào bài thi"');await c.close()}
 {st.done=false;st.calls=[];st.busyOnce=false;const c=await b.newContext({serviceWorkers:'block'});const p=await c.newPage();
  await p.route(API,r=>{const q=JSON.parse(r.request().postData());st.calls.push(q);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,mode:'thu',student:{name:'An',lop:'9A',ma:'hs9a01',status:'Chưa thi',done:false},questions:[{id:'r2',stt:1,text:'Câu 1?',options:{A:'x',B:'y'},points:5}]})})});
  await p.addInitScript(()=>sessionStorage.setItem('thi-cred',JSON.stringify({ma:'hs9a01',pin:'123456'})));
  await p.goto('http://localhost:8195/thi.html?auto=1');await p.waitForSelector('#exam:not([hidden])');
  ok(st.calls[0].action==='exam'&&st.calls[0].ma==='hs9a01'&&st.calls[0].pin==='123456','nhúng trong app: tự lấy đề bằng tài khoản vừa đăng nhập');
  ok(await p.isHidden('#login')&&await p.isHidden('.head'),'nhúng: không hiện form đăng nhập và tiêu đề phụ');
  ok((await p.textContent('#who')).includes('THI THỬ'),'thi thử có nhãn');await c.close()}
 console.log(`THI SHEET UI OK (${n} kiểm tra)`);
}catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await b.close();srv.close()}})();
