# DOSSIER KIỂM TRA & DEBUG DÀNH CHO VS CODE / CLAUDE AUDITOR
> **Dự án**: AI SGK Tin Học THCS (AI AGENT SGK)  
> **Phiên bản đồng bộ**: Commit `75be8d6` trên nhánh `gh-pages`  
> **Ngày hoàn thành**: 21/10/2026  
> **Mục tiêu**: Hướng dẫn chi tiết từng bước (Step-by-step Debug Prompt) cho VS Code và Tester kiểm chứng độc lập toàn bộ 5 hạng mục H1, H2, H3, H4, H5.

---

## 1. TỔNG HỢP CÁC HẠNG MỤC ĐÃ KHẮC PHỤC (H1 - H5)

| Mã | Yêu Cầu | Vị Trí Code | Giải Pháp Kỹ Thuật Đã Triển Khai | Kết Quả Playwright |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | Khóa chuyển câu hỏi khi học sinh chưa trả lời | `frontend/app.js`<br>lines 8800-8880 | • Vô hiệu hóa nút `Câu tiếp theo` (`disabled = true`) khi câu hiện tại chưa có đáp án.<br>• Khi bấm vào nút câu hỏi tiếp theo trên Palette câu hỏi, hệ thống chặn lại và hiển thị Toast cảnh báo: *"Em vui lòng chọn đáp án cho câu hỏi hiện tại trước khi chuyển sang câu tiếp theo nhé!"*<br>• Khi chọn đáp án, nút được mở khóa tức thì. Cho phép quay lại câu trước xem và sửa bình thường. | `PASS` (100%) |
| **H2** | Responsive màn hình thi trên Mobile không tràn, không gãy dòng | `frontend/style.css`<br>lines 8750-8770 | • CSS `white-space: nowrap !important;` cho `#takingQCurrentIndex` (*Câu 1 / 10*).<br>• Tối ưu flex-wrap và thu nhỏ padding trên mobile (390x844).<br>• Đạt chuẩn `scrollWidth === clientWidth` (0 horizontal overflow). | `PASS` (100%) |
| **H3** | Popup Socrates AI trên Mobile hiển thị chuẩn, không tràn | `frontend/style.css`<br>lines 8772-8792 | • Cấu hình drawer toàn màn hình trên mobile: `width: 100vw; height: 100dvh; max-width: 100vw;`<br>• Trạng thái đóng: `left: auto; right: -100vw;`. Trạng thái mở: `left: 0; right: 0;`<br>• Nút đóng `✕` hoạt động mượt mà, không giật lag. | `PASS` (100%) |
| **H4** | Modal Đăng nhập trên Mobile không tràn ngang | `frontend/style.css`<br>lines 8720-8750 | • Đặt `max-width: calc(100vw - 32px); margin: 0 auto; box-sizing: border-box;`<br>• Triệt tiêu triệt để bẫy tràn ngang trên điện thoại 390x844 và 375x667. | `PASS` (100%) |
| **H5** | Xóa sạch mã PIN hardcode & Modal Đổi mã PIN bảo mật cho Giáo viên | `frontend/index.html`<br>`frontend/app.js` | • Xóa hoàn toàn khối hiển thị mã PIN mẫu `.sl-quick-pin-row` và `#slBtnUseSamplePin`.<br>• Xây dựng Modal Đổi mã PIN Giáo viên: kiểm tra PIN hiện tại, xác thực PIN mới $\ge 6$ ký tự, khớp xác nhận.<br>• Timeout 1.2s bọc `Promise.race` chống treo khi kết nối Firebase RTDB chậm.<br>• Đồng bộ 2 chiều lên Firebase `system/teacher_pin` và LocalStorage. | `PASS` (100%) |

---

## 2. HƯỚNG DẪN KHỞI CHẠY & DEBUG TRONG VS CODE

### Bước 1: Khởi động máy chủ kiểm thử nội bộ
Mở Terminal trong VS Code và gõ:
```bash
python -m uvicorn backend.server:app --port 8000
```
*(Hoặc click đúp file `Chay_Ung_Dung_Web.bat` ngoài thư mục gốc).*

