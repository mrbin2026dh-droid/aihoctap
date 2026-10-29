# Claude → Antigravity: kiểm thử mô phỏng toàn hệ thống bằng tài khoản THỬ (29/10 tối)

## 0. Ràng buộc bắt buộc (đọc trước)
- **KHÔNG đăng nhập tài khoản của học sinh thật.** Không dùng mã/PIN của học sinh trong Sheet. Lý do: (1) dữ liệu giả sẽ lẫn vào hồ sơ thật của các em (điểm, chuyên cần, Bản đồ năng lực, nhật ký Gia sư); (2) không được dùng thông tin đăng nhập của người khác; (3) số liệu không được trình bày như hoạt động thật của học sinh.
- Chỉ dùng **lớp thử riêng** `9TH` (khối 9), 30 tài khoản tên bắt đầu `[THỬ]`, mã `TH9001`…`TH9030`. Tài khoản do thầy hoặc Antigravity tạo **qua app** (Tài khoản → Thêm học sinh) để tự đẩy lên Firebase. PIN thử do Antigravity tự sinh, ghi vào `tests/fixtures/` **không commit** (thêm vào `.gitignore`), không ghi vào báo cáo hay chat.
- Mọi báo cáo, ảnh, biểu đồ từ đợt này đều ghi nhãn **"KIỂM THỬ MÔ PHỎNG – lớp 9TH, không phải học sinh thật"**.
- Số liệu thật của học sinh đang có (Tài khoản: số em có học hôm nay; Học sinh đọc bài) giữ nguyên, báo cáo riêng là **"Thí điểm thật"**.

## 1. Mục tiêu
1. Tìm bug thật trên https://aihoctap.online khi nhiều em dùng cùng lúc (đăng nhập, học, Luyện tập, Gia sư, thi thử, Thảo luận, Tổng quan).
2. Có số đo kỹ thuật (thời gian phản hồi, lỗi Console, tỉ lệ lỗi) để chứng minh hệ thống chạy ổn định dưới tải, có nhãn mô phỏng.
3. Kiểm tra màn phân tích của giáo viên hiển thị đúng với dữ liệu đã tạo (đối chiếu số).

## 2. 30 tài khoản theo 5 nhóm (để thống kê có phân hóa)
| Nhóm | Mã | Hành vi kịch bản |
|---|---|---|
| A. Chăm, giỏi | TH9001–006 | Đọc hết 3 bài; Luyện tập mỗi bài 2 lần, đúng ≥ 80%; hỏi Gia sư 3 câu khái niệm; thi thử 1 lần (≥ 8/10). |
| B. Trung bình | TH9007–015 | Đọc 2 bài; Luyện tập 1–2 lần, đúng 50–79%; hỏi Gia sư 2 câu; thi thử (5–7/10). |
| C. Yếu | TH9016–022 | Đọc 1 bài dở (30–60%); Luyện tập 1 lần, đúng < 50%; thi thử (≤ 4/10). |
| D. Thử phá | TH9023–026 | Hỏi Gia sư: xin đáp án, "có phải B không", câu ngoài bài (Python, bóng đá), gõ linh tinh, giả làm giáo viên; gõ từ tục ở Thảo luận. |
| E. Chưa vào | TH9027–030 | Không đăng nhập (kiểm tra "Chưa làm"/"Chưa đọc"). |
Đáp án chọn theo tỉ lệ đúng của nhóm, ngẫu nhiên có hạt giống cố định (`seed=2026`) để chạy lại ra cùng kết quả.

## 3. Cách chạy
- Viết `tests/sim/run_simulation.cjs` (Playwright, Chromium), mỗi em một context riêng, chạy **song song 10 em**, viewport điện thoại 390×844 cho nửa số em và 1280×800 cho nửa còn lại.
- Ghi cho mỗi bước: thời gian (ms), mã HTTP, lỗi Console/pageerror, ảnh khi lỗi. Ghi `tests/sim/out/log.jsonl` (không có PIN).
- Gia sư: dùng `ms`/Server-Timing trong phản hồi `/api/pwa/tutor`. Tổng số câu hỏi Gia sư ≤ 80 (giữ hạn mức Gemini).
- Thi thử: giáo viên tạo 1 đề thi thử 10 câu cho lớp `9TH`, mở 20 phút; nhóm A–C vào thi cùng lúc.
- Thảo luận và Luyện tập trực tiếp: giáo viên mở 1 phòng mỗi loại cho lớp `9TH`; 15 em vào, trả lời; chụp màn chiếu (đếm ngược, bảng xếp hạng, đám mây từ).
- Sau khi chạy: giáo viên mở Tổng quan (lớp 9TH), Học sinh đọc bài, Hiệu quả, Tài khoản → chụp ảnh và **đối chiếu số** với log (ví dụ: đã làm bài x/30 phải bằng số em nhóm A–C đã nộp).

## 4. Báo cáo bắt buộc: `docs/handoff/antigravity-claude-kiem-thu-mo-phong-xong.md`
1. Bảng tổng: số bước, số lỗi, tỉ lệ lỗi, thời gian trung vị / p95 theo từng loại (đăng nhập, mở bài, nộp Luyện tập, Gia sư, nộp thi, Thảo luận gửi ý).
2. **Danh sách bug**: mỗi bug ghi bước tái hiện, kết quả mong đợi, kết quả thật, ảnh, dòng log. Không tự sửa mã; chuyển Claude.
3. Bảng đối chiếu số: màn giáo viên (ảnh) và log (số) → khớp / lệch.
4. Gia sư: 20 câu nhóm D, chép nguyên văn câu trả lời, đánh giá có lộ đáp án / từ chối đúng / không xưng Thầy/Cô.
5. Ảnh để ở `docs/handoff/anh/mo-phong-29-10/`, mỗi ảnh có nhãn mô phỏng. **Commit + push** báo cáo, ảnh, script (không commit PIN).

## 5. Dọn dữ liệu sau cuộc thi (chỉ lớp 9TH, không đụng dữ liệu thật)
Xóa theo mã `th9001`…`th9030` và lớp `9TH`: Firebase `attempts/{mã}`, `attempt_details/{mã}`, `doc_read/*/{mã}`, `thoi_gian/*/{mã}`, `presence/{mã}`, `nang_luc/{mã}`, `thi_vao|thi_nop/{đề thử}/…`, phòng `quiz/…`, `tl/…` đã dùng; Sheet: xóa 30 dòng HocSinh và các dòng KetQua của đề thử; nhật ký Bộ não lớp 9TH. Ghi lại lệnh/đường dẫn đã xóa vào báo cáo.
