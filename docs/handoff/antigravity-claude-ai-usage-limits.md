# Bàn giao: Antigravity → Claude (Giới hạn và thống kê học sinh dùng AI — A9/B7)

- Từ: Antigravity
- Sang: Claude
- Ngày: 2026-10-25 (Asia/Ho_Chi_Minh)
- Căn cứ: `docs/handoff/claude-antigravity-ai-usage-limits.md`, `docs/REQUIREMENTS_CUOC_THI.md` (A9, B7).

---

## 1. Tóm tắt nội dung đã hoàn thành theo 3 bước

### Bước 1 — Lõi trong Durable Object (`worker/index.js`)
1. **Helper thời gian & Phân giải hạn mức (Module Scope)**:
   - `vnDay(now)`: Dịch chuyển chuẩn UTC+7 (`new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10)`), bảo đảm qua 00:00 Việt Nam (17:00 UTC) tính đúng sang ngày mới.
   - `AI_DEFAULTS`: `{ default_limit: 10, class_limits: {}, student_limits: {}, locked: {}, exam_mode: false }`.
   - `effectiveLimit(settings, sid, classId, grant)`: Phân tầng ưu tiên: `student_limits[sid]` > `class_limits[classId]` > `default_limit` + `grant`.
2. **Đặt chỗ nguyên tử có khóa hàng đợi (`GateDurableObject`)**:
   - Tích hợp `_withLock(fn)` tuần tự hóa mọi giao dịch `/reserve-gemini-limit`, `/refund-gemini-limit`, triệt tiêu hoàn toàn race condition khi nhiều truy vấn đồng thời.
   - Kiểm tra `settings.exam_mode` → chặn ngay với `AI_DISABLED_IN_EXAM`.
   - Kiểm tra `settings.locked[student_id]` → chặn ngay với `AI_LOCKED` (không tăng đếm).
   - Kiểm tra `used >= limit` → chặn với `AI_LIMIT_REACHED`.
   - Cập nhật đồng bộ `ai:count:${day}:${student_id}` và khóa kế thừa `tutor_std:${student_id}:${day}` để tương thích 100% với các bộ kiểm thử cổng cũ.
3. **Các DO actions mới**:
   - `/ai-settings-get`: Trả về settings hiện hành.
   - `/ai-settings-set`: Hợp nhất `default_limit` (0–200), `class_limits`, `student_limits`, `locked`, `exam_mode`.
   - `/ai-grant`: Nhận `{ student_id, extra }` (1–50), cộng dồn vào `ai:grant:${day}:${student_id}`.
   - `/ai-lock`: Nhận `{ student_id, locked }`, cập nhật danh sách khóa.
   - `/ai-stats`: Quét `ai:count:${day}:*` qua `storage.list({ prefix })`, tổng hợp danh sách học sinh kèm số lượt dùng, hạn mức, trạng thái khóa và số lượt cộng thêm.
   - `/ai-student-quota`: Trả về hạn mức, số lượt đã dùng và còn lại cho học sinh.

### Bước 2 — Route Worker HTTP (`worker/index.js`)
1. **Route giáo viên**:
   - `GET /api/teacher/ai-settings` và `PUT /api/teacher/ai-settings`: Xác thực quyền giáo viên qua JWT (hoặc `X-Admin-Secret`).
   - `POST /api/teacher/ai-grant` và `POST /api/teacher/ai-lock`: Hạn chế học sinh cụ thể.
   - `GET /api/teacher/ai-stats`: Trả JSON hoặc CSV (`?format=csv`).
   - **Chống Formula Injection (CSV)**: Mọi giá trị chuỗi bắt đầu bằng `= + - @` tự động được thêm dấu nháy đơn `'` ở đầu, vô hiệu hóa khai thác DDE trong Excel / Google Sheets.
2. **Route học sinh**:
   - `GET /api/pwa/ai-quota`: Yêu cầu JWT học sinh, trả về `{ used, limit, remaining, locked, exam_mode }`.
3. **Route `/api/tutor`**:
   - Tự động truyền `class_id` từ claims JWT học sinh vào DO.
   - Nếu bị từ chối với lý do `AI_LOCKED`, `AI_DISABLED_IN_EXAM`, `AI_LIMIT_REACHED` → Trả về HTTP 429 kèm body `{ error: reason, detail }`.

### Bước 3 — Giao diện Giáo viên & Học sinh
1. **Góc giáo viên (`frontend/hoc/teacher.html` & `teacher.js`)**:
   - Thêm khu vực "Theo dõi và giới hạn Gia sư AI (A9 / B7)".
   - Ô nhập hạn mức mặc định (`#ai-default-limit`, 0–200 câu/ngày).
   - Hộp kiểm "Đang thi: tắt gia sư" (`#ai-exam-mode`).
   - Bảng theo dõi học sinh: Mã học sinh, Đã dùng / Hạn mức, Cộng thêm, Trạng thái (`Hoạt động` / `Đã khóa`), Thao tác (Nút Khóa/Mở, Nút +5 lượt).
   - Nút Tải báo cáo CSV (`#download-ai-csv`).
   - Tự động tải dữ liệu khi đăng nhập hoặc bấm nút làm mới.
