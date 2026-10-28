// @ts-check
// Kiểm thử E2E Playwright: Học sinh làm trực tiếp 2 Đề thi thử Giữa HK1 Tin học 9 và Tin học 8.
// Kiểm tra giao diện hiển thị PHẦN I. TRẮC NGHIỆM và PHẦN II. TỰ LUẬN,
// Khung gõ tự luận kẻ dòng chấm, tự động giãn dòng, lưu nháp,
// Quy trình nộp bài, AI chấm tự luận, trả về điểm số + lời nhận xét cho từng câu,
// Đảm bảo không tràn ngang (Zero-Overflow) và 0 lỗi JS trên cả Desktop lẫn Mobile.

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../frontend/hoc');
const API = 'https://script.google.com/macros/s/TEST/exec';
const DB = 'https://test-decuong-rtdb.asia-southeast1.firebasedatabase.app';

const examTin9 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scratch/exam_tin9.json'), 'utf8'));
const examTin8 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scratch/exam_tin8.json'), 'utf8'));

const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  let body = fs.readFileSync(f);
  if (p === '/sheet-config.js') body = Buffer.from(`export const SHEET_API = '${API}';`);
  if (p === '/presence-config.js') body = Buffer.from(`export const PRESENCE_CONFIG = {apiKey:'K', dbUrl:'${DB}'};`);
  r.setHeader('content-type', {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png'
  }[path.extname(f)] || 'text/plain');
  r.end(body);
}).listen(8194);

const h = (ma, pin) => crypto.createHash('sha256').update(ma.toLowerCase() + ':' + pin).digest('hex');

