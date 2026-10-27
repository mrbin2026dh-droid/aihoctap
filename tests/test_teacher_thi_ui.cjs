// Menu "Thi" của giáo viên (Google Sheet giả): mật khẩu, tải thông tin, mở/khóa, thi thử/thật, cho thi lại; menu "Về nhà".
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(body.toString().replace(/export const SHEET_API = '[^']*';/,`export const SHEET_API = '${API}';`));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8196);
const st={che_do:'thu',trang_thai:'khoa',done:false,calls:[]};
const info=()=>({ok:true,che_do:st.che_do,trang_thai:st.trang_thai,questions:4,by_class:{'9A':4},students:[{stt:1,name:'Nguyễn Văn An',lop:'9A',ma:'HS01',status:st.done?'Đã thi':'Chưa thi',last:'2026-10-27T04:30:00.000Z',score:st.done?7:null,total:st.done?10:null},{stt:2,name:'Trần Thị Bình',lop:'9A',ma:'hs9a02',status:'Chưa thi',last:'',score:null,total:null}]});
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:1280,height:800},{width:390,height:800}]){
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 st.che_do='thu';st.trang_thai='khoa';st.done=false;st.calls=[];
 await pg.route(API,r=>{const p=JSON.parse(r.request().postData());st.calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(p.gv!=='123456')return j({ok:false,error:'Mật khẩu giáo viên chưa đúng.'});
  if(p.action==='gv_set'){if(p.che_do)st.che_do=p.che_do;if(p.trang_thai)st.trang_thai=p.trang_thai}
  if(p.action==='gv_reset')st.done=false;return j(info())});
 await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);
 // vào thẳng giao diện làm việc: ẩn màn đăng nhập bằng cách gọi trực tiếp phần tử menu
 await pg.evaluate(()=>{document.querySelectorAll('[hidden]').forEach(()=>{});});
 const navs=await pg.$$eval('.t-nav-item',a=>a.map(x=>x.id));
 ok(navs.join()==='nav-overview,nav-lessons,nav-exams,nav-sheetexam,nav-materials,nav-accounts','menu có Về nhà (exams) rồi Thi');
 ok((await pg.textContent('#nav-exams')).includes('Về nhà')&&!(await pg.textContent('#nav-exams')).includes('Kiểm tra'),'menu "Kiểm tra" đã đổi thành "Về nhà"');
 ok((await pg.textContent('#nav-sheetexam')).includes('Thi'),'có menu Thi');
 const wide=await pg.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);ok(wide,'không tràn ngang '+vp.width);
 await pg.evaluate(()=>{const a=document.getElementById('nav-sheetexam');a.closest('.t-editor,.t-shell,body').hidden=false;});
 await pg.evaluate(()=>{for(let e=document.getElementById('view-sheetexam');e;e=e.parentElement)e.hidden=false;document.getElementById('list-sheetexam').hidden=false});
 await pg.fill('#thi-gv-pass','sai');await pg.click('#thi-gv-load');await pg.waitForTimeout(300);
 ok((await pg.textContent('#thi-gv-status')).includes('chưa đúng'),'sai mật khẩu → báo lỗi');ok(await pg.isHidden('#thi-gv-panel'),'sai mật khẩu → không hiện bảng điều khiển');
 await pg.fill('#thi-gv-pass','123456');await pg.click('#thi-gv-load');await pg.waitForSelector('#thi-gv-panel:not([hidden])');
 ok((await pg.textContent('#thi-gv-sub')).includes('KHÓA')&&(await pg.textContent('#thi-gv-sub')).includes('4 câu'),'hiện trạng thái khóa + số câu');
 ok((await pg.$$('#thi-gv-body tr')).length===2,'liệt kê 2 học sinh');ok((await pg.textContent('#thi-gv-body')).includes('Chưa vào'),'học sinh chưa vào thi hiển thị "Chưa vào"');
 await pg.selectOption('#thi-gv-mode','that');await pg.waitForTimeout(250);await pg.click('#thi-gv-open');await pg.waitForTimeout(300);
 ok(st.che_do==='that'&&st.trang_thai==='mo','mở thi thật gửi đúng lệnh');ok((await pg.textContent('#thi-gv-sub')).includes('Thi thật')&&(await pg.textContent('#thi-gv-sub')).includes('MỞ'),'giao diện cập nhật Thi thật + MỞ');
 ok(await pg.isDisabled('#thi-gv-open')&&!(await pg.isDisabled('#thi-gv-lock')),'đang mở: nút Mở tắt, nút Khóa bật');
 st.done=true;await pg.click('#thi-gv-refresh');await pg.waitForTimeout(300);
 ok((await pg.textContent('#thi-gv-body')).includes('7/10'),'hiện điểm học sinh đã nộp');
 await pg.click('#thi-gv-body tr:first-child button');await pg.waitForTimeout(300);
 ok(st.calls.some(c=>c.action==='gv_reset'&&c.ma==='HS01')&&!st.done,'cho thi lại → gửi gv_reset đúng mã');
 await pg.click('#thi-gv-lock');await pg.waitForTimeout(300);ok(st.trang_thai==='khoa','khóa thi');
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
console.log('TEACHER THI UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
