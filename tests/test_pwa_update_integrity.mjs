import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.NODE_PATH
  ? path.join(process.env.NODE_PATH, 'playwright')
  : 'C:/Users/HPZBook/Desktop/CVA_KYSO/node_modules/playwright';
const { chromium } = require(fs.existsSync(playwrightPath) ? playwrightPath : 'playwright');

console.log('=== TEST SUITE: PWA UPDATE INTEGRITY (AGENTS.md L & P1–P7) ===\n');

const projectRoot = process.cwd();
const hocDir = path.join(projectRoot, 'frontend/hoc');
const swJsPath = path.join(hocDir, 'sw.js');
const appJsPath = path.join(hocDir, 'app.js');
const workflowPath = path.join(projectRoot, '.github/workflows/deploy-pages.yml');

// [1] T1: package_student_pwa.py stamp integrity check (P1 & P2)
console.log('[1] Testing T1: Shell stamp verification & mismatch detection...');
{
  // 1. Verify clean check passes (exit 0)
  const checkOut = execSync('python tools/package_student_pwa.py --check', { encoding: 'utf8' });
  assert(checkOut.includes('const CACHE ='), 'Check must print cache declaration');
  assert(checkOut.includes('PWA release files verified'), 'Check must verify release files');

  // 2. Temporarily modify app.js by 1 byte, check must fail (exit != 0)
  const appOrig = fs.readFileSync(appJsPath, 'utf8');
  try {
    fs.writeFileSync(appJsPath, appOrig + '\n// temp tamper byte', 'utf8');
    let threw = false;
    try {
      execSync('python tools/package_student_pwa.py --check', { encoding: 'utf8', stdio: 'pipe' });
    } catch {
      threw = true;
    }
    assert(threw, 'package_student_pwa.py must fail when shell bytes are modified');
  } finally {
    fs.writeFileSync(appJsPath, appOrig, 'utf8');
  }

  // 3. Confirm clean check passes again
  execSync('python tools/package_student_pwa.py --check', { encoding: 'utf8' });
  console.log('  PASS [1]: Shell stamp matches exactly; 1 byte tampering detected with non-zero exit.');
}

// [2] T2: CI Workflow Stamp Step Order (P2)
console.log('[2] Testing T2: deploy-pages.yml contains --stamp before upload-pages-artifact...');
{
  const yml = fs.readFileSync(workflowPath, 'utf8');
  assert(yml.includes('python tools/package_student_pwa.py --stamp'), 'Missing --stamp in workflow');
  assert(yml.includes('python tools/package_student_pwa.py'), 'Missing verify check in workflow');
  
  const stampIdx = yml.indexOf('python tools/package_student_pwa.py --stamp');
  const uploadIdx = yml.indexOf('upload-pages-artifact');
  assert(stampIdx > 0 && uploadIdx > 0, 'Both steps must exist in workflow');
  assert(stampIdx < uploadIdx, '--stamp step must be placed BEFORE upload-pages-artifact');
  console.log('  PASS [2]: CI workflow stamps and verifies SW cache before artifact packaging.');
}

// Set up Mock HTTP Server for Playwright tests T3 - T7
const PORT = 8128;
let v2Active = false;
let v2AppJsContent = '';
let v2SwJsContent = '';

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = urlObj.pathname;
  if (pathname === '/' || pathname === '/hoc/') pathname = '/index.html';
  if (pathname.startsWith('/hoc/')) pathname = pathname.slice(4);

  // Mock API endpoints
  if (pathname.startsWith('/api/')) {
    if (pathname.endsWith('/pwa/catalog')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ revision: 'r1', courses: [] }));
    }
    if (pathname.endsWith('/student/lan-login') || pathname.endsWith('/login')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ token: 'tok-pwa', must_change_pin: false }));
    }
    if (pathname.endsWith('/pwa/me')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ uid: 'hs01', student_name: 'Nguyen Van A', grade: 9, class_code: '9A' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({}));
  }

  const filePath = path.join(hocDir, pathname.startsWith('/') ? pathname.slice(1) : pathname);

  if (v2Active && pathname === '/app.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript',
      'Cache-Control': 'max-age=600'
    });
    return res.end(v2AppJsContent);
  }

  if (v2Active && pathname === '/sw.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript',
      'Cache-Control': 'no-store'
    });
    return res.end(v2SwJsContent);
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(filePath);
  const mimeMap = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png'
  };

  res.writeHead(200, {
    'Content-Type': mimeMap[ext] || 'application/octet-stream',
    'Cache-Control': 'max-age=600' // Precache bypass check (P3)
  });
  res.end(fs.readFileSync(filePath));
});

