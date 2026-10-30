// @ts-check
const path = require('path');
if (process.env.APPDATA) {
  module.paths.push(path.join(process.env.APPDATA, 'npm', 'node_modules'));
}
const { chromium } = require('playwright');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../docs/handoff/anh/mo-phong-30-10');

(async () => {
  console.log('=== CHỤP MÀN HÌNH GIÁO VIÊN THẬT (HTTPS://AIHOCTAP.ONLINE/TEACHER.HTML) ===');
  console.log('Mục tiêu lưu ảnh tại:', OUT_DIR);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Đang khởi chạy trình duyệt Chrome để Thầy đăng nhập...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1366,868', '--start-maximized']
  });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 868 } });
  const page = await ctx.newPage();
  await page.goto('https://aihoctap.online/teacher.html', { waitUntil: 'domcontentloaded' });
  await page.bringToFront();

  console.log('\n=============================================================');
  console.log('>>> THẦY HÃY NHÌN VÀO CỬA SỔ TRÌNH DUYỆT CHROME ĐANG MỞ:');
  console.log('>>> 1. Nhập Mã PIN giáo viên của Thầy.');
  console.log('>>> 2. Bấm nút "Đăng nhập".');
  console.log('>>> Hệ thống sẽ tự động phát hiện đăng nhập và chụp 4 màn hình thật!');
  console.log('=============================================================\n');

  // Chờ tối đa 20 phút để Thầy đăng nhập
  const startWait = Date.now();
  let loggedIn = false;
  while (Date.now() - startWait < 1200000) {
    const isVisible = await page.evaluate(() => {
      const ed = document.getElementById('editor');
      return ed && !ed.hidden && getComputedStyle(ed).display !== 'none';
    }).catch(() => false);

    if (isVisible) {
      loggedIn = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  if (!loggedIn) {
    console.error('Hết thời gian chờ đăng nhập (20 phút). Dừng script.');
    await browser.close();
    process.exit(1);
  }

  console.log('>>> ĐÃ ĐĂNG NHẬP THÀNH CÔNG! ĐANG TỰ ĐỘNG CHỤP 4 ẢNH LỚP 9TH...');
  await page.waitForTimeout(2500);

  // 1. TỔNG QUAN LỚP 9TH
  console.log('\n[1/4] Chụp Tổng quan lớp 9TH...');
  await page.click('#nav-overview');
  await page.waitForTimeout(1000);
  
  try {
    await page.waitForSelector('#overview-class', { timeout: 10000 });
    await page.waitForFunction(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('overview-class'));
      return sel && sel.options.length > 1;
    }, { timeout: 15000 });
    
    const val9TH = await page.evaluate(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('overview-class'));
      for (const opt of Array.from(sel.options)) {
        if (opt.value === '9TH' || opt.text.includes('9TH')) return opt.value;
      }
      return null;
    });

    if (val9TH) {
      await page.selectOption('#overview-class', val9TH);
      console.log(`   Đã chọn lớp: ${val9TH}`);
    }
  } catch (err) {
    console.warn('   Lưu ý chọn lớp Tổng quan:', err.message);
  }

  await page.waitForTimeout(3000);
  const overviewEl = await page.$('#list-overview');
  if (overviewEl) {
    await overviewEl.screenshot({ path: path.join(OUT_DIR, '01_tong_quan_lop_9TH.png') });
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, '01_tong_quan_lop_9TH.png') });
  }
  console.log('   -> Đã lưu 01_tong_quan_lop_9TH.png');

  // 2. HỌC SINH ĐỌC BÀI (BÀI 1, LỚP 9TH)
  console.log('\n[2/4] Chụp Học sinh đọc bài lớp 9TH...');
  try {
    await page.evaluate(() => {
      const el = document.getElementById('read-report');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    const readLopVal = await page.evaluate(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('read-lop'));
      if (!sel) return null;
      for (const opt of Array.from(sel.options)) {
        if (opt.value === '9TH' || opt.text.includes('9TH')) return opt.value;
      }
      return null;
    });
    if (readLopVal) {
      await page.selectOption('#read-lop', readLopVal);
      console.log(`   Đã chọn #read-lop: ${readLopVal}`);
      await page.waitForTimeout(2000);
    }

    const lessonVal = await page.evaluate(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('read-lesson'));
      if (!sel || sel.options.length === 0) return null;
      for (const opt of Array.from(sel.options)) {
        if (opt.value.includes('bai-1') || opt.text.includes('kĩ thuật số') || opt.text.includes('Bài 1')) return opt.value;
      }
      return sel.options[0]?.value || null;
    });
    if (lessonVal) {
      await page.selectOption('#read-lesson', lessonVal);
      console.log(`   Đã chọn #read-lesson: ${lessonVal}`);
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.warn('   Lưu ý chọn lớp/bài đọc:', err.message);
  }

  const readEl = await page.$('#read-report');
  if (readEl) {
    await readEl.screenshot({ path: path.join(OUT_DIR, '02_hoc_sinh_doc_bai_9TH.png') });
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, '02_hoc_sinh_doc_bai_9TH.png') });
  }
  console.log('   -> Đã lưu 02_hoc_sinh_doc_bai_9TH.png');

  // 3. TÀI KHOẢN LỚP 9TH
  console.log('\n[3/4] Chụp Tài khoản lớp 9TH...');
  await page.click('#nav-accounts');
  await page.waitForTimeout(1000);

  try {
    await page.waitForSelector('#acc-hs-lop', { timeout: 10000 });
    const accLopVal = await page.evaluate(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('acc-hs-lop'));
      if (!sel) return null;
      for (const opt of Array.from(sel.options)) {
        if (opt.value === '9TH' || opt.text.includes('9TH')) return opt.value;
      }
      return null;
    });
    if (accLopVal) {
      await page.selectOption('#acc-hs-lop', accLopVal);
      console.log(`   Đã chọn #acc-hs-lop: ${accLopVal}`);
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.warn('   Lưu ý lọc lớp Tài khoản:', err.message);
  }

  const accEl = await page.$('#view-accounts');
  if (accEl) {
    await accEl.screenshot({ path: path.join(OUT_DIR, '03_tai_khoan_lop_9TH.png') });
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, '03_tai_khoan_lop_9TH.png') });
  }
  console.log('   -> Đã lưu 03_tai_khoan_lop_9TH.png');

  // 4. HIỆU QUẢ LỚP 9TH
  console.log('\n[4/4] Chụp Hiệu quả lớp 9TH...');
  await page.click('#nav-effect');
  await page.waitForTimeout(1000);

  try {
    await page.waitForSelector('#eff-lop', { timeout: 10000 });
    const effLopVal = await page.evaluate(() => {
      const sel = /** @type {HTMLSelectElement} */ (document.getElementById('eff-lop'));
      if (!sel) return null;
      for (const opt of Array.from(sel.options)) {
        if (opt.value === '9TH' || opt.text.includes('9TH')) return opt.value;
      }
      return null;
    });
    if (effLopVal) {
      await page.selectOption('#eff-lop', effLopVal);
      console.log(`   Đã chọn #eff-lop: ${effLopVal}`);
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    console.warn('   Lưu ý lọc lớp Hiệu quả:', err.message);
  }

  const effEl = await page.$('#view-effect');
  if (effEl) {
    await effEl.screenshot({ path: path.join(OUT_DIR, '04_hieu_qua_lop_9TH.png') });
  } else {
    await page.screenshot({ path: path.join(OUT_DIR, '04_hieu_qua_lop_9TH.png') });
  }
  console.log('   -> Đã lưu 04_hieu_qua_lop_9TH.png');

  console.log('\n=== HOÀN TẤT CHỤP 4 ẢNH MÀN GIÁO VIÊN THẬT 100%! ===');
  await browser.close();
})();
