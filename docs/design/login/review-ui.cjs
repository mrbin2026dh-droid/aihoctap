const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const dir=__dirname;
const views=[['student-login.html',''],['student-account.html',''],['teacher-login.html',''],['teacher-change-pin.html',''],['teacher-change-pin.html','#change-pin-section']];
const sizes=[[320,568],[360,640],[375,667],[390,844],[412,915],[430,932],[600,960],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[1920,1080],[2560,1440],[640,360],[844,390],[360,320]];
const required={
 'student-login.html':['login-dialog','login-title','login-help','login-form','login-error','close-login'],
 'student-account.html':['account-info','account-must-change','student-change-pin-form','student-change-pin-status','logout'],
 'teacher-login.html':['auth-section','teacher-login'],
 'teacher-change-pin.html':['teacher-must-change-section','teacher-must-change-form','teacher-must-change-error','change-pin-section','teacher-regular-change-pin-form','teacher-change-pin-status']
};
const report={date:'2026-10-25',scope:'Static mockups only',engines:[],layouts:[],stress:[],keyboard:[],contracts:[],screenshots:[],notTested:['Physical iOS/Android devices','Safari/WebKit and Firefox','Screen-reader announcements','Backend/authentication','Full WCAG conformance or Lighthouse','Claude ACCEPT']};
async function inspect(page,context){
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const m=await page.evaluate(()=>{
  const visible=x=>x.getClientRects().length>0&&getComputedStyle(x).visibility!=='hidden';
  const touch=[...document.querySelectorAll('button,input,summary')].filter(visible).map(x=>({id:x.id||x.tagName,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height,font:parseFloat(getComputedStyle(x).fontSize),tag:x.tagName}));
  const clips=[...document.querySelectorAll('h1,h2,h3,p,label,button,#account-info')].filter(visible).filter(x=>x.clientWidth>0&&x.scrollWidth>x.clientWidth+2).map(x=>x.id||x.tagName);
  return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,touch,clips,samplesVisible:[...document.querySelectorAll('.samples')].some(visible)};
 });
 if(m.scrollWidth>m.width){console.error(context,await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(x=>x.getClientRects().length&&(x.getBoundingClientRect().right>innerWidth||x.scrollWidth>x.clientWidth+2)).map(x=>({tag:x.tagName,id:x.id,cls:x.className,w:x.clientWidth,sw:x.scrollWidth,rect:x.getBoundingClientRect().toJSON(),position:getComputedStyle(x).position,display:getComputedStyle(x).display}))));await page.screenshot({path:path.join(dir,'review-overflow-debug.png'),fullPage:true});} assert(m.scrollWidth<=m.width,context+': horizontal overflow '+m.scrollWidth);
 assert.deepEqual(m.touch.filter(x=>x.w<48||x.h<48||x.tag==='INPUT'&&x.font<16),[],context+': target or input too small');
 assert.deepEqual(m.clips,[],context+': clipped text');
 assert(!m.samplesVisible,context+': developer samples visible');
 return {width:m.width,scrollWidth:m.scrollWidth,minTarget:Math.min(...m.touch.map(x=>Math.min(x.w,x.h)))};
}
(async()=>{
for(const [name,executablePath]of [['Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['Edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
 let browser;try{browser=await chromium.launch({executablePath,headless:true})}catch(e){report.launchFailures=report.launchFailures||[];report.launchFailures.push({name,error:e.message.split('\n')[0]});continue;}report.engines.push({name,version:browser.version()});const page=await browser.newPage();const navigate=async url=>{await page.goto(url);await page.reload()};let external=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external++});
 for(const [file,hash]of views){const url=pathToFileURL(path.join(dir,file)).href+hash;
  for(const [width,height]of sizes){await page.setViewportSize({width,height});await navigate(url);const context=`${name} ${file}${hash} ${width}x${height}`;const result=await inspect(page,context);const card=page.locator('dialog:visible');assert(await card.count()===1,context+': expected one visible panel');assert((await card.boundingBox()).width<=420.1,context+': card exceeds max width');
   if(file==='teacher-change-pin.html'){assert.equal(await page.locator('#change-pin-section').isVisible(),!!hash);assert.equal(await page.locator('#teacher-must-change-section').isVisible(),!hash)}
   assert.equal(await page.locator('.eyebrow:visible').count(),0);report.layouts.push({browser:name,file,hash,width,height,...result});
   if(name==='Chrome'&&(width===360&&height===640||width===1280&&height===800||width===640&&height===360&&file==='student-login.html')){const filename=`review-${file.replace('.html','')}${hash?'-regular':''}-${width}x${height}.png`;await page.screenshot({path:path.join(dir,filename),fullPage:true});report.screenshots.push(filename)}
  }
  for(const width of [320,360,768,1280]){await page.setViewportSize({width,height:640});await navigate(url);if(file==='student-account.html')await page.locator('#account-info').evaluate(x=>x.textContent='HọVàTênMẫuRấtDàiKhôngCóKhoảngTrắng'.repeat(6)+' · Lớp thử nghiệm');
   await page.evaluate(()=>{const values=[...document.querySelectorAll('body,body *')].filter(x=>!['SCRIPT','STYLE'].includes(x.tagName)).map(x=>[x,parseFloat(getComputedStyle(x).fontSize)]);values.forEach(([x,size])=>x.style.fontSize=(size*2)+'px')});report.stress.push({browser:name,file,hash,fontScale:2,...await inspect(page,`${name} ${file} 200% ${width}`)});
  }
  await page.setViewportSize({width:360,height:640});await navigate(url);
  const ids=required[file];for(const id of ids)assert.equal(await page.locator('#'+id).count(),1);
  const dom=await page.evaluate(()=>{
   const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
   return {duplicates:ids.filter((x,i)=>ids.indexOf(x)!==i),missingLabels:[...document.querySelectorAll('input')].filter(x=>!document.querySelector(`label[for="${x.id}"]`)).map(x=>x.id),missingReferences:[...document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls]')].flatMap(x=>['aria-labelledby','aria-describedby','aria-controls'].flatMap(a=>(x.getAttribute(a)||'').split(/\s+/).filter(Boolean).filter(id=>!document.getElementById(id))))};
  });assert.deepEqual(dom,{duplicates:[],missingLabels:[],missingReferences:[]});
  const expected=await page.locator('input:visible,button:visible').evaluateAll(xs=>xs.filter(x=>!x.disabled).map(x=>x.id||x.textContent.trim()));const actual=[];
  for(let i=0;i<expected.length;i++){await page.keyboard.press('Tab');const focused=await page.evaluate(()=>{const x=document.activeElement;const s=getComputedStyle(x),parent=x.closest('.pin-wrap');return {id:x.id||x.textContent.trim(),visibleFocus:parseFloat(s.outlineWidth)>=2||(parent&&parseFloat(getComputedStyle(parent).outlineWidth)>=2)}});actual.push(focused.id);assert(focused.visibleFocus,`${name} ${file}: missing focus ring`)}assert.deepEqual(actual,expected,`${name} ${file}: tab order`);report.keyboard.push({browser:name,file,hash,tabStops:actual.length,focusVisible:true});
  const expectedNames=file==='student-login.html'?['code','pin']:file==='teacher-login.html'?['pin']:['old_pin','new_pin','confirm_pin'];const form=page.locator('form:visible');assert.deepEqual(await form.locator('input').evaluateAll(xs=>xs.map(x=>x.name)),expectedNames);assert.equal(await form.getAttribute('method'),'dialog');
  for(const input of await form.locator('input').all()){const n=await input.getAttribute('name');if(n!=='code'){assert.equal(await input.getAttribute('type'),'password');assert.equal(await input.getAttribute('autocomplete'),n==='new_pin'||n==='confirm_pin'?'new-password':'current-password')}}
  if(file==='student-login.html'){assert.equal(await form.locator('[name=code]').getAttribute('pattern'),'[A-Za-z0-9_-]{1,64}');assert.equal(await form.locator('[name=code]').getAttribute('autocomplete'),'username')}
  if(file.startsWith('student-'))for(const input of await form.locator('input[type=password]').all()){assert.equal(await input.getAttribute('inputmode'),'numeric');assert.equal(await input.getAttribute('maxlength'),'16')}
  if(file.includes('account')||file.includes('change-pin'))assert.equal(await form.locator('[name=new_pin]').getAttribute('minlength'),file.includes('account')?'6':'8');
  const toggles=await page.locator('button[data-reveal]:visible').all();for(const toggle of toggles){const input=page.locator('#'+await toggle.getAttribute('data-reveal'));await toggle.click();assert.equal(await input.getAttribute('type'),'text');assert.equal(await toggle.getAttribute('aria-pressed'),'true');await toggle.click();assert.equal(await input.getAttribute('type'),'password');assert.equal(await toggle.getAttribute('aria-pressed'),'false')}
  report.contracts.push({browser:name,file,hash,ids:true,labels:true,attributes:true,toggleButtons:toggles.length});
  // Sample text and alerts are rendered only through the documented design fragment.
  if(!hash){await navigate(pathToFileURL(path.join(dir,file)).href+'#design-states');assert(await page.locator('.samples:visible').count()>0);await page.locator('details').evaluateAll(xs=>xs.forEach(x=>x.open=true));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  // High-contrast and reduced-motion emulation: structure and focus stay usable.
  await navigate(url);await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await inspect(page,`${name} ${file} forced colors`);await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
 }
 assert.equal(external,0);assert.deepEqual(errors,[]);await browser.close();fs.writeFileSync(path.join(dir,'review-checks.json'),JSON.stringify(report,null,2),'utf8');
}
fs.writeFileSync(path.join(dir,'review-checks.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({engines:report.engines,layouts:report.layouts.length,stress:report.stress.length,keyboard:report.keyboard.length,contractGroups:report.contracts.length,launchFailures:report.launchFailures||[],screenshots:report.screenshots.length,notTested:report.notTested},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
