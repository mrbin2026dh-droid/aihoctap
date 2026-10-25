import https from 'https';
import fs from 'fs';
import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.NODE_PATH
  ? process.env.NODE_PATH + '/playwright'
  : 'C:/Users/HPZBook/Desktop/CVA_KYSO/node_modules/playwright';
const { chromium } = require(fs.existsSync(playwrightPath) ? playwrightPath : 'playwright');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== SMOKE TEST S1 & S2 ON LIVE PAGES ===');
  
  // S2: Check sw.js cache stamp on live site
  const sw = await get('https://mrbin2026dh-droid.github.io/aihoctap/sw.js');
  const m = sw.data.match(/const CACHE = '([^']+)';/);
  const liveCache = m ? m[1] : '';
  console.log('Live SW status:', sw.status);
  console.log('Live SW CACHE:', liveCache);
  assert(liveCache.startsWith('aisgk-student-shell-bf2a34e5'), 'SW cache must start with bf2a34e5');
  console.log('  PASS S2: Live SW cache stamp matches bf2a34e5...');

  // S1: Clean browser context on live site
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('https://mrbin2026dh-droid.github.io/aihoctap/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const gateVisible = await page.isVisible('#gate');
  const mainVisible = await page.isVisible('#main');
  const bottomNavVisible = await page.isVisible('.bottom-nav');
  const statusVisible = await page.isVisible('#status');
  const pageText = await page.evaluate(() => document.body.innerText);

  console.log('Gate visible:', gateVisible);
  console.log('Main visible:', mainVisible);
  console.log('BottomNav visible:', bottomNavVisible);
  console.log('Has lesson text:', /Hôm nay|Môn học/.test(pageText));

  assert.strictEqual(gateVisible, true, 'Gate must be visible');
  assert.strictEqual(mainVisible, false, 'Main content must be hidden');
  assert.strictEqual(bottomNavVisible, false, 'Bottom nav must be hidden');
  assert.strictEqual(statusVisible, false, 'Status bar must be hidden');
  assert.strictEqual(/Hôm nay|Môn học/.test(pageText), false, 'No lesson text must be leaked');

  const teacherLinkHref = await page.locator('#gate-teacher').getAttribute('href');
  console.log('Teacher link href:', teacherLinkHref);
  assert.strictEqual(teacherLinkHref, './teacher.html', 'Teacher link must point to ./teacher.html');

  console.log('  PASS S1: Clean browser context shows login gate only; lessons hidden.');

  await browser.close();
  console.log('\n>>> S1 & S2 PASSED 100% ON LIVE DEPLOYMENT! <<<');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
