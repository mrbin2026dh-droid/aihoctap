// Menu "Thi" giáo viên (Google Sheet giả, đăng nhập giáo viên thật qua giao diện): không hỏi mật khẩu, tạo bài thi thật/thử,
// khối 6–9, chọn lớp, điểm danh Chưa vào/Đã vào/Đã nộp, mở/khóa, cho thi lại; menu "Về nhà".
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/sheet-config.js')body=Buffer.from(body.toString().replace(/export const SHEET_API = '[^']*';/,`export const SHEET_API = '${API}';`));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8196);
let st;const reset=()=>{st={exam:null,calls:[],students:[{name:'Nguyễn Văn An',lop:'9A',ma:'HS01',state:'chua'},{name:'Trần Thị Bình',lop:'9A',ma:'hs9a02',state:'chua'},{name:'Lê Chi',lop:'9B',ma:'hs9b01',state:'chua'},{name:'Phạm Dũng',lop:'8A',ma:'hs8a01',state:'chua'}]}};
const scope=s=>!st.exam?false:st.exam.lop?s.lop===st.exam.lop:Number(s.lop[0])===st.exam.khoi;
const info=()=>({ok:true,exam:st.exam,bank:{6:0,7:0,8:1,9:3},classes:{'9A':9,'9B':9,'8A':8},students:st.students.map(s=>({...s,in_scope:scope(s),score:s.state==='nop'?7:null,total:s.state==='nop'?10:null}))});
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:1280,height:800},{width:390,height:800}]){reset();
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route(API,r=>{const p=JSON.parse(r.request().postData());st.calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(p.gv!==PIN)return j({ok:false,error:'PIN giáo viên chưa khớp với Google Sheet.'});
  if(p.action==='gv_create'){if(p.che_do==='that'&&p.khoi===7)return j({ok:false,error:'Trang DeThi trong Google Sheet chưa có câu cho khối 7.'});st.exam={ma_de:'1',tieu_de:p.tieu_de,che_do:p.che_do,khoi:p.khoi,lop:p.lop,trang_thai:'khoa',questions:p.che_do==='thu'?p.questions.length:3};st.students.forEach(s=>s.state='chua')}
  if(p.action==='gv_set')st.exam.trang_thai=p.trang_thai;
  if(p.action==='gv_reset')st.students.find(s=>s.ma===p.ma).state='chua';
  return j(info())});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
 await pg.goto('http://localhost:8196/teacher.html');await pg.waitForTimeout(400);
 await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
 const navs=await pg.$$eval('.t-nav-item',a=>a.map(x=>x.id));
 ok(navs.join()==='nav-overview,nav-lessons,nav-exams,nav-sheetexam,nav-materials,nav-accounts','menu: ... Về nhà, Thi, ...');
 ok((await pg.textContent('#nav-exams')).includes('Về nhà'),'menu "Về nhà"');
 await pg.click('#nav-sheetexam');await pg.waitForSelector('#thi-new-form');await pg.waitForTimeout(400);
 ok(await pg.textContent('#workspace-title')==='Thi','mở menu Thi');
 ok((await pg.locator('#view-sheetexam input[type=password]').count())===0,'không còn ô mật khẩu');
 ok(st.calls[0]&&st.calls[0].action==='gv_info'&&st.calls[0].gv===PIN,'app tự gửi PIN giáo viên vừa đăng nhập');
 ok(await pg.isHidden('#thi-gv-current'),'chưa có bài thi → chỉ hiện form tạo');
 ok((await pg.$$eval('#thi-new-khoi option',o=>o.map(x=>x.value))).join()==='9,8,7,6','khối 9, 8, 7, 6');
 ok((await pg.$$eval('#thi-new-lop option',o=>o.map(x=>x.textContent))).join('|')==='Cả khối 9|Chỉ lớp 9A|Chỉ lớp 9B','lớp lấy từ Sheet theo khối');
 ok((await pg.textContent('#thi-new-bank')).includes('3 câu cho khối 9'),'thi thật: báo số câu trong Sheet');
 await pg.click('#thi-new-create');ok((await pg.textContent('#thi-gv-status')).includes('tiêu đề'),'thiếu tiêu đề → báo');
 await pg.fill('#thi-new-title','Giữa kỳ');await pg.selectOption('#thi-new-khoi','7');await pg.click('#thi-new-create');await pg.waitForTimeout(400);
 ok((await pg.textContent('#thi-gv-status')).includes('khối 7'),'khối chưa có đề → báo lỗi từ Sheet');
 await pg.selectOption('#thi-new-khoi','9');await pg.selectOption('#thi-new-lop','9A');await pg.click('#thi-new-create');await pg.waitForSelector('#thi-gv-current:not([hidden])');
 const cr=st.calls.find(c=>c.action==='gv_create'&&c.khoi===9);ok(cr.che_do==='that'&&cr.lop==='9A'&&cr.tieu_de==='Giữa kỳ','tạo thi thật lớp 9A gửi đúng');
 ok((await pg.textContent('#thi-gv-sub')).includes('lớp 9A')&&(await pg.textContent('#thi-gv-sub')).includes('KHÓA'),'bài mới: lớp 9A, đang khóa');
 ok((await pg.$$('#thi-gv-body tr')).length===2&&!(await pg.textContent('#thi-gv-body')).includes('Lê Chi'),'chỉ liệt kê học sinh 9A');
 st.students[0].state='vao';await pg.click('#thi-gv-refresh');await pg.waitForTimeout(400);
 ok((await pg.textContent('#thi-gv-metrics')).includes('Đã vào phòng thi1'),'điểm danh: 1 em đã vào');
 await pg.check('#thi-gv-only');ok((await pg.$$('#thi-gv-body tr')).length===1&&(await pg.textContent('#thi-gv-body')).includes('Trần Thị Bình'),'lọc em chưa vào');await pg.uncheck('#thi-gv-only');
 await pg.click('#thi-gv-open');await pg.waitForTimeout(400);ok(st.exam.trang_thai==='mo'&&(await pg.textContent('#thi-gv-sub')).includes('MỞ'),'mở thi');
 ok(await pg.isDisabled('#thi-gv-open')&&!(await pg.isDisabled('#thi-gv-lock')),'đang mở: Mở tắt, Khóa bật');
 st.students[0].state='nop';await pg.waitForTimeout(20600);
 ok((await pg.textContent('#thi-gv-body')).includes('Đã nộp')&&(await pg.textContent('#thi-gv-body')).includes('7/10'),'tự cập nhật 20 giây từ Sheet: thấy em đã nộp + điểm');
 await pg.click('#thi-gv-body tr:first-child button');await pg.waitForTimeout(400);ok(st.calls.some(c=>c.action==='gv_reset'&&c.ma==='HS01'),'cho thi lại');
 await pg.click('#thi-gv-lock');await pg.waitForTimeout(400);ok(st.exam.trang_thai==='khoa','khóa thi');
 // thi thử: phải có file Excel; bài mới thay bài cũ cần xác nhận
 await pg.selectOption('#thi-new-mode','thu');ok(await pg.isVisible('#thi-new-file-row'),'thi thử: hiện nút tải Excel');
 await pg.fill('#thi-new-title','Ôn tập');await pg.click('#thi-new-create');ok((await pg.textContent('#thi-gv-status')).includes('Excel'),'thi thử chưa có file → báo');
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
console.log('TEACHER THI UI OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
