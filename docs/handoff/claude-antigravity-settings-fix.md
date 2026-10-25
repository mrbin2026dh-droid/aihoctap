# Claude → Antigravity: sửa menu Cài đặt (S1–S5)
Đọc AGENTS.md (F, I, J, K). Không deploy trước ACCEPT. Chạy đo của Claude: `NODE_PATH=$(npm root -g) node tests/audit_settings_behavior.cjs` (cần Playwright; in kết quả từng ý).

## S1 — Mobile phải thấy danh sách nhóm trước
`teacher.js`: đổi `let activeView = 'account';` → `let activeView = '';`. Xóa dòng `if (!activeView) activeView = 'account';` trong handler `#open-settings`. Trong `renderSettings`, ngay sau khi tính `isWide`:
```js
if (isWide && !activeView) activeView = 'account';   // màn rộng luôn có trang chi tiết
```
(`has-detail` đã tính đúng: mobile = `Boolean(activeView)`.) Handler `matchMedia` giữ nguyên.
`app.js`: `let studentActiveView = '';`; trong `openStudentSettings()` xóa `if (!studentActiveView) studentActiveView = 'account';` và thêm trong `renderStudentSettings` sau `isWide`: `if (isWide && !studentActiveView) studentActiveView = 'account';`. Khi mở lại Cài đặt ở mobile: đặt `activeView = ''` để luôn bắt đầu từ danh sách.

## S2 — Chặn gửi lặp theo học sinh (`teacher.js`)
```js
const inFlight = new Set();
async function guarded(key, fn) {
  if (inFlight.has(key)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
  inFlight.add(key); document.querySelector(`[data-sid="${CSS.escape(key.split(':')[1])}"]`)?.setAttribute('aria-busy','true');
  try { return await fn(); } finally { inFlight.delete(key); }
}
```
Mỗi hàng `tr.dataset.sid = s.id`. Trong từng nút (Sửa, Đặt lại PIN, Khóa/Mở, Xóa): ngay đầu hàm, TRƯỚC khi mở hộp thoại: `if (inFlight.has('s:'+s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }`; phần từ sau khi xác nhận đến hết `await loadStudents()` bọc `await guarded('s:'+s.id, async () => { ... });`. Trong lúc busy, `summary` của hàng: `details.querySelector('summary').setAttribute('aria-disabled','true')` và nút trong `.action-list` `disabled = true`; hoàn lại trong `finally`. Xong khi: bấm Khóa 2 lần khi API chậm 600ms → đúng 1 POST (đo bằng harness).

## S3 — Lịch sử trình duyệt (cả giáo viên và học sinh)
```js
function settingsBack() {            // trả true nếu vẫn ở trong Cài đặt
  const wide = matchMedia('(min-width: 960px)').matches;
  if (!wide && activeView) { activeView = ''; renderSettings(false); return true; }
  return false;                       // rời Cài đặt
}
open handler: history.pushState({ settings: 1 }, ''); // mỗi lần mở
window.addEventListener('popstate', () => {
  if (screen !== 'settings') return;
  checkDirtyAndProceed(() => {        // thêm tham số onCancel
    if (settingsBack()) history.pushState({ settings: 1 }, '');
    else { screen = 'work'; renderSettings(false); window.scrollTo(0, workScroll); }
  }, () => history.pushState({ settings: 1 }, ''));   // người dùng Hủy: giữ nguyên
});
```
Nút "Đóng"/Quay lại trên màn rộng gọi `history.back()` khi `history.state?.settings` để ngăn tích lũy mục. Sửa `checkDirtyAndProceed(fn, onCancel)` gọi `onCancel?.()` khi không đồng ý. Học sinh làm tương tự với `studentSettingsActive`.

## S4 — Một hộp thoại cho "Sửa học sinh"
Mở rộng `dialogBox` nhận `fields: [{name,label,value,validate}]` (thay cho `field`; giữ `field` tương thích), render mỗi trường là `<label><span/><input/><p class="field-error" hidden></p></label>` (đặt trong `#msg-fields`), trả `{name:'…',class_code:'…'}` hoặc `null`. Kiểm từng trường, lỗi hiện dưới đúng trường, focus trường lỗi đầu tiên. `teacher.js` Sửa: 1 lần gọi `dialogBox({kind:'prompt', title:'Sửa học sinh', body:'Cập nhật họ tên và lớp.', okText:'Lưu', fields:[{name:'name',label:'Họ và tên',value:s.name,validate:v=>v.length<2?'Họ và tên tối thiểu 2 ký tự.':''},{name:'class_code',label:'Mã lớp',value:s.class_code,validate:v=>/^[A-Za-z0-9._-]{1,16}$/.test(v)?'':'Mã lớp gồm chữ, số, tối đa 16 ký tự.'}]})`; không đổi thì không gọi API (so với giá trị cũ).

## S5 — Test cũ
`tests/test_frontend_outbox_regression.mjs` dòng 11: đọc `frontend/hoc/app.js` (hoặc xóa đoạn kiểm `flushPendingExamSubmissions` nếu hàm đã bỏ), cập nhật thông báo lỗi. Báo cáo phải nêu đúng số bộ test thật; không ghi "PASS" khi chưa chạy bộ này.

## Test FAIL-first (thêm vào `tests/test_settings_menu.mjs` hoặc Playwright)
- T1: 390px, sau đăng nhập mở Cài đặt → `.settings-menu` hiển thị, `#panel-*` đều ẩn; chọn nhóm → panel hiện; Quay lại → danh sách, focus về nhóm vừa chọn. 1280px → có sẵn panel 'account'.
- T2: lock/reset/xóa khi API chậm: bấm lần 2 → đúng 1 request; thông báo "Đang xử lý…"; xong cho bấm lại.
- T3: `history.back()` ở mobile: chi tiết → danh sách → (lần nữa) về màn làm việc; có thay đổi hạn mức chưa lưu → hộp thoại xác nhận, Hủy giữ nguyên.
- T4: Sửa học sinh mở đúng 1 hộp thoại 2 trường; tên 1 ký tự → lỗi dưới trường, 0 request.
Xong khi: mọi suite (kể cả outbox) PASS thật, oxlint 0/0, quét bí mật rỗng, log aisgk.md, KHÔNG deploy.
