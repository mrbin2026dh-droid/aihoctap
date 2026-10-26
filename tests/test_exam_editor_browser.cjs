// Giáo viên mở đề đã lưu, thấy từng câu hỏi dạng thẻ, sửa trực tiếp, thêm/xóa câu rồi lưu; các nút thao tác là icon đủ lớn trên mọi màn hình.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8191);
const EXAM={exam_id:'exam_t1',title:'Giữa kỳ Tin 9',grade:9,subject_id:'tin-hoc',mode:'trial',kind:'midterm',status:'open',reveal:'after-submit',shuffle:false,total_points:3,question_count:2,
 questions:[{id:'q1',kind:'choice',prompt:'RAM là gì?',options:{A:'Bộ nhớ trong',B:'Ổ cứng',C:'Chuột'},correct_answer:'A',points:1,topic:'Phần cứng',hint:''},{id:'q2',kind:'text',prompt:'Giải thích.',options:{},correct_answer:'',points:2,topic:'',hint:'Nêu ví dụ'}]};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));let saved=null;
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/catalog'))body={schema_version:1,revision:'r',courses:[]};
 else if(u.endsWith('/pwa/teacher/exams')){if(r.request().method()==='POST'){saved=JSON.parse(r.request().postData());body={exam_id:'exam_t1',status:'open'}}else body={exams:[{exam_id:'exam_t1',title:EXAM.title,grade:9,class_codes:[],mode:'trial',kind:'midterm',status:'open',state:'open',question_count:2,total_points:3,submissions:1,updated_at:1}]}}
 else if(u.endsWith('/pwa/teacher/exams/exam_t1'))body=EXAM;
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8191/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(800);
await pg.click('#nav-exams');await pg.waitForSelector('#exams-tbody tr td');
assert(!(await pg.isVisible('#exams-preview-note')),'đã bỏ ghi chú dữ liệu minh họa');
for(const vw of [[360,740],[390,844],[768,900],[1280,800]]){await pg.setViewportSize({width:vw[0],height:vw[1]});
 const btns=pg.locator('#exams-tbody .t-icon-btn');assert.strictEqual(await btns.count(),3,'Sửa, Thống kê, Đóng đề (đề Thử không có Theo dõi)');
 for(let i=0;i<3;i++){const bb=await btns.nth(i).boundingBox();assert(bb.width>=47.5&&bb.height>=47.5,vw+' nút đủ 48px');assert(bb.x>=0&&bb.x+bb.width<=vw[0],vw+' nút nằm trong màn hình: '+JSON.stringify(bb))}
 assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),vw+' không cuộn ngang');
 for(const n of ['Sửa','Thống kê','Đóng đề'])assert.strictEqual(await pg.locator(`#exams-tbody button[aria-label^="${n}"]`).count(),1,n);}
