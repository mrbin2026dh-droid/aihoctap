# 01. Khảo sát hệ thống hiện có và ứng dụng Bài 2

Người viết: Claude · 22/11/2026 (Asia/Bangkok) · Chỉ đọc mã, chưa chạy thử. Không đọc `.env`, khóa riêng hay tài khoản dịch vụ.

## 1. Hệ thống AI AGENT SGK (đích tích hợp)

| Thành phần | Thực tế quan sát | Tệp |
|---|---|---|
| Ứng dụng học sinh | PWA thuần JavaScript (ES module, `// @ts-check`), không framework, không bundler; IndexedDB qua `db.js`; service worker có dấu đóng gói | `frontend/hoc/index.html`, `app.js`, `dom.js`, `api.js`, `db.js`, `sw.js` |
| Trang giáo viên | Cùng thư mục, thanh điều hướng 8 mục (Tổng quan, Soạn bài, Về nhà, Thi, Tài liệu, Tài khoản, Hiệu quả, Tiện ích) | `frontend/hoc/teacher.html`, `teacher.js`, `teacher-*.js` |
| Máy chủ | Một Cloudflare Worker `aihoctap-gate` (~6.100 dòng), Durable Object `GateDurableObject` cho khóa sai PIN/hạn mức; chạy vùng `aws:us-east-1` | `worker/index.js`, `wrangler.toml` |
| Cơ sở dữ liệu | Firebase Realtime Database. Worker truy cập bằng tài khoản dịch vụ qua hàm `rtdb(env, signingKeys, method, path, body)` | `worker/index.js` (hàm `rtdb`) |
| Luật RTDB | Gốc `.read/.write: false`. Nhiều nhánh mở đọc công khai (`thi_nop`, `nang_luc`, `doc_read`, `tl`, `quiz`…) và học sinh ghi trực tiếp qua REST | `spike/step0/database.rules.ai-sgk-final.json` |
| Xác thực học sinh | Mã học sinh + PIN, kiểm tra qua Google Sheet (`SHEET_LOGIN_URL`), dự phòng `thi_hs`. Worker cấp JWT có `uid`, `claims.name`, `claims.grade`, `claims.class_code` | `worker/index.js` route `/api/login` |
| Xác thực giáo viên | JWT giáo viên. Quản trị: `scope` admin; giáo viên lớp: `scope:'class'`, `classes:[...]` lấy từ Sheet. Hàm `requireTeacher()` trả `user.classes` | `worker/index.js` hàm `requireTeacher`, route `/api/teacher/auth` |
| Nội dung bài học | `catalog` + `packages` (công khai), đáp án ở `packages_private` (chỉ Worker đọc). Kiểu `Lesson` có `questions[]` và `version` là SHA-256 nội dung | `frontend/hoc/contracts.d.ts`, `api.js` hàm `verifyPackage` |
| Tiến độ, bài nộp | Bài luyện tập trắc nghiệm/tự luận ngắn chấm ở Worker (`/api/pwa/attempts`); thi qua Firebase/Apps Script; tiến độ đọc `doc_read`; bản đồ năng lực `nang_luc` | `app.js`, `exam*.js`, `read-progress.js`, `mastery.js` |
| AI | Gemini qua Worker (Gia sư Socrates, AI soạn đề), có hạn mức, chặn lộ đáp án | `worker/index.js` |
| Triển khai | Worker: `wrangler deploy`, quay lui `wrangler rollback`. Giao diện: GitHub Pages (repo công khai `aihoctap`). Có quy tắc đóng dấu `sw.js` (AGENTS.md mục L) | `tools/package_student_pwa.py` |

### Chưa có trong hệ thống (cần phát triển)
- Kiểu học liệu "phiếu học tập" nhiều phần, tự luận dài, có sản phẩm nhóm.
- Nhận xét theo yêu cầu cần đạt (YCCĐ), không quy đổi điểm.
- Lịch sử phiên bản bài làm (trước/sau góp ý).
- Phân quyền đọc bài làm cá nhân chỉ cho chủ bài và giáo viên đúng lớp. Các nhánh hiện có đều mở đọc công khai, nên **không được** dùng lại mẫu đó cho dữ liệu Bài 2.

