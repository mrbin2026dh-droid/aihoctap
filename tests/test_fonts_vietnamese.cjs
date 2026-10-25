// Phông chữ tiếng Việt: không dùng Georgia, có phông tự lưu trữ, đủ dấu, được tiền tải offline. Chạy: NODE_PATH=$(npm root -g) node tests/test_fonts_vietnamese.cjs
const fs=require('fs'),path=require('path'),assert=require('assert');const {chromium}=require('playwright');const http=require('http');
const root=path.resolve(__dirname,'../frontend/hoc');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const tool=fs.readFileSync(path.resolve(__dirname,'../tools/package_student_pwa.py'),'utf8');
assert(!/Georgia/.test(css),'F1 không dùng Georgia (thiếu ế ề ể ễ ệ…)');
assert(/font-family:\s*'SGK Serif'/.test(css)&&/U\+1EA0-1EF9/.test(css),'F2 @font-face SGK Serif phủ U+1EA0-1EF9');
for(const f of ['source-serif-4-latin-wght-normal.woff2','source-serif-4-vietnamese-wght-normal.woff2']){
  assert(fs.existsSync(path.join(root,'fonts',f)),'F3 thiếu '+f);assert(sw.includes('./fonts/'+f),'F4 sw.js chưa tiền tải '+f);assert(tool.includes('fonts/'+f),'F5 công cụ đóng dấu chưa tính '+f);}
assert(fs.existsSync(path.join(root,'fonts','OFL-SourceSerif4.txt')),'F6 giấy phép phông');
for(const f of ['nunito-latin-wght-normal.woff2','nunito-vietnamese-wght-normal.woff2']){assert(fs.existsSync(path.join(root,'fonts',f)),'N1 thiếu '+f);assert(sw.includes('./fonts/'+f),'N2 sw.js chưa tiền tải '+f);assert(tool.includes('fonts/'+f),'N3 công cụ đóng dấu chưa gồm '+f)}
assert(fs.existsSync(path.join(root,'fonts','NUNITO-OFL-LICENSE.txt')),'N4 giấy phép Nunito');
assert(/font-family:\s*'Nunito'/.test(css)&&/U\+1EA0-1EF9/.test(css),'N5 @font-face Nunito phủ tiếng Việt');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8130);
(async()=>{const b=await chromium.launch();try{const pg=await (await b.newContext({serviceWorkers:'block'})).newPage();
await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"courses":[]}'}));
await pg.goto('http://localhost:8130/');await pg.waitForTimeout(500);
const sample='Thế giới kĩ thuật số, Ứng dụng, Điều khiển, Tiếng Việt, ốồổỗộ, ếềểễệ, ờởỡợ, ữựửừ';
const ok=await pg.evaluate(async s=>{const faces=await document.fonts.load('700 32px "SGK Serif"',s);return {n:faces.length,check:document.fonts.check('700 32px "SGK Serif"',s),status:[...document.fonts].filter(f=>f.family.includes('SGK Serif')).map(f=>f.status)}},sample);
assert(ok.n>=1&&ok.check,'F7 trình duyệt nạp được phông cho câu mẫu tiếng Việt: '+JSON.stringify(ok));
console.log('ALL FONT TESTS PASSED');}finally{await b.close();srv.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
