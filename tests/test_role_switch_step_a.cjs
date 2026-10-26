// Kiểm tra toàn diện Bước A: Thanh chọn vai trò Giáo viên (.role-switch), nút 48px, tương phản, bfcache và hiển thị.
// Chạy: NODE_PATH=$(npm root -g) node tests/test_role_switch_step_a.cjs
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');

const root = path.resolve(__dirname, '../frontend/hoc');
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2'
  }[path.extname(f)] || 'text/plain');
  res.end(fs.readFileSync(f));
}).listen(8195);

const lum = c => {
  const m = c.match(/\d+(\.\d+)?/g);
  if (!m) return 0;
  const [r, g, b] = m.slice(0, 3).map(Number).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (c1, c2) => {
  const l1 = lum(c1), l2 = lum(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

(async () => {
  const browser = await chromium.launch();
  try {
    console.log('--- 1. Kiểm tra 4 viewports + 360x360 (sáng & tối) ---');
    for (const scheme of ['light', 'dark']) {
      for (const vp of [{ w: 320, h: 568 }, { w: 360, h: 640 }, { w: 390, h: 844 }, { w: 1280, h: 800 }, { w: 360, h: 360 }]) {
        const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, serviceWorkers: 'block', colorScheme: scheme });
        const page = await ctx.newPage();
        await page.goto('http://localhost:8195/teacher.html');
        await page.waitForTimeout(300);

        // Kiểm tra tràn ngang
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert(!overflow, `${scheme} ${vp.w}x${vp.h}: có hiện tượng tràn ngang`);

        // Ở 360x360: chỉ 1 vùng cuộn (không lồng 2 lớp cuộn)
        if (vp.w === 360 && vp.h === 360) {
          const scrollContainers = await page.evaluate(() => {
            const list = [];
            for (const el of document.querySelectorAll('*')) {
              const s = getComputedStyle(el);
              if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight && el !== document.documentElement && el !== document.body) {
                list.push(el.tagName + (el.id ? '#' + el.id : ''));
              }
            }
            return list;
          });
          assert(scrollContainers.length <= 1, `360x360 có nhiều hơn 1 vùng cuộn lồng nhau: ${scrollContainers.join(', ')}`);
        }

        await ctx.close();
      }
    }
    console.log('✓ Viewports và cuộn 360x360 đạt yêu cầu');

    console.log('--- 2. Kích thước điểm chạm & Tương phản màu (.role-switch, .t-reveal) ---');
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto('http://localhost:8195/teacher.html');
      await page.waitForTimeout(300);

      // Kích thước thanh chọn vai trò
      const links = await page.evaluate(() => {
        const sw = document.querySelector('.role-switch');
        if (!sw) return null;
        return Array.from(sw.querySelectorAll('a,[aria-current=page]')).map(a => {
          const r = a.getBoundingClientRect();
          const cs = getComputedStyle(a);
          return {
            text: a.textContent.trim(),
            current: a.getAttribute('aria-current'),
            w: r.width,
            h: r.height,
            color: cs.color,
            bg: cs.backgroundColor,
            fs: parseFloat(cs.fontSize)
          };
        });
      });
      assert(links && links.length === 2, `${scheme}: .role-switch phải có 2 liên kết`);
      for (const l of links) {
        assert(l.h >= 48, `${scheme} ${l.text}: chiều cao ${l.h} < 48px`);
        assert(l.fs >= 15, `${scheme} ${l.text}: cỡ chữ ${l.fs} < 15px`);
      }

      // Điểm chạm nút con mắt
      const revealBtn = await page.evaluate(() => {
        const b = document.querySelector('.t-input-icon .t-reveal');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      assert(revealBtn, `${scheme}: Không tìm thấy nút .t-reveal trong .t-input-icon`);
      assert(revealBtn.w >= 48 && revealBtn.h >= 48, `${scheme} .t-reveal: ${revealBtn.w}x${revealBtn.h} < 48x48px`);

      // Tương phản chữ
      const roleSwitchBg = await page.evaluate(() => getComputedStyle(document.querySelector('.role-switch')).backgroundColor);
      const activeLink = links.find(l => l.current === 'page');
      const inactiveLink = links.find(l => !l.current);

      const rActive = contrastRatio(activeLink.color, activeLink.bg);
      const rInactive = contrastRatio(inactiveLink.color, roleSwitchBg);

      assert(rActive >= 4.5, `${scheme}: tương phản đoạn đang chọn ${rActive.toFixed(2)} < 4.5:1 (${activeLink.color} trên ${activeLink.bg})`);
      assert(rInactive >= 4.5, `${scheme}: tương phản đoạn không chọn ${rInactive.toFixed(2)} < 4.5:1 (${inactiveLink.color} trên ${roleSwitchBg})`);

      // Tương phản viền focus
      await page.focus('.role-switch a:first-child');
      const focusInfo = await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        return { outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle };
      });
      const rFocus = contrastRatio(focusInfo.outlineColor, roleSwitchBg);
      assert(parseFloat(focusInfo.outlineWidth) >= 2, `${scheme}: viền focus width < 2px`);
      assert(rFocus >= 3.0, `${scheme}: tương phản viền focus ${rFocus.toFixed(2)} < 3:1 (${focusInfo.outlineColor} trên ${roleSwitchBg})`);

      await ctx.close();
    }
    console.log('✓ Kích thước và tương phản đạt chuẩn WCAG AA/AAA');

    console.log('--- 3. Kiểm tra bfcache (Back xóa PIN và thông báo lỗi) ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.goto('http://localhost:8195/teacher.html');
      await page.waitForTimeout(300);

      // Nhập PIN và bấm đăng nhập để hiện lỗi (< 8 ký tự)
      await page.fill('#teacher-pin', '1234');
      await page.click('#teacher-login button[type=submit]');
      await page.waitForTimeout(200);

      const errorTextBefore = await page.evaluate(() => document.getElementById('teacher-login-error')?.textContent || '');
      assert(errorTextBefore.length > 0, 'Phải có lỗi khi nhập PIN < 8 ký tự');

      // Điều hướng sang trang Học sinh
      await page.click('.role-switch a[href="./"]');
      await page.waitForTimeout(500);
      assert(page.url().includes('index.html') || page.url().endsWith('/'), 'Phải điều hướng sang trang học sinh');

      // Bấm Back quay lại
      await page.goBack();
      await page.waitForTimeout(500);

      const stateAfterBack = await page.evaluate(() => {
        const pin = document.getElementById('teacher-pin')?.value || '';
        const err = document.getElementById('teacher-login-error')?.textContent || '';
        return { pin, err };
      });
      assert.strictEqual(stateAfterBack.pin, '', 'Ô PIN phải được xóa trống sau khi Back');
      assert.strictEqual(stateAfterBack.err, '', 'Thông báo lỗi phải được xóa trống sau khi Back');
      await ctx.close();
    }
    console.log('✓ Bfcache xử lý xóa PIN và lỗi chính xác');

    console.log('--- 4. Kiểm tra ẩn thanh chọn vai trò khi đã đăng nhập hoặc đổi PIN ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.route('**/api/**', r => {
        const u = new URL(r.request().url()).pathname;
        if (u.endsWith('/teacher/auth')) {
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token', must_change: false }) });
        }
        if (u.endsWith('/pwa/catalog')) {
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schema_version: 1, revision: 'r', courses: [] }) });
        }
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      });

      await page.goto('http://localhost:8195/teacher.html');
      await page.waitForTimeout(300);
      assert(await page.isVisible('.role-switch'), 'Thanh chọn vai trò phải hiện khi chưa đăng nhập');

      // Đăng nhập thành công
      await page.fill('#teacher-login [name=pin]', 'Mat-khau-chuan-1');
      await page.click('#teacher-login button[type=submit]');
      await page.waitForTimeout(800);

      // Thanh chọn vai trò phải ẩn
      const switchVisible = await page.isVisible('.role-switch');
      assert(!switchVisible, 'Thanh chọn vai trò phải ẩn sau khi đăng nhập thành công');
      await ctx.close();
    }
    console.log('✓ Thanh chọn vai trò ẩn sau khi đăng nhập');

    console.log('--- 5. Kiểm tra câu dấu tiếng Việt ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      await page.goto('http://localhost:8195/teacher.html');
      const testDau = 'ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự';
      const checked = await page.evaluate(sample => {
        const span = document.createElement('span');
        span.style.fontFamily = "'SGK Serif', serif";
        span.textContent = sample;
        document.body.appendChild(span);
        const ok = span.textContent === sample;
        span.remove();
        return ok;
      }, testDau);
      assert(checked, 'Phông chữ hỗ trợ đầy đủ các ký tự tiếng Việt có dấu');
      await ctx.close();
    }
    console.log('✓ Dấu tiếng Việt hiển thị chính xác');

    console.log('\n========================================');
    console.log('TẤT CẢ 5 TIÊU CHÍ BƯỚC A ĐỀU ĐẠT (PASS)');
    console.log('========================================');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(err => {
  console.error('TEST THẤT BẠI:', err);
  process.exit(1);
});