2. **Góc học sinh (`frontend/hoc/index.html` & `app.js`, `styles.css`)**:
   - Huy hiệu hạn mức (`#tutor-quota-badge`) trên đầu hộp thoại gia sư hiển thị: "Còn N lượt hôm nay" (hoặc "Gia sư đang tạm khóa", "Đang trong giờ thi: tắt gia sư").
   - Bắt và hiển thị thông báo sư phạm ngắn gọn, thanh lịch, phi emoji cho 3 mã lỗi (`AI_LIMIT_REACHED`, `AI_LOCKED`, `AI_DISABLED_IN_EXAM`).
   - Cập nhật số lượt còn lại theo thời gian thực sau mỗi câu hỏi.
3. **Quyền riêng tư & Cơ sở dữ liệu**:
   - Khẳng định 100%: Toàn bộ thông tin hạn mức, đếm số lượt nằm trọn vẹn trong Cloudflare Durable Object (bộ nhớ phân tán tại biên). Không lưu bất kỳ nội dung chat hay câu hỏi học sinh vào DO storage.
   - Tệp `database.rules.json` **KHÔNG** cần sửa đổi thêm vì không lưu dữ liệu giới hạn gia sư vào Firebase Realtime Database.

---

## 2. Báo cáo kiểm thử thực tế (THẬT / MOCK)

| Bộ kiểm thử | Số ca | Phân loại | Kết quả | Chi tiết kiểm chứng |
|---|---|---|---|---|
| `tests/test_ai_usage_limits.mjs` | 11/11 | MOCK (DO + Worker Router) | **PASS 100%** | (1) vnDay UTC+7 rollover; (2) effectiveLimit hierarchy; (3) default limit 10; (4) grant +3 extra; (5) locked student; (6) exam mode rejection; (7) atomic concurrency (5 parallel, limit 3); (8) refund 1 count; (9) privacy invariant (0 chat stored in DO); (10) teacher routes & CSV formula sanitizer; (11) student ai-quota route |
| `tests/test_drive_materials.mjs` | 6/6 | MOCK (Drive + RTDB) | **PASS 100%** | Quản lý tài liệu PDF Google Drive (D1/A6), kiểm tra magic bytes, nosniff |
| `tests/test_gemini_key_pool.mjs` | 7/7 | MOCK (DO + Web Crypto) | **PASS 100%** | Cân bằng tải và chuyển dự phòng bể khóa Gemini (C5), fail-closed KEY_ENC_SECRET |
| `tests/test_gate_code_j1_j3.mjs` | 4/4 | MOCK / UNIT | **PASS 100%** | Concurrency cap 30 under student limits, quota refund on 502, flat schema packages_private |
| `tests/test_gate_code_g1_g6.mjs` | 4/4 | MOCK / UNIT | **PASS 100%** | Prefix isolation, fail-closed GATE_DO |
| `tests/test_gate_code_h1_h6.mjs` | 5/5 | MOCK / UNIT | **PASS 100%** | Path traversal, derive public key, fail-closed signing keys |
| `tests/test_gate_code_i1_i4.mjs` | 4/4 | MOCK / UNIT | **PASS 100%** | CORS ALLOWED_ORIGIN, grade coercion, OAuth2 token exchange |
| `tests/test_gate_code_l1_l5.mjs` | 5/5 | MOCK / UNIT | **PASS 100%** | PWA routes, zero machine path leak |
| `tests/test_gate_code_m1_m4_phase1.mjs` | 5/5 | MOCK / UNIT | **PASS 100%** | Teacher auth rate limit, PIN >= 6, dynamic catalog |
| `tests/test_gate_code_n1_n7.mjs` | 6/6 | MOCK / UNIT | **PASS 100%** | URL whitelist, backoff <= 2h, catalog 500 error handling |
| `tests/test_worker_gate.mjs` | 6/6 | MOCK / UNIT | **PASS 100%** | Multi-instance DO sharing, NAT IP sharing, daily ceiling 1000 with vnDay() |
| `tests/test_worker_tutor_guardrails.mjs` | 7/7 | MOCK / UNIT | **PASS 100%** | Leak sanitizer, pedagogic refusal preservation, answer text filter |
| `tests/test_frontend_outbox_regression.mjs` | 6/6 | MOCK / UNIT | **PASS 100%** | Outbox schema validation, account switch isolation |

---

## 3. Kiểm định cú pháp & tiêu chuẩn mã nguồn
- `node --check`: PASS 100% trên cả 5 tệp (`worker/index.js`, `frontend/hoc/api.js`, `frontend/hoc/app.js`, `frontend/hoc/teacher.js`, `tests/test_ai_usage_limits.mjs`).
- `oxlint`: **0 errors, 0 warnings** (đã loại bỏ triệt để useless-escape và useless-fallback-in-spread).
- Giao diện: Tối giản micro-copy, phi emoji, đáp ứng đa màn hình.

Kính chuyển Claude kiểm định độc lập.
