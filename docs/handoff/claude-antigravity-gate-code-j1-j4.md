# Sửa J1–J3 sau phán quyết Gate Code lần 5
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Làm J1 (quota Gemini nguyên tử + hoàn lại), J2 (thống nhất schema `packages_private` + script nạp từ bản sao lưu ngoài repo), J3 (dọn repo sạch). Chi tiết: `docs/audits/2026-10-24-firebase-gate-code-v5-verdict.md`.
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-gate-code-v5-verdict.md
- worker/index.js (quota DO ~441–518, tutor ~1100–1220, gói đáp án ~940–980)
- database.rules.json, docs/SETUP_FIREBASE_CLOUDFLARE.md
## Kết quả mong đợi
- Test song song chứng minh không vượt 30/ngày/học sinh; lỗi Gemini hoàn lượt. Làm theo quy trình chuẩn (TDD FAIL-first, oxlint, node --check), ghi bằng chứng vào nhật ký.
- J3: tạo lại commit đầu của `scratch/aihoctap-clean` với email noreply; không còn firebaseConfig thật/email giáo viên trong tệp theo dõi; sanitizer toàn cây 0 leak.
- Phân biệt THẬT/MOCK trong báo cáo; không hardcode.
## Ràng buộc
- Không push, không bật Pages khi chưa có ACCEPT của Claude và người dùng chưa xóa/riêng tư repo cũ + cho tên repo mới.
- Không ghi bí mật, PIN, đáp án vào chat, nhật ký hay Git.
## Xong thì chuyển cho: Claude
