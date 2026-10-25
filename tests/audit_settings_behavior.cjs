// Claude audit harness (Playwright, API mock). Run: NODE_PATH=$(npm root -g) node tests/audit_settings_behavior.cjs ; mong muon: group list visible on open = true (mobile), lock POST count = 1, history length tang khi mo Cai dat.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=fs.existsSync("/mnt/user-data/uploads/AI AGENT SGK/frontend/hoc") ? "/mnt/user-data/uploads/AI AGENT SGK/frontend/hoc" : path.resolve(__dirname, '../frontend/hoc');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.statusCode=404;return r.end()}
const t={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(f)]||'application/octet-stream';r.setHeader('content-type',t);r.end(fs.readFileSync(f))}).listen(8123);
(async()=>{const b=await chromium.launch();const out=[];const log=(k,v)=>{out.push(k+': '+v);console.log(k+': '+v)};
for(const vp of [{width:390,height:800},{width:1280,height:800}]){
const ctx=await b.newContext({viewport:vp});const pg=await ctx.newPage();const reqs=[];
await pg.addInitScript(()=>{sessionStorage.setItem('aisgk-pwa-teacher','tok');sessionStorage.setItem('aisgk-pwa-teacher-must-change','false');window.__native=0;window.confirm=()=>{window.__native++;return true};window.prompt=()=>{window.__native++;return 'x'}});
await pg.route('**/api/**',async r=>{const u=new URL(r.request().url());const m=r.request().method();reqs.push(m+' '+u.pathname);
let body={};const p=u.pathname;if(p.endsWith('/pwa/catalog'))body={courses:[]};if(p.endsWith('/teacher/results'))body={attempts:[]};
if(p.endsWith('/teacher/students')&&m==='GET')body=[{id:'hs01',name:'Nguyen Van A',grade:9,class_code:'9A',disabled:false}];
if(p.endsWith('/ai-settings'))body={settings:{default_limit:10,exam_mode:false}};
await new Promise(s=>setTimeout(s,m==='GET'?0:600));
r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8123/teacher.html');await pg.waitForTimeout(800);
const tag=vp.width+'px ';
log(tag+'pageerrors',JSON.stringify(errs));
log(tag+'open-settings visible',await pg.isVisible('#open-settings'));
const rows=await pg.locator('.row-actions').count();log(tag+'row-actions',rows);
if(rows){await pg.locator('.row-actions summary').first().click();
 await pg.getByRole('button',{name:'Khóa',exact:true}).first().click();await pg.waitForTimeout(200);
 log(tag+'dialog open',await pg.evaluate(()=>document.getElementById('msg-dialog')?.open));
 log(tag+'focus on',await pg.evaluate(()=>document.activeElement?.id));
 reqs.length=0;await pg.keyboard.press('Escape');await pg.waitForTimeout(300);log(tag+'esc requests',reqs.filter(x=>!x.startsWith('GET')).length);
 await pg.locator('.row-actions summary').first().click();await pg.getByRole('button',{name:'Khóa',exact:true}).first().click();await pg.waitForTimeout(200);
 await pg.click('#msg-ok');
 // double-click attempt: reopen quickly during pending
 await pg.waitForTimeout(100);
 const _open2=await pg.evaluate(()=>document.querySelector('.row-actions')?.open);
 await pg.locator('.row-actions summary').first().click().catch(()=>{});
 await pg.getByRole('button',{name:'Khóa',exact:true}).first().click({timeout:1500}).catch(()=>{});
 await pg.waitForTimeout(300);
 const dlg2=await pg.evaluate(()=>document.getElementById('msg-dialog')?.open);
 if(dlg2)await pg.click('#msg-ok').catch(()=>{});
 await pg.waitForTimeout(1500);
 log(tag+'lock POST count (want 1)',reqs.filter(x=>x.includes('/lock')).length);
 log(tag+'native dialogs',await pg.evaluate(()=>window.__native));}
// settings nav
await pg.click('#open-settings');await pg.waitForTimeout(200);
log(tag+'settings visible',await pg.isVisible('#settings'),'workspace hidden',!(await pg.isVisible('#workspace')));
log(tag+'overflowX',await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
log(tag+'detail visible without choosing',await pg.evaluate(()=>[...document.querySelectorAll('.settings-detail > *')].filter(e=>e.offsetParent).length));
const hist0=await pg.evaluate(()=>history.length);
if(vp.width<960){log(tag+'mobile: group list visible on open',await pg.isVisible('.settings-menu'))}
await pg.locator('.settings-menu .group-link').nth(1).click({timeout:2000}).catch(()=>log(tag+'group-link click','FAILED not visible'));await pg.waitForTimeout(200);
log(tag+'history length unchanged (no back support)',hist0===await pg.evaluate(()=>history.length));
try { fs.mkdirSync('/tmp/claude-0/pw', { recursive: true }); await pg.screenshot({path:`/tmp/claude-0/pw/t${vp.width}.png`}); } catch {}
await ctx.close()}
await b.close();srv.close()})();
