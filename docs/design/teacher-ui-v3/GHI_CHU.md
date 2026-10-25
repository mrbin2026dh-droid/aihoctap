# Giao diện giáo viên v3 — ghi chú bàn giao
25/10/2026 · ChatGPT/Codex → Claude · HTML/CSS tĩnh, chưa ghép vào ứng dụng.

## 1. Phạm vi và cách xem
Đúng ba tệp: teacher.html, teacher.css, GHI_CHU.md. Không sửa frontend/hoc, Worker hoặc teacher.js; không commit/push. Bản này thay bố cục một trang dài bằng bốn phân hệ, giữ thông tin tài khoản giáo viên trong Hồ sơ.

HTML cố ý nạp ./styles.css, ./teacher.css và đúng một module ./teacher.js theo hợp đồng. Hai phụ thuộc styles.css/teacher.js và phông có sẵn ở frontend/hoc, không chép thành tệp thứ tư trong thư mục thiết kế. Mở riêng HTML ở docs sẽ thiếu hai phụ thuộc này; không coi lỗi 404 đó là bằng chứng nghiệp vụ. Khi xem mockup có thể dùng trình xem ánh xạ các tài nguyên vào frontend/hoc; không chạy module nghiệp vụ trong bộ đo thiết kế.

Auth mặc định hiện; editor ẩn, ba phân hệ sau có hidden. Một h1 duy nhất là workspace-title; bộ điều khiển phải cập nhật tên, focus và trạng thái khi chuyển phân hệ/Hồ sơ. Không tự tạo phiên đăng nhập, không giả quyền giáo viên.

## 2. Thiết kế và phân nhóm
- Desktop: sidebar 224px (184px ở 761–1050), nội dung <=1100px; không giãn bốn mục theo toàn chiều cao.
- Mobile <=760: thanh dưới bốn mục, mỗi mục tối thiểu 56px, nhãn một dòng ở cỡ thường, tối đa hai dòng khi chữ lớn theo lựa chọn người dùng. Khung mobile có một vùng cuộn nội dung và hàng nav tự tính chiều cao, có vùng an toàn; không chồng nav lên nội dung. Bộ lọc lớp/môn chung hàng khi đủ chỗ; selector published cũ đặt trong ngăn “Mở từ danh mục đã xuất bản” để tránh dồn quá nhiều ô lên đầu trang.
- Soạn bài: danh sách → thông tin/lý thuyết/luyện tập; Bài đã nộp nằm trong chi tiết. Theory có hai cột trên desktop, tab Soạn/Xem trước trên mobile.
- Kiểm tra: danh sách, sửa, theo dõi, thống kê/xếp hạng là các màn riêng; SVG phân bố điểm có bảng số liệu thay thế.
- Tài liệu: chỉ liên kết Google Drive; không có file upload trong material-form. Hai mã bắt buộc hiện có nằm trong ngăn Thông tin định danh.
- Học sinh: danh sách thẻ trên mobile, chọn hàng loạt và nhập Excel ba bước. Hồ sơ: đổi PIN, gia sư AI, khóa API, về Góc học tập, đăng xuất.
- Dữ liệu mẫu có [THỬ], không PIN/khóa API thật. Các ô câu hỏi/đáp án trống, không đưa khóa học liệu vào repo.

## 3. Hợp đồng đã đối chiếu
Kiểm bằng HTMLParser với prompt và frontend/hoc/teacher.html: đủ **59 ID**, **19 name bắt buộc**, không ID trùng; giữ nguyên required/pattern/maxlength/minlength/type/min/max của **26 trường có name** hiện có. msg-input (không name) giữ type=text, autocomplete=off. Có tổng cộng 247 ID kể cả thư viện template; một h1; bảng có caption, label/ARIA tham chiếu hợp lệ.

