# Claude → Antigravity: sửa lỗi Hiệu quả / Lớp chơi / AI bận + cột Trực tuyến, thời gian học (29/10)

## 1. Claude đã làm (đã đẩy GitHub; Pages tự phát hành)
- **Lỗi "Mạng đang chậm" (Hiệu quả) và "Chưa có lớp" (Trò chơi câu hỏi):**
  - Đọc Firebase tự thử lại 1 lần khi mạng chập chờn (`thi-store.js`).
  - Trò chơi: tải danh sách lớp lỗi thì báo đúng lỗi ("Chưa tải được danh sách lớp…"), không còn báo nhầm "Chưa có lớp".
- **"AI đang bận" khi AI soạn câu hỏi:** là Gemini trả 429 (hết lượt).
  - Worker giờ thử thêm **mô hình dự phòng** (`GEMINI_FALLBACK_MODEL`) trước khi báo bận.
  - Báo đúng nguyên nhân: hết lượt **trong ngày** (gói miễn phí) hoặc quá nhiều yêu cầu **trong 1 phút**.
- **Hộp thoại "Cài ứng dụng" của Chrome:** hình minh họa mặc định không thay được. Đã thêm 5 ảnh chụp thật vào `manifest.webmanifest` (`seo/screens/`); Chrome sẽ hiện hộp thoại cài lớn có ảnh app.
- **Tài khoản → Học sinh:**
  - Cột **Trực tuyến** theo thời gian thực (Firebase `presence`):
    - Đang học / Đang thi / Phòng chờ.
    - Ngoại tuyến kèm "x phút trước".
    - Chưa đăng nhập.
  - Cột **Hôm nay** và **7 ngày** (số phút học), cột **Chuyên cần**, xếp theo luật rõ ràng:
    - Chăm: ≥ 90 phút và ≥ 3 ngày.
    - Có học: ≥ 30 phút.
    - Học ít: > 0.
    - Chưa học.
  - **5 thẻ thống kê**, bấm vào thẻ là lọc: Học sinh (kèm TB phút hôm nay), Đang trực tuyến, Ngoại tuyến, Có học hôm nay, Chưa học 7 ngày.
  - **Bộ lọc:** lớp, trực tuyến, học trên app (hôm nay / chưa học hôm nay / dưới 30 phút / chưa học 7 ngày).
  - **Sắp xếp:** tên, lớp, trực tuyến trước, học nhiều/ít nhất.
  - Cách đếm phút: mỗi phút app **đang mở trên màn hình** và em đang học / phòng chờ / thi thì app cộng 1 phút vào `thoi_gian/{ngày giờ VN}/{mã}`. App chạy nền hoặc tắt màn hình thì không đếm.
  - Số liệu bắt đầu từ **29/10/2026**; trang ghi rõ điều này, không suy đoán ngày trước.
- **Bộ não:**
  - Thu thập `thoi_gian` 7 ngày, lưu vào bảng `study`.
  - Báo cáo thêm mục **Thời gian học trên app**.
  - Mục "cần chú ý" thêm lý do "chỉ học N phút / không học trên app 7 ngày qua". Lý do này chỉ xuất hiện khi đã có số liệu đo, không kết luận khi chưa đo.
- **Kiểm thử:**
  - Mới: `test_accounts_live` 42 ca; Bộ não 20 ca (thêm 2 ca thời gian học); `test_essay_ai` 19 ca.
  - Hồi quy: giáo viên, thi, trò chơi, SEO, cài app, loading đều đạt.

## 2. Antigravity làm — theo thứ tự
1. **Khóa API Google (gây lỗi `identitytoolkit … 403` khi học sinh đăng nhập, mất trạng thái trực tuyến có vé):**
   - Google Cloud Console → APIs & Services → Credentials → khóa web của dự án `ai-sgk-tinhoc` → Website restrictions: thêm `https://aihoctap.online/*` (giữ dòng github.io cũ) → Save.
   - Firebase Console → Authentication → Settings → Authorized domains: thêm `aihoctap.online`.
   - Kiểm: mở `https://aihoctap.online`, đăng nhập học sinh giả, F12 → Console **không còn** `API_KEY_HTTP_REFERRER_BLOCKED`.
2. **Luật Firebase:** dán `spike/step0/database.rules.ai-sgk-final.json` (thêm nhánh `thoi_gian`) → Publish.
   - Kiểm: `curl -s "<DB_URL>/thoi_gian.json?shallow=true"` trả `null` hoặc danh sách ngày (không phải "Permission denied").
3. **Worker:**
   - `git pull`.
   - Đặt biến `GEMINI_FALLBACK_MODEL` = một mô hình Flash-Lite đang có trong tài khoản (xem danh sách ở Google AI Studio; ví dụ dạng `gemini-…-flash-lite`).
   - `npx wrangler deploy`.
   - Chạy `npx wrangler tail`, bấm "AI soạn câu hỏi" 1 lần. Nếu thấy `[GEMINI_FAIL] 429 … PerDay` → khóa hết lượt ngày: thêm 1–2 khóa Gemini (Hồ sơ → Khóa Gemini). **Không** ghi khóa vào báo cáo.
4. **VPS:** chạy lại `setup.sh` (giữ `.env`) → 20 ca OK → `python -m brain quick` chạy không lỗi.
   - Bật lại báo cáo tối sau bài thi hôm nay: `systemctl enable --now brain.timer`.
5. Việc treo từ trước: bỏ `http://aihoctap.online` khỏi `ALLOWED_ORIGIN` (HTTPS đã chạy).
6. **Thử thật:**
   - Máy A đăng nhập học sinh giả, để app mở 3 phút.
   - Máy B (giáo viên) → Tài khoản: em đó hiện chấm xanh "Đang học"; sau ~3 phút cột Hôm nay ≥ 2 phút.
   - Máy A khóa màn hình 3 phút → máy B chuyển "Ngoại tuyến".
7. Ghi kết quả vào `docs/handoff/antigravity-claude-truc-tuyen-xong.md`. Không ghi tên/mã học sinh, khóa, mật khẩu.
