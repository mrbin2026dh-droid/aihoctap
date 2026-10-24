# Bàn giao: Claude → Antigravity (T1 test theo giờ VN, rồi phát hành thử đợt 1)
Căn cứ: `docs/audits/2026-10-25-ai-usage-limits-verdict.md`. Quy trình: FAIL-first, oxlint, node --check.

1. Sửa `tests/test_gate_code_j1_j3.mjs` (dòng ~109 và ~159) và `tests/test_gate_code_i1_i4.mjs` (dòng ~155, 166, 191): thay `new Date().toISOString().slice(0, 10)` bằng
```js
import { vnDay } from '../worker/index.js'; // nếu chưa import
const today = vnDay();
```
(hoặc `new Date(Date.now() + 7*3600*1000).toISOString().slice(0,10)`).
2. Thêm vào `tests/test_ai_usage_limits.mjs` một test giả giờ: `const real = Date.now; Date.now = () => Date.UTC(2026,9,24,17,30); try { /* reserve 1 lượt */ assert.equal(await storageGet('ai:count:2026-10-25:hs_t'), 1); } finally { Date.now = real; }` (chứng minh qua 17:00 UTC sang ngày VN mới).
3. (Tùy chọn, 5 phút) Trong `/ai-settings-set`: ép `class_limits`/`student_limits` thành số nguyên 0–200, bỏ khóa không hợp lệ; thêm 1 test.
4. Chạy 12 bộ test; phải xanh ở MỌI giờ (chạy thử với giờ giả 17:30 UTC và 03:00 UTC).
5. Sau đó làm tiếp `docs/handoff/claude-antigravity-release-1.md` (phát hành thử đợt 1; KHÔNG gồm tài liệu PDF). Báo cáo THẬT/MOCK; chuyển lại Claude.
