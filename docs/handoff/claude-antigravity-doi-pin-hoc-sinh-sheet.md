# Học sinh đổi mã PIN báo "Chưa thực hiện được. Thử lại sau."
Từ: Claude → Sang: Antigravity   Ngày: 22/11/2026 (Asia/Bangkok)   Mức: CAO (PIN/đăng nhập)

## Nguyên nhân (đã đọc mã, chưa gọi bản thật)
1. `wrangler.toml` có `SHEET_LOGIN_URL` → `worker/index.js`, nhánh `POST /api/pwa/change-pin` (tìm `Student Change PIN`) trả **403** `{detail:'Mã PIN do giáo viên quản lý trong Google Sheet. Hãy nhờ giáo viên đổi giúp.'}` cho MỌI học sinh. PIN thật nằm trong Sheet, Worker không được đổi.
2. `frontend/hoc/dom.js` hàm `mapErrorMessage` chỉ nhận vài mẫu chữ ("sai", "khóa", "mạng"…); câu 403 trên không khớp → rơi xuống dòng cuối `'Chưa thực hiện được. Thử lại sau.'`. Học sinh không biết phải nhờ thầy cô.
3. Cùng lỗi nuốt chữ: các lỗi 400 "Mã PIN mới không được là chuỗi các ký tự trùng lặp", "Mã PIN mới phải khác…" cũng bị đổi thành câu chung.

## Sửa (mã mẫu)
A. Worker, nhánh 403 ở trên — thêm mã (tương thích ngược, chỉ thêm trường):
```js
return new Response(JSON.stringify({ error: 'PIN_MANAGED_BY_SHEET', detail: 'Mã PIN do thầy cô quản lý. Hãy nhờ thầy cô đổi giúp.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```
B. `frontend/hoc/app.js`, listener `student-change-pin-form`, khối `catch (err)`:
```js
} catch (err) {
  const e = /** @type {any} */ (err);
  statusNode.textContent = e?.code === 'PIN_MANAGED_BY_SHEET'
    ? 'Mã PIN do thầy cô quản lý. Hãy nhờ thầy cô đổi giúp.'
    : (e?.status === 400 && typeof e.message === 'string' ? e.message : mapErrorMessage(err));
  statusNode.className = 'notice error status';
}
```
(`api.js` đã đọc `data.error` thành `ApiError.code`.)
C. (Tùy chọn, nên làm) Khi đăng nhập bằng Sheet, ẩn `<details class="pin-details">` và thay bằng một dòng "Mã PIN do thầy cô quản lý." — cần Worker trả cờ `pin_managed:'sheet'` trong phản hồi `/login`; chỉ THÊM trường.

## Test FAIL-first
1. `tests/test_worker_sheet_login.mjs`: có `SHEET_LOGIN_URL`, gọi `POST /api/pwa/change-pin` với token hợp lệ → mong đợi 403 và `body.error === 'PIN_MANAGED_BY_SHEET'` (hiện FAIL vì thiếu `error`).
2. DOM (Playwright, kiểu `tests/test_fb_pin_sync.cjs`): fetch giả trả 403 `{error:'PIN_MANAGED_BY_SHEET',detail:'…'}` → `#student-change-pin-status` chứa "nhờ thầy cô"; fetch giả trả 400 `{detail:'Mã PIN mới không được là chuỗi các ký tự trùng lặp.'}` → hiện đúng câu đó.

## Xong khi
2 test trên xanh + toàn bộ test cũ xanh; đóng dấu lại `sw.js` (mục L); deploy Worker, smoke thật: học sinh thử đổi PIN thấy "Hãy nhờ thầy cô đổi giúp". Không đổi PIN trong Sheet, không ghi PIN vào log.

## Xong thì chuyển cho: Claude (kiểm, mức CAO)
