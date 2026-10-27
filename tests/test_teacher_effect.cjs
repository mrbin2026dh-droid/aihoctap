// Menu "Hiệu quả" (giáo viên): tiến bộ thi thử (lần đầu → cao nhất), Bản đồ năng lực lớp, đọc bài, học sinh cần hỗ trợ, xuất CSV.
// Số liệu từ Firebase giả lập; giáo viên lớp chỉ thấy lớp mình.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';const FDB='https://test-eff-default-rtdb.asia-southeast1.firebasedatabase.app';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${FDB}'};`);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8205);
const h=crypto.createHash('sha256').update('gv02:246810').digest('hex');
const fdb={thi_hs:{a:{ma:'a',ten:'An',lop:'9A',khoi:9},b:{ma:'b',ten:'=HYPERLINK("x")',lop:'9A',khoi:9},c:{ma:'c',ten:'Chi',lop:'9A',khoi:9},d:{ma:'d',ten:'Dũng',lop:'9B',khoi:9}},
 thi_bai:{t1:{tieu_de:'Ôn tập chương 1',che_do:'thu',khoi:9,lop:'',trang_thai:'mo'},x1:{tieu_de:'Giữa kỳ',che_do:'that',khoi:9,lop:'9A',trang_thai:'khoa'}},
 thi_nop:{t1:{a:{diem:4,tong:10,dau:4,cao_nhat:9,lan:3},b:{diem:3,tong:10,dau:3,cao_nhat:3,lan:1},d:{diem:10,tong:10,dau:6,cao_nhat:10,lan:2}}},
 nang_luc:{a:{at:1,topics:{ma_nhi_phan:{ten:'Mã nhị phân',d:2,n:10},du_lieu_so:{ten:'Dữ liệu số',d:9,n:10}}},b:{at:1,topics:{ma_nhi_phan:{ten:'Mã nhị phân',d:1,n:10}}},d:{at:1,topics:{ma_nhi_phan:{ten:'Mã nhị phân',d:10,n:10}}}},
 doc_read:{'tin9~b1':{a:{pct:100},b:{pct:40},d:{pct:100}}},
 thi_gv:{gv02:{ma:'GV02',ten:'Cô Lan',lop:['9A'],h}}};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{for(const role of ['admin','gv']){
 const ctx=await b.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route(API,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,fb:true,exams:[],bank:{},classes:{'9A':9}})}));
 await pg.route(FDB+'/**',r=>{const parts=new URL(r.request().url()).pathname.replace(/\.json$/,'').split('/').filter(Boolean);const v=parts.reduce((o,k)=>o==null?undefined:o[k],fdb)??null;
  if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v})}\n\n`});r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.endsWith('/teacher/auth')?{token:'tt',must_change:false}:u.endsWith('/pwa/catalog')?{courses:[]}:u.endsWith('/teacher/students')?[]:{})})});
 await pg.goto('http://localhost:8205/teacher.html');await pg.waitForTimeout(400);
 if(role==='gv'){await pg.check('#teacher-login [name=role][value=gv]');await pg.fill('#teacher-code','GV02');}
 await pg.fill('#teacher-login [name=pin]',role==='gv'?'246810':PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
 ok(await pg.isVisible('#nav-effect'),role+': có menu Hiệu quả');
 await pg.click('#nav-effect');await pg.waitForFunction(()=>document.getElementById('eff-status').textContent.includes('học sinh'),null,{timeout:8000});
 if(role==='admin'){
  const m=await pg.textContent('#eff-metrics');ok(m.includes('4')&&m.includes('+30 điểm %')&&m.includes('Lần đầu 43%')&&m.includes('cao nhất 73%')&&m.includes('2 em tiến bộ'),'tiến bộ thi thử: lần đầu TB 43% → cao nhất TB 73%, 2 em tiến bộ');
  ok(m.includes('80%'),'đọc bài trung bình 80%');
  const tp=await pg.$$eval('#eff-topics .eff-topic',a=>a.map(x=>({c:x.className,t:x.textContent})));ok(tp[0].t.includes('Mã nhị phân')&&tp[0].t.includes('43%')&&tp[0].t.includes('2 em dưới 50%')&&tp[0].c.includes('is-weak')&&tp[1].t.includes('Dữ liệu số')&&tp[1].c.includes('is-good'),'Bản đồ năng lực lớp: chủ đề yếu nhất lên đầu, đỏ/xanh theo %');
  const ex=await pg.textContent('#eff-exams-body');ok(ex.includes('Ôn tập chương 1')&&ex.includes('43%')&&ex.includes('73%')&&ex.includes('+30 · 2 em')&&!ex.includes('Giữa kỳ'),'bảng tiến bộ theo bài thi thử (không tính thi thật)');
  const hl=await pg.textContent('#eff-help');ok(hl.includes('HYPERLINK')&&!hl.includes('An ·')&&!hl.includes('Dũng'),'học sinh cần hỗ trợ: năng lực hoặc thi thử dưới 50%');
  await pg.selectOption('#eff-lop','9B');ok((await pg.textContent('#eff-status')).startsWith('1 học sinh')&&(await pg.textContent('#eff-topics')).includes('100%'),'lọc theo lớp 9B');
  await pg.selectOption('#eff-lop','');
  const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#eff-csv')]);const csv=fs.readFileSync(await dl.path(),'utf8');
  ok(csv.charCodeAt(0)===0xfeff&&csv.includes('Mã học sinh,Họ tên,Lớp')&&csv.includes('a,An,9A,1,40,90,50,100,1,55,Mã nhị phân (20%)')&&csv.includes(`"'=HYPERLINK(""x"")"`),'xuất CSV UTF-8 (mở được tiếng Việt trong Excel), chặn công thức nguy hiểm trong ô');
 } else {
  ok((await pg.textContent('#eff-status')).startsWith('3 học sinh')&&!(await pg.textContent('#eff-help')).includes('Dũng')&&(await pg.$$eval('#eff-lop option',o=>o.map(x=>x.value))).join()==='9A','giáo viên lớp: chỉ thấy lớp 9A của mình');
  ok(await pg.evaluate(()=>{const n=document.querySelector('.t-nav');return getComputedStyle(n).gridAutoFlow.includes('column')||innerWidth>760}),'menu tự chia cột theo số mục');
 }
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));await ctx.close()}
 console.log('TEACHER EFFECT OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
