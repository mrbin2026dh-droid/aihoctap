// Cổng 2 — luồng thi Firebase REST trong trình duyệt (Firebase được giả lập; luật thật kiểm riêng bằng spike/step0/emulator).
// Kiểm: đăng nhập song song Firebase, danh sách gộp Worker + Firebase, vào thi tạo phiên bằng giờ máy chủ, đề theo thứ tự,
// lưu nháp, nộp bài, nộp lại khi lần trước đã ghi nhưng mất phản hồi, kết quả "chờ chấm", làm mới token khi hết hạn,
// đăng xuất xóa phiên Firebase, Worker vẫn chạy khi Firebase lỗi.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_exam_firebase_flow.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8193);
const DB='https://day-hoc-tuong-tac-7ee69-default-rtdb.asia-southeast1.firebasedatabase.app';
const UID='fbuid01';const SKEW=-90000; // giờ máy chủ chậm hơn máy học sinh 90 giây → đồng hồ phải theo máy chủ
const now=()=>Date.now()+SKEW;
const st={gas:[],gasBusy:1,db:{},puts:[],signIns:0,refreshes:0,expireNext:false,dropAttemptResponse:true,fbDown:false};
function seed(){st.db={
 students:{[UID]:{grade:9,name:'An',class_code:'9A'}},
 exam_meta:{fe1:{title:'Giữa kỳ Firebase',grade:9,minutes:45,opens_at:now()-60000,closes_at:now()+3600000,max_attempts:1,kind:'midterm',question_count:2,total_points:10,backend:'firebase'},
            fe8:{title:'Đề khối 8',grade:8,minutes:45,opens_at:now()-60000,closes_at:now()+3600000,max_attempts:1,backend:'firebase'},
            fe2:{title:'Tin 9 lý thuyết + thực hành',grade:9,minutes:45,opens_at:now()-60000,closes_at:now()+3600000,max_attempts:1,question_count:1,total_points:4,backend:'firebase',parts:[{key:'theory',max:4},{key:'practice',max:6}]},
            old:{title:'Đề không gắn firebase',grade:9,minutes:45,opens_at:now()-60000,closes_at:now()+3600000,max_attempts:1}},
 exam_questions:{fe2:{q1:{order:1,kind:'choice',prompt:'Hàm tính tổng?',options:{A:'SUM',B:'AVG'},points:4}},fe1:{q2:{order:2,kind:'choice',prompt:'Câu thứ hai?',options:{A:'x',B:'y'},points:5},q1:{order:1,kind:'choice',prompt:'Câu thứ nhất?',options:{A:'CPU',B:'RAM'},points:5}}}}}
