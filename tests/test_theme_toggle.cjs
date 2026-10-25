// Nút giao diện sáng/tối: đổi nền, nhớ lựa chọn; nút hiện/ẩn PIN dùng biểu tượng và đổi tên truy cập. Chạy: NODE_PATH=$(npm root -g) node tests/test_theme_toggle.cjs
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8162);
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block',colorScheme:'light'});const pg=await ctx.newPage();
await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"courses":[]}'}));
await pg.goto('http://localhost:8162/teacher.html');await pg.waitForTimeout(500);
await pg.fill('#teacher-pin','abc');await pg.click('.t-reveal');assert.strictEqual(await pg.getAttribute('#teacher-pin','type'),'text');assert.strictEqual(await pg.getAttribute('.t-reveal','aria-label'),'Ẩn mã PIN');
await pg.goto('http://localhost:8162/');await pg.waitForTimeout(600);
assert.strictEqual(await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor!=='rgb(15, 21, 19)'),true);
const bg0=await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor);
await pg.click('#theme-toggle');await pg.waitForTimeout(200);
const bg1=await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor);assert.notStrictEqual(bg0,bg1,'đổi nền');
assert.strictEqual(await pg.evaluate(()=>document.documentElement.dataset.theme),'dark');
await pg.reload();await pg.waitForTimeout(500);assert.strictEqual(await pg.evaluate(()=>document.documentElement.dataset.theme),'dark','nhớ lựa chọn');
await pg.click('#theme-toggle');assert.strictEqual(await pg.evaluate(()=>document.documentElement.dataset.theme),'light');
console.log('theme toggle OK',bg0,bg1);await b.close();srv.close()})().catch(e=>{console.error(e);process.exit(1)})
