# Kiểm độc lập mã Học AI (giai đoạn 2–5, 7) trước khi deploy
Từ: Claude (phiên viết mã) → Sang: Claude (phiên MỚI, chưa đọc phiên viết mã)   Ngày: 22/11/2026   Mức: CAO

## Vì sao
Người dùng yêu cầu Claude "làm hết", nên chính Claude đã viết mã thay Antigravity. Bản tự kiểm của phiên đó **không phải kiểm độc lập**. Phiên mới phải tự đọc mã và tự chạy test rồi mới cho ACCEPT. Chưa deploy, chưa commit.

## Tệp cần đọc
- Mã mới: `worker/phieu-core.js` (bản sao y hệt ở `frontend/hoc/phieu-core.js`), `worker/phieu.js`, `frontend/hoc/phieu.js`, `frontend/hoc/teacher-phieu.js`.
- Chỗ sửa trong mã cũ:
  - `worker/index.js`: import, và khối "Học AI" đặt trước khối "Bài kiểm tra Thử / Thật".
  - `wrangler.toml`: biến `PHIEU_ENABLED`.
  - `frontend/hoc/index.html`, `app.js`: thêm mục Học AI; nút Tài liệu PDF chuyển vào trang Học.
  - `teacher.html`, `teacher-ui.js`, `teacher.js`, `teacher.css`, `styles.css`.
  - `sw.js` và `tools/package_student_pwa.py`.
- Tài liệu: `docs/integration-ai-grade9-lesson2/04_DATABASE_AND_SECURITY.md` (mô hình đe dọa).

## Lệnh kiểm
```
node tests/test_phieu_core.mjs
node tests/test_phieu_worker.mjs
NODE_PATH=$(npm root -g) node tests/test_phieu_ui.cjs
NODE_PATH=$(npm root -g) node tests/test_phieu_teacher_ui.cjs
python tools/package_student_pwa.py --check
```

## Điểm cần soi (mức CAO)
1. Học sinh không đọc được `phieu_dapan` và không đọc được bài của học sinh khác. Ngoại lệ duy nhất: route góp ý cho bạn cùng nhóm, chỉ trả các trường mục tiêu.
2. Giáo viên lớp chỉ làm việc với lớp mình. Có hai đường đăng nhập: token Worker (claims `classes`) và Sheet `gv_login` (`teacher.lop`). Chỉ giáo viên quản trị được sửa gói.
3. Ghi có điều kiện bằng ETag (`X-Firebase-ETag` / `if-match`, trả 412 khi có máy khác ghi trước). Cần thử thật với RTDB, vì test chỉ chạy trên cơ sở dữ liệu giả.
4. Bản nộp `phieu_ls` không bị ghi đè.
5. CSV chặn công thức khi mở bằng Excel (`csvSafe`).

## Giới hạn đã biết (chưa làm)
- Học sinh tự chọn số nhóm, nên có thể vào nhóm bất kỳ trong lớp và đọc trường mục tiêu của bạn trong nhóm đó. Giáo viên chưa khóa nhóm được.
- Chưa tự xóa dữ liệu khi hết năm học (câu 9 trong 07).
- Học liệu và trường mới sửa qua JSON trong trình soạn. Giáo viên lớp chỉ được xem.
- Chưa chạy các skill trong Hiến pháp Antigravity (stitch, web-perf…): máy không có công cụ đó.

## Sau khi có ACCEPT (người dùng làm, có xác nhận từng bước)
1. Ghi lại ID bản Worker đang chạy, rồi chạy `wrangler deploy`.
2. Trang giáo viên → Học AI → "Nhập bài mới từ tệp", chọn `data/phieu/ai9_bai2.json`. Sau đó vào "Sửa nội dung bài" → "Nhập đáp án từ tệp", chọn `ai9_bai2.dapan.json`.
3. Chạy smoke test với học sinh "[THỬ]".
4. Muốn tắt nhanh: đặt `PHIEU_ENABLED="0"`.

## Xong thì chuyển cho: Người dùng (commit, deploy)