const get=p=>p.split('/').filter(Boolean).reduce((o,k)=>o===null||o===undefined?null:o[k]??null,st.db);
const put=(p,v)=>{const ks=p.split('/').filter(Boolean);let o=st.db;for(const k of ks.slice(0,-1))o=o[k]??=({});if(v===null)delete o[ks.at(-1)];else o[ks.at(-1)]=v};
const sv=v=>{if(v&&typeof v==='object'){if(v['.sv']==='timestamp')return now();return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,sv(x)]))}return v};
(async()=>{const b=await chromium.launch({args:['--host-resolver-rules=MAP aihoc.test 127.0.0.1']});let n=0;const ok=(c,m)=>{assert(c,m);n++};
try{
 const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 seed();
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;const j=b=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(b)});
  if(u.endsWith('/login'))return j({token:'t'});if(u.endsWith('/pwa/me'))return j({uid:'hs01',student_name:'An',grade:9,class_code:'9A'});
  if(u.endsWith('/pwa/exams'))return j({exams:[{exam_id:'w1',title:'Đề Worker cũ',mode:'real',kind:'15m',minutes:15,opens_at:Date.now()-1,closes_at:Date.now()+9e6,state:'open',question_count:3,total_points:5,attempts_used:0,attempts_left:1,best_score:null,in_progress:false}]});
  if(u.endsWith('catalog'))return j({schema_version:1,revision:'r',courses:[]});return j({attempts:[],results:[],items:[],courses:[],grades:[]})});
 await pg.route('https://identitytoolkit.googleapis.com/**',r=>{st.signIns++;const body=JSON.parse(r.request().postData());
  if(st.fbDown)return r.fulfill({status:503,body:'down'});
  if(body.email!=='hs01@hs.aihoc.test'||body.password!=='123456')return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{message:'INVALID_LOGIN_CREDENTIALS'}})});
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({localId:UID,idToken:'id-1',refreshToken:'rf-1',expiresIn:'3600'})})});
 await pg.route('https://securetoken.googleapis.com/**',r=>{st.refreshes++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user_id:UID,id_token:'id-2',refresh_token:'rf-2',expires_in:'3600'})})});
 await pg.route(DB+'/**',async r=>{const url=new URL(r.request().url());const p=decodeURIComponent(url.pathname.replace(/\.json$/,''));const m=r.request().method();const auth=url.searchParams.get('auth');
  const j=(s,b)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(b)});
  if(st.fbDown)return j(503,{error:'down'});
  if(st.expireNext&&auth==='id-1'){st.expireNext=false;return j(401,{error:'Auth token is expired'})}
  if(m==='GET'){if(p.startsWith('/exam_secrets'))return j(401,{error:'Permission denied'});return j(200,get(p))}
  const body=sv(JSON.parse(r.request().postData()||'null'));st.puts.push([p,body]);
  // luật tối thiểu đủ cho kiểm luồng: phiên/bài nộp chỉ ghi một lần
  if((/^\/sessions\//.test(p)||/^\/attempts\//.test(p))&&get(p))return j(401,{error:'Permission denied'});
  put(p,body);
  if(/^\/attempts\//.test(p)&&st.dropAttemptResponse){st.dropAttemptResponse=false;return r.abort('failed')} // đã ghi nhưng mất phản hồi
  return j(200,body)});
 await pg.route('https://script.google.com/**',r=>{const b=JSON.parse(r.request().postData());st.gas.push(b);
  if(b.idToken!=='id-1'&&b.idToken!=='id-2')return r.fulfill({status:200,contentType:'application/json',body:'{"ok":false,"error":"token"}'});
  if(b.action==='grade_my_attempt')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,score:10,earned:4,total_points:4,correct:1,total:1,needs_review:0})});
  if(b.action==='upload_practice'){if(st.gasBusy>0){st.gasBusy--;return r.fulfill({status:200,contentType:'text/html',body:'<html>Dịch vụ đang bận</html>'})}
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,file_id:'F1',bytes:b.b64.length})})}
  r.fulfill({status:200,contentType:'application/json',body:'{"ok":false}'})});
 await pg.goto('http://aihoc.test:8193/');await pg.waitForSelector('#gate:not([hidden])');
 await pg.evaluate(async()=>{(await import('./fb.js')).FB_CONFIG.appsScriptUrl=''});
 await pg.click('#gate-student');await pg.fill('#student-code','HS01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');
 await pg.waitForFunction(()=>!document.getElementById('login-dialog').open);
 await pg.waitForFunction(()=>Boolean(localStorage.getItem('aisgk-fb')),null,{timeout:8000});ok(true,'đăng nhập song song Firebase, lưu phiên');
 ok(JSON.parse(await pg.evaluate(()=>localStorage.getItem('aisgk-fb'))).uid===UID,'uid Firebase đúng');
 await pg.click('button[data-tab=exams]');await pg.waitForSelector('.exam-card');
 const titles=await pg.locator('.exam-title').allTextContents();
 ok(titles.includes('Giữa kỳ Firebase')&&titles.includes('Đề Worker cũ'),'danh sách gộp Worker + Firebase: '+titles);
 ok(!titles.includes('Đề khối 8')&&!titles.includes('Đề không gắn firebase'),'chỉ đề đúng khối và có backend firebase');
 // vào thi Firebase
 const card=pg.locator('.exam-card',{hasText:'Giữa kỳ Firebase'});await card.locator('.exam-go').click();
 await pg.waitForSelector('#msg-dialog[open]');ok((await pg.innerText('#msg-body')).includes('45 phút'),'hộp xác nhận nêu 45 phút');await pg.click('#msg-ok');
 await pg.waitForSelector('#exam-screen:not([hidden]) .ex-card');
 const s=get(`/sessions/fe1/${UID}`);ok(s&&Math.abs(s.started_at-now())<5000&&s.extra_ms===0,'tạo phiên bằng giờ máy chủ + extra_ms 0');
 ok(st.puts.some(([p])=>p===`/clock/${UID}`),'lấy giờ máy chủ qua clock/{uid}');
 const clock=await pg.innerText('.ex-clock');ok(/^4[45]:\d\d$/.test(clock),'đồng hồ theo giờ máy chủ (lệch 90 s không làm sai): '+clock);
 ok((await pg.innerText('.ex-card')).includes('Câu thứ nhất?'),'câu hỏi theo thứ tự order');
 await pg.click('.ex-opt[data-key=B]');await pg.waitForTimeout(2300);
 const d=get(`/drafts/fe1/${UID}`);ok(d&&d.answers.q1==='B'&&typeof d.updated_at==='number'&&d.leaves===0,'lưu nháp lên drafts');
 // token hết hạn giữa giờ → làm mới rồi ghi tiếp
 st.expireNext=true;await pg.keyboard.press('ArrowRight');await pg.click('.ex-opt[data-key=A]');await pg.waitForTimeout(2300);
 ok(st.refreshes>=1&&get(`/drafts/fe1/${UID}`).answers.q2==='A','token hết hạn → tự làm mới, nháp vẫn lưu');
 // nộp: lần đầu đã ghi nhưng mất phản hồi → thử lại gặp "đã tồn tại" → coi là đã nộp
 await pg.click('.ex-submit');await pg.waitForSelector('#msg-dialog[open]');await pg.click('#msg-ok');
 await pg.waitForSelector('.ex-result',{timeout:15000});
 const a=get(`/attempts/fe1/${UID}/1`);ok(a&&a.answers.q1==='B'&&a.answers.q2==='A'&&typeof a.submitted_at==='number','bài nộp ghi vào attempts/1');
 ok((await pg.innerText('.ex-result')).includes('Đã nhận bài'),'chưa có Apps Script → "Đã nhận bài, điểm có sau"');
 ok(!(await pg.locator('.ex-review').count()),'không hiện đúng/sai từng câu trước giờ đóng');
 await pg.click('.ex-result-actions .primary');await pg.waitForSelector('.exam-card');
 const go=pg.locator('.exam-card',{hasText:'Giữa kỳ Firebase'}).locator('.exam-go');ok(await go.isDisabled(),'hết lượt → nút vào thi bị khóa');
 // Đề có phần thực hành + Apps Script bật: chấm ngay, hiện điểm, nộp file (lần đầu Apps Script trả HTML bận → tự thử lại)
 await pg.evaluate(async()=>{(await import('./fb.js')).FB_CONFIG.appsScriptUrl='https://script.google.com/macros/s/TEST/exec'});
 await pg.click('button[data-tab=catalog]').catch(()=>{});await pg.click('button[data-tab=exams]');await pg.waitForSelector('.exam-card');
 const c2=pg.locator('.exam-card',{hasText:'Tin 9 lý thuyết + thực hành'});ok((await c2.innerText()).includes('Chưa nộp file thực hành')===false,'chưa vào thi thì chưa hiện ô nộp file');
 await c2.locator('.exam-go').click();await pg.click('#msg-ok');await pg.waitForSelector('#exam-screen:not([hidden]) .ex-card');
 await pg.click('.ex-opt[data-key=A]');await pg.click('.ex-submit');await pg.waitForSelector('#msg-dialog[open]');await pg.click('#msg-ok');
 await pg.waitForSelector('.ex-result');ok((await pg.innerText('.ex-score')).replace(/\s/g,'')==='10/10','Apps Script chấm ngay → hiện điểm');
 ok(st.gas.some(g=>g.action==='grade_my_attempt'&&g.exam_id==='fe2'&&g.attempt==='1'),'gửi grade_my_attempt kèm ID token');
 ok(!(await pg.locator('.ex-review').count()),'vẫn không hiện đúng/sai từng câu');
 ok(await pg.locator('.practice-box').isVisible(),'màn kết quả có khối nộp file thực hành');
 const fs2=require('fs'),os=require('os');const bad=path.join(os.tmpdir(),'bai.exe');fs2.writeFileSync(bad,'x');
 await pg.setInputFiles('.practice-upload input[type=file]',bad);await pg.waitForFunction(()=>document.querySelector('.practice-status.bad'));
 ok((await pg.innerText('.practice-status')).includes('.xlsx'),'từ chối file sai loại ngay trên máy');
 const good=path.join(os.tmpdir(),'bai-thuc-hanh.xlsx');fs2.writeFileSync(good,Buffer.alloc(2048,1));
 await pg.setInputFiles('.practice-upload input[type=file]',good);
 await pg.waitForFunction(()=>/Đã nộp/.test(document.querySelector('.practice-status').textContent),null,{timeout:15000});
 ok(st.gas.filter(g=>g.action==='upload_practice').length===2,'Apps Script trả HTML bận → tự thử lại, lần 2 thành công');
 ok((await pg.innerText('.practice-pick')).includes('Nộp lại'),'sau khi nộp đổi thành "Nộp lại"');
 await pg.click('.ex-result-actions button');await pg.waitForSelector('.exam-card');
 put(`/results/fe2/${UID}`,{theory_score:4,total_score:4,practice_file:{name:'bai-thuc-hanh.xlsx'}});
 await pg.click('button[data-tab=catalog]').catch(()=>{});await pg.click('button[data-tab=exams]');await pg.waitForSelector('.exam-card');
 const c3=await pg.locator('.exam-card',{hasText:'Tin 9 lý thuyết + thực hành'}).innerText();
 ok(c3.includes('Đã nộp file thực hành: bai-thuc-hanh.xlsx')&&c3.includes('Nộp lại file thực hành'),'thẻ đề hiện đã nộp file + cho nộp lại trong giờ');
 // Firebase sập: đề Worker vẫn hiện
 st.fbDown=true;await pg.click('button[data-tab=catalog]').catch(()=>{});await pg.click('button[data-tab=exams]');await pg.waitForSelector('.exam-card');
 const t2=await pg.locator('.exam-title').allTextContents();ok(t2.includes('Đề Worker cũ'),'Firebase lỗi vẫn thấy đề Worker');
 st.fbDown=false;
 // đăng xuất xóa phiên Firebase
 await pg.evaluate(()=>document.getElementById('logout').click());await pg.waitForTimeout(500);
 ok(!(await pg.evaluate(()=>localStorage.getItem('aisgk-fb'))),'đăng xuất xóa phiên Firebase');
 ok(errs.length===0,'không lỗi trang: '+errs.join(' | '));
 await ctx.close();
 // sai PIN Firebase không làm hỏng đăng nhập Worker
 {const c2=await b.newContext({serviceWorkers:'block'});const p2=await c2.newPage();
  await p2.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});if(u.endsWith('/login'))return j({token:'t'});if(u.endsWith('/pwa/me'))return j({uid:'hs02',grade:9});return j({exams:[],courses:[],grades:[],attempts:[]})});
  await p2.route('https://identitytoolkit.googleapis.com/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{"error":{"message":"INVALID_LOGIN_CREDENTIALS"}}'}));
  await p2.goto('http://aihoc.test:8193/');await p2.click('#gate-student');await p2.fill('#student-code','hs02');await p2.fill('#student-pin','999999');await p2.click('#login-form button[type=submit]');
  await p2.waitForFunction(()=>!document.getElementById('login-dialog').open);await p2.waitForTimeout(400);
  ok(!(await p2.evaluate(()=>localStorage.getItem('aisgk-fb'))),'chưa có tài khoản Firebase → vẫn đăng nhập Worker, không có phiên Firebase');await c2.close()}
 console.log(`EXAM FIREBASE FLOW OK (${n} kiểm tra)`);
}finally{await b.close();srv.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
