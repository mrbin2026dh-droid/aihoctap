// Tài khoản → Học sinh (29/10 tối: thêm lưu danh sách trên máy, báo học sinh chưa lên Firebase, lớp nhóm theo khối, không gạch chân): cột Trực tuyến (Firebase presence), phút học hôm nay / 7 ngày (thoi_gian), thẻ thống kê bấm để lọc, bộ lọc, chuyên cần.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_accounts_live.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const {goNav}=require('./helpers/teacher-nav.cjs');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8147);
const B='http://localhost:8147';let n=0;const ok=(c,m)=>{assert(c,m);n++};
const dayVN=t=>new Date(t+7*3600e3).toISOString().slice(0,10);
(async()=>{const b=await chromium.launch();try{
for(const vp of [{width:1280,height:900,n:'d'},{width:390,height:844,n:'m'}]){
const T=vp.n+' ';
const ctx=await b.newContext({viewport:{width:vp.width,height:vp.height},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
const STU=[{ma:'HS01',ten:'An',lop:'9A',trang_thai:'Hoạt động'},{ma:'hs02',ten:'Bình',lop:'9A',trang_thai:'Hoạt động'},{ma:'hs03',ten:'Chi',lop:'9B',trang_thai:'Hoạt động'},{ma:'hs04',ten:'Dũng',lop:'9B',trang_thai:'Khóa'}];
await pg.route('https://script.google.com/**',async r=>{const p=JSON.parse(r.request().postData());if(p.action==='gv_publish'){published++;FBK={hs01:true,hs02:true,hs03:true};}if(sheetDelay&&p.action==='gv_students')await new Promise(x=>setTimeout(x,sheetDelay));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p.action.startsWith('gv_teacher')?{ok:true,teachers:[]}:p.action.startsWith('gv_student')?{ok:true,admin:true,students:STU,classes:{'9A':2,'9B':2}}:{ok:true,exams:[],bank:{},classes:{}})})});
await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/catalog'))body={courses:[]};else if(u.endsWith('/ai-settings'))body={settings:{default_limit:10}};else if(u.endsWith('/ai-stats'))body={stats:[]};else if(u.endsWith('/gemini-keys'))body={keys:[]};else if(u.includes('results')||u.endsWith('/teacher/students'))body=[];r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
const now=Date.now(),today=dayVN(now),d2=dayVN(now-2*864e5),d3=dayVN(now-3*864e5),d9=dayVN(now-9*864e5);
const MIN={[today]:{hs01:40,HS02:3},[d2]:{hs01:30},[d3]:{hs01:25,hs03:10},[d9]:{hs04:500}};
const thoiReqs=[];
await pg.route(/firebasedatabase\.app\/thoi_gian\//,r=>{const d=decodeURIComponent(new URL(r.request().url()).pathname.split('/')[2]).replace('.json','');thoiReqs.push(d);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(MIN[d]||null)})});
let PRES={HS01:{name:'An',lop:'9A',state:'hoc',at:now},hs02:{name:'Bình',lop:'9A',state:'dang_thi',at:now},hs03:{name:'Chi',lop:'9B',state:'hoc',at:now-10*60e3},hs04:{name:'Dũng',lop:'9B',state:'offline',at:now-60e3}};
await pg.route(/firebasedatabase\.app\/presence\.json/,r=>r.fulfill({status:200,headers:{'content-type':'text/event-stream','cache-control':'no-cache'},body:'event: put\ndata: '+JSON.stringify({path:'/',data:PRES})+'\n\n'}));
await pg.route(/identitytoolkit|securetoken/,r=>r.fulfill({status:403,body:'{}'}));
let FBK={hs01:true,hs02:true},published=0,sheetDelay=0;
await pg.route(/firebasedatabase\.app\/thi_hs\.json/,r=>{const u=new URL(r.request().url());r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.searchParams.get('shallow')==='true'?FBK:null)})});
await pg.goto(B+'/teacher.html');await pg.waitForTimeout(400);
await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
await goNav(pg,'#nav-accounts');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===4);
await pg.waitForFunction(()=>document.querySelectorAll('.acc-live.is-on').length===2,null,{timeout:8000});
await pg.waitForFunction(()=>document.querySelector('#acc-hs-body tr[data-ma="HS01"] td[data-label="7 ngày"]')?.textContent!=='0 phút',null,{timeout:8000});
ok(new Set(thoiReqs).size===7&&thoiReqs.includes(today),T+'đọc đúng 7 ngày thoi_gian (giờ VN)');
const heads=await pg['$$eval']('#acc-hs-table thead th',a=>a.map(x=>x.textContent.trim()));
ok(JSON.stringify(heads)===JSON.stringify(['Mã học sinh','Họ và tên','Lớp','Trực tuyến','Hôm nay','7 ngày','Chuyên cần','Thao tác']),T+'8 cột có Trực tuyến, Hôm nay, 7 ngày, Chuyên cần: '+heads);
const row=async ma=>pg['$eval'](`#acc-hs-body tr[data-ma="${ma}"]`,tr=>Object.fromEntries([...tr.cells].map(c=>[c.dataset.label,c.textContent.trim()])));
let r1=await row('HS01');ok(r1['Trực tuyến']==='Đang học'&&r1['Hôm nay']==='40 phút'&&r1['7 ngày']==='1 giờ 35 phút'&&r1['Chuyên cần']==='Chăm',T+'An: mã HOA khớp khóa thường, 95 phút / 3 ngày = Chăm '+JSON.stringify(r1));
let r2=await row('hs02');ok(r2['Trực tuyến']==='Đang thi'&&r2['Hôm nay']==='3 phút'&&r2['Chuyên cần']==='Học ít',T+'Bình: đang thi, 3 phút = Học ít '+JSON.stringify(r2));
let r3=await row('hs03');ok(r3['Trực tuyến'].startsWith('Ngoại tuyến')&&r3['Trực tuyến'].includes('10 phút trước')&&r3['Hôm nay']==='0 phút'&&r3['7 ngày']==='10 phút',T+'Chi: quá 150 giây → Ngoại tuyến, kèm "10 phút trước" '+JSON.stringify(r3));
let r4=await row('hs04');ok(r4['Trực tuyến'].startsWith('Ngoại tuyến')&&r4['7 ngày']==='0 phút'&&r4['Chuyên cần']==='Chưa học'&&r4['Họ và tên'].includes('Khóa'),T+'Dũng: đã thoát; ngày thứ 9 không tính; tài khoản khóa hiện nhãn '+JSON.stringify(r4));
const stats=await pg['$$eval']('#acc-hs-stats .acc-stat',a=>a.map(x=>[x.dataset.stat,x.querySelector('strong').textContent]));
ok(JSON.stringify(stats)===JSON.stringify([['total','4'],['on','2'],['off','2'],['today','2'],['none7','1']]),T+'thẻ thống kê '+JSON.stringify(stats));
ok((await pg.textContent('#acc-hs-stats [data-stat=total] small')).includes('11 phút'),T+'TB hôm nay 43/4 ≈ 11 phút');
// Bấm thẻ = lọc; bấm lại = bỏ lọc
await pg.click('#acc-hs-stats [data-stat=on]');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===2);
ok(await pg.inputValue('#acc-hs-online')==='on'&&await pg.getAttribute('#acc-hs-stats [data-stat=on]','aria-pressed')==='true',T+'bấm "Đang trực tuyến" → lọc + nút ở trạng thái nhấn');
ok((await pg.textContent('#acc-hs-count')).startsWith('Đang lọc: 2 / 4'),T+'dòng đếm báo đang lọc');
await pg.click('#acc-hs-stats [data-stat=on]');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===4);ok(true,T+'bấm lại → bỏ lọc');
await pg.click('#acc-hs-stats [data-stat=none7]');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===1);
ok(await pg['$eval']('#acc-hs-body tr[data-ma]',t=>t.dataset.ma)==='hs04',T+'Chưa học 7 ngày → chỉ Dũng');
await pg.selectOption('#acc-hs-act','low7');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===3);ok(true,T+'Dưới 30 phút / 7 ngày → 3 em');
await pg.selectOption('#acc-hs-act','not_today');await pg.selectOption('#acc-hs-lop','9B');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===2);ok(true,T+'kết hợp lọc lớp + chưa học hôm nay');
ok((await pg.textContent('#acc-hs-stats [data-stat=total] strong'))==='2',T+'thẻ thống kê theo lớp đang chọn');
await pg.selectOption('#acc-hs-act','');await pg.selectOption('#acc-hs-lop','');
await pg.selectOption('#acc-hs-sort','week');await pg.waitForTimeout(100);
ok(JSON.stringify(await pg['$$eval']('#acc-hs-body tr[data-ma]',a=>a.map(t=>t.dataset.ma)))===JSON.stringify(['HS01','hs03','hs02','hs04']),T+'sắp xếp học nhiều nhất 7 ngày');
await pg.selectOption('#acc-hs-sort','week_asc');await pg.waitForTimeout(100);
ok((await pg['$$eval']('#acc-hs-body tr[data-ma]',a=>a.map(t=>t.dataset.ma)))[0]==='hs04',T+'sắp xếp học ít nhất lên đầu');
await pg.selectOption('#acc-hs-sort','ten');
// Thời gian thực: Chi vào học → cột cập nhật tại chỗ, thẻ tăng
PRES={...PRES,hs03:{...PRES.hs03,state:'hoc',at:Date.now()}};
await pg.waitForFunction(()=>document.querySelector('#acc-hs-body tr[data-ma="hs03"] .acc-live.is-on'),null,{timeout:15000});
ok((await pg.textContent('#acc-hs-stats [data-stat=on] strong'))==='3',T+'Chi vào app → trực tuyến 3 (không cần tải lại)');
ok((await pg.textContent('#acc-hs-count')).includes('Thời gian học tính từ 29/10/2026'),T+'ghi rõ ngày bắt đầu đo');
const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(ov<=1,T+'không tràn ngang '+ov);
// Học sinh có trong Sheet nhưng chưa có trên Firebase (dán thẳng vào Sheet) → cảnh báo + nút đẩy lên
await pg.waitForSelector('#acc-sync:not([hidden])',{timeout:8000});
ok((await pg.textContent('#acc-sync-text')).startsWith('1 học sinh')&&(await pg.textContent('#acc-sync-text')).includes('lớp 9B'),T+'báo 1 học sinh lớp 9B chưa lên Firebase (bỏ qua tài khoản khóa), nói rõ hậu quả');
await pg.click('#acc-sync-btn');await pg.waitForSelector('#acc-sync[hidden]',{state:'attached',timeout:8000});
ok(published===1&&(await pg.textContent('#acc-status')).includes('Đã đẩy danh sách'),T+'bấm "Đẩy lên Firebase ngay" → gọi gv_publish, cảnh báo biến mất');
// Lớp nhóm theo khối, có sĩ số
ok(JSON.stringify(await pg.$$eval('#acc-hs-lop optgroup',a=>a.map(g=>g.label)))==='["Khối 9"]'&&(await pg.textContent('#acc-hs-lop')).includes('Lớp 9A (2 em)'),T+'ô Lớp nhóm theo khối, ghi sĩ số');
// Không còn chữ gạch chân (abbr chấm, nút tên bài) trong vùng làm việc
const under=await pg.evaluate(()=>[...document.querySelectorAll('#workspace *')].filter(e=>e.offsetParent&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&/underline/.test(getComputedStyle(e).textDecorationLine)).map(e=>e.tagName+':'+e.textContent.trim().slice(0,20)));
ok(!under.length,T+'không có chữ gạch chân: '+under.join(', '));
ok((await pg.textContent('.acc-legend')).includes('Chăm'),T+'giải thích Chuyên cần ở chú thích dưới bảng');
// Mở lại trang: danh sách lưu trên máy hiện NGAY, Google Sheet trả sau vẫn cập nhật
sheetDelay=4000;await pg.reload();await pg.waitForTimeout(400);if(await pg.locator('#teacher-login [name=pin]').isVisible()){await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');}await pg.waitForSelector('#workspace:not([hidden])');
const t0=Date.now();await goNav(pg,'#nav-accounts');await pg.waitForFunction(()=>document.querySelectorAll('#acc-hs-body tr[data-ma]').length===4,null,{timeout:2500});
ok(Date.now()-t0<2500&&(await pg.textContent('#acc-hs-count')).includes('Đang cập nhật'),T+`mở lại: hiện ngay danh sách lưu trên máy (${Date.now()-t0} ms), Sheet chậm 4 giây vẫn không phải chờ`);
await pg.waitForFunction(()=>!document.querySelector('#acc-hs-count').textContent.includes('Đang cập nhật'),null,{timeout:9000});ok(true,T+'Sheet trả về → bỏ chữ "Đang cập nhật"');sheetDelay=0;
if(process.env.SHOTS)await pg.screenshot({path:path.join(process.env.SHOTS,'acc-'+vp.n+'.png'),fullPage:true});
ok(!errs.length,T+'không lỗi JS: '+errs.join('|'));
await ctx.close();}
console.log('test_accounts_live: '+n+' ca OK');
}finally{await b.close();srv.close()}})().catch(e=>{console.error(e);process.exit(1)});
