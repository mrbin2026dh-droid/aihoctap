// @ts-check
/**
 * Script theo dõi thực tế phòng treo trên bản thật https://aihoctap.online
 * Tài khoản học sinh THỬ lớp 9TH: TH9001
 * 
 * Cách hoạt động:
 * 1. Học sinh TH9001 đăng nhập trên https://aihoctap.online (khổ điện thoại iPhone 390x844).
 * 2. Chờ Thầy mở Thảo luận hoặc Luyện tập cho lớp 9TH trên trang giáo viên thật.
 * 3. Khi thấy thông báo, học sinh tự động vào phòng và chụp ảnh minh chứng T0 (có gắn đồng hồ hệ thống).
 * 4. Thông báo Thầy đóng trình duyệt (tắt máy/tắt tab mà không bấm Kết thúc).
 * 5. Script theo dõi sự kiện mất nhịp (heartbeat) trong 6 phút.
 * 6. Khi live-room.js phát hiện mất nhịp quá 5 phút, màn hình tự chuyển sang "Phòng ... đã đóng".
 * 7. Tự động chụp ảnh minh chứng T+6 phút (có gắn đồng hồ hệ thống).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../docs/handoff/anh/phong-treo-30-10');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  console.log('================================================================');
  console.log('  THEO DÕI THỰC TẾ PHÒNG TREO TRÊN BẢN THẬT AIHOCTAP.ONLINE');
  console.log('  Tài khoản học sinh: TH9001 (Lớp THỬ 9TH)');
  console.log('================================================================\n');

  const b = await chromium.launch({ headless: false });
  const c = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  const page = await c.newPage();

  console.log('1. Học sinh TH9001 đang truy cập https://aihoctap.online...');
  await page.goto('https://aihoctap.online/');
  await page.waitForSelector('#gate:not([hidden])', { timeout: 15000 });

  await page.click('#gate-student');
  await page.fill('#student-code', 'TH9001');
  await page.fill('#student-pin', process.env.SIM_PIN || (() => { throw new Error('Đặt biến môi trường SIM_PIN (mã PIN tài khoản thử), không ghi PIN vào mã') })());
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#main:not([hidden])', { timeout: 15000 });
  console.log('   -> TH9001 đăng nhập thành công trên bản thật!\n');

  // Hàm thêm widget hiển thị đồng hồ hệ thống lớn trên màn hình để khi chụp ảnh thấy rõ phút/giây
  await page.evaluate(() => {
    const clock = document.createElement('div');
    clock.id = 'live-clock-widget';
    clock.style.position = 'fixed';
    clock.style.bottom = '12px';
    clock.style.right = '12px';
    clock.style.zIndex = '999999';
    clock.style.background = 'rgba(0, 0, 0, 0.85)';
    clock.style.color = '#00ff66';
    clock.style.fontFamily = 'monospace';
    clock.style.fontSize = '16px';
    clock.style.fontWeight = 'bold';
    clock.style.padding = '6px 10px';
    clock.style.borderRadius = '8px';
    clock.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
    document.body.appendChild(clock);
    setInterval(() => {
      const d = new Date();
      clock.textContent = '⏱ ' + d.toLocaleTimeString('vi-VN') + ' (Hệ thống)';
    }, 500);
  });

  console.log('2. ĐANG CHỜ GIÁO VIÊN MỞ PHÒNG THẢO LUẬN HOẶC LUYỆN TẬP CHO LỚP 9TH...');
  console.log('   (Thầy hãy mở trình duyệt giáo viên https://aihoctap.online/teacher.html và mở phòng)');

  // Chờ banner thông báo phòng mở (Thảo luận hoặc Quiz)
  const banner = await Promise.race([
    page.waitForSelector('#tl-banner:not([hidden])', { timeout: 300000 }).then(() => 'tl'),
    page.waitForSelector('#lt-banner:not([hidden])', { timeout: 300000 }).then(() => 'quiz')
  ]).catch(() => null);

  if (!banner) {
    console.log('Hết thời gian chờ (5 phút). Chưa thấy giáo viên mở phòng.');
    await b.close();
    return;
  }

  const typeName = banner === 'tl' ? 'Thảo luận' : 'Luyện tập trực tiếp';
  console.log(`\n3. PHÁT HIỆN GIÁO VIÊN ĐÃ MỞ PHÒNG: ${typeName}!`);
  
  if (banner === 'tl') {
    await page.click('.tl-banner-join');
    await page.waitForSelector('#tl-play:not([hidden])', { timeout: 10000 });
  } else {
    await page.click('.lt-banner-join');
    await page.waitForSelector('#lt-play:not([hidden])', { timeout: 10000 });
  }

  console.log('   -> Học sinh TH9001 đã vào phòng thành công.');
  const timeT0 = new Date().toLocaleTimeString('vi-VN');
  const imgT0 = path.join(OUT_DIR, `01_phong_dang_mo_T0_${banner}.png`);
  await page.screenshot({ path: imgT0 });
  console.log(`   -> Đã chụp ảnh T0: ${imgT0} (Lúc: ${timeT0})\n`);

  console.log('================================================================');
  console.log('  BÂY GIỜ THẦY HÃY ĐÓNG HẲN TRÌNH DUYỆT GIÁO VIÊN!');
  console.log('  (Đóng cửa sổ Chrome giáo viên, TUYỆT ĐỐI KHÔNG BẤM Kết thúc)');
  console.log('================================================================\n');
  console.log('Học sinh đang giữ phòng và theo dõi nhịp heartbeat...');
  console.log('Đếm ngược 6 phút để kiểm tra cơ chế tự đóng phòng treo (timeout 5 phút)...\n');

  // Chờ sự kiện phòng tự đóng (tối đa 7 phút = 420.000 ms)
  const deadSelector = banner === 'tl' ? '#tl-play .lt-big' : '#lt-play .lt-big';
  try {
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.includes('đã đóng');
    }, deadSelector, { timeout: 420000 });

    const timeT6 = new Date().toLocaleTimeString('vi-VN');
    console.log(`\nTHÀNH CÔNG! PHÒNG ĐÃ TỰ ĐỘNG CHUYỂN SANG TRẠNG THÁI "ĐÃ ĐÓNG" LÚC ${timeT6}!`);
    const statusText = await page.textContent(deadSelector);
    console.log(`   Nội dung hiển thị trên màn hình học sinh: "${statusText}"`);

    const imgT6 = path.join(OUT_DIR, `02_phong_tu_dong_T6_${banner}.png`);
    await page.screenshot({ path: imgT6 });
    console.log(`   -> Đã chụp ảnh T+6 phút: ${imgT6} (Lúc: ${timeT6})`);

    // Bấm nút Đóng để kiểm tra quay về bình thường
    if (banner === 'tl') {
      await page.click('#tl-play .lt-done');
      await page.waitForSelector('#tl-play[hidden]', { state: 'attached' });
    } else {
      await page.click('#lt-play .lt-done');
      await page.waitForSelector('#lt-play[hidden]', { state: 'attached' });
    }
    console.log('   -> Đã bấm Đóng, học sinh thoát ra bình thường không bị kẹt!');
  } catch (err) {
    console.error('Lỗi hoặc quá thời gian chờ:', err.message);
  } finally {
    await page.waitForTimeout(2000);
    await b.close();
  }
})();
