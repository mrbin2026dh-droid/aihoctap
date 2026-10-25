// Giáo viên theo dõi bài làm, gia hạn, xem thống kê/xếp hạng và xuất Excel từ dữ liệu máy chủ.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8187);
const RES={exam:{exam_id:'exam_t1',title:'Giữa kỳ Tin 9',mode:'real',grade:9,class_codes:['9A'],minutes:45,total_points:10,question_count:2},server_now:Date.now(),
 stats:{total:4,submitted:2,in_progress:1,not_started:1,avg:6.5,max:9,min:4,pass_rate:50,distribution:[0,0,0,0,1,0,0,0,1,0]},
 rows:[{uid:'hs02',name:'Học sinh 02',class_code:'9A',status:'in_progress',attempts_used:0,best_score:null,leaves:4,remaining_ms:754000,late:false,needs_review:false},
  {uid:'hs01',name:'Học sinh 01',class_code:'9A',status:'not_started',attempts_used:0,best_score:null,leaves:0,remaining_ms:null},
  {uid:'hs03',name:'Học sinh 03',class_code:'9A',status:'submitted',attempts_used:1,best_score:9,leaves:0,late:false,needs_review:true},
  {uid:'hs04',name:'Học sinh 04',class_code:'9A',status:'submitted',attempts_used:1,best_score:4,leaves:1,late:true,needs_review:false}],
 ranking:[{rank:1,uid:'hs03',name:'Học sinh 03',class_code:'9A',score:9,needs_review:true},{rank:2,uid:'hs04',name:'Học sinh 04',class_code:'9A',score:4}],
 questions:[{id:'q1',number:1,prompt:'?',topic:'Phần cứng',answered:2,correct:1,percent:50,top_wrong:{key:'B',text:'Phần mềm',count:1}},{id:'q2',number:2,prompt:'?',topic:'',answered:2,correct:2,percent:100,top_wrong:null}]};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:900},serviceWorkers:'block',acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));let ext=null;
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/catalog'))body={schema_version:1,revision:'r',courses:[]};
 else if(u.endsWith('/pwa/teacher/exams'))body={exams:[{exam_id:'exam_t1',title:'Giữa kỳ Tin 9',grade:9,class_codes:['9A'],mode:'real',kind:'midterm',minutes:45,opens_at:Date.now()-1e5,closes_at:Date.now()+1e6,status:'open',state:'open',submissions:2}]};
 else if(u.endsWith('/results'))body=RES;else if(u.endsWith('/extend')){ext=JSON.parse(r.request().postData());body={uid:ext.uid,deadline:1}}
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8187/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(800);
await pg.click('#nav-exams');await pg.waitForSelector('#exams-tbody tr td');
await pg.getByRole('button',{name:'Theo dõi'}).click();await pg.waitForSelector('#exam-mon-body tr td');
let t=await pg.innerText('#detail-exams-monitor');assert(t.includes('Giữa kỳ Tin 9')&&t.includes('Đang làm')&&t.includes('12:34')&&t.includes('nộp muộn')&&!t.includes('[THỬ]'),t);
assert(/Rời tab[\s\S]*4/.test(t));assert.strictEqual(await pg.locator('#exam-mon-body button:has-text("Gia hạn")').count(),1,'chỉ bài đang làm có nút Gia hạn');
await pg.click('#exam-mon-body button:has-text("Gia hạn")');await pg.waitForSelector('dialog[open]');await pg.fill('dialog[open] input[name=minutes]','0');await pg.click('#msg-ok');
assert((await pg.innerText('dialog[open]')).includes('1 đến 120'),'chặn số phút sai');await pg.fill('dialog[open] input[name=minutes]','10');await pg.click('#msg-ok');
await pg.waitForFunction(()=>true);await pg.waitForTimeout(300);assert(ext&&ext.uid==='hs02'&&ext.minutes===10,JSON.stringify(ext));
if(await pg.locator('dialog[open]').count())await pg.click('dialog[open] #msg-ok');await pg.click('#act-exams-monitor-back');await pg.waitForSelector('#exams-tbody tr td');
await pg.getByRole('button',{name:'Thống kê'}).click();await pg.waitForSelector('#exam-stats-rank tr td');
t=await pg.innerText('#detail-exams-stats');assert(t.includes('6,5')&&t.includes('2 / 4')&&t.includes('Học sinh 03 *')&&t.includes('50%')&&t.includes('Phần mềm')&&!t.includes('[THỬ]'),t);
assert.strictEqual(await pg.locator('#exam-stats-chart rect').count(),10);assert(/4–5: 1/.test(await pg.getAttribute('#exam-stats-chart svg','aria-label')));
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#act-exams-export')]);assert(/^ket_qua_.*\.xlsx$/.test(dl.suggestedFilename()),dl.suggestedFilename());
const f=path.join(os.tmpdir(),'kq.xlsx');await dl.saveAs(f);assert(fs.statSync(f).size>1000);
if(await pg.locator('dialog[open]').count())await pg.click('dialog[open] #msg-ok');await pg.setViewportSize({width:390,height:844});await pg.click('#act-exams-stats-back');assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'tràn ngang');
assert.strictEqual(errs.length,0,errs.join(';'));
console.log('EXAM TEACHER MONITOR OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