### Bước 2: Chạy bộ kiểm thử tự động Playwright Zero-Bug (H1 đến H5)
Mở một tab Terminal khác trong VS Code và chạy:
```bash
python -m pytest tests/test_h1_to_h5_fixes.py -v -s
```
**Kỳ vọng đầu ra**:
```text
tests/test_h1_to_h5_fixes.py::test_h1_forward_lock_and_h2_to_h5_features
[TEST H4 & H5] Kiểm tra Màn hình Đăng nhập Mobile & Mã PIN Giáo viên...
  ✔ [H4 PASS] Modal Đăng nhập hiển thị vừa vặn, không tràn ngang trên mobile (390x844).
  ✔ [H5 PASS] Phần hiển thị mã PIN mặc định đã được xóa sạch 100% khỏi giao diện.
  ✔ [H5 PASS] Đăng nhập Giáo viên thành công: Giáo viên Tin học

[TEST H5] Kiểm tra tính năng Đổi mã PIN Giáo viên bảo mật...
  ✔ [H5 PASS] Chặn đổi PIN khi nhập sai PIN hiện tại thành công.
  ✔ [H5 PASS] Đổi mã PIN Giáo viên thành công sang mã mới an toàn.

[TEST H3] Kiểm tra Popup Socrates AI trên Mobile...
  ✔ [H3 PASS] Popup Socrates AI trên mobile hiển thị chuẩn, không tràn ngang và đóng mở mượt mà.

[TEST H1 & H2] Kiểm tra Logic Khóa Chuyển Câu & Responsive Bài Thi Mobile...
  ✔ [H2 PASS] Màn hình thi trên mobile chuẩn responsive: Không gãy dòng 'Câu 1 / 10', 0 tràn ngang.
  ✔ [H1 PASS] Nút 'Câu tiếp theo' bị vô hiệu hóa khi câu hiện tại chưa có đáp án.
  ✔ [H1 PASS] Bấm câu 2 trên Palette bị chặn đứng và Toast cảnh báo xuất hiện chuẩn xác.
  ✔ [H1 PASS] Nút 'Câu tiếp theo' được kích hoạt ngay khi học sinh chọn đáp án.
  ✔ [H1 PASS] Chuyển sang Câu 2 thành công sau khi đã hoàn thành Câu 1.
  ✔ [H1 PASS] Ở Câu 2, nút Tiếp theo tự động khóa lại cho đến khi học sinh chọn đáp án.
  ✔ [H1 PASS] Học sinh quay lại xem và sửa câu 1 thành công.
  ✔ Console F12 sạch 100% không có lỗi Uncaught Exception.

🎉 TẤT CẢ 5 HẠNG MỤC H1, H2, H3, H4, H5 ĐỀU ĐẠT CHUẨN HOÀN HẢO 100%!
PASSED
```

### Bước 3: Chạy toàn bộ các kịch bản E2E kiểm chứng hệ thống
Chạy đồng thời các bài kiểm thử bảo mật, thống kê và bảng xếp hạng:
```bash
python -m pytest tests/test_security_ai_and_student_exam_e2e.py -v -s
python -m pytest tests/test_live_exam_statistics_and_ranking.py -v -s
python -m pytest tests/test_desktop_exam_cards_and_student_profile_sync.py -v -s
python -m pytest tests/test_exam_toggle_lock_and_microcopy.py -v -s
python -m pytest tests/test_login_portal_no_x_and_rbac.py -v -s
```

### Bước 4: Kiểm tra Cú pháp & Toàn vẹn DOM
```bash
node -c frontend/app.js
node tests/ast_check.js
```

---

## 3. THÔNG TIN ĐỒNG BỘ GITHUB

- **Nhánh triển khai chính thức**: `gh-pages`
- **Mã Commit**: `75be8d6`
- **Thông điệp Commit**: `feat(exam): khoa chuyen cau hoi khi chua tra loi (H1), toi uu responsive mobile (H2-H4), bao mat ma PIN giao vien (H5)`
- **Trạng thái Push**: Đã push thành công lên `origin/gh-pages` (Bảo lưu nguyên vẹn nhánh `main` không bị đẩy đè lên remote theo đúng chỉ thị).
- **Trang Live GitHub Pages**: `https://mrbin2026dh-droid.github.io/aisgk/`
