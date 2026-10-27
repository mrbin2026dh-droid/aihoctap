# Nghiệm thu phân quyền giáo viên lớp giai đoạn 2 (Worker)
Từ: Antigravity → Sang: Claude   Ngày: 27/10/2026   Mức: CAO (xác thực, phân quyền)

## Mục tiêu
Kiểm định độc lập việc Worker phân quyền giáo viên lớp (`scope: 'class'`), lọc đề thi/kết quả theo lớp, tài liệu theo khối và chặn các endpoint quản trị; sẵn sàng tích hợp frontend bước 4.

## Tệp đã sửa / tạo
- `worker/index.js`: `/api/teacher/auth` nhận `teacher_code` + `pin` qua Sheet `gv_login`, cấp JWT `scope: 'class'`, `classes: [...]`; `requireTeacher` trả `user.admin` & `user.classes`; lọc đề/kết quả/tài liệu theo lớp/khối; chặn toàn bộ endpoint quản trị (`403`).
- `worker/exams.js`: hỗ trợ `body.class_code` bên cạnh `body.class_codes`.
- `tests/test_worker_teacher_scope.mjs`: bộ test FAIL-first 7 ca kiểm thử phân quyền và scope toàn diện.

## Kiểm thử thực tế
- `test_worker_teacher_scope.mjs`: PASS 7/7 ca (đăng nhập giáo viên lớp, tạo đề 9B bị 403, 9A thành công 200, publish bị 403, quản trị viên PIN bình thường, chặn gemini-keys/students/ai-limits, tài liệu khối 6 bị 403 / khối 9 thành công 200, lọc danh sách/chi tiết đề lớp 9A).
- Toàn bộ hồi quy Worker: `test_worker_sheet_login.mjs`, `test_worker_gate.mjs`, `test_worker_student_contract.mjs`, `test_worker_tutor_guardrails.mjs` PASS 100%.
- Deploy Cloudflare Worker: Version mới `9591eea0-7516-4fb2-b17b-c0514b8bd228` (bản cũ lưu để rollback: `2ca07e0b-d10f-4c7a-ac5a-501182910cb8`).
- Smoke test live endpoint `/api/teacher/auth` phản hồi 401 chính xác.

## Việc tiếp theo cho Claude
- Thẩm định (ACCEPT) phân quyền Worker.
- Thực hiện bước 4 frontend: `teacher.js` nhánh `role === 'gv'` gọi `/api/teacher/auth` để lấy token, bỏ ẩn `#nav-exams` và `#nav-materials` cho giáo viên lớp.

## Xong thì chuyển cho: Claude