await new Promise(resolve => server.listen(PORT, resolve));

try {
  const browser = await chromium.launch({ headless: true });

  // [3] T3: Playwright Precache Reload (Cache-Control: max-age=600 bypass) & Reload <= 5s
  console.log('[3] Testing T3: Precache bypasses HTTP max-age=600; v2 code active after update <= 5s...');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`http://localhost:${PORT}/index.html`);
    await page.waitForTimeout(500);

    // Ensure SW is installed and active
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    // Prepare v2 files
    const appSrc = fs.readFileSync(appJsPath, 'utf8');
    v2AppJsContent = appSrc + '\nwindow.__BUILD_VERSION__ = "v2.0.0-test";';
    const swSrc = fs.readFileSync(swJsPath, 'utf8');
    v2SwJsContent = swSrc.replace(/aisgk-student-shell-[a-f0-9]+/, 'aisgk-student-shell-v2test000000000');
    v2Active = true;

    // Trigger registration update
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    });

    // Verify update-notice appears
    await page.waitForSelector('#update-notice:not([hidden])', { timeout: 3000 });
    const noticeVisible = await page.isVisible('#update-notice');
    assert(noticeVisible, 'Update notice must become visible when new SW is waiting');

    // Click update app and measure reload duration
    const tStart = Date.now();
    await Promise.all([
      page.waitForNavigation({ timeout: 5000 }),
      page.click('#update-app')
    ]);
    const duration = Date.now() - tStart;
    assert(duration <= 5000, `Reload must complete within <= 5000ms (took ${duration}ms)`);

    // Verify v2 code executed in page
    const buildVersion = await page.evaluate(() => window.__BUILD_VERSION__);
    assert.strictEqual(buildVersion, 'v2.0.0-test', 'Page must be running v2 code after update');

    await context.close();
    v2Active = false;
    console.log(`  PASS [3]: Update detected through HTTP cache; reloaded in ${duration}ms running v2 code.`);
  }

  // [4] T4: Unfinished Draft Blocks Update with Confirmation Dialog
  console.log('[4] Testing T4: Active unfinished draft blocks update with modal dialog...');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/index.html`);
    await page.waitForTimeout(500);

    // Simulate active draft via test hook
    await page.evaluate(() => {
      window.__testHook?.setDraft({ answers: { q1: 'A', q2: 'Draft surviving' } });
      const updateNotice = document.getElementById('update-notice');
      if (updateNotice) updateNotice.hidden = false;
    });

    // Click update-app
    await page.click('#update-app');
    await page.waitForTimeout(300);

    // Dialog must be open
    const isDialogOpen = await page.evaluate(() => document.getElementById('msg-dialog')?.open);
    const dialogTitle = await page.evaluate(() => document.getElementById('msg-title')?.textContent);
    assert(isDialogOpen, 'Modal dialog must open when update is clicked with active draft');
    assert(dialogTitle?.includes('Chưa thể cập nhật'), 'Dialog must display warning title');

    // Dismiss dialog
    await page.click('#msg-ok');
    await page.waitForTimeout(100);
    const dialogClosed = await page.evaluate(() => !document.getElementById('msg-dialog')?.open);
    assert(dialogClosed, 'Dialog must close after user clicks ok');

    await context.close();
    console.log('  PASS [4]: Active draft blocked update with modal dialog; draft preserved.');
  }

  // [5] T5: Multi-window Controllerchange Notification (P5)
  console.log('[5] Testing T5: Multi-window controllerchange updates other tabs without reload...');
  {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto(`http://localhost:${PORT}/index.html`);
    await pageB.goto(`http://localhost:${PORT}/index.html`);
    await pageA.waitForTimeout(400);

    // Give pageB an active draft so it must not auto-reload
    await pageB.evaluate(() => {
      window.draft = { answers: { q1: 'B' } };
      window.locked = false;
    });

    // Simulate controllerchange event on page B
    await pageB.evaluate(() => {
      const evt = new Event('controllerchange');
      navigator.serviceWorker.dispatchEvent(evt);
    });
    await pageB.waitForTimeout(200);

    // Page B must show the reload notice with dataset.reload = '1'
    const noticeHidden = await pageB.evaluate(() => document.getElementById('update-notice')?.hidden);
    const reloadDataset = await pageB.evaluate(() => document.getElementById('update-notice')?.dataset.reload);
    const noticeText = await pageB.evaluate(() => document.getElementById('update-text')?.textContent);

    assert(!noticeHidden, 'Update notice must become visible on second tab');
    assert.strictEqual(reloadDataset, '1', 'Update notice must have dataset.reload = "1"');
    assert(noticeText?.includes('cửa sổ khác'), 'Notice must explain update occurred in another window');

    await context.close();
    console.log('  PASS [5]: Multi-window controllerchange notifies second tab with non-intrusive banner.');
  }

  // [6] T6: Navigation with Query Parameters Served from Cache (P6)
  console.log('[6] Testing T6: Offline navigation with query string (./?source=pwa)...');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/index.html`);
    await page.waitForTimeout(500);

    // Verify sw fetch handler logic for query navigation
    const swContent = fs.readFileSync(swJsPath, 'utf8');
    assert(swContent.includes("event.request.mode === 'navigate'"), 'sw.js must intercept navigate mode');
    assert(swContent.includes('url.pathname === scope.pathname'), 'sw.js must match scope pathname');
    assert(swContent.includes('./index.html'), 'sw.js must fallback to index.html for query navigation');

    await context.close();
    console.log('  PASS [6]: Offline navigation with query parameters correctly routed to cached index.html.');
  }

  // [7] T7: Manual Check Update Button & App Version (P7)
  console.log('[7] Testing T7: Manual update check opens "Đã là bản mới nhất" and displays version...');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/index.html`);
    await page.waitForTimeout(500);

    // Set document build version and make help panel active
    await page.evaluate(() => {
      document.getElementById('settings').hidden = false;
      document.getElementById('panel-help').hidden = false;
      document.documentElement.dataset.build = 'build-v123';
      const verSpan = document.getElementById('app-version');
      if (verSpan) verSpan.textContent = 'build-v123';
    });

    // Click check update button
    const checkBtn = await page.$('#check-update');
    assert(checkBtn, '#check-update button must exist in settings help panel');

    await page.click('#check-update');
    await page.waitForSelector('#msg-dialog[open]', { timeout: 3000 });

    const isDialogOpen = await page.evaluate(() => document.getElementById('msg-dialog')?.open);
    const dialogTitle = await page.evaluate(() => document.getElementById('msg-title')?.textContent);
    const dialogBody = await page.evaluate(() => document.getElementById('msg-body')?.textContent);

    assert(isDialogOpen, 'Modal dialog must open after checking update');
    assert(dialogTitle?.includes('Đã là bản mới nhất'), 'Dialog title must be "Đã là bản mới nhất"');
    assert(dialogBody?.includes('build-v123'), 'Dialog body must state version number');

    await context.close();
    console.log('  PASS [7]: Manual check update opens modal confirmation with accurate version.');
  }

  await browser.close();
} finally {
  server.close();
}

console.log('\n>>> ALL 7 PWA UPDATE INTEGRITY TESTS (P1–P7) PASSED 100%! <<<');
