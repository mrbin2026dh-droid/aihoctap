import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.NODE_PATH
  ? path.join(process.env.NODE_PATH, 'playwright')
  : 'C:/Users/HPZBook/Desktop/CVA_KYSO/node_modules/playwright';
const { chromium } = require(fs.existsSync(playwrightPath) ? playwrightPath : 'playwright');

const BASE_URL = 'https://mrbin2026dh-droid.github.io/aihoctap';

async function seedStudentSession(page) {
  await page.addInitScript(() => {
    const req = indexedDB.open('aisgk-student-pwa', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['meta', 'packages', 'drafts', 'outbox']) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({
        token: 'mock-smoke-token',
        identity: {
          student_id: 'hs_thu1',
          student_name: 'Nguyen Van A',
          grade: 9,
          class_code: '9A',
          must_change_pin: false
        }
      }, 'session');
    };
  });
}

async function run() {
  console.log('=== REAL SMOKE TEST (S2–S5) ON GITHUB PAGES ===\n');
  const browser = await chromium.launch({ headless: true });

  // [S2] Clean browser context
  console.log('[S2] Testing Clean Browser Load & Console Errors...');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const res = await page.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    assert.strictEqual(res.status(), 200, 'Page must return HTTP 200');
    assert.strictEqual(pageErrors.length, 0, `Page errors found: ${pageErrors.join(', ')}`);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    assert(manifestHref.includes('manifest.webmanifest'), 'Manifest link must exist');

    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg);
    });
    console.log(`  PASS [S2]: Status=${res.status()}, PageErrors=0, SW Registered=${swRegistered}`);
    await ctx.close();
  }

  // [S3] Settings Version & Manual Check Update Dialog
  console.log('[S3] Testing Settings Version Display & Check Update Dialog (open twice)...');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await seedStudentSession(page);

    // Load 1: Install SW
    await page.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
    });

    // Load 2: Reload so controller is active
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    // Open Settings
    await page.click('#open-settings');
    await page.waitForTimeout(300);

    // Open Help panel
    await page.click('button.group-link[data-view="help"]');
    await page.waitForTimeout(300);

    // Wait for version text from SW postMessage
    await page.waitForFunction(() => {
      const el = document.getElementById('app-version');
      return el && el.textContent && el.textContent.trim().length > 0 && el.textContent !== '—';
    }, { timeout: 5000 }).catch(() => {});

    const versionText = await page.locator('#app-version').textContent();
    console.log(`  Version text displayed: "${versionText}"`);
    assert.strictEqual(versionText, 'a353e588', 'App version must match last 8 chars of live CACHE');

    // Click check update button
    await page.click('#check-update');
    await page.waitForTimeout(400);

    const dialogOpen = await page.evaluate(() => document.getElementById('msg-dialog')?.open);
    const dialogTitle = await page.locator('#msg-title').textContent();
    const dialogBody = await page.locator('#msg-body').textContent();
    console.log(`  Update dialog open=${dialogOpen}, title="${dialogTitle}", body="${dialogBody}"`);
    assert.strictEqual(dialogOpen, true, 'Check update must open modal dialog');
    assert(dialogTitle.includes('bản mới nhất') || dialogBody.includes('bản mới nhất'), 'Dialog title/body must state app is up to date');
    assert(dialogBody.includes('a353e588'), 'Dialog body must show accurate version');

    await page.click('#msg-ok');
    console.log('  PASS [S3]: Version text matches a353e588 & check-update modal confirmed.');
    await ctx.close();
  }

  // [S4] Mobile Settings Navigation & Account/Offline
  console.log('[S4] Testing Mobile Settings Navigation (List -> Detail -> Back)...');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    await seedStudentSession(page);

    await page.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle', timeout: 30000 });

    // Open Settings
    await page.click('#open-settings');
    await page.waitForTimeout(300);

    // Mobile: Group menu should be visible
    const menuVisible = await page.isVisible('.settings-menu');
    assert.strictEqual(menuVisible, true, 'Mobile must display group list first on open');

    // Click offline group
    await page.click('button.group-link[data-view="offline"]');
    await page.waitForTimeout(300);
    const offlineVisible = await page.isVisible('#panel-offline');
    assert.strictEqual(offlineVisible, true, 'Offline panel must be visible');

    // Click Back button
    await page.click('#panel-offline button[data-back]');
    await page.waitForTimeout(300);
    const menuVisibleAfterBack = await page.isVisible('.settings-menu');
    assert.strictEqual(menuVisibleAfterBack, true, 'Back button must return to group menu');

    // Click account group
    await page.click('button.group-link[data-view="account"]');
    await page.waitForTimeout(300);
    const changePinFormVisible = await page.isVisible('#student-change-pin-form');
    assert.strictEqual(changePinFormVisible, true, 'Student change PIN form must be visible in account panel');

    console.log('  PASS [S4]: Mobile navigation group -> detail -> back verified.');
    await ctx.close();
  }

  // [S5] Teacher Settings & Action Confirmations
  console.log('[S5] Testing Teacher Workspace & Action Confirmations & Settings...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const reqs = [];

    await page.addInitScript(() => {
      sessionStorage.setItem('aisgk-pwa-teacher', 'mock-smoke-token');
      sessionStorage.setItem('aisgk-pwa-teacher-must-change', 'false');
      window.__nativeAlertCount = 0;
      window.confirm = () => { window.__nativeAlertCount++; return true; };
      window.alert = () => { window.__nativeAlertCount++; };
    });

    // Mock API endpoints
    await page.route('**/api/**', async route => {
      const u = new URL(route.request().url());
      const m = route.request().method();
      reqs.push(`${m} ${u.pathname}`);

      let body = {};
      if (u.pathname.endsWith('/pwa/catalog')) body = { courses: [] };
      if (u.pathname.endsWith('/teacher/results')) body = { attempts: [] };
      if (u.pathname.endsWith('/teacher/students') && m === 'GET') {
        body = [{ id: 'hs01', name: 'Nguyen Van A', grade: 9, class_code: '9A', disabled: false }];
      }
      if (u.pathname.endsWith('/ai-settings')) body = { settings: { default_limit: 10, exam_mode: false } };

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body)
      });
    });

    await page.goto(BASE_URL + '/teacher.html', { waitUntil: 'networkidle', timeout: 30000 });

    // Verify Student Management on Workspace
    const rows = await page.locator('.row-actions').count();
    console.log(`  Student row actions found: ${rows}`);
    assert(rows > 0, 'At least 1 student row must be rendered on workspace');

    // Open action details & click "Khóa"
    await page.locator('.row-actions summary').first().click();
    await page.getByRole('button', { name: 'Khóa', exact: true }).first().click();
    await page.waitForTimeout(300);

    // Verify confirmation modal
    const dialogOpen = await page.evaluate(() => document.getElementById('msg-dialog')?.open);
    const dialogTitle = await page.locator('#msg-title').textContent();
    console.log(`  Lock confirmation dialog open=${dialogOpen}, title="${dialogTitle}"`);
    assert.strictEqual(dialogOpen, true, 'Action must open confirmation dialog');
    assert(dialogTitle.includes('Khóa tài khoản'), 'Dialog title must specify action');

    // Cancel via Escape
    reqs.length = 0;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const nonGetReqsAfterEscape = reqs.filter(r => !r.startsWith('GET'));
    assert.strictEqual(nonGetReqsAfterEscape.length, 0, 'Escape must cancel action with 0 API requests');

    // Reopen and Confirm
    await page.locator('.row-actions summary').first().click();
    await page.getByRole('button', { name: 'Khóa', exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.click('#msg-ok');
    await page.waitForTimeout(500);

    const lockRequests = reqs.filter(r => r.includes('/lock'));
    console.log(`  Lock API requests sent: ${lockRequests.length}`);
    assert.strictEqual(lockRequests.length, 1, 'Confirming lock must send exactly 1 lock request');

    const nativeCalls = await page.evaluate(() => window.__nativeAlertCount);
    assert.strictEqual(nativeCalls, 0, 'Zero native confirm/alert calls allowed');

    // Open Teacher Settings
    await page.click('#open-settings');
    await page.waitForTimeout(300);

    const teacherSettingsVisible = await page.isVisible('#settings');
    assert.strictEqual(teacherSettingsVisible, true, 'Teacher settings panel must be visible');

    // Test navigating to Quota view
    await page.click('button.group-link[data-view="quota"]');
    await page.waitForTimeout(300);
    const quotaVisible = await page.isVisible('#panel-quota');
    assert.strictEqual(quotaVisible, true, 'Quota panel must be visible');

    // Close Settings -> return to workspace
    await page.click('#close-settings');
    await page.waitForTimeout(300);
    const workspaceVisible = await page.isVisible('#workspace');
    assert.strictEqual(workspaceVisible, true, 'Closing settings must return to workspace');

    console.log('  PASS [S5]: Teacher workspace & student lock confirmation & settings navigation verified.');
    await ctx.close();
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('>>> ALL SMOKE TESTS (S2–S5) PASSED 100% ON LIVE DEPLOYMENT! <<<');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
