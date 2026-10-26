// Giáo viên: thêm học sinh với mã tự đặt, tải mẫu, nhập Excel (báo lỗi từng dòng), tải danh sách có PIN, xuất danh sách.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8188);
const students=[{id:'hsndcil6',name:'Nguyễn Văn Nam',grade:9,class_code:'9A1',disabled:false}];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:900},serviceWorkers:'block',acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));let single=null,imported=null;
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;const m=r.request().method();let body={};
 if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/catalog'))body={schema_version:1,revision:'r',courses:[]};
 else if(u.endsWith('/teacher/students/import')){imported=JSON.parse(r.request().postData());const res=imported.students.map((s,i)=>s.student_id==='hs9a01'?{index:i,ok:false,error:'Mã học sinh "hs9a01" đã tồn tại.'}:{index:i,ok:true,id:s.student_id||'hsauto'+i,name:s.name,grade:s.grade,class_code:s.class_code.toUpperCase(),pin:s.pin||'654321'});body={created:res.filter(x=>x.ok).length,failed:res.filter(x=>!x.ok).length,results:res};res.filter(x=>x.ok).forEach(x=>students.push({id:x.id,name:x.name,grade:x.grade,class_code:x.class_code,disabled:false}))}
 else if(u.endsWith('/teacher/students')&&m==='POST'){single=JSON.parse(r.request().postData());body={id:single.student_id||'hsauto',name:single.name,grade:single.grade,class_code:single.class_code,pin:'111222'};students.push({id:body.id,name:body.name,grade:body.grade,class_code:body.class_code,disabled:false})}
 else if(u.endsWith('/teacher/students'))body=students;
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8188/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(800);
await pg.click('#nav-accounts');await pg.waitForSelector('#students-tbody tr[data-sid]');
assert.equal(await pg.getAttribute('#field-student_search','placeholder'),'Nhập tên hoặc mã học sinh');assert.equal(await pg.innerText('#students-count'),'1 học sinh');
// 1. Thêm tay với mã tự đặt
await pg.click('#act-accounts-new');await pg.fill('#field-add-student-form-student_id','HS9A07');await pg.fill('#field-add-student-form-name','Lê Văn Bảy');await pg.fill('#field-add-student-form-class_code','9A1');
await pg.click('#add-student-form button[type=submit]');await pg.waitForSelector('dialog[open]');assert.equal(single.student_id,'HS9A07');assert(/hs9a07|HS9A07/i.test(await pg.innerText('dialog[open]')));await pg.click('dialog[open] #msg-cancel');
await pg.waitForFunction(()=>/2 học sinh/.test(document.getElementById('students-count').innerText));
// 2. Tải mẫu
const [tpl]=await Promise.all([pg.waitForEvent('download'),pg.click('#act-accounts-template')]);assert.equal(tpl.suggestedFilename(),'mau-hoc-sinh.xlsx');const tplPath=path.join(os.tmpdir(),'mau-hoc-sinh.xlsx');await tpl.saveAs(tplPath);assert(fs.statSync(tplPath).size>1000);
// 3. Nhập đúng file mẫu: 2 dòng hợp lệ (dòng đầu trùng mã có sẵn trên máy chủ)
await pg.click('#act-accounts-import');await pg.waitForSelector('#detail-accounts-import:not([hidden])');
await pg.setInputFiles('#field-student-file',tplPath);await pg.waitForSelector('#student-import-preview table');
let t=await pg.innerText('#student-import-preview');assert(/Đọc được 2 dòng: 2 hợp lệ/.test(t),t);assert.equal(await pg.innerText('#student-import-run'),'Tạo 2 tài khoản');
// 4. File có lỗi
await pg.addScriptTag({url:'/vendor/write-excel-file.min.js'});
const make=async rows=>Buffer.from(await pg.evaluate(async rows=>{const data=rows.map(r=>r.map(v=>typeof v==='number'?{value:v,type:Number}:{value:String(v)}));const blob=await writeXlsxFile(data).toBlob();const buf=new Uint8Array(await blob.arrayBuffer());let s='';buf.forEach(c=>s+=String.fromCharCode(c));return btoa(s)},rows),'base64');
const H=['Mã học sinh','Họ và tên','Khối','Lớp','Mã PIN'];
await pg.setInputFiles('#field-student-file',{name:'sai.xlsx',mimeType:'application/octet-stream',buffer:await make([H,['','Phạm Dung',9,'9A1',''],['Nguyễn','Sai mã',9,'9A1',''],['hs9a09','',9,'9A1','12'],['hs9a10','Khối sai',3,'9A1','']])});
await pg.waitForFunction(()=>/chưa đúng/.test(document.getElementById('student-import-preview').innerText));t=await pg.innerText('#student-import-preview');
assert(/Đọc được 4 dòng: 1 hợp lệ, 3 chưa đúng/.test(t)&&/Mã học sinh gồm/.test(t)&&/Thiếu họ và tên/.test(t)&&/PIN phải từ 6/.test(t)&&/Khối phải là số/.test(t),t);
// 5. Nhập file mẫu: dòng 1 bị máy chủ báo trùng, dòng 2 tạo được -> chỉ tạo dòng hợp lệ
await pg.setInputFiles('#field-student-file',tplPath);await pg.waitForSelector('#student-import-run:not([disabled])');await pg.click('#student-import-run');
await pg.waitForFunction(()=>/Đã tạo 1 tài khoản/.test(document.getElementById('student-import-preview').innerText));t=await pg.innerText('#student-import-preview');assert(/đã tồn tại/.test(t)&&/Đã tạo/.test(t),t);
assert.equal(imported.students.length,2);assert.equal(imported.students[0].student_id,'hs9a01');assert.equal(imported.students[1].student_id,undefined,'dòng không có mã -> để máy chủ tự sinh');
const [created]=await Promise.all([pg.waitForEvent('download'),pg.click('#student-import-download')]);assert.equal(created.suggestedFilename(),'tai-khoan-vua-tao.xlsx');
// 6. Xuất danh sách (theo bộ lọc)
if(await pg.locator('dialog[open]').count())await pg.click('dialog[open] #msg-ok');await pg.click('#act-accounts-import-back');await pg.waitForSelector('#students-tbody tr[data-sid]');
await pg.fill('#field-student_search','bảy');assert.equal(await pg.locator('#students-tbody tr[data-sid]').count(),1);
const [ex]=await Promise.all([pg.waitForEvent('download'),pg.click('#act-accounts-export')]);assert(/^hoc_sinh_.*\.xlsx$/.test(ex.suggestedFilename()),ex.suggestedFilename());
// 7. Điện thoại: không tràn ngang
if(await pg.locator('dialog[open]').count())await pg.click('dialog[open] #msg-ok');
await pg.setViewportSize({width:390,height:844});assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'tràn ngang');
assert.strictEqual(errs.length,0,errs.join(';'));
console.log('STUDENT IMPORT BROWSER OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
