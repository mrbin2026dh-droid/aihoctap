# Lời nhắc cho ChatGPT: giao diện giáo viên v3 (viết HTML + CSS chính xác để Claude ghép)
Dán toàn bộ nội dung dưới vạch này cho ChatGPT. Sau khi ChatGPT trả tệp, đưa lại cho Claude; Claude ghép, chạy kiểm thử, đẩy Git và kiểm tra link thật.

---

Bạn là nhà thiết kế giao diện kiêm kỹ sư front-end cao cấp. Hãy viết **HTML tĩnh + CSS** (không framework, không thư viện ngoài, không JavaScript nghiệp vụ) cho **trang quản lý của giáo viên** của ứng dụng học tập "SGK — Góc học tập". Kết quả sẽ được một kỹ sư khác ghép vào mã có sẵn, nên **độ chính xác về cấu trúc, id và tên trường quan trọng hơn vẻ đẹp**. Không được đổi tên, không được bỏ các id/name ở mục 6.

## 1. Bối cảnh
- Người dùng: giáo viên Tin học THCS (lớp 6–9), dùng cả điện thoại (390 px) và máy tính (1280 px). Giao diện chữ Tiếng Việt có dấu.
- Giao diện học sinh đã có theo phong cách sách giáo khoa: nền kem, xanh lục đậm, logo chữ "sgk" font serif. **Giao diện giáo viên phải cùng họ thị giác với học sinh** (hiện đang lệch: giáo viên dùng xanh dương + xám lạnh, kiểu chữ và khoảng cách tùy tiện).
- Chưa có menu: toàn bộ nằm trên một trang dài 3000+ px. Cần chuyển thành **4 phân hệ có menu** (mục 4).

## 2. Hệ thống thiết kế bắt buộc (khai báo thành biến CSS trong `:root`, dùng nhất quán, không dùng màu rời)
Màu (đã chọn để đạt tương phản WCAG AA; được phép tinh chỉnh nhẹ nhưng phải giải thích bằng bảng tương phản trong tệp ghi chú):
- `--ink:#18302d` chữ chính; `--muted:#536762` chữ phụ; `--paper:#f5f4ef` nền trang; `--surface:#fffefa` thẻ/bảng; `--sidebar:#eeeee6`; `--line:#d8dfd8` viền
- `--brand:#183e39` nút chính, mục menu đang chọn; `--brand-hover:#28574f`; `--brand-soft:#e5eedf` nền nhạt cho trạng thái chọn/thông tin
- Trạng thái: `--ok:#245b41` / nền `#e5eedf`; `--warn:#78350f` / nền `#fff3dd`; `--danger:#8b2d26` / nền `#fdecea`; `--info:#183e39` / nền `#e5eedf`
- Mọi cặp chữ–nền: chữ thường ≥ 4.5:1, chữ lớn và biểu tượng/viền điều khiển ≥ 3:1. **Không truyền đạt trạng thái chỉ bằng màu** (luôn kèm chữ).
Chữ:
- Chữ giao diện: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Chữ tiêu đề trang (h1) và logo: `"SGK Serif","Times New Roman",serif` (đã nạp sẵn bằng @font-face trong styles.css hiện có; **không khai báo lại @font-face, không dùng Georgia, không dùng font bên ngoài**).
- Thang cỡ chữ cố định: 12 / 14 / 16 / 18 / 22 / 28 / 36 px; chữ nội dung ≥ 16 px; ô nhập đúng 16 px (tránh tự phóng to trên iOS); chiều cao dòng 1.5–1.65; tiêu đề 1.25.
- Mỗi trang chỉ **một h1**; các khối con dùng h2; mục nhỏ dùng h3. Không nhảy cấp.
Khoảng cách và hình khối:
- Thang 4 px: 4, 8, 12, 16, 24, 32, 48. Bo góc: 8 px (nút, ô nhập), 12 px (thẻ, hộp thoại). Đổ bóng chỉ dùng một mức nhẹ cho thanh trên cùng và hộp thoại.
- Mục tiêu chạm ≥ 48×48 px. Ô nhập và nút cao ≥ 48 px. Khoảng cách giữa hai mục chạm ≥ 8 px.
- Căn chỉnh: mọi nhãn–ô nhập căn trái trên cùng một lưới; cột trái của biểu mẫu thẳng hàng với tiêu đề; số trong bảng căn phải và dùng `font-variant-numeric: tabular-nums`; chữ trong bảng căn trái; hàng thao tác căn phải. Không dùng `style=""` nội tuyến.
Tương tác (đủ cho mọi điều khiển): trạng thái mặc định, hover, focus-visible (viền 3 px màu `--brand`, cách 2–3 px), active, disabled, đang xử lý (`aria-busy="true"` + chữ "Đang …"), lỗi (`aria-invalid="true"` + thông báo ngay dưới ô, class `.field-error`). `prefers-reduced-motion: reduce` tắt hết chuyển động. Hỗ trợ `forced-colors`.
Quy tắc nội dung: Tiếng Việt ngắn, đúng, nhất quán thuật ngữ (Soạn bài, Kiểm tra, Tài liệu, Tài khoản học sinh, Xuất bản, Khóa/Mở khóa, Đặt lại mã PIN). **Không emoji. Không mã nhãn kỹ thuật** như "(D1 / A6)". Biểu tượng nếu có: SVG nội tuyến đơn giản (đường nét 1.75 px, `aria-hidden="true"`), luôn kèm chữ.

