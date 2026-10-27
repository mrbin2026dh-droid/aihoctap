// PWA ngoại tuyến (service worker THẬT): đăng nhập khi có mạng → app tự tải ngầm mọi bài của khối về máy →
// mất mạng: mở lại app (khung từ cache), vẫn đăng nhập, mở được bài CHƯA TỪNG MỞ, đọc được nội dung.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))}).listen(8177);
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v);
const mk=(id,title,text)=>{const L={schema_version:1,course_id:'tin-hoc-9',lesson_id:id,title,content_markdown:'# '+title+'\n\n'+text,questions:[{id:'q1',prompt:'Câu hỏi '+id+'?',kind:'choice',options:{A:'Một',B:'Hai'}}]};L.version=crypto.createHash('sha256').update(JSON.stringify(sortKeys(L))).digest('hex');return L;};
const L1=mk('b1','Thế giới kĩ thuật số','Dữ liệu là các giá trị máy tính lưu trữ.'),L2=mk('b2','Mã nhị phân','Bit là đơn vị nhỏ nhất của thông tin số.');
const CAT={schema_version:1,revision:'r1',courses:[{id:'tin-hoc-9',subject_id:'tin-hoc',subject_name:'Tin học',title:'Tin học 9',grade:9,lessons:[{id:'b1',title:L1.title,version:L1.version,question_count:1},{id:'b2',title:L2.title,version:L2.version,question_count:1}]}]};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const lessonCalls=[];
 await ctx.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={attempts:[],results:[],items:[]};
  if(u.endsWith('/pwa/catalog'))body=CAT;if(u.endsWith('login'))body={token:'t',must_change_pin:false};if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nguyễn Văn Nam',class_code:'9A',grade:9};
  if(u.includes('/pwa/lessons/')){lessonCalls.push(u);body=u.includes('/b2/')?L2:L1;}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.goto('http://localhost:8177/');await pg.waitForTimeout(500);
 await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');
 const keys=()=>pg.evaluate(()=>new Promise(res=>{const q=indexedDB.open('aisgk-student-pwa');q.onsuccess=()=>{try{const t=q.result.transaction('packages').objectStore('packages').getAllKeys();t.onsuccess=()=>res(t.result);t.onerror=()=>res([])}catch{res([])}};q.onerror=()=>res([])}));
 for(let i=0;i<60&&(await keys()).length<2;i++)await pg.waitForTimeout(250);
 ok(lessonCalls.some(u=>u.includes('/b2/')),'có mạng: tự tải ngầm mọi bài của khối về máy (kể cả bài chưa mở)');
 await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.reload();await pg.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000});ok(true,'service worker đã điều khiển trang (khung app lưu trên máy)');
 await ctx.setOffline(true);lessonCalls.length=0;
 await pg.reload();await pg.waitForSelector('#main:not([hidden])',{timeout:10000});ok((await pg.textContent('body')).includes('Nguyễn Văn Nam'),'mất mạng: mở lại app vẫn chạy, vẫn đăng nhập');
 await pg.click('[data-tab=catalog]');await pg.waitForTimeout(300);
 const rows=await pg.locator('.lesson-card').count();ok(rows===2,'mất mạng: vẫn thấy danh sách bài');
 await pg.locator('.lesson-card:has-text("Mã nhị phân") .lesson-open').click();await pg.waitForFunction(()=>document.getElementById('lesson-content')?.textContent.includes('Bit là đơn vị nhỏ nhất'),null,{timeout:8000});
 ok(lessonCalls.length===0,'mất mạng: mở bài chưa từng mở, đọc được nội dung (lấy từ máy)');
 ok(await pg.isDisabled('#ask-tutor'),'mất mạng: Gia sư AI tạm tắt (cần mạng)');
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close();
 console.log('OFFLINE LEARNING OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
