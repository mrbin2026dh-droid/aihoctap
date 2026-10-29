# Claude → Antigravity: AI vẫn lỗi — nguyên nhân rất có thể là Worker chạy ở Hong Kong (Google chặn Gemini). DEPLOY NGAY

## Bằng chứng Claude đo trên trang thật (12:10)
- Worker bản mới đã lên: `/api/teacher/ai-check` trả 403 khi chưa đăng nhập, đúng thiết kế.
- **Cả 4 bài tự luận nộp hôm nay (8:14, 9:11, 11:12, 11:46) đều "chờ chấm"**, mọi câu 0 điểm.
- Bảng khóa của thầy: 2 khóa đều "Hoạt động" và **0/1500 lượt hôm nay**, tức là **chưa có lần gọi AI nào thành công**.
  - Khóa vẫn "Hoạt động" (không chuyển "Chờ hồi phục") nghĩa là Google **không** trả 401/403/429.
  - Lỗi là **400**: hoặc "User location is not supported" (vùng bị chặn), hoặc khóa sai.
- Học sinh Việt Nam vào Cloudflare qua **HKG (Hong Kong)**: trace trên máy thầy ra `colo=HKG loc=VN`.
  - Worker chạy ở trạm nào thì gọi Google từ trạm đó.
  - **Google không cho dùng Gemini API từ Hong Kong**, nên lỗi xảy ra với mọi khóa, mọi mô hình, cả ngày.
  - Hôm qua có lúc chạy được vì lưu lượng có lúc đi trạm khác.

## Claude đã sửa (đã đẩy)
1. `wrangler.toml` thêm:
   ```toml
   [placement]
   region = "aws:us-east-1"
   ```
   Worker chạy ở Mỹ (vùng Google hỗ trợ). Claude đã chạy `wrangler deploy --dry-run`: cấu hình hợp lệ.
2. Worker phân biệt lỗi 400:
   - **vùng bị chặn** → báo rõ "Máy chủ AI đang chạy ở vùng Google không cho dùng Gemini (thường là Hong Kong)…", không thử lại vô ích;
   - **khóa sai** (Google trả 400) → xử lý như khóa bị từ chối: đổi khóa khác.
3. Nút **Kiểm tra AI ngay** hiện thêm dòng "Máy chủ AI đang gọi Google từ: …" (trạm Cloudflare / quốc gia), kèm kết luận "Google chặn vùng đặt máy chủ" hoặc "Khóa sai".
4. Kiểm thử: `test_gemini_recovery` 15 ca (thêm vùng bị chặn, khóa sai 400). Hồi quy Worker và giao diện đạt.

## Antigravity làm NGAY
1. `git pull` → `npx wrangler deploy`.
   - Nếu wrangler báo không hỗ trợ `region`: đổi thành `mode = "smart"` rồi deploy lại, và ghi lại thông báo lỗi.
2. Nhờ thầy: trang giáo viên → Hồ sơ → Khóa API → **Kiểm tra AI ngay**. Chụp bảng (không có khóa).
   - Dòng "gọi Google từ" **không còn HKG / HK**, có dòng mã **200** → AI đã chạy.
   - Còn HKG: placement chưa có hiệu lực. Chờ 2–3 phút, bấm lại; vẫn HKG thì báo Claude (phương án dự phòng: chuyển lời gọi Gemini qua VPS ở Việt Nam).
   - Mã 400 "API key not valid": khóa đó sai, tạo khóa mới ở aistudio.google.com rồi thêm vào kho.
   - Mã 404 ở `gemini-flash-lite-latest`: đổi `GEMINI_FALLBACK_MODEL` sang tên mô hình có trong AI Studio.
3. Sau khi có 200: nhờ học sinh có bài "chờ chấm" bấm **Chấm lại phần tự luận** (4 bài hôm nay).
4. Ghi `docs/handoff/antigravity-claude-ai-vung-hk-xong.md`: kết quả Kiểm tra AI (dòng "gọi Google từ", các mã). Không ghi khóa.
