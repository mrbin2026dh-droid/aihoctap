# Bàn giao: Claude → Antigravity (O1–O5, có mã mẫu, không đoán mò)
Căn cứ: `docs/audits/2026-10-24-drive-keypool-verdict.md`. Quy trình: context7, test FAIL-first, oxlint, node --check, báo cáo THẬT/MOCK. Không deploy. Số dòng gần đúng, tìm theo tên hàm/chuỗi.

## O1 — fail-closed KEY_ENC_SECRET (worker/index.js)
1. Xóa `secret || 'default-gemini-pool-secret-key-32b'` trong `deriveKeyEncryptionKey` (~dòng 80). Thay bằng:
```js
export function isKeyEncSecretValid(s) { return typeof s === 'string' && s.length >= 32; }
export async function deriveKeyEncryptionKey(secret) {
  if (!isKeyEncSecretValid(secret)) throw new Error('KEY_ENC_SECRET_MISSING');
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'PBKDF2' }, false, ['deriveKey']);
  /* giữ nguyên deriveKey phía dưới */
}
```
2. Route `/api/teacher/gemini-keys` (~2394), ngay SAU kiểm quyền, thêm cho cả POST/GET/DELETE:
```js
if (!isKeyEncSecretValid(env.KEY_ENC_SECRET)) {
  return new Response(JSON.stringify({ detail: 'Máy chủ chưa cấu hình KEY_ENC_SECRET (>= 32 ký tự).' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```
3. Trong `/api/tutor` (~2789): chỉ gọi `acquire-gemini-key` khi `isKeyEncSecretValid(env.KEY_ENC_SECRET)`; nếu không hợp lệ thì bỏ qua pool (dùng `env.GEMINI_API_KEY` như cũ). Bọc `decryptKeyText` trong try/catch: lỗi giải mã → `report-gemini-key-status` không đổi, thử khóa kế, tối đa số khóa trong pool; không log nội dung khóa.
4. Test mới `tests/test_gemini_key_pool.mjs` (FAIL trước khi sửa): (a) env không có KEY_ENC_SECRET → POST 500, và không có bản ghi DO nào; (b) secret 10 ký tự → 500; (c) `grep -r "default-gemini-pool" worker/` = 0 (test đọc file bằng fs).

## O2 — materials ghi/đọc RTDB (~2273 và ~2300)
Thay `await fetch(...PUT...)` bằng:
```js
const putRes = await fetch(url, { method: 'PUT', headers: getRtdbHeaders(rtdbAccessToken), body: JSON.stringify(matRecord) });
if (!putRes.ok) return new Response(JSON.stringify({ detail: `Lỗi ghi tài liệu RTDB (HTTP ${putRes.status}).` }),
  { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```
Ở route proxy file và route danh sách (GET `/api/pwa/materials/...`): lấy `rtdbAccessToken = await getOrFetchGoogleOAuthToken(env, signingKeys?.privateKey)` và thêm `headers: getRtdbHeaders(rtdbAccessToken)`; `res.status === 404`/null → 404, `!res.ok` khác → 502. Test: mock fetch trả 500 cho PUT → expect 502.

## O3 — proxy PDF (~2320)
1. Đầu route, xác thực JWT (mẫu như `/api/pwa/me`, ~dòng 2551): `Authorization: Bearer` → `verifyJwtToken`; cho phép claims học sinh hoặc giáo viên; sai → 401.
2. Sau `driveRes.ok` và `arrayBuffer()`:
```js
const ct = (driveRes.headers.get('Content-Type') || '').toLowerCase();
const head = new Uint8Array(buf.slice(0, 5));
const isPdf = head[0]===0x25 && head[1]===0x50 && head[2]===0x44 && head[3]===0x46 && head[4]===0x2D;
if (!ct.startsWith('application/pdf') || !isPdf) return new Response(JSON.stringify({ detail: 'Tệp không phải PDF hợp lệ hoặc Drive chưa chia sẻ công khai.' }), { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```
3. Trả luôn `'Content-Type': 'application/pdf'` (không dùng header Drive), thêm `'X-Content-Type-Options': 'nosniff'`, `Cache-Control: private, max-age=3600`. Test: Drive trả HTML 200 → 415; không token → 401; PDF hợp lệ → 200.

## O4 — giao diện giáo viên (frontend/hoc/teacher.js ~106–135, teacher.html ~50)
1. teacher.html: trước `<form id="add-key-form">` thêm `<div id="pool-banner" class="notice" hidden></div>`.
2. teacher.js, trong `loadGeminiKeys` sau khi có `data.keys`:
```js
const banner = node('pool-banner');
const usable = (data.keys || []).filter(k => k.status === 'active').length;
banner.hidden = usable > 0;
banner.textContent = usable > 0 ? '' : 'Gia sư AI đang tạm dừng: bể khóa trống hoặc đã hết hạn mức. Thêm khóa mới bên dưới để học sinh dùng tiếp.';
```
(đặt cả nhánh "bể rỗng" trước `return`). 3. Thay chuỗi trạng thái bằng chữ: `'Hoạt động' | 'Chờ hồi phục' | 'Hết hạn mức ngày'` (bỏ 🟢🟡🔴). Dùng class `.status-ok/.status-wait/.status-out` trong styles.css, không emoji.

## O5 — ghi chú
Giữ UTC cho khóa Gemini; giờ VN (Asia/Ho_Chi_Minh, UTC+7) áp dụng ở task giới hạn học sinh.

## Xong khi
Test mới FAIL rồi PASS; 11 bộ cũ vẫn PASS; oxlint 0/0; node --check 3 tệp; log có bảng THẬT/MOCK. Chuyển lại cho Claude.
