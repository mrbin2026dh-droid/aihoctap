# Phán quyết V3: Kế hoạch Firebase Serverless
24/10/2026 · Claude · **KẾT LUẬN: ACCEPT CÓ ĐIỀU KIỆN** (được bắt đầu code; E1–E2 phải xong trước khi bật Pages hoặc push thêm)

## Đối chiếu D1–D6
- D1 **đạt**: luật `attempts` đã đúng (ghi `score` riêng bị chặn, cấm sửa/xóa). Chưa có cơ sở thấy lỗi mới.
- D2 **đạt một phần**: hướng đúng nhưng xem E2.
- D3 **đạt một phần**: bỏ Anonymous Auth là đúng, nhưng thiếu chống vét PIN, xem E1.
- D4 **đạt một phần**: xem E3.
- D5 **đạt một phần**: xem E4.
- D6 **đạt**: bundle SDK và test offline sau đăng nhập đủ.

## Điều kiện (ghi thành phụ lục kế hoạch, kiểm chứng ở gate code)
- **E1 (chặn)**: `/api/login` chạy trước khi có UID nên rate-limit theo UID không áp dụng. Khóa tạm theo mã học sinh (ví dụ 5 lần sai) và theo IP; PIN lưu băm chậm (PBKDF2 qua Web Crypto), tránh PIN ngắn bị vét cạn. Test: nhập sai liên tiếp phải bị khóa.
- **E2 (chặn)**: filter-repo rồi force push không xóa commit cũ trên GitHub: SHA cũ còn truy cập qua URL, cache hoặc fork cho đến khi GitHub dọn. Cách chắc là tạo repo mới sạch (hoặc xóa rồi tạo lại) và đẩy lịch sử đã lọc. Sao lưu 17 JSON ngoài repo trước khi xóa vì đó là nguồn dữ liệu. Kiểm chứng thêm bằng clone mới và mở SHA `7f670c9` phải 404; quét mọi nhánh, tag, `tests/`, tệp zip, không chỉ `frontend/`.
- **E3**: nói rõ ai ghi `attempts`. Nếu chỉ Worker ghi (service account bỏ qua luật) thì đặt quyền ghi của học sinh là `false`, tránh lách giới hạn N bằng nhiều `attempt_id`. Đếm N phải nguyên tử (Durable Object hoặc ghi có điều kiện), khóa idempotency theo `uid + attempt_id`.
- **E4**: trần Gemini 1000/ngày không làm được bằng Rate Limiting binding (cửa sổ ngắn, theo từng điểm biên); dùng Durable Object. "5 req/phút" chỉ là xấp xỉ. SW không cache `/api/*`.

Rủi ro còn lại, chấp nhận: luyện tập N=2 vẫn rò thông tin tổng điểm (đổi một đáp án rồi so điểm); thi giữ N=1.

Chưa chạy code; dựa trên kế hoạch V3 và mục cuối nhật ký.
