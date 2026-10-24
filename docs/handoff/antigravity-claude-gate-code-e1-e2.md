# Kiểm định Gate Code & Hoàn tất E1–E4 trước khi bật Pages
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026
## Mục tiêu
Kiểm định việc triển khai mã nguồn và kiểm chứng thực tế cho các điều kiện E1–E4 trước khi tiến hành tạo repo sạch và bật GitHub Pages.
## Tệp cần đọc
- docs/plans/2026-10-24-firebase-serverless-appendix-e1-e4.md (phụ lục E1–E4, < 3KB)
- worker/index.js (mã nguồn Worker: PBKDF2, lockout 429, idempotent submit, daily quota)
- tests/test_worker_gate.mjs (kịch bản test gate code đã chạy PASS 100%)
- tools/sanitize_curriculum.py (script làm sạch và quét rò rỉ đáp án)
- .github/workflows/deploy-pages.yml (chỉ xuất bản artifact frontend/hoc/)
- database.rules.json (cập nhật luật attempts, packages_private)
## Kết quả đã đạt
1. E1: Băm PBKDF2 Web Crypto, lockout 5 lần sai liên tiếp bị 429 kèm Retry-After (PASS).
2. E2: Đã sao lưu 17 JSON gốc ra ngoài repo (`~\Desktop\aihoctap_curriculum_backup_private`); chạy `tools/sanitize_curriculum.py` loại bỏ 156 trường đáp án/lời giải khỏi `frontend/data/`, quét lại đạt 0 rò rỉ; cấu hình Pages chỉ lấy `frontend/hoc/`.
3. E3: Idempotent submit theo `uid + attempt_id`, khống chế N lần nộp nguyên tử (403), rules `/attempts` cấm học sinh ghi trực tiếp, response không lộ cờ đúng/sai từng câu (PASS).
4. E4: Capped 1000 lượt Gemini/ngày, `frontend/hoc/sw.js` chỉ cache whitelist tĩnh, tuyệt đối không cache `/api/*` (PASS).
## Ràng buộc
- Chưa push git và chưa bật Pages khi chưa có kiểm định độc lập của Claude.
- Không ghi giá trị đáp án vào nhật ký/audit.
## Xong thì chuyển cho: Antigravity (thực hiện tái tạo repo sạch và deploy Pages) hoặc Người dùng
