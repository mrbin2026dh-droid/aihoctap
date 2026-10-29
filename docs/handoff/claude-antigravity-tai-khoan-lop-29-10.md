# Claude → Antigravity: lớp thiếu ở Thảo luận/Luyện tập, trang Tài khoản 18.000 học sinh, chữ gạch chân (29/10 tối, đợt 4)

> Báo cáo `antigravity-claude-gia-su-nguyen-tac-xong.md` mà Antigravity nhắc **chưa có trên GitHub** (chưa push). Lần này: báo cáo và ảnh phải được commit + push, nếu không thì coi như chưa làm.

## 1. Phân tích và đã sửa (Claude, đã đẩy)
| Thầy báo | Nguyên nhân thật | Đã sửa |
|---|---|---|
| H1. Thảo luận/Luyện tập chỉ có 4 lớp, trong khi Tài khoản có 12+ lớp | Trang Tài khoản đọc **Google Sheet**. Thảo luận, Luyện tập, Tổng quan và đăng nhập học sinh đọc **Firebase `thi_hs`**. Sheet chỉ đẩy lên Firebase khi sửa **qua app**; dán thẳng vào trang HocSinh thì không đẩy. Vì vậy các lớp mới chưa có trên Firebase, **các em đó chưa đăng nhập nhanh được**. | (a) Trang Tài khoản so mã trong Sheet với Firebase (chỉ đọc danh sách khóa `?shallow=true`, khoảng 0,3 MB cho 18.000 em). Thiếu thì hiện cảnh báo đỏ ghi số em và các lớp, kèm nút **"Đẩy lên Firebase ngay"** (gọi `gv_publish`). (b) Apps Script: menu **Bài thi → Tự đẩy học sinh lên Firebase khi sửa Sheet** (`batTuDongDay`): cài trigger onEdit/onChange; sửa hoặc dán vào HocSinh/GiaoVien thì sau 1 phút tự đẩy (gộp nhiều lần sửa). (c) Mỗi lần đẩy, Apps Script ghi thêm chỉ mục lớp `thi_lop` ({lớp, khối, sĩ số}). Thảo luận/Luyện tập đọc chỉ mục này thay vì tải cả `thi_hs`; chưa có `thi_lop` thì đọc `thi_hs` như cũ. |
| H2/H3. Trang Tài khoản chậm (334 em; trường có 18.000 em) | Mỗi lần mở menu đều chờ Apps Script trả **toàn bộ** danh sách (Apps Script mất 3–6 giây, 18.000 em khoảng 1,5 MB). Ô Lớp là danh sách phẳng hàng trăm lớp. | (a) **Lưu danh sách trên máy** (IndexedDB, khóa `acc-cache-v1`, chỉ có mã, tên, lớp, trạng thái, **không có mã PIN**): mở menu là hiện ngay, cập nhật từ Sheet ở nền ("Đang cập nhật…"). Mất mạng vẫn xem được, có ghi giờ lưu. Xóa khi giáo viên đăng xuất hoặc khi học sinh đăng nhập trên máy đó (một máy một vai trò). (b) Ô Lớp nhóm theo khối, có sĩ số. (c) Sắp xếp bằng `Intl.Collator`. **Đo trên Chromium với 18.000 em giả lập:** lần đầu 330 ms; tìm kiếm 304 ms (gồm 0,2 giây chờ gõ); đổi lớp 32 ms; mở lại khi Sheet chậm 5 giây vẫn hiện sau 191 ms. |
| H4. Chữ có gạch chân xanh nhạt ở nhiều chỗ | (1) Tên bài trong bảng "Học sinh đọc bài" là nút được Claude kẻ gạch chân ở đợt 29/10 (sai thiết kế). (2) Cột "Chuyên cần" dùng `<abbr title>` nên trình duyệt kẻ gạch chấm. | Nút tên bài: bỏ gạch chân, thêm dấu "›" và đổi màu khi rê chuột. Bỏ `<abbr>`, giải thích Chuyên cần ở dòng chú thích dưới bảng. Thêm kiểm tra **"gạch chân"** vào `test_teacher_ui_standard`: mọi màn giáo viên, sáng/tối, 360–1280 px. Bản cũ báo 8 lỗi, bản mới 0. |

