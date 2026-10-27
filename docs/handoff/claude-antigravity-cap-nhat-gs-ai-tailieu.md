# Bàn giao: hướng dẫn người dùng cập nhật Code.gs + luật Firebase, deploy Worker (AI nhận xét bài thi thử)
Từ: Claude → Sang: Antigravity   Ngày: 27/10/2026

## Đã đổi (Claude, đã test)
- `apps-script/sheet-exam/Code.gs`: **Tài liệu PDF** (trang `TaiLieu`, thư mục Drive `Tài liệu - Góc học tập/Khối N`, chia sẻ "ai có đường dẫn đều xem được"), action `gv_docs`, `gv_doc_save`, `gv_doc_delete`; đẩy `tai_lieu` lên Firebase trong `publish_()`.
- `spike/step0/database.rules.ai-sgk-final.json`: thêm `tai_lieu` (chỉ đọc), `doc_read` (học sinh ghi % đọc bài, chỉ tăng).
- `worker/index.js`: `/api/pwa/tutor` nhận `mode:'exam_review'` + `review` (câu hỏi + đúng/sai, KHÔNG có đáp án) để Gia sư AI nhận xét bài thi thử; hàm `buildExamReviewPrompt`. Test: `tests/test_tutor_exam_review.mjs`, `test_tutor_grounding.mjs`, `test_tutor_questions.mjs` PASS.
- Frontend (đã push, chạy trên GitHub Pages): khung chat AI neo góc, hiệu ứng gõ chữ, AI tự tạm nghỉ khi lớp có bài thi thật mở, thanh % đọc bài, tài liệu PDF cho giáo viên/học sinh.

## Việc 1 — Hướng dẫn người dùng (từng bước, không cần dòng lệnh)
1. Google Sheet → Tiện ích mở rộng → Apps Script → xóa hết, dán toàn bộ `apps-script/sheet-exam/Code.gs` mới → Lưu.
2. Triển khai → Quản lý bản triển khai → ✏️ Sửa → Phiên bản: **Phiên bản mới** → Triển khai (giữ nguyên địa chỉ /exec).
3. Lần chạy đầu Google hỏi quyền (Drive, kết nối bên ngoài) → chọn tài khoản → Nâng cao → Cho phép.
4. Mở Sheet → menu **Bài thi → Tạo mẫu** (không xóa dữ liệu cũ) → menu **Bài thi → Cập nhật lên Firebase**.
5. Firebase Console → dự án `ai-sgk-tinhoc` → Realtime Database → Rules → dán toàn bộ `spike/step0/database.rules.ai-sgk-final.json` → **Publish**.
6. Trang giáo viên → Hồ sơ → **Gia sư AI** → BỎ chọn **"Khóa AI trong khi kiểm tra"** → Lưu. (Ô này khóa AI cho MỌI học sinh mọi lúc — đây là lý do AI báo "Giờ thi". Nay app tự khóa AI chỉ khi lớp có bài thi thật đang mở.)
7. Ctrl+F5 trang học sinh và trang giáo viên.

## Việc 2 — Emulator luật (tùy chọn nhưng nên làm)
`cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-fast.test.mjs"` → TẤT CẢ CA ĐÚNG.

## Việc 3 — Deploy Worker (để AI nhận xét bài thi thử)
1. `npx wrangler deployments list` → ghi ID bản đang chạy.
2. `npx wrangler deploy`.
3. Smoke: học sinh nộp một bài thi thử có "Cho xem điểm" → mục "Nhận xét của Gia sư AI" hiện chữ gõ dần (không nêu đáp án). Lỗi → `npx wrangler rollback <ID cũ>` và báo Claude.
Chưa deploy thì app vẫn chạy, chỉ hiện "Gia sư AI chưa nhận xét được lúc này".

## Không được làm
Không dán Database secret / khóa nào vào chat, Git, tệp bàn giao.

## Xong thì chuyển cho: Người dùng (kiểm tay) → Claude (nếu có lỗi)
