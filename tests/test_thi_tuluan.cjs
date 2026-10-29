// Thi thử Trắc nghiệm + Tự luận.
// Giáo viên: chọn Nội dung thi, số câu tự luận, nhập đề + gợi ý đáp án, AI soạn kèm câu tự luận, sửa bài nhận lại câu tự luận.
// Học sinh: phần II tự luận gõ trên khung kẻ dòng chấm, nộp → AI chấm theo gợi ý → điểm + nhận xét; AI lỗi → lưu "chờ chấm", bấm Chấm lại.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';
const DB='https://test-tl-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'}[path.extname(f)]||'x');r.end(body)}).listen(8193);
const h=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8193']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 /* ================= GIÁO VIÊN ================= */
 for(const vp of [{width:1280,height:900},{width:390,height:840}]){
  const calls=[];const exams=[];
  const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
   if(p.action==='gv_create')exams.unshift({ma_de:'1',tieu_de:p.tieu_de,che_do:p.che_do,khoi:p.khoi,lop:p.lop,trang_thai:'khoa',questions:(p.questions||[]).length,noi_dung:p.questions?.some(q=>q.kind==='tl')?'tn_tl':'tn'});
   if(p.action==='gv_questions')return j({ok:true,ma_de:p.ma_de,questions:[{id:'r2',text:'CPU là gì?',options:{A:'Bộ xử lý',B:'Bộ nhớ'},answer:'A',points:1},{id:'r3',kind:'tl',text:'Nêu vai trò của CPU.',guide:'- Xử lý lệnh (1 điểm)',points:2,topic:'Phần cứng'}]});
   return j({ok:true,bank:{6:0,7:0,8:0,9:3},classes:{'9A':9},exams,fb:false})});
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};
   if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};
   if(u.endsWith('/pwa/catalog'))body={courses:[{id:'tin9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số'}]}]};
   if(u.endsWith('/teacher/students'))body=[];
   if(u.endsWith('/teacher/ai-questions')){calls.push({action:'ai',...JSON.parse(r.request().postData())});body={questions:[{text:'Bit là gì?',options:{A:'Đơn vị nhỏ nhất',B:'Ổ cứng',C:'CPU',D:'Chuột'},answer:'A',points:1,level:'Biết',ai:true}],essays:[{kind:'tl',text:'Trình bày vai trò của bộ nhớ.',guide:'- Lưu dữ liệu (1 điểm)',points:1,ai:true}],lesson_title:'Thế giới kĩ thuật số',remaining:30};}
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await pg.goto('http://localhost:8193/teacher.html');await pg.waitForTimeout(300);
  await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.waitForTimeout(300);await pg.click('#tab-thi-new');
  ok(await pg.isHidden('#thi-thu-fields'),'thi thật: không có ô Nội dung thi thử');
  await pg.selectOption('#thi-new-mode','thu');
  ok(await pg.isVisible('#thi-thu-fields')&&(await pg['$$eval']('#thi-thu-nd option',o=>o.map(x=>x.textContent))).join('|').includes('Trắc nghiệm + Tự luận'),'thi thử: có lựa chọn Trắc nghiệm / Trắc nghiệm + Tự luận');
  const gap=await pg.evaluate(()=>{const a=document.getElementById(innerWidth>760?'thi-new-khoi':'thi-new-lop').getBoundingClientRect(),c=document.getElementById('thi-thu-nd').getBoundingClientRect();return c.top-a.bottom});
  ok(gap>=0&&gap<80,`ô Nội dung thi lấp chỗ trống ngay dưới Khối/Lớp (${Math.round(gap)}px)`);
  ok(await pg.isHidden('#thi-tl-fields'),'Trắc nghiệm: chưa có phần tự luận');
  await pg.selectOption('#thi-thu-nd','tn_tl');
  ok(await pg.isVisible('#thi-tl-fields')&&await pg.isVisible('#thi-tl-count')&&await pg.locator('#thi-tl-list .thi-tl').count()===2,'chọn Trắc nghiệm + Tự luận → hiện Số câu tự luận (mặc định 2) và 2 khung câu');
  ok(await pg.locator('#thi-tl-list .thi-tl').first().locator('label:has-text("Gợi ý đáp án")').count()===1,'mỗi câu có Đề tự luận + Gợi ý đáp án để AI chấm + Điểm');
  await pg.fill('#thi-tl-count','3');await pg.dispatchEvent('#thi-tl-count','change');ok(await pg.locator('#thi-tl-list .thi-tl').count()===3,'đổi số câu tự luận → thêm khung');
  await pg.fill('#thi-tl-count','1');await pg.dispatchEvent('#thi-tl-count','change');ok(await pg.locator('#thi-tl-list .thi-tl').count()===1,'giảm số câu → bỏ khung trống');
  // AI soạn đề: có ô số câu tự luận
  await pg.click('#thi-new-ai');await pg.waitForSelector('#ai-q-dialog[open]');
  ok(await pg.isVisible('#ai-q-tl'),'AI soạn đề (thi thử có tự luận): có ô số câu tự luận');
  await pg.waitForFunction(()=>document.querySelectorAll('#ai-q-lesson option').length>1);await pg.selectOption('#ai-q-lesson','tin9|b1');
  await pg.fill('#ai-q-biet','1');await pg.fill('#ai-q-hieu','0');await pg.fill('#ai-q-vd','0');await pg.fill('#ai-q-tl','1');await pg.click('#ai-q-go');
  await pg.waitForFunction(()=>!document.getElementById('ai-q-dialog').open);
  ok(calls.find(c=>c.action==='ai')?.essays===1,'gửi số câu tự luận cho AI');
  ok(await pg.locator('#thi-qe-list .thi-qe.is-ai').count()===1&&await pg.locator('#thi-tl-list .thi-tl.is-ai').count()===1&&await pg.locator('#thi-tl-list .thi-tl').count()===1,'câu trắc nghiệm và câu tự luận AI soạn hiện ra để duyệt (khung trống được thay)');
  ok((await pg.textContent('#thi-mix-sum')).includes('Trắc nghiệm: 1 câu')&&(await pg.textContent('#thi-mix-sum')).includes('Tự luận: 1 câu'),'dòng tổng: số câu + điểm từng phần');
  if(process.env.SHOT)await pg.screenshot({path:process.env.SHOT+`/gv-${vp.width}.png`,fullPage:true});
  await pg.fill('#thi-new-title','Thi thử có tự luận');await pg.click('#thi-new-create');await pg.waitForTimeout(200);
  ok((await pg.textContent('#thi-gv-status')).includes('Đã duyệt')&&!calls.some(c=>c.action==='gv_create'),'câu AI chưa duyệt → không cho lưu');
  for(const c of await pg.locator('.qe-ok').all())await c.check();
  await pg.click('#thi-tl-add');const last=pg.locator('#thi-tl-list .thi-tl').last();await last.locator('.tl-text').fill('Nêu hai ví dụ thiết bị số.');
  await pg.click('#thi-new-create');await pg.waitForTimeout(200);ok((await pg.textContent('#thi-gv-status')).includes('gợi ý đáp án'),'câu tự luận thiếu gợi ý → báo, đưa tới ô gợi ý');
  await last.locator('.tl-guide').fill('- Điện thoại (1 điểm)\n- Máy tính (1 điểm)');await last.locator('.tl-pts').fill('2');
  await pg.click('#thi-new-create');await pg.waitForFunction(()=>document.getElementById('tabpanel-thi-list').hidden===false);
  const cr=calls.find(c=>c.action==='gv_create'),tl=cr.questions.filter(q=>q.kind==='tl');
  ok(cr.che_do==='thu'&&cr.questions.length===3&&tl.length===2&&tl[1].guide.includes('Máy tính')&&tl[1].points===2&&!('options' in tl[0]),'tạo bài: gửi trắc nghiệm + tự luận (đề, gợi ý, điểm)');
  // Sửa bài: nhận lại câu tự luận
  await pg.click('.t-list-item button[aria-label^="Chỉnh sửa"]');await pg.waitForFunction(()=>document.querySelectorAll('#thi-tl-list .thi-tl').length===1);
  ok(await pg.inputValue('#thi-thu-nd')==='tn_tl'&&(await pg.inputValue('#thi-tl-list .tl-guide')).includes('Xử lý lệnh')&&await pg.locator('#thi-qe-list .thi-qe').count()===1,'sửa bài: câu tự luận về đúng Phần tự luận (kèm gợi ý), trắc nghiệm ở danh sách câu hỏi');
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang');
  ok(!errs.length,'giáo viên: không lỗi JS '+errs.join('|'));
  await ctx.close();
 }
 /* ================= HỌC SINH ================= */
 for(const vp of [{width:390,height:820},{width:1280,height:850}]){
  const db={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:h('hs01','123456')}},
   thi_bai:{t1:{tieu_de:'Thi thử tự luận',che_do:'thu',khoi:9,lop:'9A',trang_thai:'mo',so_cau:3,xem_diem:true,noi_dung:'tn_tl'}},
   thi_de:{t1:[{id:'r2',stt:1,text:'CPU là gì?',options:{A:'Bộ xử lý',B:'Bộ nhớ'},answer:'A',points:1,topic:'Phần cứng'},{id:'r3',stt:2,kind:'tl',text:'Nêu hai ví dụ thiết bị số.',points:2,topic:'Thiết bị số',goi_y:'- Điện thoại (1đ)\n- Máy tính (1đ)'},{id:'r4',stt:3,text:'RAM là?',options:{A:'Bộ nhớ',B:'Ổ cứng'},answer:'A',points:1}]}};
  const writes=[],grades=[];let gradeFail=false,logins=0;
  const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname;let body={schema_version:1,revision:'r',courses:[]},status=200;
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   if(p.endsWith('/login')){logins++;body={token:logins===1?'old-token':'worker-token',must_change_pin:false};}
   if(p.endsWith('/pwa/me'))body={uid:'HS01',student_name:'Nguyễn Văn An',class_code:'9A',grade:9};
   if(p.endsWith('/pwa/tutor'))body={reply:'Em làm tốt.'};
   if(p.endsWith('/pwa/exam-essay')){const q=JSON.parse(r.request().postData());const au=r.request().headers()['authorization'];if(au==='Bearer old-token'){grades.push({expired:true});return r.fulfill({status:401,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({detail:'Phiên đăng nhập đã hết.'})});}grades.push({q,auth:au});await new Promise(x=>setTimeout(x,300));if(gradeFail){status=502;body={detail:'AI chưa trả lời được (mã 503).'};}else body={items:q.items.map(()=>({diem:1.5,nhan_xet:'Em nêu đúng điện thoại, còn thiếu ví dụ thứ hai.'})),tong_ket:'Cố lên'};}
   r.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});
  await pg.route(DB+'/**',r=>{const u=new URL(r.request().url());const parts=u.pathname.replace(/\.json$/,'').split('/').filter(Boolean);const m=r.request().method();
   const getAt=()=>parts.reduce((o,k)=>(o===null||o===undefined)?undefined:o[k],db);
   if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:getAt()??null})}\n\n`});
   if(m==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(getAt()??null)});
   let v=JSON.parse(r.request().postData()||'null');const stamp=x=>x&&typeof x==='object'?(x['.sv']?Date.now():Object.fromEntries(Object.entries(x).map(([k,y])=>[k,stamp(y)]))):x;v=stamp(v);
   writes.push({m,path:u.pathname,v});
   let o=db;parts.slice(0,-1).forEach(k=>{o=o[k]??={}});if(m==='PATCH')o[parts.at(-1)]={...(o[parts.at(-1)]||{}),...v};else o[parts.at(-1)]=v;
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
  await pg.goto('http://thi.test:8193/');await pg.waitForSelector('#gate:not([hidden])');
  await pg.click('#gate-student');await pg.fill('#student-code','HS01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');
  await pg.click('.bottom-nav [data-tab="exams"]');await pg.waitForSelector('.thi-card button:has-text("Vào thi")');await pg.click('.thi-card button:has-text("Vào thi")');await pg.waitForSelector('.thi-form .question');
  const parts=await pg['$$eval']('.thi-part',a=>a.map(x=>x.textContent));
  ok(parts.join('|')==='PHẦN I. TRẮC NGHIỆM|PHẦN II. TỰ LUẬN','đề chia PHẦN I. TRẮC NGHIỆM / PHẦN II. TỰ LUẬN');
  const legends=await pg['$$eval']('.thi-form legend',a=>a.map(x=>x.textContent));
  ok(legends[2].startsWith('Câu 3. Nêu hai ví dụ')&&legends[1].startsWith('Câu 2. RAM'),'trắc nghiệm trước, tự luận sau (đánh số liên tục)');
  ok(!(await pg.textContent('.thi-form')).includes('Điện thoại (1đ)'),'học sinh không thấy gợi ý đáp án');
  const ta=await pg.evaluate(()=>{const t=document.querySelector('textarea.thi-tl-input'),cs=getComputedStyle(t),lab=document.querySelector(`label[for="${t.id}"]`);return {img:cs.backgroundImage,lh:parseFloat(cs.lineHeight),h:t.getBoundingClientRect().height,w:t.getBoundingClientRect().width,lab:lab?.textContent,fs:parseFloat(cs.fontSize)}});
  ok(ta.img.includes('linear-gradient')&&ta.lab==='Bài làm của em'&&ta.h>=ta.lh*5.5&&ta.fs>=16,`khung gõ tự luận kẻ dòng chấm như giấy thi (${Math.round(ta.h)}px ≈ 6 dòng, chữ ${ta.fs}px)`);
  await pg.check('.thi-form input[name=r2][value=A]');await pg.check('.thi-form input[name=r4][value=B]');
  await pg.click('.thi-submit');await pg.waitForSelector('dialog[open]');ok((await pg.textContent('dialog[open]')).includes('câu 3'),'chưa làm tự luận → nhắc còn câu 3');await pg.click('dialog[open] button:visible');
  const long='Ví dụ thứ nhất là điện thoại thông minh. '.repeat(30);await pg.fill('textarea.thi-tl-input',long);
  if(process.env.SHOT)await pg.screenshot({path:process.env.SHOT+`/hs-${vp.width}.png`,fullPage:true});
  const h2=await pg.evaluate(()=>document.querySelector('textarea.thi-tl-input').getBoundingClientRect().height);ok(h2>ta.h,'gõ dài → khung tự cao thêm dòng (không phải cuộn trong ô nhỏ)');
  await pg.waitForTimeout(500);ok(await pg.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('thi-fb-')&&localStorage.getItem(k).includes('điện thoại'))),'bài tự luận lưu nháp trên máy khi đang gõ');
  ok(await pg.evaluate(()=>document.querySelectorAll('.thi-qbtn.is-done').length)===3,'bảng số câu: câu tự luận đã gõ được tô');
  await pg.click('.thi-submit');await pg.waitForSelector('dialog[open]');await pg.click('dialog[open] button:has-text("Nộp bài")');
  await pg.waitForSelector('.thi-grading');ok((await pg.textContent('.thi-grading')).includes('AI đang chấm'),'nộp → báo AI đang chấm tự luận');
  await pg.waitForSelector('.thi-tl-result');
  ok(grades[0]&&grades[0].expired&&logins>=2,'token Worker hết hạn (401) → tự lấy token mới bằng mã + PIN rồi chấm lại, không "chờ chấm"');grades.shift();
  const g0=grades[0];ok(g0&&g0.auth==='Bearer worker-token'&&g0.q.items.length===1&&g0.q.items[0].guide.includes('Máy tính')&&g0.q.items[0].max===2&&g0.q.items[0].answer.startsWith('Ví dụ'),'gửi AI: đề + gợi ý đáp án + bài làm + điểm tối đa (token học sinh)');
  const rec=writes.filter(w=>w.path.endsWith('/thi_nop/t1/hs01.json')).at(-1).v;
  ok(rec.diem===2.5&&rec.diem_tn===1&&rec.tong===4&&rec.tu_luan.r3.d===1.5&&rec.tu_luan.r3.max===2&&rec.tu_luan.r3.nx&&rec.cho_cham===false&&!('r3' in rec.tra_loi)&&rec.tra_loi.r2==='A','ghi điểm: trắc nghiệm 1 + tự luận 1,5 = 2,5/4; bài làm tự luận ở tu_luan, không lẫn vào tra_loi');
  if(process.env.SHOT)await pg.screenshot({path:process.env.SHOT+`/kq-${vp.width}.png`,fullPage:true});
  ok((await pg.textContent('.thi-score')).includes('2.5 / 4')&&(await pg.textContent('.thi-tl-result')).includes('1.5 / 2 điểm')&&(await pg.textContent('.thi-tl-result')).includes('còn thiếu ví dụ thứ hai'),'kết quả: điểm tự luận + nhận xét của AI từng câu');
  // AI lỗi → chờ chấm → Chấm lại
  gradeFail=true;await pg.click('.thi-actions button:has-text("Làm lại")');await pg.waitForSelector('textarea.thi-tl-input');
  await pg.check('.thi-form input[name=r2][value=A]');await pg.check('.thi-form input[name=r4][value=A]');await pg.fill('textarea.thi-tl-input','Điện thoại và máy tính bảng');
  await pg.click('.thi-submit');await pg.waitForSelector('dialog[open]');await pg.click('dialog[open] button:has-text("Nộp bài")');
  await pg.waitForSelector('.thi-tl-pending');const rec2=writes.filter(w=>w.path.endsWith('/thi_nop/t1/hs01.json')).at(-1).v;
  ok(rec2.cho_cham===true&&rec2.diem===2&&rec2.lan===2&&rec2.tu_luan.r3.tl.includes('máy tính bảng'),'AI lỗi: bài vẫn nộp được (điểm trắc nghiệm), đánh dấu chờ chấm, giữ bài làm');
  gradeFail=false;await pg.click('.thi-tl-regrade');await pg.waitForSelector('.thi-tl-item');
  const rec3=writes.filter(w=>w.path.endsWith('/thi_nop/t1/hs01.json')).at(-1).v;
  ok(rec3.cho_cham===false&&rec3.diem===3.5&&rec3.lan===2&&rec3.cao_nhat===3.5,'Chấm lại: AI chấm xong → cập nhật điểm (không tính thêm lần thi)');
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang');
  ok(!errs.length,'học sinh: không lỗi JS '+errs.join('|'));
  await ctx.close();
 }
 console.log(`THI TU LUAN OK ${n}`);
}catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await b.close();srv.close()}})();
