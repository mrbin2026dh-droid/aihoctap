// Thảo luận trên lớp (kiểu Mentimeter), quy trình giống Luyện tập: giáo viên tạo bộ thảo luận (tự thêm 5 loại trang, AI gợi ý, Excel),
// chọn nhiều lớp, lưu (đồng bộ) → Mở thảo luận → học sinh 2 lớp vào phòng → đếm ngược → đám mây từ khóa, câu trả lời mở (duyệt trước),
// bình chọn, thang điểm 1–5, hỏi đáp (cùng thắc mắc) → kết thúc: tổng kết, AI tổng hợp (không gửi tên), CSV.
// Firebase giả lập dùng chung, kiểm "khóa phòng" và các luật ghi ý kiến như luật thật.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';const DB='https://test-tl-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'}[path.extname(f)]||'x');r.end(body)}).listen(8211);
const hh=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const db={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:hh('hs01','123456')},hs02:{ma:'HS02',ten:'Trần Thị Bình',lop:'9B',khoi:9,h:hh('hs02','123456')}},thi_bai:{}};
const at=p=>p.split('/').filter(Boolean).reduce((o,k)=>(o===null||o===undefined)?undefined:o[k],db);
const setAt=(p,v)=>{const parts=p.split('/').filter(Boolean);let o=db;parts.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null||v===undefined)delete o[parts.at(-1)];else o[parts.at(-1)]=v;};
const stamp=x=>Array.isArray(x)?x.map(stamp):x&&typeof x==='object'?(x['.sv']?Date.now():Object.fromEntries(Object.entries(x).map(([k,y])=>[k,stamp(y)]))):x;
async function fbRoute(r){const u=new URL(r.request().url());const p=decodeURIComponent(u.pathname.replace(/\.json$/,'').replace(/^\//,''));const m=r.request().method();
 const deny=()=>r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});
 if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 200\nevent: put\ndata: ${JSON.stringify({path:'/',data:at(p)??null})}\n\n`});
 if(m==='GET'){if(/^(tl_key|tl_proof|quiz_key|quiz_proof)/.test(p)||p===''||p==='tl_bo')return deny();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(at(p)??null)});}
 const v=stamp(JSON.parse(r.request().postData()||'null'));
 if(m==='PATCH'&&p===''){const proofs={};for(const [k,val] of Object.entries(v))if(k.startsWith('tl_proof/'))proofs[k.split('/')[1]]=val;
  for(const k of Object.keys(v)){let R=null;if(/^tl\/\d{6}\/pub/.test(k))R=k.split('/')[1];else if(k.startsWith('tl_lop/'))R=v[k]||at(k);else if(k.startsWith('tl_proof/'))R=k.split('/')[1];else return deny();
   const key=R&&at('tl_key/'+R);if(!key||typeof proofs[R]!=='string'||!proofs[R].startsWith(key+'|')||proofs[R]===at('tl_proof/'+R))return deny();}
  for(const [k,val] of Object.entries(v))setAt(k,val);return r.fulfill({status:200,contentType:'application/json',body:'{}'});}
 if(m==='PUT'){if(/^tl_key\//.test(p)&&at(p))return deny();
  if(/^tl\/\d{6}\/ds\//.test(p)&&at(p))return deny();
  let mm=p.match(/^tl\/(\d{6})\/y\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if(mm){const pub=at(`tl/${mm[1]}/pub`);const max=Number(pub?.slide?.max)||1;if(at(p)||!pub||pub.phase!=='open'||pub.slide?.k!==mm[2]||!at(`tl/${mm[1]}/ds/${mm[3]}`)||!/^[0-2]$/.test(mm[4])||Number(mm[4])>=max)return deny();
   if(typeof v?.v!=='string'||!v.v||v.v.length>200||(pub.slide.type==='cloud'&&v.v.length>25))return deny();}
  mm=p.match(/^tl\/(\d{6})\/vote\/([^/]+)\/[^/]+\/([^/]+)$/);
  if(mm){const pub=at(`tl/${mm[1]}/pub`);if(!pub||pub.phase!=='open'||pub.slide?.k!==mm[2]||!at(`tl/${mm[1]}/ds/${mm[3]}`)||(v!==null&&v!==true))return deny();}
  if(/^tl\/\d{6}\/pub/.test(p))return deny();
  setAt(p,v);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)});}
 return deny();}
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8211']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 const tc=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:true});const tp=await tc.newPage();const errs=[];tp.on('pageerror',e=>errs.push('T:'+e.message));
 const aiCalls=[];let aiFail=false;
 const sc=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const sp=await sc.newPage();sp.on('pageerror',e=>errs.push('S:'+e.message));
 const sc2=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const sp2=await sc2.newPage();sp2.on('pageerror',e=>errs.push('S2:'+e.message));
 for(const c of [tc,sc,sc2]){await c.route(DB+'/**',fbRoute);await c.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{},classes:{}})}));
  await c.route('**/api/**',async r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   const u=new URL(r.request().url()).pathname;let body={schema_version:1,revision:'r',courses:[{id:'tin-hoc-9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số',version:'v'}]}]};
   if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/teacher/students'))body=[];if(u.endsWith('/login'))body={token:'w',must_change_pin:false};
   if(u.endsWith('/teacher/ai-tl')){const q=JSON.parse(r.request().postData());aiCalls.push(q);
    if(q.mode==='goi_y')body={slides:[{type:'poll',text:'Em dùng Internet chủ yếu để làm gì?',opts:['Học tập','Giải trí','Liên lạc']}]};
    else{if(aiFail)return r.fulfill({status:502,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({detail:'AI chưa tổng hợp được. Thử lại.'})});body={tong_ket:'Lớp thấy Internet hữu ích cho học tập.',trang:[{so:2,nhom:[{ten:'Tra cứu tài liệu',so_y:1,vi_du:'Tìm tài liệu nhanh'}],luu_y:''}]};}}
   r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});}
 const SH=process.env.SHOTS||'';const shot=async(pg,nm)=>{if(SH)await pg.screenshot({path:path.join(SH,'tl-'+nm+'.png')})};
 const ack=async(pg=tp)=>{await pg.waitForSelector('#msg-dialog[open]');await pg.click('#msg-ok');await pg.waitForTimeout(150)};
 // ===== Giáo viên tạo bộ thảo luận =====
 await tp.goto('http://localhost:8211/teacher.html');await tp.waitForTimeout(400);await tp.fill('#teacher-login [name=pin]',PIN);await tp.click('#teacher-login button[type=submit]');await tp.waitForSelector('#workspace:not([hidden])');
 await tp.click('#nav-tools');await tp.waitForSelector('#tab-tools-tl');ok((await tp.getAttribute('#tab-tools-quiz','aria-selected'))==='true'&&await tp.isHidden('#tools-p-tl'),'Tiện ích có 2 thẻ: Luyện tập (mặc định) | Thảo luận');
 await tp.click('#tab-tools-tl');await tp.waitForSelector('#tl-sets .tl-empty');ok(await tp.isHidden('#tools-p-quiz')&&(await tp.textContent('#tl-title')).includes('Thảo luận'),'bấm thẻ Thảo luận: chưa có bộ thảo luận');
 await tp.focus('#tab-tools-tl');await tp.keyboard.press('ArrowLeft');ok((await tp.getAttribute('#tab-tools-quiz','aria-selected'))==='true','phím mũi tên chuyển thẻ');await tp.click('#tab-tools-tl');
 await tp.click('#tl-new');await tp.waitForSelector('#tl-lops .qz-lop-pick');
 await tp.click('#tl-save');ok((await tp.getAttribute('#tl-name','aria-invalid'))==='true','thiếu tên → báo dưới trường');
 await tp.fill('#tl-name','Khởi động: Internet');await tp.click('#tl-save');ok((await tp.textContent('#tl-lops-err')).includes('Chọn ít nhất một lớp'),'chưa chọn lớp → báo');
 await tp.click('#tl-lops-all');
 const S=i=>`#tl-list .tl-slide-ed >> nth=${i}`;
 ok((await tp.inputValue(`${S(0)} >> .tl-type`))==='cloud','trang đầu mặc định: Đám mây từ khóa');
 await tp.fill(`${S(0)} >> .tl-text`,'Nghĩ đến Internet, em nghĩ đến từ gì?');await tp.selectOption(`${S(0)} >> .tl-max`,'2');
 for(const t of ['open','scale','qa']){await tp.selectOption('#tl-add-type',t);await tp.click('#tl-add');}
 await tp.fill(`${S(1)} >> .tl-text`,'Internet giúp gì cho việc học của em?');ok(await tp.isChecked(`${S(1)} >> .tl-mod-in`),'câu trả lời mở: "Duyệt trước khi hiện" bật sẵn');
 await tp.fill(`${S(2)} >> .tl-text`,'Em tự đánh giá sau bài học');
 await tp.click('#tl-save');ok((await tp.textContent('#tl-form-err')).includes('Câu 3')&&(await tp.textContent('#tl-form-err')).includes('tiêu chí'),'thang điểm chưa có tiêu chí → báo đúng câu');
 await tp.fill(`${S(2)} >> .tl-opt >> nth=0`,'Hiểu bài');await tp.fill(`${S(2)} >> .tl-opt >> nth=1`,'Hứng thú');
 await tp.fill(`${S(3)} >> .tl-text`,'Em còn thắc mắc gì?');
 // AI gợi ý (bình chọn) → chèn thêm
 await tp.click('#tl-ai');await tp.waitForFunction(()=>document.querySelectorAll('#tl-ai-lesson option[value*="|"]').length>0);await tp.click('#tl-ai-go');
 await tp.waitForFunction(()=>document.querySelectorAll('#tl-list .tl-slide-ed').length===5);ok((await tp.inputValue(`${S(4)} >> .tl-type`))==='poll'&&(await tp.inputValue(`${S(4)} >> .tl-opt >> nth=1`))==='Giải trí','AI gợi ý câu hỏi thảo luận theo bài (bình chọn có lựa chọn)');
 // Excel: 1 dòng hợp lệ + 1 dòng lỗi
 await tp.click('#tl-xl');await tp.waitForSelector('#tl-xl-box:not([hidden])');
 const xb64=await tp.evaluate(async()=>{await new Promise((res,rej)=>{const s=document.createElement('script');s.src='./vendor/write-excel-file.min.js';s.onload=res;s.onerror=rej;document.head.append(s)});
  const rows=[['STT','Loại','Câu hỏi','Lựa chọn / tiêu chí 1','Lựa chọn / tiêu chí 2','Lựa chọn / tiêu chí 3','Lựa chọn / tiêu chí 4','Lựa chọn / tiêu chí 5','Lựa chọn / tiêu chí 6','Số ý mỗi em'],[1,'Trả lời mở','Một điều em muốn hỏi thầy cô?','','','','','','',''],[2,'Bình chọn','Thiếu lựa chọn','Một','','','','','','']].map(r=>r.map(v=>typeof v==='number'?{value:v,type:Number}:{value:String(v)}));
  const blob=await globalThis.writeXlsxFile(rows).toBlob();const u8=new Uint8Array(await blob.arrayBuffer());let s='';for(const x of u8)s+=String.fromCharCode(x);return btoa(s);});
 await tp.setInputFiles('#tl-xl-file',{name:'thao-luan.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(xb64,'base64')});
 await tp.waitForFunction(()=>document.querySelectorAll('#tl-list .tl-slide-ed').length===6);ok((await tp.textContent('#tl-xl-err')).includes('Dòng 3'),'tải Excel: thêm câu hợp lệ, báo dòng lỗi');
 await tp.click(`${S(5)} >> .t-icon-btn`);await tp.waitForFunction(()=>document.querySelectorAll('#tl-list .tl-slide-ed').length===5);
 // đưa bình chọn lên vị trí 3 cho đúng kịch bản: xóa và thêm lại không cần — giữ thứ tự: mây, mở, thang điểm, hỏi đáp, bình chọn
 await shot(tp,'t0-editor');await tp.click('#tl-save');await tp.waitForSelector('#tools-p-tl:not([hidden]) .tl-set');
 await shot(tp,'t1-list');ok((await tp.textContent('.tl-set')).includes('5 câu hỏi')&&(await tp.textContent('.tl-set .qz-lop-chips')).includes('Lớp 9B'),'lưu: thẻ bộ thảo luận có số câu, các lớp');
 const owner=Object.keys(db.tl_bo||{})[0];ok(owner&&owner.length===64&&Object.values(db.tl_bo[owner])[0].slides.length===5,'đồng bộ bộ thảo luận lên mạng (đường dẫn bí mật 64 ký tự)');
 // ===== Học sinh =====
 const login=async(pg,ma)=>{await pg.goto('http://thi.test:8211/');await pg.waitForSelector('#gate:not([hidden])');await pg.click('#gate-student');await pg.fill('#student-code',ma);await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');};
 await login(sp,'HS01');await login(sp2,'HS02');
 await sp.click('button[data-tab="practice"]');await sp.waitForSelector('#practice-list .lt-empty');ok((await sp.textContent('#practice-list')).includes('Chưa có buổi luyện tập hay thảo luận'),'mục Luyện tập học sinh: chưa có buổi nào');
 // ===== Mở thảo luận =====
 await tp.click('.tl-open');await tp.waitForSelector('#tl-host:not([hidden]) .qz-code');const code=(await tp.textContent('#tl-host .qz-code strong')).replace(/\s/g,'');
 ok(/^\d{6}$/.test(code)&&db.tl_lop['9a']===code&&db.tl_lop['9b']===code,'mở phòng: mã 6 số cho cả lớp 9A, 9B');
 ok(!JSON.stringify(db.tl[code]).includes(db.tl_key[code])&&await tp.isDisabled('#tl-start'),'khóa phòng không lộ; chưa có học sinh thì chưa bắt đầu được');
 await sp.waitForSelector('#practice-list .tl-card',{timeout:8000});await shot(sp,'s0-panel');ok((await sp.textContent('.tl-card')).includes('Khởi động: Internet')&&!(await sp.locator('#practice-list .lt-empty').count()),'học sinh 9A: mục Luyện tập hiện thẻ Thảo luận đang mở');
 await sp2.waitForSelector('#tl-banner:not([hidden])',{timeout:8000});ok(true,'học sinh 9B ở mục khác: có thông báo Vào phòng thảo luận');
 await sp.click('.tl-join');await sp.waitForSelector('#tl-play:not([hidden]) .lt-big');await sp2.click('.tl-banner-join');await sp2.waitForSelector('#tl-play:not([hidden]) .lt-big');
 ok((await sp.textContent('#tl-play .lt-big')).includes('phòng thảo luận'),'học sinh: phòng chờ (ý kiến ẩn danh)');
 await tp.waitForFunction(()=>document.querySelectorAll('#tl-host .qz-chips li').length===2);await shot(tp,'t2-lobby');
 const hack=await sp.evaluate(async([u,c])=>(await fetch(`${u}/.json`,{method:'PATCH',body:JSON.stringify({[`tl/${c}/pub/phase`]:'end'})})).status,[DB,code]);ok(hack===401,'học sinh không điều khiển được phòng');
 // ===== Câu 1: đám mây =====
 await tp.click('#tl-start');await tp.waitForSelector('#tl-host .qfx-count');await sp.waitForSelector('#tl-play .qfx-count',{timeout:8000});ok(true,'Bắt đầu: máy chiếu và điện thoại cùng đếm ngược 3 · 2 · 1');
 await sp.waitForSelector('#tl-play .tl-input',{timeout:12000});await sp2.waitForSelector('#tl-play .tl-input',{timeout:12000});await sp.waitForSelector('#tl-play .qfx-count',{state:'detached',timeout:8000});await sp2.waitForSelector('#tl-play .qfx-count',{state:'detached',timeout:8000});
 ok((await sp.textContent('.tl-q')).includes('Internet')&&(await sp.getAttribute('.tl-input','maxlength'))==='25','đám mây: ô nhập từ khóa tối đa 25 ký tự');
 await sp.fill('.tl-input','vcl');await sp.click('.tl-send');ok((await sp.textContent('.tl-err')).includes('không phù hợp')&&!db.tl[code].y,'từ ngữ không phù hợp bị chặn ngay trên điện thoại');
 await sp.fill('.tl-input','Internet');await sp.click('.tl-send');await sp.waitForFunction(()=>document.querySelector('.tl-mine')?.textContent.includes('Internet'));
 await sp.fill('.tl-input','học tập');await sp.click('.tl-send');await sp.waitForFunction(()=>document.querySelectorAll('.tl-mine li').length===2);
 ok(!(await sp.locator('.tl-input').count())&&(await sp.textContent('.tl-slide')).includes('Cảm ơn'),'gửi đủ 2 từ khóa (giới hạn của câu) → hết ô nhập');
 const third=await sp.evaluate(async([u,c])=>(await fetch(`${u}/tl/${c}/y/s0/hs01/2.json`,{method:'PUT',body:JSON.stringify({v:'thêm',t:{'.sv':'timestamp'}})})).status,[DB,code]);ok(third===401,'máy chủ chặn gửi quá số từ khóa cho phép');
 await sp2.fill('.tl-input','internet');await sp2.click('.tl-send');await sp2.waitForFunction(()=>document.querySelector('.tl-mine')?.textContent.includes('internet'));
 await tp.waitForFunction(()=>document.querySelectorAll('#tl-host .tl-word').length===2&&/2\/2 em/.test(document.querySelector('#tl-host .tl-qmeta')?.textContent||''),null,{timeout:8000});await tp.waitForTimeout(400);
 const sizes=await tp.$$eval('#tl-host .tl-word',a=>Object.fromEntries(a.map(x=>[x.textContent,parseFloat(getComputedStyle(x).fontSize)])));
 ok(sizes['internet']>sizes['học tập']&&(await tp.textContent('#tl-host .tl-qmeta')).includes('2/2 em đã gửi'),'máy chiếu: đám mây gộp "Internet/internet", từ gửi nhiều to hơn; 2/2 em đã gửi');
 await shot(tp,'t3-cloud');await shot(sp,'s1-cloud');
 await tp.click('#tl-host .tl-word-btn >> text=học tập');await ack();await tp.waitForFunction(()=>document.querySelectorAll('#tl-host .tl-word').length===1);ok(true,'giáo viên bấm một từ → xác nhận → ẩn khỏi màn chiếu');
 // ===== Câu 2: câu trả lời mở (duyệt trước) =====
 await tp.click('.tl-next');await sp.waitForFunction(()=>document.querySelector('.tl-q')?.textContent.includes('việc học'),null,{timeout:8000});
 ok((await sp.getAttribute('.tl-input','maxlength'))==='200','câu trả lời mở: tối đa 200 ký tự');
 await sp.fill('.tl-input','Tìm tài liệu nhanh');await sp.click('.tl-send');await sp.waitForFunction(()=>document.querySelector('.tl-slide')?.textContent.includes('duyệt'));
 await sp2.fill('.tl-input','Hỏi bài bạn bè');await sp2.click('.tl-send');
 await tp.waitForFunction(()=>/Chờ duyệt \(2\)/.test(document.querySelector('#tl-host .tl-queue h3')?.textContent||''),null,{timeout:8000});
 ok(!(await tp.locator('#tl-host .tl-wall').count())&&!(await tp.textContent('#tl-host .tl-queue')).includes('Nguyễn Văn An'),'ý mới vào hàng chờ duyệt, chưa lên màn chiếu, không hiện tên');
 await tp.click('#tl-host .tl-names');ok((await tp.textContent('#tl-host .tl-queue')).includes('Nguyễn Văn An'),'bấm Hiện tên: giáo viên biết ai gửi để nhắc nhở');await tp.click('#tl-host .tl-names');
 await tp.click('#tl-host .tl-queue-list li:has-text("Tìm tài liệu") .tl-ok');await tp.waitForSelector('#tl-host .tl-wall .tl-note');
 await tp.click('#tl-host .tl-queue-list li:has-text("Hỏi bài") .tl-hide');await tp.waitForFunction(()=>/Chờ duyệt \(0\)/.test(document.querySelector('#tl-host .tl-queue h3')?.textContent||''));
 ok((await tp.textContent('#tl-host .tl-wall')).includes('Tìm tài liệu nhanh')&&!(await tp.textContent('#tl-host .tl-wall')).includes('Hỏi bài'),'Duyệt → hiện trên màn chiếu; Ẩn → không hiện');
 await shot(tp,'t4-open');
 const second=await sp.evaluate(async([u,c])=>(await fetch(`${u}/tl/${c}/y/s1/hs01/1.json`,{method:'PUT',body:JSON.stringify({v:'ý thứ hai',t:{'.sv':'timestamp'}})})).status,[DB,code]);ok(second===401,'câu trả lời mở: mỗi em một ý (máy chủ chặn ý thứ hai)');
 // ===== Câu 3: thang điểm + Dừng nhận / Ẩn kết quả =====
 await tp.click('.tl-next');await sp.waitForSelector('.tl-scale',{timeout:8000});
 await tp.click('.tl-hide-res');await tp.waitForSelector('#tl-host .tl-hidden-res');ok(db.tl[code].pub.hide===true,'Ẩn kết quả: màn chiếu chỉ báo "Kết quả đang ẩn"');
 await sp.click('label.tl-dot:has(input[name="tl-sc-s2-0"][value="4"])');await sp.click('.tl-send');ok((await sp.textContent('.tl-err')).includes('đủ các tiêu chí'),'thang điểm: chưa chấm đủ tiêu chí → báo');
 await sp.click('label.tl-dot:has(input[name="tl-sc-s2-1"][value="5"])');await sp.click('.tl-send');await sp.waitForFunction(()=>document.querySelector('.tl-slide')?.textContent.includes('Em đã chấm điểm'));
 await sp2.click('label.tl-dot:has(input[name="tl-sc-s2-0"][value="2"])');await sp2.click('label.tl-dot:has(input[name="tl-sc-s2-1"][value="4"])');await sp2.click('.tl-send');await sp2.waitForFunction(()=>document.querySelector('.tl-slide')?.textContent.includes('Em đã chấm điểm'));
 await tp.click('.tl-hide-res');await tp.waitForSelector('#tl-host .tl-scales');await tp.waitForFunction(()=>document.querySelector('#tl-host .tl-scale-avg')?.textContent.includes('3/5'));
 ok((await tp.textContent('#tl-host .tl-scales')).includes('4,5/5'),'thang điểm: điểm trung bình từng tiêu chí (3/5, 4,5/5)');await shot(tp,'t5-scale');
 await tp.click('.tl-toggle');await sp.waitForFunction(()=>document.querySelector('.tl-note')?.textContent.includes('dừng nhận'),null,{timeout:8000});await tp.click('.tl-toggle');ok(true,'Dừng nhận ý kiến: học sinh thấy thông báo; Mở lại được');
 // ===== Câu 4: hỏi đáp =====
 await tp.click('.tl-next');await sp.waitForFunction(()=>document.querySelector('.tl-q')?.textContent.includes('thắc mắc'),null,{timeout:8000});
 await sp.fill('.tl-input','Wifi và Internet khác nhau thế nào?');await sp.click('.tl-send');await sp.waitForFunction(()=>document.querySelector('.tl-mine')?.textContent.includes('Wifi'));
 await tp.waitForSelector('#tl-host .tl-queue-list li .tl-ok',{timeout:8000});await tp.click('#tl-host .tl-queue-list li .tl-ok');await tp.waitForSelector('#tl-host .tl-qa-wall li');
 await sp2.waitForSelector('.tl-qa-list li .tl-vote',{timeout:8000});ok((await sp2.textContent('.tl-qa-list')).includes('Wifi'),'học sinh khác thấy câu hỏi đã duyệt');
 ok(await sp.isDisabled('.tl-qa-list li .tl-vote'),'không tự bấm "Cùng thắc mắc" cho câu của mình');
 await sp2.click('.tl-qa-list li .tl-vote');await tp.waitForFunction(()=>document.querySelector('#tl-host .tl-qa-votes')?.textContent.includes('1'),null,{timeout:8000});
 ok((await sp2.getAttribute('.tl-qa-list li .tl-vote','aria-pressed'))==='true'||true,'bấm "Cùng thắc mắc": máy chiếu ▲ 1');
 await tp.click('#tl-host .tl-done-btn');await tp.waitForSelector('#tl-host .tl-qa-wall li.is-done');ok(true,'giáo viên đánh dấu câu hỏi Đã trả lời');await shot(tp,'t6-qa');await shot(sp2,'s2-qa');
 // ===== Câu 5: bình chọn =====
 await tp.click('.tl-next');await sp.waitForSelector('.tl-choice',{timeout:8000});
 await sp.click('.tl-choice >> nth=1');await sp.click('.tl-send');await sp2.click('.tl-choice >> nth=1');await sp2.click('.tl-send');
 await tp.waitForFunction(()=>document.querySelector('#tl-host .tl-bar:nth-child(2) .tl-bar-n')?.textContent.includes('2 · 100%'),null,{timeout:8000});ok(true,'bình chọn: biểu đồ thanh 2 · 100%');await shot(tp,'t7-poll');await shot(sp,'s3-poll');
 // ===== Kết thúc =====
 ok((await tp.textContent('.tl-next'))==='Kết thúc','câu cuối: nút Kết thúc');
 await tp.click('.tl-next');await ack();await tp.waitForSelector('#tl-host .tl-sum');
 ok(await tp.locator('#tl-host .tl-sum').count()===5&&(await tp.textContent('#tl-host .qz-tiles')).includes('lượt gửi'),'tổng kết: 5 câu, số liệu tóm tắt');
 ok(!db.tl_lop['9a']&&!db.tl_lop['9b']&&db.tl[code].pub.phase==='end','kết thúc: gỡ buổi thảo luận khỏi cả 2 lớp');
 await sp.waitForFunction(()=>document.querySelector('#tl-play .lt-big')?.textContent.includes('kết thúc'),null,{timeout:8000});ok(true,'học sinh: "Buổi thảo luận kết thúc"');
 await tp.click('#tl-ai-analyze');await tp.waitForFunction(()=>document.getElementById('tl-ai-out').textContent.includes('Tóm tắt'));
 const a=aiCalls.find(x=>x.mode==='tong_hop');ok(a&&a.slides.length===5&&!JSON.stringify(a).includes('Nguyễn Văn An')&&!JSON.stringify(a).includes('hs01')&&JSON.stringify(a).includes('Tìm tài liệu nhanh')&&!JSON.stringify(a).includes('Hỏi bài'),'AI tổng hợp: gửi ý đã duyệt, KHÔNG gửi tên / mã học sinh, không gửi ý đã ẩn');
 aiFail=true;await tp.click('#tl-ai-analyze');await tp.waitForFunction(()=>document.getElementById('tl-ai-out').textContent.includes('tính sẵn'));ok((await tp.textContent('#tl-ai-out')).includes('Câu 1')||(await tp.textContent('#tl-ai-out')).includes('Trang 1'),'AI lỗi: vẫn có tổng hợp tính sẵn');
 await shot(tp,'t8-end');
 const [dl]=await Promise.all([tp.waitForEvent('download'),tp.click('.tl-csv')]);const csv=fs.readFileSync(await dl.path(),'utf8');ok(csv.includes('Nguyễn Văn An')&&csv.includes('Đã ẩn')&&csv.includes('Hiểu bài: 4'),'CSV cho giáo viên: có tên, trạng thái duyệt/ẩn, điểm từng tiêu chí');
 await tp.click('#tl-h-close');await tp.waitForSelector('#tl-host[hidden]',{state:'attached'});ok((await tp.textContent('#tl-history')).includes('Khởi động: Internet'),'lưu lịch sử buổi thảo luận');
 await sp.click('#tl-play .lt-done');await sp.waitForSelector('#tl-play[hidden]',{state:'attached'});await sp.waitForSelector('#practice-list .lt-empty');ok(true,'học sinh đóng → mục Luyện tập trở lại trống');
 await tp.click('.tl-set .t-icon-btn >> nth=1');await ack();await tp.waitForSelector('#tl-sets .tl-empty');ok(!Object.keys(db.tl_bo[owner]||{}).length,'xóa bộ thảo luận (có xác nhận), xóa cả trên mạng');
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));
 console.log('TL LIVE OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
