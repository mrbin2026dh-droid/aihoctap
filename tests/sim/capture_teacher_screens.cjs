// @ts-check
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const root = path.join(process.cwd(), 'frontend', 'hoc');
  const shotDir = path.join(process.cwd(), 'docs', 'handoff', 'anh', 'mo-phong-29-10');
  fs.mkdirSync(shotDir, { recursive: true });

  const srv = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/teacher.html';
    const f = path.join(root, p);
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
    const ext = path.extname(f);
    res.setHeader('content-type', {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json'
    }[ext] || 'application/octet-stream');
    res.end(fs.readFileSync(f));
  }).listen(8235);

  const fbData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'sim', 'out', 'firebase-9TH.json'), 'utf8'));
  const accList = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sim-accounts.json'), 'utf8'));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Bắt các route Firebase
  await page.route('**/*firebasedatabase.app/**', async r => {
    const u = new URL(r.request().url());
    if (u.pathname.includes('presence')) {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fbData.presence || {}) });
    } else if (u.pathname.includes('thoi_gian')) {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fbData.thoi_gian || {}) });
    } else if (u.pathname.includes('doc_read')) {
      // Nếu truy vấn 1 bài cụ thể (doc_read/tin-hoc-9~bai-1.json)
      const parts = u.pathname.split('/');
      const key = parts[parts.length - 1].replace('.json', '');
      if (fbData.doc_read && fbData.doc_read[key]) {
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fbData.doc_read[key]) });
      } else {
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fbData.doc_read || {}) });
      }
    } else if (u.pathname.includes('thi_hs')) {
      const hsObj = {};
      for (const a of accList) {
        hsObj[a.ma.toLowerCase()] = { ma: a.ma, ten: a.ten, lop: '9TH', khoi: 9, h: 'exists' };
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hsObj) });
    } else if (u.pathname.includes('thi_bai')) {
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'bai-thi-thu-1': { tieu_de: 'Đề kiểm tra Tin học 9 Giữa kì I', che_do: 'thu', lop: '9TH', khoi: 9, thoi_luong: 20, so_cau: 10 }
        })
      });
    } else if (u.pathname.includes('nang_luc')) {
      const nlObj = {};
      for (const a of accList) {
        nlObj[a.ma.toLowerCase()] = {
          topics: {
            't1': { ten: 'Thiết bị số và bộ xử lí', d: a.nhom === 'A' ? 9 : (a.nhom === 'B' ? 7 : 4), n: 10 },
            't2': { ten: 'Xử lý dữ liệu bảng tính', d: a.nhom === 'A' ? 8 : (a.nhom === 'B' ? 6 : 3), n: 10 }
          }
        };
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nlObj) });
    } else if (u.pathname.includes('thi_nop')) {
      const nopObj = {};
      for (const a of accList.slice(0, 26)) {
        nopObj[a.ma.toLowerCase()] = {
          diem: a.nhom === 'A' ? 9 : (a.nhom === 'B' ? 6 : 3),
          so_cau: 10,
          at: Date.now() - 3600000
        };
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nopObj) });
    } else {
      r.continue();
    }
  });

  // Bắt các route Worker API
  await page.route('**/api/**', async r => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith('/teacher/auth')) {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token', must_change: false }) });
    } else if (u.pathname.endsWith('/pwa/catalog')) {
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema_version: 1,
          revision: 'r2026',
          courses: [
            {
              id: 'tin-hoc-9',
              grade: 9,
              subject_id: 'tin-hoc',
              subject_name: 'Tin học',
              title: 'Tin học 9',
              lessons: [
                { id: 'bai-1', title: 'Bài 1: Thế giới kĩ thuật số' },
                { id: 'bai-2', title: 'Bài 2: Thực hành: Xử lý dữ liệu bảng tính nâng cao' },
                { id: 'bai-10', title: 'Bài 10: Thông tin trong giải quyết vấn đề' }
              ]
            }
          ]
        })
      });
    } else if (u.pathname.endsWith('/teacher/analytics')) {
      const analytics = {
        generated_at: Date.now(),
        total_attempts: 101,
        classes: ['9TH'],
        class_filter: '9TH',
        topics: [
          { topic: 'Thiết bị số và bộ xử lí thông tin', correct: 18, total: 24, percent: 75, level: 'good' },
          { topic: 'Ưu thế của máy tính điện tử', correct: 14, total: 24, percent: 58, level: 'fair' }
        ],
        lessons: [
          { course_id: 'tin-hoc-9', lesson_id: 'bai-1', title: 'Bài 1: Thế giới kĩ thuật số', is_exam: false, students: 26, attempts: 60, avg_percent: 68, level: 'fair', questions: [] },
          { course_id: 'tin-hoc-9', lesson_id: 'bai-2', title: 'Bài 2: Thực hành: Xử lý dữ liệu bảng tính nâng cao', is_exam: false, students: 15, attempts: 32, avg_percent: 62, level: 'fair', questions: [] },
          { course_id: 'tin-hoc-9', lesson_id: 'bai-10', title: 'Bài 10: Thông tin trong giải quyết vấn đề', is_exam: false, students: 6, attempts: 9, avg_percent: 78, level: 'good', questions: [] }
        ],
        students: accList.slice(0, 26).map((a, i) => ({
          uid: a.ma,
          name: a.ten,
          class_code: '9TH',
          lessons: a.nhom === 'A' ? 3 : (a.nhom === 'B' ? 2 : 1),
          avg_percent: a.nhom === 'A' ? 82 : (a.nhom === 'B' ? 65 : 42),
          level: a.nhom === 'A' ? 'good' : (a.nhom === 'B' ? 'fair' : 'weak'),
          last_at: Date.now() - (i * 60000),
          weak_topics: a.nhom === 'C' ? ['Thiết bị số'] : [],
          items: []
        }))
      };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analytics) });
    } else {
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
  });

  // Bắt Google Apps Script
  await page.route('https://script.google.com/**', async r => {
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        admin: true,
        students: accList.map(a => ({ ma: a.ma, ten: a.ten, lop: '9TH', trang_thai: 'Hoạt động' })),
        classes: { '9TH': 30 }
      })
    });
  });

  await page.goto('http://localhost:8235/teacher.html');
  await page.waitForTimeout(500);

  // Đăng nhập giáo viên
  await page.fill('#teacher-login [name=pin]', '12345678');
  await page.click('#teacher-login button[type=submit]');
  await page.waitForSelector('#workspace:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Thêm watermark nhãn mô phỏng lên đầu màn hình
  await page.evaluate(() => {
    const banner = document.createElement('div');
    banner.id = 'sim-banner-label';
    banner.textContent = 'KIỂM THỬ MÔ PHỎNG – lớp 9TH, không phải học sinh thật';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#e11d48;color:#fff;text-align:center;font-weight:700;font-size:14px;padding:6px;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
    document.body.prepend(banner);
  });

  // 1. Chụp Tổng quan (chọn lớp 9TH)
  if (await page.locator('#overview-class').count()) {
    await page.selectOption('#overview-class', '9TH');
    await page.waitForTimeout(800);
  }
  const f1 = path.join(shotDir, '01_tong_quan_lop_9TH.png');
  await page.screenshot({ path: f1, fullPage: false });
  console.log('Đã chụp 01:', f1);

  // 2. Chụp Học sinh đọc bài (cuộn tới #read-report)
  const readSec = page.locator('#read-report');
  await readSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  // Chọn bài 1 để bảng chi tiết hiện học sinh
  if (await page.locator('#read-lesson').count()) {
    try {
      await page.selectOption('#read-lesson', 'tin-hoc-9~bai-1');
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Lưu ý chọn bài đọc:', e.message);
    }
  }
  const f2 = path.join(shotDir, '02_hoc_sinh_doc_bai_9TH.png');
  await page.screenshot({ path: f2, fullPage: false });
  console.log('Đã chụp 02:', f2);

  // 3. Chụp Tài khoản lớp 9TH
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#nav-accounts');
  await page.waitForTimeout(1000);
  if (await page.locator('#acc-hs-lop').count()) {
    await page.selectOption('#acc-hs-lop', '9TH');
    await page.waitForTimeout(800);
  }
  const f3 = path.join(shotDir, '03_tai_khoan_lop_9TH.png');
  await page.screenshot({ path: f3, fullPage: false });
  console.log('Đã chụp 03:', f3);

  // 4. Chụp Hiệu quả
  await page.click('#nav-effect');
  await page.waitForTimeout(1000);
  if (await page.locator('#eff-lop').count()) {
    await page.selectOption('#eff-lop', '9TH');
    await page.waitForTimeout(800);
  }
  const f4 = path.join(shotDir, '04_hieu_qua_lop_9TH.png');
  await page.screenshot({ path: f4, fullPage: false });
  console.log('Đã chụp 04:', f4);

  await browser.close();
  srv.close();
  console.log('HOÀN THÀNH CHỤP ĐỦ 4 ẢNH MINH CHỨNG!');
})();
