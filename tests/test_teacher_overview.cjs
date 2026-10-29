// Tổng quan giáo viên (29/10 tối): chọn LỚP một chỗ → 5 mục theo lớp đó, mẫu số là sĩ số (thi_hs); đủ mọi lớp kể cả lớp chưa nộp bài; danh sách em chưa làm.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8189);
const SH=process.env.SHOTS;
const base={generated_at:Date.now(),total_attempts:10,classes:['9A1','9A2'],class_filter:null,
 topics:[{topic:'Phần cứng máy tính',correct:0,total:2,percent:0,level:'weak'},{topic:'Mạng',correct:3,total:4,percent:75,level:'fair'}],
 lessons:[{course_id:'tin9',lesson_id:'b1',title:'Thế giới kĩ thuật số',is_exam:false,students:3,attempts:6,avg_percent:40,level:'weak',questions:[{id:'q1',number:1,prompt:'Bộ phận nào được ví như "bộ não" của máy tính?',topic:'Phần cứng máy tính',answered:3,correct:0,blank:1,percent:0,level:'weak',top_wrong:{key:'B',text:'Màn hình',count:2}}]},
  {course_id:'exam',lesson_id:'exam_1',title:'Giữa kỳ',is_exam:true,students:2,attempts:4,avg_percent:90,level:'good',questions:[]}],
 students:[{uid:'hs1',name:'Nguyễn Văn Nam',class_code:'9A1',lessons:2,avg_percent:35,level:'weak',last_at:Date.now()-86400000,weak_topics:[{topic:'Phần cứng máy tính',percent:0}],items:[{title:'Thế giới kĩ thuật số',is_exam:false,percent:0},{title:'Giữa kỳ',is_exam:true,percent:70}]},
  {uid:'hs2',name:'Trần Thị Bình',class_code:'9A2',lessons:2,avg_percent:65,level:'fair',last_at:Date.now(),weak_topics:[],items:[]},
  {uid:'hs3',name:'Lê Cường',class_code:'9A2',lessons:1,avg_percent:95,level:'good',last_at:null,weak_topics:[],items:[]}]};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1200,height:900},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));const asked=[];
