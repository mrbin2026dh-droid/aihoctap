// Trang giáo viên trên điện thoại: thanh dưới gọn 5 mục, mục cùng tính năng gộp thành thanh con, Tài khoản lên biểu tượng cạnh bánh răng.
// Mỗi lối vào mới phải NẠP DỮ LIỆU như nút gốc (kiểm bằng yêu cầu mạng), máy tính giữ nguyên menu đủ 8 mục.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(body)}).listen(8215);
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
 try{
  for(const [name,w,h] of [['điện thoại',390,800],['máy tính',1280,800]]){
   const c=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
   const hits=[];
   await c.route(API+'**',r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}')}catch{q={action:String(r.request().postData()||'').slice(0,40)}};hits.push('sheet:'+q.action);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(String(q.action||'').startsWith('gv_teacher')?{ok:true,teachers:[]}:String(q.action||'').startsWith('gv_doc')?{ok:true,khoi:null,docs:[]}:String(q.action||'').startsWith('gv_student')?{ok:true,admin:true,students:[],classes:{'9A':9}}:{ok:true,exams:[],bank:{},classes:{'9A':9}})})});
   await c.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname,m=r.request().method();hits.push(u);let body={};
    if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};
    else if(u.endsWith('/pwa/catalog'))body={courses:[{id:'tin-hoc-9',title:'Tin học 9',grade:9,lessons:[{id:'bai-1',title:'Thông tin và dữ liệu',version:'abcdef123',question_count:4}]}]};
    else if(u.includes('/pwa/teacher/results'))body=[];
    else if(u.endsWith('/teacher/students')&&m==='GET')body=[];
    else if(u.endsWith('/ai-settings'))body={settings:{default_limit:10,exam_mode:false}};
    else if(u.endsWith('/ai-stats'))body={stats:[]};
    else if(u.endsWith('/gemini-keys'))body={keys:[]};
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
   await p.goto('http://localhost:8215/teacher.html');await p.waitForTimeout(400);
   ok(await p.locator('#hdr-accounts').isHidden(),`${name}: chưa đăng nhập → chưa có biểu tượng Tài khoản`);
   await p.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await p.click('#teacher-login button[type=submit]');await p.waitForSelector('#workspace:not([hidden])');await p.waitForTimeout(300);
   const vis=await p.$$eval('.t-nav-item',els=>els.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.querySelector(getComputedStyle(e.querySelector('.t-nav-mobile')).display!=='none'?'.t-nav-mobile':'.t-nav-desktop').textContent.trim()));
   if(w<761){
    ok(JSON.stringify(vis)===JSON.stringify(['Tổng quan','Bài học','Thi','Hiệu quả','Tiện ích']),`${name}: thanh dưới còn 5 mục: ${vis.join(' · ')}`);
    ok(await p.isVisible('#hdr-accounts'),`${name}: có biểu tượng Tài khoản cạnh bánh răng`);
    const ord=await p.evaluate(()=>{const a=document.getElementById('hdr-accounts').getBoundingClientRect(),g=document.getElementById('open-settings').getBoundingClientRect(),t=document.querySelector('.t-topbar').getBoundingClientRect();return{near:g.left-a.right>=0&&g.left-a.right<=16,top:Math.abs(a.top-g.top)<2,inbar:a.bottom<=t.bottom}});
    ok(ord.near&&ord.top&&ord.inbar,`${name}: biểu tượng Tài khoản nằm ngay bên trái bánh răng, cùng hàng`);
    // Bài học → thanh con Soạn bài | Tài liệu
    await p.click('#nav-lessons');await p.waitForSelector('#t-subtabs:not([hidden])');
    const tabs1=await p.evaluate(()=>[...document.querySelectorAll('.t-subtab')].map(x=>x.textContent+(x.getAttribute('aria-current')?'*':'')).join('|'));
    ok(tabs1==='Soạn bài*|Tài liệu',`${name}: Bài học có thanh con "Soạn bài | Tài liệu", đang ở Soạn bài (${tabs1})`);
    let before=hits.length;await p.click('.t-subtab >> text=Tài liệu');await p.waitForSelector('#view-materials:not([hidden])');await p.waitForTimeout(300);
    ok(hits.slice(before).length>0,`${name}: bấm "Tài liệu" ở thanh con → nạp dữ liệu Tài liệu như nút gốc (${hits.slice(before).join(',')})`);
    ok(await p.evaluate(()=>document.getElementById('nav-lessons').classList.contains('is-group-current')&&!document.getElementById('nav-lessons').hasAttribute('aria-current')),`${name}: đang ở Tài liệu → mục "Bài học" ở thanh dưới vẫn sáng`);
    ok((await p.textContent('#workspace-title')).trim()==='Tài liệu'&&(await p.getAttribute('.t-subtab >> text=Tài liệu','aria-current'))==='page',`${name}: tiêu đề và thanh con đúng mục Tài liệu`);
    // Thi → thanh con Thi | Về nhà
    await p.click('#nav-sheetexam');await p.waitForTimeout(300);
    const tabs2=await p.evaluate(()=>[...document.querySelectorAll('.t-subtab')].map(x=>x.textContent+(x.getAttribute('aria-current')?'*':'')).join('|'));
    ok(tabs2==='Thi*|Về nhà',`${name}: Thi có thanh con "Thi | Về nhà" (${tabs2})`);
    await p.click('.t-subtab >> text=Về nhà');await p.waitForSelector('#view-exams:not([hidden])');
    ok(await p.evaluate(()=>document.getElementById('nav-sheetexam').classList.contains('is-group-current')),`${name}: đang ở Về nhà → mục "Thi" vẫn sáng`);
    // Tài khoản qua biểu tượng
    before=hits.length;await p.click('#hdr-accounts');await p.waitForSelector('#view-accounts:not([hidden])');await p.waitForTimeout(300);
    ok(hits.slice(before).length>0&&(await p.getAttribute('#hdr-accounts','aria-current'))==='page',`${name}: biểu tượng Tài khoản mở đúng mục và nạp danh sách học sinh`);
    ok(await p.locator('#t-subtabs').isHidden()&&await p.evaluate(()=>![...document.querySelectorAll('.t-nav-item')].some(x=>x.classList.contains('is-group-current'))),`${name}: mục không gộp → không có thanh con, không sáng nhầm`);
    await p.click('#nav-overview');ok(await p.getAttribute('#hdr-accounts','aria-current')===null,`${name}: rời Tài khoản → biểu tượng hết sáng`);
    const ov=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);ok(ov,`${name}: không tràn ngang`);
    // Giáo viên lớp: không có Soạn bài/Về nhà → Tài liệu hiện ở thanh dưới, không gộp
    await p.evaluate(()=>document.body.classList.add('is-class-teacher'));await p.click('#nav-sheetexam');await p.waitForTimeout(200);
    const vis2=await p.$$eval('.t-nav-item',els=>els.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.querySelector('.t-nav-mobile').textContent.trim()));
    ok(JSON.stringify(vis2)===JSON.stringify(['Thi','Tài liệu','Hiệu quả','Tiện ích'])&&await p.locator('#t-subtabs').isHidden(),`${name}: giáo viên lớp: ${vis2.join(' · ')}, không có thanh con`);
   } else {
    ok(vis.length===8,`${name}: menu bên trái giữ đủ 8 mục`);
    ok(await p.locator('#hdr-accounts').isHidden(),`${name}: không có biểu tượng Tài khoản ở thanh trên (đã có trong menu)`);
    await p.click('#nav-materials');await p.waitForTimeout(200);
    ok(await p.locator('#t-subtabs').isHidden()&&(await p.getAttribute('#nav-materials','aria-current'))==='page',`${name}: không có thanh con, mục Tài liệu sáng như cũ`);
   }
   ok(errs.length===0,`${name}: không lỗi script ${errs.join('|')}`);await c.close();}
  console.log('TEACHER MOBILE NAV OK',n);
 }finally{await b.close();srv.close();}})().catch(e=>{console.error(e);process.exit(1)});