ID bắt buộc:
`auth-section`, `teacher-login`, `teacher-pin`, `teacher-login-error`, `teacher-must-change-section`, `teacher-must-change-form`, `teacher-must-change-error`, `editor`, `workspace`, `workspace-title`, `published`, `load-lesson`, `new-lesson`, `publish-form`, `preview-button`, `preview`, `add-question`, `question-editors`, `refresh-results`, `teacher-results`, `material-form`, `students-section`, `add-student-form`, `refresh-students`, `students-class-filter`, `students-table`, `students-tbody`, `student-pin-banner`, `open-settings`, `close-settings`, `settings`, `settings-layout`, `settings-title`, `teacher-logout`, `teacher-regular-change-pin-form`, `teacher-change-pin-status`, `ai-settings-form`, `ai-default-limit`, `ai-exam-mode`, `ai-usage-tbody`, `download-ai-csv`, `refresh-ai-stats`, `add-key-form`, `keys-tbody`, `refresh-keys`, `pool-banner`, `msg-dialog`, `msg-title`, `msg-body`, `msg-form`, `msg-fields`, `msg-field`, `msg-field-label`, `msg-input`, `msg-error`, `msg-ok`, `msg-cancel`, `status`, `main`.

Name bắt buộc:
`pin`, `old_pin`, `new_pin`, `confirm_pin`, `subject_id`, `subject_name`, `grade`, `lesson_id`, `title`, `content_markdown`, `material_id`, `material_course_id`, `material_title`, `material_drive_url`, `material_desc`, `name`, `grade`, `class_code`, `pin`.

Trường phụ được giữ: default_limit, exam_mode, gemini_api_key, gemini_key_note. Autocomplete PIN hiện tại/new được giữ; PIN học sinh thêm inputmode=numeric. Không ghi giá trị PIN vào HTML.

**Đủ ID không có nghĩa teacher.js cũ chạy nguyên khối được với điều hướng mới.** Khi ghép cần controller giao diện; các tính năng mới ở dưới chưa có backend trong bản giao.

## 4. Móc điều khiển cần nối khi ghép
- nav-lessons/exams/materials/accounts có data-view, aria-controls; chỉ hiện một view và cập nhật aria-current, workspace-title, focus. Màn mới dùng list-…/detail-…; nút dùng data-action/data-id, không lấy class làm móc JS.
- open-settings dùng popovertarget=nav-profile, chỉ mở popover Hồ sơ. Không giữ handler cũ “bấm open-settings là mở ngay toàn bộ settings”. Chọn từng mục Hồ sơ mới mở settings và data-profile-panel thích hợp; đóng popover trước khi mở màn/dialog.
- Tab soạn bài phải hỗ trợ ArrowLeft/ArrowRight/Home/End, roving tabindex, aria-selected, hidden và focus. HTML đã khai báo quan hệ, chưa có xử lý phím. Mở đúng tab/ngăn có trường lỗi trước reportValidity/focus; không submit âm thầm lỗi ở trường ẩn.
- Giữ form publish-form và kiểu sinh câu hỏi hiện có. Các input name=explanation, mã học sinh code, student_note, chọn nhiều lớp và fields exam_* là phần trình bày mới; cần xác nhận hợp đồng dữ liệu khi nối. Hiện teacher.js chưa đọc/lưu hết các trường này; không được để người dùng tưởng đã lưu khi chúng bị bỏ qua.
- Renderer students hiện tại dùng 6 cột, bản mới dùng 7 cột (thêm chọn, ghi chú; gộp khối/lớp). Phải cập nhật renderer và colspan cùng lúc; giữ students-tbody. Mỗi td mới cần data-label cho nhãn thẻ mobile.
- Form tài liệu giữ material_id/material_course_id required; kỹ sư có thể điền từ lựa chọn lớp/danh mục nhưng phải thống nhất API. Không bỏ required để né lỗi; nếu chưa điền tự động phải mở ngăn và chỉ rõ ô cần nhập.
- Excel chỉ chọn tệp trong trình duyệt, xem trước/sửa dòng lỗi rồi xác nhận; không gửi tệp gốc lên Worker và không thêm CDN. Tải mẫu/Xuất Excel chưa có bộ tạo tệp trong bản tĩnh.
- Khi rời bản nháp phải xác nhận, giữ dữ liệu nếu Hủy. Lưu/Xuất bản và thao tác nguy hiểm cần withBusy, lỗi từng trường, thông báo chuẩn.
- Xóa/khóa/mở/đặt lại PIN/nhập hàng loạt: chụp đúng đối tượng/phạm vi, mở msg-dialog; Hủy mặc định, Esc=Hủy, trước đồng ý không request. Chặn bấm lặp, giữ focus modal và trả focus về phần tử còn tồn tại. Không chép nhãn “không thể hoàn tác” nếu ngữ nghĩa xóa thật khác mẫu.
- Không lấy “Hiện đáp án” trong UI giáo viên làm quyền lộ đáp án của AI gia sư; quy tắc AI không đưa đáp án và chấm phía máy chủ vẫn giữ nguyên.

