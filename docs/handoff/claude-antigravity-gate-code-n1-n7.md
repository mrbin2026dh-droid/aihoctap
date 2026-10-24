# Sửa N1–N7 sau phán quyết lần 9
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Sửa N1–N7 trong `docs/audits/2026-10-24-firebase-gate-code-v9-verdict.md`, rồi làm Giai đoạn 2 trong `docs/plans/2026-10-24-contest-features-spec.md` (quản lý học sinh trên giao diện giáo viên kèm nút mở khóa, thống kê, xuất CSV).
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-gate-code-v9-verdict.md
- docs/plans/2026-10-24-contest-features-spec.md
- worker/index.js (publish ~1326, materials ~1602, đăng nhập ~979, DO ~340)
## Kết quả mong đợi
- N1–N7 xong theo TDD FAIL-first; test chứng minh GET catalog 500 không ghi đè, đáp án sai khối lựa chọn bị 400, `javascript:` bị chặn, PIN 5 ký tự bị từ chối mặc định.
- Nói rõ phiên bản Worker đang chạy thật gồm route nào (THẬT/MOCK).
## Ràng buộc
Không deploy giao diện giáo viên/tài liệu và không dùng publish thật khi chưa có ACCEPT. Không ghi bí mật vào chat/nhật ký/Git.
## Xong thì chuyển cho: Claude
