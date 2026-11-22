// Màn học sinh cho bài làm bằng trình soạn: đủ 8 dạng câu, mỗi câu một thẻ, Kiểm tra từng câu, tự luận không chấm.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_phieu_soan_ui.cjs   (SHOT_DIR=… để lưu ảnh)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const assert = require('assert');
const root = path.resolve(__dirname, '../frontend/hoc');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(f)] || 'x'); r.end(fs.readFileSync(f)); }).listen(8134);
const B = 'http://localhost:8134';
const SHOT = process.env.SHOT_DIR || '';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const LESSON = { id: 'bthu', title: 'Bài thử 8 dạng', grade: 9, activities: [{ id: 'hmot', title: 'Hoạt động 1', huong_dan: 'Làm từng câu rồi bấm Kiểm tra.', questions: [
  { id: 'cmot', type: 'mot', prompt: 'AI viết sai năm 938, em làm gì?', options: ['Chép luôn', 'Mở sách kiểm tra', 'Hỏi lại AI'], dung: [1], giai_thich: 'x' },
  { id: 'cnhieu', type: 'nhieu', prompt: 'Việc nào máy làm tốt?', options: ['Tính nhanh', 'An ủi bạn', 'Nhớ số điện thoại'], dung: [0, 2], giai_thich: 'x' },
  { id: 'cds', type: 'dung_sai', prompt: 'Đúng hay sai?', items: [{ text: 'AI có thể sai', dap: 'Đúng' }, { text: 'AI luôn đúng', dap: 'Sai' }], giai_thich: 'x' },
  { id: 'cpl', type: 'phan_loai', prompt: 'Xếp việc vào nhóm', nhom: ['Máy', 'Người'], items: [{ text: 'Tính tiền', dap: 'Máy' }, { text: 'Tư vấn khách', dap: 'Người' }], giai_thich: 'x' },
  { id: 'cghep', type: 'ghep', prompt: 'Ghép tình huống với năng lực', items: [{ text: 'AI viết sai', dap: 'Tư duy phản biện' }, { text: 'App mới', dap: 'Học cách học' }], giai_thich: 'x' },
  { id: 'ctt', type: 'thu_tu', prompt: 'Sắp xếp các bước', items: [{ text: 'Hỏi AI' }, { text: 'Kiểm tra bằng sách' }, { text: 'Ghi vào vở' }], giai_thich: 'x' },
  { id: 'cdien', type: 'dien', prompt: 'Ai thắng trận Bạch Đằng năm 938?', chap_nhan: ['Ngô Quyền'], giai_thich: 'x' },
  { id: 'ctl', type: 'tu_luan', prompt: 'Năng lực em thấy cần nhất là gì, vì sao?' }]},
  { id: 'hhai', title: 'Hoạt động 2', questions: [{ id: 'chai', type: 'mot', prompt: 'Câu ở hoạt động 2', options: ['Có', 'Không'], dung: [0], giai_thich: 'x' }] }] };
