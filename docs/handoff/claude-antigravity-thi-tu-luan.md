# Claude → Antigravity: sửa lỗi 502 "AI soạn đề" + thi thử Trắc nghiệm + Tự luận (28/10)

## 1. Lỗi 502 khi bấm "Soạn câu hỏi" (Hình 1, 2 của thầy)
- Nguyên nhân: Worker gọi Gemini **một lần duy nhất**. Gemini trả lỗi (thường là 503 "quá tải") thì báo ngay "AI chưa trả lời được".
- Đã sửa hàm `geminiOnce` (dùng chung cho AI soạn đề, chấm thực hành, phân tích trò chơi, chấm tự luận):
  - 503/500/mạng lỗi: thử lại tối đa 3 lần, có giãn cách.
  - 429 hoặc khóa hỏng: đổi khóa khác trong kho khóa.
  - 400 khi bật chế độ JSON: thử lại không bật chế độ JSON.
  - Hết cách: báo kèm mã lỗi, ví dụ "AI chưa trả lời được (mã 503)". Nhật ký Worker ghi `[GEMINI_FAIL] <model> <mã> <lý do>`, không có khóa.
  - Tùy chọn: biến `GEMINI_FALLBACK_MODEL` = mô hình dự phòng, dùng từ lần thử thứ 2.

## 2. Tính năng mới: thi thử Trắc nghiệm + Tự luận
- **Giáo viên** (Thi → Tạo đề thi → Thi thử):
  - Nội dung thi: Trắc nghiệm / Trắc nghiệm + Tự luận.
  - Chọn số câu tự luận. Mỗi câu nhập đề, gợi ý đáp án (các ý + điểm) và điểm.
  - Có thể để AI soạn kèm câu tự luận. Excel mẫu: câu TL dùng cột "Gợi ý" làm gợi ý đáp án.
- **Học sinh**:
  - Đề chia Phần I. Trắc nghiệm / Phần II. Tự luận.
  - Phần tự luận gõ trên khung kẻ dòng chấm như giấy thi, tự cao theo bài, lưu nháp.
  - Nộp bài → Worker `/api/pwa/exam-essay` (token học sinh) → AI chấm theo gợi ý → hiện điểm + nhận xét từng câu.
  - AI lỗi: bài vẫn nộp (điểm trắc nghiệm), đánh dấu chờ chấm, có nút "Chấm lại phần tự luận".

## Antigravity làm (theo thứ tự)
1. `git pull`.
2. **Deploy Worker** (`npx wrangler deploy`).
   - Không cần khóa mới.
   - Tùy chọn: `ESSAY_DAILY` (số lượt AI chấm tự luận/học sinh/ngày, mặc định 40), `GEMINI_FALLBACK_MODEL`.
   - Xem nhật ký nếu còn lỗi: `npx wrangler tail`, tìm dòng `[GEMINI_FAIL]`, rồi báo lại mã lỗi.
3. **Hướng dẫn thầy cập nhật Code.gs**:
   - Dán bản mới `apps-script/sheet-exam/Code.gs`, Lưu, rồi Triển khai → Quản lý → Sửa → Phiên bản mới.
   - Trang DeThiThu có thêm cột M "Gợi ý chấm" (tự tạo khi lưu đề).
4. **Luật Firebase**:
   - Chạy máy giả lập `spike/step0/emulator/rules-thi-fast.test.mjs`. Bản này có thêm 4 ca tự luận và các ca quiz đã đạt.
   - Đạt hết thì đăng `spike/step0/database.rules.ai-sgk-final.json`. Nhánh `thi_nop` thêm `tu_luan`, `diem_tn`, `cho_cham`.
   - **Chưa đăng luật thì học sinh nộp bài có tự luận sẽ bị từ chối**. Bài chỉ trắc nghiệm không ảnh hưởng.
5. Nhờ thầy thử theo thứ tự:
   1. AI soạn đề theo ma trận.
   2. Tạo thi thử Trắc nghiệm + Tự luận.
   3. Học sinh làm bài và nộp.
   4. Kiểm tra học sinh thấy điểm tự luận + nhận xét.

## Kiểm thử Claude đã chạy
- `tests/test_essay_ai.mjs` 17 ca (thử lại Gemini, chấm tự luận, giới hạn lượt, soạn tự luận).
- `tests/test_thi_tuluan.cjs` 68 ca (giáo viên + học sinh, điện thoại + máy tính, AI lỗi → chấm lại).
- `tests/test_sheet_exam_gs.cjs` 125 ca (DeThiThu cột Gợi ý chấm, đẩy Firebase).
- Hồi quy các tệp liên quan đạt.
