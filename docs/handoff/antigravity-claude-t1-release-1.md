# Bàn giao: Antigravity → Claude (Hoàn thành T1 & Phát hành thử Đợt 1)

- Từ: Antigravity
- Sang: Claude
- Ngày: 2026-10-25 (Asia/Ho_Chi_Minh)
- Căn cứ: `docs/handoff/claude-antigravity-t1.md`, `docs/handoff/claude-antigravity-release-1.md`, `docs/audits/2026-10-25-ai-usage-limits-verdict.md`.

---

## 1. Hoàn thành điều kiện T1 (Giờ Việt Nam & 13 bộ test xanh ở mọi giờ)

1. **Sửa ngày trong các bộ test cổng**:
   - `tests/test_gate_code_j1_j3.mjs`: Đã import `vnDay` từ `worker/index.js`, thay `new Date().toISOString().slice(0, 10)` thành `vnDay()` tại 2 vị trí kiểm tra lưu trữ (dòng 110 và 160).
   - `tests/test_gate_code_i1_i4.mjs`: Đã import `vnDay`, thay ngày UTC thành `vnDay()` tại 3 vị trí kiểm tra số đếm (dòng 155, 166, 191).
2. **Bổ sung ca kiểm thử giả lập giờ (`tests/test_ai_usage_limits.mjs`)**:
   - Thêm ca [12]: Giả lập `Date.now = () => Date.UTC(2026, 9, 24, 17, 30, 0)` (00:30 ngày 25/10 giờ Việt Nam), kiểm tra đặt chỗ gia sư ghi chính xác vào khóa `ai:count:2026-10-25:hs_t_time_rollover`. Khôi phục `Date.now` an toàn trong khối `finally`.
   - Kiểm chứng động: Đã chạy thử nghiệm với `17:30 UTC` và `03:00 UTC`, 100% test đều XANH.
3. **Ép kiểu và lọc ID hợp lệ trong `/ai-settings-set` (`worker/index.js`)**:
   - Duyệt từng phần tử của `class_limits` và `student_limits`: Chỉ chấp nhận ID hợp lệ theo `IdValidationContract.isValidId(k)`, ép giá trị sang số nguyên `Math.floor(Number(v))` trong khoảng `0..200`. Loại bỏ hoàn toàn ID chứa ký tự lạ, đường dẫn traversal hoặc số âm/vượt 200.
   - Thêm ca test [13] trong `tests/test_ai_usage_limits.mjs` xác nhận các trường hợp ID bẩn, số âm, số thực đều được xử lý chuẩn xác.
4. **Xử lý lưu ý P1 (giải mã lỗi lặp lại)**:
   - Trong `worker/index.js`: `/report-gemini-key-status` đã hỗ trợ `status: 'error'`, tự động đặt thời gian chờ (`cooldown_until`) 300 giây cho khóa lỗi. Khi giải mã `KEY_ENC_SECRET` thất bại trong vòng lặp acquire/failover, worker tự động báo `status: 'error'` để DO loại khóa hỏng khỏi lượt chọn kế tiếp, tránh lặp 10 lần vô ích.
   - Lưu ý P2: Giữ nguyên như trao đổi (tài liệu PDF đang hoãn sang đợt sau với Apps Script).

---

## 2. Báo cáo triển khai Phát hành thử Đợt 1 (THẬT)

### 2.1. Quét bảo mật trước phát hành
- Quét `git diff --cached`: Không có bất kỳ chuỗi nhạy cảm nào (`KEY_ENC_SECRET` gán cứng, `BEGIN PRIVATE`, private keys hay mật khẩu).
- Quét tệp: Không có `.env`, không có tệp CSV học sinh trong repository.
- Hook Alibaba OCR pre-commit và pre-push: PASS 100% (0 errors, 0 warnings).

### 2.2. Thông tin phiên bản Cloudflare Worker
- **Tên Worker**: `aihoctap-gate`
- **Địa chỉ API THẬT**: `https://aihoctap-gate.mrbin2026dh.workers.dev`
- **ID bản cũ (lưu để rollback N7 nếu cần)**: `07db2781-08d8-4576-aa97-31a5def911d6`
- **ID bản mới đã deploy thành công**: `563b6292-2efe-4e4e-9141-4d1888ae060c`
- **Lệnh hoàn tác dự phòng**: `npx wrangler rollback 07db2781-08d8-4576-aa97-31a5def911d6`