(async () => {
  const { lessonToPack } = await import('../worker/soan-core.js');
  const { pack } = lessonToPack(LESSON);
  ok(!JSON.stringify(pack).includes('Ngô Quyền'), 'gói HS không có đáp án câu điền');
  const b = await chromium.launch(); try {
    for (const vp of [{ width: 1200, height: 850 }, { width: 375, height: 812 }]) {
      const tag = vp.width < 500 ? '[mobile] ' : '';
      const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' }); const pg = await ctx.newPage();
      pg.on('dialog', d => { throw new Error('Không được dùng alert/confirm/prompt: ' + d.message()); });
      let xoa = false; const calls = []; let bai = { answers: {}, locked: {}, status: 'draft', rev: 0, uid: 'hs01' };
      await pg.route('**/api/**', async r => {
        const u = new URL(r.request().url()).pathname; const body = r.request().postDataJSON?.() || null; calls.push({ u, body });
        let res = { courses: [] };
        if (u.endsWith('/login')) res = { token: 't', must_change_pin: false };
        else if (u.endsWith('/pwa/me')) res = { uid: 'hs01', student_name: 'Nam', class_code: '9A', grade: 9 };
        else if (u === '/api/pwa/phieu') res = { packs: [{ id: 'bthu', title: pack.title, grade: 9 }] };
        else if (u === '/api/pwa/phieu/bthu' && xoa) { r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'PACK_NOT_FOUND', detail: 'Không tìm thấy bài.' }) }); return; }
        else if (u === '/api/pwa/phieu/bthu') res = { pack: { ...pack, locked_blocks: [] }, bai, nhom: null, gopy: {}, gv: null };
        else if (u.endsWith('/draft')) { bai = { ...bai, answers: { ...bai.answers, ...body.answers }, rev: bai.rev + 1 }; res = { rev: bai.rev }; }
        else if (u.endsWith('/kiem')) res = { the: body.the, rev: bai.rev, ket_qua: [{ field: pack.activities[0].buoc[0].the.find(t => t.kiem === body.the).fields[0], dung: true, giai_thich: '' }], ten: '', chot: 'GIAI_THICH_GV' };
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
      });
      await pg.goto(B + '/index.html');
      await pg.click('#gate-student'); await pg.fill('#student-code', 'hs01'); await pg.fill('#student-pin', '123456'); await pg.click('#login-form button[type=submit]'); await pg.waitForTimeout(900);
      await pg.click('.bottom-nav [data-tab=hocai]'); await pg.waitForSelector('.phieu-card'); await pg.click('.phieu-card button'); await pg.waitForSelector('.phieu-the');
      ok(await pg.locator('.phieu-buoc').count() === 0, tag + 'một hoạt động không cần thanh bước');
      ok(await pg.locator('.phieu-steps .phieu-step').count() === 2 && (await pg.textContent('.phieu-act-so')).includes('Hoạt động 1/2'), tag + 'thanh hoạt động gọn, có số thứ tự');
      ok(await pg.locator('.phieu-steps button:nth-child(2)[aria-disabled=true]').count() === 1, tag + 'hoạt động 2 khóa khi chưa xong hoạt động 1');
      await pg.click('.phieu-foot button:has-text("Hoạt động tiếp theo")');
      ok((await pg.textContent('.phieu-status')).includes('trả lời hết các câu') && (await pg.textContent('.phieu-act-so')).includes('Hoạt động 1/2'), tag + 'chưa xong thì không sang hoạt động sau');
      ok((await pg.textContent('.phieu-opt-key >> nth=0')) === 'A' && await pg.locator('.phieu-opt-key').count() === 3, tag + 'lựa chọn có chữ cái A, B, C');
      ok(await pg.locator('.phieu-the legend.visually-hidden').count() === 1, tag + 'bỏ dòng "Chọn một đáp án" thừa');
      ok(await pg.evaluate(() => { const i = document.querySelector('.phieu-opt input'); return i && i.getBoundingClientRect().width <= 1; }), tag + 'ô chọn gốc ẩn, bấm cả dòng');
      ok((await pg.textContent('.phieu-the-so')).includes('Câu 1/8') && await pg.locator('.phieu-tien-do progress').count() === 1, tag + 'thanh tiến độ câu');
      ok((await pg.textContent('.phieu-hd')).includes('Làm từng câu rồi bấm Kiểm tra.'), tag + 'hướng dẫn của giáo viên');
      const next = async () => { await pg.click('.phieu-the-tiep'); await pg.waitForTimeout(150); };
      const shot = async name => { if (SHOT && vp.width < 500) await pg.screenshot({ path: path.join(SHOT, `hs-${name}.png`), fullPage: true }); };
      // 1. Trắc nghiệm 1 đáp án
      ok(await pg.locator('.phieu-the input[type=radio]').count() === 3 && (await pg.textContent('.phieu-the legend')).includes('Chọn một đáp án') && await pg.locator('.phieu-goi-y').count() === 0, tag + 'trắc nghiệm: 3 nút chọn');
      await pg.locator('.phieu-the label.option').nth(1).click(); await pg.click('.phieu-kiem'); await pg.waitForSelector('.phieu-chot');
      ok((await pg.textContent('.phieu-fb')).includes('GIAI_THICH_GV') && await pg.locator('[data-field=cmot].is-dung').count() === 1, tag + 'giải thích sau khi kiểm tra, tô màu ô đúng'); await shot('1-trac-nghiem'); await next();
      // 2. Nhiều đáp án
      ok(await pg.locator('.phieu-the input[type=checkbox]').count() === 3, tag + 'nhiều đáp án: ô tích'); await shot('2-nhieu-dap-an');
      await pg.locator('.phieu-the label.option').nth(2).click(); await pg.locator('.phieu-the label.option').nth(0).click();
      await pg.click('.phieu-kiem'); await pg.waitForSelector('.phieu-chot');
      { const v = calls.filter(c => c.u.endsWith('/draft')).map(c => c.body.answers.cnhieu).filter(Boolean).at(-1) || []; ok(v.length === 2 && v.includes('Tính nhanh') && v.includes('Nhớ số điện thoại'), tag + 'lưu các ô đã tích'); } await next();
      // 3. Đúng/Sai từng ý
      ok(await pg.locator('.phieu-the fieldset.is-nut').count() === 2 && (await pg.textContent('.phieu-goi-y')).includes('Đúng hoặc Sai'), tag + 'đúng/sai: mỗi ý 2 nút, có gợi ý'); await shot('3-dung-sai'); await next();
      // 4. Xếp nhóm
      ok(await pg.locator('.phieu-the fieldset.is-nut').count() === 2 && (await pg.textContent('.phieu-the')).includes('Người'), tag + 'xếp nhóm: chọn nhóm cho từng dòng'); await shot('4-xep-nhom'); await next();
      // 5. Ghép đôi: ô thả xuống
      ok(await pg.locator('.phieu-the select').count() === 2, tag + 'ghép đôi: ô thả xuống'); await shot('5-ghep-doi');
      await pg.selectOption('.phieu-the select >> nth=0', 'Tư duy phản biện'); await pg.selectOption('.phieu-the select >> nth=1', 'Học cách học');
      await pg.click('.phieu-kiem'); await pg.waitForSelector('.phieu-chot'); ok(calls.some(c => c.u.endsWith('/kiem') && c.body.the === 'cghep'), tag + 'kiểm tra câu ghép'); await next();
      // 6. Sắp xếp thứ tự
      ok(await pg.locator('.phieu-the select').count() === 3 && await pg.locator('.phieu-the select >> nth=0').locator('option').count() === 4, tag + 'thứ tự: chọn số 1–3'); await shot('6-thu-tu'); await next();
      // 7. Điền ngắn
      ok(await pg.locator('.phieu-the input[type=text]').count() === 1, tag + 'điền: ô gõ'); await shot('7-dien');
      await pg.click('.phieu-kiem'); ok(await pg.locator('.phieu-the [aria-invalid=true]').count() === 1, tag + 'chưa gõ thì báo dưới ô');
      await pg.fill('.phieu-the input[type=text]', 'ngô quyền'); await pg.click('.phieu-kiem'); await pg.waitForSelector('.phieu-chot'); await next();
      // 8. Tự luận: không có nút Kiểm tra
      ok(await pg.locator('.phieu-the textarea').count() === 1 && await pg.locator('.phieu-kiem').count() === 0, tag + 'tự luận: ô viết, không chấm'); await shot('8-tu-luan');
      ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tag + 'không tràn ngang');
      // Thầy cô xóa bài: chuyển hoạt động thì tải lại, gặp 404 thì về danh sách bài
      xoa = true; await pg.click('.phieu-steps button:nth-child(1)'); await pg.waitForFunction(() => !document.querySelector('.phieu-act'), null, { timeout: 8000 });
      ok(await pg.locator('.phieu-act').count() === 0, tag + 'bài đã xóa thì quay về danh sách');
      ok(await pg.evaluate(() => !document.querySelector('#hocai [style]:not([style=""])')), tag + 'không style nội tuyến: ' + await pg.evaluate(() => document.querySelector('#hocai [style]:not([style=""])')?.outerHTML.slice(0, 200)));
      await ctx.close();
    }
    console.log(`test_phieu_soan_ui: ${n} PASS`);
  } finally { await b.close(); srv.close(); }
})().catch(e => { console.error(e.message); srv.close(); process.exit(1); });
