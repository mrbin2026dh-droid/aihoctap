// Thi chạy thẳng trên Firebase (không chờ Worker/Google Sheet): đăng nhập tức thì bằng thi_hs, tab Thi vẽ trong app,
// phòng chờ tự vào khi thầy cô mở (luồng sự kiện), nộp bài tự chấm ghi thi_nop, presence ghi không cần vé.
// Firebase REST + EventSource được giả lập trong bộ nhớ.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const DB='https://test-thi-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from("export const SHEET_API = 'https://script.google.com/macros/s/TEST/exec';");if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(body)}).listen(8198);
const h=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const seed=()=>({thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:h('hs01','123456')}},
 thi_bai:{b1:{tieu_de:'Giữa kỳ 9A',che_do:'that',khoi:9,lop:'9A',trang_thai:'khoa',so_cau:2,noi_dung:'tn_th'},b2:{tieu_de:'Ôn tập khối 9',che_do:'thu',khoi:9,lop:'',trang_thai:'mo',so_cau:1,xem_diem:true},
  b3:{tieu_de:'Bài của 9B',che_do:'that',khoi:9,lop:'9B',trang_thai:'mo',so_cau:1},b4:{tieu_de:'Thử đang khóa',che_do:'thu',khoi:9,lop:'',trang_thai:'khoa',so_cau:1}},
 thi_nop:{b2:{hs02:{ma:'hs02',ten:'Bạn 9A',lop:'9A',diem:8,tong:10,dung:1,so_cau:1,lan:1,cao_nhat:8,at:1},hs03:{ma:'hs03',ten:'Bạn 9B',lop:'9B',diem:10,tong:10,dung:1,so_cau:1,lan:1,cao_nhat:10,at:2}}},
 thi_de:{b1:[{id:'r2',stt:1,text:'CPU là gì?',options:{A:'Bộ xử lý',B:'Bộ nhớ'},answer:'A',points:5},{id:'r3',stt:2,text:'Excel là?',options:{A:'Soạn thảo',B:'Bảng tính'},answer:'B',points:5}],
  b2:[{id:'r9',stt:1,text:'RAM là?',options:{A:'Bộ nhớ',B:'Ổ cứng'},answer:'A',points:10}]}});
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8198']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:390,height:800},{width:1280,height:800}]){
 let db=seed();const writes=[];const workerCalls=[];const upl=[];
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname;workerCalls.push(p);let body={schema_version:1,revision:'r',courses:[]};
  if(p.endsWith('/login')){await new Promise(x=>setTimeout(x,4000));body={token:'worker-token',must_change_pin:false};}
  if(p.endsWith('/pwa/me'))body={uid:'HS77',student_name:'Lê Cũ',class_code:'9A',grade:9};
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.route('https://script.google.com/**',r=>{const p=JSON.parse(r.request().postData());upl.push(p);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,ten_file:p.ten_file})})});
 await pg.route(DB+'/**',r=>{const u=new URL(r.request().url());const parts=u.pathname.replace(/\.json$/,'').split('/').filter(Boolean);const m=r.request().method();
  const getAt=()=>parts.reduce((o,k)=>o==null?undefined:o[k],db);
  if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:getAt()??null})}\n\n`});
  if(m==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(getAt()??null)});
  let v=JSON.parse(r.request().postData()||'null');const stamp=x=>x&&typeof x==='object'?(x['.sv']?Date.now():Object.fromEntries(Object.entries(x).map(([k,y])=>[k,stamp(y)]))):x;v=stamp(v);
  writes.push({m,path:u.pathname,auth:u.searchParams.get('auth'),v});
  if(parts[0]==='thi_nop'){const bai=db.thi_bai[parts[1]];if(!bai||bai.trang_thai!=='mo'||(db.thi_nop?.[parts[1]]?.[parts[2]]&&bai.che_do!=='thu'))return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});}
  let o=db;parts.slice(0,-1).forEach(k=>{o=o[k]??={}});if(m==='PATCH')o[parts.at(-1)]={...(o[parts.at(-1)]||{}),...v};else o[parts.at(-1)]=v;
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
 await pg.goto('http://thi.test:8198/');await pg.waitForSelector('#gate:not([hidden])');
 await pg.click('#gate-student');await pg.fill('#student-code','HS01');await pg.fill('#student-pin','000000');await pg.click('#login-form button[type=submit]');
 await pg.waitForFunction(()=>document.getElementById('login-error').textContent.includes('PIN'));ok(!workerCalls.some(p=>p.endsWith('/login')),'sai PIN → báo ngay từ Firebase, không gọi Worker');
 const t0=Date.now();await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');
 const dt=Date.now()-t0;ok(dt<2500,`đăng nhập tức thì bằng Firebase (${dt} ms), không chờ Worker 4 giây`);
 ok((await pg.textContent('body')).includes('Nguyễn Văn An'),'hiện tên học sinh từ Firebase');
 await pg.waitForTimeout(300);ok(workerCalls.some(p=>p.endsWith('/login')),'Worker chạy ngầm sau (cho Gia sư AI), không chặn học sinh');
 const pres=writes.filter(w=>w.path.includes('/presence/'));ok(pres.length&&pres[0].path.endsWith('/presence/HS01.json')&&!pres[0].auth&&pres[0].v.state==='hoc','trạng thái "Đang học" ghi thẳng Firebase, không cần vé');
 await pg.click('.bottom-nav [data-tab="exams"]');await pg.waitForSelector('.thi-card');
 const cards=await pg.$$eval('.thi-card',a=>a.map(x=>x.textContent));
 ok(cards.length===2&&cards.some(c=>c.includes('Giữa kỳ 9A')&&c.includes('Chưa mở'))&&cards.some(c=>c.includes('Ôn tập khối 9')&&c.includes('Đang mở')),'tab Thi trong app: bài của lớp/khối em; thi thật khóa vẫn hiện, thi thử khóa ẩn, bài lớp khác ẩn');
 ok(await pg.locator('iframe.thi-frame').count()===0,'không còn khung thi riêng (iframe)');
 ok(await pg.locator('.thi-card:has-text("Giữa kỳ 9A") button').count()===0&&(await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")')).includes('Chờ thầy cô mở'),'bài chưa mở: không có nút vào (bỏ phòng chờ, tránh vào nhầm)');
 db.thi_bai.b1.trang_thai='mo';await pg.waitForSelector('.thi-card:has-text("Giữa kỳ 9A") button:has-text("Vào thi")',{timeout:8000});ok(true,'thầy cô bấm Mở → thẻ hiện nút Vào thi ngay');
 await pg.click('.thi-card:has-text("Giữa kỳ 9A") button:has-text("Vào thi")');await pg.waitForSelector('.thi-form .question');
 await pg.waitForTimeout(200);ok(await pg.locator('.thi-form .question').count()===2&&writes.some(w=>w.path.endsWith('/thi_vao/b1/hs01.json')),'vào bài: điểm danh thi_vao, hiện đề');
 ok(await pg.isVisible('.thi-practical')&&(await pg.textContent('.thi-practical')).includes('Bài thực hành'),'thi thật Trắc nghiệm + Thực hành: có phần nộp bài thực hành');
 await pg.click('.thi-th-up');ok((await pg.textContent('.thi-th-status')).includes('Chọn file'),'chưa chọn file → báo ngay');
 await pg.setInputFiles('#thi-th-file',{name:'bai-lam.docx',mimeType:'application/msword',buffer:Buffer.from('noi dung')});await pg.click('.thi-th-up');
 await pg.waitForFunction(()=>document.querySelector('.thi-th-status').textContent.includes('Đã nộp file: bai-lam.docx'));
 ok(upl.length===1&&upl[0].action==='nop_th'&&upl[0].ma==='HS01'&&upl[0].pin==='123456'&&upl[0].ma_de==='b1'&&Buffer.from(upl[0].data,'base64').toString()==='noi dung','tải bài thực hành lên Google Drive (qua Google Sheet)');
 ok(writes.filter(w=>w.path.includes('/presence/')).at(-1).v.state==='dang_thi','"Đang thi"');
 await pg.click('.thi-form .option:has-text("Bộ xử lý")');ok((await pg.textContent('.thi-count')).includes('1/2'),'đếm câu đã làm');
 ok((await pg.evaluate(()=>localStorage.getItem('thi-fb-hs01-b1')||'')).includes('"r2":"A"'),'nháp lưu trên máy');
 await pg.click('.bottom-nav [data-tab="progress"]');await pg.click('.bottom-nav [data-tab="exams"]');await pg.waitForSelector('.thi-form .question');
 ok(await pg.locator('.thi-form .question').count()===2&&await pg.isChecked('.thi-form input[name=r2][value=A]'),'rời tab rồi quay lại giữa bài: bài làm còn nguyên');
 const small=await pg.evaluate(()=>[...document.querySelectorAll('.thi-form .option, .thi-bar button')].filter(e=>e.getBoundingClientRect().height<44).length);ok(small===0,'phương án và nút đủ lớn để chạm');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
 await pg.click('.thi-submit');await pg.waitForSelector('#msg-dialog[open]');ok((await pg.textContent('#msg-dialog')).includes('1/2'),'Nộp → hộp thoại xác nhận "mới làm 1/2 câu"');
 await pg.click('#msg-dialog button:has-text("Nộp bài")');await pg.waitForSelector('.thi-result');
 ok((await pg.textContent('.thi-result')).includes('Thầy cô sẽ công bố điểm sau')&&await pg.locator('.thi-score').count()===0,'chưa cho xem điểm → chỉ báo "Đã nộp bài", không hiện điểm');
 const nop=db.thi_nop.b1.hs01;ok(nop.diem===5&&nop.tong===10&&nop.dung===1&&nop.lan===1&&nop.cao_nhat===5&&nop.tra_loi.r2==='A'&&nop.ma==='HS01'&&typeof nop.at==='number','ghi bài nộp + điểm + số lần vào Firebase thi_nop');
 ok(writes.filter(w=>w.path.includes('/presence/')).at(-1).v.state==='da_nop','"Đã nộp"');
 ok(!(await pg.evaluate(()=>localStorage.getItem('thi-fb-hs01-b1'))),'nộp xong xóa nháp');
 await pg.click('.thi-back');await pg.waitForSelector('.thi-card');
 const c1=await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")');ok(c1.includes('Đã thi 1 lần')&&c1.includes('Đã nộp bài')&&!c1.includes('5/10')&&await pg.locator('.thi-card:has-text("Giữa kỳ 9A") button').count()===0,'thẻ bài: đã thi 1 lần, không lộ điểm, không còn nút vào thi');
 db.thi_bai.b1.xem_diem=true;await pg.waitForSelector('.thi-card:has-text("Giữa kỳ 9A") button[aria-label^="Kết quả và xếp hạng"]',{timeout:8000});
 ok((await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")')).includes('Điểm cao nhất 5/10'),'thầy cô bật Cho xem điểm → thẻ hiện điểm và nút Kết quả ngay');
 await pg.click('.thi-card:has-text("Giữa kỳ 9A") button[aria-label^="Kết quả và xếp hạng"]');await pg.waitForSelector('.thi-stats');
 ok((await pg.textContent('.thi-score')).includes('5 / 10')&&(await pg.textContent('.thi-stats')).includes('1/1')&&(await pg.textContent('.thi-stats')).includes('Số lần thi'),'trang kết quả: điểm, hạng trong lớp, số lần thi');
 await pg.click('.thi-back');await pg.click('.thi-card:has-text("Ôn tập khối 9") button:has-text("Vào thi")');await pg.waitForSelector('.thi-form .question');
 await pg.click('.thi-form .option:has-text("Bộ nhớ")');await pg.click('.thi-submit');await pg.click('#msg-dialog button:has-text("Nộp bài")');await pg.waitForSelector('.thi-stats');
 ok((await pg.textContent('.thi-score')).includes('10 / 10')&&await pg.isVisible('.thi-actions button:has-text("Làm lại")'),'thi thử (cho xem điểm): 10/10, có nút Làm lại');
 const stx=await pg.textContent('.thi-stats');ok(stx.includes('1/2')&&!(await pg.textContent('.thi-board')).includes('Bạn 9B'),'xếp hạng: hạng 1/2 trong lớp 9A, không tính bạn lớp khác');
 ok(await pg.locator('.thi-rank-row').count()===2&&(await pg.textContent('.thi-rank-row.is-me')).includes('(em)'),'bảng xếp hạng lớp, tô sáng dòng của em');
 await pg.click('.thi-actions button:has-text("Làm lại")');await pg.waitForSelector('.thi-form .question');await pg.click('.thi-submit');await pg.click('#msg-dialog button:has-text("Nộp bài")');await pg.waitForFunction(()=>(document.querySelector('.thi-score')?.textContent||'').includes('0 / 10'));
 const st2=await pg.textContent('.thi-stats');ok(st2.includes('Số lần thi')&&db.thi_nop.b2.hs01.lan===2&&db.thi_nop.b2.hs01.cao_nhat===10&&st2.includes('1/2'),'làm lại: lần 2, giữ điểm cao nhất 10 để xếp hạng');
 if(vp.width<500)await pg.screenshot({path:process.env.SHOT||'/dev/null'}).catch(()=>{});
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'trang kết quả không tràn ngang '+vp.width);
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close();
 // tài khoản chưa có trên Firebase → đường cũ qua Worker
 {db=seed();delete db.thi_hs.hs01;workerCalls.length=0;const c2=await b.newContext({viewport:vp,serviceWorkers:'block'});const p2=await c2.newPage();
  await p2.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;workerCalls.push(p);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p.endsWith('/login')?{token:'w',must_change_pin:false}:p.endsWith('/pwa/me')?{uid:'HS01',student_name:'An Worker',class_code:'9A',grade:9}:{schema_version:1,revision:'r',courses:[]})})});
  await p2.route(DB+'/**',r=>r.fulfill({status:200,contentType:'application/json',body:'null'}));
  await p2.goto('http://thi.test:8198/');await p2.click('#gate-student');await p2.fill('#student-code','HS01');await p2.fill('#student-pin','123456');await p2.click('#login-form button[type=submit]');await p2.waitForSelector('#main:not([hidden])');
  ok(workerCalls.some(p=>p.endsWith('/login'))&&(await p2.textContent('body')).includes('An Worker'),'Firebase chưa có tài khoản (chưa Cập nhật lên Firebase) → vẫn đăng nhập qua đường cũ');await c2.close()}
}
console.log('THI FIREBASE UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
