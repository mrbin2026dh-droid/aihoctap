# Bàn giao: Tài liệu Drive (D1/A6) và Bể khóa Gemini API (C5)

- Từ: Antigravity
- Sang: Claude
- Ngày: 2026-10-24
- Hồ sơ gốc: `docs/handoff/claude-antigravity-gemini-pool-next.md`, `docs/plans/2026-10-24-contest-features-spec.md` (D1 & C5), `docs/REQUIREMENTS_CUOC_THI.md` (A6, C5).

---

## 1. Tóm tắt nội dung đã hoàn thành

### A. Tài liệu Google Drive qua Proxy Worker (D1 / A6)
1. **Trích xuất strictly `file_id` (D1)**:
   - Hàm `extractDriveFileId()` trong `worker/index.js` phân tích URL chia sẻ Google Drive hoặc direct ID, kiểm tra regex `^[A-Za-z0-9_-]{10,100}$`.
   - `POST /api/pwa/teacher/materials`: Bắt buộc quyền giáo viên, kiểm tra URL an toàn `https://`, trích xuất và lưu strictly `file_id`. Tuyệt đối KHÔNG lưu URL tự do (tránh rủi ro N4 và phishing).
2. **Proxy tải tài liệu PDF cho học sinh (A6)**:
   - Endpoint: `GET /api/pwa/materials/{course_id}/{material_id}/file`.
   - Tải file từ Google Drive theo URL chuẩn cố định `https://drive.google.com/uc?export=download&id={file_id}&confirm=t`.
   - Giới hạn cứng kích thước: `<= 10MB` (vượt quá trả HTTP 413 Payload Too Large).
   - Thiết lập header `Content-Type: application/pdf`, `Cache-Control: public, max-age=86400` và `Access-Control-Allow-Origin` cho PWA.
3. **Giao diện PWA học sinh và Giáo viên**:
   - `frontend/hoc/index.html` & `frontend/hoc/app.js`: Bổ sung Tab 05 "Tài liệu", hiển thị danh sách tài liệu theo môn học, hỗ trợ "Tải về học offline" và "Xóa offline" qua Cache API (`caches.open('aisgk-materials-v1')`), "Mở xem" trực tiếp bản offline.
   - `frontend/hoc/teacher.html` & `frontend/hoc/teacher.js`: Bổ sung form đăng tải tài liệu Google Drive.

### B. Bể khóa Gemini API trong Durable Object & Failover (C5)
1. **Mã hóa và Quản lý khóa (C5)**:
   - Mã hóa AES-GCM 256-bit sử dụng Web Crypto PBKDF2 (`deriveKeyEncryptionKey()`, `encryptKeyText()`, `decryptKeyText()`).
   - `POST /api/teacher/gemini-keys`: Giáo viên nạp khóa; khóa được mã hóa lưu trong DO; API chỉ trả về đuôi hiển thị `...WXYZ` (4 ký tự cuối). Full key không bao giờ xuất hiện trong log/response.
   - `GET /api/teacher/gemini-keys`: Trả về danh sách khóa đã che mặt (`key_suffix`, `status`, `daily_count`, `daily_limit`, `note`).
   - `DELETE /api/teacher/gemini-keys`: Xóa khóa khỏi DO.
2. **Cân bằng tải & Tự động Failover khi 429**:
   - `/acquire-gemini-key`: Chọn khóa đang hoạt động có `daily_count` thấp nhất.
   - Khi Gemini trả 429: Khóa tự động vào trạng thái `cooldown` 60 giây, Worker tự động failover sang khóa kế tiếp trong bể mà không làm gián đoạn câu hỏi của học sinh.
   - Khi toàn bộ bể cạn hạn mức: Trả về chuẩn HTTP 429 với body:
     `{ "error": "AI_QUOTA_EXHAUSTED", "detail": "Gia sư đang nghỉ, em hãy quay lại sau nhé!" }`
     Đồng thời hoàn trả (refund) vị trí hạn mức của học sinh trong DO.
   - Giao diện chat Gia sư xử lý thông điệp thân thiện khi gặp `AI_QUOTA_EXHAUSTED`.

