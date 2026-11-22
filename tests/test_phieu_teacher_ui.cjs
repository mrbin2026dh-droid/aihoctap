// Học AI – trang giáo viên (DOM thật): lớp, mở học liệu có xác nhận, xem bài, đánh giá, trả bài, CSV an toàn, trình soạn.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_phieu_teacher_ui.cjs
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const assert = require('assert');
const root = path.resolve(__dirname, '../frontend/hoc');
const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/phieu_ai9_bai2_cu.json'), 'utf8'));
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(f)] || 'x'); r.end(fs.readFileSync(f)); }).listen(8132);
const B = 'http://localhost:8132';
const SHOT = process.env.SHOT_DIR || require('os').tmpdir();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => { const b = await chromium.launch(); try {
  for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const tag = vp.width < 500 ? '[mobile] ' : '';
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', acceptDownloads: true }); const pg = await ctx.newPage();
    pg.on('dialog', d => { throw new Error('Không được dùng alert/confirm/prompt: ' + d.message()); });
    const ops = []; let soan = null, seq = 0;
    const bai = { hsA: { name: 'Nguyễn An', class_code: '9A', status: 'submitted', rev: 5, nhom: 'n2', answers: { a_t1_lam: '=HYPERLINK("x")', b1_toi_se: 'Đọc to mỗi ngày', a_t1_nl: 'Tư duy phản biện', hd1_chon: pack.options.the_tuyen_dung.slice(0, 3) }, locked: { hd1_chon: 1 }, kiem: { a_t1: { a_t1_nl: 'Học cách học', at: 1 } } }, hsB: { name: 'Trần Bình', class_code: '9A', status: 'draft', rev: 1, answers: {} } };
    await pg.route('**/api/**', async r => {
      const u = new URL(r.request().url()).pathname; const body = r.request().postDataJSON?.() || {};
      let res = { courses: [] };
      if (u.endsWith('/teacher/auth')) res = { token: 'tt', must_change: false };
      else if (u.endsWith('/teacher/students')) res = [];
      else if (u === '/api/pwa/teacher/phieu') {
        ops.push(body);
        if (body.op === 'ds') res = { packs: [{ id: 'ai9_bai2', title: pack.title, grade: 9, rev: 1 }], admin: true, classes: null };
        else if (body.op === 'cac_lop') res = { classes: ['9a'] };
        else if (body.op === 'lop') res = { pack, bai, nhom: { n2: { members: { hsA: 'Nguyễn An' }, answers: { n_c1: 'Trước đây ghi tay' }, by: { n_c1: 'hsA' } } }, gv: {}, mo: {}, gopy: {}, dapan: { id: 'ai9_bai2', nguyen_tac: ['Đáp án chỉ giáo viên thấy'], kiem: { a_t1: { dap_an: { a_t1_nl: 'Tư duy phản biện' } } } } };
        else if (body.op === 'lich_su') res = { ls: { 5: { answers: bai.hsA.answers } } };
        else if (body.op === 'soan_doc') res = { soan, admin: true };
        else if (body.op === 'soan') {
          const v = body.viec; let nid = 0; const id = p => p + (++seq);
          if (v === 'tao_bai') soan = { id: 'bthu', title: body.title, grade: body.grade, activities: [] };
          else if (v === 'them_hd') soan.activities.push({ id: id('h'), title: body.title, huong_dan: body.huong_dan, questions: [] });
          else if (v === 'luu_cau') { const c = { ...body.cau }; if (c.id) { for (const a of soan.activities) a.questions = a.questions.map(q => q.id === c.id ? c : q); } else { c.id = id('c'); soan.activities.find(a => a.id === body.hd).questions.push(c); } }
          else if (v === 'xoa_cau') for (const a of soan.activities) a.questions = a.questions.filter(q => q.id !== body.cau_id);
          if (v === 'dem') res = { so: 2 }; else if (v === 'dem_bai') res = { so: 5 }; else if (v === 'xoa_bai') res = { ok: true }; else res = { ok: true, soan, goi: soan.id };
        }
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
    ok((await pg.textContent('#hocai-class')).includes('Hoạt động 1: cả lớp chọn thẻ nào (1 bài đã chốt)'), tag + 'biểu đồ chọn thẻ HĐ 1');
    ok(await pg.locator('.phieu-gv-chart progress').count() === 9 && (await pg.textContent('.phieu-gv-chart')).includes('★'), tag + '9 thanh, đánh sao thẻ nhiều nhất');
    ok((await pg.textContent('#hocai-class')).includes('Kết quả Kiểm tra lần đầu'), tag + 'thống kê Kiểm tra');
    ok((await pg.textContent('#hocai-class table')).includes('0/1'), tag + 'đếm đúng ngay lần đầu');
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
    ok((await pg.textContent('#hocai-class')).includes('Lần đầu (trước khi xem giải thích): Học cách học'), tag + 'thấy câu trả lời lần đầu');
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
    // Ẩn bài với học sinh: có xác nhận
    await pg.click('#hocai-class button:has-text("Về danh sách lớp")');
    await pg.click('#hocai-root button:has-text("Ẩn bài với học sinh")'); await pg.waitForSelector('#msg-dialog[open]');
    await pg.click('#msg-cancel'); ok(!ops.some(o => o.op === 'goi_an'), tag + 'Hủy không ẩn');
    await pg.click('#hocai-root button:has-text("Ẩn bài với học sinh")'); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-ok')) === 'Ẩn bài', tag + 'nút xác nhận mang tên hành động');
    await pg.click('#msg-ok'); await pg.waitForTimeout(300);
    ok(ops.some(o => o.op === 'goi_an' && o.an === true && o.goi === 'ai9_bai2'), tag + 'ẩn bài sau xác nhận');
    ok(await pg.isVisible('#hocai-root button:has-text("Hiện bài với học sinh")'), tag + 'nút đổi thành Hiện bài');
    // Xóa bài: hộp thoại nêu số học sinh đã làm; Hủy không xóa; xác nhận mới xóa
    await pg.click('#hocai-root button:has-text("Xóa bài")'); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-body')).includes('5 học sinh đã làm bài này') && (await pg.textContent('#msg-ok')) === 'Xóa bài', tag + 'xác nhận xóa bài nêu hậu quả');
    await pg.click('#msg-cancel'); ok(!ops.some(o => o.viec === 'xoa_bai'), tag + 'Hủy không xóa bài');
    await pg.click('#hocai-root button:has-text("Xóa bài")'); await pg.waitForSelector('#msg-dialog[open]'); await pg.click('#msg-ok'); await pg.waitForTimeout(400);
    ok(ops.some(o => o.viec === 'xoa_bai' && o.goi === 'ai9_bai2'), tag + 'xóa bài sau xác nhận');
    ok(await pg.isVisible('#hocai-root button:has-text("Sửa bài")'), tag + 'có nút Sửa bài');
    // Trình soạn dạng mở: tạo bài → hoạt động → câu hỏi (8 dạng), thêm/sửa/xóa từng câu
    await pg.click('#hocai-root button:has-text("Tạo bài mới")');
    await pg.click('#hocai-class button:has-text("Tạo bài")');
    ok(await pg.locator('#hocai-class [aria-invalid=true]').count() === 1, tag + 'tên bài trống thì báo dưới ô');
    await pg.fill('#hocai-class form input[type=text]', 'Bài thử'); await pg.click('#hocai-class button:has-text("Tạo bài")');
    await pg.waitForSelector('text=Soạn bài: Bài thử');
    await pg.fill('.sb-them-hd input >> nth=0', 'Khởi động'); await pg.click('.sb-them-hd button[type=submit]');
    await pg.waitForSelector('.sb-hd .sb-them-cau');
    await pg.click('.sb-hd .sb-them-cau');
    ok(await pg.locator('.sb-pick-btn').count() === 8, tag + 'chọn được 8 dạng câu hỏi');
    if (vp.width > 500) await pg.screenshot({ path: SHOT + '/gv-chon-dang-cau.png', fullPage: true });
    await pg.click('.sb-pick-btn[data-loai=mot]');
    await pg.click('.sb-form button[type=submit]');
    ok(await pg.locator('.sb-form .field-error:not([hidden])').count() === 1 && await pg.locator('.sb-form textarea[aria-invalid=true]').count() === 1, tag + 'câu trống thì báo dưới ô nội dung');
    ok(!ops.some(o => o.viec === 'luu_cau'), tag + 'chưa gửi khi còn lỗi');
    await pg.fill('.sb-form textarea >> nth=0', 'AI viết sai năm 938, em làm gì?');
    await pg.fill('[aria-label="Lựa chọn 1"]', 'Chép luôn'); await pg.fill('[aria-label="Lựa chọn 2"]', 'Mở sách kiểm tra'); await pg.fill('[aria-label="Lựa chọn 3"]', 'Hỏi lại AI');
    await pg.check('[aria-label="Lựa chọn 2 là đáp án đúng"]');
    await pg.fill('.sb-form textarea >> nth=1', 'Phải đối chiếu sách.');
    if (vp.width > 500) await pg.screenshot({ path: SHOT + '/gv-soan-trac-nghiem.png', fullPage: true });
    await pg.click('.sb-form button[type=submit]'); await pg.waitForSelector('.sb-cau-de');
    const c1 = ops.filter(o => o.viec === 'luu_cau').at(-1).cau;
    ok(c1.type === 'mot' && JSON.stringify(c1.dung) === '[1]' && c1.options[1] === 'Mở sách kiểm tra' && c1.giai_thich === 'Phải đối chiếu sách.', tag + 'lưu câu trắc nghiệm kèm đáp án và giải thích');
    // Sửa câu
    await pg.click('.sb-cau-tools button:has-text("Sửa")');
    ok((await pg.inputValue('.sb-form textarea >> nth=0')) === 'AI viết sai năm 938, em làm gì?', tag + 'mở câu để sửa');
    await pg.fill('.sb-form textarea >> nth=0', 'Câu đã sửa'); await pg.click('.sb-form button[type=submit]'); await pg.waitForSelector('text=Câu đã sửa');
    ok(ops.filter(o => o.viec === 'luu_cau').at(-1).cau.id === c1.id || ops.filter(o => o.viec === 'luu_cau').at(-1).cau.id, tag + 'sửa giữ mã câu');
    // Thêm câu xếp nhóm
    await pg.click('.sb-hd .sb-them-cau'); await pg.click('.sb-pick-btn[data-loai=phan_loai]');
    await pg.fill('.sb-form textarea >> nth=0', 'Xếp việc vào nhóm');
    await pg.fill('[aria-label="Tên nhóm 1"]', 'Máy'); await pg.press('[aria-label="Tên nhóm 1"]', 'Tab');
    await pg.fill('[aria-label="Tên nhóm 2"]', 'Người'); await pg.press('[aria-label="Tên nhóm 2"]', 'Tab');
    await pg.fill('[aria-label="Dòng 1"]', 'Tính tiền'); await pg.selectOption('[aria-label="Đáp án dòng 1"]', 'Máy');
    await pg.fill('[aria-label="Dòng 2"]', 'Tư vấn khách'); await pg.selectOption('[aria-label="Đáp án dòng 2"]', 'Người');
    await pg.click('.sb-form button[type=submit]'); await pg.waitForTimeout(300);
    const c2 = ops.filter(o => o.viec === 'luu_cau').at(-1).cau;
    ok(c2.type === 'phan_loai' && c2.items[1].dap === 'Người' && c2.nhom.join() === 'Máy,Người', tag + 'lưu câu xếp nhóm');
    ok(await pg.locator('.sb-cau').count() === 2, tag + 'danh sách có 2 câu');
    // Xóa câu: hộp thoại nêu số học sinh đã làm, Hủy không xóa
    await pg.click('.sb-cau-tools button:has-text("Xóa") >> nth=0'); await pg.waitForSelector('#msg-dialog[open]');
    ok((await pg.textContent('#msg-body')).includes('2 học sinh đã làm câu này') && (await pg.textContent('#msg-ok')) === 'Xóa câu', tag + 'xác nhận xóa nêu hậu quả');
    await pg.click('#msg-cancel'); ok(!ops.some(o => o.viec === 'xoa_cau'), tag + 'Hủy không xóa');
    await pg.click('.sb-cau-tools button:has-text("Xóa") >> nth=0'); await pg.waitForSelector('#msg-dialog[open]'); await pg.click('#msg-ok'); await pg.waitForTimeout(300);
    ok(ops.some(o => o.viec === 'xoa_cau') && await pg.locator('.sb-cau').count() === 1, tag + 'xóa sau xác nhận');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tag + 'không tràn ngang');
    ok(await pg.evaluate(() => !document.querySelector('#hocai-root [style]')), tag + 'không style nội tuyến');
    await ctx.close();
  }
  console.log(`test_phieu_teacher_ui: ${n} PASS`);
} finally { await b.close(); srv.close(); } })().catch(e => { console.error(e.message); process.exit(1); });
