// Thi chạy thẳng trên Firebase (không chờ Worker/Google Sheet): đăng nhập tức thì bằng thi_hs, tab Thi vẽ trong app.
// THI THẬT theo ca (30/10): trạng thái từng em thi_tt, đề không đáp án, đảo câu/phương án theo em, hai phần Thực hành/Trắc nghiệm, nộp + đổi trạng thái một lần, không điểm.
//
// phòng chờ tự vào khi thầy cô mở (luồng sự kiện), nộp bài tự chấm ghi thi_nop, presence ghi không cần vé.
// Firebase REST + EventSource được giả lập trong bộ nhớ.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const DB='https://test-thi-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from("export const SHEET_API = 'https://script.google.com/macros/s/TEST/exec';");if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(body)}).listen(8198);
const h=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const seed=()=>({thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:h('hs01','123456')}},
 thi_bai:{b1:{tieu_de:'Giữa kỳ 9A',che_do:'that',khoi:9,lop:'9A',trang_thai:'khoa',so_cau:2,noi_dung:'tn_th',loai_th:'excel',de_th:'Tính tổng cột D vào ô D11',tao_luc:new Date().toISOString()},b2:{tieu_de:'Ôn tập khối 9',che_do:'thu',khoi:9,lop:'',trang_thai:'mo',so_cau:1,xem_diem:true},
  b3:{tieu_de:'Bài của 9B',che_do:'that',khoi:9,lop:'9B',trang_thai:'mo',so_cau:1},b4:{tieu_de:'Thử đang khóa',che_do:'thu',khoi:9,lop:'',trang_thai:'khoa',so_cau:1}},
 thi_nop:{b2:{hs02:{ma:'hs02',ten:'Bạn 9A',lop:'9A',diem:8,tong:10,dung:1,so_cau:1,lan:1,cao_nhat:8,at:1},hs03:{ma:'hs03',ten:'Bạn 9B',lop:'9B',diem:10,tong:10,dung:1,so_cau:1,lan:1,cao_nhat:10,at:2}}},
 thi_de:{b1:[{id:'r2',stt:1,text:'CPU là gì?',options:{A:'Bộ xử lý',B:'Bộ nhớ'},points:5},{id:'r3',stt:2,text:'Excel là?',options:{A:'Soạn thảo',B:'Bảng tính'},points:5}],
  b2:[{id:'r9',stt:1,text:'RAM là?',options:{A:'Bộ nhớ',B:'Ổ cứng'},answer:'A',points:10,topic:'Bộ nhớ máy tính'}]},
 ho_tro:{zalo:'https://zalo.me/0912345678',ten:'Thầy Hải',lop:{'9a':{zalo:'https://zalo.me/0987654321',ten:'Cô Lan'}}}});
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8198']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:390,height:800},{width:1280,height:800}]){
 let db=seed();const writes=[];const workerCalls=[];const upl=[];const reviews=[];
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname;workerCalls.push(p);let body={schema_version:1,revision:'r',courses:[]};
  if(p.endsWith('/login')){await new Promise(x=>setTimeout(x,4000));body={token:'worker-token',must_change_pin:false};}
  if(p.endsWith('/pwa/me'))body={uid:'HS77',student_name:'Lê Cũ',class_code:'9A',grade:9};
  if(p.endsWith('/pwa/tutor')){reviews.push(JSON.parse(r.request().postData()));body={reply:'**Nhận xét chung** Em làm rất tốt. **Cần ôn thêm** bộ nhớ máy tính.'}}
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});
 await pg.route('https://script.google.com/**',r=>{const p=JSON.parse(r.request().postData());upl.push(p);const tt=db.thi_tt?.[p.ma_de]?.[p.ma.toLowerCase()]?.tt;if(tt!=='chua_thi'&&tt!=='thi_lai')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'Bài thi chưa mở cho em.'})});((db.thi_th??={})[p.ma_de]??={})[p.ma.toLowerCase()]={ten_file:p.ten_file,size:8,file_id:'F1',at:Date.now()};r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,ten_file:p.ten_file,size:8,at:Date.now(),id:'F1'})})});
 await pg.route(DB+'/**',r=>{const u=new URL(r.request().url());const parts=u.pathname.replace(/\.json$/,'').split('/').filter(Boolean);const m=r.request().method();
  const getAt=()=>parts.reduce((o,k)=>(o === null || o === undefined)?undefined:o[k],db);
  if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:getAt()??null})}\n\n`});
  if(m==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(getAt()??null)});
  let v=JSON.parse(r.request().postData()||'null');const stamp=x=>x&&typeof x==='object'?(x['.sv']?Date.now():Object.fromEntries(Object.entries(x).map(([k,y])=>[k,stamp(y)]))):x;v=stamp(v);
  writes.push({m,path:u.pathname,auth:u.searchParams.get('auth'),v});
  if(!parts.length&&m==='PATCH'){   // ghi nhiều chỗ một lần (luật thi thật: chỉ khi Chưa thi/Thi lại, đổi → Đã thi cùng lúc, tn_th phải có thi_th)
   for(const k of Object.keys(v)){const [br,bid,mk]=k.split('/');if(br!=='thi_nop')continue;const bai=db.thi_bai[bid],t=db.thi_tt?.[bid]?.[mk]?.tt;
    if(!bai||bai.che_do!=='that'||!(t==='chua_thi'||t==='thi_lai')||v[`thi_tt/${bid}/${mk}/tt`]!=='da_thi'||(bai.noi_dung==='tn_th'&&!db.thi_th?.[bid]?.[mk])||'diem' in v[k])return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});}
   writes.push({m,path:u.pathname,v});for(const [k,x] of Object.entries(v)){const ps=k.split('/');let o=db;ps.slice(0,-1).forEach(z=>{o=o[z]??={}});o[ps.at(-1)]=x;}
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)});}
  if(parts[0]==='thi_nop'){const bai=db.thi_bai[parts[1]];if(!bai||bai.che_do==='that'||bai.trang_thai!=='mo')return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});}
  if(parts[0]==='thi_tien_do'){const t=db.thi_tt?.[parts[1]]?.[parts[2]]?.tt;if(t!=='chua_thi'&&t!=='thi_lai')return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});}
  let o=db;parts.slice(0,-1).forEach(k=>{o=o[k]??={}});if(m==='PATCH')o[parts.at(-1)]={...(o[parts.at(-1)]||{}),...v};else o[parts.at(-1)]=v;
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
 await pg.goto('http://thi.test:8198/');await pg.waitForSelector('#gate:not([hidden])');
// (bỏ: nút Zalo "Hỏi thầy cô" đã thay bằng trợ giúp nhanh FAQ theo yêu cầu thầy) 
// (bỏ: nút Zalo "Hỏi thầy cô" đã thay bằng trợ giúp nhanh FAQ theo yêu cầu thầy) 
// (bỏ: nút Zalo "Hỏi thầy cô" đã thay bằng trợ giúp nhanh FAQ theo yêu cầu thầy) 
 await pg.click('#gate-student');await pg.fill('#student-code','HS01');await pg.fill('#student-pin','000000');await pg.click('#login-form button[type=submit]');
 await pg.waitForFunction(()=>document.getElementById('login-error').textContent.includes('PIN'));ok(!workerCalls.some(p=>p.endsWith('/login')),'sai PIN → báo ngay từ Firebase, không gọi Worker');
 const t0=Date.now();await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');
 const dt=Date.now()-t0;ok(dt<2500,`đăng nhập tức thì bằng Firebase (${dt} ms), không chờ Worker 4 giây`);
 ok((await pg.textContent('body')).includes('Nguyễn Văn An'),'hiện tên học sinh từ Firebase');
// (bỏ: nút Zalo "Hỏi thầy cô" đã thay bằng trợ giúp nhanh FAQ theo yêu cầu thầy) 
// (bỏ: nút Zalo "Hỏi thầy cô" đã thay bằng trợ giúp nhanh FAQ theo yêu cầu thầy) 
 await pg.waitForTimeout(300);ok(workerCalls.some(p=>p.endsWith('/login')),'Worker chạy ngầm sau (cho Gia sư AI), không chặn học sinh');
 const pres=writes.filter(w=>w.path.includes('/presence/'));ok(pres.length&&pres[0].path.endsWith('/presence/HS01.json')&&!pres[0].auth&&pres[0].v.state==='hoc','trạng thái "Đang học" ghi thẳng Firebase, không cần vé');
 await pg.waitForSelector('.bottom-nav [data-tab="exams"] .nav-badge',{timeout:8000});ok((await pg.textContent('.bottom-nav [data-tab="exams"] .nav-badge'))==='1'&&await pg.evaluate(()=>document.querySelector('.bottom-nav [data-tab="exams"]').classList.contains('has-open')),'chưa mở tab Thi: mục Thi đã sáng, huy hiệu 1 bài đang mở');
 await pg.click('.bottom-nav [data-tab="exams"]');await pg.waitForSelector('.thi-card');
 ok(await pg.evaluate(()=>{const r=document.querySelector('.thi-card.is-real'),t=document.querySelector('.thi-card.is-trial');return !!r&&!!t&&getComputedStyle(r).borderLeftColor!==getComputedStyle(t).borderLeftColor})&&(await pg.textContent('.thi-card.is-real .thi-kind'))==='THI THẬT'&&(await pg.textContent('.thi-card.is-trial .thi-kind'))==='THI THỬ','thẻ bài: thi thật / thi thử khác màu viền và nhãn');
 ok(await pg.isVisible('.thi-card.is-trial .thi-state.is-open .thi-dot')&&(await pg.textContent('.thi-card.is-real .thi-state')).includes('Chưa mở thi')&&(await pg.textContent('.thi-summary')).includes('1 bài đang mở'),'trạng thái: thi thử Đang mở (chấm sáng); thi thật mặc định "Chưa mở thi" (ổ khóa); dòng tóm tắt');
 const cards=await pg['$$eval']('.thi-card',a=>a.map(x=>x.textContent));
 ok(cards.length===2&&cards.some(c=>c.includes('Giữa kỳ 9A')&&c.includes('Chưa mở thi'))&&cards.some(c=>c.includes('Ôn tập khối 9')&&c.includes('Đang mở')),'tab Thi trong app: bài của lớp/khối em; thi thật chưa mở vẫn hiện, thi thử khóa ẩn, bài lớp khác ẩn');
 ok(await pg.locator('iframe.thi-frame').count()===0,'không còn khung thi riêng (iframe)');
 ok(await pg.locator('.thi-card:has-text("Giữa kỳ 9A") button').count()===0&&(await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")')).includes('Thầy cô sẽ mở khi tới lượt lớp em'),'Chưa mở thi: không có nút vào, báo thầy cô sẽ mở khi tới lượt lớp');
 db.thi_bai.b1.trang_thai='mo';await pg.waitForTimeout(900);ok(await pg.locator('.thi-card:has-text("Giữa kỳ 9A") button').count()===0,'thi thật KHÔNG theo nút Mở/Khóa của bài: chỉ theo trạng thái của từng em');
 db.thi_tt={b1:{hs01:{tt:'chua_thi',lop:'9A',lan:0}}};await pg.waitForSelector('.thi-card:has-text("Giữa kỳ 9A") button:has-text("Vào thi")',{timeout:8000});
 ok((await pg.textContent('.bottom-nav [data-tab="exams"] .nav-badge'))==='2'&&(await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")')).includes('Thầy cô đã mở thi cho em'),'thầy cô Mở thi cho lớp → thẻ hiện nút Vào thi ngay, huy hiệu 2');
 await pg.click('.thi-card:has-text("Giữa kỳ 9A") button:has-text("Vào thi")');await pg.waitForSelector('.thi-part-tab');
 await pg.waitForTimeout(200);ok(await pg.locator('.thi-form .question').count()===2&&writes.some(w=>w.path.endsWith('/thi_vao/b1/hs01.json')),'vào bài: ghi thi_vao (giáo viên thấy em đã vào), có đề');
 ok(await pg.getAttribute('.thi-part-tab >> nth=0','aria-selected')==='true'&&(await pg.textContent('.thi-part-tab >> nth=0')).includes('Phần 1 · Thực hành')&&await pg.isVisible('.thi-practical')&&!(await pg.isVisible('.thi-form .question >> nth=0')),'đề Trắc nghiệm + Thực hành: hai phần, mở sẵn Phần 1 · Thực hành');
 ok((await pg.textContent('.thi-th-task')).includes('Tính tổng cột D')&&(await pg.getAttribute('#thi-th-file','accept'))==='.docx,.xlsx,.pptx,.pdf'&&(await pg.textContent('.thi-th-steps')).includes('Word, Excel hoặc PowerPoint'),'đề thực hành + hướng dẫn 3 bước; nhận Word/Excel/PowerPoint/PDF');
 ok((await pg.textContent('.thi-leave')).includes('thứ tự câu và phương án'),'thi thật: báo thứ tự câu/phương án mỗi bạn khác nhau');
 await pg.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{value:false,configurable:true});});
 ok((await pg.textContent('.thi-leave')).includes('rời màn hình bài thi 1 lần'),'thi thật: rời màn hình → đếm và báo cho em biết');
 await pg.click('.thi-part-tab:has-text("Trắc nghiệm")');await pg.waitForSelector('.thi-form .question >> nth=0',{state:'visible'});
 ok(await pg.evaluate(()=>[...document.querySelectorAll('.thi-form .question')].every(fs=>[...fs.querySelectorAll('.option')].map(o=>o.textContent.trim()[0]).join('')==='AB')),'nhãn A, B theo vị trí em thấy (giá trị là phương án gốc)');
 ok(writes.filter(w=>w.path.includes('/presence/')).at(-1).v.state==='dang_thi','"Đang thi"');
 await pg.click('.thi-form .option:has-text("Bộ xử lý")');ok((await pg.textContent('.thi-count')).includes('1/2')&&(await pg.textContent('.thi-count')).includes('Thực hành: chưa nộp'),'đếm câu đã làm + trạng thái thực hành trên thanh neo');
 await pg.waitForFunction(()=>true);await pg.waitForTimeout(1500);const td=db.thi_tien_do?.b1?.hs01;ok(td&&td.n===1&&td.tong===2&&td.th===false,'gửi tiến độ cho màn giáo viên (TN 1/2, thực hành chưa nộp)');
 const XI=await pg.evaluate(()=>[...document.querySelectorAll('.thi-form .question')].findIndex(f=>f.textContent.includes('Excel là?')));const CI=1-XI;
 ok(await pg.locator('.thi-qnav .thi-qbtn').count()===2&&await pg.evaluate(([c,x])=>document.querySelectorAll('.thi-qbtn')[c].classList.contains('is-done')&&!document.querySelectorAll('.thi-qbtn')[x].classList.contains('is-done'),[CI,XI]),'bảng số câu 1, 2: câu đã làm được tô');
 ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.thi-sticky')).position==='sticky'),'thanh tiêu đề + bảng số câu được neo khi cuộn');
 ok((await pg.evaluate(()=>localStorage.getItem('thi-fb-hs01-b1')||'')).includes('"r2":"A"'),'nháp lưu trên máy');
 await pg.click('.bottom-nav [data-tab="progress"]');await pg.click('.bottom-nav [data-tab="exams"]');await pg.waitForSelector('.thi-part-tab');await pg.click('.thi-part-tab:has-text("Trắc nghiệm")');
 ok(await pg.locator('.thi-form .question').count()===2&&await pg.isChecked('.thi-form input[name=r2][value=A]'),'rời tab rồi quay lại giữa bài: bài làm còn nguyên');
 const small=await pg.evaluate(()=>[...document.querySelectorAll('.thi-form .option, .thi-bar button, .thi-part-tab')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).length);ok(small===0,'phương án, nút, thẻ phần đủ lớn để chạm');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
 await pg.click('.thi-submit');await pg.waitForSelector('#msg-dialog[open]');ok((await pg.textContent('#msg-dialog')).includes('Còn 1 câu chưa làm')&&(await pg.textContent('#msg-dialog')).includes('câu '+(XI+1)),'nộp khi còn sót → cảnh báo đúng câu chưa làm, không cho nộp');
 await pg.click('#msg-dialog button:has-text("Làm tiếp")');await pg.waitForTimeout(200);ok(!db.thi_nop?.b1&&await pg.evaluate(x=>document.querySelectorAll('.thi-qbtn')[x].classList.contains('is-missing'),XI),'câu sót được tô đỏ');
 await pg.click('.thi-qbtn >> nth='+XI);await pg.click('#thi-q-'+(XI+1)+' .option:has-text("Soạn thảo")');
 await pg.click('.thi-submit');await pg.waitForSelector('#msg-dialog[open]');ok((await pg.textContent('#msg-dialog')).includes('Em chưa nộp bài thực hành'),'đủ câu trắc nghiệm nhưng CHƯA nộp thực hành → không cho nộp, báo rõ');
 await pg.click('#msg-dialog button:has-text("Tới phần Thực hành")');await pg.waitForTimeout(200);ok(await pg.getAttribute('.thi-part-tab >> nth=0','aria-selected')==='true'&&!db.thi_nop?.b1,'nút "Tới phần Thực hành" mở Phần 1, chưa ghi bài nộp');
 await pg.click('.thi-th-up');ok((await pg.textContent('.thi-th-status')).includes('Chọn file'),'chưa chọn file → báo ngay');
 await pg.setInputFiles('#thi-th-file',{name:'virus.exe',mimeType:'application/octet-stream',buffer:Buffer.from('x')});await pg.click('.thi-th-up');ok((await pg.textContent('.thi-th-status')).includes('Chỉ nhận file Word')&&upl.length===0,'file sai định dạng → báo, không gửi');
 await pg.setInputFiles('#thi-th-file',{name:'bai-lam.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('noi dung')});await pg.click('.thi-th-up');
 await pg.waitForFunction(()=>document.querySelector('.thi-th-status').textContent.includes('Đã nhận: bai-lam.docx'));
 ok(upl.length===1&&upl[0].action==='nop_th'&&upl[0].ma==='HS01'&&upl[0].pin==='123456'&&upl[0].ma_de==='b1'&&Buffer.from(upl[0].data,'base64').toString()==='noi dung','tải bài thực hành lên Google Drive (qua Google Sheet); chỉ báo "Đã nhận" khi Sheet xác nhận');
 ok((await pg.textContent('.thi-count')).includes('Thực hành: đã nộp'),'thanh neo: Thực hành đã nộp ✓');
 await pg.click('.thi-submit');await pg.waitForSelector('#msg-dialog[open]');const cf=await pg.textContent('#msg-dialog');ok(cf.includes('2 câu trắc nghiệm')&&cf.includes('bài thực hành (bai-lam.docx)')&&cf.includes('không làm lại được'),'đủ hai phần → hộp thoại xác nhận nêu rõ đã làm gì');
 await pg.click('#msg-dialog button:has-text("Nộp bài")');await pg.waitForSelector('.thi-done-card');
 const done=await pg.textContent('.thi-result');ok(done.includes('Em đã nộp bài thành công')&&/Nộp lúc \d{2}:\d{2}:\d{2}/.test(done)&&await pg.locator('.thi-score').count()===0&&!/điểm/i.test(done),'nộp xong: "Em đã nộp bài thành công", giờ nộp; KHÔNG có điểm');
 const nop=db.thi_nop.b1.hs01;ok(!('diem' in nop)&&nop.lan===1&&nop.tra_loi.r2==='A'&&nop.ma==='HS01'&&typeof nop.at==='number'&&nop.roi_tab===1,'bài nộp: lựa chọn, lần thi, số lần rời màn hình; máy em không gửi điểm');
 const tq=Object.values(nop.thu_tu.q);ok(tq.length===2&&tq[XI]==='r3'&&['AB','BA'].includes(nop.thu_tu.o.r2),'gửi kèm thứ tự câu/phương án em thấy (để file minh chứng đúng)');
 ok(db.thi_tt.b1.hs01.tt==='da_thi'&&db.thi_tt.b1.hs01.lan===1&&typeof db.thi_tt.b1.hs01.nop_luc==='number'&&writes.some(w=>w.m==='PATCH'&&w.path==='/.json'),'nộp + đổi trạng thái → Đã thi trong MỘT lần ghi');
 ok(writes.filter(w=>w.path.includes('/presence/')).at(-1).v.state==='da_nop'&&!(await pg.evaluate(()=>localStorage.getItem('thi-fb-hs01-b1'))),'"Đã nộp"; xóa nháp');
 await pg.click('.thi-back');await pg.waitForSelector('.thi-card');
 const c1=await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")');ok(c1.includes('Đã thi')&&c1.includes('Em đã nộp bài lúc')&&await pg.locator('.thi-card:has-text("Giữa kỳ 9A") button').count()===0,'thẻ bài: Đã thi, giờ nộp, không còn nút vào thi');
 db.thi_bai.b1.xem_diem=true;await pg.waitForTimeout(900);ok(await pg.locator('.thi-card:has-text("Giữa kỳ 9A") button').count()===0&&!(await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")')).includes('Điểm'),'thi thật: kể cả bật "Cho xem điểm" em cũng không thấy điểm');
 db.thi_tt.b1.hs01={tt:'thi_lai',lop:'9A',lan:1,ly_do:'Máy hỏng'};await pg.waitForSelector('.thi-card:has-text("Giữa kỳ 9A") button:has-text("Vào thi lại")',{timeout:8000});ok((await pg.textContent('.thi-card:has-text("Giữa kỳ 9A")')).includes('cho em thi lại'),'thầy cô Cho thi lại → nút Vào thi lại');
 db.thi_tt.b1.hs01={tt:'da_thi',lop:'9A',lan:1};await pg.waitForFunction(()=>!document.querySelector('.thi-card[data-id="b1"] button'),null,{timeout:8000});
 await pg.click('.thi-card:has-text("Ôn tập khối 9") button:has-text("Vào thi")');await pg.waitForSelector('.thi-form .question');
 await pg.click('.thi-form .option:has-text("Bộ nhớ")');await pg.click('.thi-submit');await pg.click('#msg-dialog button:has-text("Nộp bài")');await pg.waitForSelector('.thi-stats');
 ok((await pg.textContent('.thi-score')).includes('10 / 10')&&await pg.isVisible('.thi-actions button:has-text("Làm lại")'),'thi thử (cho xem điểm): 10/10, có nút Làm lại');
 await pg.waitForFunction(()=>!!document.querySelector('.thi-review-msg strong'),null,{timeout:8000});
 ok((await pg.textContent('.thi-review')).includes('Nhận xét của Gia sư AI')&&(await pg.textContent('.thi-review-msg')).includes('Cần ôn thêm'),'thi thử: Gia sư AI tự nhận xét bài (hiệu ứng gõ chữ)');
 const rv=reviews.at(-1);ok(rv.mode==='exam_review'&&rv.review.items.length===1&&rv.review.items[0].dung===true&&!JSON.stringify(rv).includes('"answer"'),'gửi AI câu hỏi + đúng/sai, không gửi đáp án');
 ok(rv.review.items[0].topic==='Bộ nhớ máy tính'&&db.thi_nop.b2.hs01.chu_de['bộ_nhớ_máy_tính'].d===1,'nhận xét AI theo chủ đề: gửi kèm chủ đề từng câu');
 const stx=await pg.textContent('.thi-stats');ok(stx.includes('1/2')&&!(await pg.textContent('.thi-board')).includes('Bạn 9B'),'xếp hạng: hạng 1/2 trong lớp 9A, không tính bạn lớp khác');
 ok(await pg.locator('.thi-rank-row').count()===2&&(await pg.textContent('.thi-rank-row.is-me')).includes('(em)'),'bảng xếp hạng lớp, tô sáng dòng của em');
 await pg.evaluate(()=>document.getElementById('open-tutor').click());await pg.waitForFunction(()=>document.getElementById('tutor-dialog').open);
 db.thi_de.b2[0].text='RAM là gì? (đã sửa)';
 await pg.evaluate(()=>[...document.querySelectorAll('.thi-actions button')].find(b=>b.textContent.includes('Làm lại')).click());await pg.waitForSelector('.thi-form .question');
 ok((await pg.textContent('.thi-form legend')).includes('(đã sửa)'),'làm lại: tải đề mới (thầy cô vừa sửa câu hỏi/đáp án)');
 ok(!(await pg.evaluate(()=>document.getElementById('tutor-dialog').open)),'vào làm bài → khung Gia sư AI tự đóng');
 await pg.evaluate(()=>document.getElementById('open-tutor').click());await pg.waitForFunction(()=>document.getElementById('tutor-quota-badge').textContent==='Đang thi',null,{timeout:4000});ok(true,'đang làm bài thi thử → Gia sư AI tạm nghỉ ("Đang thi")');
 await pg.evaluate(()=>document.getElementById('close-tutor').click());
 await pg.click('.thi-form .option:has-text("Ổ cứng")');await pg.click('.thi-submit');await pg.click('#msg-dialog button:has-text("Nộp bài")');await pg.waitForFunction(()=>(document.querySelector('.thi-score')?.textContent||'').includes('0 / 10'));
 const st2=await pg.textContent('.thi-stats');ok(st2.includes('Số lần thi')&&db.thi_nop.b2.hs01.lan===2&&db.thi_nop.b2.hs01.cao_nhat===10&&st2.includes('1/2'),'làm lại: lần 2, giữ điểm cao nhất 10 để xếp hạng');
 ok(db.thi_nop.b2.hs01.dau===10&&db.thi_nop.b2.hs01.diem===0,'làm lại: giữ điểm lần đầu (để đo tiến bộ), điểm lần này 0');
 // Bản đồ năng lực ở Tổng quan: gộp chủ đề từ bài thi; ghi tóm tắt lên Firebase cho giáo viên
 await pg.click('.bottom-nav [data-tab="progress"]');await pg.waitForSelector('.mastery-panel .mastery-tile',{timeout:10000});
 const tiles=await pg['$$eval']('.mastery-tile',a=>a.map(x=>x.textContent));
 ok(tiles.some(t=>t.includes('Bộ nhớ máy tính'))&&!tiles.some(t=>t.includes('Bảng tính')||t.includes('Phần cứng')),'Bản đồ năng lực: theo % đúng của bài thi THỬ; thi thật không đưa vào (em không xem điểm)');
 ok((await pg.textContent('.mastery-tip')).includes('Hôm nay em nên ôn'),'gợi ý chủ đề nên ôn hôm nay');
 await pg.waitForFunction(()=>true);await pg.waitForTimeout(300);
 const nl=db.nang_luc?.hs01;ok(nl&&nl.topics['bộ_nhớ_máy_tính'].n===1&&nl.lop==='9A'&&typeof nl.at==='number','ghi tóm tắt năng lực lên Firebase nang_luc (giáo viên xem bản đồ lớp)');
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