## 5. Mẫu HTML JS sinh động và CSS hỗ trợ
Mẫu nhãn bọc input vẫn được CSS hỗ trợ. Với renderer mới nên dùng for/id duy nhất; dùng khóa dữ liệu thực, không dùng ID mẫu dưới đây khi lặp.

```html
<tr data-sid="student-id">
  <td data-label="Chọn"><label class="t-check"><input type="checkbox" data-action="select-student" data-id="student-id"><span class="visually-hidden">Chọn học sinh</span></label></td>
  <td data-label="Mã học sinh">HS-MAU</td><td data-label="Họ và tên">Học sinh Thử 01 [THỬ]</td>
  <td data-label="Lớp">9A</td><td data-label="Ghi chú">Chưa có ghi chú</td><td data-label="Trạng thái">Hoạt động</td>
  <td data-label="Thao tác"><details class="row-actions"><summary>Thao tác</summary><div class="action-list"><button type="button" data-action="lock-student" data-id="student-id">Khóa</button></div></details></td>
</tr>
```

```html
<fieldset class="question-edit">
  <legend>Câu hỏi</legend>
  <label>Mã câu hỏi<input name="question-id" required pattern="[a-z0-9][a-z0-9_-]{0,63}"></label>
  <label>Đề bài<input name="prompt" required></label>
  <label>Loại câu hỏi<select name="kind"><option value="choice">Trắc nghiệm</option><option value="text">Tự luận</option></select></label>
  <div class="teacher-grid">
    <label>A<input name="option-A" data-option-key="A" maxlength="2000"></label>
    <label>B<input name="option-B" data-option-key="B" maxlength="2000"></label>
    <label>C<input name="option-C" data-option-key="C" maxlength="2000"></label>
    <label>D<input name="option-D" data-option-key="D" maxlength="2000"></label>
    <label>Đáp án đúng<select name="correct_answer"><option value="">Chọn</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
  </div>
  <label>Gợi ý<textarea name="hint" maxlength="1000"></textarea></label>
</fieldset>
<article class="progress-card"><h3>Học sinh Thử 01 [THỬ]</h3><p>Chưa có bài nộp.</p></article>
<div class="teacher-grid"><label>Tiêu đề<input name="example_title"></label></div>
<div class="has-detail"><section class="t-detail"><h2>Chi tiết</h2></section></div>
```

`.has-detail` là trạng thái container do controller gắn; dùng hidden trên list/detail theo breakpoint, không tự hiện cả hai màn nếu thiếu handler. Lớp đã khai báo CSS không phải móc điều khiển.

```html
<div class="t-field"><label for="example-title">Tiêu đề</label><input id="example-title" aria-invalid="true" aria-describedby="example-error"><p id="example-error" class="field-error" role="alert">Nhập tiêu đề.</p></div>
<p class="notice" role="status">Đang xử lý.</p>
<p class="status" role="status" aria-live="polite">Trạng thái công việc.</p>
<p class="notice error" role="alert">Chưa thực hiện được.</p>
<p class="notice success" role="status" aria-live="polite">Đã lưu.</p>
<span class="visually-hidden">Thông tin dành cho trình đọc màn hình</span>
```

## 6. Thư viện trạng thái
Trong teacher.html: state-{lessons|exams|materials|accounts}-{loading|empty|partial|field|saving|saved|dirty|offline}, tổng 32 template. Tải có skeleton/chữ/aria-busy; lỗi một phần giữ các dòng đã tải; offline không giả thành đã lưu máy chủ. Template không tự chèn vào luồng mặc định.

