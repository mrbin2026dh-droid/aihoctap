// Kiểm định chuẩn giao diện học sinh: cỡ chữ, vùng chạm, tràn ngang, tương phản (sáng và tối), nhiều khổ màn hình.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_student_ui_standard.cjs   (SHOTS=thư_mục để lưu ảnh; REPORT=1 để in vi phạm)
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../frontend/hoc');const SHOTS=process.env.SHOTS||'';const REPORT=process.env.REPORT==='1';
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
r.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[path.extname(f)]||'x');r.end(fs.readFileSync(f))}).listen(8151);
const B='http://localhost:8151';
const MIN_TEXT=+(process.env.MIN_TEXT||14), MIN_BODY=16;
function scan(MIN_TEXT){
  const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[,\s/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
  const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const over=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
  const bgOf=el=>{let layers=[];for(let n=el;n;n=n.parentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break}}
    let base=parse(getComputedStyle(document.documentElement).backgroundColor);if(!base||base.a===0)base={r:255,g:255,b:255,a:1};if(layers.length&&layers[layers.length-1].a>=1)base=layers.pop();
    for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return base};
  const out={small:[],contrast:[],targets:[],overflow:document.documentElement.scrollWidth>innerWidth+1};
  const vis=el=>{const r=el.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||n.hidden||s.opacity==='0')return false}return true};
  const name=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'');
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const seen=new Set();
  for(let t=walker.nextNode();t;t=walker.nextNode()){const el=t.parentElement;if(!el||seen.has(el)||!t.textContent.trim()||!vis(el))continue;seen.add(el);
    if(el.closest('.visually-hidden,dialog:not([open])'))continue;const s=getComputedStyle(el);const fs=parseFloat(s.fontSize);
    if(fs>0&&fs<MIN_TEXT)out.small.push(name(el)+' '+fs+'px "'+t.textContent.trim().slice(0,24)+'"');
    const fg=parse(s.color);if(fg){const bg=bgOf(el);const f=fg.a<1?over(fg,bg):fg;const L1=lum(f),L2=lum(bg);const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
      const large=fs>=24||(fs>=18.66&&parseInt(s.fontWeight)>=700);if(ratio<(large?3:4.5)&&!el.disabled)out.contrast.push(name(el)+' '+ratio.toFixed(2)+' "'+t.textContent.trim().slice(0,20)+'"')}}
  for(const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=tab]')){if(!vis(el))continue;const host=(el.type==='radio'||el.type==='checkbox')?(el.closest('label')||el):el;const r=host.getBoundingClientRect();if(r.height<44||r.width<44)out.targets.push(name(el)+' '+Math.round(r.width)+'x'+Math.round(r.height))}
  return out;}
(async()=>{const b=await chromium.launch();let bad=0;const summary=[];
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v);
const LESSON={schema_version:1,course_id:'tin-hoc-9',lesson_id:'b1',title:'Thế giới kĩ thuật số',content_markdown:'# Thế giới kĩ thuật số\n\nDữ liệu là các giá trị được máy tính lưu trữ và xử lý.\n\n- Thông tin\n- Dữ liệu',questions:[{id:'q1',prompt:'Dữ liệu nào sau đây là dữ liệu số?',kind:'choice',options:{A:'Tiếng nói trực tiếp',B:'Tệp ảnh trên máy tính',C:'Mùi hương',D:'Cảm xúc'},hint:'Nghĩ về thứ máy tính lưu được.'}]};
LESSON.version=require('crypto').createHash('sha256').update(JSON.stringify(sortKeys(LESSON))).digest('hex');
const CAT={schema_version:1,revision:'r1',courses:[{id:'tin-hoc-9',subject_id:'tin-hoc',subject_name:'Tin học',title:'Tin học 9',grade:9,lessons:[{id:'b1',title:'Thế giới kĩ thuật số',version:LESSON.version,question_count:4},{id:'b2',title:'Thực hành: Xử lý dữ liệu bảng tính nâng cao',version:'99a19c1',question_count:4}]}]};
for(const scheme of ['light','dark'])for(const vp of [{w:360,h:740},{w:390,h:844},{w:768,h:1024},{w:1280,h:800}]){
 const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h},serviceWorkers:'block',colorScheme:scheme});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route('**/api/**',r=>{const u=new URL(r.request().url()).pathname;let body=CAT;if(!u.endsWith('catalog')&&!u.endsWith('/login')&&!u.endsWith('/pwa/me'))body={attempts:[],results:[],items:[]};if(u.endsWith('/login'))body={token:'t',must_change_pin:false};if(u.endsWith('/pwa/me'))body={uid:'hs01',student_name:'Nguyễn Văn Nam',class_code:'9A',grade:9};if(u.includes('/pwa/lessons/'))body=LESSON;
 r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
 await pg.goto(B+'/');await pg.waitForTimeout(500);const T=`${scheme} ${vp.w}`;const res={};
 const grab=async n=>{res[n]=await pg.evaluate(scan,MIN_TEXT);if(SHOTS)await pg.screenshot({path:`${SHOTS}/${scheme}-${vp.w}-${n}.png`,fullPage:false})};
 await grab('gate');
 await pg.click('#gate-student');await pg.waitForTimeout(200);await grab('login');await pg.fill('#student-code','hs01');await pg.fill('#student-pin','123456');await pg.click('#login-form button[type=submit]');await pg.waitForTimeout(1000);
 await grab('catalog');
 for(const tab of ['practice','downloads','progress','materials']){const btn=pg.locator(`[data-tab="${tab}"]`).first();if(await btn.isVisible()){await btn.click();await pg.waitForTimeout(250);await grab(tab)}}
 const lessonBtn=pg.locator('[data-tab="catalog"]').first();if(await lessonBtn.isVisible()){await lessonBtn.click();await pg.waitForTimeout(200)}
 const open=pg.locator('.lesson-open').first();if(await open.count()&&await open.isVisible()){await open.click();await pg.waitForTimeout(500);await grab('lesson');const ex=pg.getByRole('button',{name:'Làm bài tập'});if(await ex.count()){await ex.first().click();await pg.waitForTimeout(300);await grab('exercise');await pg.locator('input[type=radio]').first().check({force:true}).catch(()=>{})}
  const tu=pg.locator('#open-tutor,.tutor-btn').first();if(await tu.count()&&await tu.isVisible()){await tu.click();await pg.waitForTimeout(400);await grab('tutor')}}
 for(const [n,v] of Object.entries(res)){const c=v.small.length+v.contrast.length+v.targets.length+(v.overflow?1:0);summary.push(`${T} ${n}: chữ nhỏ ${v.small.length}, tương phản ${v.contrast.length}, vùng chạm ${v.targets.length}, tràn ngang ${v.overflow?'CÓ':'không'}`);bad+=c;
  if(REPORT&&c){console.log('--',T,n);for(const k of ['small','contrast','targets'])if(v[k].length)console.log(' ',k,[...new Set(v[k])].slice(0,12).join(' | '))}}
 assert.strictEqual(errs.length,0,T+' lỗi trang: '+errs.join(';'));await ctx.close()}
console.log(summary.join('\n'));console.log('TỔNG VI PHẠM:',bad);await b.close();srv.close();process.exit(bad?1:0)})().catch(e=>{console.error(e);process.exit(1)});
