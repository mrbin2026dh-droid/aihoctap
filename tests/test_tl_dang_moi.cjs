// Thảo luận: 6 dạng mới không dùng AI (Hỏi lại, Xếp hai cột, Tranh luận, Bắt lỗi, Xếp hạng, Bức tường). Khung giả lập lấy từ test_tl_live.
// Thảo luận trên lớp (kiểu Mentimeter), quy trình giống Luyện tập: giáo viên tạo bộ thảo luận (tự thêm 5 loại trang, AI gợi ý, Excel),
// chọn nhiều lớp, lưu (đồng bộ) → Mở thảo luận → học sinh 2 lớp vào phòng → đếm ngược → đám mây từ khóa, câu trả lời mở (duyệt trước),
// bình chọn, thang điểm 1–5, hỏi đáp (cùng thắc mắc) → kết thúc: tổng kết, AI tổng hợp (không gửi tên), CSV.
// Firebase giả lập dùng chung, kiểm "khóa phòng" và các luật ghi ý kiến như luật thật.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';const DB='https://test-tl-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml','.json':'application/json'}[path.extname(f)]||'x');r.end(body)}).listen(8212);
const hh=(ma,pin)=>crypto.createHash('sha256').update(ma.toLowerCase()+':'+pin).digest('hex');
const db={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9,h:hh('hs01','123456')},hs02:{ma:'HS02',ten:'Trần Thị Bình',lop:'9B',khoi:9,h:hh('hs02','123456')}},thi_lop:{'9a':{lop:'9A',khoi:9,n:1},'9b':{lop:'9B',khoi:9,n:1},'9c':{lop:'9C',khoi:9,n:40}},thi_bai:{}};
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
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP thi.test 127.0.0.1','--unsafely-treat-insecure-origin-as-secure=http://thi.test:8212']});let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
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
 await tp.goto('http://localhost:8212/teacher.html');await tp.waitForTimeout(400);await tp.fill('#teacher-login [name=pin]',PIN);await tp.click('#teacher-login button[type=submit]');await tp.waitForSelector('#workspace:not([hidden])');
 await tp.click('#nav-tools');await tp.waitForSelector('#tab-tools-tl');await tp.click('#tab-tools-tl');await tp.click('#tl-new');await tp.waitForSelector('#tl-lops .qz-lop-pick');
 await tp.fill('#tl-name','Bài 2: thảo luận');await tp.click('#tl-lops-all');
 const S=i=>`#tl-list .tl-slide-ed >> nth=${i}`;
 for(const t of ['cot','tranh','loi','xh','tuong','lai'])ok(await tp.isVisible(`.tl-add-type[data-type="${t}"]`),'có nút thêm dạng '+t);
 await tp.selectOption(`${S(0)} >> .tl-type`,'poll');await tp.fill(`${S(0)} >> .tl-text`,'Người đi làm năm 2035 cần giỏi nhất điều gì?');
 await tp.fill(`${S(0)} >> .tl-opt >> nth=0`,'Tự học');await tp.fill(`${S(0)} >> .tl-opt >> nth=1`,'Tính nhẩm nhanh');
 for(const t of ['cot','tranh','loi','xh','tuong','lai'])await tp.click(`.tl-add-type[data-type="${t}"]`);
 ok((await tp.inputValue(`${S(1)} >> .tl-col >> nth=0`))==='Máy, AI làm tốt'&&(await tp.inputValue(`${S(1)} >> .tl-col >> nth=1`))==='Người vẫn phải làm','xếp hai cột: tên cột mặc định');
 await tp.fill(`${S(1)} >> .tl-text`,'Việc nào máy làm tốt, việc nào người vẫn phải làm?');
 for(const [i,v] of ['Tính nhanh','An ủi bạn','Dịch câu tiếng Anh'].entries())await tp.fill(`${S(1)} >> .tl-item >> nth=${i}`,v);
 ok((await tp.inputValue(`${S(2)} >> .tl-col >> nth=0`))==='Đồng ý','tranh luận: mặc định Đồng ý / Không đồng ý');
 await tp.fill(`${S(2)} >> .tl-text`,'Dùng AI giúp làm video món ăn là gian lận.');
 await tp.fill(`${S(3)} >> .tl-text`,'Bấm vào cụm AI viết sai');
 for(const [i,v] of ['Năm 938,','Lý Thường Kiệt','chỉ huy quân ta','thắng trận Bạch Đằng.'].entries())await tp.fill(`${S(3)} >> .tl-item >> nth=${i}`,v);
 await tp.fill(`${S(4)} >> .tl-text`,'Xếp năng lực theo mức quan trọng với em');
 for(const [i,v] of ['Học cách học','Tư duy phản biện','Sáng tạo'].entries())await tp.fill(`${S(4)} >> .tl-item >> nth=${i}`,v);
 await tp.fill(`${S(5)} >> .tl-text`,'Một mục tiêu học tập đủ 4 phần của em');await tp.uncheck(`${S(5)} >> .tl-mod-in`);
 await tp.fill(`${S(6)} >> .tl-text`,'Cuối giờ: người đi làm năm 2035 cần giỏi nhất điều gì?');
 await tp.click(`${S(6)} >> .tl-ref`);await tp.selectOption(`${S(6)} >> .tl-ref`,'0');
 await tp.click('#tl-save');ok((await tp.textContent('#tl-form-err')).includes('Câu 4')&&(await tp.textContent('#tl-form-err')).includes('cụm từ sai'),'bắt lỗi chưa chọn cụm sai → báo đúng câu');
 await tp.check(`${S(3)} >> .tl-dung >> nth=1`);
 await shot(tp,'moi-editor');
 await tp.click('#tl-save');await tp.waitForSelector('#tools-p-tl:not([hidden]) .tl-set');ok((await tp.textContent('.tl-set')).includes('7 câu hỏi'),'lưu bộ 7 câu với các dạng mới');
 const owner=Object.keys(db.tl_bo||{})[0];const saved=Object.values(db.tl_bo[owner])[0].slides;
 ok(saved[3].dung===1&&saved[6].ref===0&&saved[6].opts.join()==='Tự học,Tính nhẩm nhanh','lưu đúng cụm sai và câu hỏi lại');
 const login=async(pg,ma)=>{await pg.goto('http://thi.test:8212/');await pg.waitForSelector('#gate:not([hidden])');await pg.click('#gate-student');await pg.fill('#student-code',ma);await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForSelector('#main:not([hidden])');};
 await login(sp,'HS01');await login(sp2,'HS02');
 await tp.click('.tl-open');await tp.waitForSelector('#tl-host:not([hidden]) .qz-code');const code=(await tp.textContent('#tl-host .qz-code strong')).replace(/\s/g,'');
 await sp.click('button[data-tab="practice"]');await sp.waitForSelector('#practice-list .tl-card',{timeout:8000});await sp.click('.tl-join');await sp.waitForSelector('#tl-play:not([hidden]) .lt-big');
 await sp2.waitForSelector('#tl-banner:not([hidden])',{timeout:8000});await sp2.click('.tl-banner-join');await sp2.waitForSelector('#tl-play:not([hidden]) .lt-big');
 await tp.waitForFunction(()=>document.querySelectorAll('#tl-host .qz-chips li').length===2);
 await tp.click('#tl-start');await sp.waitForSelector('#tl-play .tl-choice',{timeout:15000});await sp2.waitForSelector('#tl-play .tl-choice',{timeout:15000});
 const sent=async()=>tp.waitForFunction(()=>/2\/2 em/.test(document.querySelector('#tl-host .tl-qmeta')?.textContent||''),null,{timeout:8000});
 const next=async(txt)=>{await tp.click('.tl-next');for(const pg of [sp,sp2])await pg.waitForFunction(t=>document.querySelector('.tl-q')?.textContent.includes(t),txt,{timeout:8000});};
 await sp.click('.tl-choice >> nth=1');await sp.click('.tl-send');await sp2.click('.tl-choice >> nth=1');await sp2.click('.tl-send');await sent();
 await next('máy làm tốt');ok(await sp.locator('.tl-cot-row').count()===3,'học sinh: mỗi dòng chọn cột A hoặc B');
 await sp.click('.tl-send');ok((await sp.textContent('.tl-form')).includes('dòng 1'),'chưa chọn đủ → báo dòng còn thiếu');
 await shot(sp,'moi-s-cot');
 for(const [pg,picks] of [[sp,'ABA'],[sp2,'ABB']]){for(const [i,c] of [...picks].entries())await pg.click(`.tl-cot-row >> nth=${i} >> .tl-cot-opt >> nth=${c==='A'?0:1}`);await pg.click('.tl-send');await pg.waitForSelector('.tl-ok');}
 await sent();await tp.waitForFunction(()=>document.querySelectorAll('#tl-host .tl-cot-row').length===3,null,{timeout:8000});
 ok((await tp.textContent('#tl-host .tl-cot-row >> nth=0')).includes('A 2 · B 0')&&(await tp.textContent('#tl-host .tl-cot-row >> nth=2')).includes('A 1 · B 1'),'màn chiếu: tỉ lệ A/B từng dòng');await shot(tp,'moi-t-cot');
 ok(!(await sp.locator('.tl-kq').count()),'chưa công bố: học sinh chưa thấy kết quả cả lớp');
 await tp.click('.tl-kq');await sp.waitForSelector('.tl-kq',{timeout:8000});await sp2.waitForSelector('.tl-kq',{timeout:8000});
 ok((await sp.textContent('.tl-kq')).includes('Kết quả cả lớp')&&(await sp.textContent('.tl-kq-cot-row >> nth=0')).includes('A 2 · B 0'),'công bố: máy học sinh hiện kết quả cả lớp giống màn chiếu');
 ok(!JSON.stringify(db.tl[code].pub.kq).match(/hs0[12]|Nguyễn|Trần/),'kết quả công bố không có tên, mã học sinh');await shot(sp,'moi-s-kq-cot');
 await tp.click('.tl-kq');await sp.waitForFunction(()=>!document.querySelector('.tl-kq'),null,{timeout:8000});ok(true,'thu lại kết quả: máy học sinh ẩn kết quả');
 await next('gian lận');
 await sp.click('.tl-choice >> nth=1');await sp.click('.tl-send');ok((await sp.textContent('.tl-form')).includes('lí do'),'tranh luận: phải ghi lí do');
 await sp.fill('.tl-input','AI chỉ gợi ý, em vẫn tự quay video');await sp.click('.tl-send');await sp.waitForSelector('.tl-ok');
 await sp2.click('.tl-choice >> nth=0');await sp2.fill('.tl-input','Không tự nghĩ công thức');await sp2.click('.tl-send');await sp2.waitForSelector('.tl-ok');
 await sent();await tp.click('.tl-pick');await tp.waitForSelector('#tl-host .tl-ly-text');
 ok((await tp.textContent('#tl-host .tl-res')).includes('AI chỉ gợi ý')&&(await tp.textContent('#tl-host .tl-res')).includes('Không tự nghĩ'),'màn chiếu: rút lí do của mỗi phía');await shot(tp,'moi-t-tranh');
 await next('cụm AI viết sai');ok(db.tl[code].pub.slide.dung===undefined,'trang phát cho học sinh không có đáp án bắt lỗi');
 await sp.click('.tl-loi-opt >> nth=1');await sp.click('.tl-send');await sp.waitForSelector('.tl-ok');await sp2.click('.tl-loi-opt >> nth=0');await sp2.click('.tl-send');await sp2.waitForSelector('.tl-ok');
 await sent();ok(!(await tp.locator('#tl-host .tl-loi-cum.is-sai').count()),'chưa công bố thì chưa tô chỗ sai');
 await tp.click('.tl-kq');await sp.waitForSelector('.tl-kq-bar',{timeout:8000});ok(!(await sp.locator('.tl-kq-bar.is-dap').count())&&db.tl[code].pub.kq.lo===undefined,'công bố kết quả bắt lỗi trước khi công bố chỗ sai: chưa lộ đáp án');
 await tp.click('.tl-lo');await tp.waitForSelector('#tl-host .tl-loi-cum.is-sai');ok((await tp.textContent('#tl-host .tl-loi-dap')).includes('1/2 em bấm đúng'),'công bố chỗ sai: số em bấm đúng');
 await sp.waitForSelector('.tl-loi-dap',{timeout:8000});ok((await sp.textContent('.tl-loi-dap')).includes('Em đã tìm đúng'),'học sinh thấy đáp án sau khi công bố');
 await sp.waitForSelector('.tl-kq-bar.is-dap',{timeout:8000});ok((await sp.textContent('.tl-kq-bar.is-dap')).includes('Lý Thường Kiệt'),'kết quả công bố cập nhật theo: đánh dấu chỗ sai');await shot(sp,'moi-s-loi');
 await next('Xếp năng lực');ok(!(await sp.locator('.tl-kq').count()),'sang câu mới: kết quả câu trước không còn trên máy học sinh');await sp.selectOption('.tl-xh-sel >> nth=0','1');await sp.selectOption('.tl-xh-sel >> nth=1','1');await sp.selectOption('.tl-xh-sel >> nth=2','2');
 await sp.click('.tl-send');ok((await sp.textContent('.tl-form')).includes('trùng hạng'),'xếp hạng: không cho trùng hạng');
 await sp.selectOption('.tl-xh-sel >> nth=0','2');await sp.selectOption('.tl-xh-sel >> nth=2','3');await sp.click('.tl-send');await sp.waitForSelector('.tl-ok');
 for(const [i,v] of ['3','1','2'].entries())await sp2.selectOption(`.tl-xh-sel >> nth=${i}`,v);await sp2.click('.tl-send');await sp2.waitForSelector('.tl-ok');
 await tp.waitForFunction(()=>/2 em đã xếp/.test(document.querySelector('#tl-host .tl-res')?.textContent||''),null,{timeout:8000});
 ok((await tp.textContent('#tl-host .tl-xh-row >> nth=0')).includes('Tư duy phản biện'),'màn chiếu: thứ tự chung, mục quan trọng nhất lên đầu');
 await next('mục tiêu học tập');await sp.fill('.tl-input','Em sẽ đọc 4 truyện tiếng Anh trước 15/1');await sp.click('.tl-send');await sp.waitForSelector('.tl-mine');
 await sp2.waitForSelector('.tl-vote',{timeout:8000});await sp2.click('.tl-vote');
 await tp.waitForFunction(()=>/♥ 1/.test(document.querySelector('#tl-host .tl-qa-votes')?.textContent||''),null,{timeout:8000});ok(true,'bức tường: thả tim, ý được thích hiện số tim');
 await next('Cuối giờ');await sp.click('.tl-choice >> nth=0');await sp.click('.tl-send');await sp.waitForSelector('.tl-ok');
 await tp.waitForFunction(()=>document.querySelectorAll('#tl-host .tl-lai-col').length===2,null,{timeout:8000});
 ok((await tp.textContent('#tl-host .tl-lai-col >> nth=0')).includes('Trước (câu 1)')&&(await tp.textContent('#tl-host .tl-lai-col >> nth=0')).includes('2 · 100%'),'hỏi lại: hiện kết quả đầu giờ cạnh bây giờ');await shot(tp,'moi-t-lai');
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));
 console.log('TL MOI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