### 2.3. Triển khai Frontend GitHub Pages
- Đã đồng bộ nhánh `main` lên GitHub `https://github.com/mrbin2026dh-droid/aihoctap.git`.
- GitHub Actions workflow `Deploy Student PWA to GitHub Pages` (Run ID: `40142577145`): **Thành công (Completed Success in 14s)**.
- Địa chỉ trang PWA: `https://mrbin2026dh-droid.github.io/aihoctap/`
- Giao diện giáo viên: `https://mrbin2026dh-droid.github.io/aihoctap/teacher.html`

---

## 3. Bằng chứng Đo đạc Smoke Test THẬT (Live Trace)

| STT | Mục kiểm tra | Điểm cuối thực tế | Kết quả HTTP | Dữ liệu phản hồi thực tế | Đánh giá |
|---|---|---|---|---|---|
| 1 | Health & Serverless Status | `GET https://aihoctap-gate.mrbin2026dh.workers.dev/api/health` | **200 OK** | `{"status":"healthy","serverless":true}` | **PASS THẬT** |
| 1b | PWA Catalog (Dynamic) | `GET https://aihoctap-gate.mrbin2026dh.workers.dev/api/pwa/catalog` | **200 OK** | `{"courses":[...],"schema_version":1}` (2 môn học) | **PASS THẬT** |
| 2 | Chặn LAN Login ngoài Production | `POST https://aihoctap-gate.mrbin2026dh.workers.dev/api/student/lan-login` | **403 Forbidden** | `{"detail":"Tính năng đăng nhập LAN chỉ hỗ trợ môi trường phát triển."}` | **PASS THẬT** |
| 3 | Đăng nhập sai PIN 3 lần | `POST https://aihoctap-gate.mrbin2026dh.workers.dev/api/login` (3 lần) | **401 Unauthorized** | 3 lần đều trả về `{"detail":"Mã học sinh hoặc PIN không chính xác."}` | **PASS THẬT** |
| 4 | Proxy tài liệu không token | `GET https://aihoctap-gate.mrbin2026dh.workers.dev/api/pwa/materials/tin6/mat1/file` | **401 Unauthorized** | `{"detail":"Yêu cầu đăng nhập để truy cập tài liệu."}` | **PASS THẬT** |
| 5 | Quản lý bể khóa không quyền | `GET /api/teacher/gemini-keys` & `POST /api/teacher/gemini-keys` | **403 Forbidden** | Cả GET và POST đều bị từ chối 403 khi thiếu xác thực giáo viên | **PASS THẬT** |
| 6 | Tài nguyên GitHub Pages | `https://mrbin2026dh-droid.github.io/aihoctap/` | **200 OK** | `index.html` (200), `teacher.html` (200), `manifest.webmanifest` (200), `sw.js` (200) | **PASS THẬT** |

---

## 4. Tóm tắt Kiểm thử Tự động Cục bộ (13/13 XANH)

- `tests/test_ai_usage_limits.mjs`: PASS 13/13 (bao gồm ca giả giờ 17:30 UTC và sanitize 0–200).
- `tests/test_gate_code_j1_j3.mjs`: PASS 4/4 (ở cả giờ máy thật và giờ giả 17:30 UTC / 03:00 UTC).
- `tests/test_gate_code_i1_i4.mjs`: PASS 4/4 (ở cả giờ máy thật và giờ giả 17:30 UTC / 03:00 UTC).
- 10 bộ kiểm thử hồi quy khác (`drive_materials`, `gemini_key_pool`, `g1_g6`, `h1_h6`, `l1_l5`, `m1_m4`, `n1_n7`, `worker_gate`, `worker_tutor_guardrails`, `frontend_outbox`): PASS 100%.
- `node --check`: PASS 100% không lỗi cú pháp.
- `npx oxlint`: **0 errors, 0 warnings**.

---

## 5. Lưu ý cho Người dùng (Bước tiếp theo)

1. Đặt bí mật `KEY_ENC_SECRET` lên Cloudflare Worker bằng lệnh:
   ```bash
   npx wrangler secret put KEY_ENC_SECRET
   ```
   (Nhập chuỗi ngẫu nhiên an toàn có độ dài tối thiểu 32 ký tự, ví dụ: 32 ký tự ngẫu nhiên).
2. Truy cập `https://mrbin2026dh-droid.github.io/aihoctap/teacher.html` để kiểm tra các tính năng theo kịch bản Bước 4 của Claude.

Kính chuyển Claude kiểm định độc lập.
