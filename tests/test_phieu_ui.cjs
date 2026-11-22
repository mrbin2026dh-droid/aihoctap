// Học AI – giao diện học sinh (DOM thật). Chạy: NODE_PATH=$(npm root -g) node tests/test_phieu_ui.cjs
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const assert = require('assert');
const root = path.resolve(__dirname, '../frontend/hoc');
const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/phieu/ai9_bai2.json'), 'utf8'));
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' }[path.extname(f)] || 'x'); r.end(fs.readFileSync(f)); }).listen(8131);
const B = 'http://localhost:8131';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => { const b = await chromium.launch(); try {
  for (const vp of [{ width: 1200, height: 850 }, { width: 375, height: 812 }]) {
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' }); const pg = await ctx.newPage();
    pg.on('dialog', d => { throw new Error('Không được dùng alert/confirm/prompt: ' + d.message()); });
    const calls = [];
    let bai = { answers: {}, locked: {}, status: 'draft', rev: 0, uid: 'hs01' };
    const view = () => { const v = JSON.parse(JSON.stringify(pack)); delete v.blocks.pl925; delete v.blocks.pl928_2; v.locked_blocks = ['pl925', 'pl928_2']; return v; };
    await pg.route('**/api/**', async r => {
      const u = new URL(r.request().url()).pathname, m = r.request().method(); const body = r.request().postDataJSON?.() || null;
      calls.push({ u, m, body });
      let res = { courses: [] }, st = 200;
      if (u.endsWith('/login')) res = { token: 't', must_change_pin: false };
      else if (u.endsWith('/pwa/me')) res = { uid: 'hs01', student_name: 'Nam', class_code: '9A', grade: 9 };
      else if (u === '/api/pwa/phieu') res = { packs: [{ id: 'ai9_bai2', title: pack.title, grade: 9, so_tiet: 2, thu_tu: 2 }] };
      else if (u === '/api/pwa/phieu/ai9_bai2') res = { pack: view(), bai, nhom: null, gopy: {}, gv: null };
      else if (u.endsWith('/draft')) { if (body.rev !== bai.rev) { st = 409; res = { error: 'REV_CONFLICT', detail: 'x' }; } else { bai = { ...bai, answers: { ...bai.answers, ...body.answers }, rev: bai.rev + 1 }; res = { rev: bai.rev }; } }
      else if (u.endsWith('/lock')) { bai = { ...bai, locked: { hd1_chon: 1, hd1_vi: 1 }, rev: bai.rev + 1 }; res = { rev: bai.rev, locked: bai.locked }; }
      r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(res) });
    });
    await pg.goto(B + '/index.html');
    await pg.click('#gate-student'); await pg.fill('#student-code', 'hs01'); await pg.fill('#student-pin', '123456'); await pg.click('#login-form button[type=submit]'); await pg.waitForTimeout(900);
    const tag = vp.width < 500 ? '[mobile] ' : '';
    ok(await pg.locator('.bottom-nav button').count() === 5, tag + 'menu giữ 5 mục');
    ok(await pg.isVisible('.bottom-nav [data-tab=hocai]'), tag + 'có mục Học AI');
    ok(!(await pg.isVisible('.bottom-nav [data-tab=materials]')), tag + 'Tài liệu đã gộp vào Học');
    await pg.click('.bottom-nav [data-tab=catalog]'); await pg.waitForTimeout(200);
    ok(await pg.isVisible('#catalog-view [data-tab=materials]'), tag + 'nút Tài liệu PDF trong trang Học');
    await pg.click('#catalog-view [data-tab=materials]'); await pg.waitForTimeout(200);
    ok(await pg.isVisible('#materials-view') && (await pg.locator('.bottom-nav [data-tab=catalog]').getAttribute('aria-current')) === 'page', tag + 'Tài liệu mở dưới mục Học');
    await pg.click('.bottom-nav [data-tab=hocai]');
    await pg.waitForSelector('.phieu-card');
    ok(await pg.locator('.bottom-nav [data-tab=hocai]').getAttribute('aria-current') === 'page', tag + 'đánh dấu mục đang mở');
    await pg.click('.phieu-card button');
    await pg.waitForSelector('.phieu-act');
    ok((await pg.textContent('.phieu-act-title')).includes('Tuyển dụng'), tag + 'mở hoạt động 1');
    ok(await pg.locator('.phieu-block .phieu-item').count() >= 6, tag + 'hiện thẻ tuyển dụng');
    // Chốt khi chưa trả lời: báo lỗi dưới trường
    await pg.click('.phieu-lock');
    ok(await pg.locator('[data-field=hd1_chon] .field-error:not([hidden])').count() === 1, tag + 'lỗi hiện dưới trường');
    ok(await pg.locator('[data-field=hd1_chon] fieldset[aria-invalid=true]').count() === 1, tag + 'aria-invalid');
    // Chọn 4 thẻ: thẻ thứ 4 bị chặn
    const boxes = pg.locator('[data-field=hd1_chon] input[type=checkbox]');
    for (let i = 0; i < 4; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
    ok((await pg.locator('[data-field=hd1_chon] input:checked').count()) === 3, tag + 'chỉ chọn đúng 3');
    await pg.fill('#pf-hd1_vi', 'Vì cần học suốt đời');
    await pg.waitForTimeout(1700);
    const put = calls.filter(c => c.u.endsWith('/draft'));
    ok(put.length >= 1 && JSON.stringify(put.map(c => c.body)).includes('Vì cần học suốt đời'), tag + 'tự lưu nháp lên máy chủ');
    ok((await pg.textContent('.phieu-status')).includes('Đã lưu'), tag + 'báo đã lưu');
    // Hủy hộp thoại chốt: không gửi
    await pg.click('.phieu-lock'); await pg.waitForSelector('#msg-dialog[open]');
    await pg.click('#msg-cancel');
    ok(!calls.some(c => c.u.endsWith('/lock')), tag + 'Hủy không chốt');
    await pg.click('.phieu-lock'); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-ok')) === 'Chốt lựa chọn', tag + 'nút mang tên hành động');
    await pg.click('#msg-ok');
    await pg.waitForSelector('.phieu-act .inline-note');
    ok(calls.some(c => c.u.endsWith('/lock')), tag + 'chốt sau xác nhận');
    ok(await pg.locator('#pf-hd1_vi').isDisabled(), tag + 'đã chốt thì khóa ô');
    // Nộp khi còn thiếu: hộp thoại, không gửi nộp
    await pg.click('.phieu-foot button.primary'); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-title')).includes('Còn mục chưa trả lời'), tag + 'báo thiếu khi nộp');
    await pg.click('#msg-ok');
    ok(!calls.some(c => c.u.endsWith('/submit')), tag + 'không nộp khi thiếu');
    // Bảng mục tiêu mẫu chưa mở
    await pg.click('.phieu-steps button:nth-child(3)');
    ok((await pg.textContent('.phieu-act')).includes('thầy cô sẽ mở'), tag + 'học liệu chưa mở chỉ báo, không lộ');
    // Không tràn ngang, không style nội tuyến trong phần Học AI
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tag + 'không tràn ngang');
    ok(await pg.evaluate(() => !document.querySelector('#hocai [style]')), tag + 'không style nội tuyến');
    const small = await pg.evaluate(() => [...document.querySelectorAll('#hocai button')].filter(x => x.offsetParent && x.getBoundingClientRect().height < 44).length);
    ok(small === 0, tag + 'nút đủ lớn để chạm');
    await ctx.close();
  }
  console.log(`test_phieu_ui: ${n} PASS`);
} finally { await b.close(); srv.close(); } })().catch(e => { console.error(e.message); process.exit(1); });
