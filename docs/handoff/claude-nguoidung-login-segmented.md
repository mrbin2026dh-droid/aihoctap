# Phán quyết: thanh chọn vai trò Học sinh | Giáo viên ở màn đăng nhập
Từ: Claude → Sang: Người dùng (rồi Antigravity khi được giao)   Ngày: 26/10/2026
Trả lời: docs/handoff/chatgpt-claude-login-segmented.md. Đã đọc README + ảnh role-selector-v1.png, index.html (#gate, #login-dialog), teacher.html (#auth-section), AGENTS.md mục N.

## Kết luận: DUYỆT hình thức, ĐỔI cách làm hành vi (link, không phải tab)
Hình thức ChatGPT đề xuất tốt: một thẻ, logo một lần, hai nhãn luôn hiện, nút ≥48px, bỏ "Góc học sinh" cuối form, bỏ modal chồng cổng. Giải quyết đúng các lỗi đo được (2 lớp cuộn ở 360×360, 44px).

Nhưng KHÔNG dùng role="tablist/tab/tabpanel" cùng một trang. Lý do thực tế: học sinh ở index.html (app.js), giáo viên ở teacher.html (teacher.js) là HAI tài liệu, phiên và gói mã riêng. Gộp một trang nghĩa là học sinh tải mã giáo viên, phá cách ly vai trò (AGENTS mục N) và phải sửa sw.js/test.
=> Thanh là `<nav>` có hai `<a>`; đoạn đang chọn có `aria-current="page"`, đoạn kia dẫn sang trang kia. Cùng một thành phần giao diện, dán vào cả hai trang.

## Trả lời các điểm ChatGPT nhờ chốt
1. PIN/lỗi khi đổi vai trò: điều hướng sang trang khác nên tự xóa. Chỉ cần xử lý nút Back (bfcache): `pageshow` có `event.persisted` thì xóa ô PIN và `*-error`.
2. Chỉ validate form đang hiện: tự đúng vì mỗi trang một form. Không gọi API khi bấm đoạn.
3. Bàn phím: hai liên kết là Tab-stop bình thường (Tab/Shift+Tab, Enter). KHÔNG cần phím mũi tên (đó là của tabs APG). Không tự focus ô nhập khi mở trang (tránh bật bàn phím điện thoại); focus đầu trang vào h1 `tabindex="-1"` như `#gate-title` hiện có.
4. Reduced-motion: không có trượt giữa trang nên không cần; nền chọn tĩnh. Chỉ giữ hover/focus, bọc transition trong `@media (prefers-reduced-motion:no-preference)`.
5. Cách ly vai trò: thanh chỉ hiện khi CHƯA đăng nhập và KHÔNG hiện ở màn "đổi PIN lần đầu" (#teacher-must-change-section), màn tài khoản, hay khi đã có phiên. Trang giáo viên khi máy có phiên học sinh vẫn đòi đăng nhập như cũ. Học sinh đã đăng nhập không thấy đường sang giáo viên (xóa luôn nút `.teacher-link` ở header khi có phiên — kiểm hiện trạng).
6. Hệ quả cần người dùng biết: đổi đoạn là tải trang (cache SW, gần như tức thời) nhưng không có hiệu ứng trượt như ảnh. Muốn trượt thật thì phải gộp một trang — Claude khuyên không.

## Làm theo 2 bước (tránh sửa lớn một lần)
- Bước A (nhỏ, an toàn): thành phần `.role-switch` + trang giáo viên; thay "Góc học sinh" bằng thanh; nâng "Hiện PIN"/điều khiển phụ 44→48px; input 16px, nút chính 56px.
- Bước B (lớn hơn): cổng học sinh hiển thị thẳng thẻ đăng nhập thay `#gate` + `<dialog>`; giữ NGUYÊN id/name/autocomplete và luồng app.js. Chỉ làm sau khi A đã qua test. Nếu dialog đang dùng cho focus-trap thì giữ cơ chế modal cho trường hợp mở từ nút "Đăng nhập" ở header.

## Mã mẫu (Bước A)
```html
<nav class="role-switch" aria-label="Chọn vai trò đăng nhập">
  <a href="./" aria-current="page">Học sinh</a>
  <a href="./teacher.html">Giáo viên</a>
</nav>
```
```css
.role-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:999px;background:var(--surface-2,#eef2f5)}
.role-switch a{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;font-weight:600;text-decoration:none;color:var(--text-muted)}
.role-switch a[aria-current="page"]{background:var(--brand,#0f6f6a);color:#fff}
.role-switch a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.role-switch a{transition:background-color .16s}}
```
Ở trang giáo viên đảo `aria-current` sang "Giáo viên". Màu lấy từ biến sẵn có của từng trang, KHÔNG đổi thương hiệu; bắt buộc có cả bản tối (tools/gen_dark_theme.py cho học sinh, khối TEACHER-DARK cho giáo viên).

## Tiêu chí xong (test hành vi, không chỉ chụp ảnh)
- 4 viewport 320×568, 360×640, 390×844, 1280×800; sáng + tối: không tràn ngang; ở 360×360 chỉ MỘT vùng cuộn.
- Hai đoạn cao ≥48px; chữ đoạn đang chọn ≥4.5:1; đoạn không chọn ≥4.5:1; vòng focus ≥3:1 (dùng probe-focus.js).
- Nhập PIN rồi bấm sang đoạn kia rồi Back: ô PIN và lỗi trống.
- Bấm "Giáo viên" từ trang có phiên học sinh: vẫn hiện form đăng nhập; test_role_isolation.cjs xanh.
- Thanh ẩn ở màn đổi PIN lần đầu và sau khi đăng nhập.
- Câu kiểm dấu: ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự hiển thị đúng ở nhãn và nút.
- Không đổi API/xác thực; không đổi tên id/name/autocomplete; không có JS test trong sản phẩm.

## Giữ nguyên các nhận xét độc lập
Sửa 44→48px, rút câu hướng dẫn "Mã học sinh và mã PIN do giáo viên cấp.", bỏ minh họa sách cạnh nút Giáo viên: đúng và làm được dù chọn hướng nào. Chưa thử bàn phím ảo/Safari thật.

## Chuyển cho: Người dùng
Chốt "link-tab, làm Bước A trước" thì giao Antigravity: "Đọc AGENTS.md và docs/handoff/claude-nguoidung-login-segmented.md rồi làm Bước A."
