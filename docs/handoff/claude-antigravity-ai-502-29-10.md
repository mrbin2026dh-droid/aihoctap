# Claude → Antigravity: AI báo lỗi 502 (Gia sư + AI chấm tự luận) — sửa triệt để, CẦN DEPLOY WORKER NGAY

## Hiện tượng (thầy chụp 11:13)
- Console: `exam-essay` **502** (2 lần), `pwa/tutor` **502**.
- Học sinh thấy "AI chưa chấm được phần tự luận… AI vẫn chưa chấm được".
- 502 nghĩa là Worker đã nhận yêu cầu (token học sinh hợp lệ), nhưng **Gemini trả lỗi không phải 429**. Có thể là:
  - 503 quá tải;
  - 500;
  - 404 sai tên mô hình;
  - 401/403 khóa bị từ chối (khóa sai, hết hạn, bị giới hạn trang web/IP, chưa bật Generative Language API).
- Trước đây Gia sư gặp các lỗi này là trả 502 ngay, không thử lại, không đổi mô hình.

## Claude đã sửa (đã đẩy GitHub)
1. **Gia sư:** Gemini lỗi không phải 429 thì lần lượt:
   - thử lại 2 lần có giãn cách (lỗi 5xx / mất mạng);
   - đổi khóa: khóa khác trong kho, rồi khóa mặc định `GEMINI_API_KEY` (lỗi 401/403);
   - đổi **mô hình dự phòng** `GEMINI_FALLBACK_MODEL`.
   Hết cách mới báo lỗi, kèm nguyên nhân dễ hiểu ("máy chủ AI quá tải", "khóa Gemini bị từ chối", "sai tên mô hình AI").
2. **AI chấm tự luận / AI soạn câu hỏi (`geminiOnce`):** khóa trong kho bị 401/403 thì thử khóa mặc định một lần (trước đây dừng luôn).
3. **Nút "Kiểm tra AI ngay"** ở trang giáo viên → Hồ sơ → Khóa API.
   - Gọi thử Gemini bằng từng khóa (kho + mặc định) × từng mô hình (chính + dự phòng).
   - Hiện mã lỗi + lý do Google trả về, **không lộ khóa**.
   - Endpoint: `POST /api/teacher/ai-check`.
4. **App học sinh:** chấm lại vẫn lỗi thì hiện **lý do cụ thể** do máy chủ gửi về, thay cho câu chung chung.
5. Sáng nay đã sửa: token hết hạn (401) thì tự lấy token mới rồi chấm lại.
6. **Kiểm thử:**
   - Mới: `test_gemini_recovery` 11 ca.
   - Hồi quy đạt: essay 19, teacher AI 22, tutor (grounding, questions, auto-lesson, exam-review), key pool, gate, guardrails, đa tên miền, phạm vi giáo viên; giao diện: thi tự luận 70, shell, chuẩn UI, thi Firebase.

## Antigravity làm NGAY (đang giờ học)
1. `git pull` → `npx wrangler deploy`.
2. Mở trang giáo viên → Hồ sơ → Khóa API → bấm **Kiểm tra AI ngay**. Chụp bảng kết quả (không có khóa). Đọc cột Mã:
   - **200 ở ít nhất một dòng:** AI chạy. Nhờ học sinh bấm "Chấm lại phần tự luận".
   - **403/401** ở dòng "Khóa mặc định của máy chủ":
     - nếu khóa này lấy từ Google Cloud và có giới hạn **Websites**, Worker gọi từ máy chủ không có trang web nên bị chặn. **Phải dùng khóa tạo ở Google AI Studio, không giới hạn trang web**, hoặc bỏ giới hạn Websites của khóa đó;
     - đặt lại: `npx wrangler secret put GEMINI_API_KEY`.
     - **Lưu ý:** khóa web Firebase (đã giới hạn aihoctap.online) **không được** dùng làm khóa Gemini.
   - **404** ở mô hình dự phòng (`gemini-flash-lite-latest`): đổi `GEMINI_FALLBACK_MODEL` trong `wrangler.toml` sang mô hình có thật trong AI Studio (ví dụ một mô hình Flash bản 3.x mà tài khoản dùng được) → deploy lại.
   - **429:** hết lượt. Thêm 1–2 khóa AI Studio vào kho (Hồ sơ → Khóa API → Thêm khóa).
   - **503:** Google quá tải. Bản sửa đã tự thử lại và đổi mô hình; nếu cả hai mô hình đều 503 thì chờ ít phút.
3. `npx wrangler tail` khi một học sinh thử hỏi Gia sư: dòng `[GEMINI_SERVER_ERROR]` / `[GEMINI_ALT_FAIL]` cho biết mã lỗi và mô hình.
4. Ghi kết quả vào `docs/handoff/antigravity-claude-ai-502-xong.md`: bảng Kiểm tra AI, đã đổi gì. **Không ghi khóa.**

## Ghi chú cho thầy
- Thanh địa chỉ báo **"Not secure"**: thầy đang mở bản `http://`. Gõ đầy đủ `https://aihoctap.online`; nếu đã cài app từ bản http thì gỡ và cài lại từ bản https.
- Bài đã ghi "chờ chấm" không mất. Khi AI chạy lại, học sinh mở tab Thi → bài thi → bấm **Chấm lại phần tự luận**.
