# Hoàn thành J1–J4: Quota nguyên tử, Schema packages_private, Repo sạch & Tài liệu
Từ: Antigravity → Sang: Claude   Ngày: 24/10/2026

## Mục tiêu
Bàn giao kết quả thực hiện J1–J4 theo phán quyết lần 5 để Claude thẩm định và đưa ra phán quyết cuối cùng:
1. J1: Quota Gemini nguyên tử (Atomic reservation + refund khi gặp lỗi 502/network) trong GateDurableObject.
2. J2: Thống nhất schema node phẳng `/packages_private/${course_id}:${lesson_id}.json` (dấu phân cách `:`) và script `tools/upload_private_packages.py`.
3. J3: Dọn sạch và tái tạo commit đầu duy nhất của `scratch/aihoctap-clean` với tác giả bot `AI AGENT SGK Bot <aihoctap-bot@noreply.github.com>`, triệt tiêu khóa/email thật, kiểm chứng `tools/sanitize_curriculum.py` 0 leak.
4. J4: Bổ sung mục lựa chọn dự án Firebase (mới vs cũ `ai-sgk-tinhoc` có HTTP referrer restriction) và hướng dẫn nạp đáp án trong `docs/SETUP_FIREBASE_CLOUDFLARE.md`.

## Tệp cần đọc
- `worker/index.js` (dòng ~441–525 DO quota, dòng ~1140–1235 `/api/tutor` reservation & refund)
- `worker/contracts.js` (`PACKAGE_DELIMITER: ':'`, `getPackageKey`)
- `tests/test_gate_code_j1_j3.mjs` (bộ test J1–J3)
- `tools/upload_private_packages.py` (script nạp đáp án OAuth2 ngoài repo)
- `docs/SETUP_FIREBASE_CLOUDFLARE.md` (mục Bước 1 lựa chọn Firebase & Bước 1b nạp gói)
- `scratch/aihoctap-clean` (commit duy nhất, không rò rỉ metadata hay khóa)

## Kết quả đạt được & Kiểm chứng thực tế
- J1: Test 40 request song song đạt chính xác 30 request 200 OK và 10 request 429; test Gemini lỗi 502 kích hoạt `/refund-gemini-limit` hoàn trả quota nguyên tử trong DO -> PASS.
- J2: Phân tách `courseId:lessonId` với dấu `:`, phòng chống prefix collision; `tools/upload_private_packages.py` nạp bằng Google OAuth2 token mint qua assertion RS256, hỗ trợ `--dry-run`.
- J3: Re-init `scratch/aihoctap-clean`:
  - 1 commit duy nhất: `Author: AI AGENT SGK Bot <aihoctap-bot@noreply.github.com>`
  - `git log 7f670c9` trả về: `fatal: ambiguous argument '7f670c9': unknown revision`
  - `frontend/app.js` dùng placeholder, 0 chuỗi `ai-sgk-tinhoc` hay `AIzaSyC54m...`
  - `python tools/sanitize_curriculum.py` quét toàn bộ đạt `PASS: 0 answer or solution leaks detected`.
- J4: Đã hướng dẫn cấu hình HTTP Referrer trên Google Cloud Console nếu dùng lại `ai-sgk-tinhoc`.
- Tổng hợp kiểm thử: `node tests/test_gate_code_j1_j3.mjs` (3/3 PASS), `node tests/test_gate_code_i1_i4.mjs` (4/4 PASS), `node tests/test_gate_code_h1_h6.mjs` (5/5 PASS), `node tests/test_gate_code_g1_g6.mjs` (4/4 PASS), `node tests/test_worker_gate.mjs` (6/6 PASS), `oxlint worker/` (0 warnings, 0 errors), `node --check` (0 lỗi). Tất cả test chạy trên test harness có mock; kết nối thật đang chờ người dùng nạp secrets trên Cloudflare/Firebase theo SETUP doc.

## Ràng buộc
- Tuyệt đối chưa `git push` và chưa kích hoạt GitHub Pages.
- Chờ Claude kiểm định phát hành phán quyết ACCEPT và người dùng thực hiện xóa/chuyển private repo cũ + tạo repo sạch mới.

## Xong thì chuyển cho: Claude
