// Mở link trong Zalo/Facebook → màn hình "Mở bằng trình duyệt"; bảng cài đặt đúng thiết bị; gợi ý cài CHỈ khi máy chưa cài.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8224);
const UA={
 zaloAndroid:'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Zalo android/12100533 ZaloTheme/light ZaloLanguage/vn',
 zaloIOS:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/24.04.01 ZaloTheme/light ZaloLanguage/vn',
 fb:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/455.0]',
 chromeAndroid:'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
 safariIOS:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
 desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
 const open=async(ua,w=390,extra={})=>{const c=await b.newContext({viewport:{width:w,height:800},userAgent:ua,serviceWorkers:'block',isMobile:w<700&&!/Windows/.test(ua),hasTouch:w<700,...extra});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await c.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await p.goto('http://localhost:8224/');await p.waitForSelector('#gate:not([hidden])');return {c,p,errs};};
 const fireBIP=p=>p.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.__prompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
 try{
  // 1) Zalo Android
  let {c,p,errs}=await open(UA.zaloAndroid);
  ok(await p.isVisible('#browser-gate')&&(await p.textContent('#bg-title')).includes('Mở AI Học Tập bằng trình duyệt'),'Zalo Android: hiện màn hình "Mở AI Học Tập bằng trình duyệt"');
  ok((await p.textContent('.bg-lead')).includes('Zalo')&&(await p.textContent('.bg-primary'))==='Mở bằng Chrome','nói rõ đang mở trong Zalo, nút "Mở bằng Chrome"');
  const intent=await p.evaluate(async()=>(await import('./install.js')).chromeIntentUrl(new URL('https://aihoctap.online/?a=1#x')));
  ok(intent==='intent://aihoctap.online/?a=1#x#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Faihoctap.online%2F%3Fa%3D1%23x;end','link mở Chrome giữ nguyên đúng trang, có đường dự phòng');
  await p.click('.bg-secondary');ok(await p.locator('#browser-gate').count()===0,'"Ở lại trình duyệt hiện tại" → đóng, dùng tiếp');
  await p.reload();await p.waitForSelector('#gate:not([hidden])');ok(await p.locator('#browser-gate').count()===0,'đã chọn ở lại → không hỏi lại trong lần mở này');
  await p.click('#install');await p.waitForSelector('#install-help-dialog[open]');ok((await p.textContent('#install-help-dialog')).includes('không cài được ứng dụng'),'trong Zalo bấm Cài app → hướng dẫn mở bằng trình duyệt');
  ok(await p.locator('#install-nudge').count()===0,'trong Zalo không hiện thẻ gợi ý cài');ok(errs.length===0,'không lỗi script '+errs.join('|'));await c.close();
  // 2) Zalo iPhone, Facebook
  ({c,p,errs}=await open(UA.zaloIOS));ok((await p.textContent('.bg-primary'))==='Mở bằng Safari','Zalo iPhone: nút "Mở bằng Safari"');await c.close();
  ({c,p,errs}=await open(UA.fb));ok(await p.isVisible('#browser-gate')&&(await p.textContent('.bg-lead')).includes('Facebook'),'mở trong Facebook cũng được nhắc');await c.close();
  // 3) Chrome Android: chưa cài → trình duyệt báo beforeinstallprompt → gợi ý "Cài"
  ({c,p,errs}=await open(UA.chromeAndroid));
  ok(await p.locator('#browser-gate').count()===0,'Chrome thật: không hiện màn hình mở trình duyệt');
  await p.waitForTimeout(500);ok(await p.locator('#install-nudge').count()===0,'chưa có tín hiệu "chưa cài" → không làm phiền');
  await fireBIP(p);await p.waitForSelector('#install-nudge',{timeout:4000});
  ok((await p.textContent('#install-nudge .in-go'))==='Cài','trình duyệt báo máy chưa cài → hiện gợi ý "Cài AI Học Tập lên máy"');
  await p.click('#install-nudge .in-go');await p.waitForTimeout(300);ok(await p.evaluate(()=>window.__prompted===true),'bấm Cài → mở hộp cài đặt chính thức của trình duyệt');
  ok(await p.locator('#install-nudge').count()===0,'cài xong → thẻ gợi ý biến mất');
  await p.click('#install');await p.waitForSelector('#install-help-dialog[open]');ok((await p.textContent('#install-help-dialog')).includes('Đã cài xong'),'bảng cài báo đã cài xong');await p.keyboard.press('Escape');
  await c.close();
  // 4) "Để sau" nhớ 7 ngày
  ({c,p,errs}=await open(UA.chromeAndroid));await fireBIP(p);await p.waitForSelector('#install-nudge',{timeout:4000});await p.click('#install-nudge .in-later');
  await p.reload();await p.waitForSelector('#gate:not([hidden])');await fireBIP(p);await p.waitForTimeout(2000);ok(await p.locator('#install-nudge').count()===0,'"Để sau" → không nhắc lại (7 ngày)');
  await p.click('#install');await p.waitForSelector('#install-help-dialog[open]');ok(await p.isVisible('.ins-primary')&&(await p.textContent('.ins-primary'))==='Cài ngay','vẫn cài được bằng nút trên thanh trên: "Cài ngay"');await c.close();
  // 5) iPhone Safari: không biết đã cài hay chưa → nhắc nhẹ, có "Em đã cài rồi"
  ({c,p,errs}=await open(UA.safariIOS));await p.waitForSelector('#install-nudge',{timeout:5000});ok((await p.textContent('#install-nudge .in-go'))==='Xem cách cài','iPhone Safari: gợi ý "Xem cách cài"');
  await p.click('#install-nudge .in-go');await p.waitForSelector('#install-help-dialog[open]');const g=await p.textContent('#install-help-dialog');
  ok(g.includes('Chia sẻ')&&g.includes('Thêm vào MH chính')&&await p.locator('.ins-steps li').count()===3,'hướng dẫn iPhone 3 bước có hình: Chia sẻ → Thêm vào MH chính → Thêm');
  const dl=await p.evaluate(()=>{const r=document.getElementById('install-help-dialog').getBoundingClientRect();return {b:Math.round(innerHeight-r.bottom),w:Math.round(r.width)}});ok(dl.b<=1&&dl.w===390,'điện thoại: bảng trượt từ dưới lên, rộng hết màn hình');
  await p.click('.ins-secondary');await p.reload();await p.waitForSelector('#gate:not([hidden])');await p.waitForTimeout(3000);ok(await p.locator('#install-nudge').count()===0,'"Em đã cài rồi" → không nhắc nữa');await c.close();
  // 6) Đang mở bằng app (standalone)
  const c6=await b.newContext({viewport:{width:390,height:800},userAgent:UA.chromeAndroid,serviceWorkers:'block'});await c6.addInitScript(()=>{const o=window.matchMedia.bind(window);window.matchMedia=q=>{const r=o(q);if(q==='(display-mode: standalone)')Object.defineProperty(r,'matches',{value:true});return r;};});
  const p6=await c6.newPage();await c6.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await p6.goto('http://localhost:8224/');await p6.waitForSelector('#gate:not([hidden])');
  await fireBIP(p6);await p6.waitForTimeout(2000);ok(await p6.locator('#install').isHidden()&&await p6.locator('#install-nudge').count()===0&&(await p6.textContent('#install-label'))==='Đang dùng ứng dụng','đang dùng app: ẩn nút cài, không gợi ý');await c6.close();
  // 7) Máy tính
  ({c,p,errs}=await open(UA.desktop,1280));await p.click('#install');await p.waitForSelector('#install-help-dialog[open]');ok((await p.textContent('#install-help-dialog')).includes('thanh địa chỉ'),'máy tính: hướng dẫn biểu tượng cài trên thanh địa chỉ');
  ok(errs.length===0,'không lỗi script');await c.close();
  console.log('INSTALL BROWSER OK',n);
 }finally{await b.close();srv.close();}})().catch(e=>{console.error(e);process.exit(1)});