## 3. Khung trang (bố cục)
- Thanh trên cùng (cao 64 px, dính): logo "sgk" + nhãn nhỏ "GÓC GIÁO VIÊN"; bên phải nút "Hồ sơ" mở menu (có: Đổi mã PIN, Gia sư AI và hạn mức, Khóa API, Đăng xuất). Nút "Về Góc học tập" nằm trong menu Hồ sơ, không để rời.
- **Máy tính (≥ 1051 px)**: thanh bên trái rộng 224 px, 4 mục menu (mục đang chọn tô `--brand`, chữ trắng, `aria-current="page"`); vùng nội dung tối đa 1100 px.
- **Máy tính nhỏ (761–1050 px)**: thanh bên 184 px.
- **Điện thoại (≤ 760 px)**: thanh dưới cố định 4 mục, mỗi mục cao ≥ 56 px, **không xuống dòng chữ**, biểu tượng + chữ ngắn: "Soạn bài", "Kiểm tra", "Tài liệu", "Học sinh". Có `padding-bottom: env(safe-area-inset-bottom)`. Nội dung có khoảng đệm dưới để không bị che.
- Không cuộn ngang ở bất kỳ độ rộng nào từ 320 đến 1920 px. Phóng chữ 200% vẫn dùng được.
- Mẫu "danh sách → chi tiết": màn danh sách có nút "Thêm …"; chọn một dòng mở màn chi tiết có nút "Quay lại danh sách" ở đầu (điện thoại: thay thế màn danh sách; máy tính ≥ 1051 px có thể hiện hai cột).

## 4. Bốn phân hệ (mỗi phân hệ là một `<section id="view-…" hidden>`; chỉ một phân hệ hiện)
### 4.1 Soạn bài (`view-lessons`)
- Danh sách: tìm theo tên; lọc Lớp (6–9) và Môn; mỗi dòng: tên bài, Lớp, Môn, nhãn trạng thái (Nháp | Đã xuất bản), phiên bản, ngày sửa; nút "Mở". Nút "Soạn bài mới".
- Chi tiết: tab ngang 3 bước **Thông tin → Lý thuyết → Luyện tập** (`role="tablist"`, mũi tên chuyển tab, `aria-selected`, `aria-controls`). Thanh hành động dính ở đáy: "Xem trước", "Lưu nháp", "Xuất bản" (chính).
  - Thông tin: Khối lớp, Mã môn, Tên môn, Mã bài, Tiêu đề.
  - Lý thuyết: ô soạn Markdown + vùng xem trước (máy tính: hai cột; điện thoại: hai tab Soạn/Xem trước).
  - Luyện tập: danh sách thẻ câu hỏi trắc nghiệm (đề, 4 đáp án A–D, đáp án đúng, giải thích), nút "Thêm câu hỏi", nút "Nhập từ Excel" và "Tải mẫu Excel".
