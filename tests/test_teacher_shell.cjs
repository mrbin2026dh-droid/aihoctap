// Giao diện giáo viên v3: menu 4 phân hệ, danh sách → chi tiết, bảo vệ chưa lưu, thao tác hàng loạt, Hồ sơ.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_teacher_shell.cjs  (SHOTS=/đường/dẫn để lưu ảnh)
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const SHOTS=process.env.SHOTS||'';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8143);
const B='http://localhost:8143';
const STUDENTS=[{id:'hs01',name:'Học sinh Thử 01',grade:9,class_code:'9A',disabled:false},{id:'hs02',name:'Học sinh Thử 02',grade:9,class_code:'9A',disabled:false},{id:'hs03',name:'Học sinh Thử 03',grade:6,class_code:'6B',disabled:true}];
(async()=>{const b=await chromium.launch();try{
for(const vp of [{width:1280,height:800,n:'d'},{width:390,height:800,n:'m'}]){
const ctx=await b.newContext({viewport:{width:vp.width,height:vp.height},serviceWorkers:'block'});const pg=await ctx.newPage();const reqs=[];const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;const m=r.request().method();let body={};let post=null;try{post=r.request().postDataJSON()}catch{}
reqs.push({m,u,post});
if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};
else if(u.endsWith('/pwa/catalog'))body={courses:[{id:'tin-hoc-9',title:'Tin học 9',grade:9,lessons:[{id:'bai-1',title:'Thông tin và dữ liệu',version:'abcdef123',question_count:4}]},{id:'tin-hoc-6',title:'Tin học 6',grade:6,lessons:[{id:'bai-2',title:'Máy tính và em',version:'zzzzzz',question_count:2}]}]};
else if(u.includes('/pwa/teacher/lesson/'))body={subject_id:'tin-hoc-9',subject_name:'Tin học 9',grade:9,lesson_id:'bai-1',title:'Thông tin và dữ liệu',content_markdown:'# Nội dung',questions:[{id:'q1',prompt:'Câu 1?',kind:'choice',options:{A:'a',B:'b'},correct_answer:'A',hint:''}]};
else if(u.includes('/pwa/teacher/results'))body=[];
else if(u.endsWith('/teacher/students')&&m==='GET')body=STUDENTS;
else if(u.endsWith('/teacher/students')&&m==='POST')body={id:'hs99',name:post&&post.name,pin:'000000'};
else if(u.endsWith('/ai-settings'))body={settings:{default_limit:10,exam_mode:false}};
else if(u.endsWith('/ai-stats'))body={stats:[]};
else if(u.endsWith('/gemini-keys'))body={keys:[]};
r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
const T=vp.n+' ';
await pg.goto(B+'/teacher.html');await pg.waitForTimeout(500);
// đăng nhập
await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(1200);
assert(await pg.isVisible('#editor'),T+'editor phải hiện sau đăng nhập');
assert.strictEqual(await pg.textContent('#workspace-title'),'Soạn bài');
assert.strictEqual(await pg.getAttribute('#nav-lessons','aria-current'),'page');
assert.strictEqual(await pg.locator('#lesson-list article').count(),2,T+'danh sách bài từ danh mục');
await pg.fill('#field-lesson_search','máy tính');assert.strictEqual(await pg.locator('#lesson-list article').count(),1,T+'tìm bài');await pg.fill('#field-lesson_search','');
await pg.selectOption('#field-lesson_grade','9');assert.strictEqual(await pg.locator('#lesson-list article').count(),1,T+'lọc lớp');await pg.selectOption('#field-lesson_grade','');
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-1-lessons.png`,fullPage:true});
// mở bài
await pg.click('#lesson-list article button');await pg.waitForTimeout(500);
assert(await pg.isVisible('#detail-lessons'),T+'chi tiết bài');assert(!(await pg.isVisible('#list-lessons')),T+'danh sách ẩn');
assert.strictEqual(await pg.inputValue('#field-publish-form-title'),'Thông tin và dữ liệu');
assert.strictEqual(await pg.locator('#question-editors fieldset').count(),1);
// tab bàn phím
await pg.focus('#tab-lesson-info');await pg.keyboard.press('ArrowRight');
assert.strictEqual(await pg.getAttribute('#tab-lesson-theory','aria-selected'),'true');assert(await pg.isVisible('#tabpanel-lesson-theory'));assert(!(await pg.isVisible('#tabpanel-lesson-info')));
await pg.keyboard.press('End');assert(await pg.isVisible('#tabpanel-lesson-practice'),T+'tab End');
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-2-lesson-practice.png`,fullPage:true});
await pg.click('#act-lessons-back');await pg.waitForTimeout(200);assert(await pg.isVisible('#list-lessons'),T+'quay lại danh sách khi chưa sửa');
// soạn mới + chưa lưu
await pg.click('#new-lesson');await pg.waitForTimeout(300);assert(await pg.isVisible('#detail-lessons'));
await pg.fill('#field-publish-form-title','Bài đang gõ');
await pg.click('#nav-exams');await pg.waitForTimeout(300);
assert(await pg.isVisible('#msg-dialog'),T+'phải hỏi khi bỏ thay đổi chưa lưu');
await pg.click('#msg-cancel');await pg.waitForTimeout(200);
assert(await pg.isVisible('#detail-lessons'),T+'Hủy = ở lại');assert.strictEqual(await pg.inputValue('#field-publish-form-title'),'Bài đang gõ');
await pg.click('#nav-exams');await pg.waitForTimeout(300);await pg.click('#msg-ok');await pg.waitForTimeout(300);
assert(await pg.isVisible('#view-exams'));assert.strictEqual(await pg.textContent('#workspace-title'),'Kiểm tra');
assert(await pg.isVisible('#exams-preview-note'),T+'ghi chú bản xem thử');
await pg.click('#act-exams-new');await pg.waitForTimeout(200);assert(await pg.isDisabled('#form-exams button[type=submit]'),T+'không lưu đề giả');
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-3-exams.png`,fullPage:true});
// tài liệu
await pg.click('#nav-materials');await pg.waitForTimeout(200);await pg.click('#act-materials-new');await pg.waitForTimeout(200);
await pg.fill('[name=material_title]','Đề cương Tin học 9');
const mid=await pg.inputValue('[name=material_id]');assert(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(mid)&&mid.startsWith('de-cuong-tin-hoc-9'),T+'mã tài liệu tự sinh: '+mid);
await pg.selectOption('#field-material-form-material_course_id','tin-hoc-9');await pg.fill('[name=material_drive_url]','https://drive.google.com/file/d/abc/view');
const before=reqs.length;await pg.click('#material-form button[type=submit]');await pg.waitForTimeout(500);
const posts=reqs.slice(before).filter(r=>r.u.endsWith('/pwa/teacher/materials'));assert.strictEqual(posts.length,1,T+'một yêu cầu đăng tài liệu');assert.strictEqual(posts[0].post.course_id,'tin-hoc-9');
assert(await pg.isVisible('#list-materials'),T+'về danh sách sau khi lưu');
// học sinh
await pg.click('#nav-accounts');await pg.waitForTimeout(500);
assert.strictEqual(await pg.locator('#students-tbody tr').count(),3);
await pg.fill('#field-student_search','thử 02');assert.strictEqual(await pg.locator('#students-tbody tr').count(),1,T+'tìm học sinh');await pg.fill('#field-student_search','');
await pg.check('#students-tbody tr:nth-child(1) input[type=checkbox]');await pg.check('#students-tbody tr:nth-child(2) input[type=checkbox]');
assert(await pg.isVisible('[data-bulk]'));assert.strictEqual(await pg.textContent('[data-selection-count]'),'2');
let n0=reqs.length;await pg.click('#act-accounts-bulk-lock');await pg.waitForTimeout(250);assert(await pg.isVisible('#msg-dialog'));
await pg.click('#msg-cancel');await pg.waitForTimeout(200);assert.strictEqual(reqs.slice(n0).filter(r=>r.m==='POST').length,0,T+'Hủy = 0 yêu cầu');
await pg.click('#act-accounts-bulk-lock');await pg.waitForTimeout(250);await pg.click('#msg-ok');await pg.waitForTimeout(800);
assert.strictEqual(reqs.slice(n0).filter(r=>r.m==='POST'&&r.u.endsWith('/lock')).length,2,T+'khóa đúng 2 học sinh');
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-4-accounts.png`,fullPage:true});
await pg.click('#act-accounts-new');await pg.waitForTimeout(200);assert(await pg.isVisible('#detail-accounts'));
await pg.fill('#field-add-student-form-name','Học sinh Mới');await pg.fill('#field-add-student-form-class_code','9C');
n0=reqs.length;await pg.click('#add-student-form button[type=submit]');await pg.waitForTimeout(700);
assert.strictEqual(reqs.slice(n0).filter(r=>r.m==='POST'&&r.u.endsWith('/teacher/students')).length,1,T+'thêm 1 lần');assert(await pg.isVisible('#list-accounts'));
// Hồ sơ
await pg.click('#open-settings');await pg.waitForTimeout(200);assert(await pg.isVisible('#nav-profile'),T+'popover Hồ sơ');
await pg.click('#act-profile-ai');await pg.waitForTimeout(300);
assert(await pg.isVisible('#settings'));assert(!(await pg.isVisible('#workspace')));assert(await pg.isVisible('[data-profile-panel=ai]'));assert(!(await pg.isVisible('[data-profile-panel=pin]')));
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-5-settings.png`,fullPage:true});
await pg.click('#close-settings');await pg.waitForTimeout(200);assert(await pg.isVisible('#workspace'));
await pg.click('#open-settings');await pg.click('#teacher-logout');await pg.waitForTimeout(600);
assert(await pg.isVisible('#auth-section'),T+'đăng xuất về đăng nhập');assert(!(await pg.isVisible('#editor')));
const overflow=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,T+'không cuộn ngang');
assert.deepStrictEqual(errs,[],T+'không lỗi trang: '+errs.join('|'));
await ctx.close();}
console.log('TEACHER SHELL TESTS PASSED (desktop + mobile)');}finally{await b.close();srv.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
