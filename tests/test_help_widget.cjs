// Trợ giúp nhanh (hỏi đáp có sẵn cho ban giám khảo/học sinh) + thẻ đăng nhập nằm chính giữa (học sinh và giáo viên).
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8213);
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};const SHOT=process.env.SHOT;
 try{
  for(const [name,w,h] of [['điện thoại',390,800],['máy tính',1280,800]]){
   const c=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
   await c.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
   await p.goto('http://localhost:8213/');await p.waitForSelector('#gate:not([hidden])');await p.waitForTimeout(400);
   const m=await p.evaluate(()=>{const g=document.querySelector('.gate-card').getBoundingClientRect(),t=document.querySelector('.topbar').getBoundingClientRect(),v=Math.min(innerHeight,document.getElementById('gate').getBoundingClientRect().bottom);return{above:g.top-t.bottom,below:v-g.bottom}});
   ok(Math.abs(m.above-m.below)<=2,`${name}: thẻ đăng nhập nằm chính giữa màn hình đầu (trên ${Math.round(m.above)} = dưới ${Math.round(m.below)})`);
   ok(await p.evaluate(()=>{const a=document.getElementById('about');return a&&getComputedStyle(a).display!=='none'&&a.getBoundingClientRect().top>=innerHeight-1}),`${name}: phần giới thiệu nằm dưới màn hình đầu (cuộn xuống mới thấy)`);
   const fb=await p.$eval('#help-fab',e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height,vis:r.right<=innerWidth&&r.bottom<=innerHeight}});
   ok(fb.w<=48&&fb.h<=48&&fb.w>=44&&fb.vis,`${name}: nút trợ giúp nhỏ gọn ${Math.round(fb.w)}px, nằm trong màn hình`);
   ok(await p.locator('#help-panel').isHidden(),`${name}: khung trợ giúp đóng sẵn`);
   await p.click('#help-fab');await p.waitForSelector('#help-panel:not([hidden])');
   if(SHOT)await p.screenshot({path:`${SHOT}/help-open-${w}.png`});
   const pr=await p.$eval('#help-panel',e=>{const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom}});
   ok(pr.l>=0&&pr.r<=w&&pr.t>=0&&pr.b<=h,`${name}: khung trợ giúp nằm gọn trong màn hình`);
   ok((await p.textContent('.help-log')).includes('Xin chào'),`${name}: có lời chào`);
   ok(await p.locator('.help-tab').count()===4&&await p.locator('.help-chip').count()>=5,`${name}: có 4 nhóm và các câu hỏi gợi ý`);
   await p.click('.help-chip >> nth=0');await p.waitForFunction(()=>document.querySelector('.help-log').textContent.includes('AI Học Tập là gia sư AI'),null,{timeout:3000});
   const log=await p.textContent('.help-log');ok(log.includes('Ứng dụng này là gì?')&&log.includes('AI Học Tập là gia sư AI'),`${name}: bấm câu hỏi → hiện câu trả lời có sẵn`);
   ok(await p.locator('.help-chip.done').count()===1,`${name}: câu đã hỏi được đánh dấu mờ`);
   await p.click('.help-tab >> text=Học sinh');await p.click('.help-chip >> text=Gia sư AI có làm hộ bài không?');await p.waitForFunction(()=>document.querySelector('.help-log').textContent.includes('không đưa đáp án'));
   ok(true,`${name}: nhóm Học sinh trả lời đúng (Gia sư AI không đưa đáp án)`);
   ok((await p.getAttribute('#zalo-help','href')).startsWith('https://zalo.me/')&&await p.isVisible('#zalo-help'),`${name}: có nút nhắn Zalo giáo viên ở cuối khung`);
   if(SHOT)await p.screenshot({path:`${SHOT}/help-chat-${w}.png`});
   await p.keyboard.press('Escape');ok(await p.locator('#help-panel').isHidden()&&await p.evaluate(()=>document.activeElement.id==='help-fab'),`${name}: Esc đóng khung, trả tiêu điểm về nút`);
   await p.click('#help-fab');await p.mouse.click(5,5);ok(await p.locator('#help-panel').isHidden(),`${name}: bấm ra ngoài thì đóng`);
   // giáo viên
   await p.goto('http://localhost:8213/teacher.html');await p.waitForTimeout(600);
   const t=await p.evaluate(()=>{const a=document.querySelector('.t-auth').getBoundingClientRect(),tb=document.querySelector('.t-topbar').getBoundingClientRect();return{above:a.top-tb.bottom,below:innerHeight-a.bottom}});
   ok(Math.abs(t.above-t.below)<=2,`${name}: đăng nhập giáo viên nằm chính giữa (trên ${Math.round(t.above)} = dưới ${Math.round(t.below)})`);
   ok(errs.length===0,`${name}: không lỗi script ${errs.join('|')}`);await c.close();}
  console.log('HELP WIDGET OK',n);
 }finally{await b.close();srv.close();}})().catch(e=>{console.error(e);process.exit(1)});