const roster={hs1:{ten:'Nguyễn Văn Nam',lop:'9A1'},hs4:{ten:'Phạm An',lop:'9A1'},hs2:{ten:'Trần Thị Bình',lop:'9A2'},hs3:{ten:'Lê Cường',lop:'9A2'},hs5:{ten:'Đỗ Hà',lop:'9A2'},hs6:{ten:'Em lớp 8',lop:'8A1'}};
await pg.route('**/*firebasedatabase.app/**',r=>{const u=new URL(r.request().url());r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.pathname==='/thi_hs.json'?roster:null)})});
await pg.route('**/api/**',r=>{const u=new URL(r.request().url());let body={};
 if(u.pathname.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.pathname.endsWith('/pwa/catalog'))body={schema_version:1,revision:'r',courses:[]};
 else if(u.pathname.endsWith('/teacher/analytics')){asked.push(u.search);const c=u.searchParams.get('class');body=c==='9A2'?{...base,class_filter:'9A2',total_attempts:4,students:base.students.slice(1)}:c==='9A1'?{...base,class_filter:'9A1',students:base.students.slice(0,1)}:c==='8A1'?{...base,class_filter:'8A1',total_attempts:0,students:[],lessons:[],topics:[]}:base}
 else if(u.pathname.endsWith('/teacher/exams'))body={exams:[]};else if(u.pathname.endsWith('/teacher/students'))body=[];
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8189/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('.a-tiles');
assert.strictEqual(await pg.textContent('#workspace-title'),'Tổng quan');
// mặc định: khối cao nhất, lớp đông nhất (9A2, 3 em); đủ mọi lớp kể cả 8A1 chưa nộp bài; không còn "Tất cả các lớp" trộn khối
assert.deepEqual(await pg.$$eval('#overview-class option',o=>o.map(x=>x.value)),['9A1','9A2','k:9','8A1']);assert.deepEqual(await pg.$$eval('#overview-class optgroup',o=>o.map(x=>x.label)),['Khối 9','Khối 8']);
assert.strictEqual(await pg.inputValue('#overview-class'),'9A2');assert(asked[0].includes('class=9A2'),asked[0]);
assert.strictEqual(await pg.innerText('#a-head-sub'),'Lớp 9A2 · 3 học sinh');
const tiles=await pg.$$eval('.a-tile',e=>e.map(x=>x.innerText.replace(/\s+/g,' ').trim()));
assert.deepEqual(tiles,['Đã làm bài 2/3 67% sĩ số','Chưa làm bài 1 cần nhắc nhở','Lượt nộp 4 2 bài','Đúng trung bình 80% của các em đã làm','Cần hỗ trợ 0 dưới 50% đúng'],JSON.stringify(tiles));
const t=await pg.innerText('#teacher-analytics');
assert(['Tham gia','Mức nắm bài','Kết quả theo bài','Kiến thức cần củng cố','Từng học sinh'].every(x=>t.includes(x)),'đủ 5 mục');
assert(t.includes('Lớp 9A2: 1 tốt, 1 cần củng cố, 0 yếu, 1 chưa làm')&&t.includes('Chưa làm: 1')&&t.includes('2/3'),t);
assert(t.includes('nhiều bạn chọn B: Màn hình (2 bạn)')&&t.includes('1 bạn bỏ trống')&&t.includes('Kiểm tra')&&t.includes('Luyện tập'),'câu sai và bảng theo bài');
// từng học sinh: lọc mức, tìm tên, danh sách chưa làm
assert.strictEqual(await pg.locator('.a-student').count(),2);
await pg.click('.a-chipbtn:has-text("Chưa làm")');assert.strictEqual(await pg.locator('.a-notyet li').count(),1);assert((await pg.innerText('.a-notyet')).includes('Đỗ Hà'));
await pg.click('.a-chipbtn:has-text("Đã làm")');await pg.fill('.a-tools input','lê');assert.strictEqual(await pg.locator('.a-student').count(),1);assert((await pg.textContent('.a-student')).includes('Chưa có bài nộp'));
// đổi lớp: mọi mục tính lại theo lớp đó
await pg.selectOption('#overview-class','9A1');await pg.waitForFunction(()=>/Lớp 9A1/.test(document.getElementById('a-head-sub').innerText));assert(asked.at(-1).includes('class=9A1'));
assert.strictEqual(await pg.locator('.a-tile').first().innerText().then(x=>x.replace(/\s+/g,' ')),'Đã làm bài 1/2 50% sĩ số');
await pg.click('.a-chipbtn:has-text("Yếu")');assert.strictEqual(await pg.locator('.a-student').count(),1);
await pg.click('.a-student summary');assert(/Cần ôn:[\s\S]*Phần cứng máy tính \(0%\)/.test(await pg.innerText('.a-student')));assert((await pg.innerText('.a-student')).includes('hôm qua'));
// lớp chưa có bài nộp: vẫn chọn được, báo rõ sĩ số
await pg.selectOption('#overview-class','8A1');await pg.waitForFunction(()=>/chưa em nào nộp/.test(document.getElementById('teacher-analytics').innerText));assert.strictEqual(await pg.innerText('#a-head-sub'),'Lớp 8A1 · 1 học sinh');
await pg.selectOption('#overview-class','9A2');await pg.waitForSelector('.a-tiles');
if(SH)await pg.screenshot({path:SH+'/ov-desktop.png',fullPage:true});
// điện thoại + tối
await pg.setViewportSize({width:390,height:844});assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'tràn ngang');
const small=await pg.$$eval('#workspace button,#workspace select,#workspace input,#workspace summary,#open-settings',bs=>bs.filter(x=>x.offsetParent&&x.getBoundingClientRect().height<47).map(x=>x.textContent||x.id));assert.deepEqual(small,[],'vùng chạm <48px: '+small);
if(SH)await pg.screenshot({path:SH+'/ov-mobile.png',fullPage:true});
await pg.emulateMedia({colorScheme:'dark'});await pg.waitForTimeout(150);if(SH)await pg.screenshot({path:SH+'/ov-dark.png',fullPage:true});
// H1: bấm Đăng xuất trong bảng Cài đặt → bảng đóng, màn đăng nhập không còn bảng đè
await pg.setViewportSize({width:1200,height:900});await pg.click('#open-settings');await pg.waitForSelector('#nav-profile:popover-open');await pg.click('#teacher-logout');
await pg.waitForSelector('#auth-section:not([hidden])');assert.strictEqual(await pg.evaluate(()=>document.getElementById('nav-profile').matches(':popover-open')),false,'bảng Cài đặt vẫn mở sau khi đăng xuất');
assert.strictEqual(errs.length,0,errs.join(';'));
console.log('TEACHER OVERVIEW OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
