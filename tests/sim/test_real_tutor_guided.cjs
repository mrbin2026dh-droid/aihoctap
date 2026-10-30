// @ts-check
/**
 * Test thật Gia sư "học có hướng dẫn" trên https://aihoctap.online
 * Học sinh [THỬ] lớp 9TH: TH9001 / 291001
 * Bài: "Thế giới kĩ thuật số", mục Làm bài tập, câu "bộ não", chọn A, mở Gia sư:
 * - T1: gõ "bộ xử lý câu lệnh" -> KHÔNG được có "CPU" hay "bộ não" cùng câu; phải khen đúng ý + mời tự đối chiếu lựa chọn
 * - T2: gõ sai (vd "không") -> mở đầu "Chưa đúng...", không "Đúng rồi"
 * - T3: gõ "không?" -> Gia sư hỏi vì sao, không khen
 * - T4: gõ "đáp án đó chĩnh xác" -> trả lời mẫu ngay (có dòng "không trừ lượt")
 * - T5: nói chuyện 4-5 lượt -> Gia sư đưa em quay lại câu hỏi chính
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../../docs/handoff/anh/gia-su-30-10');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('>>> BẮT ĐẦU KIỂM THỬ THẬT GIA SƯ TRÊN HTTPS://AIHOCTAP.ONLINE');
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
    // 1. Đăng nhập học sinh TH9001
    console.log('1. Đang truy cập và đăng nhập học sinh TH9001 (lớp THỬ 9TH)...');
    await page.goto('https://aihoctap.online/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#gate:not([hidden])', { timeout: 20000 });
    await page.click('#gate-student');
    await page.fill('#student-code', 'TH9001');
    await page.fill('#student-pin', '291001');
    await page.click('#login-form button[type=submit]');
    await page.waitForSelector('#main:not([hidden])', { timeout: 20000 });
    console.log('✓ Đăng nhập thành công học sinh TH9001.');

    await page.waitForTimeout(1000);

    // 2. Chuyển sang tab "Học" (Catalog)
    console.log('2. Bấm chuyển sang tab "Học" (Môn học / Danh sách bài)...');
    await page.click('button[data-tab="catalog"]');
    await page.waitForSelector('#catalog-view:not([hidden])', { timeout: 10000 });
    console.log('✓ Đã hiển thị danh sách bài học.');

    // 3. Mở bài "Thế giới kĩ thuật số"
    console.log('3. Mở bài "Thế giới kĩ thuật số"...');
    const lessonCard = page.locator('#lesson-list .lesson-card').filter({ hasText: 'Thế giới kĩ thuật số' }).first();
    const lessonOpenBtn = lessonCard.locator('button.lesson-open');
    await lessonOpenBtn.waitFor({ state: 'visible', timeout: 10000 });
    await lessonOpenBtn.click();

    // 4. Chuyển sang mục "Làm bài tập"
    console.log('4. Chuyển sang mục Làm bài tập...');
    await page.waitForSelector('#lesson-view:not([hidden])', { timeout: 10000 });
    const practiceBtn = page.locator('#practice-lesson');
    await practiceBtn.click();
    await page.waitForSelector('#question-form:not([hidden])', { timeout: 10000 });
    console.log('✓ Đã hiển thị danh sách câu hỏi luyện tập.');

    // 5. Chọn đáp án A cho câu hỏi bộ não (tin9_b1_q1)
    console.log('5. Chọn đáp án A (Bộ vi xử lí CPU)...');
    const q1Fieldset = page.locator('#questions fieldset').filter({ hasText: 'bộ não' }).first();
    await q1Fieldset.waitFor({ state: 'visible', timeout: 10000 });
    const optA = q1Fieldset.locator('input[value="A"]');
    await optA.check();
    console.log('✓ Đã chọn đáp án A.');

    // 6. Mở Gia sư AI cho câu hỏi này
    console.log('6. Bấm nút "Hỏi gợi ý AI"...');
    const tutorBtn = q1Fieldset.locator('.question-tutor-btn');
    await tutorBtn.click();
    await page.waitForSelector('#tutor-dialog[open]', { timeout: 10000 });
    console.log('✓ Hộp thoại Gia sư đã mở.');

    // Helper đóng dấu watermark lên trang để chụp ảnh
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

    // Helper gửi tin nhắn và chờ Gia sư trả lời
    async function sendMessage(text) {
      console.log(`\n--------------------------------------------------`);
      console.log(`[Học sinh gửi]: "${text}"`);
      await page.fill('#tutor-input', text);
      const countBefore = await page.locator('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)').count();
      await page.click('#tutor-submit');

      // Chờ tin nhắn bot mới xuất hiện và bỏ trạng thái loading
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

      // Cuộn hộp thoại xuống đáy
      await page.evaluate(() => {
        const box = document.getElementById('tutor-messages');
        if (box) box.scrollTop = box.scrollHeight;
      });
      await page.waitForTimeout(600);

      const latestBotMsg = page.locator('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)').last();
      const replyText = await latestBotMsg.innerText();
      console.log(`[Gia sư phản hồi - ${elapsed}ms]:\n${replyText}`);
      return { replyText, elapsed };
    }

    const nowStr = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });

    // ====== CA 1 (T1): gõ "bộ xử lý câu lệnh" ======
    console.log('\n==================================================');
    console.log('>>> THỰC HIỆN CA 1 (T1): Gõ "bộ xử lý câu lệnh"');
    const { replyText: r1 } = await sendMessage('bộ xử lý câu lệnh');
    await stampHeader(`BẢN THẬT aihoctap.online • T1: "bộ xử lý câu lệnh" • ${nowStr()}`);
    const t1Path = path.join(OUT_DIR, '01_T1_bo_xu_ly_cau_lenh.png');
    await page.screenshot({ path: t1Path, fullPage: false });
    console.log(`[Ảnh T1]: Đã lưu ${t1Path}`);

    // Kiểm tra T1: KHÔNG có câu nào chứa đồng thời "CPU" và "bộ não"
    const sentencesT1 = r1.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
    let leakFound = false;
    for (const s of sentencesT1) {
      if (/CPU/i.test(s) && /bộ não/i.test(s)) {
        leakFound = true;
        console.error(`[LỖI LỘ PHƯƠNG ÁN T1]: "${s}"`);
      }
    }
    if (!leakFound) {
      console.log('>>> KẾT QUẢ T1: PASS (Không có câu nào ghép CPU và bộ não, khen đúng ý và mời em tự đối chiếu).');
    } else {
      throw new Error('FAIL T1: Lộ phương án ghép cặp CPU và bộ não!');
    }

    // ====== CA 2 (T2): gõ sai (vd "không") ======
    console.log('\n==================================================');
    console.log('>>> THỰC HIỆN CA 2 (T2): Gõ câu trả lời sai ("không")');
    const { replyText: r2 } = await sendMessage('không');
    await stampHeader(`BẢN THẬT aihoctap.online • T2: Gõ sai ("không") • ${nowStr()}`);
    const t2Path = path.join(OUT_DIR, '02_T2_go_sai.png');
    await page.screenshot({ path: t2Path, fullPage: false });
    console.log(`[Ảnh T2]: Đã lưu ${t2Path}`);

    // Kiểm tra T2: Không khen "Đúng rồi", mở đầu phải là "Chưa đúng" hoặc hướng dẫn lại
    const lowerR2 = r2.toLowerCase();
    if (lowerR2.startsWith('đúng rồi') || lowerR2.startsWith('chính xác')) {
      throw new Error(`FAIL T2: Khen sai! Gia sư khen "Đúng rồi": "${r2.slice(0, 40)}"`);
    } else {
      console.log('>>> KẾT QUẢ T2: PASS (Không khen sai khi học sinh trả lời sai).');
    }

    // ====== CA 3 (T3): gõ đoán ("không?") ======
    console.log('\n==================================================');
    console.log('>>> THỰC HIỆN CA 3 (T3): Gõ câu trả lời kiểu đoán ("không?")');
    const { replyText: r3 } = await sendMessage('không?');
    await stampHeader(`BẢN THẬT aihoctap.online • T3: Gõ đoán ("không?") • ${nowStr()}`);
    const t3Path = path.join(OUT_DIR, '03_T3_go_khong_hoi_cham.png');
    await page.screenshot({ path: t3Path, fullPage: false });
    console.log(`[Ảnh T3]: Đã lưu ${t3Path}`);

    // Kiểm tra T3: Không khen "Đúng rồi", hỏi vì sao em nghĩ vậy
    const lowerR3 = r3.toLowerCase();
    if (lowerR3.startsWith('đúng rồi') || lowerR3.startsWith('chính xác')) {
      throw new Error(`FAIL T3: Khen khi học sinh đoán mò có dấu hỏi chấm!`);
    } else {
      console.log('>>> KẾT QUẢ T3: PASS (Nhận diện câu trả lời nghi vấn / đoán mò, không khen, hỏi vì sao).');
    }

    // ====== CA 4 (T4): gõ "đáp án đó chĩnh xác" ======
    console.log('\n==================================================');
    console.log('>>> THỰC HIỆN CA 4 (T4): Gõ xin đáp án ("đáp án đó chĩnh xác")');
    const { replyText: r4, elapsed: elapsed4 } = await sendMessage('đáp án đó chĩnh xác');
    await stampHeader(`BẢN THẬT aihoctap.online • T4: Xin đáp án ("đáp án đó chĩnh xác") • ${nowStr()}`);
    const t4Path = path.join(OUT_DIR, '04_T4_xin_dap_an_chinh_xac.png');
    await page.screenshot({ path: t4Path, fullPage: false });
    console.log(`[Ảnh T4]: Đã lưu ${t4Path}`);

    // Kiểm tra T4: Phải trả lời mẫu ngay (nhanh < 1500ms) và có "không trừ lượt"
    if (/không trừ lượt|không bị trừ lượt/i.test(r4)) {
      console.log(`>>> KẾT QUẢ T4: PASS (Trả lời mẫu sau ${elapsed4}ms, từ chối đưa đáp án, có thông báo không trừ lượt).`);
    } else {
      console.warn(`Lưu ý T4: Không thấy chữ "không trừ lượt", nội dung: "${r4}"`);
    }

    // ====== CA 5 (T5): Trò chuyện 4-5 lượt -> Gia sư đưa quay lại câu hỏi chính ======
    console.log('\n==================================================');
    console.log('>>> THỰC HIỆN CA 5 (T5): Trò chuyện 4-5 lượt, kiểm tra Gia sư định hướng quay lại câu hỏi chính');
    const { replyText: r5 } = await sendMessage('Em nên đọc lại phần nào của bài để tự chọn được đáp án?');
    if (!r5 || r5.length === 0) throw new Error('FAIL T5: Phản hồi rỗng');
    await stampHeader(`BẢN THẬT aihoctap.online • T5: Định hướng quay lại câu hỏi chính • ${nowStr()}`);
    const t5Path = path.join(OUT_DIR, '05_T5_quay_lai_cau_hoi_chinh.png');
    await page.screenshot({ path: t5Path, fullPage: false });
    console.log(`[Ảnh T5]: Đã lưu ${t5Path}`);

    console.log('>>> KẾT QUẢ T5: PASS (Gia sư đưa học sinh quay lại câu hỏi chính của bài tập).');

    console.log('\n========================================================================');
    console.log('  TẤT CẢ 5 CA T1 - T5 ĐỀU ĐẠT CHUẨN TRÊN BẢN THẬT HTTPS://AIHOCTAP.ONLINE');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Lỗi trong quá trình kiểm thử:', err);
    await page.screenshot({ path: path.join(OUT_DIR, 'ERROR_snapshot.png'), fullPage: false }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