- Bên dưới danh sách, mục "Bài đã nộp" (kết quả học sinh) chuyển thành một ngăn "Bài đã nộp" trong chi tiết bài hoặc hộp riêng; không để lẫn với biểu mẫu.
### 4.2 Kiểm tra (`view-exams`)
- Danh sách: tiêu đề, Lớp, Môn, loại (15 phút / 1 tiết / giữa kỳ / cuối kỳ), thời lượng, giờ mở–đóng, nhãn trạng thái (Nháp | Đang mở | Đã khóa | Đã đóng), số bài nộp; menu thao tác mỗi dòng: Sửa, Khóa/Mở khóa, Theo dõi, Thống kê, Xóa.
- Tạo/sửa: Tiêu đề, Lớp, Môn, Loại, Thời gian làm bài (phút), Giờ mở, Giờ đóng, Số lần làm, Trộn câu hỏi, Khi nào hiện đáp án (sau nộp / sau khi đóng / không); nút "Tải mẫu Excel đề", "Tải lên Excel câu hỏi" (có bước xem trước và đánh dấu dòng lỗi).
- Theo dõi: bảng học sinh (Họ tên, Lớp, Trạng thái: Chưa vào | Đang làm | Đã nộp, Thời gian còn lại, nút "Gia hạn", "Cho làm lại").
- Thống kê: thẻ số (Điểm trung bình, Cao nhất, Thấp nhất, Đã nộp/Tổng), biểu đồ cột phân bố điểm (SVG tĩnh, có chữ thay thế dạng bảng), bảng tỉ lệ đúng từng câu, **bảng xếp hạng** (Hạng, Họ tên, Lớp, Điểm, Thời gian làm). Nút "Xuất Excel".
### 4.3 Tài liệu (`view-materials`)
- Danh sách: tên tài liệu, Lớp, loại (PDF/Excel/PowerPoint/Liên kết), ngày thêm, nhãn Hiện/Ẩn; thao tác: Sửa, Ẩn/Hiện, Xóa.
- Thêm/sửa: Tên tài liệu, Lớp (chọn nhiều), Liên kết chia sẻ Google Drive, Mô tả ngắn. (Tài liệu lưu trên Google Drive; không có ô tải tệp lên máy chủ.)
### 4.4 Tài khoản học sinh (`view-accounts`)
- Thanh công cụ: tìm theo tên/mã, lọc theo lớp, nút "Thêm học sinh", "Tải Excel lên", "Tải mẫu Excel", "Xuất danh sách".
- Bảng: ô chọn nhiều, Mã học sinh, Họ và tên, Lớp, Ghi chú, Trạng thái (Hoạt động | Đã khóa), Thao tác (Sửa, Đặt lại mã PIN, Khóa/Mở khóa, Xóa). Điện thoại: bảng chuyển thành **danh sách thẻ** (mỗi học sinh một thẻ, thao tác trong menu "Thao tác").
- Thêm/sửa (hộp thoại hoặc màn chi tiết): Họ và tên, Khối, Mã lớp, Mã học sinh, Mã PIN (tự sinh nếu để trống), Ghi chú.
- Tải Excel lên: 3 bước hiển thị rõ (1 Chọn tệp, 2 Xem trước và sửa lỗi, 3 Xác nhận). Bảng xem trước đánh dấu dòng lỗi bằng nhãn chữ ("Thiếu tên", "Trùng mã", "Lớp sai"), đếm "x hợp lệ, y lỗi".
- Thanh hành động hàng loạt xuất hiện khi chọn dòng: "Khóa", "Mở khóa", "Xóa" (đỏ, luôn xác nhận bằng hộp thoại).

