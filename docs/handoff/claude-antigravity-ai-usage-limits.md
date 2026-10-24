# Giới hạn và thống kê học sinh dùng AI (A9/B7) — có mã mẫu
Từ: Claude → Antigravity. Căn cứ: spec mục "Theo dõi và giới hạn học sinh dùng AI", `docs/REQUIREMENTS_CUOC_THI.md` (A9, B7). Quy trình: context7, FAIL-first, oxlint, node --check, báo cáo THẬT/MOCK. Không deploy. Không lưu nội dung chat/đáp án vào log. Làm theo 3 bước, nộp từng bước nếu muốn (mỗi bước test riêng).

## Bước 1 — Lõi trong Durable Object (worker/index.js, class GateDurableObject, cạnh `/reserve-gemini-limit` ~604)
Thêm helper (module scope) và lưu trữ khóa:
```js
export function vnDay(now = Date.now()) { return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10); } // Asia/Ho_Chi_Minh
const AI_DEFAULTS = { default_limit: 10, class_limits: {}, student_limits: {}, locked: {}, exam_mode: false };
export function effectiveLimit(settings, sid, classId, grant) {
  const base = settings.student_limits?.[sid] ?? (classId ? settings.class_limits?.[classId] : undefined) ?? settings.default_limit;
  return Math.max(0, Number(base) || 0) + Math.max(0, Number(grant) || 0);
}
```
Trong DO, thay `MAX_STUDENT_DAILY_LIMIT` bằng logic sau (giữ `MAX_GLOBAL_DAILY_LIMIT`, đổi `today` thành `vnDay()`):
```js
const settings = { ...AI_DEFAULTS, ...((await this.storage.get('ai:settings')) || {}) };
const day = vnDay();
if (settings.exam_mode) return json({ allowed: false, reason: 'AI_DISABLED_IN_EXAM', detail: 'Đang trong giờ thi, gia sư tạm tắt.' });
if (settings.locked?.[student_id]) return json({ allowed: false, reason: 'AI_LOCKED', detail: 'Giáo viên đã tạm khóa gia sư với em. Hãy hỏi thầy/cô nhé.' });
const used = (await this.storage.get(`ai:count:${day}:${student_id}`)) || 0;
const grant = (await this.storage.get(`ai:grant:${day}:${student_id}`)) || 0;
const limit = effectiveLimit(settings, student_id, body.class_id, grant);
if (used >= limit) return json({ allowed: false, reason: 'AI_LIMIT_REACHED', used, limit, detail: `Em đã dùng hết ${limit} lượt hỏi gia sư hôm nay.` });
await this.storage.put(`ai:count:${day}:${student_id}`, used + 1); // đặt chỗ nguyên tử
```
(`json` = helper `(o)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})`.) `/refund-gemini-limit` giảm `ai:count:${vnDay()}:${sid}` (không âm). Thêm DO actions: `/ai-settings-get`, `/ai-settings-set` (hợp nhất các trường hợp lệ: `default_limit` 0–200, `class_limits`, `student_limits`, `locked`, `exam_mode` boolean), `/ai-grant` (`{student_id, extra}` extra 1–50 cộng vào `ai:grant:{day}:{sid}`), `/ai-stats` (đọc `ai:count:{day}:*` bằng `storage.list({prefix})`; trả `[{student_id, used, limit}]`). Worker `/api/tutor` truyền `class_id` lấy từ claim JWT nếu có; trả mã lỗi: nếu `reason` ∈ {AI_LOCKED, AI_DISABLED_IN_EXAM, AI_LIMIT_REACHED} thì HTTP 429 body `{ error: reason, detail }`.
Test FAIL-first `tests/test_ai_usage_limits.mjs`: (a) `vnDay(Date.UTC(2026,9,24,17,30))` = `2026-10-25`; (b) mặc định 10, lượt thứ 11 → AI_LIMIT_REACHED; (c) student_limits=2 ghi đè class=5; (d) grant +3 cho phép thêm 3; (e) locked → AI_LOCKED, không tăng đếm; (f) exam_mode → AI_DISABLED_IN_EXAM; (g) 5 reserve song song limit 3 → đúng 3 allowed; (h) refund trả lại 1 lượt; (i) không có trường nội dung chat trong storage.

## Bước 2 — Route giáo viên (cùng mẫu quyền như `/api/teacher/gemini-keys`, ~2480)
`GET/PUT /api/teacher/ai-settings`, `POST /api/teacher/ai-grant`, `POST /api/teacher/ai-lock` (`{student_id, locked}`), `GET /api/teacher/ai-stats?format=csv`. CSV: cột `student_id,used,limit,date`, chống công thức: giá trị bắt đầu bằng `= + - @` thì thêm `'` đầu. Học sinh: `GET /api/pwa/ai-quota` (JWT học sinh) trả `{used, limit, locked, exam_mode}`. Test: không quyền → 403; học sinh không đọc được stats; CSV có `'=` khi id bắt đầu bằng `=`.

## Bước 3 — Giao diện (frontend/hoc/teacher.html/.js, app.js)
Giáo viên: mục "Gia sư AI": ô hạn mức mặc định, bảng học sinh (đã dùng/hạn mức, nút Khóa/Mở, nút +5 lượt), công tắc "Đang thi: tắt gia sư", nút Tải CSV. Học sinh: hiển thị "Còn N lượt hôm nay" cạnh khung chat và thông báo theo `error` (3 mã). Văn bản ngắn, không emoji.

## Xong khi
Test mới FAIL rồi PASS; 11 bộ cũ + drive/key_pool vẫn PASS; oxlint 0/0; node --check; `database.rules.json` không cần mở thêm (dữ liệu nằm ở DO) — ghi rõ trong log. Báo cáo THẬT/MOCK. Chuyển lại Claude.
