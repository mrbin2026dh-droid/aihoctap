# Yêu cầu sửa AI có kiểm soát hồi quy — 24/10/2026

Mục tiêu: sửa lỗi AI mà không làm hỏng tính năng đang đúng. Thực hiện sửa mã và kiểm thử, không chỉ đề xuất. Chưa được commit/push/merge/deploy.

## 1. Đọc trước
- AGENTS.md.
- BAO_CAO_HOAN_THIEN_DEBUG.md.
- BAO_CAO_TEST_WEBSITE_THUC_TE.md, tập trung LIVE-01..03.
- YEU_CAU_FIX_AI_SAU_KIEM_DINH.md.
- docs/audits/2026-10-23-ai-review/01..05.
- docs/audits/2026-10-24-ai-regression-gate.md.

Đọc lại mã hiện tại; báo cáo cũ không thay thế bằng chứng. Mẫu code chưa phải patch được nghiệm thu. Tuân thủ skill/audit bắt buộc; thiếu công cụ ghi BLOCKED, không giả PASS. Sonnet chỉ nhận từng tệp nhẹ <3KB, không ảnh/PDF.

## 2. Khóa phạm vi
Chỉ sửa AI và dữ liệu chat: lựa chọn sai nguồn, tin is_correct client, gợi ý sai câu/bài, thiếu ngữ cảnh/history, chẩn đoán nguồn Gemini/fallback, hủy yêu cầu cũ. Không redesign, PWA, đổi logic chấm điểm hay quyền truy cập nếu chưa có lỗi liên quan được chứng minh.

## 3. Bắt buộc trước mỗi nhóm sửa
1. Ghi HEAD, git status và hash mã liên quan. Lưu bản khôi phục mã tracked/untracked liên quan trong scratch; không kèm .env, token hoặc dữ liệu học sinh. Không reset/stash/xóa công việc có sẵn.
2. Dùng CodeGraph lập vùng ảnh hưởng, hàm dùng chung và test bảo vệ theo tệp gate.
3. Chạy baseline trong dữ liệu tạm. Ghi PASS/FAIL/SKIP và lỗi có sẵn. Chưa có test bảo vệ hành vi quan trọng thì bổ sung trước.
4. Viết regression thể hiện yêu cầu đúng: FAIL trên lỗi còn tồn tại, PASS sau sửa. Lỗi đã được sửa thì giữ test PASS, không cố làm hỏng lại.

## 4. Sửa và đối chiếu
Mỗi lần một nhóm nhỏ. Sau sửa chạy test lỗi mới, test vùng ảnh hưởng, rồi cùng bộ baseline với cùng cấu hình. Test từng PASS nay FAIL phải tự sửa hoặc khôi phục riêng thay đổi vừa làm; không ghi đè công việc khác.

Cấm xóa test, giảm assert, thêm skip/xfail hoặc mock bỏ qua logic cần kiểm tra để làm xanh. Đổi test sai phải giải thích contract và giữ bằng chứng trước/sau. Không dùng dữ liệu production; không in bí mật.

## 5. Bàn giao
Xuất BAO_CAO_FIX_AI_KHONG_HOI_QUY.md: lỗi, diff, hash, lệnh và log trước/sau, kết quả từng nhóm bảo vệ, mock/live, gate còn thiếu. Có regression mới hoặc gate bắt buộc chưa đạt: NOT READY. Chỉ gửi Codex kiểm định khi đủ bằng chứng; sửa thêm sau đó phải kiểm lại phần bị ảnh hưởng.
