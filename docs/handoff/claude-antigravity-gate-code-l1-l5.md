# Sửa L1–L5 sau phán quyết lần 7
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Đóng lỗ hổng đăng nhập `lan-login` và các điều kiện L1–L5 trong `docs/audits/2026-10-24-firebase-gate-code-v7-verdict.md`.
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-gate-code-v7-verdict.md
- worker/index.js (route `/api/student/lan-login` ~807, CORS ~714, `/api/pwa/*`)
- docs/SETUP_FIREBASE_CLOUDFLARE.md
## Kết quả mong đợi
- Việc đầu tiên: tắt hoặc khóa `lan-login` (403 khi không có cờ dev) và deploy bản vá, báo kết quả THẬT.
- Sau đó đăng nhập chỉ với học sinh có trong `students_auth` (PIN băm + khóa thử sai + giới hạn IP); grade/class/tên lấy từ RTDB. Hướng dẫn người dùng tạo danh sách học sinh từng bước, không hardcode.
- Test FAIL-first cho mọi route `/api/pwa/*`; chạy đủ 6 bộ test cũ; quy trình chuẩn (oxlint, node --check) có bằng chứng trong nhật ký.
- Phân biệt THẬT/MOCK trong báo cáo.
## Ràng buộc
Không deploy thêm khi chưa có ACCEPT của Claude (trừ bản vá tắt `lan-login`). Không ghi bí mật vào chat/nhật ký/Git. Xóa đường dẫn máy cá nhân khỏi bản công khai.
## Xong thì chuyển cho: Claude
