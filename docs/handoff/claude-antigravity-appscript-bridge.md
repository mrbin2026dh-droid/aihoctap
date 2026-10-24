# Tài liệu PDF: giáo viên tải lên từ máy, lưu Drive qua Apps Script — Claude → Antigravity
Thay phiên bản trước của bàn giao này. Quyết định (người dùng + Claude): tài liệu là dữ liệu mức THẤP (chỉ học sinh dùng) nên chỉ cần: học sinh/giáo viên đăng nhập + mã bí mật Worker↔script. Đề thi/đáp án giữ bảo mật mức CAO như hiện tại. Mã script: `docs/appscript/materials-bridge.gs` (đã có `upload/rename/delete` và `doGet` tải). Hướng dẫn người dùng: `docs/guides/huong-dan-appscript-tai-lieu.md`. Quy trình: context7, FAIL-first, oxlint, node --check. Không deploy; `APPS_SCRIPT_URL`/`APPS_SCRIPT_SECRET` do người dùng đặt bằng wrangler, không vào chat/log/Git.

## Worker (worker/index.js)
Hàm chung (đặt gần `extractDriveFileId`, có thể xóa hàm đó và các đường dán link/Drive trực tiếp):
```js
function isAppsScriptConfigured(env) {
  if (typeof env.APPS_SCRIPT_SECRET !== 'string' || env.APPS_SCRIPT_SECRET.length < 32) return false;
  try { const u = new URL(env.APPS_SCRIPT_URL); return u.protocol === 'https:' && u.hostname === 'script.google.com' && u.pathname.startsWith('/macros/s/'); } catch { return false; }
}
async function callBridgePost(env, payload) { // POST JSON, redirect follow; KHÔNG log URL/secret/payload
  const r = await fetch(env.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ s: env.APPS_SCRIPT_SECRET, ...payload }), redirect: 'follow' });
  return r.json();
}
```
Mọi route dưới đây: thiếu cấu hình → 503 `Chưa cấu hình cầu nối tài liệu.` (fail-closed, không fallback).
1. `POST /api/pwa/teacher/materials` (quyền giáo viên): nhận JSON `{course_id, title, file_name, data_b64}` (frontend đọc file bằng FileReader → base64). Kiểm: `course_id`/id hợp lệ (IdValidation), `title` 1–100 ký tự, `atob` thành công, ≤ 10MB (10*1024*1024 byte), 5 byte đầu `%PDF-`; sai → 400/413/415. Gọi `callBridgePost(env, {action:'upload', name: title, data_b64})`; `ok` → ghi RTDB `/materials/{course}/{id}` = `{id, title, course_id, file_id, size, created_at}` (kiểm `putRes.ok`, lỗi → 502 và gọi `delete` file vừa tạo để không mồ côi). `id` = `m_${Date.now().toString(36)}_${random6}`.
2. `PATCH /api/pwa/teacher/materials/{course}/{id}` body `{title}`: đọc bản ghi, gọi `rename` (`id: file_id`), cập nhật `title` trong RTDB.
3. `DELETE /api/pwa/teacher/materials/{course}/{id}`: gọi `delete`; thành công (hoặc `NOT_FOUND`) → xóa bản ghi RTDB (kiểm res.ok).
4. `GET /api/pwa/materials/{course}/{id}/file` (JWT học sinh/giáo viên): gọi `GET ${APPS_SCRIPT_URL}?s=${encodeURIComponent(secret)}&id=${encodeURIComponent(file_id)}`; ok → giải mã base64, kiểm ≤ 10MB và `%PDF-`, trả `application/pdf` + `nosniff` + `private, max-age=3600`. Lỗi script: NOT_FOUND→404, TOO_LARGE→413, NOT_PDF→415, còn lại 502 (không lộ `error` gốc).
5. `GET /api/pwa/materials/{course}` (danh sách): yêu cầu JWT; trả `{id,title,size,created_at}`, KHÔNG có `file_id` (xử lý luôn P2).
Giới hạn kích thước body request của route upload: chặn nếu `Content-Length` > 15MB (base64 ≈ 1.37 lần).

## Frontend giáo viên (frontend/hoc/teacher.html/.js)
Thay ô dán link bằng: `<input type="file" accept="application/pdf">`, ô "Tên tài liệu" (mặc định = tên file bỏ `.pdf`), nút "Tải lên"; kiểm phía trình duyệt ≤ 10MB trước khi gửi (thông báo "Tệp quá 10MB"). Bảng danh sách theo khóa học: cột Tên, Dung lượng, nút "Đổi tên" (nhập tên mới) và "Xóa" (hỏi xác nhận). Không emoji, chữ ngắn.

## Test FAIL-first (`tests/test_drive_materials.mjs`, mock fetch trả JSON của script)
1. Thiếu URL/secret ngắn/URL không phải script.google.com → 503, không gọi fetch (cả 5 route).
2. Upload hợp lệ → script nhận `action:'upload'` có `s`, `name`, `data_b64`; RTDB có bản ghi với `file_id`; secret không xuất hiện trong console/response.
3. Upload > 10MB → 413; không phải PDF (không `%PDF-`) → 415; base64 sai → 400; học sinh/không token → 403/401.
4. RTDB PUT lỗi 500 → 502 và script nhận `delete` (dọn mồ côi).
5. Rename gọi script `rename` và đổi `title`; delete gọi `delete` rồi xóa bản ghi; script `NOT_FOUND` khi delete vẫn xóa bản ghi.
6. Tải file: ok→200 PDF; NOT_FOUND→404; TOO_LARGE→413; NOT_PDF→415; FORBIDDEN→502; HTML trong base64→415; không token→401.
7. Danh sách không chứa `file_id`; quét tĩnh không còn `drive.google.com/uc?export=download`.
Xong khi: test mới FAIL rồi PASS, các bộ cũ vẫn PASS, oxlint 0/0, node --check; báo THẬT/MOCK (THẬT chỉ khi người dùng đã triển khai script); chuyển Claude.
