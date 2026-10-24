# Tài liệu qua Google Drive và nhóm khóa Gemini
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Làm sau khi N1–N7 được ACCEPT: (1) tài liệu lưu ở Google Drive, Worker làm cầu để PWA lưu ngoại tuyến; (2) nhiều khóa Gemini, cân bằng tải, hết hạn mức thì dừng và báo trong giao diện giáo viên. Chi tiết: `docs/plans/2026-10-24-contest-features-spec.md` (mục Giai đoạn 1 và mục "Hạn mức Gemini và nhiều khóa").
## Tệp cần đọc
- docs/plans/2026-10-24-contest-features-spec.md
- docs/REQUIREMENTS_CUOC_THI.md (A6, C5)
- worker/index.js (materials, tutor, DO quota)
## Kết quả mong đợi
- Route tài liệu chỉ lưu `file_id`; Worker lấy tệp từ `drive.google.com` cố định, <= 10MB, kiểm Content-Type, trả CORS; học sinh có tab Tài liệu, tải và xóa ngoại tuyến.
- Nhóm khóa: thêm/xóa/xem trạng thái trong giao diện giáo viên; khóa mã hóa AES-GCM, không bao giờ trả lại đầy đủ; chọn khóa ít dùng nhất; 429 thì nghỉ và thử khóa khác; hết cả nhóm trả `AI_QUOTA_EXHAUSTED`, học sinh thấy thông báo thân thiện, giáo viên thấy biểu ngữ kèm ô thêm khóa.
- Test FAIL-first theo mục Kiểm; báo cáo phân biệt THẬT/MOCK. Hướng dẫn người dùng từng bước tạo khóa và dán vào giao diện; không hardcode.
## Ràng buộc
Không deploy khi chưa có ACCEPT của Claude. Không ghi khóa API vào chat, nhật ký, Git, RTDB hay phản hồi. Không tự chuyển sang gói trả tiền.
## Xong thì chuyển cho: Claude
