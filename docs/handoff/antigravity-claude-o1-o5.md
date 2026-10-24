# Bàn giao: Antigravity → Claude (Hoàn thành O1–O5)

- Từ: Antigravity
- Sang: Claude
- Ngày: 2026-10-24
- Căn cứ: `docs/handoff/claude-antigravity-o1-o5.md`, `docs/audits/2026-10-24-drive-keypool-verdict.md`.

---

## 1. Tóm tắt nội dung đã sửa theo điều kiện O1–O5

### O1 — Fail-closed KEY_ENC_SECRET (`worker/index.js`)
- Xóa hoàn toàn chuỗi mặc định `default-gemini-pool-secret-key-32b`.
- Bổ sung hàm kiểm tra `isKeyEncSecretValid(s)` (bắt buộc string, length >= 32).
- `deriveKeyEncryptionKey(secret)` quăng lỗi `KEY_ENC_SECRET_MISSING` nếu secret không hợp lệ.
- Route `/api/teacher/gemini-keys` trả HTTP 500 nếu thiếu hoặc `KEY_ENC_SECRET` < 32 ký tự, ngăn chặn lưu bản ghi vào DO.
- Route `/api/tutor` chỉ gọi DO key pool khi `isKeyEncSecretValid(env.KEY_ENC_SECRET)`; nếu giải mã lỗi (`decryptKeyText`) thì tự động thử khóa kế tiếp trong bể (tối đa 10 lần), không log nội dung khóa.
- Bộ test `tests/test_gemini_key_pool.mjs` kiểm tra FAIL-first và PASS: thiếu secret → 500; secret 10 ký tự → 500; kiểm tra fs quét toàn văn không còn `default-gemini-pool`.

### O2 — Kiểm tra lỗi RTDB khi ghi và token khi đọc tài liệu
- `POST /api/pwa/teacher/materials`: Kiểm tra `putRes.ok` khi ghi RTDB; nếu lỗi trả 502 Bad Gateway (không còn báo 200 giả).
- `GET /api/pwa/materials/{course_id}` và proxy file: Gửi `headers: getRtdbHeaders(rtdbAccessToken)`; nếu lỗi đọc RTDB trả 502, 404 trả đúng 404.
- Test `tests/test_drive_materials.mjs` kiểm tra FAIL-first và PASS: RTDB PUT lỗi 500 → worker trả 502.

### O3 — Xác thực và kiểm định tệp PDF cho proxy tải file
- Route proxy `GET /api/pwa/materials/{course_id}/{material_id}/file` bắt buộc JWT hợp lệ của học sinh hoặc giáo viên (thiếu/sai token trả 401).
- Kiểm tra header `Content-Type` phải bắt đầu bằng `application/pdf` và 5 byte đầu của buffer phải đúng magic bytes `%PDF-` (`0x25, 0x50, 0x44, 0x46, 0x2D`). Nếu Drive trả về trang HTML hoặc tệp không phải PDF, trả ngay 415 Unsupported Media Type.
- Luôn cố định trả header `'Content-Type': 'application/pdf'`, `'X-Content-Type-Options': 'nosniff'`, `'Cache-Control': 'private, max-age=3600'`.
- Test `tests/test_drive_materials.mjs` kiểm tra FAIL-first và PASS: thiếu token → 401; Drive trả HTML → 415; PDF chuẩn → 200.

### O4 — Giao diện giáo viên chuẩn UX & phi emoji
- `frontend/hoc/teacher.html`: Thêm `<div id="pool-banner" class="notice" hidden></div>` trước form nạp khóa.
- `frontend/hoc/teacher.js`: Trong `loadGeminiKeys`, hiển thị biểu ngữ cảnh báo khi số lượng khóa `active === 0` (bể trống hoặc cạn hạn mức) trước khi return.
- Bỏ hoàn toàn emoji 🟢🟡🔴, thay bằng chữ thanh lịch: `'Hoạt động'` (class `.status-ok`), `'Chờ hồi phục'` (class `.status-wait`), `'Hết hạn mức ngày'` (class `.status-out`).
- `frontend/hoc/styles.css`: Bổ sung định dạng màu sắc cho 3 class trạng thái.

### O5 — Giờ tính hạn mức
- Giữ nguyên UTC cho chu kỳ ngày của khóa Gemini; chuẩn giờ Việt Nam (UTC+7) áp dụng ở task giới hạn học sinh tiếp theo.

---

## 2. Báo cáo kiểm thử thực tế (THẬT / MOCK)

| Bộ kiểm thử | Số ca | Phân loại | Kết quả | Ghi chú |
|---|---|---|---|---|
| `tests/test_gemini_key_pool.mjs` | 7/7 | MOCK (DO + Web Crypto) | **PASS 100%** | Test O1 (fail-closed, length < 32, static scan 0 default secret), load balance, 429 failover, AI_QUOTA_EXHAUSTED |
| `tests/test_drive_materials.mjs` | 6/6 | MOCK (Drive + RTDB) | **PASS 100%** | Test O2 (RTDB PUT 500 → 502), Test O3 (no token → 401, Drive HTML → 415, magic bytes `%PDF-`, nosniff) |
| `tests/test_worker_tutor_guardrails.mjs` | 7/7 | MOCK / UNIT | **PASS 100%** | Socratic guardrails không hồi quy |
| `tests/test_gate_code_n1_n7.mjs` | 6/6 | MOCK / UNIT | **PASS 100%** | Whitelist URL, PIN >= 6 không hồi quy |
| `tests/test_gate_code_g1_g6.mjs` | 4/4 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_h1_h6.mjs` | 5/5 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_i1_i4.mjs` | 4/4 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_j1_j3.mjs` | 4/4 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_l1_l5.mjs` | 5/5 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_m1_m4_phase1.mjs` | 5/5 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `tests/test_worker_gate.mjs` | 6/6 | MOCK / UNIT | **PASS 100%** | Regression test pass |
| `npx oxlint` | 29 files | STATIC SCAN | **0 errors, 0 warnings** | Sạch hoàn toàn |
| `node --check` | 3 files | SYNTAX CHECK | **0 lỗi** | `worker/index.js`, `frontend/hoc/teacher.js`, `frontend/hoc/app.js` |

---

## 3. Danh sách tệp đã thay đổi

- `worker/index.js`: Triển khai O1 (isKeyEncSecretValid, fail-closed 500, decrypt loop try/catch); O2 (RTDB write 502 check, read Bearer header); O3 (token auth 401, PDF magic bytes `%PDF-` & Content-Type 415, nosniff).
- `tests/test_gemini_key_pool.mjs`: Thêm ca kiểm thử fail-closed missing/short KEY_ENC_SECRET và static check.
- `tests/test_drive_materials.mjs`: Thêm ca kiểm thử RTDB PUT 500 → 502, proxy thiếu token → 401, Drive HTML → 415.
- `frontend/hoc/teacher.html`: Bổ sung `#pool-banner`.
- `frontend/hoc/teacher.js`: Logic hiển thị biểu ngữ cảnh báo và bỏ emoji bảng khóa.
- `frontend/hoc/styles.css`: Bổ sung `.status-ok`, `.status-wait`, `.status-out`.
- `aisgk.md`: Cập nhật trạng thái và nhật ký phiên làm việc.

---

## 4. Việc dở và bước tiếp theo

1. Chuyển giao Claude kiểm định độc lập O1–O5 và ra phán quyết.
2. Sẵn sàng tiếp tục task Giới hạn học sinh dùng AI (theo `docs/handoff/claude-antigravity-ai-usage-limits.md`).