---

## 2. Kết quả kiểm thử thực tế

| Bộ kiểm thử | Số ca | Kết quả | Ghi chú |
|---|---|---|---|
| `tests/test_drive_materials.mjs` | 4/4 | **PASS 100%** | Lưu `file_id`, chặn domain lạ, tải proxy PDF, chặn file > 10MB (413) |
| `tests/test_gemini_key_pool.mjs` | 6/6 | **PASS 100%** | Thêm khóa mã hóa AES-GCM, che đuôi, load balancing, failover 429, cạn bể AI_QUOTA_EXHAUSTED, xóa khóa |
| `tests/test_worker_tutor_guardrails.mjs` | 7/7 | **PASS 100%** | Không hồi quy E2/E3/F1–F3 Socratic guardrails |
| `tests/test_gate_code_n1_n7.mjs` | 6/6 | **PASS 100%** | Không hồi quy N1–N6, URL whitelist N4 |
| `tests/test_gate_code_g1_g6.mjs` | 4/4 | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_h1_h6.mjs` | 5/5 | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_i1_i4.mjs` | 4/4 | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_j1_j3.mjs` | 4/4 | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_l1_l5.mjs` | 5/5 | **PASS 100%** | Regression test pass |
| `tests/test_gate_code_m1_m4_phase1.mjs` | 5/5 | **PASS 100%** | Regression test pass |
| `tests/test_worker_gate.mjs` | 6/6 | **PASS 100%** | Regression test pass |
| `npx oxlint` | 29 files | **0 errors, 0 warnings** | Sạch hoàn toàn |
| `node --check` | 3 files | **0 lỗi** | `worker/index.js`, `frontend/hoc/teacher.js`, `frontend/hoc/app.js` |

---

## 3. Danh sách tệp đã thay đổi

- `worker/index.js`: Bổ sung `extractDriveFileId`, `deriveKeyEncryptionKey`, `encryptKeyText`, `decryptKeyText`, DO actions `/add-gemini-key`, `/list-gemini-keys`, `/delete-gemini-key`, `/acquire-gemini-key`, `/report-gemini-key-status`; routes `/api/pwa/materials/{course_id}/{material_id}/file` proxy và `/api/teacher/gemini-keys`; nâng cấp `/api/tutor` tích hợp DO key pool với failover 429 và hoàn cọc hạn mức khi cạn khóa.
- `tests/test_drive_materials.mjs`: Bộ kiểm thử TDD FAIL-first cho D1/A6.
- `tests/test_gemini_key_pool.mjs`: Bộ kiểm thử TDD FAIL-first cho C5.
- `frontend/hoc/teacher.html`: Thêm khu vực tải tài liệu Drive và quản lý bể khóa Gemini.
- `frontend/hoc/teacher.js`: Thêm logic tải danh sách khóa, xóa khóa, thêm khóa và đăng tải tài liệu Drive.
- `frontend/hoc/index.html`: Thêm Tab 05 "Tài liệu" và khu vực `#materials-view`.
- `frontend/hoc/app.js`: Thêm luồng Tab 05 "Tài liệu", tích hợp Cache API offline và xử lý lỗi `AI_QUOTA_EXHAUSTED` thân thiện.
- `frontend/hoc/styles.css`: Cập nhật lưới 5 cột cho `.bottom-nav`.

---

## 4. Việc dở và bước tiếp theo

1. Chuyển giao Claude kiểm định độc lập mã nguồn và phán quyết điều kiện D1, A6, C5.
2. Tiếp tục các tính năng tiếp theo trong hàng đợi: Giới hạn học sinh dùng AI (theo giờ VN, hạn mức học sinh/lớp/ngày, tắt AI khi thi theo `docs/handoff/claude-antigravity-ai-usage-limits.md`).
