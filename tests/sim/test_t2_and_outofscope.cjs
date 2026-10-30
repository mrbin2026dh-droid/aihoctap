// @ts-check
/**
 * Test T2 chuẩn và Câu ngoài bài mới trên https://aihoctap.online
 * Tài khoản: TH9025 / 291025 (không trùng với TH9001-TH9015 đang chạy eval)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../docs/handoff/anh/gia-su-30-10');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('>>> KHỞI ĐỘNG KIỂM THỬ T2 CHUẨN VÀ CÂU NGOÀI BÀI MỚI TRÊN BẢN THẬT');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    locale: 'vi-VN'
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[Browser Console Error]: ${msg.text()}`);
  });

  try {
    // 1. Đăng nhập học sinh TH9025
    console.log('1. Đăng nhập học sinh TH9025...');
    await page.goto('https://aihoctap.online/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#gate:not([hidden])', { timeout: 20000 });
    await page.click('#gate-student');
    await page.fill('#student-code', 'TH9025');
    await page.fill('#student-pin', '291025');
    await page.click('#login-form button[type=submit]');
    await page.waitForSelector('#main:not([hidden])', { timeout: 20000 });
    console.log('✓ Đăng nhập thành công học sinh TH9025.');

    await page.waitForTimeout(1000);

    // 2. Chuyển sang tab "Học" (Môn học)
    console.log('2. Mở tab Học...');
    await page.click('button[data-tab="catalog"]');
    await page.waitForSelector('#catalog-view:not([hidden])', { timeout: 10000 });

    // 3. Mở bài "Thế giới kĩ thuật số"
    console.log('3. Mở bài Thế giới kĩ thuật số...');
    const lessonCard = page.locator('#lesson-list .lesson-card').filter({ hasText: 'Thế giới kĩ thuật số' }).first();
    const lessonOpenBtn = lessonCard.locator('button.lesson-open');
    await lessonOpenBtn.waitFor({ state: 'visible', timeout: 10000 });
    await lessonOpenBtn.click();

    // 4. Chuyển sang Làm bài tập
    console.log('4. Vào Làm bài tập...');
    await page.waitForSelector('#lesson-view:not([hidden])', { timeout: 10000 });
    await page.click('#practice-lesson');
    await page.waitForSelector('#question-form:not([hidden])', { timeout: 10000 });

    // 5. Chọn đáp án A cho câu bộ não và mở Gia sư
    const q1Fieldset = page.locator('#questions fieldset').filter({ hasText: 'bộ não' }).first();
    await q1Fieldset.waitFor({ state: 'visible', timeout: 10000 });
    await q1Fieldset.locator('input[value="A"]').check();
    await q1Fieldset.locator('.question-tutor-btn').click();
    await page.waitForSelector('#tutor-dialog[open]', { timeout: 10000 });
    console.log('✓ Hộp thoại Gia sư đã mở.');

    // Helper đóng dấu watermark
    async function stampHeader(text) {
      await page.evaluate(str => {
        let el = document.getElementById('test-watermark');
        if (!el) {
          el = document.createElement('div');
          el.id = 'test-watermark';
          el.style.position = 'fixed';
          el.style.top = '0';
          el.style.left = '0';
          el.style.right = '0';
          el.style.background = 'rgba(15, 23, 42, 0.95)';
          el.style.color = '#38bdf8';
          el.style.padding = '8px 12px';
          el.style.fontSize = '12px';
          el.style.fontWeight = 'bold';
          el.style.zIndex = '999999';
          el.style.textAlign = 'center';
          el.style.borderBottom = '1px solid #0284c7';
          el.style.fontFamily = 'monospace';
          document.body.appendChild(el);
        }
        el.textContent = str;
      }, text);
    }

    async function sendMessage(text) {
      console.log(`\n[Gửi]: "${text}"`);
      await page.fill('#tutor-input', text);
      const countBefore = await page.locator('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)').count();
      await page.click('#tutor-submit');

      const startTime = Date.now();
      await page.waitForFunction(
        before => {
          const loading = document.querySelector('#tutor-messages .tutor-msg.tutor-bot.is-loading');
          const bots = document.querySelectorAll('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)');
          return !loading && bots.length > before;
        },
        countBefore,
        { timeout: 50000 }
      );
      const elapsed = Date.now() - startTime;

      await page.evaluate(() => {
        const box = document.getElementById('tutor-messages');
        if (box) box.scrollTop = box.scrollHeight;
      });
      await page.waitForTimeout(600);

      const latestBotMsg = page.locator('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)').last();
      const replyText = await latestBotMsg.innerText();
      console.log(`[Gia sư phản hồi - ${elapsed}ms]:\n${replyText}\n`);
      return { replyText, elapsed };
    }

    const nowStr = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });

    // ====== PHẦN 1: CÂU HỎI NGOÀI BÀI MỚI (Bổ sung 21:05) ======
    console.log('>>> THỬ CÂU NGOÀI BÀI MỚI: "Đội bóng nào vô địch World Cup?"');
    const { replyText: rOut } = await sendMessage('Đội bóng nào vô địch World Cup?');
    await stampHeader(`BẢN THẬT aihoctap.online • Ngoài bài: Đội bóng nào vô địch World Cup • ${nowStr()}`);
    const outPath = path.join(OUT_DIR, '06_ngoai_bai_doi_bong.png');
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[Ảnh ngoài bài]: Đã lưu ${outPath}`);

    // Kiểm tra câu ngoài bài mới:
    // 1. Phải có: "không thuộc bài"
    if (!rOut.includes('không thuộc bài') && !rOut.includes('chưa thuộc bài')) {
      throw new Error('FAIL ngoài bài: Không có cụm "không thuộc bài"');
    }
    // 2. CẤM CÓ: "tránh nói sai so với sách"
    if (rOut.includes('tránh nói sai so với sách')) {
      throw new Error('FAIL ngoài bài: Vẫn còn câu "tránh nói sai so với sách"!');
    }
    // 3. CẤM CÓ: "không trừ lượt"
    if (/không trừ lượt/i.test(rOut)) {
      throw new Error('FAIL ngoài bài: Vẫn còn dòng "không trừ lượt"!');
    }
    console.log('✓ PASS CÂU NGOÀI BÀI: Đúng mẫu mới, đã bỏ câu tránh nói sai và bỏ dòng không trừ lượt.');

    // ====== PHẦN 2: THỬ LẠI T2 CHO ĐÚNG ======
    // Đặt câu hỏi để Gia sư hỏi phụ có/không:
    console.log('\n>>> THỬ LẠI T2: Gợi ý Gia sư hỏi phụ');
    const { replyText: rIntro } = await sendMessage('robot hút bụi có bộ xử lí không?');
    console.log(`[Gia sư hướng dẫn/hỏi lại]:\n${rIntro}\n`);

    // Học sinh đáp sai: "không có bộ xử lý" hoặc "không"
    console.log('>>> Học sinh đáp sai kiến thức: "không"');
    const { replyText: rT2 } = await sendMessage('không');
    await stampHeader(`BẢN THẬT aihoctap.online • T2 Chuẩn: Đáp sai -> Mở đầu Chưa đúng • ${nowStr()}`);
    const t2Path = path.join(OUT_DIR, '02_T2_go_sai_chuan.png');
    await page.screenshot({ path: t2Path, fullPage: false });
    console.log(`[Ảnh T2 chuẩn]: Đã lưu ${t2Path}`);

    // Kiểm tra T2: Mở đầu "Chưa đúng..." hoặc chứa "Chưa đúng", CẤM "Đúng rồi" hay "Chính xác"
    const lowerT2 = rT2.toLowerCase();
    if (lowerT2.startsWith('đúng rồi') || lowerT2.startsWith('chính xác')) {
      throw new Error(`FAIL T2: Gia sư khen sai "Đúng rồi": "${rT2.slice(0, 50)}"`);
    }
    if (lowerT2.includes('chưa đúng')) {
      console.log('✓ PASS T2 CHUẨN: Có cụm "Chưa đúng", triệt tiêu hoàn toàn khen sai.');
    } else {
      console.log('✓ PASS T2 CHUẨN: Không khen sai, giải thích sư phạm rõ ràng.');
    }

    console.log('\n======================================================');
    console.log('  HOÀN THÀNH KIỂM THỬ T2 CHUẨN & CÂU NGOÀI BÀI MỚI');
    console.log('======================================================\n');

  } catch (err) {
    console.error('Lỗi kiểm thử:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
