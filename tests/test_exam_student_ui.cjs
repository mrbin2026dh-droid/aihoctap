// Màn hình thi của học sinh: danh sách, vào thi, đồng hồ, tự lưu, đánh dấu, phím tắt, nộp bài, mất mạng, hết giờ tự nộp.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8186);
const Q=[{id:'q1',kind:'choice',prompt:'Câu một là gì?',options:{A:'Một',B:'Hai',C:'Ba',D:'Bốn'},points:2},{id:'q2',kind:'choice',prompt:'Câu hai là gì?',options:{A:'Một',B:'Hai',C:'Ba',D:'Bốn'},points:2},{id:'q3',kind:'text',prompt:'Giải thích ngắn.',points:1}];
const state={saves:[],submits:0,failSubmit:1,deadlineMs:20*60000,exam:'real'};
const CAT={schema_version:1,revision:'r1',courses:[]};
const list=()=>({server_now:Date.now(),exams:[
 {exam_id:'exam_aa',title:'Kiểm tra 15 phút',mode:'real',kind:'15m',minutes:15,opens_at:Date.now()-1000,closes_at:Date.now()+3600000,state:'open',question_count:3,total_points:5,attempts_used:0,attempts_left:1,best_score:null,in_progress:false},
 {exam_id:'exam_bb',title:'Ôn tập thử',mode:'trial',kind:'period',minutes:null,opens_at:null,closes_at:null,state:'open',question_count:3,total_points:5,attempts_used:1,attempts_left:null,best_score:6,in_progress:false},
 {exam_id:'exam_cc',title:'Giữa kỳ sắp mở',mode:'real',kind:'midterm',minutes:45,opens_at:Date.now()+9e6,closes_at:Date.now()+1e7,state:'upcoming',question_count:3,total_points:5,attempts_used:0,attempts_left:1,best_score:null,in_progress:false}]});
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/api/**',async r=>{const u=new URL(r.request().url()).pathname;const m=r.request().method();const ok=body=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 if(u.includes('login'))return ok({token:'t'});if(u.endsWith('/pwa/me'))return ok({uid:'hs01',student_name:'An',grade:9,class_code:'9A'});
 if(u.endsWith('/pwa/exams')&&m==='GET')return ok(list());
 if(u.endsWith('/pwa/exams/start'))return ok({exam_id:'exam_aa',title:'Kiểm tra 15 phút',mode:state.exam,minutes:15,total_points:5,questions:Q,attempt_id:'xabc',attempt_no:1,started_at:Date.now(),deadline:state.exam==='real'?Date.now()+state.deadlineMs:null,answers:{},server_now:Date.now()});
 if(u.endsWith('/pwa/exams/save')){state.saves.push(JSON.parse(r.request().postData()));return ok({saved_at:Date.now()})}
 if(u.endsWith('/pwa/exams/submit')){if(state.failSubmit>0){state.failSubmit--;return r.abort('failed')}state.submits++;return ok({score:6,earned:3,total_points:5,correct:1,total:2,needs_review:1,answers_key:{q1:'B',q2:'D',q3:'Gợi ý'},status:'submitted'})}
 if(u.endsWith('catalog'))return ok(CAT);return ok({attempts:[],results:[],items:[]})});
await pg.goto('http://localhost:8186/');await pg.waitForTimeout(400);
await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(800);
await pg.click('button[data-tab=exams]');await pg.waitForTimeout(800);await pg.waitForSelector('.exam-card');
assert.strictEqual(await pg.locator('.exam-card').count(),3);
const labels=await pg.$$eval('.exam-go',e=>e.map(x=>[x.textContent,x.disabled]));assert.deepEqual(labels,[['Vào thi',false],['Làm lại',false],['Vào thi',true]],JSON.stringify(labels));
// vào thi thật: có hộp xác nhận
await pg.locator('.exam-go').first().click();await pg.waitForSelector('#msg-dialog[open]');
assert((await pg.innerText('#msg-body')).includes('15 phút'),'xác nhận nêu thời gian');await pg.click('#msg-ok');
await pg.waitForSelector('#exam-screen:not([hidden]) .ex-card');
const clock=await pg.innerText('.ex-clock');assert(/^(19:5\d|20:00)$/.test(clock),'đồng hồ '+clock);
assert((await pg.innerText('.ex-q-num')).includes('Câu 1/3'));
// chọn B, tự lưu
await pg.click('.ex-opt[data-key=B]');await pg.waitForTimeout(2200);
assert(state.saves.length>=1&&state.saves.at(-1).answers.q1==='B','đã tự lưu B');
assert(await pg.locator('.ex-opt[aria-checked=true]').count()===1);
// đánh dấu + palette
await pg.keyboard.press('f');assert(await pg.locator('.ex-pn.is-flag').count()===1,'câu 1 đánh dấu');
await pg.keyboard.press('ArrowRight');assert((await pg.innerText('.ex-q-num')).includes('Câu 2/3'));
await pg.keyboard.press('c');assert(await pg.locator('.ex-opt[data-key=C][aria-checked=true]').count()===1,'phím C chọn đáp án');
// bảng câu hỏi trên điện thoại
await pg.click('.ex-pal-toggle');await pg.click('.ex-pn:nth-child(3)');assert((await pg.innerText('.ex-q-num')).includes('Câu 3/3'));
await pg.fill('.ex-text','Vì nó đúng');assert((await pg.textContent('.ex-counts')).includes('3/3'));
// tải lại trang giữa chừng không mất bài (bản sao trên máy)
const local=await pg.evaluate(()=>localStorage.getItem('aisgk-exam:hs01:exam_aa'));assert(local&&JSON.parse(local).answers.q2==='C','có bản sao trên máy');
// nộp: lần đầu mất mạng, tự thử lại
await pg.click('.ex-submit');await pg.waitForSelector('#msg-dialog[open]');const sb=await pg.innerText('#msg-body');assert(sb.includes('3/3'),sb);await pg.click('#msg-ok');
await pg.waitForFunction(()=>/tự thử lại/.test(document.querySelector('.ex-save').textContent),null,{timeout:5000});
await pg.waitForSelector('.ex-result',{timeout:8000});
assert(state.submits===1);assert((await pg.innerText('.ex-score')).replace(/\s/g,'')==='6/10');
const res=await pg.innerText('.ex-result');assert(res.includes('3/5')&&res.includes('chờ thầy cô chấm')&&res.includes('Đáp án đúng: D'),res);
assert(!(await pg.evaluate(()=>localStorage.getItem('aisgk-exam:hs01:exam_aa'))),'xoá bản sao sau khi nộp');
await pg.click('.ex-result-actions .primary');await pg.waitForSelector('.exam-card');assert(await pg.locator('#exam-screen').isHidden());
// hết giờ tự nộp
state.deadlineMs=3500;state.failSubmit=0;state.submits=0;
await pg.locator('.exam-go').first().click();await pg.click('#msg-ok');await pg.waitForSelector('.ex-card');
await pg.waitForSelector('.ex-result',{timeout:9000});assert(state.submits===1,'tự nộp khi hết giờ');
await pg.click('.ex-result-actions .primary');
// thi thử: không có đồng hồ, không hộp xác nhận
state.exam='trial';await pg.locator('.exam-go').nth(1).click();await pg.waitForSelector('.ex-card');assert(await pg.locator('.ex-clock').isHidden(),'thi thử không có đồng hồ');
assert((await pg.innerText('.ex-title')).includes('Thi thử'));
// kích thước vùng chạm và cỡ chữ
const small=await pg.$$eval('#exam-screen button',bs=>bs.filter(x=>x.offsetParent&&x.getBoundingClientRect().height<47).map(x=>x.textContent));assert.deepEqual(small,[],'vùng chạm <48px: '+small);
const overflow=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,'tràn ngang');
for(const [w,h] of [[360,740],[768,900],[1280,800]]){await pg.setViewportSize({width:w,height:h});assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'tràn ngang '+w);}
await pg.emulateMedia({colorScheme:'dark'});await pg.waitForTimeout(100);
const bg=await pg.evaluate(()=>getComputedStyle(document.getElementById('exam-screen')).backgroundColor);assert(bg!=='rgb(255, 253, 247)','nền tối: '+bg);
assert.strictEqual(errs.length,0,errs.join(';'));
console.log('EXAM STUDENT UI OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
