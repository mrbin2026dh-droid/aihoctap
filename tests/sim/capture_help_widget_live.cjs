// @ts-check
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../docs/handoff/anh/ho-so-du-thi-30-10');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  console.log('--- CHỤP ẢNH TRỢ GIÚP NHANH (NHÓM PHÁT TRIỂN) TRÊN AIHOCTAP.ONLINE (390x844) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('1. Đang truy cập https://aihoctap.online...');
  await page.goto('https://aihoctap.online/', { waitUntil: 'networkidle' });

  console.log('2. Mở khung Trợ giúp nhanh qua nút #help-fab...');
  await page.waitForSelector('#help-fab', { timeout: 15000 });
  await page.click('#help-fab');
  await page.waitForSelector('#help-panel:not([hidden])', { timeout: 8000 });

  console.log('3. Chọn tab Phát triển và câu hỏi nhân rộng...');
  await page.click('.help-tab >> text=Phát triển');
  await page.waitForTimeout(400);

  await page.click('.help-chip >> text=Có nhân rộng cho trường khác được không?');
  await page.waitForFunction(() => document.querySelector('.help-log')?.textContent.includes('Google Sheet'), null, { timeout: 8000 });
  await page.waitForTimeout(600);

  const shotPath = path.join(OUT_DIR, '01_tro_giup_nhanh_phat_trien_mobile.png');
  await page.screenshot({ path: shotPath });
  console.log(`-> Đã chụp ảnh thành công: ${shotPath}`);

  await browser.close();
  console.log('HOÀN TẤT CHỤP ẢNH TRỢ GIÚP NHANH!');
})().catch(e => {
  console.error('Lỗi chụp ảnh:', e);
  process.exit(1);
});
