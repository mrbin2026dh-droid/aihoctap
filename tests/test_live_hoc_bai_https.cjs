// Kiểm thử thực tế trên HTTPS: https://aihoctap.online
// Nghiệm thu 4 tiêu chí sửa lỗi học bài:
// 1. Mở bài từ cuối danh sách → bài luôn hiện từ đầu (window.scrollY === 0).
// 2. Bài "Thông tin trong giải quyết vấn đề": bảng tiêu chí hiển thị đúng thẻ <table>, không còn "| :--- |".
// 3. Đọc hết bài → danh sách hiện "Đã đọc hết", tab Tiến độ hiện "Học bài: đã đọc hết".
// 4. Gia sư AI: gõ "KKKKKKKKKK" → trả lời tức thì nêu tên bài + nút gợi ý, không tốn lượt;
//    hỏi "Đội bóng nào vô địch World Cup?" → AI nêu tên bài đang học, gợi ý nội dung, từ chối khéo.
const { chromium } = require('playwright');
const assert = require('assert');

const BASE_URL = 'https://aihoctap.online';
// Không ghi mã/PIN học sinh thật vào kho: truyền qua biến môi trường, chỉ dùng tài khoản THỬ.
const STUDENT_CODE = process.env.LIVE_CODE || '';
const STUDENT_PIN = process.env.LIVE_PIN || '';
if (!/^TH9\d{3}$/i.test(STUDENT_CODE) || !STUDENT_PIN) { console.error('Đặt LIVE_CODE=TH9xxx và LIVE_PIN (tài khoản THỬ).'); process.exit(2); }

