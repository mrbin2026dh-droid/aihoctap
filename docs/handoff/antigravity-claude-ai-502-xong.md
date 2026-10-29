# Antigravity → Claude & Thầy: Đã triển khai Worker xử lý AI 502 & Sẵn sàng Kiểm tra AI

Ngày: 29/10/2026 (Asia/Bangkok)

---

## 1. Kết quả triển khai lên máy chủ AI (Cloudflare Worker)

- **Worker Name**: `aihoctap-gate`
- **Deploy Status**: SUCCESS (0 lỗi)
- **Current Version ID**: `2892936a-72eb-4c5e-ab40-b6857b4891e7`
- **Trigger URL**: `https://aihoctap-gate.mrbin2026dh.workers.dev` (Frontend kết nối qua `API_BASE` với CORS cho phép `https://aihoctap.online`)
- **Môi trường hoạt động**:
  - `GEMINI_MODEL`: `gemini-3.5-flash-lite`
  - `GEMINI_FALLBACK_MODEL`: `gemini-flash-lite-latest`
  - Cơ chế tự phục hồi: Thử lại 2 lần có giãn cách khi gặp lỗi 5xx/mất mạng; tự đổi khóa trong kho và khóa mặc định khi gặp lỗi 401/403; tự đổi mô hình sang fallback khi gặp lỗi; trả thông báo sư phạm thân thiện kèm mã lỗi chuẩn.

---

## 2. Kết quả kiểm thử tự động (Unit & Integration Tests)

1. **`test_gemini_recovery.mjs`**: **11/11 PASS (100%)**
   - Đạt các ca: Gia sư thử lại khi 503; tự chuyển fallback model khi 404; đổi khóa pool sang khóa mặc định khi 403; không nuốt lỗi, báo lỗi rõ ràng khi cạn tất cả phương án.
2. **`test_check_score.mjs`**: **8/8 PASS (100%)**
3. **`test_thi_tuluan.cjs`**: **70/70 PASS (100%)**
   - Đạt toàn bộ luồng học sinh làm bài tự luận, tự làm mới token khi hết hạn (401), xử lý an toàn khi AI bận, chấm lại điểm tự luận độc lập không mất bài.

---

## 3. Hướng dẫn Thầy bấm "Kiểm tra AI ngay" và xử lý theo mã lỗi

Thầy mở trình duyệt truy cập:
👉 **`https://aihoctap.online/teacher.html`** (Đảm bảo có `https://`)

Các bước thực hiện:
1. Đăng nhập vào tài khoản Giáo viên.
2. Chọn mục **Hồ sơ** (Profile) → cuộn tới phần **Khóa API**.
3. Bấm nút **"Kiểm tra AI ngay"**.
4. Hệ thống sẽ gọi thử nghiệm tất cả các khóa và mô hình (chính + dự phòng), hiển thị bảng kết quả rõ ràng:

| Mã kết quả | Ý nghĩa & Hướng xử lý |
|---|---|
| **200 (Xanh - Chạy tốt)** | **AI hoạt động hoàn hảo!** Nếu có ít nhất 1 dòng 200, học sinh có thể vào làm bài hoặc bấm **"Chấm lại phần tự luận"** ngay lập tức. |
| **401 / 403 (Đỏ - Khóa bị từ chối)** | Khóa Gemini bị từ chối (thường do khóa tạo trên Google Cloud bị cài giới hạn `Websites` HTTP referrers, trong khi Worker gọi từ máy chủ Backend). **Cách sửa**: Tạo API Key mới tại Google AI Studio (`aistudio.google.com`) không giới hạn trang web, rồi chạy `npx wrangler secret put GEMINI_API_KEY` hoặc thêm vào kho khóa trong giao diện Hồ sơ. *(Lưu ý: Không dùng khóa Firebase Web của aihoctap.online làm khóa Gemini)*. |
| **404 (Sai tên mô hình)** | Mô hình không tồn tại trong tài khoản. Sửa lại biến `GEMINI_FALLBACK_MODEL` trong `wrangler.toml` sang mô hình Flash hợp lệ rồi deploy lại. |
| **429 (Hết lượt gọi)** | Khóa đã chạm trần quota ngày/phút. Cần thêm 1-2 khóa AI Studio khác vào kho khóa ở mục Hồ sơ. |
| **503 / 500 (Máy chủ quá tải)** | Google Gemini đang nghẽn tạm thời. Bản vá mới đã tự động thử lại và đổi mô hình; chỉ cần đợi 1–2 phút. |

---

## 4. Trạng thái tiếp theo
- Thầy thực hiện bấm nút **"Kiểm tra AI ngay"** trên giao diện giáo viên.
- Nếu cần theo dõi nhật ký mạng thời gian thực khi học sinh gửi bài, có thể mở terminal chạy: `npx wrangler tail`.
