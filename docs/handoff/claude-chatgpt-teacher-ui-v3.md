# Claude → ChatGPT: giao diện giáo viên v3 (4 phân hệ có menu, thống nhất hệ thiết kế)
Đọc AGENTS.md (đặc biệt I, J, K, N) rồi làm theo **toàn bộ** `docs/prompts/chatgpt-teacher-ui-v3.md` (phần dưới vạch `---`). Phân tích chức năng: `docs/plans/giao-dien-giao-vien-4-phan-he.md`. Thẩm định hiện trạng: `docs/audits/2026-10-25-teacher-ia-verdict.md`.

## Việc của ChatGPT
Viết HTML + CSS tĩnh cho trang giáo viên, đúng 3 tệp: `teacher.html`, `teacher.css`, `GHI_CHU.md`, đặt vào `docs/design/teacher-ui-v3/`. Không viết JavaScript nghiệp vụ, không sửa `frontend/hoc/`, không đẩy Git.

## Quyết định người dùng đã chốt
- 4 phân hệ: Soạn bài (Lớp, Môn, Tên bài → Lý thuyết → Luyện tập), Kiểm tra, Tài liệu, Tài khoản học sinh. Cài đặt cá nhân (đổi PIN, gia sư AI, khóa API, đăng xuất) ở menu Hồ sơ.
- Tài liệu lưu Google Drive (chỉ nhập liên kết, không tải tệp lên máy chủ). Excel đọc ngay trên trình duyệt. Môn học do giáo viên tự thêm. Hiện một giáo viên; nhiều giáo viên mở sau.
- Đề kiểm tra: dữ liệu ở Firebase qua Worker (làm sau; lần này chỉ giao diện).

## Ràng buộc cứng
Giữ nguyên mọi id/name ở mục 6 của lời nhắc (mã đăng nhập, xuất bản, quản lý học sinh đang chạy thật dùng chúng). Không emoji, không mã nhãn kỹ thuật, không alert/confirm/prompt, không font ngoài, không Georgia, mục chạm ≥ 48 px, tương phản AA.

## Tiêu chí nghiệm thu (Claude kiểm)
Đối chiếu id/name 100%; không cuộn ngang 320–1920 px; thanh dưới điện thoại không xuống dòng; thử chuỗi Tiếng Việt dài ở 100%/200%; tương phản; bàn phím; đủ các trạng thái (trống, tải, lỗi một phần, lỗi ô, chưa lưu, ngoại tuyến, hộp thoại xác nhận). Claude ghép vào `frontend/hoc`, chạy toàn bộ kiểm thử, đẩy Git, kiểm tra link thật.

Kết thúc: XONG … / TIẾP THEO → Claude / Dán cho họ: "Đọc AGENTS.md và docs/design/teacher-ui-v3/GHI_CHU.md rồi ghép vào frontend/hoc và kiểm thử."
