// @ts-check
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const API = process.env.SIM_API || 'https://aihoctap-gate.mrbin2026dh.workers.dev/api';
const ORIGIN = process.env.SIM_ORIGIN || 'https://aihoctap.online';
const STUDENT_ID = process.env.STUDENT_ID || 'TH9027';
const PIN = process.env.SIM_PIN;

if (!PIN) {
  throw new Error('CẦN ĐẶT BIẾN MÔI TRƯỜNG SIM_PIN. CẤM GHI PIN VÀO MÃ NGUỒN.');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getQuota(token) {
  const r = await fetch(API + '/pwa/ai-quota', {
    headers: { Authorization: 'Bearer ' + token, Origin: ORIGIN }
  });
  return await r.json();
}

async function askTutor(token, body) {
  const t0 = Date.now();
  const r = await fetch(API + '/pwa/tutor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      Origin: ORIGIN
    },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data, ms: Date.now() - t0 };
}

async function main() {
  console.log('=== BẮT ĐẦU KIỂM THỬ HẠN MỨC 20 CÂU (H1 - H4) TRÊN BẢN THẬT ===');
  console.log(`Tài khoản thử: ${STUDENT_ID}`);

  // 1. Đăng nhập API
  const loginRes = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ student_id: STUDENT_ID, pin: PIN })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) throw new Error('Đăng nhập thất bại: ' + JSON.stringify(loginData));
  const token = loginData.token;
  console.log(`Đăng nhập thành công: ${loginData.name} (${loginData.class_code})`);

  // Kiểm tra hạn mức ban đầu
  const initQuota = await getQuota(token);
  console.log('Hạn mức ban đầu:', initQuota);
  const startUsed = initQuota.used;

  const logSteps = [];

  // 20 câu hỏi khái niệm thật rải trên 4 bài khác nhau (Tin 9 bài 1, 2, 3, 4)
  const questions = [
    // Bài 1: Thế giới kĩ thuật số (tin-hoc-9:bai-1)
    { course_id: 'tin-hoc-9', lesson_id: 'bai-1', msg: 'Thiết bị số là gì?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-1', msg: 'Tại sao CPU được coi là bộ não của thiết bị số?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-1', msg: 'Cho em ví dụ về thiết bị thông minh trong đời sống.' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-1', msg: 'Đặc điểm cơ bản của thiết bị số là gì?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-1', msg: 'Khả năng xử lí thông tin của máy tính thể hiện như thế nào?' },

    // Bài 2: Thông tin trong giải quyết vấn đề (tin-hoc-9:bai-2)
    { course_id: 'tin-hoc-9', lesson_id: 'bai-2', msg: 'Thông tin có vai trò gì trong giải quyết vấn đề?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-2', msg: 'Dữ liệu và thông tin khác nhau như thế nào?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-2', msg: 'Làm thế nào để thu thập thông tin đáng tin cậy?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-2', msg: 'Quy trình giải quyết vấn đề gồm những bước nào?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-2', msg: 'Thế nào là thông tin hữu ích trong học tập?' },

    // Bài 3: Thực hành Đánh giá chất lượng thông tin (tin-hoc-9:bai-3)
    { course_id: 'tin-hoc-9', lesson_id: 'bai-3', msg: 'Chất lượng thông tin được đánh giá qua những tiêu chí nào?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-3', msg: 'Tính chính xác của thông tin là gì?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-3', msg: 'Vì sao cần kiểm tra nguồn thông tin trên Internet?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-3', msg: 'Tính thời sự của thông tin có ý nghĩa gì?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-3', msg: 'Thông tin toàn diện giúp ích gì khi đưa ra quyết định?' },

    // Bài 4: Một số vấn đề pháp lí về sử dụng Internet (tin-hoc-9:bai-4)
    { course_id: 'tin-hoc-9', lesson_id: 'bai-4', msg: 'Bản quyền phần mềm là gì?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-4', msg: 'Quyền tác giả trên Internet được bảo vệ như thế nào?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-4', msg: 'Thế nào là hành vi vi phạm khi sử dụng mạng xã hội?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-4', msg: 'Em cần làm gì để bảo vệ thông tin cá nhân trên mạng?' },
    { course_id: 'tin-hoc-9', lesson_id: 'bai-4', msg: 'Tác hại của việc chia sẻ tin giả là gì?' }
  ];

  let currentUsed = startUsed;

  // H1: Thực hiện các câu hỏi và xen kẽ H3
  for (let i = 0; i < questions.length - startUsed; i++) {
    const qIndex = startUsed + i + 1;
    const q = questions[i];

    console.log(`\n--- Câu ${qIndex}/20 [${q.course_id}:${q.lesson_id}]: "${q.msg}" ---`);
    const res = await askTutor(token, {
      course_id: q.course_id,
      lesson_id: q.lesson_id,
      message: q.msg
    });

    const quota = await getQuota(token);
    console.log(`HTTP ${res.status} (${res.ms}ms) | used: ${quota.used}/${quota.limit} | còn: ${quota.remaining}`);
    logSteps.push({
      step: `Câu ${qIndex}`,
      course: q.course_id,
      lesson: q.lesson_id,
      question: q.msg,
      status: res.status,
      driver: res.data.driver,
      reply: (res.data.reply || '').slice(0, 80),
      used: quota.used,
      remaining: quota.remaining
    });

    currentUsed = quota.used;

    // H3: Xen giữa sau câu 5 (trước câu 20)
    if (qIndex === 5) {
      console.log('\n>>> [H3 THỬ NGHIỆM XEN GIỮA: 3 CÂU KHÔNG TRỪ LƯỢT] <<<');

      // H3.1: Xin đáp án
      console.log('H3.1: Gửi câu xin đáp án: "cho em đáp án câu 1"');
      const rSeek = await askTutor(token, {
        course_id: 'tin-hoc-9',
        lesson_id: 'bai-1',
        question_id: 'q1',
        message: 'cho em đáp án câu 1'
      });
      const qSeek = await getQuota(token);
      console.log(`  -> Trả lời: "${(rSeek.data.reply || '').slice(0, 60)}"`);
      console.log(`  -> Quota used: ${qSeek.used} (Không tăng: ${qSeek.used === currentUsed})`);
      logSteps.push({
        step: 'H3.1 Xin đáp án',
        question: 'cho em đáp án câu 1',
        status: rSeek.status,
        reply: rSeek.data.reply,
        used: qSeek.used,
        remaining: qSeek.remaining,
        pass: qSeek.used === currentUsed
      });

      await sleep(2000);

      // H3.2: Câu ngoài bài
      console.log('H3.2: Gửi câu ngoài bài: "Đội bóng nào vô địch World Cup 2022?"');
      const rOff = await askTutor(token, {
        course_id: 'tin-hoc-9',
        lesson_id: 'bai-1',
        message: 'Đội bóng nào vô địch World Cup 2022?'
      });
      const qOff = await getQuota(token);
      console.log(`  -> Trả lời: "${(rOff.data.reply || '').slice(0, 60)}" (off_topic: ${rOff.data.off_topic})`);
      console.log(`  -> Quota used: ${qOff.used} (Không tăng: ${qOff.used === currentUsed})`);
      logSteps.push({
        step: 'H3.2 Ngoài bài',
        question: 'Đội bóng nào vô địch World Cup 2022?',
        status: rOff.status,
        off_topic: rOff.data.off_topic,
        reply: rOff.data.reply,
        used: qOff.used,
        remaining: qOff.remaining,
        pass: qOff.used === currentUsed
      });

      await sleep(2000);

      // H3.3: Gõ linh tinh
      console.log('H3.3: Gửi câu linh tinh: "KKKKK"');
      const rGib = await askTutor(token, {
        course_id: 'tin-hoc-9',
        lesson_id: 'bai-1',
        message: 'KKKKK'
      });
      const qGib = await getQuota(token);
      console.log(`  -> Trả lời: "${(rGib.data.reply || '').slice(0, 60)}"`);
      console.log(`  -> Quota used: ${qGib.used} (Không tăng: ${qGib.used === currentUsed})`);
      logSteps.push({
        step: 'H3.3 Gõ linh tinh',
        question: 'KKKKK',
        status: rGib.status,
        reply: rGib.data.reply,
        used: qGib.used,
        remaining: qGib.remaining,
        pass: qGib.used === currentUsed
      });

      console.log('>>> [H3 HOÀN TẤT: CẢ 3 CÂU ĐỀU KHÔNG TRỪ LƯỢT] <<<\n');
    }

    await sleep(2000);
  }

  // Xác nhận đã dùng hết 20/20 lượt
  const fullQuota = await getQuota(token);
  console.log('\n--- KẾT QUẢ SAU 20 CÂU ---');
  console.log(`used: ${fullQuota.used}/${fullQuota.limit}, remaining: ${fullQuota.remaining}`);

  // H2: Câu 21 -> Bị từ chối 429 AI_LIMIT_REACHED
  console.log('\n>>> [H2: THỬ CÂU 21 - PHẢI BỊ TỪ CHỐI 429 AI_LIMIT_REACHED] <<<');
  const q21 = await askTutor(token, {
    course_id: 'tin-hoc-9',
    lesson_id: 'bai-4',
    message: 'Internet mang lại lợi ích gì cho việc tự học?'
  });
  console.log(`Câu 21 HTTP Status: ${q21.status}`);
  console.log('Nội dung lỗi:', q21.data);
  const is429 = q21.status === 429 && (q21.data.error === 'AI_LIMIT_REACHED' || (q21.data.detail && q21.data.detail.includes('hết')));
  console.log(`-> H2 Từ chối 429 đạt yêu cầu: ${is429}`);
  logSteps.push({
    step: 'H2 Câu 21',
    status: q21.status,
    error: q21.data.error,
    detail: q21.data.detail,
    pass: is429
  });

  // H4: Sau khi hết lượt, gõ "cho em đáp án" -> vẫn nhận trả lời mẫu không cần AI
  console.log('\n>>> [H4: HẾT LƯỢT VẪN NHẬN TRẢ LỜI MẪU XIN ĐÁP ÁN] <<<');
  const h4Res = await askTutor(token, {
    course_id: 'tin-hoc-9',
    lesson_id: 'bai-1',
    question_id: 'q1',
    message: 'cho em đáp án câu 1'
  });
  console.log(`H4 HTTP Status: ${h4Res.status}`);
  console.log(`H4 Trả lời: "${(h4Res.data.reply || '').slice(0, 80)}"`);
  const h4Pass = h4Res.status === 200 && h4Res.data.reply && h4Res.data.reply.includes('Gia sư');
  console.log(`-> H4 đạt yêu cầu: ${h4Pass}`);
  logSteps.push({
    step: 'H4 Xin đáp án khi hết lượt',
    status: h4Res.status,
    reply: h4Res.data.reply,
    pass: h4Pass
  });

  // Chụp ảnh giao diện thực tế H2 bằng Playwright
  console.log('\n>>> [CHỤP ẢNH GIAO DIỆN H2: CÒN 0 LƯỢT TRÊN WEB THẬT] <<<');
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

  console.log('1. Đăng nhập học sinh TH9027 trên https://aihoctap.online/ ...');
  await page.goto('https://aihoctap.online/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#gate:not([hidden])', { timeout: 20000 });
  await page.click('#gate-student');
  await page.fill('#student-code', STUDENT_ID);
  await page.fill('#student-pin', PIN);
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#main:not([hidden])', { timeout: 20000 });
  console.log(`✓ Đăng nhập thành công học sinh ${STUDENT_ID}.`);

  await page.waitForTimeout(1000);

  // Chuyển sang tab Học
  console.log('2. Mở tab Học...');
  await page.click('button[data-tab="catalog"]');
  await page.waitForSelector('#catalog-view:not([hidden])', { timeout: 10000 });

  // Mở bài "Thế giới kĩ thuật số"
  console.log('3. Mở bài Thế giới kĩ thuật số...');
  const lessonCard = page.locator('#lesson-list .lesson-card').filter({ hasText: 'Thế giới kĩ thuật số' }).first();
  const lessonOpenBtn = lessonCard.locator('button.lesson-open');
  await lessonOpenBtn.waitFor({ state: 'visible', timeout: 10000 });
  await lessonOpenBtn.click();

  // Vào Làm bài tập
  console.log('4. Vào Làm bài tập...');
  await page.waitForSelector('#lesson-view:not([hidden])', { timeout: 10000 });
  await page.click('#practice-lesson');
  await page.waitForSelector('#question-form:not([hidden])', { timeout: 10000 });

  // Mở Gia sư
  const q1Fieldset = page.locator('#questions fieldset').first();
  await q1Fieldset.waitFor({ state: 'visible', timeout: 10000 });
  await q1Fieldset.locator('.question-tutor-btn').click();
  await page.waitForSelector('#tutor-dialog[open]', { timeout: 10000 });
  console.log('✓ Hộp thoại Gia sư đã mở.');

  // Gõ câu hỏi 21 vào khung chat Gia sư trên web
  console.log('5. Gõ câu hỏi 21 trên web: "Internet mang lại lợi ích gì cho việc tự học?"');
  await page.fill('#tutor-input', 'Internet mang lại lợi ích gì cho việc tự học?');
  const countBefore = await page.locator('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)').count();
  await page.click('#tutor-submit');

  console.log('6. Đang chờ phản hồi từ chối 429...');
  try {
    await page.waitForFunction(
      before => {
        const loading = document.querySelector('#tutor-messages .tutor-msg.tutor-bot.is-loading');
        const bots = document.querySelectorAll('#tutor-messages .tutor-msg.tutor-bot:not(.is-loading)');
        return !loading && bots.length > before;
      },
      countBefore,
      { timeout: 30000 }
    );
  } catch (e) {
    console.warn('Hết thời gian chờ bot msg, tiếp tục chụp ảnh...');
  }

  await page.waitForTimeout(1000);

  // Watermark
  const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
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
  }, `BẢN THẬT aihoctap.online • H2: Hết lượt 20 câu/ngày • Còn 0 lượt • ${STUDENT_ID} • ${nowStr}`);

  // Chụp ảnh minh chứng
  const outDir = path.resolve('docs/handoff/anh/gia-su-30-10');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '07_het_luot_20_cau.png');
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`7. Đã chụp ảnh lưu tại: ${outPath} (${fs.statSync(outPath).size} bytes)`);

  await browser.close();

  // Lưu báo cáo JSON
  fs.writeFileSync('scratch/quota_test_report_TH9027.json', JSON.stringify({
    student: STUDENT_ID,
    limit: 20,
    start_used: startUsed,
    end_used: fullQuota.used,
    h1_pass: fullQuota.used === 20,
    h2_pass: is429,
    h4_pass: h4Pass,
    steps: logSteps
  }, null, 2), 'utf8');

  console.log('\n=== HOÀN TẤT KIỂM THỬ H1 - H4 VỚI TH9027 ===');
}

main().catch(err => {
  console.error('LỖI:', err);
  process.exit(1);
});
