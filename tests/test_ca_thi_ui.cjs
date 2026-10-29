// THI THẬT – màn giáo viên "Theo dõi ca thi" (30/10/2026): 4 trạng thái, mở/đóng theo lớp, cập nhật tức thì (vào thi, tiến độ, nộp),
// thông báo nộp + nút mở bài trên Drive, ghi chú vắng có lý do (lưu Sheet), cho thi lại có lý do, nhãn ngoài mạng trường, lấy IP mạng trường.
// Firebase giả trả SSE "retry: 300" → trình duyệt tự nối lại mỗi 0,3 giây, đọc dữ liệu mới (giống cập nhật tức thì).
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';
const FDB='https://test-gv-default-rtdb.asia-southeast1.firebasedatabase.app';const SH=process.env.SHOTS;
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${FDB}'};`);if(p==='/sheet-config.js')body=Buffer.from(body.toString().replace(/export const SHEET_API = '[^']*';/,`export const SHEET_API = '${API}';`));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8197);
const DRIVE='https://drive.google.com/drive/folders/THU-MUC-HS01';
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const vp of [{width:1280,height:860},{width:390,height:844}]){const desktop=vp.width>1000;
 const fdb={thi_hs:{hs01:{ma:'HS01',ten:'[THỬ] An',lop:'9TH',khoi:9},hs02:{ma:'hs02',ten:'[THỬ] Bình',lop:'9TH',khoi:9},hs03:{ma:'hs03',ten:'[THỬ] Chi',lop:'9TH',khoi:9},hs04:{ma:'hs04',ten:'[THỬ] Dũng',lop:'9TX',khoi:9}},
  thi_tt:{},thi_vao:{},thi_tien_do:{},thi_drive:{},thi_ip:{},thi_th:{},thi_nop:{},thi_cfg:{}};
 const EX={ma_de:'e1',tieu_de:'Cuối kỳ I',che_do:'that',noi_dung:'tn_th',khoi:9,lop:'',trang_thai:'khoa',questions:10,total:3,vao:0,nop:0,tao_luc:'x'};
 const calls=[];let vang={};const fp=[];
 const ctx=await b.newContext({viewport:vp,serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...x})});
  const ten=k=>fdb.thi_hs[k].ten;const cls=l=>Object.keys(fdb.thi_hs).filter(k=>fdb.thi_hs[k].lop===l);
  if(p.action==='gv_tt'){const e=fdb.thi_tt.e1=fdb.thi_tt.e1||{};
   if(p.lenh==='mo_lop'){const ks=cls(p.lop).filter(k=>!e[k]||e[k].tt==='chua_mo');ks.forEach(k=>e[k]={tt:'chua_thi',lop:p.lop,lan:(e[k]?.lan)||0});return j({n:ks.length})}
   if(p.lenh==='dong_lop'){const ks=cls(p.lop).filter(k=>e[k]&&['chua_thi','thi_lai'].includes(e[k].tt));ks.forEach(k=>e[k]={...e[k],tt:'chua_mo'});return j({n:ks.length})}
   const k=p.ma.toLowerCase();if(p.lenh==='mo_em'){e[k]={tt:'chua_thi',lop:p.lop,lan:0};return j({n:1})}
   if(p.lenh==='thi_lai'){if(!p.ly_do)return j({ok:false,error:'Chọn lý do'});e[k]={...e[k],tt:'thi_lai',ly_do:p.ly_do};return j({n:1})}}
  if(p.action==='gv_vang'){const k=p.ma.toLowerCase();if(p.ly_do)vang[k]={ly_do:p.ly_do,ghi:p.ghi};else delete vang[k];return j({vang,drive:{},diem:{}})}
  if(p.action==='gv_ca'||p.action==='gv_luu')return j({vang,drive:{},diem:fdb.thi_tt.e1?.hs01?.tt==='da_thi'?{hs01:{diem:8,tong:10}}:{}});
  if(p.action==='gv_ip_truong')return j({ip_truong:'203.0.113'});
  return j({fb:true,exams:[EX],bank:{9:10},classes:{'9TH':9,'9TX':9},published:1})});
 await pg.route(FDB+'/**',r=>{const u=new URL(r.request().url());fp.push(u.pathname);const parts=u.pathname.replace(/\.json$/,'').split('/').filter(Boolean);const v=parts.reduce((o,k)=>(o===null||o===undefined)?undefined:o[k],fdb)??null;
  if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v})}\n\n`});
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/thi/my-ip')?{ip:'203.0.113.5'}:u.endsWith('/teacher/students')?[]:{})})});
 await pg.goto('http://localhost:8197/teacher.html');await pg.waitForTimeout(300);await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
 await pg.click('#nav-sheetexam');await pg.waitForSelector('#thi-list article');
 const card=await pg.textContent('#thi-list article');ok(card.includes('Thi thật')&&card.includes('Trắc nghiệm + Thực hành')&&!card.includes('Đang KHÓA')&&!/xem điểm/i.test(card),'thẻ bài thi thật: loại, nội dung; không còn Mở/Khóa chung, không có Cho xem điểm');
 await pg.click('#thi-list article .t-icon-btn[aria-label^="Theo dõi ca thi"]');await pg.waitForSelector('#ca-thi:not([hidden])');
 // 1. Bài cho cả khối 9 → chọn lớp (9TH, 9TX), mặc định Chưa mở thi
 ok((await pg.$$eval('#ca-lop option',o=>o.map(x=>x.value))).join()==='9TH,9TX','chọn lớp: các lớp của khối 9 trên Firebase');
 await pg.waitForFunction(()=>document.querySelectorAll('#ca-body tr[data-k]').length===3);
 ok((await pg.$$eval('#ca-body tr[data-k]',t=>t.map(x=>x.dataset.tt))).every(x=>x==='chua_mo')&&(await pg.textContent('#ca-body')).includes('Chưa mở thi'),'3 em lớp 9TH, mặc định Chưa mở thi');
 ok((await pg.innerText('#ca-metrics')).replace(/\s+/g,' ').includes('Sĩ số 3')&&!await pg.isDisabled('#ca-mo')&&await pg.isDisabled('#ca-dong'),'đầu màn: sĩ số; Mở thi bật, Đóng thi tắt');
 ok(await pg.isHidden('#thi-gv-toggle')&&await pg.isHidden('#thi-st-tabs')&&await pg.isHidden('#tabpanel-thi-kq'),'không lẫn bảng thi thử');
 // 2. Mở thi cho lớp: hỏi xác nhận, gửi đúng lớp
 await pg.click('#ca-mo');await pg.waitForSelector('#msg-dialog[open]');ok((await pg.textContent('#msg-dialog')).includes('Mở thi cho lớp 9TH?')&&(await pg.textContent('#msg-dialog')).includes('3 em'),'Mở thi: hộp xác nhận nêu lớp và số em');
 await pg.click('#msg-dialog button:has-text("Mở thi cho lớp")');await pg.waitForFunction(()=>[...document.querySelectorAll('#ca-body tr[data-k]')].every(x=>x.dataset.tt==='chua_thi'),null,{timeout:6000});
 const mo=calls.find(c=>c.action==='gv_tt');ok(mo.lenh==='mo_lop'&&mo.lop==='9TH'&&mo.ma_de==='e1'&&mo.gv===PIN,'gửi lệnh mở thi đúng bài, đúng lớp');
 ok((await pg.textContent('#thi-gv-status')).includes('Đã mở thi cho lớp 9TH (3 em)')&&!await pg.isDisabled('#ca-dong'),'báo đã mở; Đóng thi bật');
 // 3. Em vào thi, đang làm: tức thì
 const t0=Date.UTC(2026,9,30,2,5,9);fdb.thi_vao.e1={hs01:t0};fdb.thi_tien_do.e1={hs01:{n:5,tong:10,th:true,at:t0}};fdb.thi_th.e1={hs01:{ten_file:'bai.xlsx',size:10,file_id:'F',at:t0}};
 await pg.waitForFunction(()=>(document.querySelector('#ca-body tr[data-k=hs01]')?.textContent||'').includes('Trắc nghiệm 5/10'),null,{timeout:6000});
 const r1=await pg.textContent('#ca-body tr[data-k=hs01]');ok(r1.includes('Vào lúc 09:05:09')&&r1.includes('Thực hành: đã nộp ✓'),'dòng em: giờ vào thi, TN 5/10, thực hành đã nộp');
 ok((await pg.textContent('#ca-body tr[data-k=hs02]')).includes('Thực hành: chưa nộp'),'em chưa nộp thực hành: báo chưa nộp');
 ok((await pg.innerText('#ca-metrics')).replace(/\s+/g,' ').includes('Đang làm 1'),'đầu màn: đang làm 1');
 // 4. Em nộp → thông báo + Sheet lưu Drive → nút Mở bài trên Drive
 const tn=Date.UTC(2026,9,30,2,31,47);fdb.thi_tt.e1.hs01={...fdb.thi_tt.e1.hs01,tt:'da_thi',nop_luc:tn,lan:1};
 await pg.waitForSelector('#ca-toasts .ca-toast',{timeout:6000});const toast=await pg.textContent('#ca-toasts .ca-toast');
 ok(toast.includes('[THỬ] An (9TH) đã nộp bài lúc 09:31:47'),'thông báo nổi: tên, lớp, giờ nộp chính xác');
 ok(await pg.getAttribute('#ca-toasts .ca-drive','aria-disabled')==='true','chưa lưu xong Drive: nút chờ');
 await pg.waitForFunction(()=>window.performance.now()>0);await pg.waitForTimeout(3300);ok(calls.some(c=>c.action==='gv_luu'&&c.ma_de==='e1'),'có em nộp → nhờ Sheet kéo bài, chấm, lưu Drive ngay');
 fdb.thi_drive.e1={hs01:{thu_muc:DRIVE,txt:true,th:true,lan:1}};
 await pg.waitForFunction(u=>document.querySelector('#ca-body tr[data-k=hs01] a.ca-drive')?.href===u,DRIVE,{timeout:6000});
 const r1b=await pg.textContent('#ca-body tr[data-k=hs01]');ok(r1b.includes('Đã nộp 09:31:47')&&r1b.includes('Bài làm ✓ · Thực hành ✓')&&r1b.includes('Điểm (Sheet chấm): 8/10'),'dòng em: đã nộp lúc, kiểm đủ file trên Drive, điểm chỉ giáo viên thấy');
 ok(await pg.getAttribute('#ca-toasts .ca-drive','href')===DRIVE&&await pg.getAttribute('#ca-toasts .ca-drive','aria-disabled')===null&&await pg.getAttribute('#ca-body tr[data-k=hs01] a.ca-drive','target')==='_blank','thông báo: nút Mở bài trên Drive đúng thư mục của em, mở tab mới');
 ok(!(await pg.textContent('#ca-body tr[data-k=hs01]')).includes('Ghi chú vắng')&&(await pg.textContent('#ca-body tr[data-k=hs01]')).includes('Cho thi lại'),'em đã thi: có Cho thi lại, không có Ghi chú vắng');
 // 5. Ngoài mạng trường
 fdb.thi_ip.e1={hs02:{ngoai:true,ip:'198.51'}};await pg.waitForFunction(()=>(document.querySelector('#ca-body tr[data-k=hs02]')?.textContent||'').includes('Ngoài mạng trường'),null,{timeout:6000});
 await pg.selectOption('#ca-loc','ngoai');ok((await pg.$$('#ca-body tr[data-k]')).length===1&&(await pg.textContent('#ca-body')).includes('[THỬ] Bình'),'lọc: máy ngoài mạng trường');await pg.selectOption('#ca-loc','');
 // 6. Ghi chú vắng: kiểm lỗi, lưu Sheet
 await pg.click('#ca-body tr[data-k=hs03] button:has-text("Ghi chú vắng")');await pg.waitForSelector('#vang-dialog[open]');
 ok((await pg.textContent('#vang-who')).includes('[THỬ] Chi')&&await pg.evaluate(()=>document.activeElement.id)==='vang-ly-do'&&await pg.isHidden('#vang-xoa'),'hộp ghi chú vắng: đúng em, con trỏ ở Lý do');
 await pg.click('#vang-luu');ok((await pg.textContent('#vang-err'))==='Chọn lý do vắng.'&&await pg.getAttribute('#vang-ly-do','aria-invalid')==='true'&&!calls.some(c=>c.action==='gv_vang'),'chưa chọn lý do → báo dưới trường, chưa gửi');
 await pg.selectOption('#vang-ly-do','Khác');await pg.click('#vang-luu');ok((await pg.textContent('#vang-err')).includes('Ghi rõ')&&!calls.some(c=>c.action==='gv_vang'),'Khác mà không ghi → báo');
 await pg.selectOption('#vang-ly-do','Ốm');await pg.fill('#vang-ghi','Sốt, phụ huynh xin phép');await pg.click('#vang-luu');await pg.waitForSelector('#vang-dialog',{state:'hidden'});
 const gv=calls.find(c=>c.action==='gv_vang');ok(gv.ma==='hs03'&&gv.ly_do==='Ốm'&&gv.ghi==='Sốt, phụ huynh xin phép','lưu ghi chú vắng lên Sheet đúng em, đúng lý do');
 ok((await pg.textContent('#ca-body tr[data-k=hs03]')).includes('Ốm: Sốt, phụ huynh xin phép')&&(await pg.innerText('#ca-metrics')).replace(/\s+/g,' ').includes('Vắng (ghi chú) 1'),'dòng em hiện lý do vắng; đầu màn đếm vắng');
 // 7. Cho thi lại có lý do
 await pg.click('#ca-body tr[data-k=hs01] button:has-text("Cho thi lại")');await pg.waitForSelector('#thilai-dialog[open]');ok((await pg.textContent('#thilai-who')).includes('đã nộp lúc 09:31:47'),'hộp thi lại: nêu giờ đã nộp');
 await pg.click('#thilai-luu');ok((await pg.textContent('#thilai-err')).includes('Chọn lý do')&&!calls.some(c=>c.lenh==='thi_lai'),'thi lại chưa chọn lý do → báo');
 await pg.selectOption('#thilai-ly-do','Máy hỏng');await pg.click('#thilai-luu');await pg.waitForSelector('#thilai-dialog',{state:'hidden'});
 const tl=calls.find(c=>c.lenh==='thi_lai');ok(tl.ma==='HS01'&&tl.ly_do==='Máy hỏng'&&tl.ma_de==='e1','cho thi lại: đúng em, đúng lý do');
 await pg.waitForFunction(()=>document.querySelector('#ca-body tr[data-k=hs01]')?.dataset.tt==='thi_lai',null,{timeout:6000});ok((await pg.textContent('#ca-body tr[data-k=hs01]')).includes('Lý do: Máy hỏng'),'trạng thái Thi lại + lý do');
 // 8. Lấy IP mạng trường
 await pg.click('#ca-ip');await pg.waitForFunction(()=>document.getElementById('ca-ip-text').textContent.includes('203.0.113'));ok(calls.find(c=>c.action==='gv_ip_truong').ip==='203.0.113.5','lấy IP mạng trường: đọc IP máy giáo viên rồi lưu Sheet');
 if(SH&&desktop)await pg.locator('#ca-thi').screenshot({path:SH+'/ca-thi-desktop.png'});
 // 9. Đóng thi lớp: nêu em đang làm / chưa vào
 await pg.click('#ca-dong');await pg.waitForSelector('#msg-dialog[open]');const dt=await pg.textContent('#msg-dialog');ok(dt.includes('Đóng thi lớp 9TH?')&&dt.includes('em chưa vào thi'),'Đóng thi: hộp xác nhận nêu số em chưa nộp');
 await pg.click('#msg-dialog button:has-text("Đóng thi lớp")');await pg.waitForFunction(()=>!document.querySelector('#ca-body tr[data-tt=chua_thi]')&&!document.querySelector('#ca-body tr[data-tt=thi_lai]'),null,{timeout:6000});
 ok(calls.some(c=>c.lenh==='dong_lop'&&c.lop==='9TH'),'đóng thi đúng lớp');
 // 10. Giao diện: không tràn, vùng chạm, tối
 ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'không tràn ngang '+vp.width);
 const small=await pg.$$eval('#ca-thi button,#ca-thi select,#ca-thi a.t-button',a=>a.filter(x=>x.offsetParent&&x.getBoundingClientRect().height<44).map(x=>x.textContent||x.id));ok(!small.length,'vùng chạm ≥ 44px '+small);
 if(SH&&!desktop){await pg.locator('#ca-body tr[data-k=hs01]').scrollIntoViewIfNeeded();await pg.screenshot({path:SH+'/ca-thi-mobile.png'});await pg.emulateMedia({colorScheme:'dark'});await pg.waitForTimeout(200);await pg.screenshot({path:SH+'/ca-thi-dark.png'});await pg.emulateMedia({colorScheme:'light'});}
 // 11. Quay lại: thôi nghe Firebase
 await pg.click('#act-sheetexam-back');await pg.waitForSelector('#list-sheetexam:not([hidden])');await pg.waitForTimeout(800);const k0=fp.filter(p=>p.startsWith('/thi_tt/')).length;await pg.waitForTimeout(1500);
 ok(fp.filter(p=>p.startsWith('/thi_tt/')).length===k0&&await pg.isHidden('#ca-thi'),'quay lại danh sách: dừng nghe ca thi');
 ok(errs.length===0,'không lỗi JS '+errs.join('|'));await ctx.close()}
 console.log('CA THI UI OK '+n)}catch(e){console.error(e);process.exitCode=1}finally{await b.close();srv.close()}})();