(async () => {
  console.log('=== BẮT ĐẦU KIỂM THỬ THỰC TẾ HỌC BÀI TRÊN HTTPS: ' + BASE_URL + ' ===');
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  const ok = (cond, msg) => {
    assert(cond, msg);
    passed++;
    console.log(`[PASS ${passed}] ${msg}`);
  };

  const results = {
    errors: [],
    latencies: {}
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Context Desktop (1280x800)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Kiểm thử trên Desktop (1280x800) ---');
    const dCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    });
    const dPage = await dCtx.newPage();
    dPage.on('pageerror', e => results.errors.push('Desktop PageError: ' + e.message));

    const t0 = Date.now();
    const dRes = await dPage.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    results.latencies.desktopLoad = Date.now() - t0;
    ok(dRes.status() === 200, `Trang chủ tải thành công HTTP 200 (${results.latencies.desktopLoad}ms)`);

    // Đăng nhập học sinh lớp 9: 9A9001 / 123456
    console.log(`  Đăng nhập học sinh ${STUDENT_CODE}...`);
    await dPage.waitForSelector('#gate-student', { timeout: 10000 });
    await dPage.click('#gate-student');
    await dPage.waitForSelector('#login-dialog[open]', { timeout: 5000 });
    await dPage.fill('#student-code', STUDENT_CODE);
    await dPage.fill('#student-pin', STUDENT_PIN);
    await dPage.click('#login-form button[type=submit]');
    await dPage.waitForSelector('#main:not([hidden])', { timeout: 15000 });
    await dPage.waitForTimeout(1000);

    // Chuyển sang tab Danh mục
    await dPage.click('[data-tab="catalog"]');
    await dPage.waitForSelector('.lesson-card', { timeout: 10000 });
    const cards = dPage.locator('.lesson-card');
    const cardCount = await cards.count();
    console.log(`  Số bài học hiển thị trong danh mục: ${cardCount}`);
    ok(cardCount >= 5, `Danh mục bài học lớp 9 hiển thị đầy đủ (${cardCount} bài)`);

    // TIÊU CHÍ 1: Cuộn xuống cuối danh mục, mở bài cuối → Bài hiện từ ĐẦU (scrollY === 0)
    console.log('\n[Tiêu chí 1] Kiểm tra mở bài luôn ở đầu trang:');
    const lastCard = cards.last();
    await lastCard.scrollIntoViewIfNeeded();
    await dPage.mouse.wheel(0, 800);
    await dPage.waitForTimeout(300);
    const scrollBefore = await dPage.evaluate(() => window.scrollY);
    console.log(`  Vị trí cuộn danh mục trước khi bấm mở bài: ${scrollBefore}px`);
    ok(scrollBefore > 100, `Danh sách bài đã được cuộn xuống sâu (${scrollBefore}px > 100px)`);

    await lastCard.locator('button').first().click();
    await dPage.waitForSelector('#lesson-content:not(:empty)', { timeout: 10000 });
    await dPage.waitForTimeout(400);

    const scrollAfter = await dPage.evaluate(() => window.scrollY);
    console.log(`  Vị trí cuộn sau khi mở bài học: ${scrollAfter}px`);
    ok(scrollAfter === 0, 'Mở bài từ cuối danh sách → trang bài học luôn cuộn về ĐẦU (scrollY === 0)');

    const pctInitial = await dPage.evaluate(() => {
      const el = document.querySelector('.read-pct, #read-status');
      return el ? el.textContent.trim() : '';
    });
    console.log(`  Tiến trình đọc ngay khi vừa mở bài: "${pctInitial}"`);
    ok(!pctInitial.includes('Đã đọc hết'), `Vừa mở bài chưa bị nhảy lên 100% (hiện: "${pctInitial}")`);

    // TIÊU CHÍ 2: Bảng trong bài "Thông tin trong giải quyết vấn đề"
    console.log('\n[Tiêu chí 2] Kiểm tra hiển thị bảng Markdown không còn "| :--- |":');
    await dPage.click('[data-tab="catalog"]');
    await dPage.waitForSelector('.lesson-card', { timeout: 8000 });

    const cardBai2 = dPage.locator('.lesson-card:has-text("Thông tin trong giải quyết vấn đề")');
    await cardBai2.locator('button').first().click();
    await dPage.waitForSelector('#lesson-content:not(:empty)', { timeout: 10000 });
    await dPage.waitForTimeout(500);

    const tableInfo = await dPage.evaluate(() => {
      const content = document.querySelector('#lesson-content');
      const text = content ? content.textContent : '';
      const tables = content ? content.querySelectorAll('table') : [];
      const ths = [...(content ? content.querySelectorAll('th') : [])].map(x => x.textContent.trim());
      const hasMarkdownRawPipes = /\|\s*:?---/.test(text) || text.includes('| :--- |');

      return {
        tableCount: tables.length,
        hasTable: tables.length > 0,
        ths,
        hasMarkdownRawPipes
      };
    });

    console.log(`  Số lượng thẻ <table>: ${tableInfo.tableCount}`);
    console.log(`  Tiêu đề cột (TH): ${JSON.stringify(tableInfo.ths)}`);
    ok(tableInfo.hasTable, 'Bài học render thành công bảng chuẩn HTML (thẻ <table>, <th>, <td>)');
    ok(!tableInfo.hasMarkdownRawPipes, 'Bảng Markdown hiển thị sạch sẽ, triệt tiêu hoàn toàn ký tự lạ "| :--- |"');

    // TIÊU CHÍ 3: Đọc hết bài → Danh sách hiện "Đã đọc hết", Tiến độ hiện "Học bài: đã đọc hết"
    console.log('\n[Tiêu chí 3] Kiểm tra % đọc bài và nhãn "Đã đọc hết":');
    // Cuộn xuống hết bài học
    for (let i = 0; i < 35; i++) {
      await dPage.mouse.wheel(0, 800);
      await dPage.waitForTimeout(30);
    }
    await dPage.waitForTimeout(600);

    const pctAfterScroll = await dPage.evaluate(() => {
      const el = document.querySelector('.read-pct, #read-status');
      return el ? el.textContent.trim() : '';
    });
    console.log(`  Tiến trình đọc sau khi cuộn hết bài: "${pctAfterScroll}"`);
    ok(pctAfterScroll.includes('Đã đọc hết') || pctAfterScroll.includes('100%'), 'Cuộn hết bài → hiển thị "Đã đọc hết" (100%)');

    // Về danh sách bài
    await dPage.click('[data-tab="catalog"]');
    await dPage.waitForSelector('.lesson-card', { timeout: 8000 });
    await dPage.waitForTimeout(500);

    const badgeOnCard = await dPage.evaluate(() => {
      const card = [...document.querySelectorAll('.lesson-card')].find(c => c.textContent.includes('Thông tin trong giải quyết vấn đề'));
      if (!card) return null;
      const chip = card.querySelector('.read-chip, [class*="read"]');
      return chip ? chip.textContent.trim() : '';
    });
    console.log(`  Nhãn trên thẻ bài học trong danh mục: "${badgeOnCard}"`);
    ok(badgeOnCard.includes('Đã đọc hết'), 'Danh sách bài học: bài đã đọc hiển thị nhãn "Đã đọc hết"');

    // Kiểm tra tab Tiến độ
    await dPage.click('[data-tab="progress"]');
    await dPage.waitForSelector('#progress, .path-step', { timeout: 8000 });
    await dPage.waitForTimeout(500);

    const progressInfo = await dPage.evaluate(() => {
      const steps = [...document.querySelectorAll('.path-step, .progress-card, .lesson-card')];
      const b2 = steps.find(s => s.textContent.includes('Thông tin trong giải quyết vấn đề'));
      const readText = b2 ? (b2.querySelector('.path-read, [class*="read"]')?.textContent || b2.textContent) : '';
      return {
        stepFound: !!b2,
        readText: readText.trim()
      };
    });
    console.log(`  Mục bài 2 trong tab Tiến độ: "${progressInfo.readText}"`);
    ok(progressInfo.readText.includes('đã đọc hết') || progressInfo.readText.includes('Đã đọc hết'),
      'Tab Tiến độ ghi nhận chính xác: "Học bài: đã đọc hết"');

    // -------------------------------------------------------------------------
    // 2. Context Điện thoại di động (iPhone 390x844) - Gia sư AI
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Kiểm thử trên Điện thoại di động (iPhone 390x844) ---');
    const mCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    const mPage = await mCtx.newPage();
    mPage.on('pageerror', e => results.errors.push('Mobile PageError: ' + e.message));

    await mPage.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Kiểm tra Zero-Overflow di động
    const mOverflow = await mPage.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        isZeroOverflow: doc.scrollWidth <= doc.clientWidth
      };
    });
    ok(mOverflow.isZeroOverflow, `Giao diện di động đạt chuẩn Zero-Overflow 100% (${mOverflow.scrollWidth}px <= ${mOverflow.clientWidth}px)`);

    // Đăng nhập học sinh trên di động
    console.log(`  Đăng nhập học sinh ${STUDENT_CODE} trên di động...`);
    await mPage.waitForSelector('#gate-student', { timeout: 10000 });
    await mPage.click('#gate-student');
    await mPage.waitForSelector('#login-dialog[open]', { timeout: 5000 });
    await mPage.fill('#student-code', STUDENT_CODE);
    await mPage.fill('#student-pin', STUDENT_PIN);

    const mobileLoginToken = mPage.waitForResponse(res => res.url().includes('/api/login') && res.status() === 200, { timeout: 15000 });
    await mPage.click('#login-form button[type=submit]');
    await mPage.waitForSelector('#main:not([hidden])', { timeout: 15000 });
    await mobileLoginToken;
    console.log('  Token xác thực Worker đã sẵn sàng trên di động');

    // TIÊU CHÍ 4: Gia sư AI
    console.log('\n[Tiêu chí 4] Kiểm định Gia sư AI trên môi trường thật:');
    // Mở bài 1: "Thế giới kĩ thuật số"
    await mPage.click('[data-tab="catalog"]');
    await mPage.waitForSelector('.lesson-card', { timeout: 8000 });
    const b1Card = mPage.locator('.lesson-card:has-text("Thế giới kĩ thuật số")');
    await b1Card.locator('button').first().click();
    await mPage.waitForSelector('#lesson-content:not(:empty)', { timeout: 10000 });
    await mPage.waitForTimeout(500);

    // Mở Gia sư AI
    const tutorBtn = mPage.locator('#ask-tutor, #open-tutor, .tutor-btn').first();
    ok(await tutorBtn.isVisible(), 'Nút mở Gia sư AI hiển thị sẵn sàng trên thanh công cụ');
    await tutorBtn.click();
    await mPage.waitForSelector('#tutor-dialog[open]', { timeout: 5000 });
    await mPage.waitForTimeout(400);

    // 4.1: Gửi chuỗi ký tự linh tinh "KKKKKKKKKK"
    console.log('  Gửi tin nhắn linh tinh: "KKKKKKKKKK"...');
    await mPage.fill('#tutor-input', 'KKKKKKKKKK');
    const sendBtn = mPage.locator('#tutor-form button[type=submit], #tutor-send').first();
    await sendBtn.click();

    // Chờ phản hồi tức thì và các nút gợi ý xuất hiện
    await mPage.waitForSelector('.tutor-suggest, .tutor-chip', { timeout: 15000 });
    await mPage.waitForTimeout(600);

    const gibberishReply = await mPage.evaluate(() => {
      const msgs = document.querySelectorAll('#tutor-messages .msg, .tutor-msg');
      const last = msgs[msgs.length - 1];
      const suggestBox = document.querySelector('.tutor-suggest');
      const buttons = suggestBox ? [...suggestBox.querySelectorAll('button, .tutor-chip')].map(b => b.textContent.trim()) : [];
      return {
        text: last ? last.textContent.trim() : '',
        suggestButtons: buttons
      };
    });

    console.log(`  Phản hồi của Gia sư: "${gibberishReply.text.slice(0, 150)}..."`);
    console.log(`  Các nút gợi ý: ${JSON.stringify(gibberishReply.suggestButtons)}`);

    ok(gibberishReply.text.includes('Thế giới kĩ thuật số'), 'Gia sư nhắc rõ bài em đang học ("Thế giới kĩ thuật số")');
    ok(gibberishReply.suggestButtons.length >= 1 || gibberishReply.text.includes('bộ xử lí thông tin'), 'Gia sư gợi ý nội dung/câu hỏi liên quan bài học');
    ok(!gibberishReply.text.includes('không thể cung cấp đáp án'), 'Không dùng câu từ chối sai lệch "không thể cung cấp đáp án"');

    // 4.2: Gửi câu hỏi lạc đề: "Đội bóng nào vô địch World Cup?"
    console.log('\n  Gửi câu hỏi lạc đề: "Đội bóng nào vô địch World Cup?"...');
    await mPage.fill('#tutor-input', 'Đội bóng nào vô địch World Cup?');
    await sendBtn.click();

    // Chờ loading xuất hiện và sau đó hoàn tất
    await mPage.waitForSelector('#tutor-messages .is-loading', { timeout: 5000 }).catch(() => {});
    await mPage.waitForSelector('#tutor-messages .is-loading', { state: 'detached', timeout: 35000 });
    // Chờ hiệu ứng gõ chữ (typeOut) hoàn tất
    await mPage.waitForTimeout(2000);

    const offTopicReply = await mPage.evaluate(() => {
      const msgs = document.querySelectorAll('#tutor-messages .msg, .tutor-msg');
      const last = msgs[msgs.length - 1];
      return last ? last.textContent.trim() : '';
    });

    console.log(`  Phản hồi của Gia sư đối với câu hỏi ngoài lề:\n  "${offTopicReply}"`);
    ok(offTopicReply.includes('Thế giới kĩ thuật số') || offTopicReply.includes('bộ xử lí thông tin') || offTopicReply.includes('máy tính'),
      'AI điều hướng khéo léo về bài học ("Thế giới kĩ thuật số" / "bộ xử lí thông tin")');
    ok(!offTopicReply.includes('không thể cung cấp đáp án'), 'AI từ chối khéo léo, không nói "không thể cung cấp đáp án"');

    // Kiểm tra Console F12
    ok(results.errors.length === 0, `Không có lỗi Console F12 nào (${results.errors.length} errors)`);

    console.log('\n======================================================');
    console.log(`TẤT CẢ ${passed} BÀI KIỂM THỬ THỰC TẾ TRÊN HTTPS ĐỀU PASS 100%!`);
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
})();
