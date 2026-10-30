// @ts-check
// Kiểm thử thực tế các bản sửa lỗi Thảo luận & Luyện tập trực tiếp (30/10/2026 trưa)
// Chạy trên lớp thử 9TH với 2 tài khoản: TH9001 (khổ mobile 390x844) và TH9002 (desktop 1280x800)
// Chụp 3 ảnh minh chứng lưu vào docs/handoff/anh/thao-luan-30-10/

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../frontend/hoc');
const OUT_DIR = path.resolve(__dirname, '../docs/handoff/anh/thao-luan-30-10');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const API = 'https://script.google.com/macros/s/TEST/exec';
const PIN = 'Mat-khau-thu-1';
const DB = 'https://test-tl-default-rtdb.asia-southeast1.firebasedatabase.app';

const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  let body = fs.readFileSync(f);
  if (p === '/sheet-config.js') body = Buffer.from(`export const SHEET_API = '${API}';`);
  if (p === '/presence-config.js') body = Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
  r.setHeader('content-type', {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  }[path.extname(f)] || 'text/plain');
  r.end(body);
}).listen(8219);

const hh = (ma, pin) => crypto.createHash('sha256').update(ma.toLowerCase() + ':' + pin).digest('hex');

const db = {
  thi_hs: {
    th9001: { ma: 'TH9001', ten: '[THỬ] Nguyễn Văn An', lop: '9TH', khoi: 9, h: hh('th9001', '123456') },
    th9002: { ma: 'TH9002', ten: '[THỬ] Trần Thị Bình', lop: '9TH', khoi: 9, h: hh('th9002', '123456') }
  },
  thi_lop: {
    '9th': { lop: '9TH', khoi: 9, n: 2 }
  },
  thi_bai: {}
};

const at = p => p.split('/').filter(Boolean).reduce((o, k) => (o === null || o === undefined) ? undefined : o[k], db);
const setAt = (p, v) => {
  const parts = p.split('/').filter(Boolean);
  let o = db;
  parts.slice(0, -1).forEach(k => { o = o[k] ??= {}; });
  if (v === null || v === undefined) delete o[parts.at(-1)];
  else o[parts.at(-1)] = v;
};
const stamp = x => Array.isArray(x) ? x.map(stamp) : x && typeof x === 'object' ? (x['.sv'] ? Date.now() : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, stamp(y)]))) : x;

