// @ts-check
/**
 * Script tự động hóa 3 học sinh THỬ lớp 9TH (TH9001, TH9002, TH9003) tham gia Quiz Live trên bản thật https://aihoctap.online
 * Giúp Thầy thử nghiệm nhanh chóng tính năng Bảng thi đua mà không cần mở 3 điện thoại thực tế.
 * 
 * Buổi 1 (3 em tham gia):
 * - TH9001: Trả lời 'A' (Đúng 4/4 câu)
 * - TH9002: Trả lời 'A' câu 1-2, 'B' câu 3-4 (Đúng 2/4 câu)
 * - TH9003: Trả lời 'B' (Đúng 0/4 câu)
 * 
 * Buổi 2 (2 em tham gia: TH9001, TH9002):
 * - TH9001, TH9002 tham gia. TH9003 không vào để kiểm tra trạng thái "Chưa đủ buổi" (1/2 buổi).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../docs/handoff/anh/thi-dua-30-10');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sessionType = process.argv[2] || 'buoi1'; // 'buoi1' hoặc 'buoi2'

(async () => {
  console.log(`================================================================`);
  console.log(`  BẮT ĐẦU CHẠY 3 HỌC SINH THỬ NGHIỆM THI ĐUA TRÊN AIHOCTAP.ONLINE`);
  console.log(`  Chế độ: ${sessionType.toUpperCase()}`);
  console.log(`================================================================\n`);

  const browser = await chromium.launch({ headless: false });

  // Helper login học sinh
  async function setupStudent(code, name, viewport = { width: 390, height: 844 }) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    console.log(`[${code}] Đang đăng nhập https://aihoctap.online...`);
    await page.goto('https://aihoctap.online/');
    await page.waitForSelector('#gate:not([hidden])', { timeout: 20000 });
    await page.click('#gate-student');
    await page.fill('#student-code', code);
    await page.fill('#student-pin', process.env.SIM_PIN || (() => { throw new Error('Đặt biến môi trường SIM_PIN (mã PIN tài khoản thử), không ghi PIN vào mã') })());
    await page.click('#login-form button[type=submit]');
    await page.waitForSelector('#main:not([hidden])', { timeout: 20000 });
    console.log(`[${code}] ${name} đã đăng nhập thành công.`);
    return { context, page, code, name };
  }

  const s1 = await setupStudent('TH9001', 'Học sinh 1');
  const s2 = await setupStudent('TH9002', 'Học sinh 2', { width: 1280, height: 800 });
  let s3 = null;
  if (sessionType === 'buoi1') {
    s3 = await setupStudent('TH9003', 'Học sinh 3');
  }

  console.log('\n--- ĐANG CHỜ GIÁO VIÊN MỞ PHÒNG LUYỆN TẬP CHO LỚP 9TH TRÊN TRÌNH DUYỆT CỦA THẦY ---');
  console.log('Thầy hãy mở https://aihoctap.online/teacher.html và bấm "Mở" phòng Quiz Live lớp 9TH...\n');

  // Chờ banner xuất hiện ở s1
  await s1.page.waitForSelector('#lt-banner:not([hidden])', { timeout: 300000 });
  console.log('-> Đã phát hiện phòng mở! Các học sinh đang vào phòng...');

  await s1.page.click('.lt-banner-join');
  await s2.page.click('.lt-banner-join');
  if (s3) await s3.page.click('.lt-banner-join');

  await s1.page.waitForSelector('#lt-play:not([hidden]) .lt-big');
  console.log('-> Các em đã vào phòng chờ. Thầy hãy bấm "Bắt đầu" trên máy giáo viên!\n');

  // Vòng lặp trả lời câu hỏi tự động
  const handleAnswers = async (s, choiceStrategy) => {
    let qIdx = -1;
    while (true) {
      // Chờ câu hỏi xuất hiện hoặc kết thúc
      const phase = await Promise.race([
        s.page.waitForSelector('#lt-play .lt-opts button:not([disabled])', { timeout: 120000 }).then(() => 'q'),
        s.page.waitForSelector('#lt-play .lt-result.is-end', { timeout: 120000 }).then(() => 'end')
      ]).catch(() => null);

      if (!phase || phase === 'end') break;

      qIdx++;
      const pick = choiceStrategy(qIdx);
      console.log(`   [${s.code}] Đang ở câu ${qIdx + 1}, bấm chọn phương án: ${pick}`);
      await s.page.click(`#lt-play .lt-opt.lt-${pick}`).catch(() => {});
      // Chờ câu hỏi này kết thúc / chuyển sang reveal
      await s.page.waitForSelector('#lt-play .lt-opts button[disabled]', { timeout: 45000 }).catch(() => {});
      await s.page.waitForTimeout(1000);
    }
  };

  const p1 = handleAnswers(s1, () => 'A'); // TH9001 luôn chọn A (đúng hết nếu đáp án là A)
  const p2 = handleAnswers(s2, (i) => i < 2 ? 'A' : 'B'); // TH9002 chọn A 2 câu đầu, B 2 câu sau
  let p3 = Promise.resolve();
  if (s3) {
    p3 = handleAnswers(s3, () => 'B'); // TH9003 luôn chọn B (0 điểm nếu đáp án là A)
  }

  await Promise.all([p1, p2, p3]);
  console.log('\n=== BUỔI LUYỆN TẬP ĐÃ KẾT THÚC ===');
  console.log('Học sinh đang đóng màn hình luyện tập để cập nhật Bảng thi đua...');

  await s1.page.click('#lt-play .lt-done').catch(() => {});
  await s2.page.click('#lt-play .lt-done').catch(() => {});
  if (s3) await s3.page.click('#lt-play .lt-done').catch(() => {});

  await s1.page.waitForTimeout(3000);

  // Mở tab Luyện tập để xem Bảng thi đua
  await s1.page.click('button[data-tab="practice"]');
  await s1.page.waitForSelector('.td-card', { timeout: 15000 });
  const shotS1 = path.join(OUT_DIR, `${sessionType}_TH9001_thi_dua.png`);
  await s1.page.screenshot({ path: shotS1 });
  console.log(`-> Đã lưu ảnh Bảng thi đua TH9001 (khổ điện thoại): ${shotS1}`);

  if (s3) {
    await s3.page.click('button[data-tab="practice"]');
    await s3.page.waitForSelector('.td-card', { timeout: 15000 });
    const shotS3 = path.join(OUT_DIR, `${sessionType}_TH9003_thi_dua.png`);
    await s3.page.screenshot({ path: shotS3 });
    console.log(`-> Đã lưu ảnh Bảng thi đua TH9003 (khổ điện thoại): ${shotS3}`);
  }

  console.log('\nThầy hãy giữ trình duyệt giáo viên để xem tab "Thi đua", tải file CSV và bấm "Chốt tháng"!');
  console.log('Script sẽ giữ trình duyệt 60 giây nữa...');
  await s1.page.waitForTimeout(60000);
  await browser.close();
})().catch(e => {
  console.error('Lỗi tự động học sinh:', e);
  process.exit(1);
});
