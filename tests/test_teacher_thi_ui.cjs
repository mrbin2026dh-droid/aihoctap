// Menu "Thi" giáo viên (Google Sheet giả, đăng nhập giáo viên thật qua giao diện): 2 tab (Danh sách bài thi / Tạo đề thi), nhiều bài cùng lúc,
// nút biểu tượng thống kê/chỉnh sửa/khóa-mở/xóa (có hộp thoại xác nhận), trang thống kê từng bài, cho thi lại.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const {goNav}=require('./helpers/teacher-nav.cjs');
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
  if(p.action==='gv_create'){if(p.che_do==='that'&&p.khoi===7)return j({ok:false,error:'Trang DeThi trong Google Sheet chưa có câu cho khối 7.'});st.exams.unshift({ma_de:String(++st.seq),tieu_de:p.tieu_de,che_do:p.che_do,khoi:p.khoi,lop:p.lop,trang_thai:'khoa',questions:p.che_do==='thu'?p.questions.length:3,tao_luc:'x',nam_hoc:p.nam_hoc,hinh_thuc:p.hinh_thuc,noi_dung:p.noi_dung})}
  if(p.action==='gv_update'){Object.assign(ex(),{tieu_de:p.tieu_de,khoi:p.khoi,lop:p.lop})}
  if(p.action==='gv_set'){if(p.trang_thai)ex().trang_thai=p.trang_thai;if(p.xem_diem)ex().xem_diem=p.xem_diem==='co';}
  if(p.action==='gv_delete')st.exams=st.exams.filter(e=>e.ma_de!==p.ma_de);
  if(p.action==='gv_reset'){st.state[p.ma_de+p.ma]='vao';return j(stats(ex()))}
  if(p.action==='gv_stats')return j(stats(ex()));
  if(p.action==='gv_questions')return j({ok:true,ma_de:p.ma_de,questions:[{id:'r2',text:'CPU là gì?',options:{A:'Bộ xử lý',B:'Bộ nhớ'},answer:'A',points:5}]});
  return j(info())});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
 await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);
 await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
 const navs=await pg['$$eval']('.t-nav-item',a=>a.map(x=>x.id));
 ok(navs.join()==='nav-overview,nav-lessons,nav-exams,nav-sheetexam,nav-materials,nav-accounts,nav-effect,nav-tools','menu: ... Về nhà, Thi, ..., Hiệu quả, Tiện ích');
 ok((await pg.textContent('#nav-exams')).includes('Về nhà'),'menu "Về nhà"');
 await pg.click('#nav-sheetexam');await pg.waitForSelector('#thi-list');await pg.waitForTimeout(400);
 ok(await pg.textContent('#workspace-title')==='Thi','mở menu Thi');
 ok((await pg.locator('#view-sheetexam input[type=password]').count())===0,'không còn ô mật khẩu');
 ok(st.calls[0]&&st.calls[0].action==='gv_list'&&st.calls[0].gv===PIN,'app tự gửi PIN giáo viên vừa đăng nhập');
 ok((await pg['$$eval']('#list-sheetexam > .t-tabs [role=tab]',a=>a.map(x=>x.textContent))).join('|')==='Danh sách bài thi|Tạo đề thi','hai tab: Danh sách bài thi | Tạo đề thi');
 ok(await pg.isVisible('#tabpanel-thi-list')&&await pg.isHidden('#tabpanel-thi-new')&&(await pg.textContent('#thi-list')).includes('Chưa có bài thi'),'mở vào tab Danh sách: chưa có bài → hướng dẫn');
 // ----- Tab 2: tạo đề thi
 await pg.click('#tab-thi-new');ok(await pg.isVisible('#thi-new-form')&&await pg.isHidden('#tabpanel-thi-list'),'tab Tạo đề thi hiện form');
 ok((await pg['$$eval']('#thi-new-khoi option',o=>o.map(x=>x.value))).join()==='9,8,7,6','khối 9, 8, 7, 6');
 ok((await pg['$$eval']('#thi-new-lop option',o=>o.map(x=>x.textContent))).join('|')==='Cả khối 9|Chỉ lớp 9A|Chỉ lớp 9B','lớp lấy từ Sheet theo khối');
 ok((await pg.textContent('#thi-new-bank')).includes('3 câu cho khối 9'),'thi thật: báo số câu trong Sheet');
 await pg.click('#thi-new-create');ok((await pg.textContent('#thi-gv-status')).includes('tiêu đề'),'thiếu tiêu đề → báo');
 await pg.fill('#thi-new-title','Giữa kỳ');await pg.selectOption('#thi-new-khoi','7');await pg.click('#thi-new-create');await pg.waitForTimeout(400);
 ok((await pg.textContent('#thi-gv-status')).includes('khối 7'),'khối chưa có đề → báo lỗi từ Sheet');
 ok(await pg.isVisible('#thi-that-fields')&&(await pg['$$eval']('#thi-new-ht option',o=>o.map(x=>x.textContent))).join('|')==='15 phút|Giữa kỳ I|Cuối kỳ I|Giữa kỳ II|Cuối kỳ II|Khác','thi thật: có Năm học, Hình thức thi, Nội dung thi');
 await pg.selectOption('#thi-new-ht','Giữa kỳ I');await pg.selectOption('#thi-new-nd','tn_th');await pg.fill('#thi-th-de','Tạo bảng tính điểm');await pg.fill('#thi-th-list .th-mo','Đúng yêu cầu');
 await pg.selectOption('#thi-new-khoi','9');await pg.selectOption('#thi-new-lop','9A');await pg.click('#thi-new-create');await pg.waitForSelector('#thi-list article');
 const cr=st.calls.find(c=>c.action==='gv_create'&&c.khoi===9);ok(cr.che_do==='that'&&cr.lop==='9A'&&cr.tieu_de==='Giữa kỳ'&&cr.hinh_thuc==='Giữa kỳ I'&&cr.noi_dung==='tn_th'&&/^\d{4}-\d{4}$/.test(cr.nam_hoc),'tạo thi thật lớp 9A gửi đúng (năm học, hình thức, trắc nghiệm + thực hành)');
 ok(await pg.isVisible('#tabpanel-thi-list')&&await pg.isHidden('#tabpanel-thi-new'),'tạo xong → tự về tab Danh sách');
 // hai bài cho hai lớp cùng lúc
 await pg.click('#tab-thi-new');await pg.fill('#thi-new-title','Kiểm tra 8');await pg.selectOption('#thi-new-khoi','8');await pg.click('#thi-new-create');await pg.waitForFunction(()=>document.querySelectorAll('#thi-list article').length===2);
 const cards=await pg['$$eval']('#thi-list article',a=>a.map(x=>x.textContent));
 ok(cards.length===2&&cards[0].includes('Kiểm tra 8')&&cards[0].includes('khối 8')&&cards[1].includes('Giữa kỳ')&&cards[1].includes('lớp 9A')&&cards[1].includes('Đang KHÓA')&&cards[1].includes('Thi thật'),'danh sách: 2 bài cho 2 lớp, có loại, đối tượng, trạng thái');
 ok(cards[1].includes('2 học sinh'),'thẻ bài: số học sinh thuộc bài');
 const labels=await pg['$$eval']('#thi-list article:nth-child(2) .t-icon-btn',a=>a.map(x=>x.getAttribute('aria-label')));
 ok(labels.length===5&&labels[0].startsWith('Thống kê')&&labels[1].startsWith('Chỉnh sửa')&&labels[2].startsWith('Mở thi')&&labels[3].startsWith('Cho học sinh xem điểm')&&labels[4].startsWith('Xóa'),'5 nút biểu tượng có tên: thống kê, chỉnh sửa, mở thi, cho xem điểm, xóa');
 await pg.click('#thi-list article:nth-child(2) .t-icon-btn[aria-label^="Cho học sinh xem điểm"]');await pg.waitForFunction(()=>document.querySelector('#thi-list article:nth-child(2)').textContent.includes('Cho xem điểm'));
 ok(st.calls.filter(c=>c.action==='gv_set').at(-1).xem_diem==='co'&&await pg.getAttribute('#thi-list article:nth-child(2) .t-icon-btn[aria-label^="Ẩn điểm"]','aria-pressed')==='true','bật Cho xem điểm: gửi đúng bài, nút đổi thành Ẩn điểm');
 ok((await pg['$$eval']('#thi-list .t-icon-btn',a=>a.every(x=>x.getBoundingClientRect().height>=48&&x.getBoundingClientRect().width>=48))),'nút biểu tượng ≥ 48px');
 // ----- khóa / mở
 await pg.click('#thi-list article:nth-child(2) .t-icon-btn[aria-label^="Mở thi"]');await pg.waitForFunction(()=>document.querySelector('#thi-list article:nth-child(2)').textContent.includes('Đang MỞ'));
 ok(st.exams.find(e=>e.tieu_de==='Giữa kỳ').trang_thai==='mo'&&st.calls.filter(c=>c.action==='gv_set').at(-1).ma_de==='1','mở thi đúng bài (theo mã bài)');
 ok(!st.exams.find(e=>e.tieu_de==='Kiểm tra 8').trang_thai.includes('mo'),'bài kia vẫn khóa');
 // ----- thống kê
 await pg.click('#thi-list article:nth-child(2) .t-icon-btn[aria-label^="Thống kê"]');await pg.waitForSelector('#detail-sheetexam:not([hidden])');await pg.waitForTimeout(300);
 ok(await pg.isVisible('#tab-thi-td'),'thi thật: có tab Theo dõi nộp bài');
 ok(await pg.isHidden('#list-sheetexam')&&(await pg.textContent('#thi-gv-title'))==='Giữa kỳ'&&(await pg.textContent('#thi-gv-sub')).includes('lớp 9A'),'trang thống kê của bài Giữa kỳ');
 ok((await pg.$$('#thi-gv-body tr')).length===2&&!(await pg.textContent('#thi-gv-body')).includes('Lê Chi'),'chỉ liệt kê học sinh 9A');
 st.state['1HS01']='vao';await pg.click('#thi-gv-refresh');await pg.waitForTimeout(400);
 ok((await pg.textContent('#thi-gv-metrics')).includes('Đã vào phòng thi1'),'điểm danh: 1 em đã vào');
 await pg.check('#thi-gv-only');ok((await pg.$$('#thi-gv-body tr')).length===1&&(await pg.textContent('#thi-gv-body')).includes('Trần Thị Bình'),'lọc em chưa vào');await pg.uncheck('#thi-gv-only');
 ok((await pg.textContent('#thi-gv-toggle'))==='Khóa thi','đang mở: nút đổi thành Khóa thi');
 await pg.click('#thi-gv-toggle');await pg.waitForFunction(()=>document.getElementById('thi-gv-toggle').textContent==='Mở thi');ok(st.exams.find(e=>e.tieu_de==='Giữa kỳ').trang_thai==='khoa','khóa thi ngay trong trang thống kê');
 if(desktop){st.state['1HS01']='nop';await pg.waitForTimeout(20600);
 ok((await pg.textContent('#thi-gv-body')).includes('Đã nộp')&&(await pg.textContent('#thi-gv-body')).includes('7/10'),'tự cập nhật 20 giây từ Sheet: thấy em đã nộp + điểm');
 await pg.click('#tab-thi-td');ok((await pg.textContent('#thi-track')).includes('Đã nộp')&&(await pg.textContent('#thi-track section.is-done')).includes('Nguyễn Văn An')&&(await pg.textContent('#thi-track section.is-wait')).includes('Trần Thị Bình'),'tab Theo dõi nộp bài: chưa vào / đang làm / đã nộp');
 ok((await pg.textContent('#thi-track section.is-done')).includes('chưa nộp thực hành'),'theo dõi cả bài thực hành');await pg.click('#tab-thi-kq');
 await pg.click('#thi-gv-body tr:first-child button');await pg.waitForSelector('#msg-dialog[open]');ok((await pg.textContent('#msg-dialog')).includes('Cho thi lại?')&&!st.calls.some(c=>c.action==='gv_reset'),'cho thi lại: hỏi xác nhận trước');
 await pg.click('#msg-dialog button:has-text("Cho thi lại")');await pg.waitForTimeout(400);ok(st.calls.some(c=>c.action==='gv_reset'&&c.ma==='HS01'&&c.ma_de==='1'),'cho thi lại đúng bài, đúng em');}
 await pg.click('#act-sheetexam-back');await pg.waitForSelector('#list-sheetexam:not([hidden])');await pg.waitForTimeout(300);ok(await pg.isHidden('#detail-sheetexam')&&(await pg.$$('#thi-list article')).length===2,'quay lại danh sách');
 // ----- chỉnh sửa
 await pg.click('#thi-list article:nth-child(1) .t-icon-btn[aria-label^="Chỉnh sửa"]');await pg.waitForSelector('#tabpanel-thi-new:not([hidden])');
 ok((await pg.inputValue('#thi-new-title'))==='Kiểm tra 8'&&(await pg.inputValue('#thi-new-khoi'))==='8'&&await pg.isDisabled('#thi-new-mode')&&(await pg.textContent('#thi-new-create'))==='Lưu thay đổi'&&await pg.isVisible('#thi-new-cancel'),'chỉnh sửa: form điền sẵn, không đổi được loại thi, nút Lưu thay đổi');
 await pg.waitForSelector('#thi-qe-list .thi-qe');ok((await pg.inputValue('#thi-qe-list .qe-text'))==='CPU là gì?'&&(await pg.inputValue('#thi-qe-list .qe-ans'))==='A','chỉnh sửa: hiện câu hỏi, phương án, đáp án để sửa');
 await pg.fill('#thi-qe-list .qe-text','CPU là bộ phận nào?');await pg.selectOption('#thi-qe-list .qe-ans','C');await pg.click('#thi-new-create');await pg.waitForTimeout(200);
 ok((await pg.textContent('#thi-gv-status')).includes('đáp án đúng C chưa có nội dung')&&!st.calls.some(c=>c.action==='gv_update'),'đáp án đúng trỏ vào phương án trống → báo, chưa lưu');
 await pg.selectOption('#thi-qe-list .qe-ans','B');await pg.click('#thi-qe-add');await pg.fill('#thi-qe-list .thi-qe:nth-of-type(2) .qe-text','Câu thêm?');await pg.fill('#thi-qe-list .thi-qe:nth-of-type(2) .qe-opt[data-k=A]','x');await pg.fill('#thi-qe-list .thi-qe:nth-of-type(2) .qe-opt[data-k=B]','y');
 await pg.fill('#thi-new-title','Kiểm tra 8 (sửa)');await pg.selectOption('#thi-new-lop','8A');await pg.click('#thi-new-create');await pg.waitForSelector('#tabpanel-thi-list:not([hidden])');await pg.waitForTimeout(300);
 const up=st.calls.find(c=>c.action==='gv_update');ok(up.ma_de==='2'&&up.tieu_de==='Kiểm tra 8 (sửa)'&&up.lop==='8A','lưu chỉnh sửa gửi đúng bài');
 ok(up.questions.length===2&&up.questions[0].text==='CPU là bộ phận nào?'&&up.questions[0].answer==='B'&&up.questions[1].options.B==='y','lưu cả câu hỏi và đáp án đã sửa');
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
 {const FDB='https://test-gv-default-rtdb.asia-southeast1.firebasedatabase.app';const fdb={thi_hs:{hs01:{ma:'HS01',ten:'Nguyễn Văn An',lop:'9A',khoi:9},hs02:{ma:'hs02',ten:'Trần Bình',lop:'9A',khoi:9},hs03:{ma:'hs03',ten:'Lê Chi',lop:'9B',khoi:9}},thi_vao:{e1:{hs02:1761550000000}},thi_nop:{e1:{hs01:{ma:'HS01',diem:8,tong:10,at:1761550000000,roi_tab:2}},e2:{hs02:{ma:'hs02',diem:6,tong:10,lan:3,at:1}}}};
  const calls=[];const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const EX={ma_de:'e1',tieu_de:'Giữa kỳ',che_do:'that',khoi:9,lop:'9A',trang_thai:'mo',questions:2,total:0,vao:0,nop:0,tao_luc:'x'};const EX2={ma_de:'e2',tieu_de:'Ôn luyện',che_do:'thu',khoi:9,lop:'9A',trang_thai:'mo',questions:1,total:0,vao:0,nop:0,tao_luc:'y'};
  await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p.action);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,fb:true,exams:[EX,EX2],bank:{9:2},classes:{'9A':9,'9B':9},published:1})})});
  const fp=[];await pg.route(FDB+'/**',r=>{fp.push(new URL(r.request().url()).pathname);const parts=new URL(r.request().url()).pathname.replace(/\.json$/,'').split('/').filter(Boolean);const v=parts.reduce((o,k)=>(o === null || o === undefined)?undefined:o[k],fdb)??null;
   if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v})}\n\n`});r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
  await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.waitForFunction(()=>(document.querySelector('#thi-list article:last-child')?.textContent||'').includes('2 học sinh'),null,{timeout:8000});
  ok((await pg.textContent('#thi-list article')).includes('đã vào 2')&&(await pg.textContent('#thi-list article')).includes('đã nộp 1'),'Firebase: thẻ bài đếm học sinh/đã vào/đã nộp tức thì');
  await pg.click('#thi-list article:has-text("Giữa kỳ") .t-icon-btn[aria-label^="Thống kê"]');await pg.waitForFunction(()=>document.querySelectorAll('#thi-gv-body tr').length===2);
  const body=await pg.textContent('#thi-gv-body');ok(body.includes('8/10')&&body.includes('Đã nộp')&&body.includes('Đã vào')&&!body.includes('Lê Chi')&&!calls.includes('gv_stats'),'Firebase: thống kê hiện ngay (điểm, đã vào), không chờ Google Sheet');
  await pg.click('#tab-thi-td');ok((await pg.textContent('#thi-track')).includes('rời màn hình 2 lần'),'thi thật: theo dõi nộp bài hiện số lần rời màn hình');await pg.click('#tab-thi-kq');
  await pg.click('#act-sheetexam-back');await pg.click('#thi-list article:has-text("Ôn luyện") .t-icon-btn[aria-label^="Thống kê"]');await pg.waitForFunction(()=>document.querySelectorAll('#thi-gv-body tr').length===2);
  ok((await pg.textContent('#thi-gv-table thead')).includes('Số lần thi')&&(await pg.textContent('#thi-gv-body')).includes('3 lần')&&!(await pg.textContent('#thi-gv-body')).includes('Cho thi lại')&&await pg.isHidden('#thi-st-tabs'),'thi thử: cột Số lần thi thay cho Cho thi lại, không có tab theo dõi');
  await pg.click('#act-sheetexam-back');await pg.click('#thi-publish');await pg.waitForFunction(()=>document.getElementById('thi-gv-status').textContent.includes('Đã cập nhật lên Firebase'));ok(calls.includes('gv_publish'),'nút Cập nhật lên Firebase');
  ok(!fp.some(p=>/^\/(thi_nop|thi_vao|thi_th)\.json$/.test(p))&&fp.some(p=>p==='/thi_nop/e1.json'),'thống kê: nghe theo từng bài, không tải cả cây thi_nop (nhẹ khi 1000 học sinh)');
  ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- AI soạn đề theo ma trận: giáo viên duyệt từng câu trước khi lưu ----------
 {const calls=[];const aiCalls=[];const ctx=await b.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exams:[],bank:{9:2},classes:{'9A':9}})})});
  const cat={courses:[{id:'tin-hoc-9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số'}]},{id:'tin-hoc-8',grade:8,lessons:[{id:'b1',title:'Máy tính'}]}]};
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/pwa/catalog'))body=cat;if(u.endsWith('/teacher/students'))body=[];
   if(u.endsWith('/teacher/ai-questions')){const p=JSON.parse(r.request().postData());aiCalls.push({p,auth:r.request().headers()['authorization']});body={lesson_title:'Thế giới kĩ thuật số',remaining:39,questions:[{text:'Bit là gì?',options:{A:'Bộ nhớ',B:'Đơn vị nhỏ nhất',C:'Ổ cứng',D:'CPU'},answer:'B',points:1,level:'Biết',topic:'Mã nhị phân',explain:'Theo mục 2',ai:true},{text:'1 byte bằng?',options:{A:'4 bit',B:'8 bit',C:'16 bit',D:'2 bit'},answer:'B',points:1,level:'Hiểu',topic:'Mã nhị phân',explain:'1 byte = 8 bit',ai:true}]};}
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-sheetexam');await pg.click('#tab-thi-new');await pg.selectOption('#thi-new-mode','thu');await pg.selectOption('#thi-new-khoi','9');
  ok(await pg.isVisible('#thi-new-ai'),'tạo thi thử: có nút AI soạn đề theo ma trận');
  await pg.click('#thi-new-ai');await pg.waitForSelector('#ai-q-dialog[open]');await pg.waitForFunction(()=>document.querySelectorAll('#ai-q-lesson option').length>1);
  ok((await pg['$$eval']('#ai-q-lesson option',o=>o.map(x=>x.textContent))).join('|')==='Chọn bài học|Thế giới kĩ thuật số · Lớp 9','chọn bài học: chỉ bài của khối đang chọn');
  await pg.click('#ai-q-go');ok((await pg.textContent('#ai-q-lesson-err')).includes('Chọn bài học')&&!aiCalls.length,'chưa chọn bài → báo dưới trường, không gọi AI');
  await pg.selectOption('#ai-q-lesson','tin-hoc-9|b1');await pg.fill('#ai-q-biet','15');await pg.fill('#ai-q-hieu','10');await pg.click('#ai-q-go');
  ok((await pg.textContent('#ai-q-total')).includes('28')&&(await pg.textContent('#ai-q-matrix-err')).includes('1 đến 20')&&!aiCalls.length,'ma trận quá 20 câu → báo');
  await pg.fill('#ai-q-biet','1');await pg.fill('#ai-q-hieu','1');await pg.fill('#ai-q-vd','0');await pg.fill('#ai-q-topic','Mã nhị phân');await pg.click('#ai-q-go');await pg.waitForFunction(()=>!document.getElementById('ai-q-dialog').open);
  const ac=aiCalls[0];ok(ac.p.course_id==='tin-hoc-9'&&ac.p.counts['Biết']===1&&ac.p.counts['Hiểu']===1&&ac.p.counts['Vận dụng']===0&&ac.p.topic==='Mã nhị phân'&&ac.auth==='Bearer tt','gửi Worker: bài, ma trận Biết/Hiểu/Vận dụng, chủ đề (token quản trị)');
  ok(await pg.locator('#thi-qe-list .thi-qe.is-ai').count()===2&&(await pg.textContent('#thi-qe-list')).includes('Giải thích của AI: 1 byte = 8 bit')&&await pg.inputValue('#thi-qe-list .thi-qe >> nth=0 >> .qe-topic')==='Mã nhị phân'&&await pg.inputValue('#thi-qe-list .thi-qe >> nth=1 >> .qe-level')==='Hiểu','câu AI hiện trong trình sửa: nhãn "cần duyệt", giải thích, chủ đề, mức độ');
  await pg.fill('#thi-new-title','Thi thử AI');await pg.click('#thi-new-create');await pg.waitForTimeout(200);
  ok(!calls.some(c=>c.action==='gv_create')&&(await pg.textContent('#thi-gv-status')).includes('Đã duyệt'),'chưa duyệt câu AI → không lưu, nhắc đánh dấu Đã duyệt');
  for(const cb of await pg.locator('#thi-qe-list .qe-ok').all())await cb.check();
  ok(await pg.locator('#thi-qe-list .thi-qe.is-approved').count()===2,'đánh dấu Đã duyệt → viền xanh');
  await pg.fill('#thi-qe-list .thi-qe >> nth=0 >> .qe-text','Bit là gì? (đã sửa)');
  await pg.click('#thi-new-create');await pg.waitForTimeout(300);
  const cr=calls.find(c=>c.action==='gv_create');ok(cr&&cr.che_do==='thu'&&cr.questions.length===2&&cr.questions[0].text==='Bit là gì? (đã sửa)'&&cr.questions[0].topic==='Mã nhị phân'&&cr.questions[1].level==='Hiểu'&&cr.questions[1].answer==='B','lưu đề do giáo viên đã duyệt (có sửa), kèm chủ đề và mức độ');
  ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- Học sinh đọc bài: nghe đúng 1 bài, chỉ khối của bài, 50 dòng/lần ----------
 {const FDB='https://test-gv-default-rtdb.asia-southeast1.firebasedatabase.app';const thi_hs={};for(let i=1;i<=120;i++)thi_hs['hs'+i]={ma:'hs'+i,ten:'Học sinh '+String(i).padStart(3,'0'),lop:i%2?'9A':'9B',khoi:9};thi_hs.hs8x={ma:'hs8x',ten:'Em lớp 8',lop:'8A',khoi:8};
  const fdb={thi_hs,doc_read:{'tin-hoc-9~b1':{hs1:{pct:100,ten:'Học sinh 001',lop:'9A',at:1761550000000},hs2:{pct:40,ten:'Học sinh 002',lop:'9B',at:1}},'tin-hoc-8~b1':{hs8x:{pct:100,ten:'Em lớp 8',lop:'8A',at:1}}}};
  const paths=[];const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,fb:true,exams:[],bank:{},classes:{}})}));
  await pg.route(FDB+'/**',r=>{const pth=new URL(r.request().url()).pathname.replace(/\.json$/,'');paths.push(pth);const v=pth.split('/').filter(Boolean).reduce((o,k)=>(o === null || o === undefined)?undefined:o[k],fdb)??null;
   if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v})}\n\n`});r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
  const cat={courses:[{id:'tin-hoc-9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số'}]},{id:'tin-hoc-8',grade:8,lessons:[{id:'b1',title:'Máy tính'}]}]};
  await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?cat:u.endsWith('/teacher/students')?[]:{})})});
  await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
  await pg.click('#nav-overview');await pg.locator('#read-report').scrollIntoViewIfNeeded();await pg.waitForFunction(()=>document.querySelectorAll('#read-body tr').length>=2,null,{timeout:8000});
  ok(paths.some(p=>p.endsWith('/doc_read/tin-hoc-9~b1'))&&!paths.some(p=>/\/doc_read$/.test(p)),'đọc bài: chỉ nghe doc_read của bài đang chọn (không tải cả cây)');
  await pg.selectOption('#read-lop','');await pg.waitForTimeout(150);
  ok((await pg.textContent('#read-metrics')).includes('120')&&!(await pg.textContent('#read-body')).includes('Em lớp 8'),'bài lớp 9: chỉ tính học sinh khối 9');
  ok(await pg.locator('#read-body tr').count()===50&&(await pg.textContent('#read-report .t-more')).includes('50/120'),'đọc bài: 120 em → vẽ 50 dòng + Hiện thêm');
  await pg.click('#read-report .t-more button');ok(await pg.locator('#read-body tr').count()===100,'Hiện thêm → 100 dòng');
  ok((await pg.textContent('#read-body tr:first-child')).includes('Đọc hết'),'em đọc hết đứng đầu');
  ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
 // ---------- Giáo viên lớp: Mã giáo viên + PIN kiểm trên Firebase, chỉ Thi + Tài khoản lớp mình ----------
 {const FDB='https://test-gv-default-rtdb.asia-southeast1.firebasedatabase.app';const h=require('crypto').createHash('sha256').update('gv01:246810').digest('hex');
  const calls=[];const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));const worker=[];
  await pg.route(FDB+'/**',r=>{const u=new URL(r.request().url()).pathname;if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:'retry: 1000\nevent: put\ndata: {"path":"/","data":null}\n\n'});
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/thi_gv/gv01.json')?{ma:'GV01',ten:'Cô Hoa',lop:['9A'],h}:null)})});
  await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(p.action==='gv_students'?{ok:true,admin:false,students:[{ma:'hs01',ten:'An',lop:'9A',trang_thai:'Hoạt động'}],classes:{'9A':9}}:{ok:true,fb:true,exams:[],bank:{9:2},classes:{'9A':9}})})});
  await pg.route('**/api/**',r=>{worker.push(new URL(r.request().url()).pathname);r.fulfill({status:200,contentType:'application/json',body:'{}'})});
  await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);
  await pg.check('#teacher-login [name=role][value=gv]');ok(await pg.isVisible('#teacher-code'),'chọn Giáo viên lớp → hiện ô Mã giáo viên');
  await pg.fill('#teacher-code','GV01');await pg.fill('#teacher-login [name=pin]','000000');await pg.click('#teacher-login button[type=submit]');
  await pg.waitForFunction(()=>document.getElementById('teacher-login-error').textContent.includes('chưa đúng'));ok(true,'sai PIN → báo ngay');
  await pg.fill('#teacher-login [name=pin]','246810');await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');await pg.waitForTimeout(500);
  ok(!worker.some(u=>u.endsWith('/teacher/auth')),'đăng nhập giáo viên lớp không qua Worker');
  ok(await pg.evaluate(()=>document.body.classList.contains('is-class-teacher'))&&await pg.isHidden('#nav-overview')&&await pg.isHidden('#nav-lessons')&&await pg.isVisible('#nav-sheetexam')&&(await pg.isVisible('#nav-accounts')||await pg.isVisible('#hdr-accounts')),'giáo viên lớp: chỉ menu Thi và Tài khoản (điện thoại: Tài khoản ở biểu tượng cạnh bánh răng)');
  ok((await pg.textContent('#workspace-title'))==='Thi'&&calls.some(c=>c.action==='gv_list'&&c.gv_ma==='GV01'&&c.gv==='246810'),'vào thẳng Thi, gửi Mã giáo viên để Sheet lọc theo lớp');
  await pg.click('#tab-thi-new');ok((await pg['$$eval']('#thi-new-lop option',o=>o.map(x=>x.textContent))).join('|')==='Chỉ lớp 9A','tạo đề: chỉ chọn được lớp mình (không có Cả khối)');
  await goNav(pg,'#nav-accounts');await pg.waitForSelector('#acc-hs-body tr');ok(await pg.isHidden('#tab-acc-gv')&&(await pg.textContent('#acc-hs-count')).includes('lớp thầy cô phụ trách'),'Tài khoản: chỉ học sinh lớp mình, không có tab Giáo viên');
  ok(await pg.evaluate(()=>{const r=document.querySelector('.t-nav').getBoundingClientRect();return r.height>40&&Math.abs(r.bottom-innerHeight)<=2&&getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()===innerHeight+'px'}),'điện thoại: thanh menu dưới luôn hiện (đo chiều cao thật, không phụ thuộc 100dvh)');
  ok(await pg.isVisible('#open-settings'),'giáo viên lớp có nút Cài đặt');await pg.click('#open-settings');await pg.waitForTimeout(150);
  ok(await pg.isVisible('#act-gv-pin')&&await pg.isVisible('#teacher-logout')&&await pg.isHidden('#act-profile-ai')&&await pg.isHidden('#act-profile-keys')&&(await pg.textContent('#gv-who')).includes('Cô Hoa'),'Cài đặt giáo viên lớp: tên, Đổi mã PIN, Đăng xuất (không có mục quản trị)');
  await pg.click('#act-gv-pin');await pg.waitForSelector('#gv-pin-dialog[open]');
  await pg.fill('#gv-pin-old','246810');await pg.fill('#gv-pin-new','135791');await pg.fill('#gv-pin-again','135790');await pg.click('#gv-pin-save');
  ok((await pg.getAttribute('#gv-pin-again','aria-invalid'))==='true'&&(await pg.textContent('#gv-pin-again-err')).includes('chưa khớp')&&!calls.some(c=>c.action==='gv_repin'),'nhập lại sai → báo dưới trường, không gửi');
  await pg.fill('#gv-pin-again','135791');await pg.click('#gv-pin-save');await pg.waitForSelector('#msg-dialog[open]');
  const rp=calls.find(c=>c.action==='gv_repin');ok(rp&&rp.gv==='246810'&&rp.new_gv==='135791'&&rp.gv_ma==='GV01'&&await pg.evaluate(()=>sessionStorage.getItem('thi-gv-mk'))==='135791','đổi mã PIN: gửi PIN cũ + mới lên Sheet, phiên dùng PIN mới');
  await pg.click('#msg-ok');
  await pg.click('#open-settings');await pg.waitForTimeout(150);await pg.click('#act-support');await pg.waitForSelector('#support-dialog[open]');await pg.waitForTimeout(200);
  ok(await pg.isHidden('#support-ten-field'),'giáo viên lớp: Zalo riêng, dùng tên trong tài khoản');
  await pg.fill('#support-zalo','abc');await pg.click('#support-save');ok((await pg.getAttribute('#support-zalo','aria-invalid'))==='true'&&!calls.some(c=>c.action==='gv_support_save'),'Zalo sai dạng → báo dưới trường, không gửi');
  await pg.fill('#support-zalo','0912 345 678');await pg.click('#support-save');await pg.waitForSelector('#msg-dialog[open]');ok(calls.some(c=>c.action==='gv_support_save'&&c.zalo==='0912 345 678'&&c.gv_ma==='GV01'),'lưu Zalo hỗ trợ lên Google Sheet');await pg.click('#msg-ok');
  await pg.reload();await pg.waitForSelector('#workspace:not([hidden])');await pg.waitForTimeout(500);ok((await pg.textContent('#workspace-title'))==='Thi','tải lại trang: vẫn đăng nhập, vào Thi');
  await pg.evaluate(()=>document.getElementById('teacher-logout').click());await pg.waitForSelector('#auth-section:not([hidden])');ok(!(await pg.evaluate(()=>sessionStorage.getItem('thi-gv-ma'))),'đăng xuất xóa phiên giáo viên lớp');
  ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
console.log('TEACHER THI UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
