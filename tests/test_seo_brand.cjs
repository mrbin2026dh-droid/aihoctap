// SEO + thương hiệu AI Học Tập: thẻ meta chuẩn (Open Graph, Twitter, canonical, JSON-LD), ảnh/biểu tượng tồn tại đúng kích thước,
// robots + sitemap, trang giáo viên không lập chỉ mục, tên cũ "SGK — Góc học tập" không còn, đăng nhập vẫn hoạt động.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const SITE='https://aihoctap.online/';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
 r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain','.xml':'application/xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8221);
const pngSize=f=>{const b=fs.readFileSync(path.join(root,f));return [b.readUInt32BE(16),b.readUInt32BE(20)]};
(async()=>{const b=await chromium.launch();let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('ok  ',m)};
 try{
  const c=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const bad=[];p.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://localhost'))bad.push(r.status()+' '+r.url())});
  await c.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await p.goto('http://localhost:8221/');await p.waitForSelector('#gate:not([hidden])');
  const meta=await p.evaluate(()=>{const g=s=>document.querySelector(s)?.getAttribute('content')||document.querySelector(s)?.getAttribute('href')||'';return{title:document.title,desc:g('meta[name=description]'),canon:g('link[rel=canonical]'),robots:g('meta[name=robots]'),ogt:g('meta[property="og:title"]'),ogd:g('meta[property="og:description"]'),ogi:g('meta[property="og:image"]'),ogu:g('meta[property="og:url"]'),ogw:g('meta[property="og:image:width"]'),ogh:g('meta[property="og:image:height"]'),oga:g('meta[property="og:image:alt"]'),loc:g('meta[property="og:locale"]'),tc:g('meta[name="twitter:card"]'),ti:g('meta[name="twitter:image"]'),lang:document.documentElement.lang,ld:document.querySelector('script[type="application/ld+json"]')?.textContent||''}});
  ok(meta.title==='AI Học Tập – Gia sư AI gợi mở tư duy cho học sinh THCS'&&meta.title.length<=70,`tiêu đề có thương hiệu, ≤ 70 ký tự (${meta.title.length})`);
  ok(meta.desc.length>=70&&meta.desc.length<=160&&meta.desc.includes('gợi mở'),`mô tả 70–160 ký tự (${meta.desc.length}), nói đúng phương pháp`);
  ok(meta.canon===SITE&&meta.ogu===SITE&&meta.robots.startsWith('index'),'địa chỉ chuẩn (canonical) và og:url là tên miền riêng, cho phép lập chỉ mục');
  ok(meta.ogi===SITE+'seo/og-image.png'&&meta.ti===meta.ogi&&meta.ogw==='1200'&&meta.ogh==='630'&&meta.oga.length>10,'ảnh chia sẻ: đường dẫn tuyệt đối, 1200×630, có mô tả ảnh');
  ok(meta.tc==='summary_large_image'&&meta.loc==='vi_VN'&&meta.lang==='vi'&&meta.ogt&&meta.ogd,'Twitter card ảnh lớn, ngôn ngữ vi / vi_VN');
  const ld=JSON.parse(meta.ld);const app=ld['@graph'].find(x=>x['@type']==='WebApplication');
  ok(app&&app.applicationCategory==='EducationalApplication'&&app.offers.price==='0'&&app.url===SITE&&!JSON.stringify(ld).includes('aggregateRating'),'JSON-LD hợp lệ: ứng dụng giáo dục, miễn phí, không có đánh giá sao bịa');
  ok(JSON.stringify(pngSize('seo/og-image.png'))==='[1200,630]','tệp ảnh chia sẻ đúng 1200×630');
  for(const [f,s] of [['icons/icon-192.png',192],['icons/icon-512.png',512],['icons/maskable-512.png',512],['icons/apple-touch-icon.png',180],['icons/favicon-32.png',32],['icons/favicon-16.png',16]])ok(JSON.stringify(pngSize(f))===JSON.stringify([s,s]),`${f} đúng ${s}×${s}`);
  const man=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  ok(man.short_name==='AI Học Tập'&&man.name.startsWith('AI Học Tập')&&man.icons.some(i=>i.purpose==='maskable')&&man.icons.every(i=>fs.existsSync(path.join(root,i.src))),'manifest: tên AI Học Tập, có biểu tượng maskable, mọi biểu tượng tồn tại');
  for(const u of ['/robots.txt','/sitemap.xml','/favicon.ico','/seo/og-image.png','/seo/hero-multisubject.webp','/brand/logo-symbol.svg','/icons/apple-touch-icon.png']){const r=await p.request.get('http://localhost:8221'+u);ok(r.status()===200,`${u} trả 200`);}
  const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8'),sm=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
  ok(robots.includes('Sitemap: https://aihoctap.online/sitemap.xml')&&robots.includes('Disallow: /teacher.html')&&sm.includes('<loc>https://aihoctap.online/</loc>'),'robots.txt trỏ sitemap, chặn trang giáo viên; sitemap có trang chủ');
  ok((await p.textContent('.wordmark')).trim()==='AI Học Tập'&&await p.isVisible('.wordmark .brand-ic'),'thanh trên: biểu tượng + chữ AI Học Tập');
  ok(await p.evaluate(()=>{const i=document.querySelector('.about-hero');return i.loading==='lazy'&&i.width>0&&i.height>0&&i.alt.length>10}),'ảnh minh họa: tải lười, có kích thước (không giật trang), có mô tả');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8')+fs.readFileSync(path.join(root,'teacher.html'),'utf8');
  ok(!/SGK — Góc|Góc học tập\.|>sgk</.test(html),'không còn tên cũ "SGK — Góc học tập"');
  const tp=await c.newPage();await tp.goto('http://localhost:8221/teacher.html');
  ok((await tp.getAttribute('meta[name=robots]','content'))==='noindex,nofollow'&&(await tp.title())==='Giáo viên – AI Học Tập','trang giáo viên: không cho lập chỉ mục, tiêu đề mới');
  await p.click('#gate-student');await p.waitForSelector('#login-dialog[open]');ok(true,'nút Học sinh vẫn mở ô đăng nhập');
  ok(errs.length===0&&bad.length===0,'không lỗi script, không tệp 404: '+errs.concat(bad).join(' | '));
  console.log('SEO BRAND OK',n);
 }finally{await b.close();srv.close();}})().catch(e=>{console.error(e);process.exit(1)});
