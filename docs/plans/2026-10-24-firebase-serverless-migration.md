# Kế hoạch Firebase Serverless V3 (D1–D6)
24/10/2026 · Antigravity · Trọng tài: Claude · 0đ, 0 lộ đáp án, 0 cần thẻ, bảo toàn Offline.

### 1. D1: Schema & Rules (Sửa C1)
- `/courses`, `/packages/.../public`: `.read: true`, `.write: admin`
- `/packages_private`: `.read: false`, `.write: admin`
- `/attempts/{uid}/{id}`: `.read: "auth!=null && (auth.uid===$uid || auth.token.admin===true)"`, `.write: "auth!=null && (auth.token.admin===true || (auth.uid===$uid && !data.exists() && !newData.child('score').exists() && !newData.child('ack').exists()))"`
- Chặn sửa/xóa bài (`!data.exists()`), chặn ghi `score`/`ack` riêng.
- **Kiểm chứng**: Rules test: Ghi `score` lẻ -> 403; sửa bài cũ -> 403; đọc private -> 403; admin ghi 200.

### 2. D2: Lịch sử Git, Đề thi & Pages (Sửa C3)
- **Làm sạch Git**: git-filter-repo xóa 17 JSON legacy khỏi lịch sử (gồm commit 7f670c9); force push.
- **Thay đề thi**: Thay mới 4 đề trong `frontend/data/exams/` (đã lộ trên repo public).
- **Quét sạch**: Script quét đệ quy mọi trường: `dap_an_dung`, `correct_answer`, `dap_an`, `answer`, `giai_thich`, `explanation`, `solution`.
- **Deploy Pages**: GitHub Actions chỉ deploy artifact `frontend/hoc/` lên Pages (loại trừ `data/`).
- **Kiểm chứng**: `git log -S "dap_an_dung"` = 0; Pages URL `data/` trả 404.

### 3. D3: Xác thực Học sinh & Chống Mạo danh (Sửa C6)
- Bỏ Anonymous Auth. Worker `/api/login` xác thực Mã HS + PIN, cấp Custom Token `uid = studentId`.
- Chống mạo danh & reset storage vượt rate-limit. Giáo viên dùng Email/Google claim `{admin: true}`.
- **Kiểm chứng**: Mã sai -> 401; cấp đúng `uid`; xóa storage login lại vẫn giữ đúng `uid`.

### 4. D4: Chấm Bài & Chống Dò Đáp án (Sửa C2)
- `/api/submit` idempotent theo `attempt_id` (trả kết quả cũ nếu trùng, an toàn retry).
- Giới hạn N lần nộp (N=2 luyện tập, N=1 thi). Không trả cờ đúng/sai từng câu trước khi chốt để chống vét cạn.
- **Kiểm chứng**: Gửi trùng id tính 1 lần; vượt N lần -> 403; payload không lộ đúng/sai từng câu.

### 5. D5: Worker Security, Rate-Limit & Gemini (Sửa C2/C4)
- GCP SA quyền tối thiểu (`roles/firebasedatabase.admin`) lưu Worker Secret.
- Xác minh JWT Google (iss, aud, exp, sub) qua Web Crypto.
- Rate Limiting binding (5 req/phút/UID) + trần 1000 req/ngày cho Gemini.
- Gemini proxy không gửi PII, tuân thủ chính sách Gemini Free.
- **Kiểm chứng**: Token sai -> 401; >5 req/phút -> 429; SA không vào repo.

### 6. D6: Bundle SDK & Kiểm thử Offline-First (Sửa C5)
- `esbuild` bundle Firebase SDK lite vào `vendor/firebase.js`; thêm `sw.js` + stamp hash.
- Test Playwright offline SAU KHI login + nạp cache: F5 ngắt mạng chạy mượt từ SW, lưu outbox, có mạng tự sync.
- **Kiểm chứng**: Playwright offline F5 0 error console, sync 200 khi online.