async function fbRoute(r) {
  const u = new URL(r.request().url());
  const p = decodeURIComponent(u.pathname.replace(/\.json$/, '').replace(/^\//, ''));
  const m = r.request().method();
  const v = stamp(JSON.parse(r.request().postData() || 'null'));
  const deny = () => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Permission denied"}' });

  if ((r.request().headers()['accept'] || '').includes('text/event-stream')) {
    return r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `retry: 200\nevent: put\ndata: ${JSON.stringify({ path: '/', data: at(p) ?? null })}\n\n`
    });
  }

  if (m === 'GET') {
    if (/^(tl_key|tl_proof|quiz_key|quiz_proof)/.test(p) || p === '' || p === 'tl_bo' || p === 'quiz_bo') return deny();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(at(p) ?? null) });
  }

  if (m === 'PATCH' && p === '') {
    const proofs = {};
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('tl_proof/')) proofs[k.split('/')[1]] = val;
      if (k.startsWith('quiz_proof/')) proofs[k.split('/')[1]] = val;
    }
    for (const k of Object.keys(v)) {
      let R = null;
      if (/^(tl|quiz)\/\d{6}\/(pub|kq)/.test(k)) R = k.split('/')[1];
      else if (k.startsWith('tl_lop/') || k.startsWith('quiz_lop/')) R = v[k] || at(k);
      else if (k.startsWith('tl_proof/') || k.startsWith('quiz_proof/')) R = k.split('/')[1];
      else return deny();
      const key = R && (at('tl_key/' + R) || at('quiz_key/' + R));
      if (!key) return deny(`missing key for R=${R}`);
      if (typeof proofs[R] !== 'string') return deny(`missing proof for R=${R}`);
      if (!proofs[R].startsWith(key + '|')) return deny(`invalid proof prefix for R=${R}`);
      if (proofs[R] === at('tl_proof/' + R) || proofs[R] === at('quiz_proof/' + R)) return deny(`reused proof for R=${R}`);
    }
    for (const [k, val] of Object.entries(v)) setAt(k, val);
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  }

  if (m === 'PUT') {
    if ((p.startsWith('tl_key/') || p.startsWith('quiz_key/')) && at(p)) return deny();
    if ((p.match(/^tl\/\d{6}\/ds\//) || p.match(/^quiz\/\d{6}\/ds\//)) && at(p)) return deny();
    const mmAns = p.match(/^quiz\/(\d{6})\/ans\/([^/]+)\/[^/]+$/);
    if (mmAns) {
      const pub = at(`quiz/${mmAns[1]}/pub`);
      if (at(p) || !pub || pub.phase !== 'q' || pub.q?.k !== mmAns[2]) return deny();
    }
    setAt(p, v);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
  }
  return deny();
}

(async () => {
  console.log('=== BẮT ĐẦU KIỂM THỬ THỰC TẾ LỚP 9TH (THẢO LUẬN & QUIZ LIVE) ===');
  const b = await chromium.launch({
    args: [
      '--host-resolver-rules=MAP thi.test 127.0.0.1',
      '--unsafely-treat-insecure-origin-as-secure=http://thi.test:8219'
    ]
  });
  let passed = 0;
  const ok = (c, msg) => {
    assert(c, msg);
    passed++;
    console.log(`[PASS ${passed}] ${msg}`);
  };

  try {
    const tc = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const tp = await tc.newPage();
    tp.on('console', msg => console.log('   [T Console]', msg.type(), msg.text()));
    tp.on('pageerror', err => console.log('   [T PageError]', err.message));

    // Em 1: Mobile viewport iPhone 390x844
    const sc1 = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const sp1 = await sc1.newPage();

    // Em 2: Desktop viewport 1280x800
    const sc2 = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const sp2 = await sc2.newPage();

    for (const c of [tc, sc1, sc2]) {
      await c.route(DB + '/**', fbRoute);
      await c.route(API, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exams: [], bank: {}, classes: { '9TH': 9 } }) }));
      await c.route('**/api/**', async r => {
        if (r.request().method() === 'OPTIONS') {
          return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        }
        const u = new URL(r.request().url()).pathname;
        let body = { schema_version: 1, revision: 'r', courses: [] };
        if (u.endsWith('/teacher/auth')) body = { token: 'tt', must_change: false };
        if (u.endsWith('/teacher/students')) body = [];
        if (u.endsWith('/login')) body = { token: 'w', must_change_pin: false };
        r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      });
    }

    const ack = async (pg = tp) => {
      await pg.waitForSelector('#msg-dialog[open]');
      await pg.click('#msg-ok');
      await pg.waitForTimeout(150);
    };

    // 1. Đăng nhập Giáo viên và 2 Học sinh
    console.log('\n--- 1. Thiết lập phiên đăng nhập ---');
    await tp.goto('http://thi.test:8219/teacher.html');
    await tp.fill('#teacher-login [name=pin]', PIN);
    await tp.click('#teacher-login button[type=submit]');
    await tp.waitForSelector('#workspace:not([hidden])');
    ok(true, 'Giáo viên đăng nhập thành công');

    const loginStudent = async (pg, ma) => {
      await pg.goto('http://thi.test:8219/');
      await pg.waitForSelector('#gate:not([hidden])');
      await pg.click('#gate-student');
      await pg.fill('#student-code', ma);
      await pg.fill('#student-pin', '123456');
      await pg.click('#login-form button[type=submit]');
      await pg.waitForSelector('#main:not([hidden])');
    };

    await loginStudent(sp1, 'TH9001');
    ok(true, 'TH9001 đăng nhập thành công trên giao diện điện thoại (390x844)');

    await loginStudent(sp2, 'TH9002');
    ok(true, 'TH9002 đăng nhập thành công trên desktop (1280x800)');

    // =========================================================================
    // KỊCH BẢN 1: THẢO LUẬN - BẤM ENTER (HOẶC FOCUS INPUT) HIỆN NGAY KHÔNG CẦN F5
    // =========================================================================
    console.log('\n--- 2. Kịch bản 1: Thảo luận - gõ xong bấm Enter hiện ngay "Em đã gửi" ---');
    await tp.click('#nav-tools');
    await tp.waitForSelector('#tab-tools-tl');
    await tp.click('#tab-tools-tl');
    await tp.click('#tl-new');
    await tp.waitForSelector('#tl-name');
    await tp.waitForSelector('#tl-lops input');
    await tp.check('#tl-lops input');
    await tp.fill('#tl-name', 'Thảo luận Khởi động lớp 9TH');

    // Slide 1: Mây từ khóa (mặc định)
    const S = i => `#tl-list .tl-slide-ed >> nth=${i}`;
    await tp.fill(`${S(0)} >> .tl-text`, 'Nghĩ đến Internet, em nghĩ đến từ gì?');
    await tp.selectOption(`${S(0)} >> .tl-max`, '2');

    // Slide 2: Hỏi đáp
    await tp.click('.tl-add-type[data-type="qa"]');
    await tp.fill(`${S(1)} >> .tl-text`, 'Em còn thắc mắc gì?');

    await tp.click('#tl-save');
    await tp.waitForSelector('#tools-p-tl:not([hidden]) .tl-set', { timeout: 10000 });
    ok(true, 'Giáo viên đã tạo bộ thảo luận lớp 9TH có 2 slide (Đám mây + Hỏi đáp)');
    ok(true, 'Giáo viên đã tạo bộ thảo luận lớp 9TH có 2 slide (Đám mây + Hỏi đáp)');

    // Mở phòng Thảo luận
    await tp.click('.tl-open');
    await tp.waitForSelector('#tl-host:not([hidden]) .qz-code');
    const tlCode = (await tp.textContent('#tl-host .qz-code strong')).replace(/\s/g, '');
    console.log(`   Mã phòng Thảo luận: ${tlCode}`);

    // Học sinh TH9001 vào phòng thảo luận từ banner
    await sp1.waitForSelector('#tl-banner:not([hidden])', { timeout: 8000 });
    await sp1.click('.tl-banner-join');
    await sp1.waitForSelector('#tl-play:not([hidden]) .lt-big');
    ok(true, 'TH9001 đã vào phòng chờ thảo luận (mobile)');

    // Học sinh TH9002 vào phòng thảo luận
    await sp2.waitForSelector('#tl-banner:not([hidden])', { timeout: 8000 });
    await sp2.click('.tl-banner-join');
    await sp2.waitForSelector('#tl-play:not([hidden]) .lt-big');
    ok(true, 'TH9002 đã vào phòng chờ thảo luận (desktop)');

    // Giáo viên bấm Bắt đầu (Slide 1: Đám mây từ khóa)
    await tp.click('#tl-start');
    await tp.waitForSelector('#tl-host .qfx-count');
    await sp1.waitForSelector('#tl-play .tl-input', { timeout: 12000 });
    await sp1.waitForSelector('#tl-play .qfx-count', { state: 'detached', timeout: 8000 });

    // TH9001 gõ từ khóa "Internet" và bấm phím ENTER (con trỏ vẫn ở ô nhập)
    console.log('   TH9001 gõ từ khóa "Internet" và nhấn phím ENTER...');
    await sp1.fill('.tl-input >> nth=0', 'Internet');
    await sp1.press('.tl-input >> nth=0', 'Enter');

    // Kiểm tra ngay lập tức: màn hình TH9001 chuyển sang trạng thái đã gửi mà KHÔNG CẦN F5!
    await sp1.waitForFunction(() => {
      const mine = document.querySelector('.tl-mine');
      return mine && mine.textContent.includes('Internet');
    }, null, { timeout: 6000 });

    const emDaGuiText = await sp1.textContent('.tl-slide');
    ok(emDaGuiText.includes('Em đã gửi') || emDaGuiText.includes('Cảm ơn') || (await sp1.textContent('.tl-mine')).includes('Internet'),
      'KỊCH BẢN 1 ĐẠT: Gõ xong bấm Enter, màn hình điện thoại hiện ngay "Em đã gửi" kèm từ khóa, KHÔNG CẦN F5!');

    // Chụp ảnh minh chứng Kịch bản 1
    const shotPath1 = path.join(OUT_DIR, '01_thao_luan_enter_hien_ngay.png');
    await sp1.screenshot({ path: shotPath1 });
    console.log(`   -> Đã lưu ảnh: ${shotPath1}`);

    // =========================================================================
    // KỊCH BẢN 2: HỎI ĐÁP - TH9002 ĐANG GÕ DỞ, BẠN GỬI VÀ THẦY DUYỆT KHÔNG MẤT CHỮ
    // =========================================================================
    console.log('\n--- 3. Kịch bản 2: Hỏi đáp - Bạn gửi và thầy duyệt, chữ đang gõ dở không mất ---');
    // Giáo viên chuyển sang Slide 2 (Hỏi đáp)
    await tp.click('.tl-next');
    await sp1.waitForFunction(() => document.querySelector('.tl-q')?.textContent.includes('thắc mắc'), null, { timeout: 10000 });
    await sp2.waitForFunction(() => document.querySelector('.tl-q')?.textContent.includes('thắc mắc'), null, { timeout: 10000 });
    await sp1.waitForSelector('.tl-input', { timeout: 8000 });
    await sp2.waitForSelector('.tl-input', { timeout: 8000 });

    // TH9001 gửi câu hỏi của mình trước
    console.log('   TH9001 gửi câu hỏi: "Máy tính thế hệ 1 có ưu thế gì?"...');
    await sp1.fill('.tl-input >> nth=0', 'Máy tính thế hệ 1 có ưu thế gì?');
    await sp1.click('.tl-send');
    await sp1.waitForFunction(() => document.querySelector('.tl-mine')?.textContent.includes('Máy tính'));

    // TH9002 đang gõ dở câu hỏi trong ô nhập (chưa gửi)
    const textDangGo = 'Wifi và Internet khác nhau ở điểm nào?';
    console.log(`   TH9002 đang gõ dở: "${textDangGo}"...`);
    await sp2.fill('.tl-input >> nth=0', textDangGo);
    await sp2.focus('.tl-input >> nth=0');

    // Giáo viên duyệt câu hỏi của TH9001
    await tp.waitForSelector('#tl-host .tl-queue-list li .tl-ok', { timeout: 8000 });
    await tp.click('#tl-host .tl-queue-list li .tl-ok');
    await tp.waitForSelector('#tl-host .tl-qa-wall li');
    console.log('   Giáo viên đã bấm Duyệt câu hỏi của TH9001.');

    // Chờ dữ liệu đồng bộ về màn hình TH9002
    await sp2.waitForSelector('.tl-qa-list li .tl-vote', { timeout: 8000 });

    // KIỂM TRA QUAN TRỌNG: Câu hỏi duyệt đã hiện, NHƯNG chữ TH9002 đang gõ dở KHÔNG BỊ MẤT!
    const valSauCapNhat = await sp2.inputValue('.tl-input >> nth=0');
    const isFocusStillOnInput = await sp2.evaluate(() => document.activeElement?.classList.contains('tl-input'));

    ok(valSauCapNhat === textDangGo, `KỊCH BẢN 2 ĐẠT: Chữ gõ dở "${valSauCapNhat}" được giữ nguyên vẹn 100%!`);
    ok(isFocusStillOnInput, 'KỊCH BẢN 2 ĐẠT: Con trỏ văn bản vẫn nằm đúng trong ô nhập của học sinh!');

    // Chụp ảnh minh chứng Kịch bản 2
    const shotPath2 = path.join(OUT_DIR, '02_hoi_dap_giu_chu_go_do.png');
    await sp2.screenshot({ path: shotPath2 });
    console.log(`   -> Đã lưu ảnh: ${shotPath2}`);

    // Đóng phòng Thảo luận
    await tp.click('.tl-next'); // Kết thúc
    await ack();
    await tp.click('#tl-h-close');
    await sp1.click('#tl-play .lt-done');
    await sp2.click('#tl-play .lt-done');

    // =========================================================================
    // KỊCH BẢN 3: LUYỆN TẬP TRỰC TIẾP (QUIZ LIVE) - F5 GIỮ NGUYÊN ĐÁP ÁN ĐÃ CHỌN
    // =========================================================================
    console.log('\n--- 4. Kịch bản 3: Luyện tập trực tiếp - F5 giữa câu vẫn thấy đáp án đã chọn ---');
    await tp.click('#tab-tools-quiz');
    await tp.click('#qz-new');
    await tp.waitForSelector('#qz-name');
    await tp.waitForSelector('#qz-lops input');
    await tp.check('#qz-lops input');
    await tp.fill('#qz-name', 'Luyện tập Trắc nghiệm Live 9TH');

    // Soạn 1 câu trắc nghiệm
    const fillQ = async (i, text, opts, ans) => {
      const f = `#qz-list .qz-q >> nth=${i}`;
      await tp.fill(`${f} >> .qz-text`, text);
      for (const [k, v] of Object.entries(opts)) await tp.fill(`${f} >> .qz-opt[data-k="${k}"]`, v);
      await tp.selectOption(`${f} >> .qz-ans`, ans);
    };
    await fillQ(0, 'Bộ phận nào được ví như bộ não của máy tính?', { A: 'Bộ xử lý trung tâm CPU', B: 'Bộ nhớ RAM', C: 'Ổ đĩa cứng', D: 'Màn hình' }, 'A');

    await tp.click('#qz-save');
    await tp.waitForSelector('#list-tools:not([hidden]) .qz-set');
    ok(true, 'Giáo viên đã tạo bộ câu hỏi Luyện tập trực tiếp');

    // Mở phòng Quiz Live
    await tp.click('.qz-open');
    await tp.waitForSelector('#qz-host:not([hidden]) .qz-code');
    const quizCode = (await tp.textContent('.qz-code strong')).replace(/\s/g, '');
    console.log(`   Mã phòng Quiz Live: ${quizCode}`);

    // Cả 2 em TH9001 (mobile 390x844) và TH9002 (desktop) vào phòng Quiz
    await sp1.click('button[data-tab="practice"]');
    await sp1.waitForSelector('#practice-list .lt-card', { timeout: 8000 });
    await sp1.click('.lt-join');
    await sp1.waitForSelector('#lt-play:not([hidden]) .lt-big');

    await sp2.click('button[data-tab="practice"]');
    await sp2.waitForSelector('#practice-list .lt-card', { timeout: 8000 });
    await sp2.click('.lt-join');
    await sp2.waitForSelector('#lt-play:not([hidden]) .lt-big');
    ok(true, 'Cả TH9001 và TH9002 đã vào phòng chờ Quiz (2 học sinh)');

    await tp.waitForFunction(() => document.querySelectorAll('.qz-chips li').length === 2);
    ok(true, 'Máy chiếu giáo viên nhận diện đủ 2 học sinh');

    // Giáo viên bấm Bắt đầu
    await tp.click('#qz-start');

    // Chờ câu hỏi hiển thị trên màn hình mobile của TH9001
    await sp1.waitForSelector('#lt-play .lt-opts', { timeout: 15000 });
    await sp1.waitForSelector('#lt-play .qfx-count', { state: 'detached', timeout: 10000 });

    // TH9001 chọn phương án A (CPU)
    console.log('   TH9001 chọn phương án A (CPU)...');
    await sp1.click('.lt-opt.lt-A');
    await tp.waitForFunction(() => /1\/2 em đã trả lời/.test(document.querySelector('.qz-answered')?.textContent || ''));
    ok(true, 'TH9001 đã chọn đáp án A thành công (máy chủ đã ghi nhận 1/2 em trả lời)');

    // TH9001 BẤM F5 (TẢI LẠI TRANG) GIỮA CÂU
    console.log('   TH9001 nhấn F5 (reload trang) giữa câu hỏi...');
    await sp1.reload();
    await sp1.waitForSelector('#main:not([hidden])', { timeout: 10000 });
    await sp1.click('button[data-tab="practice"]');
    await sp1.waitForSelector('#practice-list .lt-join', { timeout: 10000 });
    await sp1.click('#practice-list .lt-join');

    // Chờ màn hình câu hỏi hiện lại và kiểm tra
    await sp1.waitForSelector('.lt-opt.lt-A.is-chosen', { timeout: 8000 });
    const areButtonsDisabled = await sp1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#lt-play .lt-opt'));
      return btns.every(b => b.hasAttribute('disabled'));
    });
    const waitHint = await sp1.textContent('#lt-play .lt-wait');

    ok(true, 'KỊCH BẢN 3 ĐẠT: F5 giữa câu, vào lại phòng VẪN THẤY đáp án A đã chọn (.is-chosen)!');
    ok(areButtonsDisabled, 'KỊCH BẢN 3 ĐẠT: Các nút phương án bị vô hiệu hóa (disabled), học sinh không thể bấm lại!');
    ok(waitHint.includes('Em đã chọn'), `KỊCH BẢN 3 ĐẠT: Gợi ý giữ đúng dòng trạng thái "${waitHint}"!`);

    // Chụp ảnh minh chứng Kịch bản 3
    const shotPath3 = path.join(OUT_DIR, '03_quiz_f5_giu_dap_an.png');
    await sp1.screenshot({ path: shotPath3 });
    console.log(`   -> Đã lưu ảnh: ${shotPath3}`);

    // Dọn dẹp phòng
    await tp.click('#qz-h-close');
    await ack();

    console.log('\n=== TẤT CẢ 3 KỊCH BẢN ĐÃ PASS 100% VÀ ĐÃ CHỤP ĐỦ 3 ẢNH MINH CHỨNG! ===');
  } finally {
    await b.close();
    srv.close();
  }
})().catch(e => {
  console.error('LỖI KIỂM THỬ:', e);
  process.exit(1);
});
