// Nộp bài: Worker không trả version thì vẫn được coi là đã xác nhận (lỗi "Máy chủ chưa xác nhận đúng bài nộp").
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8173);
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v);
const LESSON={schema_version:1,course_id:'tin-hoc-9',lesson_id:'b1',title:'Thế giới kĩ thuật số',content_markdown:'# Thế giới kĩ thuật số\n\nDữ liệu là các giá trị được máy tính lưu trữ và xử lý.\n\n- Thông tin\n- Dữ liệu',questions:[{id:'q1',prompt:'Dữ liệu nào sau đây là dữ liệu số?',kind:'choice',options:{A:'Tiếng nói trực tiếp',B:'Tệp ảnh trên máy tính',C:'Mùi hương',D:'Cảm xúc'},hint:'Nghĩ về thứ máy tính lưu được.'}]};
LESSON.version=require('crypto').createHash('sha256').update(JSON.stringify(sortKeys(LESSON))).digest('hex');
const CAT={schema_version:1,revision:'r1',courses:[{id:'tin-hoc-9',subject_id:'tin-hoc',subject_name:'Tin học',title:'Tin học 9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số',version:LESSON.version,question_count:4},{id:'b2',title:'Thực hành: Xử lý dữ liệu bảng tính nâng cao',version:'99a19c1',question_count:4}]}]};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));let posted=0;
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body=CAT;if(!u.endsWith('catalog')&&!u.endsWith('/login')&&!u.endsWith('/pwa/me'))body={attempts:[],results:[],items:[]};if(u.endsWith('/login'))body={token:'t',must_change_pin:false};if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nguyễn Văn Nam',class_code:'9A',grade:9};if(u.includes('/pwa/lessons/'))body=LESSON;
 if(u.endsWith('/pwa/attempts')&&r.request().method()==='POST'){posted++;const b=JSON.parse(r.request().postData());body={attempt_id:b.attempt_id,course_id:b.course_id,lesson_id:b.lesson_id,status:'submitted',score:10,total:1,correct:1}}
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8173/');await pg.waitForTimeout(500);
await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(1000);
await pg.locator('.lesson-open').first().click();await pg.waitForTimeout(500);await pg.getByRole('button',{name:'Làm bài tập'}).first().click();await pg.waitForTimeout(300);
await pg.locator('input[type=radio]').first().check({force:true});await pg.click('#question-form button[type=submit]');await pg.waitForTimeout(1200);
assert.strictEqual(posted,1,'đã gửi bài');const text=await pg.evaluate(()=>document.body.innerText);
assert(!text.includes('chưa xác nhận đúng'),'không báo lỗi xác nhận');assert(await pg.isVisible('#result-view')&&(await pg.locator('#result-view').innerText()).includes('Kết quả')&&await pg.isVisible('.score-ring'),'hiện trang Kết quả riêng');
assert.strictEqual(errs.length,0,errs.join(';'));console.log('SUBMIT ACK OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
