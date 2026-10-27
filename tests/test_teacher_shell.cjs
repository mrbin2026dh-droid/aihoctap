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
const sheetCalls=[];const STU=[{ma:'hs01',ten:'Học sinh thử 01',lop:'9A',trang_thai:'Hoạt động'},{ma:'hs02',ten:'Học sinh thử 02',lop:'9A',trang_thai:'Hoạt động'},{ma:'hs03',ten:'Học sinh thử 03',lop:'9B',trang_thai:'Hoạt động'}];
await pg.route('https://script.google.com/**',r=>{const p=JSON.parse(r.request().postData());sheetCalls.push(p);const t=[{ma:'GV01',ten:'Cô Hoa',lop:['9A','9B'],trang_thai:'Hoạt động'}];r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p.action.startsWith('gv_teacher')?{ok:true,teachers:t}:p.action.startsWith('gv_doc')?{ok:true,khoi:null,docs:[{id:'tl1',tieu_de:'Đề cương HK1',khoi:9,mo_ta:'',file_id:'F1',ten_file:'de-cuong.pdf',size:20480,at:'2026-10-27'}]}:p.action.startsWith('gv_student')?{ok:true,admin:true,students:STU,classes:{'9A':9,'9B':9}}:{ok:true,exams:[],bank:{},classes:{}})})});
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;const m=r.request().method();let body={};let post=null;try{post=r.request().postDataJSON()}catch{}
reqs.push({m,u,post});
let status=200;
if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};
else if(u.endsWith('/hs02/lock'))status=500;
else if(u.endsWith('/pwa/catalog'))body={courses:[{id:'tin-hoc-9',title:'Tin học 9',grade:9,lessons:[{id:'bai-1',title:'Thông tin và dữ liệu',version:'abcdef123',question_count:4}]},{id:'tin-hoc-6',title:'Tin học 6',grade:6,lessons:[{id:'bai-2',title:'Máy tính và em',version:'zzzzzz',question_count:2}]}]};
else if(u.includes('/pwa/teacher/lesson/'))body={subject_id:'tin-hoc-9',subject_name:'Tin học 9',grade:9,lesson_id:'bai-1',title:'Thông tin và dữ liệu',content_markdown:'# Nội dung',questions:[{id:'q1',prompt:'Câu 1?',kind:'choice',options:{A:'a',B:'b'},correct_answer:'A',hint:''}]};
else if(u.includes('/pwa/teacher/results'))body=[];
else if(u.endsWith('/teacher/students')&&m==='GET')body=STUDENTS;
else if(u.endsWith('/teacher/students')&&m==='POST')body={id:'hs99',name:post&&post.name,pin:'000000'};
else if(u.endsWith('/ai-settings'))body={settings:{default_limit:10,exam_mode:false}};
else if(u.endsWith('/ai-stats'))body={stats:[]};
else if(u.endsWith('/gemini-keys'))body={keys:[]};
r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})});
const T=vp.n+' ';const ack=async(btn='#msg-ok')=>{await pg.waitForTimeout(250);if(await pg.isVisible('#msg-dialog'))await pg.click(btn);await pg.waitForTimeout(150)};
await pg.goto(B+'/teacher.html');await pg.waitForTimeout(500);
assert(!(await pg.isVisible('#teacher-login-error')),T+'ô lỗi đăng nhập rỗng phải ẩn');
assert.strictEqual((await pg.textContent('#status')).trim(),'',T+'không có thanh thông báo nổi');
// đăng nhập
await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(1200);
assert(await pg.isVisible('#workspace'),T+'khung làm việc phải hiện sau đăng nhập');assert(!(await pg.isVisible('#msg-dialog')),T+'đăng nhập thành công không bật hộp thoại');
assert.strictEqual(await pg.textContent('#workspace-title'),'Tổng quan',T+'đăng nhập vào Tổng quan trước');
assert.strictEqual(await pg.getAttribute('#nav-overview','aria-current'),'page');assert(await pg.isVisible('#teacher-analytics'),T+'báo cáo hiện ngay');
assert.strictEqual(await pg.locator('.t-nav-item').first().getAttribute('id'),'nav-overview',T+'Tổng quan đứng đầu menu');
assert.strictEqual(await pg.getAttribute('#open-settings','aria-label'),'Hồ sơ');assert(await pg.locator('#open-settings svg').count()===1&&!(await pg.textContent('#open-settings')).trim(),T+'nút Hồ sơ là biểu tượng bánh răng');
await pg.click('#nav-lessons');await pg.waitForTimeout(200);assert(await pg.isVisible('#editor'),T+'editor hiện ở mục Soạn bài');
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
assert(await pg.isVisible('#view-exams'));assert.strictEqual(await pg.textContent('#workspace-title'),'Về nhà');
assert(!(await pg.isVisible('#exams-preview-note')),T+'đã bỏ ghi chú dữ liệu minh họa');
await pg.click('#nav-sheetexam');await pg.waitForTimeout(300);assert(await pg.isVisible('#view-sheetexam')&&await pg.isVisible('#list-sheetexam'),T+'menu Thi mở được');assert.strictEqual(await pg.textContent('#workspace-title'),'Thi');assert(!(await pg.isVisible('#view-exams')),T+'menu Thi không còn hiện trang Về nhà');await pg.click('#nav-exams');await pg.waitForTimeout(300);
await pg.click('#act-exams-new');await pg.waitForTimeout(200);assert(!(await pg.isDisabled('#form-exams button[type=submit]')),T+'nút Lưu đề hoạt động');
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-3-exams.png`,fullPage:true});
// tài liệu: PDF ≤ 10 MB → Google Drive qua Google Sheet
await pg.click('#nav-materials');await pg.waitForFunction(()=>document.querySelectorAll('#docs-body tr').length===1&&document.querySelector('#docs-body').textContent.includes('Đề cương'));
assert.strictEqual(await pg.locator('#docs-body tr:first-child .t-icon-btn').count(),3,T+'mỗi tài liệu: mở xem, chỉnh sửa, xóa');
await pg.click('#docs-add');await pg.waitForSelector('#docs-dialog[open]');await pg.click('#docs-save');await pg.waitForTimeout(100);
assert.strictEqual(await pg.getAttribute('#docs-title-in','aria-invalid'),'true',T+'thiếu tiêu đề → báo dưới trường');
await pg.fill('#docs-title-in','Đề cương Tin học 9');await pg.click('#docs-save');await pg.waitForTimeout(100);assert((await pg.textContent('#docs-file-err')).includes('Chọn file PDF'),T+'thiếu file → báo');
await pg.setInputFiles('#docs-file-in',{name:'anh.png',mimeType:'image/png',buffer:Buffer.from('x')});await pg.click('#docs-save');await pg.waitForTimeout(100);assert((await pg.textContent('#docs-file-err')).includes('PDF'),T+'không phải PDF → báo');
await pg.setInputFiles('#docs-file-in',{name:'big.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(10*1024*1024+1)});await pg.click('#docs-save');await pg.waitForTimeout(100);assert((await pg.textContent('#docs-file-err')).includes('tối đa 10 MB'),T+'quá 10 MB → báo');
await pg.setInputFiles('#docs-file-in',{name:'de-cuong.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4')});await pg.selectOption('#docs-khoi-in','9');
await pg.click('#docs-save');await pg.waitForFunction(()=>!document.getElementById('docs-dialog').open);
const dsv=sheetCalls.at(-1);assert(dsv.action==='gv_doc_save'&&dsv.tieu_de==='Đề cương Tin học 9'&&dsv.khoi===9&&dsv.ten_file==='de-cuong.pdf'&&Buffer.from(dsv.data,'base64').toString()==='%PDF-1.4',T+'tải PDF lên gửi đúng tiêu đề, khối, file');
let nd=sheetCalls.length;await pg.locator('#docs-body tr:first-child .t-icon-btn').nth(2).click();await pg.waitForSelector('#msg-dialog[open]');assert((await pg.textContent('#msg-dialog')).includes('Xóa tài liệu?'),T+'xóa → hộp thoại xác nhận');await pg.click('#msg-cancel');await pg.waitForTimeout(150);assert.strictEqual(sheetCalls.length,nd,T+'Hủy = 0 yêu cầu');
await pg.locator('#docs-body tr:first-child .t-icon-btn').nth(1).click();await pg.waitForSelector('#docs-dialog[open]');assert((await pg.inputValue('#docs-title-in'))==='Đề cương HK1'&&(await pg.textContent('#docs-file-hint')).includes('de-cuong.pdf'),T+'chỉnh sửa: điền sẵn, file cũ');await pg.click('#docs-cancel');
// tài khoản (Google Sheet): tab Học sinh + tab Giáo viên
await pg.click('#nav-accounts');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr').length===3);
assert.strictEqual((await pg.textContent('#nav-accounts')).includes('Tài khoản'),true,T+'menu đổi tên Tài khoản');
assert.deepStrictEqual(await pg['$$eval']('#acc-root > .t-tabs [role=tab]',a=>a.map(x=>x.textContent)),['Học sinh','Giáo viên'],T+'hai tab Học sinh / Giáo viên');
await pg.fill('#acc-hs-search','thử 02');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr').length===1);await pg.fill('#acc-hs-search','');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr').length===3);
// 1000 học sinh không treo: vẽ 50 dòng/lần + "Hiện thêm"
for(let i=4;i<=1000;i++)STU.push({ma:'hs'+String(i).padStart(4,'0'),ten:'Học sinh số '+i,lop:i%2?'9A':'9B',trang_thai:'Hoạt động'});
await pg.click('#nav-overview');await pg.click('#nav-accounts');await pg.waitForFunction(()=>document.querySelector('#acc-hs-count').textContent.startsWith('1000'));
assert.strictEqual(await pg.locator('#acc-hs-body tr').count(),50,T+'1000 học sinh: chỉ vẽ 50 dòng');
assert((await pg.textContent('#acc-hs-table + .t-more')).includes('Đang hiện 50/1000'),T+'báo đang hiện 50/1000');
await pg.click('#acc-hs-table + .t-more button');assert.strictEqual(await pg.locator('#acc-hs-body tr').count(),100,T+'Hiện thêm → 100 dòng');
await pg.fill('#acc-hs-search','số 999');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr').length===1);assert(await pg.locator('#acc-hs-table + .t-more').isHidden(),T+'lọc còn 1 dòng → ẩn Hiện thêm');await pg.fill('#acc-hs-search','');
STU.splice(3);await pg.click('#nav-overview');await pg.click('#nav-accounts');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr').length===3);
const R='#acc-hs-body tr:nth-child(1) .t-icon-btn';assert.strictEqual(await pg.locator(R).count(),4,T+'mỗi dòng 4 nút biểu tượng');
for(const b of await pg.locator(R).all()){assert(await b.getAttribute('aria-label'),T+'nút có tên truy cập');const bb=await b.boundingBox();assert(bb.width>=47&&bb.height>=47,T+'vùng chạm 48px')}
let n1=sheetCalls.length;await pg.locator(R).nth(2).click();await pg.waitForSelector('#msg-dialog[open]');assert((await pg.textContent('#msg-dialog')).includes('Khóa tài khoản học sinh?'),T+'Khóa → hộp thoại xác nhận');await pg.click('#msg-cancel');await pg.waitForTimeout(200);
assert.strictEqual(sheetCalls.slice(n1).length,0,T+'Hủy = 0 yêu cầu');
await pg.locator(R).nth(2).click();await pg.click('#msg-ok');await pg.waitForTimeout(400);assert.strictEqual(sheetCalls.at(-1).action,'gv_student_save');assert.strictEqual(sheetCalls.at(-1).trang_thai,'Khóa',T+'khóa đúng học sinh');
if(SHOTS)await pg.screenshot({path:`${SHOTS}/${vp.n}-4-accounts.png`,fullPage:true});
await pg.click('#acc-hs-add');await pg.waitForSelector('#acc-dialog[open]');await pg.click('#acc-save');await pg.waitForTimeout(150);
assert.strictEqual(await pg.getAttribute('#acc-ma','aria-invalid'),'true',T+'bỏ trống mã → báo dưới trường');
await pg.fill('#acc-ma','hs9c01');await pg.fill('#acc-ten','Học sinh Mới');await pg.fill('#acc-lop','9C');await pg.fill('#acc-pin','123');await pg.click('#acc-save');await pg.waitForTimeout(150);
assert((await pg.textContent('#acc-pin-err')).includes('6 đến 16'),T+'PIN ngắn → báo');
await pg.fill('#acc-pin','246810');await pg.click('#acc-save');await pg.waitForFunction(()=>!document.getElementById('acc-dialog').open);
const sv=sheetCalls.at(-1);assert(sv.action==='gv_student_save'&&sv.moi===true&&sv.ma==='hs9c01'&&sv.lop==='9C'&&sv.pin==='246810',T+'thêm học sinh gửi đúng');
await pg.click('#tab-acc-gv');await pg.waitForSelector('#acc-gv-body tr');assert((await pg.textContent('#acc-gv-body')).includes('Cô Hoa')&&(await pg.textContent('#acc-gv-body')).includes('9A, 9B'),T+'tab Giáo viên: danh sách, lớp phụ trách');
await pg.click('#acc-gv-add');await pg.fill('#acc-ma','GV02');await pg.fill('#acc-ten','Thầy Nam');await pg.fill('#acc-lop','8A, 8B');await pg.fill('#acc-pin','135790');await pg.click('#acc-save');await pg.waitForFunction(()=>!document.getElementById('acc-dialog').open);
assert(sheetCalls.at(-1).action==='gv_teacher_save'&&sheetCalls.at(-1).lop==='8A, 8B',T+'thêm giáo viên lớp');
await pg.click('#tab-acc-hs');
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
