// Chấm thực hành (giáo viên): tiêu chí khi tạo bài thi thật; máy đọc file Excel THẬT (zip+XML) và chạy Python THẬT (Pyodide)
// để kiểm tra tiêu chí tự động; AI gợi ý điểm tiêu chí chấm tay; giáo viên sửa và lưu điểm.
// Pyodide lấy từ npm (tests/.cache) và phục vụ thay CDN; không có mạng npm thì bỏ qua phần Python (báo rõ).
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert'),zlib=require('zlib'),cp=require('child_process');
const root=path.resolve(__dirname,'../frontend/hoc');const API='https://script.google.com/macros/s/TEST/exec';const PIN='Mat-khau-thu-1';const FDB='https://test-th-default-rtdb.asia-southeast1.firebasedatabase.app';
const PYO=path.join(__dirname,'.cache','pyodide-0.26.4');
let havePy=fs.existsSync(path.join(PYO,'pyodide.js'));
if(!havePy){try{fs.mkdirSync(path.dirname(PYO),{recursive:true});cp.execSync('npm pack pyodide@0.26.4 --silent',{cwd:path.dirname(PYO),stdio:'pipe',timeout:120000});cp.execSync('tar xzf pyodide-0.26.4.tgz && mv package pyodide-0.26.4 && rm pyodide-0.26.4.tgz',{cwd:path.dirname(PYO),stdio:'pipe'});havePy=fs.existsSync(path.join(PYO,'pyodide.js'));}catch(e){console.log('(bỏ qua Python: không tải được pyodide từ npm)');}}
// Tạo file .xlsx thật (nén deflate như Excel)
function zip(files){const parts=[],cen=[];let off=0;for(const [name,text] of Object.entries(files)){const raw=Buffer.from(text),comp=zlib.deflateRawSync(raw),nm=Buffer.from(name),crc=zlib.crc32(raw);
 const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(comp.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(nm.length,26);parts.push(lh,nm,comp);
 const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(comp.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(nm.length,28);ch.writeUInt32LE(off,42);cen.push(ch,nm);off+=30+nm.length+comp.length;}
 const cd=Buffer.concat(cen),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(Object.keys(files).length,8);e.writeUInt16LE(Object.keys(files).length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);return Buffer.concat([...parts,cd,e]);}
const xlsx=(d11f,d11v)=>zip({'[Content_Types].xml':'<Types/>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bảng điểm" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/sharedStrings.xml':'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Tổng</t></si></sst>',
 'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="D2"><v>50</v></c></row><row r="3"><c r="D3"><v>70</v></c></row><row r="11"><c r="C11" t="s"><v>0</v></c><c r="D11">${d11f?`<f>${d11f}</f>`:''}<v>${d11v}</v></c></row></sheetData></worksheet>`});
const FILES={'e1|hs01':{ten:'bai-an.xlsx',data:xlsx('SUM(D2:D10)',120).toString('base64')},'e1|hs02':{ten:'bai-binh.xlsx',data:xlsx('D2+D3',100).toString('base64')},
 'e2|hs01':{ten:'tong.py',data:Buffer.from('a = int(input())\nb = int(input())\nprint(a + b)\n').toString('base64')},'e2|hs02':{ten:'loi.py',data:Buffer.from('while True:\n    pass\n').toString('base64')}};
const THX={loai:'excel',de:'Tính tổng cột D vào ô D11',tieu_chi:[{mo_ta:'D11 dùng hàm SUM',diem:2,kt:{type:'excel_formula',a:'D11',b:'SUM'}},{mo_ta:'Tổng đúng 120',diem:1,kt:{type:'excel_value',a:'D11',b:'120'}},{mo_ta:'Trình bày rõ ràng',diem:1,kt:null}]};
const THP={loai:'python',de:'Nhập 2 số, in tổng',tieu_chi:[{mo_ta:'Chạy đúng 3 + 4',diem:2,kt:{type:'py_test',a:'3\n4',b:'7'}},{mo_ta:'Dùng input()',diem:1,kt:{type:'py_contains',a:'input',b:''}}]};
const EX=[{ma_de:'e1',tieu_de:'Cuối kỳ Excel',che_do:'that',khoi:9,lop:'9A',trang_thai:'mo',questions:2,total:0,vao:0,nop:0,tao_luc:'b',noi_dung:'tn_th',thuc_hanh:THX},{ma_de:'e2',tieu_de:'Cuối kỳ Python',che_do:'that',khoi:9,lop:'9A',trang_thai:'mo',questions:2,total:0,vao:0,nop:0,tao_luc:'a',noi_dung:'tn_th',thuc_hanh:THP}];
const fdb={thi_hs:{hs01:{ma:'hs01',ten:'Nguyễn An',lop:'9A',khoi:9},hs02:{ma:'hs02',ten:'Trần Bình',lop:'9A',khoi:9}},thi_nop:{e1:{hs01:{ma:'hs01',diem:8,tong:10,at:1},hs02:{ma:'hs02',diem:6,tong:10,at:2}},e2:{hs01:{ma:'hs01',diem:9,tong:10,at:1},hs02:{ma:'hs02',diem:5,tong:10,at:2}}},thi_th:{e1:{hs01:{ten_file:'bai-an.xlsx'},hs02:{ten_file:'bai-binh.xlsx'}},e2:{hs01:{ten_file:'tong.py'},hs02:{ten_file:'loi.py'}}}};
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';
 if(p.startsWith('/pyodide/')){const f=path.join(PYO,p.slice(9));if(!fs.existsSync(f)){r.statusCode=404;return r.end()}r.setHeader('content-type',{'.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'}[path.extname(f)]||'application/octet-stream');r.setHeader('access-control-allow-origin','*');return r.end(fs.readFileSync(f));}
 const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 let body=fs.readFileSync(f);if(p==='/presence-config.js')body=Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${FDB}'};`);if(p==='/sheet-config.js')body=Buffer.from(`export const SHEET_API = '${API}';`);
 if(p==='/practical.js')body=Buffer.from(body.toString().replace("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/","http://localhost:8203/pyodide/").replace('runPython(code, kt.a)','runPython(code, kt.a, 30000)'));
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(body)}).listen(8203);
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
try{const ctx=await b.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const calls=[],ai=[];
 await pg.route(API,r=>{const p=JSON.parse(r.request().postData());calls.push(p);const j=x=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
  if(p.action==='gv_th_get'){const f=FILES[p.ma_de+'|'+p.ma];return j({ok:true,hs:{ma:p.ma},file:{...f,mime:'x'},thuc_hanh:EX.find(e=>e.ma_de===p.ma_de).thuc_hanh,cham:null});}
  if(p.action==='gv_th_save')return j({ok:true,diem:p.chi_tiet.reduce((a,x)=>a+x.diem,0),tong:4});
  j({ok:true,fb:true,exams:EX,bank:{9:3},classes:{'9A':9}})});
 await pg.route(FDB+'/**',r=>{const parts=new URL(r.request().url()).pathname.replace(/\.json$/,'').split('/').filter(Boolean);const v=parts.reduce((o,k)=>o==null?undefined:o[k],fdb)??null;
  if((r.request().headers()['accept']||'').includes('text/event-stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:`retry: 300\nevent: put\ndata: ${JSON.stringify({path:'/',data:v})}\n\n`});r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)})});
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};if(u.endsWith('/pwa/catalog'))body={courses:[]};if(u.endsWith('/teacher/students'))body=[];
  if(u.endsWith('/teacher/ai-practical')){ai.push(JSON.parse(r.request().postData()));body={items:[{diem:0,nhan_xet:'a'},{diem:0,nhan_xet:'b'},{diem:0.75,nhan_xet:'Trình bày gọn'}],tong_ket:'Em làm tốt phần công thức.'};}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.goto('http://localhost:8203/teacher.html');await pg.waitForTimeout(400);await pg.fill('#teacher-login [name=pin]',PIN);await pg.click('#teacher-login button[type=submit]');await pg.waitForSelector('#workspace:not([hidden])');
 // 1. Tạo bài thi thật có thực hành: nhập tiêu chí, kiểm tra hợp lệ
 await pg.click('#nav-sheetexam');await pg.click('#tab-thi-new');await pg.selectOption('#thi-new-mode','that');ok(await pg.isHidden('#thi-th-fields'),'trắc nghiệm: không có phần thực hành');
 await pg.selectOption('#thi-new-nd','tn_th');ok(await pg.isVisible('#thi-th-fields')&&await pg.locator('#thi-th-list .thi-th-row').count()===1,'chọn Trắc nghiệm + Thực hành → hiện đề + tiêu chí chấm');
 await pg.fill('#thi-new-title','Cuối kỳ mới');await pg.click('#thi-new-create');await pg.waitForTimeout(150);ok((await pg.getAttribute('#thi-th-de','aria-invalid'))==='true'&&!calls.some(c=>c.action==='gv_create'),'thiếu đề thực hành → báo dưới trường');
 await pg.fill('#thi-th-de','Tính tổng cột D');await pg.fill('#thi-th-list .th-mo','D11 dùng SUM');await pg.selectOption('#thi-th-list .th-kt','excel_value');
 ok((await pg.textContent('#thi-th-list .th-fa label')).includes('Ô (ví dụ D11)'),'chọn kiểu kiểm tra → nhãn tham số đổi theo');
 await pg.fill('#thi-th-list .th-a','D11');await pg.click('#thi-new-create');await pg.waitForTimeout(150);ok((await pg.textContent('#thi-gv-status')).includes('kết quả mong đợi'),'thiếu kết quả mong đợi → báo');
 await pg.fill('#thi-th-list .th-b','120');await pg.click('#thi-th-add');await pg.fill('#thi-th-list .thi-th-row >> nth=1 >> .th-mo','Trình bày');await pg.fill('#thi-th-list .thi-th-row >> nth=1 >> .th-diem','1.5');
 ok((await pg.textContent('#thi-th-total')).includes('2.5'),'tổng điểm thực hành tự cộng');
 await pg.click('#thi-new-create');await pg.waitForTimeout(300);const cr=calls.find(c=>c.action==='gv_create');
 ok(cr&&cr.noi_dung==='tn_th'&&cr.thuc_hanh.de==='Tính tổng cột D'&&cr.thuc_hanh.tieu_chi.length===2&&cr.thuc_hanh.tieu_chi[0].kt.type==='excel_value'&&cr.thuc_hanh.tieu_chi[0].kt.b==='120'&&cr.thuc_hanh.tieu_chi[1].kt===null&&cr.thuc_hanh.tieu_chi[1].diem===1.5,'gửi Google Sheet: đề + tiêu chí + kiểm tra tự động');
 // 2. Chấm Excel: máy đọc file thật
 await pg.click('#tab-thi-list');await pg.click('#thi-list article:has-text("Cuối kỳ Excel") .t-icon-btn[aria-label^="Thống kê"]');await pg.click('#tab-thi-td');await pg.waitForSelector('.th-grade-btn');
 await pg.click('li:has-text("Nguyễn An") .th-grade-btn');await pg.waitForSelector('#th-dialog[open]');await pg.waitForFunction(()=>document.querySelectorAll('#th-items .th-item').length===3,null,{timeout:10000});
 const it=await pg.$$eval('#th-items .th-item',a=>a.map(x=>({c:x.className,t:x.textContent,v:x.querySelector('.th-score').value})));
 ok(it[0].c.includes('is-ok')&&it[0].t.includes('ĐẠT')&&it[0].v==='2'&&it[1].c.includes('is-ok')&&it[1].t.includes('D11 = 120')&&it[1].v==='1'&&it[2].c.includes('is-manual')&&it[2].v==='','Excel: máy đọc file thật — D11 có SUM, bằng 120 → đạt, điền sẵn điểm; tiêu chí chấm tay để trống');
 ok((await pg.textContent('#th-preview')).includes('D11: =SUM(D2:D10) → 120')&&(await pg.textContent('#th-preview')).includes('C11: Tổng'),'xem bài làm: các ô kèm công thức (đọc cả chữ trong sharedStrings)');
 await pg.click('#th-ai');await pg.waitForFunction(()=>document.querySelector('#th-items .th-item:nth-child(3) .th-score').value==='0.75');
 const a0=ai[0];ok(a0.kind==='excel'&&a0.rubric.length===3&&a0.auto.length===2&&a0.auto[0].ok===true&&a0.evidence.includes('=SUM(D2:D10)')&&!JSON.stringify(a0).includes('"120"}'),'AI nhận bằng chứng + kết quả máy kiểm tra, không nhận kết quả mong đợi');
 ok(await pg.inputValue('#th-items .th-item:nth-child(1) .th-score')==='2'&&(await pg.inputValue('#th-nhanxet')).includes('công thức')&&(await pg.textContent('#th-sum')).includes('3.75 / 4'),'AI chỉ gợi ý tiêu chí chấm tay; giữ kết quả máy; điền nhận xét chung');
 await pg.fill('#th-items .th-item:nth-child(3) .th-score','5');await pg.click('#th-save');ok((await pg.textContent('#th-err')).includes('từ 0 đến 1'),'điểm vượt tối đa → báo');
 await pg.fill('#th-items .th-item:nth-child(3) .th-score','1');await pg.click('#th-save');await pg.waitForFunction(()=>!document.getElementById('th-dialog').open);
 const sv=calls.find(c=>c.action==='gv_th_save');ok(sv.ma==='hs01'&&sv.chi_tiet.map(x=>x.diem).join()==='2,1,1'&&sv.nhan_xet.includes('công thức'),'lưu điểm thực hành giáo viên đã duyệt');
 ok((await pg.textContent('li:has-text("Nguyễn An") .th-grade-btn')).includes('4/4'),'danh sách hiện điểm thực hành đã chấm');
 await pg.click('li:has-text("Trần Bình") .th-grade-btn');await pg.waitForFunction(()=>document.querySelectorAll('#th-items .th-item').length===3);
 const it2=await pg.$$eval('#th-items .th-score',a=>a.map(x=>x.value));ok(it2[0]==='0'&&it2[1]==='0'&&(await pg.textContent('#th-items')).includes('mong đợi 120'),'Excel sai (không dùng SUM, tổng 100) → CHƯA ĐẠT, 0 điểm, nêu lý do');
 await pg.click('#th-cancel');
 // 3. Chấm Python: chạy mã thật trong Pyodide
 if(havePy){await pg.click('#act-sheetexam-back');await pg.click('#thi-list article:has-text("Cuối kỳ Python") .t-icon-btn[aria-label^="Thống kê"]');await pg.click('#tab-thi-td');await pg.waitForSelector('li:has-text("Nguyễn An") .th-grade-btn');
  await pg.click('li:has-text("Nguyễn An") .th-grade-btn');await pg.waitForFunction(()=>document.querySelectorAll('#th-items .th-item').length===2,null,{timeout:90000});
  const p=await pg.$$eval('#th-items .th-item',a=>a.map(x=>({c:x.className,t:x.textContent})));ok(p[0].c.includes('is-ok')&&p[0].t.includes('Kết quả đúng')&&p[1].c.includes('is-ok'),'Python: chạy mã thật với 3, 4 → in 7 (đúng); có dùng input()');
  await pg.click('#th-cancel');
  await pg.click('li:has-text("Trần Bình") .th-grade-btn');await pg.waitForFunction(()=>document.querySelectorAll('#th-items .th-item').length===2,null,{timeout:90000});
  const q=await pg.$$eval('#th-items .th-item',a=>a.map(x=>({c:x.className,t:x.textContent})));ok(q[0].c.includes('is-bad')&&q[0].t.includes('quá lâu')&&q[1].c.includes('is-bad')&&!errs.length,'Python vòng lặp vô hạn → dừng sau thời hạn, CHƯA ĐẠT (không treo trình duyệt); không dùng input() → chưa đạt');
  await pg.click('#th-cancel');
 } else console.log('(bỏ qua kiểm thử chạy Python)');
 ok(errs.length===0,'không có lỗi JS '+errs.join('|'));
 console.log('PRACTICAL GRADING OK',n)}finally{await b.close();srv.close()}})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
