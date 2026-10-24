# Phán quyết: Giới hạn và thống kê học sinh dùng AI (A9/B7)
Người kiểm định: Claude. Ngày: 2026-10-25. Mức bảo mật: CAO (hạn mức AI).

## Kết luận: ACCEPT (MOCK) kèm 1 điều kiện chặn deploy (T1)

## Đã tự kiểm chứng (MOCK)
- Tự chạy 12 bộ test: 11 PASS; `test_gate_code_j1_j3.mjs` FAIL (xem T1). `node --check` worker, teacher.js, app.js sạch.
- Đọc mã DO: `vnDay` UTC+7; thứ tự chặn exam_mode → locked → limit; ưu tiên student > lớp > mặc định + grant; đặt chỗ trong `_withLock` (nguyên tử); refund trừ cả khóa mới và khóa cũ; chỉ lưu số đếm, không lưu nội dung chat.
- Route: `/api/teacher/ai-*` yêu cầu quyền giáo viên (403 nếu không); CSV chống công thức (`'` trước `= + - @`); `/api/pwa/ai-quota` cần JWT học sinh; `/api/tutor` trả 429 với `error` ∈ {AI_LOCKED, AI_DISABLED_IN_EXAM, AI_LIMIT_REACHED}.
- Giao diện: 0 emoji ở teacher.js/teacher.html; có huy hiệu "Còn N lượt", ô mặc định, công tắc đang thi, khóa/mở, +5 lượt, tải CSV.

## T1 (bắt buộc trước deploy): test lỗi theo giờ
`test_gate_code_j1_j3.mjs` (dòng 109, 159) và `test_gate_code_i1_i4.mjs` (dòng 155, 166, 191) dùng ngày UTC, trong khi Worker dùng ngày giờ VN. Từ 00:00 đến 07:00 giờ VN các test này FAIL (tôi chạy lúc 00:15 VN: j1_j3 lỗi, và sửa thành giờ VN thì PASS). Báo cáo "PASS 4/4" chỉ đúng khi chạy ngoài khung giờ đó. Lỗi ở test, không ở sản phẩm. Sửa: dùng `vnDay()` (hoặc `new Date(Date.now()+7*3600*1000).toISOString().slice(0,10)`) ở các dòng trên; thêm một test chạy cố định giờ giả (giả `Date.now`) qua mốc 17:00 UTC.

## Lưu ý (không chặn)
- `PUT ai-settings` chưa kiểm giá trị `class_limits`/`student_limits` (chuỗi/âm); `effectiveLimit` đã chặn âm nên không gây hại. Nên ép số nguyên 0–200.
- Số liệu THẬT chưa có (chưa deploy); `[x]` A9/B7 chỉ đánh sau khi chạy thật.