## 2. Ứng dụng Bài 2 (`AI_Lop9_Bai2_App`, bản "Đã sửa lỗi")

| Tệp | Vai trò | Nhận xét |
|---|---|---|
| `index.html`, `style.css` | Khung trang, chọn Học sinh/Giáo viên | Dùng emoji, nút "↩", style nội tuyến |
| `app.js` (22 KB) | Sáu hoạt động, lưu nháp, nộp, đánh giá, xuất CSV/JSON | Một tệp, ghép HTML bằng chuỗi; dùng `confirm()` |
| `data.js`, `content.json` | Nội dung trích phụ lục | Văn bản khớp PL9.2.1, 9.2.4, 9.2.6, 9.2.8 (đã đối chiếu, xem 02) |
| `firebase-adapter.js`, `firebase-config.js`, `firestore.rules` | Firestore + đăng nhập ẩn danh, giáo viên Email/Password, `roles/{uid}` | Dự án Firebase **riêng**, cấu hình đang để trống |
| `DEMO_MO_TRUC_TIEP.html` | Bản demo một tệp, lưu `localStorage` | Chỉ dùng thử |

### Mức hoàn thiện: bản mẫu (demo), không đưa thẳng vào sản xuất
1. **Định danh:** học sinh đăng nhập ẩn danh, tự gõ tên/lớp, nên có thể mạo danh. Hệ thống đích đã có mã học sinh + PIN.
2. **Phân quyền:** `readAll()` đọc toàn bộ `submissions`, không lọc theo lớp; giáo viên `update` được mọi trường; luật không giới hạn độ dài.
3. **Dữ liệu cá nhân:** bài làm nằm trong `localStorage` của máy dùng chung; bản demo giáo viên không cần đăng nhập.
4. **Toàn vẹn:** học sinh vẫn sửa được bài sau khi nộp mà không lưu lịch sử. Lựa chọn "Lúc đầu em chọn…" sửa được ở cuối bài, trái phẩm chất "Trung thực" của giáo án.
5. **Bài nhóm:** chép vào hồ sơ từng học sinh, không có thực thể nhóm, không ghi đóng góp từng bạn.
6. **Xuất CSV:** không vô hiệu hóa ký tự đầu `= + - @`, nên mở trong Excel có thể bị chèn công thức.
7. **Quy tắc giao diện dự án (AGENTS.md mục I, N):** vi phạm `confirm()`, emoji, style nội tuyến, chưa có kiểm tra trường có `aria-invalid`.

**Kết luận:** chỉ tái sử dụng **nội dung** (`data.js`) và **ý tưởng luồng** của ứng dụng Bài 2. Không dùng lại xác thực, cơ sở dữ liệu, luật Firestore hay giao diện của nó.

## 3. Tài liệu gốc
- Đã đọc: `Downloads/Tài liệu cấp Trung học cơ sở/Tài liệu 12 tiết AI lớp 6-9/Lớp 9/Lop9.Bai02 - …/Lop9.Bai02 - Hoc tap, the hien ban than va dinh huong NN trong the gioi AI.docx` và `Lop9.Bai02 - Phu luc.docx` (trích văn bản offline).
- Không có trong thư mục: các phụ lục chung PLC.1–PLC.8 (rubric chung, bảng kiểm an toàn, mẫu khai báo dùng AI, phiếu quan sát nhóm, sổ theo dõi). Tài liệu Bài 2 có viện dẫn chúng. Kế hoạch này chỉ ghi tên, không suy đoán nội dung.
- Cùng thư mục còn Bài 1, 3–8 lớp 9 và các bài lớp 6–8 (12 tiết mỗi khối). Vì vậy phân hệ nên làm **dạng dữ liệu dùng chung cho mọi bài Giáo dục AI**, không viết riêng cho Bài 2. Cách này cũng khớp yêu cầu C1 "tính mở nhiều môn không sửa mã".
