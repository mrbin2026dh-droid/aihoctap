// Loading rõ ràng: thanh tiến trình mép trên khi đợi máy chủ > 0,4 giây, khối "đang tải" cho danh sách, vòng xoay trong nút đang xử lý.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const DB='https://test-ld-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8226);
const hh=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
 try{
  // Giáo viên: danh sách bài thi chậm 2 giây
  const c=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let slow=2000;
  await c.route(API+'**',async r=>{await sleep(slow);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{},classes:{'9A':9},fb:true})})});
  await c.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/catalog'))body={courses:[]};else if(u.endsWith('/gemini-keys'))body={keys:[]};else if(u.endsWith('/ai-settings'))body={settings:{}};else if(u.endsWith('/ai-stats'))body={stats:[]};else if(/students|results/.test(u))body=[];r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await p.goto('http://localhost:8226/teacher.html');await p.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await p.click('#teacher-login button[type=submit]');await p.waitForSelector('#workspace:not([hidden])');
  await p.click('#nav-sheetexam');await p.waitForTimeout(700);
  ok(await p.isVisible('#thi-list .ld-box'),'giáo viên: danh sách bài thi đang tải → khối có vòng xoay');
  ok(await p.evaluate(()=>document.body.classList.contains('is-net-busy'))&&!(await p.isVisible('#net-bar')),'đợi máy chủ: trang biết đang bận nhưng KHÔNG còn thanh chạy ngang mép trên (gây khó chịu)');
  const spin=await p.$eval('#thi-list .ld-box',e=>getComputedStyle(e,'::before').animationName);ok(spin==='ld-spin','vòng xoay có hiệu ứng quay');
  await p.waitForFunction(()=>!document.querySelector('#thi-list .ld-box'),null,{timeout:6000});
  ok(!(await p.evaluate(()=>document.body.classList.contains('is-net-busy'))),'tải xong → hết trạng thái bận');
  ok((await p.textContent('#thi-list')).includes('Chưa có bài thi'),'tải xong → hiện kết quả (không quay mãi)');
  // Nút Tạo bài thi: đang xử lý → vòng xoay trong nút
  await p.evaluate(()=>{const b=document.getElementById('thi-new-create');b.setAttribute('aria-busy','true');});
  ok(await p.$eval('#thi-new-create',e=>getComputedStyle(e,'::before').animationName)==='ld-spin','nút đang xử lý (Tạo bài thi, Lưu…) có vòng xoay');
  await p.evaluate(()=>document.getElementById('thi-new-create').removeAttribute('aria-busy'));
  // Lỗi mạng: khối tải không quay mãi
  slow=0;await c.unroute(API+'**');await c.route(API+'**',r=>r.abort());await p.click('#thi-list-refresh');await p.waitForTimeout(800);
  ok(!(await p.isVisible('#thi-list .ld-box'))&&await p.isHidden('#net-bar'),'Google Sheet lỗi → không còn khối tải quay mãi, thanh tiến trình tắt');
  ok(errs.length===0,'không lỗi script '+errs.join('|'));await c.close();
  // Học sinh: tổng quan tải chậm
  const db={thi_hs:{hs01:{ma:'HS01',ten:'An',lop:'9A',khoi:9,h:hh('hs01','123456')}},thi_bai:{}};
  const c2=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const p2=await c2.newPage();
  await c2.route(DB+'/**',r=>{const k=new URL(r.request().url()).pathname.replace(/\.json$/,'').replace(/^\//,'');const v=k.split('/').filter(Boolean).reduce((o,x)=>o==null?o:o[x],db);if((r.request().headers()['accept']||'').includes('event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 60000\nevent: put\ndata: ${JSON.stringify({path:'/',data:v??null})}\n\n`});r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v??null)})});
  await c2.route('**/api/**',async r=>{const u=new URL(r.request().url()).pathname;if(u.endsWith('/pwa/progress'))await sleep(2500);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/login')?{token:'w'}:u.endsWith('catalog')?{schema_version:1,revision:'r',courses:[]}:{attempts:[],review:[],mastery:[]})})});
  await p2.goto('http://localhost:8226/');await p2.click('#gate-student');await p2.fill('#student-code','HS01');await p2.fill('#student-pin','123456');await p2.click('#login-form button[type=submit]');
  await p2.waitForSelector('#progress .dash-skel',{timeout:6000});ok((await p2.textContent('#progress .dash-skel')).includes('Đang tải tổng quan')&&await p2.locator('#sync').isHidden(),'học sinh vừa đăng nhập: khung xương đúng bố cục, chưa hiện nút đồng bộ xoay trên vùng trống');
  await p2.waitForFunction(()=>document.body.classList.contains('is-net-busy'),null,{timeout:3000});ok(!(await p2.isVisible('#net-bar')),'học sinh: đợi máy chủ không có thanh chạy ngang, chỉ khối báo đang tải');
  await p2.waitForFunction(()=>!document.querySelector('#progress .ld-box'),null,{timeout:12000});ok(true,'tải xong → khối tải biến mất');
  await c2.close();
  console.log('LOADING STATES OK',n);
 }finally{await b.close();srv.close();}})().catch(e=>{console.error(e);process.exit(1)});