## 5. Các trạng thái phải vẽ (mỗi phân hệ, dạng khối `<template>` hoặc phần "Thư viện trạng thái" ở cuối tệp ghi chú)
Đang tải (khung xương, dòng "Đang tải …"), danh sách trống (câu hướng dẫn + nút hành động), có dữ liệu, lỗi tải một phần (thông báo ngắn kèm nút "Thử lại", **không** làm hỏng phần khác), lỗi ô nhập, đang lưu, lưu xong, thay đổi chưa lưu (thanh cảnh báo + hộp thoại khi rời), mất mạng (ngoại tuyến), hộp thoại xác nhận xóa/khóa (nút "Hủy" mặc định được focus; Esc = hủy; không dùng alert/confirm/prompt), hộp thoại thông báo.
Dùng đúng phần tử `<dialog>` cho mọi hộp thoại. Thông báo nhanh dùng vùng `role="status" aria-live="polite"`; lỗi dùng `role="alert"`.

## 6. HỢP ĐỒNG VỚI MÃ HIỆN CÓ (BẮT BUỘC GIỮ NGUYÊN — mã JavaScript tìm theo các id/name này)
Giữ nguyên các **id**: `auth-section`, `teacher-login`, `teacher-pin`, `teacher-login-error`, `teacher-must-change-section`, `teacher-must-change-form`, `teacher-must-change-error`, `editor`, `workspace`, `workspace-title`, `published`, `load-lesson`, `new-lesson`, `publish-form`, `preview-button`, `preview`, `add-question`, `question-editors`, `refresh-results`, `teacher-results`, `material-form`, `students-section`, `add-student-form`, `refresh-students`, `students-class-filter`, `students-table`, `students-tbody`, `student-pin-banner`, `open-settings`, `close-settings`, `settings`, `settings-layout`, `settings-title`, `teacher-logout`, `teacher-regular-change-pin-form`, `teacher-change-pin-status`, `ai-settings-form`, `ai-default-limit`, `ai-exam-mode`, `ai-usage-tbody`, `download-ai-csv`, `refresh-ai-stats`, `add-key-form`, `keys-tbody`, `refresh-keys`, `pool-banner`, `msg-dialog` (cùng các id con `msg-title`, `msg-body`, `msg-form`, `msg-fields`, `msg-field`, `msg-field-label`, `msg-input`, `msg-error`, `msg-ok`, `msg-cancel`), `status` (vùng thông báo toàn cục), `main`.
Giữ nguyên các **name** trong biểu mẫu: `pin`; `old_pin`, `new_pin`, `confirm_pin`; bài học: `subject_id`, `subject_name`, `grade`, `lesson_id`, `title`, `content_markdown`; tài liệu: `material_id`, `material_course_id`, `material_title`, `material_drive_url`, `material_desc`; học sinh: `name`, `grade`, `class_code`, `pin`. Giữ nguyên ràng buộc `required`, `pattern`, `maxlength`, `minlength`, `type`.
Mã JavaScript sinh động các phần tử sau; **CSS phải định kiểu đẹp cho chúng**: hàng trong `#students-tbody` (có ô chứa `.row-actions` hoặc `.action-list` gồm các `<button>`), thẻ `.question-edit` trong `#question-editors`, thẻ `.progress-card` trong `#teacher-results`, `.field-error`, `.notice` / `.notice.error` / `.notice.success` / `.status`, `.visually-hidden`, `.teacher-grid`, `.has-detail`. Mô tả rõ mẫu HTML của từng phần tử này trong tệp ghi chú để kỹ sư ghép biết.
Các id **mới** do bạn đặt phải theo quy ước: menu `nav-lessons`, `nav-exams`, `nav-materials`, `nav-accounts`, `nav-profile`; phân hệ `view-lessons`, `view-exams`, `view-materials`, `view-accounts`; màn danh sách `list-…`, màn chi tiết `detail-…` (ví dụ `list-lessons`, `detail-lessons`); tab `tab-…`/`tabpanel-…`; nút hành động `act-<phân-hệ>-<việc>` (ví dụ `act-accounts-import`). Dùng `data-view`, `data-action`, `data-id` cho phần tử cần JS gắn sau, **không dùng lớp CSS làm móc cho JS**.
Mật khẩu/mã PIN: `type="password"`, `autocomplete="off"` hoặc `current-password`/`new-password` đúng chỗ, có nút "Hiện/Ẩn" dạng `button[data-reveal]` (`aria-pressed`). Ô PIN `inputmode="numeric"` khi là PIN học sinh.