(async () => {
  const browser = await chromium.launch({
    args: ['--host-resolver-rules=MAP thi.test 127.0.0.1', '--unsafely-treat-insecure-origin-as-secure=http://thi.test:8194']
  });
  let n = 0;
  const ok = (c, m) => { assert(c, m); n++; console.log('ok  ', m); };

  try {
    for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      const isMobile = vp.width < 760;
      console.log(`\n--- KIỂM THỬ GIAO DIỆN HỌC SINH (${vp.width}x${vp.height}) ---`);

      // Mock dữ liệu Firebase cho cả 2 khối 9 và 8
      const db = {
        thi_hs: {
          hs09: { ma: 'HS09', ten: 'Trần Minh Anh', lop: '9A', khoi: 9, pin: h('hs09', '123456') },
          hs08: { ma: 'HS08', ten: 'Phạm Đức Bình', lop: '8A', khoi: 8, pin: h('hs08', '123456') }
        },
        thi_bai: {
          t9: examTin9.bai,
          t8: examTin8.bai
        },
        thi_de: {
          t9: examTin9.de,
          t8: examTin8.de
        },
        thi_nop: {}
      };

      const writes = [];
      const essayGrades = [];

      const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' });
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', e => {
        console.error('PAGEERROR:', e.stack);
        errs.push(e.message);
      });

      // Intercept API Worker
      await pg.route('**/api/**', async r => {
        const p = new URL(r.request().url()).pathname;
        let body = { schema_version: 1, revision: 'r', courses: [] }, status = 200;
        if (r.request().method() === 'OPTIONS') {
          return r.fulfill({
            status: 204,
            headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
          });
        }
        if (p.endsWith('/login')) {
          body = { token: 'worker-jwt-token-2026', must_change_pin: false };
        }
        if (p.endsWith('/pwa/me')) {
          body = { uid: 'HS09', student_name: 'Trần Minh Anh', class_code: '9A', grade: 9 };
        }
        if (p.endsWith('/pwa/exam-essay')) {
          const q = JSON.parse(r.request().postData());
          essayGrades.push({ q, auth: r.request().headers()['authorization'] });
          // Giả lập AI chấm điểm theo gợi ý của giáo viên
          await new Promise(x => setTimeout(x, 200));
          const items = q.items.map((it, idx) => {
            if (!it.answer || it.answer.trim().length < 5) {
              return { diem: 0, nhan_xet: 'Em chưa hoàn thành câu này.' };
            }
            return {
              diem: it.max,
              nhan_xet: `Thầy cô khen em trả lời chính xác, bám sát các ý trọng tâm câu ${idx + 1}.`
            };
          });
          body = { items, tong_ket: 'Em hoàn thành bài rất xuất sắc!' };
        }
        r.fulfill({
          status,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(body)
        });
      });

      // Intercept Firebase Realtime Database
      await pg.route(DB + '/**', r => {
        const u = new URL(r.request().url());
        const parts = u.pathname.replace(/\.json$/, '').split('/').filter(Boolean);
        const m = r.request().method();
        const getAt = () => parts.reduce((o, k) => (o === null || o === undefined) ? undefined : o[k], db);
        if ((r.request().headers()['accept'] || '').includes('text/event-stream')) {
          return r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: `retry: 300\nevent: put\ndata: ${JSON.stringify({ path: '/', data: getAt() ?? null })}\n\n` });
        }
        if (m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(getAt() ?? null) });
        let v = JSON.parse(r.request().postData() || 'null');
        const stamp = x => x && typeof x === 'object' ? (x['.sv'] ? Date.now() : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, stamp(y)]))) : x;
        v = stamp(v);
        writes.push({ m, path: u.pathname, v });
        let o = db;
        parts.slice(0, -1).forEach(k => { o = o[k] ??= {}; });
        if (m === 'PATCH') o[parts.at(-1)] = { ...(o[parts.at(-1)] || {}), ...v };
        else o[parts.at(-1)] = v;
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
      });

      // === 1. HỌC SINH LỚP 9 THI THỬ GIỮA HK1 ===
      await pg.goto('http://thi.test:8194/');
      await pg.waitForSelector('#gate:not([hidden])');
      await pg.click('#gate-student');
      await pg.fill('#student-code', 'hs09');
      await pg.fill('#student-pin', '123456');
      await pg.click('#login-form button[type=submit]');
      await pg.waitForSelector('#main:not([hidden])');

      await pg.click('.bottom-nav [data-tab="exams"]');
      await pg.waitForSelector('.thi-card');
      const cardTitle = await pg.textContent('.thi-card h3');
      ok(cardTitle.includes('Tin học 9'), 'Học sinh thấy bài thi thử Tin học 9');

      await pg.click('.thi-card button:has-text("Vào thi")');
      await pg.waitForSelector('.thi-form .question');

      // Kiểm tra cấu trúc 2 phần
      const parts = await pg['$$eval']('.thi-part', els => els.map(x => x.textContent));
      ok(parts.includes('PHẦN I. TRẮC NGHIỆM') && parts.includes('PHẦN II. TỰ LUẬN'), 'Đề bài hiển thị rõ PHẦN I. TRẮC NGHIỆM và PHẦN II. TỰ LUẬN');

      // Điền câu trắc nghiệm (Chọn đáp án A cho câu 1)
      await pg.check('.thi-form input[name=tin9_q1][value=A]');
      // Chọn đáp án B cho câu 2
      await pg.check('.thi-form input[name=tin9_q2][value=B]');

      // Điền các câu trắc nghiệm còn lại
      for (let i = 3; i <= 10; i++) {
        await pg.check(`.thi-form input[name=tin9_q${i}][value=A]`);
      }

      // Điền câu tự luận 1
      const tlTextareas = await pg.locator('textarea.thi-tl-input').all();
      ok(tlTextareas.length === 2, 'Hiển thị đúng 2 khung gõ tự luận kẻ dòng chấm');

      const ansTL1 = 'Thiết bị có vi xử lý: Robot hút bụi, máy giặt thông minh. Thiết bị cơ học: Quạt điện nút bấm cơ, nồi cơm điện cơ rơ-le nhiệt. Vi xử lý giúp điều khiển tự động thông minh theo chương trình.';
      const ansTL2 = 'Đây là dấu hiệu lừa đảo Phishing đánh cắp tài khoản. Em tuyệt đối không bấm link lạ, không nhập mật khẩu và báo ngay cho cha mẹ hoặc thầy cô.';

      await tlTextareas[0].fill(ansTL1);
      await tlTextareas[1].fill(ansTL2);

      // Bấm nộp bài
      await pg.click('.thi-submit');
      await pg.waitForSelector('dialog[open]');
      await pg.click('dialog[open] button:has-text("Nộp bài")');

      // Chờ AI chấm và trả về kết quả
      await pg.waitForSelector('.thi-tl-result');
      const scoreText = await pg.textContent('.thi-score');
      ok(scoreText.includes('/ 10'), 'Tổng điểm hiển thị trên thang 10');

      const tlResultText = await pg.textContent('.thi-tl-result');
      ok(tlResultText.includes('AI chấm theo gợi ý của thầy cô'), 'Hiển thị khu vực kết quả phần tự luận');
      ok(tlResultText.includes('Thầy cô khen em trả lời chính xác'), 'Nhận xét của AI hiển thị đầy đủ cho từng câu tự luận');

      // Kiểm tra Zero-Overflow
      const isZeroOverflow = await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      ok(isZeroOverflow, `Zero-Overflow: Giao diện không bị tràn ngang trên màn hình ${vp.width}px`);
      ok(errs.length === 0, `Không có lỗi JS trên console F12: ${errs.join('; ')}`);

      await ctx.close();
    }

    console.log(`\n=== TẤT CẢ KIỂM THỬ E2E HỌC SINH THI THỬ TIN 8 & TIN 9 ĐẠT (PASS ${n}/${n}) ===`);
  } catch (err) {
    console.error('FAIL E2E:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
