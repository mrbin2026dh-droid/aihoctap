// Viền focus phải đạt tương phản ≥ 3:1 (WCAG 2.2 SC 1.4.11) với nền ở chế độ tối và sáng, cả app học sinh và giáo viên.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8193);
const lum=c=>{const [r,g,b]=c.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
(async()=>{const b=await chromium.launch();
for(const scheme of ['light','dark']){const ctx=await b.newContext({viewport:{width:1100,height:800},serviceWorkers:'block',colorScheme:scheme});const pg=await ctx.newPage();
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body={};if(u.endsWith('/teacher/auth'))body={token:'tt',must_change:false};else if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'An',grade:9,class_code:'9A'};else if(u.includes('login'))body={token:'t'};else if(u.endsWith('catalog'))body={schema_version:1,revision:'r',courses:[]};else if(u.endsWith('/pwa/exams'))body={server_now:Date.now(),exams:[]};r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 const check=async(sel,label)=>{await pg.focus(sel);await pg.keyboard.press('Shift+Tab');await pg.keyboard.press('Tab');const o=await pg.evaluate(()=>{const e=document.activeElement;const cs=getComputedStyle(e);let n=e.parentElement,bg='rgba(0, 0, 0, 0)';while(n&&/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bg)){bg=getComputedStyle(n).backgroundColor;n=n.parentElement}return {id:e.id||e.className,color:cs.outlineColor,bg,w:cs.outlineWidth,style:cs.outlineStyle}});
  const r=ratio(o.color,o.bg);assert(o.style==='solid'&&parseFloat(o.w)>=2,`${scheme} ${label}: viền focus ${o.style} ${o.w}`);assert(r>=3,`${scheme} ${label}: tương phản viền focus ${r.toFixed(2)} < 3 (${o.color} trên ${o.bg})`)};
 await pg.goto('http://localhost:8193/');await pg.waitForTimeout(400);await check('#gate-student','học sinh: cổng vào');
 await pg.click('#gate-student');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(700);await check('button[data-tab=exams]','học sinh: thanh tab');
 await pg.goto('http://localhost:8193/teacher.html');await pg.fill('#teacher-login [name=pin]','Mat-khau-thu-1');await pg.click('#teacher-login button[type=submit]');await pg.waitForTimeout(800);if(await pg.locator('dialog[open]').count())await pg.click('dialog[open] #msg-ok');
 await check('#nav-accounts','giáo viên: thanh điều hướng');await pg.click('#nav-exams');await check('#act-exams-new','giáo viên: nút Thêm đề');await ctx.close()}
console.log('FOCUS CONTRAST OK');await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)});