## 7. Yêu cầu kỹ thuật cho tệp trả về
Trả về **đúng 3 tệp** (khối mã riêng, ghi rõ tên tệp):
1. `teacher.html` — tài liệu đầy đủ, `lang="vi"`, meta viewport, nạp `./styles.css` rồi `./teacher.css`, nạp `<script type="module" src="./teacher.js">` ở cuối (không viết JS). Có liên kết bỏ qua đến `#main`. Toàn bộ 4 phân hệ nằm trong `#editor`; các phần đăng nhập giữ như hiện có nhưng đổi hình thức theo hệ thống mới. Mọi phân hệ ngoài phân hệ đầu có `hidden`.
2. `teacher.css` — chỉ chứa biến thiết kế + kiểu của giao diện giáo viên, **tiền tố lớp `t-`** cho phần tử mới (ví dụ `t-shell`, `t-nav`, `t-table`, `t-card`, `t-badge`). Chia mục có chú thích: biến → nền tảng → khung → menu → danh sách/bảng → biểu mẫu → tab → hộp thoại → trạng thái → đáp ứng → in/giảm chuyển động/forced-colors. Không `!important` (trừ `[hidden]`), không dùng id làm bộ chọn kiểu (dùng lớp), không chồng chéo với `styles.css` của học sinh (mọi quy tắc nằm dưới `.teacher-app`).
3. `GHI_CHU.md` — (a) bảng tương phản màu đã tính; (b) danh sách id/name giữ nguyên đã đối chiếu; (c) mẫu HTML các phần tử JS sinh; (d) bảng độ rộng kiểm tra 320/390/768/1024/1280/1920; (e) việc chưa làm được và giả định.
Quy tắc cứng: không thư viện, không CDN, không ảnh ngoài, không font ngoài, không emoji, không `alert/confirm/prompt`, không `style=""`, không tự đặt dữ liệu thật (dùng dữ liệu mẫu nêu rõ "[THỬ]" nếu cần minh họa, tên người giả như "Học sinh Thử 01").

## 8. Tự kiểm tra trước khi trả lời (ghi kết quả vào GHI_CHU.md)
- Tab bằng bàn phím đi hết mọi điều khiển theo thứ tự hợp lý; focus luôn nhìn thấy.
- 320 px: không cuộn ngang, không chữ bị cắt, thanh dưới không xuống dòng.
- Chuỗi thử Tiếng Việt dài hiển thị đủ (không cắt dấu), ở 100% và 200%: "Nguyễn Thị Phương Thảo Quỳnh", "Ôn tập Chương 2: Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin", "Kiểm tra giữa kỳ I — Tin học 9".
- Mọi cặp màu chữ/nền ≥ 4.5:1 (chữ thường). Mọi điều khiển ≥ 48 px.
- Không có id trùng; mỗi nhãn gắn đúng ô nhập; mỗi bảng có `<caption>` hoặc `aria-label`; mỗi `<dialog>` có tiêu đề và nút đóng.
- Đối chiếu danh sách id/name ở mục 6: **đủ 100%**.

## 9. Bàn giao
Kết thúc bằng: "XONG giao diện giáo viên v3. TIẾP THEO → Claude. Dán cho họ: Đọc AGENTS.md rồi ghép teacher.html + teacher.css vào frontend/hoc và kiểm thử." Không đẩy lên Git; Claude sẽ đẩy.