Các template state-confirm-delete, state-confirm-lock, state-confirm-dirty, state-notice là nội dung cho dialog dùng chung: lấy h2/p để điền msg-title/msg-body; không thay toàn bộ msg-form và làm mất các ID con. Tên nút msg-ok phải là hành động cụ thể (Xóa học sinh, Khóa tài khoản...), không để “Xác nhận” chung chung khi thực hiện thật. msg-cancel phải gọi nhánh hủy; type=button không tự đóng dialog trong HTML tĩnh. Thông báo nhanh dùng status; lỗi dùng alert; thông báo cần hành động dùng msg-dialog.

## 7. Kết quả đo bố cục và chữ
Bộ đo tạm nằm ngoài thư mục ba tệp bàn giao; dùng Chrome headless, ánh xạ CSS/font từ frontend/hoc, chặn teacher.js bằng module rỗng để không chạy nghiệp vụ. Chỉ tháo hidden/chuyển lớp để xem trạng thái, không giả lập API. Đây là kiểm tra thiết kế, không phải kiểm thử ứng dụng đã ghép.

| Rộng | Bố cục 100% | Phóng riêng chữ 200% |
|---:|---|---|
| 320 | 18 trạng thái PASS, không tràn ngang, nav một dòng | 10 ca PASS, nav tối đa 2 dòng |
| 390 | 18 trạng thái PASS, không tràn ngang, nav một dòng | 10 ca PASS, nav tối đa 2 dòng |
| 768 | 18 trạng thái PASS | Các ca chữ lớn đã thử PASS |
| 1024 | 18 trạng thái PASS | Chưa chạy riêng ở 200% |
| 1280 | 18 trạng thái PASS | Các ca chữ lớn đã thử PASS |
| 1920 | 18 trạng thái PASS | Chưa chạy riêng ở 200% |

Tổng 108 bố cục thường; 40 ca chữ tăng 200% ở 10 trạng thái × 320/390/768/1280: 40 PASS sau khi áp dụng quyết định cho phép nhãn nav tối đa hai dòng khi chữ lớn. Đã kiểm cả vùng cuộn nội dung, không chỉ chiều rộng trang. Ba chuỗi thử bắt buộc đã được đưa vào bộ đo:
- Nguyễn Thị Phương Thảo Quỳnh
- Ôn tập Chương 2: Tổ chức lưu trữ, tìm kiếm và trao đổi thông tin
- Kiểm tra giữa kỳ I — Tin học 9

Mẫu dấu: **ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự**. Chrome nạp cả 2 face SGK Serif; không khai báo lại @font-face trong teacher.css. tests/test_fonts_vietnamese.cjs đã chạy xanh bằng Chrome cài sẵn + ánh xạ route tới đúng tệp cục bộ (không sửa test). Lần chạy mạng localhost trực tiếp bị ERR_NETWORK_ACCESS_DENIED; bản ánh xạ kiểm chính CSS/font/SW/package hiện có, không chứng minh máy chủ HTTP hoạt động.

Kiểm DOM: một h1, không ID trùng, mọi ô có label, ARIA không tham chiếu ID mất, mọi bảng có caption. Điều khiển >=48px; checkbox có label 48px bao vùng chạm (ô hình vuông 24px). Focus-visible 3px; popover Hồ sơ native mở/đóng bằng nút/Esc đã thử. **Chưa có handler mũi tên tab, Hiện/Ẩn, chuyển phân hệ, lưu/nhập/xuất, dirty guard hoặc xác nhận nghiệp vụ trong ba tệp tĩnh**; phải kiểm sau ghép.

## 8. Quyết định chữ lớn đã được người dùng chốt
Ngày 25/10/2026, người dùng chọn **cho phép nhãn thanh dưới tối đa 2 dòng khi chữ lớn**. Đã bổ sung quyết định ngay đầu khối prompt v3; điều này thay điều kiện một dòng tuyệt đối trước đó. Cỡ thường vẫn một dòng, không giảm cỡ chữ để né kiểm tra.