**Kiểm thử Claude đã chạy (PASS):** `test_accounts_live` 56 ca (cảnh báo thiếu Firebase + nút đẩy, ô Lớp theo khối, không gạch chân, mở lại hiện ngay từ bản lưu khi Sheet chậm 4 giây), `test_tl_live` 53 (lớp từ `thi_lop`), `test_teacher_thi_ui` 140, `test_teacher_ui_standard` 0 vi phạm, `test_teacher_shell`, `test_teacher_overview`, `test_quiz_live` 53, `test_role_isolation`, `test_pwa_update_integrity`, `test_auto_update_login` 15, `test_loading_states` 11, `test_lesson_ai_docs_ui` 53, `test_firebase_rules_step0` 12.

## 2. Antigravity làm (theo thứ tự)
1. `git pull`; chạy các test trên, dán dòng kết quả cuối của từng test.
2. **Đăng luật Firebase** từ `spike/step0/database.rules.ai-sgk-final.json` (thêm `thi_lop`: đọc công khai, không ai ghi từ trình duyệt). Kiểm tra: `GET /thi_lop.json` trả 200; `PUT /thi_lop/x.json` không có khóa trả 401.
3. **Cập nhật Apps Script:** dán `apps-script/sheet-exam/Code.gs` vào dự án Apps Script của Sheet → Deploy → **Manage deployments → Edit → New version** (giữ nguyên URL). Hướng dẫn thầy mở Sheet → menu **Bài thi → Tự đẩy học sinh lên Firebase khi sửa Sheet** (lần đầu Google hỏi quyền, thầy tự bấm cho phép). Không nhập mật khẩu hay khóa thay thầy.
4. Thử thật, **chụp ảnh từng bước**:
   - Tài khoản → Học sinh: ảnh cảnh báo đỏ (nếu còn em chưa lên Firebase) → bấm "Đẩy lên Firebase ngay" → ảnh sau khi cảnh báo biến mất.
   - Tiện ích → Thảo luận → Tạo bộ: ảnh ô "Lớp thảo luận" có đủ các lớp như ô Lớp ở Tài khoản.
   - Dán 1 học sinh "[THỬ]" vào cuối trang HocSinh → chờ 1–2 phút → `GET /thi_hs/<mã>.json` có dữ liệu → xóa dòng thử.
   - Đo: mở Tài khoản lần 1 và lần 2 (đóng tab rồi mở lại), ghi số giây đến khi bảng hiện; ảnh dòng "Đang cập nhật…".
   - Ảnh bảng "Học sinh đọc bài" và cột "Chuyên cần": không còn gạch chân.
5. Ghi `docs/handoff/antigravity-claude-tai-khoan-lop-xong.md`, ảnh ở `docs/handoff/anh/tai-khoan-29-10/` (che tên thật). **Commit + push.**

## 3. Rủi ro bảo mật đã có từ trước (chưa sửa, cần thầy quyết)
Luật hiện tại cho **ai cũng đọc được `thi_hs`**, trong đó có tên học sinh và `h = sha256(mã:PIN)`. PIN 6 chữ số nên chỉ cần thử 1 triệu khả năng là dò ra PIN của mọi em. Với 18.000 học sinh là dữ liệu cá nhân trẻ em, đây là việc mức CAO theo AGENTS.md mục H. Hướng sửa (cần kế hoạch riêng): đăng nhập qua Worker, hoặc tách `h` sang nhánh không ai đọc được và dùng mã PIN dài/chậm (PBKDF2). Claude sẽ lập kế hoạch khi thầy đồng ý.

## 4. Mã liên quan
- `frontend/hoc/teacher-accounts.js`: `ACC_CACHE`, `saveCache`, `load` (hiện bản lưu, cập nhật ở nền), `missingOnFirebase`, `checkSync`, nút `#acc-sync-btn`, ô Lớp `optgroup`.
- `frontend/hoc/thi-store.js`: `keys(path)` (shallow).
- `frontend/hoc/teacher-quiz.js`, `teacher-tl.js`: `classes()` đọc `thi_lop` trước.
- `frontend/hoc/app.js`: học sinh đăng nhập thì xóa `acc-cache-v1`.
- `apps-script/sheet-exam/Code.gs`: `publish_` ghi `thi_lop`; `batTuDongDay`, `tuDongDay_`, `tuDongDayChay_`.
- `frontend/hoc/teacher.css`: `.read-sum-open` (không gạch chân), `abbr[title]`; `teacher.html`: `#acc-sync`, `.acc-legend`.
