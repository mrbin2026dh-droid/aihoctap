// Menu "Thi" giáo viên (Google Sheet giả, đăng nhập giáo viên thật qua giao diện): 2 tab (Danh sách bài thi / Tạo đề thi), nhiều bài cùng lúc,
// nút biểu tượng thống kê/chỉnh sửa/khóa-mở/xóa (có hộp thoại xác nhận), trang thống kê từng bài, cho thi lại.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/presence-config.js')body=Buffer.from("export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'https://test-gv-default-rtdb.asia-southeast1.firebasedatabase.app'};");if(p==='/sheet-config.js')body=Buffer.from(body.toString().replace(/export const SHEET_API = '[^']*';/,`export const SHEET_API = '${API}';`));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8196);
let st;const reset=()=>{st={exams:[],calls:[],seq:0,state:{},students:[{name:'Nguyễn Văn An',lop:'9A',ma:'HS01'},{name:'Trần Thị Bình',lop:'9A',ma:'hs9a02'},{name:'Lê Chi',lop:'9B',ma:'hs9b01'},{name:'Phạm Dũng',lop:'8A',ma:'hs8a01'}]}};
const scope=(e,s)=>e.lop?s.lop===e.lop:Number(s.lop[0])===e.khoi;
const stOf=(e,s)=>st.state[e.ma_de+s.ma]||'chua';
const info=()=>({ok:true,bank:{6:0,7:0,8:1,9:3},classes:{'9A':9,'9B':9,'8A':8},exams:st.exams.map(e=>{const ss=st.students.filter(s=>scope(e,s));return {...e,total:ss.length,vao:ss.filter(s=>stOf(e,s)==='vao').length,nop:ss.filter(s=>stOf(e,s)==='nop').length}})});
const stats=e=>({ok:true,exam:e,students:st.students.filter(s=>scope(e,s)).map(s=>({...s,state:stOf(e,s),score:stOf(e,s)==='nop'?7:null,total:stOf(e,s)==='nop'?10:null}))});
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:1280,height:800},{width:390,height:800}]){reset();const desktop=vp.width>1000;
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route(API,r=>{const p=JSON.parse(r.request().postData());st.calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(p.gv!==PIN)return j({ok:false,error:'PIN giáo viên chưa khớp với Google Sheet.'});
  const ex=()=>st.exams.find(e=>e.ma_de===p.ma_de);
  if(p.action==='gv_create'){if(p.che_do==='that'&&p.khoi===7)return j({ok:false,error:'Trang DeThi trong Google Sheet chưa có câu cho khối 7.'});st.exams.unshift({ma_de:String(++st.seq),tieu_de:p.tieu_de,che_do:p.che_do,khoi:p.khoi,lop:p.lop,trang_thai:'khoa',questions:p.che_do==='thu'?p.questions.length:3,tao_luc:'x'})}
  if(p.action==='gv_update'){Object.assign(ex(),{tieu_de:p.tieu_de,khoi:p.khoi,lop:p.lop})}
  if(p.action==='gv_set')ex().trang_thai=p.trang_thai;
  if(p.action==='gv_delete')st.exams=st.exams.filter(e=>e.ma_de!==p.ma_de);
  if(p.action==='gv_reset'){st.state[p.ma_de+p.ma]='vao';return j(stats(ex()))}
  if(p.action==='gv_stats')return j(stats(ex()));
  return j(info())});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
 await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);
 await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
 const navs=await pg.$$eval('.t-nav-item',a=>a.map(x=>x.id));
 ok(navs.join()==='nav-overview,nav-lessons,nav-exams,nav-sheetexam,nav-materials,nav-accounts','menu: ... Về nhà, Thi, ...');
 ok((await pg.textContent('#nav-exams')).includes('Về nhà'),'menu "Về nhà"');
 await pg.click('#nav-sheetexam');await pg.waitForSelector('#thi-list');await pg.waitForTimeout(400);
 ok(await pg.textContent('#workspace-title')==='Thi','mở menu Thi');
 ok((await pg.locator('#view-sheetexam input[type=password]').count())===0,'không còn ô mật khẩu');
 ok(st.calls[0]&&st.calls[0].action==='gv_list'&&st.calls[0].gv===PIN,'app tự gửi PIN giáo viên vừa đăng nhập');
 ok((await pg.$$eval('#view-sheetexam [role=tab]',a=>a.map(x=>x.textContent))).join('|')==='Danh sách bài thi|Tạo đề thi','hai tab: Danh sách bài thi | Tạo đề thi');
 ok(await pg.isVisible('#tabpanel-thi-list')&&await pg.isHidden('#tabpanel-thi-new')&&(await pg.textContent('#thi-list')).includes('Chưa có bài thi'),'mở vào tab Danh sách: chưa có bài → hướng dẫn');
 // ----- Tab 2: tạo đề thi
 await pg.click('#tab-thi-new');ok(await pg.isVisible('#thi-new-form')&&await pg.isHidden('#tabpanel-thi-list'),'tab Tạo đề thi hiện form');
 ok((await pg.$$eval('#thi-new-khoi option',o=>o.map(x=>x.value))).join()==='9,8,7,6','khối 9, 8, 7, 6');
 ok((await pg.$$eval('#thi-new-lop option',o=>o.map(x=>x.textContent))).join('|')==='Cả khối 9|Chỉ lớp 9A|Chỉ lớp 9B','lớp lấy từ Sheet theo khối');
 ok((await pg.textContent('#thi-new-bank')).includes('3 câu cho khối 9'),'thi thật: báo số câu trong Sheet');
 await pg.click('#thi-new-create');ok((await pg.textContent('#thi-gv-status')).includes('tiêu đề'),'thiếu tiêu đề → báo');
 await pg.fill('#thi-new-title','Giữa kỳ');await pg.selectOption('#thi-new-khoi','7');await pg.click('#thi-new-create');await pg.waitForTimeout(400);
 ok((await pg.textContent('#thi-gv-status')).includes('khối 7'),'khối chưa có đề → báo lỗi từ Sheet');
 await pg.selectOption('#thi-new-khoi','9');await pg.selectOption('#thi-new-lop','9A');await pg.click('#thi-new-create');await pg.waitForSelector('#thi-list article');
 const cr=st.calls.find(c=>c.action==='gv_create'&&c.khoi===9);ok(cr.che_do==='that'&&cr.lop==='9A'&&cr.tieu_de==='Giữa kỳ','tạo thi thật lớp 9A gửi đúng');
 ok(await pg.isVisible('#tabpanel-thi-list')&&await pg.isHidden('#tabpanel-thi-new'),'tạo xong → tự về tab Danh sách');
 // hai bài cho hai lớp cùng lúc
 await pg.click('#tab-thi-new');await pg.fill('#thi-new-title','Kiểm tra 8');await pg.selectOption('#thi-new-khoi','8');await pg.click('#thi-new-create');await pg.waitForFunction(()=>document.querySelectorAll('#thi-list article').length===2);
 const cards=await pg.$$eval('#thi-list article',a=>a.map(x=>x.textContent));
 ok(cards.length===2&&cards[0].includes('Kiểm tra 8')&&cards[0].includes('khối 8')&&cards[1].includes('Giữa kỳ')&&cards[1].includes('lớp 9A')&&cards[1].includes('Đang KHÓA')&&cards[1].includes('Thi thật'),'danh sách: 2 bài cho 2 lớp, có loại, đối tượng, trạng thái');
 ok(cards[1].includes('2 học sinh'),'thẻ bài: số học sinh thuộc bài');
 const labels=await pg.$$eval('#thi-list article:nth-child(2) .t-icon-btn',a=>a.map(x=>x.getAttribute('aria-label')));
 ok(labels.length===4&&labels[0].startsWith('Thống kê')&&labels[1].startsWith('Chỉnh sửa')&&labels[2].startsWith('Mở thi')&&labels[3].startsWith('Xóa'),'4 nút biểu tượng có tên: thống kê, chỉnh sửa, mở thi, xóa');
 ok((await pg.$$eval('#thi-list .t-icon-btn',a=>a.every(x=>x.getBoundingClientRect().height>=48&&x.getBoundingClientRect().width>=48))),'nút biểu tượng ≥ 48px');
 // ----- khóa / mở
 await pg.click('#thi-list article:nth-child(2) .t-icon-btn[aria-label^="Mở thi"]');await pg.waitForFunction(()=>document.querySelector('#thi-list article:nth-child(2)').textContent.includes('Đang MỞ'));
 ok(st.exams.find(e=>e.tieu_de==='Giữa kỳ').trang_thai==='mo'&&st.calls.filter(c=>c.action==='gv_set').at(-1).ma_de==='1','mở thi đúng bài (theo mã bài)');
 ok(!st.exams.find(e=>e.tieu_de==='Kiểm tra 8').trang_thai.includes('mo'),'bài kia vẫn khóa');
 // ----- thống kê
 await pg.click('#thi-list article:nth-child(2) .t-icon-btn[aria-label^="Thống kê"]');await pg.waitForSelector('#detail-sheetexam:not([hidden])');await pg.waitForTimeout(300);
 ok(await pg.isHidden('#list-sheetexam')&&(await pg.textContent('#thi-gv-title'))==='Giữa kỳ'&&(await pg.textContent('#thi-gv-sub')).includes('lớp 9A'),'trang thống kê của bài Giữa kỳ');
 ok((await pg.$$('#thi-gv-body tr')).length===2&&!(await pg.textContent('#thi-gv-body')).includes('Lê Chi'),'chỉ liệt kê học sinh 9A');
 st.state['1HS01']='vao';await pg.click('#thi-gv-refresh');await pg.waitForTimeout(400);
 ok((await pg.textContent('#thi-gv-metrics')).includes('Đã vào phòng thi1'),'điểm danh: 1 em đã vào');
 await pg.check('#thi-gv-only');ok((await pg.$$('#thi-gv-body tr')).length===1&&(await pg.textContent('#thi-gv-body')).includes('Trần Thị Bình'),'lọc em chưa vào');await pg.uncheck('#thi-gv-only');
 ok((await pg.textContent('#thi-gv-toggle'))==='Khóa thi','đang mở: nút đổi thành Khóa thi');
 await pg.click('#thi-gv-toggle');await pg.waitForFunction(()=>document.getElementById('thi-gv-toggle').textContent==='Mở thi');ok(st.exams.find(e=>e.tieu_de==='Giữa kỳ').trang_thai==='khoa','khóa thi ngay trong trang thống kê');
 if(desktop){st.state['1HS01']='nop';await pg.waitForTimeout(20600);
 ok((await pg.textContent('#thi-gv-body')).includes('Đã nộp')&&(await pg.textContent('#thi-gv-body')).includes('7/10'),'tự cập nhật 20 giây từ Sheet: thấy em đã nộp + điểm');
 await pg.click('#thi-gv-body tr:first-child button');await pg.waitForTimeout(400);ok(st.calls.some(c=>c.action==='gv_reset'&&c.ma==='HS01'&&c.ma_de==='1'),'cho thi lại đúng bài, đúng em');}
 await pg.click('#act-sheetexam-back');await pg.waitForSelector('#list-sheetexam:not([hidden])');await pg.waitForTimeout(300);ok(await pg.isHidden('#detail-sheetexam')&&(await pg.$$('#thi-list article')).length===2,'quay lại danh sách');
 // ----- chỉnh sửa
 await pg.click('#thi-list article:nth-child(1) .t-icon-btn[aria-label^="Chỉnh sửa"]');await pg.waitForSelector('#tabpanel-thi-new:not([hidden])');
 ok((await pg.inputValue('#thi-new-title'))==='Kiểm tra 8'&&(await pg.inputValue('#thi-new-khoi'))==='8'&&await pg.isDisabled('#thi-new-mode')&&(await pg.textContent('#thi-new-create'))==='Lưu thay đổi'&&await pg.isVisible('#thi-new-cancel'),'chỉnh sửa: form điền sẵn, không đổi được loại thi, nút Lưu thay đổi');
 await pg.fill('#thi-new-title','Kiểm tra 8 (sửa)');await pg.selectOption('#thi-new-lop','8A');await pg.click('#thi-new-create');await pg.waitForSelector('#tabpanel-thi-list:not([hidden])');await pg.waitForTimeout(300);
 const up=st.calls.find(c=>c.action==='gv_update');ok(up.ma_de==='2'&&up.tieu_de==='Kiểm tra 8 (sửa)'&&up.lop==='8A','lưu chỉnh sửa gửi đúng bài');
 ok((await pg.textContent('#thi-list')).includes('Kiểm tra 8 (sửa)')&&(await pg.textContent('#thi-list')).includes('lớp 8A'),'danh sách cập nhật tên và lớp mới');
 await pg.click('#thi-list article:nth-child(1) .t-icon-btn[aria-label^="Chỉnh sửa"]');await pg.click('#thi-new-cancel');await pg.waitForSelector('#tabpanel-thi-list:not([hidden])');ok((await pg.textContent('#thi-new-create'))==='Tạo bài thi'&&(await pg.inputValue('#thi-new-title'))==='','Hủy sửa → về danh sách, form trở lại chế độ tạo');
 // ----- xóa có xác nhận
 await pg.click('#thi-list article:nth-child(1) .t-icon-btn[aria-label^="Xóa"]');await pg.waitForSelector('#msg-dialog[open]');
 ok((await pg.textContent('#msg-dialog')).includes('Xóa bài thi?')&&(await pg.textContent('#msg-dialog')).includes('KetQua'),'xóa → hộp thoại xác nhận, nói rõ điểm vẫn giữ');
 await pg.click('#msg-dialog button:has-text("Hủy")');await pg.waitForTimeout(200);ok(!st.calls.some(c=>c.action==='gv_delete')&&(await pg.$$('#thi-list article')).length===2,'Hủy → chưa xóa');
 await pg.click('#thi-list article:nth-child(1) .t-icon-btn[aria-label^="Xóa"]');await pg.waitForSelector('#msg-dialog[open]');await pg.click('#msg-dialog button:has-text("Xóa bài thi")');await pg.waitForFunction(()=>document.querySelectorAll('#thi-list article').length===1);
 ok(st.calls.find(c=>c.action==='gv_delete').ma_de==='2','xác nhận → xóa đúng bài');
 // ----- thi thử cần file Excel
 await pg.click('#tab-thi-new');await pg.selectOption('#thi-new-mode','thu');ok(await pg.isVisible('#thi-new-file-row'),'thi thử: hiện nút tải Excel');
 await pg.fill('#thi-new-title','Ôn tập');await pg.click('#thi-new-create');ok((await pg.textContent('#thi-gv-status')).includes('Excel'),'thi thử chưa có file → báo');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- Đã nối Firebase: thống kê tức thì (không gọi Google Sheet), nút Cập nhật lên Firebase ----------
 {const FDB='https://test-gv-default-rtdb.asia-southeast1.firebasedatabase.app';const fdb={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9},hs02:{ma:'hs02',ten:'Trần Bình',lop:'9A',khoi:9},hs03:{ma:'hs03',ten:'Lê Chi',lop:'9B',khoi:9}},thi_vao:{e1:{hs02:1761550000000}},thi_nop:{e1:{hs01:{ma:'HS01',diem:8,tong:10,at:1761550000000}}}};
  const calls=[];const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const EX={ma_de:'e1',tieu_de:'Giữa kỳ',che_do:'that',khoi:9,lop:'9A',trang_thai:'mo',questions:2,total:0,vao:0,nop:0,tao_luc:'x'};
  await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p.action);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,fb:true,exams:[EX],bank:{9:2},classes:{'9A':9,'9B':9},published:1})})});
  await pg.route(FDB+'/**',r=>{const parts=new URL(r.request().url()).pathname.replace(/\.json$/,'').split('/').filter(Boolean);const v=parts.reduce((o,k)=>o==null?undefined:o[k],fdb)??null;
   if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v})}\n\n`});r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
  await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.waitForFunction(()=>(document.querySelector('#thi-list article')?.textContent||'').includes('2 học sinh'),null,{timeout:8000});
  ok((await pg.textContent('#thi-list article')).includes('đã vào 2')&&(await pg.textContent('#thi-list article')).includes('đã nộp 1'),'Firebase: thẻ bài đếm học sinh/đã vào/đã nộp tức thì');
  await pg.click('#thi-list .t-icon-btn[aria-label^="Thống kê"]');await pg.waitForFunction(()=>document.querySelectorAll('#thi-gv-body tr').length===2);
  const body=await pg.textContent('#thi-gv-body');ok(body.includes('8/10')&&body.includes('Đã nộp')&&body.includes('Đã vào')&&!body.includes('Lê Chi')&&!calls.includes('gv_stats'),'Firebase: thống kê hiện ngay (điểm, đã vào), không chờ Google Sheet');
  await pg.click('#act-sheetexam-back');await pg.click('#thi-publish');await pg.waitForFunction(()=>document.getElementById('thi-gv-status').textContent.includes('Đã cập nhật lên Firebase'));ok(calls.includes('gv_publish'),'nút Cập nhật lên Firebase');
  ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
console.log('TEACHER THI UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
