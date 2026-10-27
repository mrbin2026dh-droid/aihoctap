// Bài học: thanh neo tên bài + % đã đọc (ghi Firebase doc_read); Gia sư AI: khung chat neo góc (không che trang), hiệu ứng gõ chữ,
// tự tạm nghỉ khi lớp có bài thi thật đang mở; Tài liệu: PDF đúng khối từ Firebase tai_lieu (không còn chọn môn).
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const DB='https://test-doc-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8174);
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v);
const LESSON={schema_version:1,course_id:'tin-hoc-9',lesson_id:'b1',title:'Thế giới kĩ thuật số',content_markdown:'# Thế giới kĩ thuật số\n\n'+Array.from({length:40},(_, i)=>'Đoạn '+(i+1)+': Dữ liệu là các giá trị được máy tính lưu trữ và xử lý.').join('\n\n'),questions:[{id:'q1',prompt:'Dữ liệu nào sau đây là dữ liệu số?',kind:'choice',options:{A:'Tiếng nói trực tiếp',B:'Tệp ảnh trên máy tính',C:'Mùi hương',D:'Cảm xúc'},hint:'Nghĩ về thứ máy tính lưu được.'}]};
LESSON.version=require('crypto').createHash('sha256').update(JSON.stringify(sortKeys(LESSON))).digest('hex');
const CAT={schema_version:1,revision:'r1',courses:[{id:'tin-hoc-9',subject_id:'tin-hoc',subject_name:'Tin học',title:'Tin học 9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số',version:LESSON.version,question_count:4}]}]};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:1280,height:800},{width:390,height:844}]){const mobile=vp.width<500;
 const db={thi_bai:{},tai_lieu:{t1:{tieu_de:'Đề cương Tin 9',khoi:9,mo_ta:'Ôn HK1',file_id:'F9',ten_file:'de-cuong.pdf',size:204800,at:'2026-10-27'},t2:{tieu_de:'Tài liệu khối 8',khoi:8,file_id:'F8',ten_file:'k8.pdf',size:1000,at:'2026-10-26'}}};const writes=[];
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));const tutorCalls=[];
 await pg.route(DB+'/**',r=>{const u=new URL(r.request().url());const parts=u.pathname.replace(/\.json$/,'').split('/').filter(Boolean);const v=parts.reduce((o,k)=>o==null?undefined:o[k],db);
  if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v??null})}\n\n`});
  if(r.request().method()!=='GET'){writes.push({path:u.pathname,v:JSON.parse(r.request().postData()||'null')});return r.fulfill({status:200,contentType:'application/json',body:'{}'})}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v??null)})});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body=CAT;if(!u.endsWith('catalog')&&!u.endsWith('login')&&!u.endsWith('/pwa/me'))body={attempts:[],results:[],items:[]};if(u.endsWith('login'))body={token:'t',must_change_pin:false};if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nguyễn Văn Nam',class_code:'9A',grade:9};if(u.includes('/pwa/lessons/'))body=LESSON;
  if(u.endsWith('/pwa/ai-quota'))body={used:1,limit:20,remaining:19,locked:false,exam_mode:false};
  if(u.endsWith('/pwa/tutor')){tutorCalls.push(JSON.parse(r.request().postData()));body={reply:'**Gợi ý:** Em hãy đọc lại phần dữ liệu số trong bài nhé, rồi thử tự trả lời câu hỏi này.'}}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.goto('http://localhost:8174/');await pg.waitForTimeout(500);
 await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(1000);
 await pg.click('[data-tab=catalog]');await pg.waitForTimeout(300);await pg.locator('.lesson-open').first().click();await pg.waitForSelector('#read-bar:not([hidden])');
 ok((await pg.textContent('#read-bar .read-title')).includes('Thế giới kĩ thuật số')&&(await pg.textContent('#read-bar .read-pct')).includes('Đã đọc'),'bài học: thanh neo tên bài + % đã đọc');
 await pg.evaluate(()=>scrollTo(0,900));await pg.waitForTimeout(300);
 const top=await pg.evaluate(()=>document.getElementById('read-bar').getBoundingClientRect().top);const tb=await pg.evaluate(()=>{const t=document.querySelector('.topbar');return getComputedStyle(t).position==='sticky'?t.getBoundingClientRect().height:0});
 ok(Math.abs(top-tb)<=2,`cuộn xuống: thanh đọc bài dính ngay dưới thanh trên cùng (top ${Math.round(top)} ≈ ${Math.round(tb)})`);
 const mid=Number((await pg.textContent('#read-bar .read-pct')).match(/\d+/)?.[0]||0);ok(mid>0&&mid<100,'đang đọc giữa bài: '+mid+'%');
 await pg.evaluate(()=>scrollTo(0,document.body.scrollHeight));await pg.waitForTimeout(500);
 ok((await pg.textContent('#read-bar .read-pct')).includes('Đã đọc hết'),'cuộn hết bài → "Đã đọc hết"');
 const dr=writes.filter(w=>w.path.includes('/doc_read/tin-hoc-9~b1/hs01'));ok(dr.length>=2&&dr.at(-1).v.pct===100&&dr.at(-1).v.ten==='Nguyễn Văn Nam'&&dr.at(-1).v.lop==='9A'&&dr.every((w,i)=>!i||w.v.pct>dr[i-1].v.pct),'ghi % đọc lên Firebase theo mốc 10% (chỉ tăng)');
 // Gia sư AI
 await pg.evaluate(()=>scrollTo(0,0));await pg.click('#ask-tutor');await pg.waitForSelector('#tutor-dialog[open]');await pg.waitForTimeout(300);
 const dlg=await pg.evaluate(()=>{const d=document.getElementById('tutor-dialog');const r=d.getBoundingClientRect();return {modal:d.matches(':modal'),right:innerWidth-r.right,bottom:innerHeight-r.bottom,w:r.width,h:r.height}});
 ok(!dlg.modal,'khung chat không che trang (không phải hộp thoại chặn)');
 ok(mobile?(dlg.w>=vp.width-2&&dlg.bottom>=60):(dlg.right>=16&&dlg.right<=40&&dlg.bottom>=16&&dlg.bottom<=40&&dlg.w<=440),mobile?'điện thoại: tấm chat trượt lên, nằm trên thanh menu dưới':'máy tính: khung chat neo góc phải dưới');
 ok(await pg.isVisible('#lesson-content'),'vẫn đọc được bài khi đang mở chat');
 await pg.fill('#tutor-input','Dữ liệu số là gì?');await pg.click('#tutor-submit');
 await pg.waitForSelector('#tutor-messages .tutor-bot .typing',{timeout:5000});ok(true,'câu trả lời hiện dần (hiệu ứng gõ chữ, có con trỏ)');
 await pg.waitForFunction(()=>{const m=[...document.querySelectorAll('#tutor-messages .tutor-bot')].at(-1);return m&&m.querySelector('strong')&&!m.querySelector('.typing')},null,{timeout:6000});
 ok((await pg.textContent('#tutor-messages')).includes('Gợi ý:')&&tutorCalls.length===1,'gõ xong → định dạng đầy đủ (chữ đậm)');
 await pg.keyboard.press('Escape');await pg.waitForTimeout(150);ok(!(await pg.evaluate(()=>document.getElementById('tutor-dialog').open)),'Esc đóng khung chat');
 // Lớp có bài thi thật đang mở → gia sư tạm nghỉ
 db.thi_bai.x1={tieu_de:'Giữa kỳ',che_do:'that',khoi:9,lop:'9A',trang_thai:'mo',so_cau:2};await pg.waitForFunction(()=>!!document.querySelector('[data-tab="exams"] .nav-badge'),null,{timeout:8000});
 await pg.click('#ask-tutor');await pg.waitForSelector('#tutor-dialog[open]');await pg.waitForTimeout(300);
 ok((await pg.textContent('#tutor-quota-badge'))==='Đang thi','có bài thi thật đang mở: nhãn "Đang thi"');
 await pg.fill('#tutor-input','Câu 1 đáp án gì?');await pg.click('#tutor-submit');await pg.waitForTimeout(200);
 ok(tutorCalls.length===1&&(await pg.textContent('#tutor-messages')).includes('bài thi thật đang mở'),'đang có bài thi thật: không gửi câu hỏi cho AI, báo lý do');
 await pg.click('#close-tutor');
 // Tài liệu
 await pg.click('[data-tab=materials]');await pg.waitForSelector('.doc-card');
 ok(await pg.locator('#materials-course-select').count()===0,'Tài liệu: bỏ ô chọn môn học');
 ok(await pg.locator('.doc-card').count()===1&&(await pg.textContent('.doc-card')).includes('Đề cương Tin 9')&&(await pg.textContent('.doc-card')).includes('200 KB')&&(await pg.textContent('#materials-sub')).includes('khối 9'),'chỉ hiện tài liệu đúng khối 9 của em');
 await pg.evaluate(()=>{window.__opened=[];window.open=u=>{window.__opened.push(String(u));return null}});
 await pg.click('.doc-card button:has-text("Mở xem")');await pg.click('.doc-card button:has-text("Tải về")');const op=await pg.evaluate(()=>window.__opened);
 ok(op[0]==='https://drive.google.com/file/d/F9/view'&&op[1].includes('uc?export=download&id=F9'),'Mở xem → trang xem Google Drive; Tải về → tải file');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close()}
 console.log('LESSON AI DOCS UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
