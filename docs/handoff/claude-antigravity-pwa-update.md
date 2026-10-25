# Claude → Antigravity: cập nhật PWA không treo (P1–P7) + deploy cho người dùng thử
Đọc AGENTS.md (F, G, I, L). Làm cùng đợt với `claude-antigravity-settings-fix.md`. Không deploy trước khi Claude ACCEPT.

## P2 — công cụ đóng dấu + CI
Sao `scratch/aihoctap-clean/tools/package_student_pwa.py` vào `tools/` (Claude đã đặt bản sẵn ở `tools/package_student_pwa.py`; nếu có rồi thì dùng). Thêm vào `SHELL_FILES` KHÔNG thêm `sw.js`, `teacher.*`. Thêm chế độ `--check` thuần kiểm (không ghi): `python tools/package_student_pwa.py` (không cờ) đã gọi `check_shell` – giữ.
`.github/workflows/deploy-pages.yml`, thêm TRƯỚC bước "Upload Student PWA Artifact":
```yaml
      - name: Stamp and verify service worker
        run: |
          python tools/package_student_pwa.py --stamp
          python tools/package_student_pwa.py
```
Chạy tay `--stamp` trên máy, commit `sw.js` đã đóng dấu (P1): băm phải khớp byte của shell cuối cùng (sau khi sửa S1–S5 và P3–P7, vì mọi sửa đổi vào shell đều đổi băm).

## P3 — precache bỏ qua cache HTTP (`sw.js`)
```js
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(FILES.map(async path => {
    const response = await fetch(new Request(path, { cache: 'reload' }));
    if (!response.ok) throw new Error(`Không nạp được ${path}: ${response.status}`);
    await cache.put(new Request(path), response);
  }))));
});
```
(Không `skipWaiting` ở install; giữ cơ chế ACTIVATE.)

## P6 — điều hướng có query
Trong `fetch` handler, trước khi kiểm `ALLOWED`:
```js
if (event.request.mode === 'navigate' && new URL(event.request.url).origin === self.location.origin) {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html') {
    event.respondWith(caches.open(CACHE).then(async c => (await c.match(new URL('./index.html', scope).href)) || fetch(event.request)));
    return;
  }
}
```

## P4, P5, P7 — `app.js` (thay khối đăng ký SW, ~766–775)
```js
let updateRequested = false, hadController = Boolean(navigator.serviceWorker?.controller);
const swVersion = () => (document.documentElement.dataset.build || '');
async function checkForUpdate(manual = false) {
  if (!registration || !navigator.onLine) { if (manual) await confirmBox({title:'Không kiểm tra được', body:'Cần kết nối mạng để kiểm tra cập nhật.', okText:'Đã hiểu', kind:'notice'}); return; }
  try { await registration.update(); } catch { if (manual) await confirmBox({title:'Chưa kiểm tra được', body:'Thử lại sau.', okText:'Đã hiểu', kind:'notice'}); return; }
  const has = Boolean(registration.waiting || registration.installing);
  if (manual && !has) await confirmBox({title:'Đã là bản mới nhất', body:`Phiên bản ${swVersion()}.`, okText:'Đã hiểu', kind:'notice'});
}
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }     // lần cài đầu: không tải lại
    if (reloading) return;
    if (updateRequested) { reloading = true; location.reload(); return; }
    node('update-text').textContent = 'Ứng dụng vừa cập nhật ở cửa sổ khác. Tải lại để dùng bản mới.';
    node('update-notice').hidden = false; node('update-notice').dataset.reload = '1';   // P5
  });
  navigator.serviceWorker.register('./sw.js', {scope:'./'}).then(result => {
    registration = result;
    const check = () => { if (result.waiting && navigator.serviceWorker.controller) node('update-notice').hidden = false; };
    check(); result.addEventListener('updatefound', () => result.installing?.addEventListener('statechange', check));
    setInterval(() => checkForUpdate(), 60 * 60 * 1000);                       // P4: mỗi giờ
    window.addEventListener('online', () => checkForUpdate());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  }).catch(report);
}
```
`on('update-app', ...)`: nếu `node('update-notice').dataset.reload` → `await saveDraft(); location.reload(); return;`; ngược lại giữ logic cũ nhưng đặt `updateRequested = true` ngay trước `registration?.waiting?.postMessage({type:'ACTIVATE'})`, và nếu `registration.waiting` rỗng thì gọi `checkForUpdate()` và `notify('Đang kiểm tra bản cập nhật…')`. Dùng `withBusy(btn,'Đang cập nhật…')` cho nút. Trong `index.html` đổi `<span>` thành `<span id="update-text">Ứng dụng có bản cập nhật.</span>`. Nếu người dùng chưa sẵn sàng: thông báo dùng `confirmBox`/`noticeBox` thay `notify` (mục I).
P7: trong `#panel-help` thêm khối "Ứng dụng": `<p>Phiên bản: <span id="app-version"></span></p><button id="check-update">Kiểm tra cập nhật</button>`; `on('check-update', () => withBusy(btn,'Đang kiểm tra…', () => checkForUpdate(true)))`. Phiên bản: SW trả về qua `postMessage`: trong `sw.js` `message` handler thêm `if (event.data?.type==='VERSION') event.source.postMessage({type:'VERSION', value: CACHE.slice(-8)})`; app nghe `navigator.serviceWorker.addEventListener('message', …)` và hiển thị. Đặt `document.documentElement.dataset.build` khi nhận.

## Tương thích ngược (mục L)
IndexedDB `db.js`: chỉ thêm store mới (giữ `contains()`), tăng số phiên bản khi thêm, không đổi tên/xóa. Worker: thêm trường/đường dẫn mới, không đổi nghĩa trường cũ trong ít nhất 1 đợt phát hành.

## Test FAIL-first (`tests/test_pwa_update_integrity.py`/`.mjs`)
- T1: `python tools/package_student_pwa.py` thoát 0 (dấu khớp); đổi 1 byte của `app.js` tạm → thoát ≠ 0.
- T2: workflow chứa bước `--stamp` đứng trước `upload-pages-artifact`.
- T3 (Playwright): cài v1; máy chủ phục vụ v2 (đổi `app.js` + dấu SW mới) kèm `Cache-Control: max-age=600` cho cả tệp cũ → `registration.update()` → thông báo hiện; bấm cập nhật → tải lại ≤5 giây; trang đã chạy mã v2 (không phải v1) và cache v2 chứa v2.
- T4: có nháp bài chưa nộp → bấm cập nhật bị chặn bằng hộp thoại; nháp giữ nguyên (test_pwa_update.py cũ chạy lại).
- T5: hai trang cùng scope: trang A cập nhật → trang B hiện thông báo "Tải lại", không tự tải lại khi có nháp.
- T6: offline: `./?source=pwa` vẫn mở được từ cache.
- T7: nút "Kiểm tra cập nhật" khi đã mới nhất mở hộp thoại "Đã là bản mới nhất" và hiển thị phiên bản.
Xong khi: toàn bộ suite thật PASS (báo đúng số), `--stamp` rồi `--check` khớp, oxlint 0/0, quét bí mật rỗng, KHÔNG deploy (Claude ACCEPT rồi mới phát hành đợt 3).