await pg.setViewportSize({width:1100,height:900});
if(process.env.SHOTS){await pg.setViewportSize({width:390,height:844});await pg.screenshot({path:process.env.SHOTS+'/list390.png'});await pg.setViewportSize({width:1100,height:900});}
// Mở đề: hiện câu hỏi dạng thẻ
await pg.click('#exams-tbody button[aria-label^="Sửa"]');await pg.waitForSelector('.t-qe-card');
assert.strictEqual(await pg.locator('.t-qe-card').count(),2);assert.strictEqual(await pg.inputValue('.t-qe-card:nth-child(1) textarea'.replace('nth-child(1)','nth-of-type(1)')),'RAM là gì?');
assert(/2 câu · tổng 3 điểm/.test(await pg.innerText('#exam-total-points')));
// Căn hàng: Lớp và Môn cùng hàng, cùng cao độ
const gy=await pg.locator('#field-exam_mode').boundingBox(),sy=await pg.locator('#field-exam_subject').boundingBox();assert(Math.abs(gy.y-sy.y)<1,'Môn và Hình thức thẳng hàng '+JSON.stringify([gy,sy]));
// Sửa trực tiếp
const c1=pg.locator('.t-qe-card').nth(0);await c1.locator('textarea').fill('RAM là loại bộ nhớ nào?');await c1.locator('input[aria-label="Đáp án B của câu 1"]').fill('Bộ nhớ ngoài');await c1.locator('input[aria-label="Đáp án D của câu 1"]').fill('Màn hình');await c1.locator('input[type=radio][value=D]').check();
await c1.locator('input[type=number]').fill('1.5');assert(/tổng 3,5 điểm/.test(await pg.innerText('#exam-total-points')),'tổng điểm cập nhật khi sửa');
// Thêm câu trắc nghiệm trống: lưu bị chặn và báo rõ
await pg.click('[data-qe-add=choice]');assert.strictEqual(await pg.locator('.t-qe-card').count(),3);await pg.click('#save-exam');
await pg.waitForFunction(()=>/Câu 3: chưa nhập nội dung/.test(document.getElementById('exam-save-status').innerText));assert.strictEqual(saved,null,'câu thiếu nội dung không gửi lên');
const c3=pg.locator('.t-qe-card').nth(2);await c3.locator('textarea').fill('Câu mới?');await c3.locator('input[aria-label="Đáp án A của câu 3"]').fill('Một');
await pg.click('#save-exam');await pg.waitForFunction(()=>/Câu 3: trắc nghiệm cần ít nhất 2/.test(document.getElementById('exam-save-status').innerText));
await c3.locator('input[aria-label="Đáp án B của câu 3"]').fill('Hai');
// Xóa câu 2 (tự luận)
await pg.locator('.t-qe-card').nth(1).locator('button[aria-label="Xóa câu 2"]').click();assert.strictEqual(await pg.locator('.t-qe-card').count(),2);
await pg.click('#save-exam');await pg.waitForSelector('dialog[open]');await pg.click('dialog[open] #msg-ok');
assert(saved&&saved.exam_id==='exam_t1'&&saved.questions.length===2,JSON.stringify(saved));
assert.deepStrictEqual(saved.questions.map(q=>[q.id,q.kind,q.points,q.correct_answer,q.prompt]),[['q1','choice',1.5,'D','RAM là loại bộ nhớ nào?'],['q3','choice',1,'A','Câu mới?']],JSON.stringify(saved.questions));
assert.deepStrictEqual(saved.questions[0].options,{A:'Bộ nhớ trong',B:'Bộ nhớ ngoài',C:'Chuột',D:'Màn hình'});assert.deepStrictEqual(saved.questions[1].options,{A:'Một',B:'Hai'},'đáp án trống bị bỏ');
// Đổi loại sang tự luận: không gửi đáp án
await pg.click('#exams-tbody button[aria-label^="Sửa"]');await pg.waitForSelector('.t-qe-card');
await pg.locator('.t-qe-card').nth(1).locator('select').selectOption('text');assert(!(await pg.locator('.t-qe-card').nth(1).locator('.t-qe-options').isVisible()));
await pg.click('#save-exam');await pg.waitForSelector('dialog[open]');await pg.click('dialog[open] #msg-ok');
assert.deepStrictEqual([saved.questions[1].kind,saved.questions[1].correct_answer,saved.questions[1].options],['text','',{}]);
// Điện thoại: thẻ câu hỏi không tràn
await pg.click('#exams-tbody button[aria-label^="Sửa"]');await pg.waitForSelector('.t-qe-card');await pg.setViewportSize({width:360,height:740});
assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'360px: không cuộn ngang trong trình sửa');
if(process.env.SHOTS){await pg.locator('#exam-editor-card').screenshot({path:process.env.SHOTS+'/editor360.png'});await pg.setViewportSize({width:1100,height:900});await pg.locator('#form-exams').screenshot({path:process.env.SHOTS+'/form1100.png'});}
assert.strictEqual(errs.length,0,errs.join(';'));
console.log('EXAM EDITOR BROWSER OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
