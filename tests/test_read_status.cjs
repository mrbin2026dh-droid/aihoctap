// Bài học: mở bài luôn ở ĐẦU bài (trước đây giữ vị trí cuộn của danh sách → mở ở cuối, % đọc nhảy lên 100% dù chưa đọc);
// đọc xong → danh sách bài hiện "Đã đọc hết", Tiến độ hiện "Học bài: đã đọc hết"; bảng Markdown hiện thành bảng.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 if(p==='/presence-config.js'){r.setHeader('content-type','text/javascript');return r.end("export const PRESENCE_CONFIG = {apiKey:'', dbUrl:''};")}
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'}[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))}).listen(8215);
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v);
const long=Array.from({length:40},(_,i)=>`Đoạn ${i+1}: nội dung bài học dài để phải cuộn mới đọc hết.`).join('\n\n');
const mk=(id,title,text)=>{const L={schema_version:1,course_id:'tin-hoc-9',lesson_id:id,title,content_markdown:'# '+title+'\n\n'+text,questions:[{id:'q1',prompt:'Câu hỏi '+id+'?',kind:'choice',options:{A:'Một',B:'Hai'}}]};L.version=crypto.createHash('sha256').update(JSON.stringify(sortKeys(L))).digest('hex');return L;};
const lessons=Array.from({length:8},(_,i)=>mk('b'+(i+1),'Bài số '+(i+1),(i===6?'| Tiêu chí | Ý nghĩa |\n| :--- | :--- |\n| **Tính mới** | Cập nhật |\n\n':'')+long));
const CAT={schema_version:1,revision:'r1',courses:[{id:'tin-hoc-9',subject_id:'tin-hoc',subject_name:'Tin học',title:'Tin học 9',grade:9,lessons:lessons.map(L=>({id:L.lesson_id,title:L.title,version:L.version,question_count:1}))}]};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await ctx.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={attempts:[],results:[],items:[]};
  if(u.endsWith('/pwa/catalog'))body=CAT;if(u.endsWith('login'))body={token:'t',must_change_pin:false};if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nguyễn Văn Nam',class_code:'9A',grade:9};
  if(u.includes('/pwa/lessons/')){const id=u.split('/pwa/lessons/')[1].split('/')[1];body=lessons.find(L=>L.lesson_id===id);}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.goto('http://localhost:8215/');await pg.waitForTimeout(400);
 await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');
 await pg.waitForSelector('#main:not([hidden])');await pg.click('[data-tab=catalog]');await pg.waitForSelector('.lesson-card >> nth=7');
 ok(!(await pg.locator('.read-chip').count()),'chưa đọc bài nào: không có nhãn đã đọc');
 const card=pg.locator('.lesson-card:has-text("Bài số 7")');await card.scrollIntoViewIfNeeded();await pg.mouse.wheel(0,600);await pg.waitForTimeout(200);
 const before=await pg.evaluate(()=>scrollY);await card.locator('.lesson-open').click();await pg.waitForFunction(()=>document.getElementById('lesson-content')?.textContent.includes('Đoạn 40'));await pg.waitForTimeout(400);
 ok(before>200&&await pg.evaluate(()=>scrollY)===0,'mở bài từ cuối danh sách: bài hiện từ ĐẦU (đọc từ trên xuống)');
 const pct0=await pg.textContent('.read-pct');ok(!pct0.includes('Đã đọc hết'),'vừa mở bài: chưa bị tính là đọc hết ('+pct0+')');
 ok(await pg.locator('#lesson-content .md-table table th').count()===2&&!(await pg.textContent('#lesson-content')).includes(':---'),'bảng trong bài hiện thành bảng, không còn "| :--- |"');
 for(let i=0;i<40;i++){await pg.mouse.wheel(0,800);await pg.waitForTimeout(30);}await pg.waitForTimeout(300);
 ok((await pg.textContent('.read-pct')).includes('Đã đọc hết'),'cuộn hết bài: "Đã đọc hết"');
 await pg.click('[data-tab=catalog]');await pg.waitForSelector('.lesson-card:has-text("Bài số 7") .read-chip');
 ok((await pg.textContent('.lesson-card:has-text("Bài số 7") .read-chip')).includes('Đã đọc hết')&&!(await pg.locator('.lesson-card:has-text("Bài số 1") .read-chip').count()),'danh sách bài: bài đã đọc có nhãn "Đã đọc hết", bài chưa đọc không có');
 await pg.click('[data-tab=progress]');await pg.waitForSelector('.path-read');
 ok((await pg.textContent('.path-step:has-text("Bài số 7") .path-read')).includes('đã đọc hết')&&(await pg.textContent('.path-step:has-text("Bài số 1") .path-read')).includes('chưa đọc'),'Tiến độ: "Học bài: đã đọc hết" / "chưa đọc" cho từng bài, tách riêng với bài tập');
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));
 console.log('READ STATUS OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
