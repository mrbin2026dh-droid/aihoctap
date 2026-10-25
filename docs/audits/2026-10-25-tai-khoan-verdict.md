# Phán quyết: Bộ tài khoản (PIN giáo viên, quản lý học sinh, đổi PIN, phân quyền khối)
Người kiểm định: Claude. Ngày: 2026-10-25. Mức bảo mật: CAO.

## Kết luận: YÊU CẦU ĐIỀU CHỈNH (1 lỗi chặn, C1). Phần còn lại ACCEPT mức MOCK.

## Đã tự kiểm chứng (MOCK)
- Chạy 13 bộ test: tất cả PASS, gồm `test_accounts.mjs` 9/9 (lưu ý: lần đầu tôi thấy lỗi do bản `worker/contracts.js` cũ lúc nạp tệp, đã nạp lại và PASS). `node --check` worker, teacher.js, app.js sạch.
- Đọc mã: đăng nhập giáo viên theo PBKDF2 (có bản ghi) hoặc secret khởi tạo (chưa có bản ghi), claim `must_change`; `requireTeacher` chặn mọi route khác bằng 403 `TEACHER_PIN_CHANGE_REQUIRED`; `change-pin` có khóa thử sai, PIN ≥ 8, khác cũ, không lặp ký tự, kiểm `res.ok` (502); 5 route học sinh đều `requireTeacher` + kiểm ID; danh sách không trả salt/hash; khóa học sinh trả 403 sau khi PIN đúng; đổi PIN học sinh; học sinh khối 9 bị 403 khi mở bài khối 6; giao diện giáo viên có form đổi PIN, bảng học sinh; không emoji ở teacher.js/teacher.html.

## C1 (chặn deploy): `X-Admin-Secret` là khóa vạn năng vĩnh viễn
`requireTeacher` (worker/index.js ~1238) chấp nhận header `X-Admin-Secret` = `TEACHER_ADMIN_SECRET` trên MỌI route giáo viên: (a) vẫn hoạt động sau khi giáo viên đã đổi PIN, nên PIN khởi tạo (đã lộ trong chat) mãi mãi là quyền quản trị; (b) bỏ qua bước bắt đổi PIN; (c) không có khóa thử sai, có thể dò mật khẩu không giới hạn. Đây là lỗ hổng do chính đặc tả của tôi cho phép "giữ header cho dự phòng"; tôi rút lại phần đó.

## Lưu ý (không chặn)
- Token giáo viên đã cấp trước khi đổi PIN còn hiệu lực tối đa 1 giờ.
- `app.js`/`index.html` cũ còn 1–2 ký tự emoji (không thuộc phần mới).
