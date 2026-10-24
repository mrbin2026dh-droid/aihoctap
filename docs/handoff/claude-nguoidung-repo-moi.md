# Việc người dùng cần làm trước khi push (sau ACCEPT lần 6)
Từ: Claude → Sang: Người dùng   Ngày: 24/10/2026
## Mục tiêu
Cho phép push repo sạch `scratch/aihoctap-clean` lên GitHub mới. Mã đã ACCEPT (xem `docs/audits/2026-10-24-firebase-gate-code-v6-verdict.md`).
## Tệp cần đọc
- docs/SETUP_FIREBASE_CLOUDFLARE.md (bản trong repo sạch)
## Kết quả mong đợi (người dùng làm, AI hướng dẫn từng bước)
1. Vào GitHub, repo cũ `aihoctap`: Settings → xóa hoặc đổi sang Private.
2. Tạo repo công khai mới (tên do bạn chọn), KHÔNG tích README; gửi tên cho Antigravity.
3. Quyết: dùng lại dự án Firebase `ai-sgk-tinhoc` hay tạo mới (xem Bước 1 trong SETUP).
4. Làm tiếp SETUP: Firebase, Gemini, Cloudflare. Không dán khóa, secret, PIN vào chat hay Git.
## Ràng buộc
Antigravity sửa K1–K3 (xem phán quyết) trước khi push. Chỉ push sau khi bước 1–2 xong.
## Xong thì chuyển cho: Antigravity
