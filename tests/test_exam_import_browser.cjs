// Giáo viên tải mẫu Excel, tải file lên: đúng thì báo thành công, sai thì chỉ rõ dòng và lý do.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),os=require('os');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8183);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:900},serviceWorkers:'block',acceptDownloads:true});const pg=await ctx.newPage();let saved=null;const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/catalog'))body={schema_version:1,revision:'r',courses:[]};else if(u.endsWith('/teacher/analytics')){return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({detail:'Endpoint không tồn tại.'})})}else if(u.includes('/gemini-keys'))body={keys:[]};else if(u.endsWith('/ai-stats'))body={stats:[]};else if(u.endsWith('/ai-settings'))body={settings:{}};else if(u.endsWith('/teacher/students'))body=[];else if(u.includes('/pwa/teacher/results'))body=[];
 if(u.endsWith('/pwa/teacher/exams')){if(r.request().method()==='POST'){saved=JSON.parse(r.request().postData());body={exam_id:'exam_t1',status:'draft'}}else body={exams:saved?[{exam_id:'exam_t1',title:saved.title,grade:saved.grade,class_codes:[],mode:saved.mode,minutes:saved.minutes,opens_at:saved.opens_at,closes_at:saved.closes_at,status:'draft',state:'draft',question_count:saved.questions.length,total_points:3,submissions:0}]:[]}}
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
await pg.goto('http://localhost:8183/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(800);
assert(/chưa cập nhật tính năng báo cáo/.test(await pg.innerText('#teacher-analytics')),'máy chủ cũ: báo nhẹ trong thẻ');assert.strictEqual(await pg.locator('dialog[open]').count(),0,'không bật hộp thoại lỗi khi máy chủ chưa cập nhật');
await pg.click('#nav-exams');await pg.click('#act-exams-new');await pg.waitForTimeout(300);
// 1b. Lưu khi chưa có câu hỏi: báo rõ
await pg.fill('#field-exam_title','Kiểm tra giữa kỳ');await pg.click('#save-exam');await pg.waitForFunction(()=>/Chưa có câu hỏi/.test(document.getElementById('exam-save-status').innerText));assert.strictEqual(saved,null,'chưa gửi lên máy chủ');
// 1. Tải mẫu
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#act-exams-template')]);
assert.strictEqual(dl.suggestedFilename(),'mau-de-kiem-tra.xlsx');
const tplPath=path.join(os.tmpdir(),'mau-de-kiem-tra.xlsx');await dl.saveAs(tplPath);assert(fs.statSync(tplPath).size>1000,'file mẫu có nội dung');
// 2. Tải đúng file mẫu lên -> thành công
await pg.setInputFiles('#field-exam-file',tplPath);await pg.waitForSelector('#exam-import-preview .notice');
let txt=await pg.innerText('#exam-import-preview');
assert(/Tải lên thành công: 2 câu \(1 trắc nghiệm, 1 tự luận\), tổng 3 điểm/.test(txt),txt);
assert(/Không phải 10|không phải 10/.test(txt),'cảnh báo tổng điểm khác 10: '+txt);
assert((txt.match(/Hợp lệ/g)||[]).length===2,txt);
// 2b. Lưu đề thật: gửi đúng cấu hình và điểm từng câu
await pg.selectOption('#field-exam_mode','real');await pg.fill('#field-exam_minutes','15');await pg.fill('#field-exam_open','2026-11-01T08:00');await pg.fill('#field-exam_close','2026-11-01T09:00');await pg.fill('#field-exam_attempts','1');
await pg.click('#save-exam');await pg.waitForSelector('dialog[open]');assert(/Đã lưu đề/.test(await pg.innerText('dialog[open]')));await pg.click('dialog[open] #msg-ok');
assert(saved&&saved.mode==='real'&&saved.minutes===15&&saved.max_attempts===1&&saved.title==='Kiểm tra giữa kỳ'&&saved.status==='draft',JSON.stringify(saved));
assert.deepStrictEqual(saved.questions.map(q=>[q.kind,q.points,q.correct_answer]),[['choice',1,'A'],['text',2,'']]);
assert(new Date(saved.closes_at)-new Date(saved.opens_at)===3600000,'giờ mở/đóng đổi đúng sang mili giây');
await pg.waitForFunction(()=>/Kiểm tra giữa kỳ/.test(document.getElementById('exams-tbody').innerText));
const row=await pg.innerText('#exams-tbody');assert(/Thật · 15 phút/.test(row)&&/Nháp/.test(row)&&/Mở đề/.test(row),row);
await pg.click('#act-exams-new');await pg.waitForTimeout(200);
// 3. File sai: dựng bằng thư viện trong trang
await pg.addScriptTag({url:'/vendor/write-excel-file.min.js'});
const make=async rows=>{const b64=await pg.evaluate(async rows=>{const data=rows.map((r,i)=>r.map(v=>typeof v==='number'?{value:v,type:Number}:{value:String(v)}));const blob=await writeXlsxFile(data).toBlob();const buf=new Uint8Array(await blob.arrayBuffer());let s='';buf.forEach(c=>s+=String.fromCharCode(c));return btoa(s)},rows);return Buffer.from(b64,'base64')};
const H=['STT','Loại (TN/TL)','Câu hỏi','A','B','C','D','Đáp án đúng','Điểm','Chủ đề','Gợi ý'];
const bad=await make([H,[1,'TN','Câu 1?','a1','b1','c1','d1','A',1,'',''],[2,'TN','Câu 2?','a2','b2','','','C','','',''],[3,'XX','Câu 3?','','','','','',1,'','']]);
await pg.setInputFiles('#field-exam-file',{name:'sai.xlsx',mimeType:'application/octet-stream',buffer:bad});await pg.waitForFunction(()=>/dòng chưa đúng/.test(document.getElementById('exam-import-preview').innerText));
txt=await pg.innerText('#exam-import-preview');
if(process.env.SHOT)await pg.locator('#exam-import-card').screenshot({path:process.env.SHOT});
assert(/Có 2 dòng chưa đúng/.test(txt)&&/chưa có câu nào được nhận/.test(txt),txt);
assert(/Đáp án đúng C đang để trống/.test(txt)&&/Thiếu điểm của câu/.test(txt)&&/TN hoặc TL/.test(txt),txt);
assert(!/Tải lên thành công/.test(txt),'file sai không được báo thành công');
// 4. Sai tiêu đề cột, sai định dạng, sai đuôi
const wrong=await make([['Câu','Điểm'],['x',1]]);
await pg.setInputFiles('#field-exam-file',{name:'mau-cu.xlsx',mimeType:'application/octet-stream',buffer:wrong});await pg.waitForFunction(()=>/không đúng mẫu/.test(document.getElementById('exam-import-preview').innerText));
await pg.setInputFiles('#field-exam-file',{name:'hong.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('không phải excel')});await pg.waitForFunction(()=>/Không đọc được file/.test(document.getElementById('exam-import-preview').innerText));
await pg.setInputFiles('#field-exam-file',{name:'de.csv',mimeType:'text/csv',buffer:Buffer.from('a,b')});await pg.waitForFunction(()=>/Chỉ nhận file .xlsx/.test(document.getElementById('exam-import-preview').innerText));
assert.strictEqual(errs.length,0,errs.join(';'));
console.log('EXAM IMPORT BROWSER OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
