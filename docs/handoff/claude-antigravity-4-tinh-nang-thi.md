# Bàn giao: cập nhật Code.gs + luật Firebase + deploy Worker (4 tính năng thi, Zalo, giáo viên lớp)
Từ: Claude → Sang: Antigravity   Ngày: 28/10/2026

## Đã đổi (Claude, đã test, đã push)
- `apps-script/sheet-exam/Code.gs`:
  - câu hỏi có Chủ đề + Mức độ (DeThi cột J/K, DeThiThu cột K/L);
  - bài thi thật có `thuc_hanh` (cột L BaiThi), trang mới **ChamThucHanh**, action `gv_th_get` / `gv_th_save`;
  - Zalo hỗ trợ: `gv_support` / `gv_support_save`, cột F "Zalo" trang GiaoVien, Firebase `ho_tro`;
  - `publish_(only)` đẩy từng phần;
  - `pull_` nhanh (nếu chưa dán bản trước).
- `spike/step0/database.rules.ai-sgk-final.json`:
  - thêm `nang_luc` và `ho_tro`;
  - `thi_nop` nhận thêm `chu_de`, `dau`, `roi_tab`.
- `worker/index.js`:
  - endpoint mới `POST /api/teacher/ai-questions` và `POST /api/teacher/ai-practical`. Xác thực bằng token quản trị, hoặc giáo viên lớp qua Sheet `gv_login`. Giới hạn `TEACHER_AI_DAILY` (mặc định 40);
  - `/api/pwa/progress` trả `mastery`;
  - tutor nhận `context.weak_topics`;
  - nhận xét thi thử theo chủ đề;
  - các sửa độ chính xác AI ở bàn giao trước (nếu chưa deploy).
- Test PASS:
  - `node tests/test_sheet_exam_gs.cjs`, `tests/test_teacher_ai.mjs`, `tests/test_weakness_analytics.mjs`, `tests/test_tutor_*.mjs`, `tests/test_worker_*.mjs`;
  - `tests/test_practical_grading.cjs` (Pyodide thật), `tests/test_teacher_effect.cjs`, `tests/test_thi_firebase_ui.cjs`, `tests/test_teacher_thi_ui.cjs`, `tests/test_offline_learning.cjs`.

## Việc 1 — Chạy emulator luật (BẮT BUỘC trước khi publish luật)
`cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-fast.test.mjs"` → phải in **TẤT CẢ CA ĐÚNG**. Đã thêm 8 ca mới: nang_luc, ho_tro, chu_de, roi_tab, thi_th. Môi trường của Claude không tải được file jar emulator nên chưa chạy được.

## Việc 2 — Hướng dẫn người dùng (từng bước, không cần dòng lệnh)
1. Google Sheet → Tiện ích mở rộng → Apps Script → xóa hết → dán toàn bộ `apps-script/sheet-exam/Code.gs` mới → Lưu.
2. Triển khai → Quản lý bản triển khai → ✏️ → **Phiên bản mới** → Triển khai (giữ địa chỉ /exec).
3. Mở Sheet → menu **Bài thi → Tạo mẫu** (không mất dữ liệu) → menu **Bài thi → Cập nhật lên Firebase**.
4. Firebase Console → dự án `ai-sgk-tinhoc` → Realtime Database → Rules → dán toàn bộ `spike/step0/database.rules.ai-sgk-final.json` → **Publish** (chỉ sau khi Việc 1 đúng hết).
5. Ctrl+F5 trang giáo viên và trang học sinh.
6. Trang giáo viên → ⚙️ Cài đặt → **Hỗ trợ học sinh qua Zalo** → nhập số Zalo → Lưu.

## Việc 3 — Deploy Worker
1. `npx wrangler deployments list` → ghi lại ID bản đang chạy.
2. Chạy lại các test Worker ở trên → PASS.
3. Kiểm tra `SHEET_LOGIN_URL` (wrangler.toml / vars) là địa chỉ /exec của Sheet: giáo viên lớp dùng AI soạn đề cần biến này. Tùy chọn đặt `TEACHER_AI_DAILY`.
4. `npx wrangler deploy`.
5. Smoke test với dữ liệu "[THỬ]":
   - Giáo viên → Thi → Tạo đề thi → Thi thử → **AI soạn đề theo ma trận** → chọn bài, 2 Biết + 1 Hiểu → hiện 3 câu viền vàng. Chưa duyệt mà bấm Tạo thì bị chặn; duyệt xong thì tạo được.
   - Tạo bài thi thật "Trắc nghiệm + Thực hành", loại Excel, tiêu chí "D11 có công thức chứa SUM". Học sinh thử nộp một file .xlsx. Giáo viên vào Theo dõi nộp bài → **Chấm thực hành** → máy chấm → **AI gợi ý điểm** → Lưu.
   - Học sinh làm thi thử có chủ đề → Tổng quan hiện **Bản đồ năng lực**.
   - Giáo viên → **Hiệu quả** có số liệu, **Tải báo cáo CSV** mở được bằng Excel.
6. Lỗi → `npx wrangler rollback <ID cũ>` và báo Claude kèm bước lỗi.

## Không được làm
Không dán khóa Gemini, Database secret hay PIN vào chat, Git, tệp bàn giao. Không publish luật khi emulator còn ca SAI.

## Xong thì chuyển cho: Người dùng (kiểm tay trên điện thoại thật) → Claude (nếu lỗi)
