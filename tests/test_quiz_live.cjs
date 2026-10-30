// Luyện tập trên lớp (kiểu Kahoot/Quizizz): giáo viên tạo bộ câu hỏi (tự nhập, AI soạn phải duyệt, tải Excel), chọn nhiều lớp, lưu (đồng bộ) →
// Mở luyện tập → học sinh 2 lớp vào phòng ở mục Luyện tập → câu hỏi, tạm dừng/tiếp tục, hiện đáp án, kết thúc sớm → vinh danh, danh hiệu.
// Firebase giả lập dùng chung cho 2 trình duyệt, có kiểm "khóa phòng" (chỉ chủ phòng ghi được trạng thái) như luật thật.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';const DB='https://test-quiz-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(body)}).listen(8207);
const hh=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const db={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:hh('hs01','123456')},hs02:{ma:'HS02',ten:'Trần Thị Bình',lop:'9B',khoi:9,h:hh('hs02','123456')}},thi_bai:{}};
const at=p=>p.split('/').filter(Boolean).reduce((o,k)=>(o === null || o === undefined)?undefined:o[k],db);
const setAt=(p,v)=>{const parts=p.split('/').filter(Boolean);let o=db;parts.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null||v===undefined)delete o[parts.at(-1)];else o[parts.at(-1)]=v;};
const stamp=x=>Array.isArray(x)?x.map(stamp):x&&typeof x==='object'?(x['.sv']?Date.now():Object.fromEntries(Object.entries(x).map(([k,y])=>[k,stamp(y)]))):x;
const denied=[];
async function fbRoute(r){const u=new URL(r.request().url());const p=u.pathname.replace(/\.json$/,'').replace(/^\//,'');const m=r.request().method();
 const deny=why=>{denied.push(why);return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});};
 if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 200\nevent: put\ndata: ${JSON.stringify({path:'/',data:at(p)??null})}\n\n`});
 if(m==='GET'){if(p.startsWith('quiz_key')||p.startsWith('quiz_proof')||p===''||p.startsWith('quiz_proof'))return deny('read '+p);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(at(p)??null)});}
 const v=stamp(JSON.parse(r.request().postData()||'null'));
 if(m==='PATCH'&&p===''){const proofs={};for(const [k,val] of Object.entries(v))if(k.startsWith('quiz_proof/'))proofs[k.split('/')[1]]=val;
  for(const k of Object.keys(v)){let R=null;if(/^quiz\/\d{6}\/(pub|kq)/.test(k))R=k.split('/')[1];else if(k.startsWith('quiz_lop/'))R=v[k]||at(k);else if(k.startsWith('quiz_proof/'))R=k.split('/')[1];
   else if(/^quiz_kq_lop\/[a-z0-9]{1,40}\/20\d\d-(0[1-9]|1[0-2])\/\d{6}$/.test(k)){R=k.split('/')[3];const val=v[k];if(at(k)&&val!==null)return deny('kq exists');if(val!==null){if(!(val.so_cau>=1&&val.so_cau<=200)||typeof val.at!=='object'&&typeof val.at!=='number')return deny('kq bad');for(const e of Object.values(val.kq||{}))if(!(Number.isInteger(e.c)&&e.c>=0&&e.c<=val.so_cau&&typeof e.ten==='string'))return deny('kq c');if(Object.keys(val).some(x=>!['at','bo','so_cau','kq'].includes(x)))return deny('kq field');}}
   else return deny('path '+k);
   const key=R&&at('quiz_key/'+R);if(!key||typeof proofs[R]!=='string'||!proofs[R].startsWith(key+'|')||proofs[R]===at('quiz_proof/'+R))return deny('proof '+k);}
  for(const [k,val] of Object.entries(v))setAt(k,val);return r.fulfill({status:200,contentType:'application/json',body:'{}'});}
 if(m==='PUT'){if(p.startsWith('quiz_key/')&&at(p))return deny('key exists');
  if(/^quiz\/\d{6}\/ds\//.test(p)&&at(p))return deny('joined');
  const mm=p.match(/^quiz\/(\d{6})\/ans\/([^/]+)\/[^/]+$/);if(mm){const pub=at(`quiz/${mm[1]}/pub`);if(at(p)||!pub||pub.phase!=='q'||pub.q?.k!==mm[2])return deny('ans');}
  if(/^quiz\/\d{6}\/(pub|kq)/.test(p))return deny('direct pub');
  if(p.startsWith('quiz_kq_lop'))return deny('direct kq_lop');
  if(p.startsWith('quiz_ls/')&&!/^quiz_ls\/[0-9a-f]{64}\//.test(p))return deny('ls owner');
  setAt(p,v);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)});}
 return deny('method');}
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8207']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 const tc=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:true});const tp=await tc.newPage();const errs=[];tp.on('pageerror',e=>errs.push('T:'+e.message));
 const sc=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const sp=await sc.newPage();sp.on('pageerror',e=>errs.push('S:'+e.message));
 const aiCalls=[];let aiFail=false;
 for(const c of [tc,sc]){await c.route(DB+'/**',fbRoute);await c.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{},classes:{'9A':9}})}));
  await c.route('**/api/**',async r=>{const u=new URL(r.request().url()).pathname;let body={schema_version:1,revision:'r',courses:[{id:'tin-hoc-9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số',version:'v'}]}]};
   if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/teacher/students'))body=[];if(u.endsWith('/login'))body={token:'w',must_change_pin:false};
   if(u.endsWith('/teacher/ai-questions'))body={questions:[{text:'Bit là gì?',options:{A:'Đơn vị nhỏ nhất',B:'Ổ cứng',C:'Màn hình',D:'Chuột'},answer:'A',topic:'Mã nhị phân',explain:'Theo bài'}]};
   if(u.endsWith('/teacher/ai-quiz')){aiCalls.push(JSON.parse(r.request().postData()));if(aiFail)return r.fulfill({status:502,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({detail:'AI chưa phân tích được. Thử lại.'})});body={muc_hieu:'Khá',nhan_xet:'**Mức hiểu chung** Khá. **Hiểu lầm cần sửa** câu 2.'};}
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});}

 const sc2=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const sp2=await sc2.newPage();sp2.on('pageerror',e=>errs.push('S2:'+e.message));
 for(const c of [sc2]){await c.route(DB+'/**',fbRoute);await c.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{},classes:{}})}));
  await c.route('**/api/**',r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});const u=new URL(r.request().url()).pathname;let body={schema_version:1,revision:'r',courses:[]};if(u.endsWith('/login'))body={token:'w',must_change_pin:false};r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});}
 const SH=process.env.SHOTS||'';const shot=async(pg,nm)=>{if(SH)await pg.screenshot({path:path.join(SH,'lt-'+nm+'.png')})};
 const ack=async(sel='#msg-ok')=>{await tp.waitForSelector('#msg-dialog[open]');await tp.click(sel);await tp.waitForTimeout(150)};
 // Giáo viên tạo bộ câu hỏi
 await tp.goto('http://localhost:8207/teacher.html');await tp.waitForTimeout(400);await tp.fill('#teacher-login [name=pin]',PIN);await tp.click('#teacher-login button[type=submit]');await tp.waitForSelector('#workspace:not([hidden])');
 ok(await tp.isVisible('#nav-tools'),'menu Tiện ích');await tp.click('#nav-tools');await tp.waitForSelector('#qz-sets .qz-empty');ok((await tp.textContent('#qz-title')).includes('Luyện tập'),'Tiện ích → Luyện tập trên lớp, chưa có bộ câu hỏi');
 await tp.click('#qz-new');await tp.waitForSelector('#qz-lops .qz-lop-pick');
 ok(JSON.stringify(await tp.$$eval('#qz-lops input',a=>a.map(x=>x.value)))==='["9A","9B"]','chọn lớp: danh sách các lớp có học sinh (chọn được nhiều lớp)');
 await tp.click('#qz-save');ok((await tp.getAttribute('#qz-name','aria-invalid'))==='true','thiếu tên → báo dưới trường');
 await tp.fill('#qz-name','Ôn nhanh bài 1');await tp.click('#qz-save');ok((await tp.textContent('#qz-lops-err')).includes('Chọn ít nhất một lớp'),'chưa chọn lớp → báo lỗi');
 await tp.click('#qz-lops-all');ok(await tp.$$eval('#qz-lops input',a=>a.every(x=>x.checked)),'Chọn tất cả lớp');
 const fillQ=async(i,text,opts,ans)=>{const f=`#qz-list .qz-q >> nth=${i}`;await tp.fill(`${f} >> .qz-text`,text);for(const [k,v] of Object.entries(opts))await tp.fill(`${f} >> .qz-opt[data-k="${k}"]`,v);await tp.selectOption(`${f} >> .qz-ans`,ans);};
 await fillQ(0,'1 byte bằng bao nhiêu bit?',{A:'4',B:'8',C:'16',D:'2'},'B');
 // Tải câu hỏi từ Excel (file tạo bằng chính bộ ghi Excel của ứng dụng)
 await tp.click('#qz-xl');await tp.waitForSelector('#qz-xl-box:not([hidden])');
 const xb64=await tp.evaluate(async()=>{await new Promise((res,rej)=>{const s=document.createElement('script');s.src='./vendor/write-excel-file.min.js';s.onload=res;s.onerror=rej;document.head.append(s)});
  const rows=[['STT','Câu hỏi','A','B','C','D','Đáp án đúng','Chủ đề'],[1,'Thiết bị nào nhập dữ liệu?','Loa','Máy in','Bàn phím','Màn hình','C','Thiết bị'],[2,'Dòng lỗi','x','','','','A','']].map(r=>r.map(v=>typeof v==='number'?{value:v,type:Number}:{value:String(v)}));
  const blob=await globalThis.writeXlsxFile(rows).toBlob();const u8=new Uint8Array(await blob.arrayBuffer());let s='';for(const x of u8)s+=String.fromCharCode(x);return btoa(s);});
 await tp.setInputFiles('#qz-xl-file',{name:'cau-hoi.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(xb64,'base64')});
 await tp.waitForFunction(()=>document.querySelectorAll('#qz-list .qz-q').length===2);
 ok((await tp.textContent('#qz-xl-err')).includes('Dòng 3'),'tải Excel: thêm câu hợp lệ, báo dòng lỗi');
 ok((await tp.inputValue('#qz-list .qz-q >> nth=1 >> .qz-text')).includes('nhập dữ liệu')&&(await tp.inputValue('#qz-list .qz-q >> nth=1 >> .qz-ans'))==='C','câu từ Excel đúng nội dung + đáp án');
 await tp.click('#qz-ai');await tp.waitForFunction(()=>document.querySelectorAll('#qz-ai-lesson option[value*="|"]').length>0);await tp.click('#qz-ai-go');await tp.waitForSelector('#qz-list .qz-q.is-ai');
 ok(await tp.locator('#qz-list .qz-q').count()===3,'AI soạn thêm câu theo bài');
 await shot(tp,'t0-editor');await tp.click('#qz-save');ok((await tp.textContent('#qz-form-err')).includes('Đã duyệt'),'câu AI chưa duyệt → không lưu');
 await tp.check('#qz-list .qz-ok');await tp.click('#qz-save');await tp.waitForSelector('#list-tools:not([hidden]) .qz-set');
 await shot(tp,'t1-list');ok((await tp.textContent('.qz-set')).includes('3 câu')&&(await tp.textContent('.qz-set .qz-lop-chips')).includes('Lớp 9B'),'lưu: thẻ bộ câu hỏi có số câu, các lớp');
 const owner=Object.keys(db.quiz_bo||{})[0];ok(owner&&owner.length===64&&Object.values(db.quiz_bo[owner])[0].qs.length===3,'đồng bộ bộ câu hỏi lên mạng (đường dẫn bí mật 64 ký tự)');
 const ob=await tp.locator('.qz-open').boundingBox();ok(ob&&ob.height<80&&ob.width<400,'nút Mở luyện tập không phủ kín màn hình (lỗi trùng lớp CSS cũ)');
 await tp.click('.qz-set .t-icon-btn >> nth=0');await tp.waitForSelector('#detail-tools:not([hidden])');await tp.waitForSelector('#qz-lops input');ok(await tp.$$eval('#qz-lops input',a=>a.every(x=>x.checked))&&(await tp.inputValue('#qz-name'))==='Ôn nhanh bài 1','sửa: mở lại đúng tên, lớp');await tp.click('#qz-back');await tp.waitForSelector('#list-tools:not([hidden])');
 // Hai học sinh khác lớp đăng nhập
 const login=async(pg,ma)=>{await pg.goto('http://thi.test:8207/');await pg.waitForSelector('#gate:not([hidden])');await pg.click('#gate-student');await pg.fill('#student-code',ma);await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');};
 await login(sp,'HS01');await login(sp2,'HS02');
 await sp.click('button[data-tab="practice"]');await sp.waitForSelector('#practice-list .lt-empty');ok((await sp.textContent('#practice-list')).includes('Chưa có buổi luyện tập'),'mục Luyện tập học sinh: chưa có buổi luyện tập (đã bỏ danh sách luyện tập cũ)');
 // Mở luyện tập
 await tp.click('.qz-open');await tp.waitForSelector('#qz-host:not([hidden]) .qz-code');const code=(await tp.textContent('.qz-code strong')).replace(/\s/g,'');
 ok(typeof db.quiz[code].pub.hb==='number'&&db.quiz[code].pub.hb>0,'mở phòng: ghi nhịp hb (giờ máy chủ) để học sinh biết phòng còn mở');
 ok(/^\d{6}$/.test(code)&&db.quiz_lop['9a']===code&&db.quiz_lop['9b']===code,'mở phòng: mã 6 số, mở cho cả 2 lớp 9A, 9B');
 ok(!JSON.stringify(db.quiz[code]).includes(db.quiz_key[code]),'khóa phòng không nằm ở chỗ học sinh đọc được');
 ok(await tp.isDisabled('#qz-start'),'chưa có học sinh → chưa bắt đầu được');
 await sp.waitForSelector('#practice-list .lt-card',{timeout:8000});await shot(sp,'s0-panel');ok((await sp.textContent('.lt-card')).includes('Ôn nhanh bài 1')&&(await sp.textContent('.lt-card')).includes('3 câu'),'học sinh lớp 9A: mục Luyện tập hiện buổi luyện tập ngay');
 await sp2.waitForSelector('#lt-banner:not([hidden])',{timeout:8000});ok(true,'học sinh lớp 9B ở mục khác: có thông báo Vào phòng');
 await sp.click('.lt-join');await sp.waitForSelector('#lt-play:not([hidden]) .lt-big');await sp2.click('.lt-banner-join');await sp2.waitForSelector('#lt-play:not([hidden]) .lt-big');
 await shot(sp,'s1-lobby');ok((await sp.textContent('.lt-big')).includes('Em đã vào phòng'),'học sinh: phòng chờ');
 await tp.waitForFunction(()=>document.querySelectorAll('.qz-chips li').length===2);ok((await tp.textContent('.qz-chips')).includes('Trần Thị Bình')&&!(await tp.isDisabled('#qz-start')),'máy chiếu: thấy 2 học sinh đã vào, bật nút Bắt đầu');
 await shot(tp,'t2-lobby');const hack=await sp.evaluate(async([u,c])=>{const r=await fetch(`${u}/.json`,{method:'PATCH',body:JSON.stringify({[`quiz/${c}/pub/phase`]:'end'})});return r.status},[DB,code]);ok(hack===401,'học sinh không điều khiển được phòng');
 // Câu 1: An đúng, Bình sai → cả lớp trả lời → tự công bố
 await tp.click('#qz-start');await tp.waitForSelector('#qz-host .qfx-count');await sp.waitForSelector('#lt-play .qfx-count',{timeout:8000});await tp.waitForTimeout(700);await shot(tp,'t2b-countdown');await shot(sp,'s1b-countdown');
 ok(/[123]/.test(await tp.textContent('#qz-host .qfx-num'))&&/[123]|Bắt đầu/.test(await sp.textContent('#lt-play .qfx-num')),'bấm Bắt đầu: máy chiếu và điện thoại cùng đếm ngược 3 · 2 · 1');
 await sp.waitForSelector('#lt-play .lt-intro-q',{timeout:12000});await tp.waitForSelector('#qz-host .qz-intro');await shot(tp,'t2c-intro');await shot(sp,'s1c-intro');
 ok(db.quiz[code].pub.phase==='intro'&&!db.quiz[code].pub.q.opts&&(await sp.textContent('.lt-intro-q')).includes('1 byte')&&!(await sp.locator('.lt-opt').count()),'đọc câu hỏi trước: hiện câu hỏi, chưa có phương án (cả máy chủ cũng chưa gửi)');
 const early=await sp.evaluate(async([u,c])=>{const r=await fetch(`${u}/quiz/${c}/ans/q0/hs01.json`,{method:'PUT',body:JSON.stringify({a:'B',t:{'.sv':'timestamp'}})});return r.status},[DB,code]);ok(early===401,'đang đọc câu hỏi: máy chủ chưa nhận câu trả lời');
 await sp.waitForSelector('.lt-opt',{timeout:12000});await sp2.waitForSelector('.lt-opt',{timeout:12000});await sp.waitForSelector('#lt-play .qfx-count',{state:'detached',timeout:8000});ok(await tp.locator('#qz-host .qfx-count').count()===0,'đếm ngược xong tự biến mất, vào câu 1');
 ok(!JSON.stringify(db.quiz[code].pub).includes('"ans"'),'đang hỏi: đáp án chưa gửi xuống');
 ok((await sp.textContent('.lt-q')).includes('1 byte')&&await sp.locator('.lt-opt').count()===4&&(await sp.textContent('.lt-opt.lt-A b'))==='▲','học sinh thấy câu hỏi + 4 ô màu có hình');
 await shot(sp,'s2-q');await shot(tp,'t3-q');await sp.click('.lt-opt.lt-B');await sp2.click('.lt-opt.lt-A');
 await sp.waitForSelector('.lt-result.is-ok',{timeout:8000});await sp2.waitForSelector('.lt-result.is-bad',{timeout:8000});
 await sp.waitForFunction(()=>/\+\d+ điểm/.test(document.querySelector('.lt-result')?.textContent||''));const g1=Number((await sp.textContent('.lt-gain')).match(/\d+/)[0]);
 await shot(sp,'s3-ok');await shot(sp2,'s3-bad');ok(g1>=500&&g1<=1000,`đúng: "Chính xác! +${g1} điểm" (công thức Kahoot 500–1000)`);
 ok((await sp2.textContent('.lt-result')).includes('Đáp án đúng: ◆ B'),'sai: báo đáp án đúng');
 await tp.waitForSelector('.qz-opts.is-reveal');await tp.waitForTimeout(800);await shot(tp,'t4-reveal');ok((await tp.textContent('.qz-opt.is-ans')).includes('8')&&(await tp.textContent('.qz-col.is-ans .qz-col-n'))==='1'&&await tp.locator('.qz-chart .qz-col').count()===4,'máy chiếu: biểu đồ cột số em chọn, đánh dấu đáp án đúng');
 await tp.click('.qz-board-btn');await tp.waitForSelector('.qz-board');await tp.waitForTimeout(700);await shot(tp,'t4b-board');ok((await tp.textContent('.qz-board .qz-row.is-first')).includes('Nguyễn Văn An')&&(await tp.textContent('.qz-board')).includes('+'),'bảng xếp hạng: người dẫn đầu, điểm vừa nhận');
 // Câu 2: tạm dừng / tiếp tục
 await tp.click('.qz-next');await sp.waitForFunction(()=>document.querySelector('.lt-idx')?.textContent.includes('Câu 2'),null,{timeout:8000});await tp.waitForSelector('.qz-pause',{timeout:10000});await sp.waitForSelector('.lt-opt',{timeout:10000});
 const at1=db.quiz[code].pub.q.at;
 await tp.click('.qz-pause');await sp.waitForFunction(()=>document.querySelector('.lt-big')?.textContent.includes('Tạm dừng'),null,{timeout:8000});await sp2.waitForFunction(()=>document.querySelector('.lt-big')?.textContent.includes('Tạm dừng'),null,{timeout:8000});
 await shot(sp,'s4-pause');await shot(tp,'t5-pause');ok(db.quiz[code].pub.phase==='pause'&&await tp.isVisible('.qz-resume'),'Tạm dừng: học sinh thấy màn hình tạm dừng');
 const blocked=await sp.evaluate(async([u,c])=>{const r=await fetch(`${u}/quiz/${c}/ans/q1/hs01.json`,{method:'PUT',body:JSON.stringify({a:'C',t:{'.sv':'timestamp'}})});return r.status},[DB,code]);ok(blocked===401,'đang tạm dừng: không ghi được câu trả lời');
 await tp.waitForTimeout(1200);await tp.click('.qz-resume');await sp.waitForSelector('.lt-opt:not([disabled])',{timeout:8000});
 ok(db.quiz[code].pub.q.at>at1+900,'tiếp tục: dời mốc bắt đầu, thời gian tạm dừng không tính vào giờ làm bài');
 await sp.click('.lt-opt.lt-C');await tp.waitForFunction(()=>/1\/2 em đã trả lời/.test(document.querySelector('.qz-answered')?.textContent||''));
 await sp.reload();await sp.waitForSelector('#main:not([hidden])',{timeout:10000});await sp.click('button[data-tab="practice"]');await sp.waitForSelector('#practice-list .lt-join',{timeout:10000});await sp.click('#practice-list .lt-join');
 await sp.waitForSelector('.lt-opt.lt-C.is-chosen',{timeout:6000});ok(await sp.isDisabled('.lt-opt.lt-A')&&(await sp.textContent('#lt-play .lt-wait')).includes('Em đã chọn'),'F5 giữa câu: vào lại phòng vẫn thấy đáp án đã chọn, không bấm lại được (máy chủ đã ghi)');
await tp.click('.qz-reveal');await sp2.waitForFunction(()=>document.querySelector('.lt-result')?.textContent.includes('chưa trả lời'),null,{timeout:8000});
 ok(true,'giáo viên Hiện đáp án sớm; em không trả lời thấy "Em chưa trả lời"');
 await sp.waitForFunction(()=>document.querySelector('.lt-streak')?.textContent.includes('2 câu'),null,{timeout:8000});ok(true,'đúng 2 câu liên tiếp: hiện chuỗi đúng');
 // Câu 3: giáo viên kết thúc sớm
 await tp.click('.qz-board-btn');await tp.waitForSelector('.qz-board');ok((await tp.textContent('.qz-chip-streak')).includes('Chuỗi 2'),'bảng xếp hạng: chuỗi đúng');await tp.click('.qz-next');await sp.waitForFunction(()=>document.querySelector('.lt-idx')?.textContent.includes('Câu 3'),null,{timeout:8000});
 await tp.click('.qz-stop');await ack();await tp.waitForSelector('.qz-stage');ok(!(await tp.locator('.qz-step-1.is-on').count()),'bục vinh danh: chưa lộ quán quân ngay');
 await tp.waitForSelector('.qz-step-2.is-on',{timeout:5000});await tp.waitForSelector('.qz-step-1.is-on',{timeout:6000});await tp.waitForTimeout(900);await shot(tp,'t6-podium');
 ok((await tp.textContent('.qz-step-1')).includes('Nguyễn Văn An')&&(await tp.textContent('.qz-step-2')).includes('Trần Thị Bình'),'bục vinh danh: hạng 2 hiện trước, quán quân hiện sau cùng');
 await tp.click('.qz-details');await tp.waitForSelector('.qz-tiles');
 ok((await tp.textContent('.qz-awards')).includes('Quán quân')&&await tp.locator('.qz-stat .qz-stat-row').count()===2&&await tp.locator('.qz-stat .qz-seg.is-ans').count()===2,'kết quả chi tiết: danh hiệu, 2 câu đã công bố, phân bố lựa chọn');
 await shot(tp,'t7-details');ok(await tp.locator('.qz-rank .qz-rank-row').count()===2&&(await tp.textContent('.qz-rank')).includes('Trần Thị Bình'),'bảng xếp hạng đầy đủ');
 await sp.waitForSelector('.lt-result.is-end',{timeout:8000});ok((await sp.textContent('.lt-result')).includes('Quán quân')&&(await sp.textContent('.lt-awards')).includes('Chính xác nhất'),'học sinh hạng 1: "Quán quân!", danh hiệu của em');
 await sp2.waitForSelector('.lt-result.is-end',{timeout:8000});await shot(sp,'s5-end');await shot(sp2,'s5-end2');ok((await sp2.textContent('.lt-stage .lt-step-1')).includes('Nguyễn Văn An'),'học sinh khác: bục vinh danh');
 ok(!db.quiz_lop['9a']&&!db.quiz_lop['9b'],'kết thúc: gỡ buổi luyện tập khỏi cả 2 lớp');
 await tp.click('#qz-ai-analyze');await tp.waitForFunction(()=>document.getElementById('qz-ai-out').textContent.includes('Mức hiểu'));
 const a=aiCalls[0];ok(a.questions.length===2&&!JSON.stringify(a).includes('Nguyễn Văn An'),'AI phân tích: không gửi tên học sinh');
 aiFail=true;await tp.click('#qz-ai-analyze');await tp.waitForFunction(()=>document.getElementById('qz-ai-out').textContent.includes('tính sẵn'));ok((await tp.textContent('#qz-ai-out')).includes('Cần dạy lại')&&(await tp.textContent('#qz-ai-out')).includes('Mức hiểu'),'AI lỗi 502: vẫn có nhận xét tính sẵn từ số liệu');await shot(tp,'t8-ai-fallback');
 const [dl]=await Promise.all([tp.waitForEvent('download'),tp.click('.qz-csv')]);const csv=fs.readFileSync(await dl.path(),'utf8');ok(csv.includes('1,Nguyễn Văn An,'),'tải kết quả CSV');
 await tp.click('#qz-h-close');await tp.waitForSelector('#qz-host[hidden]',{state:'attached'});ok((await tp.textContent('#qz-history')).includes('Ôn nhanh bài 1'),'lưu lịch sử buổi luyện tập');
 await sp.click('.lt-done');await sp.waitForSelector('#lt-play[hidden]',{state:'attached'});await sp.waitForSelector('#practice-list .lt-empty');ok(true,'học sinh đóng màn hình kết quả → mục Luyện tập trở lại trống');
 // Xóa bộ câu hỏi
 await tp.click('.qz-set .t-icon-btn >> nth=1');await ack();await tp.waitForSelector('#qz-sets .qz-empty');ok(!Object.keys(db.quiz_bo[owner]||{}).length,'xóa bộ câu hỏi (có xác nhận), xóa cả trên mạng');
 // ===== Bảng thi đua: kết quả buổi vào quiz_kq_lop theo lớp + tháng (giờ VN), tab Thi đua giáo viên, thẻ thi đua học sinh =====
 const thang=new Date(Date.now()+7*3600e3).toISOString().slice(0,7);
 for(let i=0;i<40&&!db.quiz_kq_lop?.['9b'];i++)await tp.waitForTimeout(150);
 const k9a=db.quiz_kq_lop?.['9a']?.[thang]?.[code],k9b=db.quiz_kq_lop?.['9b']?.[thang]?.[code],nsc=db.quiz[code].pub.so_cau;
 ok(k9a&&k9b&&k9a.so_cau===nsc&&k9a.kq.hs01.c===db.quiz[code].kq.hs01.c&&!k9a.kq.hs02&&k9b.kq.hs02.c===db.quiz[code].kq.hs02.c&&!('p' in k9a.kq.hs01),'kết thúc buổi: lưu số câu đúng từng em theo đúng lớp (9A, 9B) và tháng, không lưu điểm tốc độ');
 ok(Object.values(db.quiz_ls||{}).some(o=>o[code]?.key&&o[code].so_cau===nsc),'lịch sử buổi lưu trên mạng (đường dẫn riêng của giáo viên) kèm khóa phòng');
 const c1=k9a.kq.hs01.c,exp=(x=>`${Math.floor(x/100)},${String(x%100).padStart(2,'0')}`)(Math.floor((2000*c1+nsc)/(2*nsc)));
 await tp.click('#tab-tools-td');await tp.waitForSelector('#tools-p-td:not([hidden])');await tp.waitForFunction(()=>document.querySelectorAll('#td-lop option').length>=2);
 await tp.selectOption('#td-lop','9A');await tp.waitForFunction(()=>document.querySelector('#td-body tr td[data-label="Học sinh"]'),null,{timeout:8000});
 const row=await tp.textContent('#td-body tr');ok(row.includes('Nguyễn Văn An')&&row.includes(exp)&&row.includes('1/1')&&(await tp.textContent('#td-metrics')).includes('1/1'),`tab Thi đua: lớp 9A, An hạng 1, điểm ${exp} (= ${c1}/${nsc} câu × 10), 1/1 buổi`);
 ok(!(await tp.textContent('#td-body')).includes('Trần Thị Bình'),'bảng lớp 9A không lẫn em lớp 9B');
 const [dl2]=await Promise.all([tp.waitForEvent('download'),tp.click('#td-csv')]);const csv2=fs.readFileSync(await dl2.path(),'utf8');
 ok(csv2.includes('Bảng thi đua Luyện tập – Lớp 9A')&&csv2.includes('HS01')&&csv2.includes(exp)&&csv2.includes(`${c1}/${nsc} (tính)`)&&csv2.includes('Cách tính'),'tải Excel (CSV): tiêu đề, cách tính, mã, điểm, từng buổi');
 await tp.click('#td-chot');await ack();await tp.waitForFunction(()=>/Đã chốt lúc/.test(document.getElementById('td-chot-info').textContent),null,{timeout:8000});
 ok(Object.values(db.quiz_ls||{}).some(o=>Object.keys(o).some(k=>k.startsWith('chot_9a_'+thang))&&Object.entries(o).find(([k])=>k.startsWith('chot_9a_'))[1].rows[0].ma==='hs01'),'Chốt tháng: lưu bản chốt xếp hạng kèm thời điểm');
 await tp.click('#td-buoi .td-bo');await tp.waitForSelector('#msg-dialog[open]');ok((await tp.textContent('#msg-dialog')).includes('Không hoàn tác'),'bỏ buổi khỏi thi đua: hỏi xác nhận, nêu hậu quả');await tp.click('#msg-dialog button:has-text("Hủy")');await tp.waitForTimeout(200);ok(!!db.quiz_kq_lop['9a'][thang][code],'Hủy → không bỏ');
 await sp.click('button[data-tab="practice"]');await sp.waitForSelector('#practice-list .td-card',{timeout:8000});await sp.waitForFunction(()=>document.querySelector('.td-you-rank strong')?.textContent==='1',null,{timeout:8000});
 const card=await sp.textContent('.td-card');ok(card.includes('Lớp 9A')&&card.includes(exp)&&card.includes('Top 10 của lớp')&&card.includes('Nguyễn V. An (em)')&&!card.includes('Trần Thị Bình'),'học sinh: thẻ Bảng thi đua lớp 9A, hạng 1, điểm, tên rút gọn, không có bạn lớp khác');
 await sp.click('.td-seg-btn:has-text("Tháng trước")');await sp.waitForFunction(()=>document.querySelector('.td-empty')?.textContent.includes('Tháng trước'),null,{timeout:8000});ok(true,'chọn Tháng trước: báo không có buổi nào');
 ok(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'thẻ thi đua không tràn ngang 390 px');
 await tp.click('#td-buoi .td-bo');await ack();await tp.waitForFunction(()=>/Đã bỏ buổi/.test(document.getElementById('td-status').textContent),null,{timeout:8000});
 ok(!db.quiz_kq_lop['9a']?.[thang]?.[code]&&(await tp.textContent('#td-body')).includes('chưa có buổi'),'xác nhận → bỏ buổi, bảng tính lại (lớp chưa có buổi)');
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));
 console.log('QUIZ LIVE OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
