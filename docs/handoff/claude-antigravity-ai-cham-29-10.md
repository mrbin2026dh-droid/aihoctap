# Claude → Antigravity: kiểm tra AI chấm tự luận (sáng 29/10, đang thi)

## Hiện trạng Claude đo trên trang thật (8:40)
- Khóa API Google: **đã mở** cho aihoctap.online. Thầy đã làm; lỗi chặn tên miền không còn.
- Worker: `/api/health` trả `healthy`.
- Đếm phút học: chạy. Hôm nay đã có số phút được ghi.
- **AI chấm tự luận: LỖI.** Một bài nộp thật lúc 8:14 (thi thử khối 8, 4 câu tự luận, học sinh có viết bài) bị ghi **"chờ chấm"**, 4 câu tự luận 0 điểm.

## Claude đã sửa (đã đẩy, Pages tự phát hành)
- **Nguyên nhân khả năng cao:**
  - Token Worker của học sinh chỉ dùng được 12 giờ. Em nào đăng nhập từ tối hôm trước thì sáng nay token đã hết hạn.
  - Ứng dụng gửi bài cho AI chấm bằng token cũ, Worker trả 401, bài bị ghi "chờ chấm", không thử lại.
- **Đã sửa:** gặp 401 thì app tự lấy token mới bằng mã + PIN đã lưu rồi chấm lại một lần.
- Kiểm thử: `test_thi_tuluan` 70 ca (thêm ca token hết hạn).

## Antigravity kiểm (không cần deploy lại)
1. `npx wrangler tail aihoctap-gate --format pretty`. Nhờ thầy cho 1 tài khoản học sinh thử làm bài "Thi thử giữa học kỳ I" khối 9 có tự luận (đăng nhập lại cho chắc).
   - Thấy dòng `POST /api/pwa/exam-essay` → **200**: AI chấm chạy.
   - Thấy `[GEMINI_FAIL]` hoặc 502: chép nguyên lý do (không chép khóa). Kiểm tên mô hình dự phòng `gemini-flash-lite-latest` có tồn tại trong Google AI Studio không; nếu không, đổi `GEMINI_FALLBACK_MODEL` sang tên mô hình có thật rồi `npx wrangler deploy`.
   - Thấy 429 "hết lượt ngày": thêm khóa Gemini (Hồ sơ → Khóa Gemini).
2. Bài "chờ chấm" lúc 8:14: khi AI chạy ổn, **học sinh đó** mở tab Thi → bài thi → màn kết quả → bấm **Chấm lại** (nút trên app học sinh). Bài làm đã lưu, không phải làm lại.
3. Ghi kết quả vào `docs/handoff/antigravity-claude-ai-cham-xong.md` (không ghi tên/mã học sinh, khóa).