CSS mobile dùng khung viewport với một vùng cuộn và hàng nav có chiều cao nội tại; không cần JS đo chiều cao. Kiểm 6 tổ hợp 320/390/760 × 100%/200%: 100% cả bốn nhãn một dòng; 200% tối đa hai dòng; nav, nội dung và thanh lưu không chồng nhau. Ở 320px, nav tăng từ 73px lên 123px, phần nội dung tự co lại. Focus ô Tiêu đề ở 320/390/1280 đều nằm phía trên thanh lưu.

Kiểm Tab native 9 trạng thái (139 điểm dừng theo biểu mẫu), focus nhìn thấy; các phân đoạn nhập ngày/giờ được tính là cùng một điều khiển. Không lấy các trường trong details đang đóng làm phần tử phải Tab tới. Dialog native đã thử focus mặc định Hủy và Esc đóng; các handler nút xác nhận/Hủy nghiệp vụ vẫn cần nối.

## 9. Tương phản đã tính
| Chữ/điều khiển | Nền | Tỷ lệ |
|---|---|---:|
| --ink | --paper | 12.72:1 |
| --ink | --surface | 13.88:1 |
| --ink | --sidebar | 12.01:1 |
| --muted | --paper | 5.47:1 |
| --muted | --surface | 5.97:1 |
| --muted | --sidebar | 5.17:1 |
| --white | --brand | 11.75:1 |
| --white | --brand-hover | 8.18:1 |
| --brand | --brand-soft | 9.86:1 |
| --ok | --ok-bg | 6.66:1 |
| --warn | --warn-bg | 8.26:1 |
| --danger | --danger-bg | 7.34:1 |
| --control | --surface | 3.9:1 |
| --brand | --surface | 11.64:1 |

Viền --line chỉ phân cách trang trí; ô nhập dùng --control (3,90:1), không dùng đường viền nhạt đó làm ranh giới điều khiển. Cặp chữ đều >=4,5:1; viền điều khiển >=3:1.

## 10. Việc tiếp theo / giới hạn
Claude ghép theo phạm vi người dùng giao, giữ cơ chế cách ly vai trò, dialog/validate/withBusy hiện có; triển khai controller nêu trên và chạy test hành vi mọi thao tác, test_role_isolation.cjs, test_fonts_vietnamese.cjs cùng suite hiện hành. Kiểm phông/tiếng Việt, nháp, cập nhật PWA và backend/đáp án tách riêng trước phát hành. Tuân thủ gate và phân công AGENTS.md nếu có mâu thuẫn quyền sửa/commit giữa các tài liệu; phiên này không ghép/push.

Chưa kiểm thiết bị iOS/Android thật, bàn phím ảo, Safari/Firefox/Edge, screen reader, Lighthouse hoặc WCAG toàn diện. Các skill pipeline UI/Stitch/Sonnet không có trong catalog phiên này, chưa chạy; không thay phán quyết Claude. Hình minh họa và báo cáo đo lưu trong thư mục QA của phiên, không chép vào sản phẩm.

## 11. Bằng chứng của phiên
- [Bố cục, chữ, DOM và phông](<C:/Users/HPZBook/.codex/visualizations/2026/10/24/01a16e37-4ae3-7903-b002-a40902136e74/teacher-ui-v3/report.json>)
- [Thứ tự Tab và focus](<C:/Users/HPZBook/.codex/visualizations/2026/10/24/01a16e37-4ae3-7903-b002-a40902136e74/teacher-ui-v3/keyboard.json>)
- [Nav chữ lớn và khoảng trống nội dung](<C:/Users/HPZBook/.codex/visualizations/2026/10/24/01a16e37-4ae3-7903-b002-a40902136e74/teacher-ui-v3/nav.json>)
- [Ảnh 320px với chữ 200%](<C:/Users/HPZBook/.codex/visualizations/2026/10/24/01a16e37-4ae3-7903-b002-a40902136e74/teacher-ui-v3/nav-200-320.png>)

Bộ đo/screenshot nằm ngoài ba tệp bàn giao; không triển khai các tài nguyên QA này.
