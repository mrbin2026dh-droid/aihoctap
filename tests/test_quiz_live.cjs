// Trò chơi câu hỏi trên lớp (giáo viên điều khiển): giáo viên tạo bộ câu hỏi (tự nhập + AI soạn, phải duyệt) → trình chiếu →
// học sinh (máy khác) thấy thẻ "Vào chơi" → trả lời → giáo viên công bố đáp án, xếp hạng → kết thúc, AI phân tích lớp hiểu bài.
// Firebase giả lập dùng chung cho 2 trình duyệt, có kiểm "khóa phòng" (chỉ chủ phòng ghi được trạng thái) như luật thật.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';const DB='https://test-quiz-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(body)}).listen(8207);
const hh=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const db={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:hh('hs01','123456')}},thi_bai:{}};
const at=p=>p.split('/').filter(Boolean).reduce((o,k)=>(o === null || o === undefined)?undefined:o[k],db);
const setAt=(p,v)=>{const parts=p.split('/').filter(Boolean);let o=db;parts.slice(0,-1).forEach(k=>{o=o[k]??={}});if(v===null||v===undefined)delete o[parts.at(-1)];else o[parts.at(-1)]=v;};
const stamp=x=>Array.isArray(x)?x.map(stamp):x&&typeof x==='object'?(x['.sv']?Date.now():Object.fromEntries(Object.entries(x).map(([k,y])=>[k,stamp(y)]))):x;
const denied=[];
async function fbRoute(r){const u=new URL(r.request().url());const p=u.pathname.replace(/\.json$/,'').replace(/^\//,'');const m=r.request().method();
 const deny=why=>{denied.push(why);return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Permission denied"}'});};
 if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 200\nevent: put\ndata: ${JSON.stringify({path:'/',data:at(p)??null})}\n\n`});
 if(m==='GET'){if(p.startsWith('quiz_key')||p.startsWith('quiz_proof'))return deny('read '+p);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(at(p)??null)});}
 const v=stamp(JSON.parse(r.request().postData()||'null'));
 if(m==='PATCH'&&p===''){const proofs={};for(const [k,val] of Object.entries(v))if(k.startsWith('quiz_proof/'))proofs[k.split('/')[1]]=val;
  for(const k of Object.keys(v)){let R=null;if(/^quiz\/\d{6}\/(pub|kq)/.test(k))R=k.split('/')[1];else if(k.startsWith('quiz_lop/'))R=v[k]||at(k);else if(k.startsWith('quiz_proof/'))R=k.split('/')[1];else return deny('path '+k);
   if(!R||!at('quiz_key/'+R)||proofs[R]!==at('quiz_key/'+R))return deny('proof '+k);}
  for(const [k,val] of Object.entries(v))if(!k.startsWith('quiz_proof/'))setAt(k,val);return r.fulfill({status:200,contentType:'application/json',body:'{}'});}
 if(m==='PUT'){if(p.startsWith('quiz_key/')&&at(p))return deny('key exists');
  if(/^quiz\/\d{6}\/ds\//.test(p)&&at(p))return deny('joined');
  const mm=p.match(/^quiz\/(\d{6})\/ans\/([^/]+)\/[^/]+$/);if(mm){const pub=at(`quiz/${mm[1]}/pub`);if(at(p)||!pub||pub.phase!=='q'||pub.q?.k!==mm[2])return deny('ans');}
  if(/^quiz\/\d{6}\/(pub|kq)/.test(p))return deny('direct pub');
  setAt(p,v);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)});}
 return deny('method');}
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8207']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{
 const tc=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:true});const tp=await tc.newPage();const errs=[];tp.on('pageerror',e=>errs.push('T:'+e.message));
 const sc=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const sp=await sc.newPage();sp.on('pageerror',e=>errs.push('S:'+e.message));
 const aiCalls=[];
 for(const c of [tc,sc]){await c.route(DB+'/**',fbRoute);await c.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{},classes:{'9A':9}})}));
  await c.route('**/api/**',async r=>{const u=new URL(r.request().url()).pathname;let body={schema_version:1,revision:'r',courses:[{id:'tin-hoc-9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số',version:'v'}]}]};
   if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/teacher/students'))body=[];if(u.endsWith('/login'))body={token:'w',must_change_pin:false};
   if(u.endsWith('/teacher/ai-questions'))body={questions:[{text:'Bit là gì?',options:{A:'Đơn vị nhỏ nhất',B:'Ổ cứng',C:'Màn hình',D:'Chuột'},answer:'A',topic:'Mã nhị phân',explain:'Theo bài'}]};
   if(u.endsWith('/teacher/ai-quiz')){aiCalls.push(JSON.parse(r.request().postData()));body={muc_hieu:'Khá',nhan_xet:'**Mức hiểu chung** Khá. **Hiểu lầm cần sửa** câu 2.'};}
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});}
 // Giáo viên tạo bộ câu hỏi
 await tp.goto('http://localhost:8207/teacher.html');await tp.waitForTimeout(400);await tp.fill('#teacher-login [name=pin]',PIN);await tp.click('#teacher-login button[type=submit]');await tp.waitForSelector('#workspace:not([hidden])');
 ok(await tp.isVisible('#nav-tools'),'menu Tiện ích');await tp.click('#nav-tools');ok((await tp.textContent('#qz-sets')).includes('Chưa có bộ câu hỏi'),'chưa có bộ câu hỏi');
 await tp.click('#qz-new');await tp.waitForSelector('#detail-tools:not([hidden])');await tp.waitForFunction(()=>document.querySelector('#qz-lop').value==='9A');
 await tp.click('#qz-save');ok((await tp.getAttribute('#qz-name','aria-invalid'))==='true','thiếu tên → báo dưới trường');
 await tp.fill('#qz-name','Ôn nhanh bài 1');
 const fillQ=async(i,text,opts,ans)=>{const f=`#qz-list .qz-q >> nth=${i}`;await tp.fill(`${f} >> .qz-text`,text);for(const [k,v] of Object.entries(opts))await tp.fill(`${f} >> .qz-opt[data-k="${k}"]`,v);await tp.selectOption(`${f} >> .qz-ans`,ans);};
 await fillQ(0,'1 byte bằng bao nhiêu bit?',{A:'4',B:'8',C:'16',D:'2'},'B');await tp.click('#qz-add');await fillQ(1,'Thiết bị nào nhập dữ liệu?',{A:'Loa',B:'Máy in',C:'Bàn phím',D:'Màn hình'},'C');
 await tp.click('#qz-ai');await tp.waitForFunction(()=>document.querySelectorAll('#qz-ai-lesson option').length>0);await tp.click('#qz-ai-go');await tp.waitForSelector('#qz-list .qz-q.is-ai');
 ok(await tp.locator('#qz-list .qz-q').count()===3,'AI soạn thêm câu theo bài (nối vào bộ câu hỏi)');
 await tp.click('#qz-save');ok((await tp.textContent('#qz-form-err')).includes('Đã duyệt'),'câu AI chưa duyệt → không lưu');
 await tp.check('#qz-list .qz-ok');await tp.click('#qz-save');await tp.waitForSelector('#list-tools:not([hidden]) .qz-set');ok((await tp.textContent('.qz-set')).includes('3 câu'),'lưu bộ câu hỏi 3 câu');
 // Học sinh đăng nhập (máy khác)
 await sp.goto('http://thi.test:8207/');await sp.waitForSelector('#gate:not([hidden])');await sp.click('#gate-student');await sp.fill('#student-code','HS01');await sp.fill('#student-pin','123456');await sp.click('#login-form button[type=submit]');await sp.waitForSelector('#main:not([hidden])');
 ok(await sp.locator('#qz-banner:not([hidden])').count()===0,'chưa mở phòng: không có thẻ trò chơi');
 // Trình chiếu
 await tp.click('.qz-play');await tp.waitForSelector('#qz-host:not([hidden]) .qz-code');const code=(await tp.textContent('.qz-code strong')).replace(/\s/g,'');
 ok(/^\d{6}$/.test(code)&&db.quiz_lop['9a']===code&&typeof db.quiz_key[code]==='string'&&db.quiz_key[code].length>=40,'mở phòng: mã 6 số, khóa phòng bí mật, gắn cho lớp 9A');
 ok(!JSON.stringify(db.quiz[code]).includes(db.quiz_key[code]),'khóa phòng không nằm ở chỗ học sinh đọc được');
 await sp.waitForSelector('#qz-banner:not([hidden])',{timeout:8000});ok((await sp.textContent('#qz-banner')).includes('trò chơi câu hỏi'),'học sinh lớp 9A thấy thẻ "Vào chơi" ngay, không phải gõ mã');
 ok(await tp.isDisabled('#qz-start'),'chưa có học sinh → chưa bắt đầu được');
 await sp.click('.qz-join');await sp.waitForSelector('#qz-play:not([hidden]) .qz-p-wait');
 await tp.waitForFunction(()=>document.querySelectorAll('.qz-chips li').length===1);ok((await tp.textContent('.qz-chips')).includes('Nguyễn Văn An')&&!(await tp.isDisabled('#qz-start')),'máy chiếu: tên học sinh vào phòng hiện ngay');
 // Thử phá: ghi trạng thái phòng không có khóa
 const hack=await sp.evaluate(async([u,c])=>{const r=await fetch(`${u}/.json`,{method:'PATCH',body:JSON.stringify({[`quiz/${c}/pub/phase`]:'end'})});return r.status},[DB,code]);ok(hack===401&&db.quiz[code].pub.phase==='lobby','học sinh không có khóa phòng → không điều khiển được trò chơi');
 // Câu 1: đúng
 await tp.click('#qz-start');await sp.waitForSelector('.qz-p-opt',{timeout:8000});
 ok(!JSON.stringify(db.quiz[code].pub).includes('"ans"')&&!JSON.stringify(db.quiz[code].pub.q).includes('answer'),'đang hỏi: đáp án chưa gửi xuống (chỉ máy giáo viên biết)');
 ok((await sp.textContent('.qz-p-q')).includes('1 byte')&&await sp.locator('.qz-p-opt').count()===4,'học sinh thấy câu hỏi + 4 ô màu');
 await sp.click('.qz-p-opt.qz-B');await sp.waitForSelector('.qz-p-result.is-ok',{timeout:8000});
 ok((await sp.textContent('.qz-p-result')).includes('Chính xác'),'trả lời đúng → "Chính xác!" (cả lớp đã trả lời → tự công bố)');
 await tp.waitForSelector('.qz-opts.is-reveal');ok((await tp.textContent('.qz-opt.is-ans')).includes('8')&&(await tp.textContent('.qz-top')).includes('Nguyễn Văn An'),'máy chiếu: đáp án, số em chọn, bảng xếp hạng');
 await sp.waitForFunction(()=>/\d+ điểm/.test(document.querySelector('.qz-p-score').textContent));const p1=Number((await sp.textContent('.qz-p-score')).match(/(\d+) điểm/)[1]);ok(p1>=500&&p1<=1000,`đúng + nhanh: ${p1} điểm (500–1000)`);
 const twice=await sp.evaluate(async([u,c])=>{const r=await fetch(`${u}/quiz/${c}/ans/q0/hs01.json`,{method:'PUT',body:JSON.stringify({a:'A',t:{'.sv':'timestamp'}})});return r.status},[DB,code]);ok(twice===401,'không đổi được câu trả lời sau khi đã chọn / hết giờ');
 // Câu 2: sai
 await tp.click('.qz-h-foot .t-primary');await sp.waitForFunction(()=>document.querySelector('.qz-p-idx')?.textContent.includes('Câu 2'),null,{timeout:8000});
 await sp.click('.qz-p-opt.qz-A');await sp.waitForSelector('.qz-p-result.is-bad',{timeout:8000});ok((await sp.textContent('.qz-p-result')).includes('Đáp án đúng: C'),'trả lời sai → báo đáp án đúng');
 // Câu 3: không trả lời, giáo viên bấm Hiện đáp án
 await tp.click('.qz-h-foot .t-primary');await sp.waitForFunction(()=>document.querySelector('.qz-p-idx')?.textContent.includes('Câu 3'),null,{timeout:8000});
 await tp.click('.qz-h-foot button');await sp.waitForFunction(()=>document.querySelector('.qz-p-result')?.textContent.includes('chưa trả lời'),null,{timeout:8000});ok(true,'không trả lời → "Em chưa trả lời"');
 // Kết thúc
 await tp.click('.qz-h-foot .t-primary');await tp.waitForSelector('.qz-podium');
 ok((await tp.textContent('.qz-podium')).includes('Nguyễn Văn An')&&await tp.locator('.qz-stat tbody tr').count()===3&&(await tp.textContent('.qz-stat')).includes('A. Loa (1 em)'),'kết thúc: bục vinh danh, thống kê từng câu, phương án sai chọn nhiều nhất');
 await sp.waitForSelector('.qz-p-result.is-end',{timeout:8000});ok((await sp.textContent('.qz-p-result')).includes('Hạng 1/1')&&(await sp.textContent('.qz-p-result')).includes('đúng 1 câu'),'học sinh thấy hạng và số câu đúng');
 ok(!db.quiz_lop['9a'],'kết thúc: gỡ thẻ trò chơi khỏi lớp');
 await tp.click('#qz-ai-analyze');await tp.waitForFunction(()=>document.getElementById('qz-ai-out').textContent.includes('Mức hiểu'));
 const a=aiCalls[0];ok(a.questions.length===3&&a.questions[1].counts.A===1&&a.questions[1].ans==='C'&&!JSON.stringify(a).includes('Nguyễn Văn An'),'AI phân tích: gửi phân bố đáp án, không gửi tên học sinh');
 ok((await tp.textContent('#qz-ai-out')).includes('Mức hiểu: Khá'),'hiện nhận xét AI: lớp hiểu bài ở mức nào');
 const [dl]=await Promise.all([tp.waitForEvent('download'),tp.click('.qz-h-foot button:has-text("CSV")')]);const csv=fs.readFileSync(await dl.path(),'utf8');ok(csv.includes('1,Nguyễn Văn An,'),'tải kết quả CSV');
 await tp.click('#qz-h-close');await tp.waitForSelector('#qz-host[hidden]',{state:'attached'});ok((await tp.textContent('#qz-history')).includes('Ôn nhanh bài 1')&&(await tp.textContent('#qz-history')).includes('Khá'),'lưu lịch sử lần chơi (kèm mức hiểu)');
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));
 console.log('QUIZ LIVE OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
