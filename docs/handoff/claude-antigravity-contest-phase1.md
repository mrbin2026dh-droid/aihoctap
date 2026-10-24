# M1–M4 rồi giai đoạn 1 tính năng dự thi
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
1) Sửa M1–M4 (`docs/audits/2026-10-24-firebase-gate-code-v8-verdict.md`), sau đó deploy giai đoạn 2 đăng nhập PIN (đã ACCEPT). 2) Làm giai đoạn 1 theo `docs/plans/2026-10-24-contest-features-spec.md`: route publish có đáp án tách riêng, tính mở nhiều môn, tài liệu (chờ người dùng quyết D1).
## Tệp cần đọc
- docs/REQUIREMENTS_CUOC_THI.md
- docs/plans/2026-10-24-contest-features-spec.md
- docs/audits/2026-10-24-firebase-gate-code-v8-verdict.md
- worker/index.js, tools/manage_students.py, frontend/hoc/teacher.js
## Kết quả mong đợi
- M1–M4 xong kèm test; deploy giai đoạn 2, báo THẬT/MOCK, hướng dẫn người dùng tạo danh sách học sinh từng bước (PIN tự sinh).
- Giai đoạn 1 theo TDD FAIL-first: publish, môn mới hiện ngay cho học sinh, sanitizer 0 leak, không hardcode tên môn.
## Ràng buộc
Không deploy giai đoạn 1 khi chưa có ACCEPT của Claude. Không ghi bí mật vào chat/nhật ký/Git. Báo cáo phân biệt THẬT/MOCK.
## Xong thì chuyển cho: Claude
