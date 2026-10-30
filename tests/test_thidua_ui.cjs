// Bảng thi đua – giao diện: lớp 15 em, 5 buổi trong tháng. Học sinh hạng 13 thấy hạng của mình + khoảng cách tới top 10,
// chỉ thấy top 10 (không thấy bạn hạng 11–15); em mới 1 buổi thấy "cần thêm". Giáo viên thấy đủ, đúng thứ tự, đúng điểm.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const DB='https://test-td-default-rtdb.asia-southeast1.firebasedatabase.app';const SH=process.env.SHOTS||'';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(body)}).listen(8233);
const hh=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const HO=['Nguyễn','Trần','Lê','Phạm','Hoàng','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Mai','Cao'],TEN=['An','Bình','Chi','Dũng','Giang','Hà','Khoa','Linh','Minh','Nam','Oanh','Phúc','Quân','Sơn','Trang'];
const thang=new Date(Date.now()+7*3600e3).toISOString().slice(0,7),now=Date.now();
const thi_hs={};for(let i=1;i<=15;i++){const k='hs'+String(i).padStart(2,'0');thi_hs[k]={ma:k.toUpperCase(),ten:`${HO[i-1]} Văn ${TEN[i-1]}`,lop:'9A',khoi:9,h:hh(k,'123456')};}
// 5 buổi 10 câu. Em i (1..14) đúng 11-?: điểm giảm dần theo i; em 15 chỉ 1 buổi (10/10).
const kqOf=(b)=>{const o={};for(let i=1;i<=14;i++){const k='hs'+String(i).padStart(2,'0');o[k]={c:Math.max(0,Math.min(10,11-Math.ceil(i*0.7)-(b%2&&i%3===0?1:0))),ten:thi_hs[k].ten};}if(b===4)o.hs15={c:10,ten:thi_hs.hs15.ten};return o;};
const sess={};for(let b=0;b<5;b++)sess[String(500001+b)]={at:now-(5-b)*864e5,bo:'Ôn nhanh bài '+(b+1),so_cau:10,kq:kqOf(b)};
const db={thi_hs,thi_bai:{},thi_lop:{'9a':{lop:'9A',khoi:9}},quiz_kq_lop:{'9a':{[thang]:sess}}};
const at=p=>p.split('/').filter(Boolean).reduce((o,k)=>(o===null||o===undefined)?undefined:o[k],db);
async function fbRoute(r){const u=new URL(r.request().url());const p=u.pathname.replace(/\.json$/,'').replace(/^\//,'');
 if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 500\nevent: put\ndata: ${JSON.stringify({path:'/',data:at(p)??null})}\n\n`});
 if(r.request().method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(at(p)??null)});
 return r.fulfill({status:200,contentType:'application/json',body:'null'});}
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8233']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 const route=async c=>{await c.route(DB+'/**',fbRoute);await c.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{},classes:{'9A':9}})}));
  await c.route('**/api/**',r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});const u=new URL(r.request().url()).pathname;let body={schema_version:1,revision:'r',courses:[]};if(u.endsWith('/login'))body={token:'w',must_change_pin:false};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/teacher/students'))body=[];r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});};
 const errs=[];
 // ---- học sinh hạng 13
 const login=async(pg,ma)=>{await pg.goto('http://thi.test:8233/');await pg.waitForSelector('#gate:not([hidden])');await pg.click('#gate-student');await pg.fill('#student-code',ma);await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');};
 for(const [vp,theme] of [[{width:390,height:844},'light'],[{width:1280,height:900},'dark']]){
  const sc=await b.newContext({viewport:vp,serviceWorkers:'block',colorScheme:theme});const sp=await sc.newPage();sp.on('pageerror',e=>errs.push('S:'+e.message));await route(sc);
  await login(sp,'HS13');await sp.click('button[data-tab="practice"]');await sp.waitForSelector('.td-card .td-you',{timeout:10000});
  const card=await sp.textContent('.td-card');
  ok((await sp.textContent('.td-you-rank strong'))==='13'&&card.includes('/14 bạn'),'em hạng 13/14 bạn được xếp hạng');
  ok(/Còn \d+,\d\d điểm nữa là vào top 10\./.test(card),'em thấy còn bao nhiêu điểm nữa vào top 10');
  ok(await sp.locator('.td-podium li').count()===3&&await sp.locator('.td-list li').count()===7,'chỉ hiện top 10: bục 3 bạn + 7 bạn');
  const topNames=await sp.$$eval('.td-pod-name,.td-name',a=>a.map(x=>x.textContent.replace(' (em)','')));const nums=await sp.$$eval('.td-list .td-n',a=>a.map(x=>Number(x.textContent)));
  const sn=t=>{const w=t.split(' ');return w.length<=2?t:[w[0],...w.slice(1,-1).map(x=>x[0]+'.'),w.at(-1)].join(' ')};const lists=(await sp.textContent('.td-podium'))+(await sp.textContent('.td-list'));const shown=Object.values(thi_hs).map(h=>sn(h.ten)).filter(x=>lists.includes(x));
  ok(topNames.length===10&&nums.every(x=>x>=4&&x<=10)&&shown.every(x=>topNames.includes(x))&&!shown.includes(sn(thi_hs.hs13.ten)),'chỉ hiện tên 10 bạn top 10; tên các bạn hạng 11–14 và của em (hạng 13) không có trong danh sách');
  ok(card.includes('Nguyễn V. An')&&card.includes('Tham gia 5/5 buổi'),'tên rút gọn; số buổi tham gia của em');
  ok(!card.includes('Chăm chỉ nhất')&&card.includes('Cách tính điểm thi đua')&&card.includes('tính 3 buổi cao nhất'),'cả lớp đều đi đủ 5 buổi → không có danh hiệu Chăm chỉ (không ai "nhất"); có cách tính (5 buổi → 3 buổi cao nhất)');
  ok(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
  const small=await sp.$$eval('.td-card button,.td-card summary',a=>a.filter(x=>x.getBoundingClientRect().height<44).map(x=>x.textContent));ok(!small.length,'vùng chạm ≥ 44px '+small);
  if(SH){await sp.locator('.td-card').screenshot({path:path.join(SH,`td-student-${vp.width}-${theme}.png`)});}
  await sc.close();
 }
 // ---- em mới 1 buổi
 {const sc=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const sp=await sc.newPage();sp.on('pageerror',e=>errs.push('S15:'+e.message));await route(sc);
  await login(sp,'HS15');await sp.click('button[data-tab="practice"]');await sp.waitForSelector('.td-card .td-you');const card=await sp.textContent('.td-card');
  ok((await sp.textContent('.td-you-rank strong'))==='–'&&card.includes('Tham gia thêm 2 buổi để được xếp hạng.'),'em mới 1 buổi (10/10): chưa xếp hạng, báo cần thêm 2 buổi');await sc.close();}
 // ---- giáo viên
 {const tc=await b.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:true});const tp=await tc.newPage();tp.on('pageerror',e=>errs.push('T:'+e.message));await route(tc);
  await tp.goto('http://thi.test:8233/teacher.html');await tp.waitForTimeout(300);await tp.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await tp.click('#teacher-login button[type=submit]');await tp.waitForSelector('#workspace:not([hidden])');
  await tp.click('#nav-tools');await tp.click('#tab-tools-td');await tp.waitForFunction(()=>document.querySelectorAll('#td-body tr td[data-label="Học sinh"]').length===14,null,{timeout:10000});
  const ranks=await tp.$$eval('#td-body tr td[data-label="Hạng"]',a=>a.map(x=>x.textContent));
  ok(ranks.length===14&&ranks[0]==='1',`giáo viên: đủ 14 em được xếp hạng (${ranks.join(',')})`);
  const rows=await tp.$$eval('#td-body tr',a=>a.map(x=>[x.querySelector('[data-label="Học sinh"] strong').textContent,x.querySelector('[data-label="Điểm tháng"]').textContent]));
  const d=rows.map(r=>Number(r[1].replace(',','.')));ok(d.every((x,i)=>i===0||x<=d[i-1]),'điểm giảm dần theo hạng');
  ok(rows[0][0]==='Nguyễn Văn An'&&rows[0][1]==='10,00','hạng 1: Nguyễn Văn An 10,00');
  ok((await tp.textContent('#td-chua')).includes('Cao Văn Trang')&&(await tp.textContent('#td-chua')).includes('cần thêm 2 buổi'),'em 1 buổi nằm ở "Chưa đủ buổi để xếp hạng"');
  ok(await tp.locator('#td-body tr:first-child .td-chip.is-on').count()===3,'mỗi em đánh dấu đúng 3 buổi được tính');
  ok((await tp.textContent('#td-metrics')).includes('3/5')&&(await tp.textContent('#td-metrics')).includes('14/15 em'),'chỉ số: 5 buổi, tính 3 buổi cao nhất, 14/15 em được xếp hạng');
  ok(await tp.locator('#td-buoi .td-bo').count()===0&&await tp.locator('#td-buoi .td-bo-note').count()===5,'buổi do tài khoản khác mở: không có nút bỏ, ghi rõ lý do');
  if(SH)await tp.locator('#tools-p-td').screenshot({path:path.join(SH,'td-teacher-1280.png')});
  await tp.setViewportSize({width:390,height:844});await tp.waitForTimeout(200);ok(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'giáo viên 390 px: không tràn ngang');
  if(SH)await tp.screenshot({path:path.join(SH,'td-teacher-390.png'),fullPage:true});
  await tc.close();}
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));
 console.log('THI DUA UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
