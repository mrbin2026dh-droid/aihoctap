// Học AI – trang giáo viên (DOM thật): lớp, mở học liệu có xác nhận, xem bài, đánh giá, trả bài, CSV an toàn, trình soạn.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_phieu_teacher_ui.cjs
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const assert = require('assert');
const root = path.resolve(__dirname, '../frontend/hoc');
const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/phieu/ai9_bai2.json'), 'utf8'));
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(f)] || 'x'); r.end(fs.readFileSync(f)); }).listen(8132);
const B = 'http://localhost:8132';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => { const b = await chromium.launch(); try {
  for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const tag = vp.width < 500 ? '[mobile] ' : '';
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', acceptDownloads: true }); const pg = await ctx.newPage();
    pg.on('dialog', d => { throw new Error('Không được dùng alert/confirm/prompt: ' + d.message()); });
    const ops = [];
    const bai = { hsA: { name: 'Nguyễn An', class_code: '9A', status: 'submitted', rev: 5, nhom: 'n2', answers: { a_t1_lam: '=HYPERLINK("x")', b1_toi_se: 'Đọc to mỗi ngày' }, locked: { hd1_chon: 1 } }, hsB: { name: 'Trần Bình', class_code: '9A', status: 'draft', rev: 1, answers: {} } };
    await pg.route('**/api/**', async r => {
      const u = new URL(r.request().url()).pathname; const body = r.request().postDataJSON?.() || {};
      let res = { courses: [] };
      if (u.endsWith('/teacher/auth')) res = { token: 'tt', must_change: false };
      else if (u.endsWith('/teacher/students')) res = [];
      else if (u === '/api/pwa/teacher/phieu') {
        ops.push(body);
        if (body.op === 'ds') res = { packs: [{ id: 'ai9_bai2', title: pack.title, grade: 9, rev: 1 }], admin: true, classes: null };
        else if (body.op === 'cac_lop') res = { classes: ['9a'] };
        else if (body.op === 'lop') res = { pack, bai, nhom: { n2: { members: { hsA: 'Nguyễn An' }, answers: { n_c1: 'Trước đây ghi tay' }, by: { n_c1: 'hsA' } } }, gv: {}, mo: {}, gopy: {}, dapan: { id: 'ai9_bai2', nguyen_tac: ['Đáp án chỉ giáo viên thấy'] } };
        else if (body.op === 'lich_su') res = { ls: { 5: { answers: bai.hsA.answers } } };
        else if (body.op === 'goi_doc') res = { pack: { ...pack, rev: 1 }, goc: pack, dapan: null, admin: true };
        else if (body.op === 'goi_luu') res = { ok: true, rev: 2 };
        else res = { ok: true };
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    });
    await pg.goto(B + '/teacher.html'); await pg.waitForTimeout(400);
    await pg.fill('#teacher-login [name=pin]', 'Mat-khau-thu-1'); await pg.click('#teacher-login button[type=submit]'); await pg.waitForTimeout(900);
    if (await pg.isVisible('#msg-dialog[open]')) console.log('DIALOG:', await pg.textContent('#msg-title'), '|', await pg.textContent('#msg-body'));
    if (vp.width < 500) {
      ok(!(await pg.isVisible('#nav-hocai')), tag + 'điện thoại: Học AI gộp vào nhóm Bài học');
      await pg.click('#nav-lessons'); await pg.waitForTimeout(300);
      ok(await pg.isVisible('#t-subtabs [data-goto=nav-hocai]'), tag + 'có thanh con Học AI');
      await pg.click('#t-subtabs [data-goto=nav-hocai]');
    } else {
      ok(await pg.isVisible('#nav-hocai'), tag + 'có mục Học AI');
      await pg.click('#nav-hocai');
    }
    await pg.waitForSelector('#hocai-goi');
    await pg.waitForFunction(() => document.querySelector('#hocai-lop')?.value === '9a');
    await pg.click('#hocai-root .t-primary');
    await pg.waitForSelector('#hocai-class table');
    ok((await pg.textContent('#hocai-class')).includes('Nguyễn An'), tag + 'danh sách lớp');
    // Mở học liệu: Hủy không gửi, xác nhận mới gửi
    const openBtn = pg.locator('#hocai-class button', { hasText: 'Mở cho lớp' }).first();
    await openBtn.click(); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-body')).includes('9A'), tag + 'hộp thoại nêu đúng lớp');
    await pg.click('#msg-cancel');
    ok(!ops.some(o => o.op === 'mo'), tag + 'Hủy không mở');
    await openBtn.click(); await pg.waitForSelector('#msg-dialog[open]'); await pg.click('#msg-ok');
    await pg.waitForTimeout(300);
    ok(ops.some(o => o.op === 'mo' && o.block === 'pl925' && o.open === true), tag + 'mở sau xác nhận');
    // CSV: chặn công thức
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#hocai-class button:has-text("Xuất CSV")')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    ok(csv.charCodeAt(0) === 0xfeff, tag + 'CSV có BOM cho Excel');
    ok(csv.includes(`"'=HYPERLINK(""x"")"`), tag + 'CSV vô hiệu công thức');
    ok(csv.includes('9.A3.1') && csv.includes('Số mục bắt buộc còn thiếu'), tag + 'CSV có cột YCCĐ và phần thiếu');
    // Đáp án chỉ ở trang GV
    ok((await pg.textContent('#hocai-class')).includes('Đáp án và gợi ý cho giáo viên'), tag + 'GV xem đáp án');
    // Xem bài, đánh giá, trả bài
    await pg.click('#hocai-class tr:has-text("Nguyễn An") button');
    await pg.waitForSelector('#hocai-nx');
    ok((await pg.textContent('#hocai-class')).includes('Trước đây ghi tay'), tag + 'thấy phần nhóm');
    ok((await pg.textContent('#hocai-class')).includes('ghi: Nguyễn An'), tag + 'thấy người viết phần nhóm');
    await pg.selectOption('#hocai-muc-9_A3_1', 'dat'); await pg.fill('#hocai-nx', 'Mục tiêu cần hạn rõ.');
    await pg.click('.phieu-gv-form button[type=submit]'); await pg.waitForTimeout(300);
    const dg = ops.find(o => o.op === 'danh_gia');
    ok(dg && dg.muc['9.A3.1'] === 'dat' && dg.nhan_xet === 'Mục tiêu cần hạn rõ.', tag + 'lưu đánh giá');
    await pg.click('.phieu-gv-form button:has-text("Trả bài")'); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-ok')) === 'Trả bài', tag + 'xác nhận trả bài');
    await pg.click('#msg-cancel'); ok(!ops.some(o => o.op === 'tra_bai'), tag + 'Hủy không trả');
    await pg.click('.phieu-gv-form button:has-text("Trả bài")'); await pg.waitForSelector('#msg-dialog[open]'); await pg.click('#msg-ok'); await pg.waitForTimeout(300);
    ok(ops.some(o => o.op === 'tra_bai' && o.uid === 'hsA'), tag + 'trả bài sau xác nhận');
    // Trình soạn: sửa nhãn → đánh dấu đã sửa → lưu có xác nhận
    await pg.click('#hocai-class button:has-text("Về danh sách lớp")');
    await pg.click('#hocai-root button:has-text("Sửa nội dung bài")');
    await pg.waitForSelector('#ed-title');
    await pg.locator('#hocai-class details.phieu-gv-act > summary', { hasText: '1. Tuyển dụng năm 2035' }).click();
    await pg.fill('#ed-f-hd1_chon', 'Lúc đầu em chọn ba thẻ số');
    await pg.click('#hocai-class button:has-text("Lưu nội dung")'); await pg.waitForSelector('#msg-dialog[open]'); await pg.click('#msg-ok'); await pg.waitForTimeout(300);
    const sv = ops.find(o => o.op === 'goi_luu');
    ok(sv && JSON.stringify(sv.pack).includes('Lúc đầu em chọn ba thẻ số') && sv.rev === 1, tag + 'lưu nội dung đã sửa kèm rev');
    ok(sv.pack.activities[0].fields.length === pack.activities[0].fields.length, tag + 'không mất trường');
    // Ẩn trường thay vì xóa
    await pg.uncheck('#ed-fh-hd1_vi'); await pg.click('#hocai-class button:has-text("Lưu nội dung")'); await pg.waitForSelector('#msg-dialog[open]'); await pg.click('#msg-ok'); await pg.waitForTimeout(300);
    const sv2 = ops.filter(o => o.op === 'goi_luu').at(-1);
    ok(sv2.pack.activities[0].fields.find(f => f.id === 'hd1_vi').an === true, tag + 'ẩn trường');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tag + 'không tràn ngang');
    ok(await pg.evaluate(() => !document.querySelector('#hocai-root [style]')), tag + 'không style nội tuyến');
    await ctx.close();
  }
  console.log(`test_phieu_teacher_ui: ${n} PASS`);
} finally { await b.close(); srv.close(); } })().catch(e => { console.error(e.message); process.exit(1); });
