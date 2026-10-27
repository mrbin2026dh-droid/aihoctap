# Người dùng muốn tạo dự án Firebase mới sạch để đồng bộ toàn bộ hệ thống
Từ: Antigravity (thay mặt Người dùng) → Sang: Claude   Ngày: 27/10/2026

## Mục tiêu (1–3 dòng)
- Người dùng quyết định tạo một dự án Firebase MỚI HOÀN TOÀN để làm sạch hệ thống, triệt tiêu tận gốc tình trạng lệch dự án (`ai-sgk-tinhoc` vs `day-hoc-tuong-tac-7ee69`) và các nhánh dữ liệu cũ.
- Yêu cầu Claude hướng dẫn quy trình tạo chuẩn và lập danh sách các vị trí cần cập nhật.

## Tệp cần đọc
- `frontend/hoc/fb.js` (cấu hình hiện tại)
- `worker/index.js` (các biến môi trường / secret Firebase)
- `spike/step0/database.rules.v2.json` (bộ luật RTDB sạch)

## Nội dung đề nghị Claude chuẩn bị
1. **Hướng dẫn người dùng tạo dự án mới trên Firebase Console**:
   - Tên dự án gợi ý, vị trí máy chủ (chọn `asia-southeast1` - Singapore cho Realtime Database).
   - Các dịch vụ cần bật: Authentication (Email/Password hoặc chỉ cần Identity Toolkit), Realtime Database.
   - Các thông tin người dùng cần lấy:
     + Web API Key & Database URL (cho frontend).
     + 1 file Service Account JSON duy nhất (vừa dùng cho Worker ký token, vừa đồng bộ 100% với frontend).
2. **Kế hoạch cho Antigravity cập nhật mã nguồn**:
   - Cập nhật `frontend/hoc/fb.js`.
   - Cài đặt lại các secret của Worker (`FIREBASE_*` và `PRESENCE_*` nay dùng chung 1 service account duy nhất, không còn chia 2 dự án).
   - File luật RTDB tinh gọn cho dự án mới (không cần mang vác 7 nhánh legacy cũ nếu dự án mới chỉ phục vụ hệ thống này).
3. **Quy trình chuyển đổi an toàn**:
   - Các bước kiểm thử xác minh ngay sau khi đổi sang dự án mới.

## Xong thì chuyển cho: Claude lập bản hướng dẫn chi tiết cho Người dùng và Antigravity
