# Phán quyết Gate Code lần 5 (I1–I4 + repo sạch)
24/10/2026 · Claude · **KẾT LUẬN: YÊU CẦU ĐIỀU CHỈNH (nhỏ)**
- I1–I4: ĐẠT. Repo sạch: chưa được push cho đến khi xong J3.

Tự chạy: `test_gate_code_i1_i4` 4/4, `h1_h6` 5/5, `g1_g6` 4/4, `worker_gate` 6/6 PASS. Đọc mã `worker/index.js`. Đây là kiểm bằng MOCK; chưa chạy Firebase/Cloudflare/Gemini THẬT.

## Đạt
- I1: đổi service account → access token OAuth2 (RS256 assertion, cache), RTDB dùng `Authorization: Bearer`; test dùng endpoint token giả.
- I2: thiếu `ALLOWED_ORIGIN` trả 500, không còn tên miền cá nhân.
- I3: `context.grade` ép số 1–12.
- I4: dấu `:` trong `packageKey`; lỗi RTDB khi tải gói trả 502; lượt Gemini chỉ tính sau 200.
- Repo sạch: 1 commit, `7f670c9` không tồn tại; quét tệp văn bản: không thấy khóa API, private key, PIN, giá trị đáp án lộ.

## Điều kiện
- **J1 (trước khi nối Gemini thật)**: `/check-gemini-limit` (dry-run) rồi `/commit-gemini-usage` sau lời gọi: N yêu cầu song song cùng qua kiểm tra trước khi ai commit, nên vượt trần 30/ngày/học sinh và 1000/ngày. Đổi thành đặt chỗ nguyên tử trong DO (tăng ngay), hoàn lại khi Gemini lỗi; thêm test song song.
- **J2 (trước khi chấm bài thật)**: `packages_private` Worker đọc phẳng `course:lesson` (bỏ `version`), kế hoạch lại lồng `{course}/{lesson}/{version}`. Chọn một schema, ghi vào rules/SETUP, viết script nạp gói từ bản sao lưu NGOÀI repo; không commit đáp án.
- **J3 (chặn push)**: repo sạch còn `frontend/app.js` mang `firebaseConfig` thật (dự án `ai-sgk-tinhoc`) và email giáo viên, `frontend/index.html` bản cũ; metadata commit chứa email cá nhân. Loại hoặc thay bằng cấu hình giữ chỗ các tệp cũ không dùng cho Pages; đặt `user.email` dạng noreply rồi tạo lại commit đầu; quét lại toàn cây bằng sanitizer.
- **J4 (người dùng quyết)**: SETUP nói "tạo dự án Firebase mới", nhưng `ai-sgk-tinhoc` đã tồn tại: dùng lại hay tạo mới? Nếu dùng lại, giới hạn API key theo domain và rà rules cũ. Nếu tạo mới, lộ config cũ không còn quan trọng.

## Người dùng làm trước khi push
Xóa hoặc chuyển riêng tư repo cũ `aihoctap`; tạo repo công khai mới và gửi tên; sau đó clone mới, mở `7f670c9` phải 404.
