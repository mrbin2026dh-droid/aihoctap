// Gói ai9_b2 – giao diện học sinh (DOM thật): bước, nút chọn nhanh, Kiểm tra, ô ngày, dấu ✓, lưu bản đầu, chọn nghề.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_phieu_b2_ui.cjs
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const assert = require('assert');
const root = path.resolve(__dirname, '../frontend/hoc');
const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/phieu/ai9_b2.json'), 'utf8'));
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(f)] || 'x'); r.end(fs.readFileSync(f)); }).listen(8133);
const B = 'http://localhost:8133';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => { const b = await chromium.launch(); try {
  for (const vp of [{ width: 1200, height: 850 }, { width: 375, height: 812 }]) {
    const tag = vp.width < 500 ? '[mobile] ' : '';
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' }); const pg = await ctx.newPage();
    pg.on('dialog', d => { throw new Error('Không được dùng alert/confirm/prompt: ' + d.message()); });
    const calls = []; let bai = { answers: {}, locked: {}, status: 'draft', rev: 0, uid: 'hs01' };
    await pg.route('**/api/**', async r => {
      const u = new URL(r.request().url()).pathname; const body = r.request().postDataJSON?.() || null; calls.push({ u, body });
      let res = { courses: [] };
      if (u.endsWith('/login')) res = { token: 't', must_change_pin: false };
      else if (u.endsWith('/pwa/me')) res = { uid: 'hs01', student_name: 'Nam', class_code: '9A', grade: 9 };
      else if (u === '/api/pwa/phieu') res = { packs: [{ id: 'ai9_b2', title: pack.title, grade: 9, so_tiet: 2 }] };
      else if (u === '/api/pwa/phieu/ai9_b2') res = { pack: { ...pack, locked_blocks: [] }, bai, nhom: null, gopy: {}, gv: null };
      else if (u.endsWith('/draft')) { bai = { ...bai, answers: { ...bai.answers, ...body.answers }, rev: bai.rev + 1 }; res = { rev: bai.rev }; }
      else if (u.endsWith('/kiem')) res = body.the === 'p3_ban_dau' ? { the: body.the, rev: bai.rev, chi_ghi: true, ket_qua: [] }
        : { the: body.the, rev: bai.rev, ket_qua: [{ field: 'p1_v1', dung: true, giai_thich: 'GT_DUNG' }, { field: 'p1_v5', dung: false, giai_thich: 'GT_SAI' }], ten: '', chot: '' };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    });
    await pg.goto(B + '/index.html');
    await pg.click('#gate-student'); await pg.fill('#student-code', 'hs01'); await pg.fill('#student-pin', '123456'); await pg.click('#login-form button[type=submit]'); await pg.waitForTimeout(900);
    await pg.click('.bottom-nav [data-tab=hocai]'); await pg.waitForSelector('.phieu-card'); await pg.click('.phieu-card button'); await pg.waitForSelector('.phieu-act');
    // Phần 1
    ok((await pg.textContent('.phieu-act-title')).includes('Máy giỏi việc gì'), tag + 'mở phần 1');
    ok(await pg.locator('.phieu-hd li').count() === 3, tag + 'hướng dẫn 3 việc');
    ok(await pg.locator('.phieu-the fieldset.is-nut').count() === 8, tag + '8 việc, chọn bằng nút');
    await pg.click('.phieu-kiem');
    ok(await pg.locator('.phieu-the [aria-invalid=true]').count() === 8, tag + 'chưa chọn thì báo dưới từng câu');
    ok(!calls.some(c => c.u.endsWith('/kiem')), tag + 'chưa gửi kiểm tra');
    for (let i = 1; i <= 8; i++) await pg.locator(`[data-field=p1_v${i}] label.option`).nth(0).click();
    await pg.click('.phieu-kiem'); await pg.waitForSelector('[data-field=p1_v5] .phieu-chua');
    ok((await pg.textContent('[data-field=p1_v1]')).includes('GT_DUNG') && (await pg.textContent('[data-field=p1_v5]')).includes('GT_SAI'), tag + 'giải thích dưới từng câu');
    ok((await pg.textContent('.phieu-fb')).includes('Em đúng 1/2'), tag + 'tóm tắt số câu đúng');
    // Phần 2: tình huống A/B/C
    await pg.click('.phieu-steps button:nth-child(2)');
    ok((await pg.textContent('.phieu-the-so')).includes('Tình huống 1 · 1/6'), tag + 'thẻ tình huống 1');
    ok(await pg.locator('[data-field=p2_t1] input[type=radio]').count() === 3, tag + '3 cách xử lí');
    ok(!(await pg.textContent('.phieu-act')).includes('Năng lực cần dùng'), tag + 'không bắt đoán tên năng lực');
    // Phần 3: ô ngày, dấu ✓, lưu bản đầu
    await pg.click('.phieu-steps button:nth-child(3)'); await pg.click('.phieu-buoc button:nth-child(2)');
    ok(await pg.locator('#pf-p3_ngay[type=date]').count() === 1, tag + 'ô chọn ngày');
    await pg.fill('#pf-p3_lam', 'Đọc sách tiếng Anh');
    ok(await pg.locator('[data-field=p3_lam].is-filled').count() === 1 && await pg.locator('[data-field=p3_cach].is-filled').count() === 0, tag + 'dấu ✓ ở ô đã viết');
    ok((await pg.textContent('.phieu-kiem')).trim() === 'Lưu bản đầu', tag + 'nút Lưu bản đầu');
    await pg.click('.phieu-kiem');
    ok(await pg.locator('[data-field=p3_cach] [aria-invalid=true]').count() === 1 && await pg.locator('[data-field=p3_khong_ai] [aria-invalid=true]').count() === 0, tag + 'thiếu ô bắt buộc thì báo, ô tự chọn không bắt');
    await pg.fill('#pf-p3_cach', 'Mỗi tối 15 phút'); await pg.fill('#pf-p3_ngay', '2027-01-15'); await pg.fill('#pf-p3_dat', 'Đọc xong 4 truyện');
    await pg.click('.phieu-kiem'); await pg.waitForSelector('text=Đã lưu bản đầu');
    ok(calls.some(c => c.u.endsWith('/kiem') && c.body.the === 'p3_ban_dau'), tag + 'gửi lưu bản đầu');
    // Phần 4: chưa chọn nghề thì nhắc; chọn rồi mới hiện 4 việc
    await pg.click('.phieu-steps button:nth-child(4)'); await pg.click('.phieu-buoc button:nth-child(2)');
    ok((await pg.textContent('.phieu-the')).includes('Em làm bước trước'), tag + 'nhắc chọn nghề trước');
    await pg.click('.phieu-buoc button:nth-child(1)'); await pg.locator('[data-field=p4_nghe] label.option').nth(0).click();
    ok(await pg.locator('[data-field=p4_nghe] input:checked').count() === 1, tag + 'đã chọn nghề ' + await pg.locator('[data-field=p4_nghe]').count());
    await pg.click('.phieu-buoc button:nth-child(2)'); await pg.waitForSelector('.phieu-the');
    const vis4 = await pg.evaluate(() => [...document.querySelectorAll('.phieu-the .phieu-field')].filter(x => !x.hidden).length); ok(vis4 === 4, tag + 'hiện đúng 4 việc của nghề đã chọn');
    // Chung
    ok(!(await pg.textContent('#hocai')).includes('Bằng chứng nào'), tag + 'không có câu hỏi thảo luận của GV');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tag + 'không tràn ngang');
    ok(await pg.evaluate(() => !document.querySelector('#hocai [style]')), tag + 'không style nội tuyến');
    await ctx.close();
  }
  console.log(`test_phieu_b2_ui: ${n} PASS`);
} finally { await b.close(); srv.close(); } })().catch(e => { console.error(e.message); process.exit(1); });
