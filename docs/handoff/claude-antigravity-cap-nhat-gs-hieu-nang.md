# Bàn giao: hướng dẫn người dùng dán Code.gs mới (hiệu năng 1000 học sinh) + deploy Worker
Từ: Claude → Sang: Antigravity   Ngày: 28/10/2026

## Đã đổi (Claude, đã test — `node tests/test_sheet_exam_gs.cjs` PASS)
`apps-script/sheet-exam/Code.gs`:
- `pull_(force, onlyExam)`: lấy điểm theo TỪNG bài (không tải cả cây `thi_nop`), bỏ qua bài đã khóa và đã chép xong (Script Property `PULL_DONE`), tối đa 2 phút/lần khi mở menu Thi (`LAST_PULL`), có khóa LockService chống chép trùng.
- `archivePending_`: lưu file chữ thi thật lên Drive tối đa 15 bài mỗi lần (cột mới **"Lưu Drive"** ở KetQua, tự tạo tiêu đề) → hết lỗi quá giờ Apps Script khi nhiều học sinh nộp.
- `reset_` (Cho thi lại): chép bài về TRƯỚC rồi mới đánh "Hủy" (trước đây làm ngược → bài cũ vẫn tính điểm).
- `del_` (Xóa bài): chép điểm còn trên Firebase về trước khi ẩn bài.
- `setStatus_` mở lại bài → bỏ cờ đã chép.
- `publish_(only)`: sửa tài khoản chỉ đẩy `thi_hs` + `thi_gv`; sửa tài liệu chỉ đẩy `tai_lieu` (nhanh hơn nhiều khi có nhiều bài thi).
Frontend (đã push, GitHub Pages): khung chat AI, nút "AI", thanh đọc bài, Tổng quan không giật, Tài khoản phân trang 50, đọc bài nghe theo 1 bài, thống kê thi nghe theo từng bài, AI tạm nghỉ khi đang làm bài thi.

## Việc 1 — Hướng dẫn người dùng (từng bước)
1. Google Sheet → Tiện ích mở rộng → Apps Script → xóa hết → dán toàn bộ `apps-script/sheet-exam/Code.gs` → Lưu.
2. Triển khai → Quản lý bản triển khai → ✏️ → Phiên bản: **Phiên bản mới** → Triển khai (giữ địa chỉ /exec).
3. Mở Sheet → menu **Bài thi → Lấy điểm về Sheet** một lần (chép hết điểm cũ, tạo cột "Lưu Drive").
4. Ctrl+F5 trang giáo viên và học sinh.
(Nếu chưa làm bàn giao `claude-antigravity-cap-nhat-gs-ai-tailieu.md`: Publish luật Firebase và BỎ chọn "Khóa AI trong khi kiểm tra".)

## Việc 2 — Deploy Worker (nếu chưa làm `claude-antigravity-deploy-worker-ai-chinh-xac.md`)
Làm đúng theo tệp đó (ghi ID → test → `npx wrangler deploy` → smoke → rollback nếu lỗi).

## Smoke sau khi dán Code.gs
- Menu Thi mở trong vài giây; bấm Thống kê một bài hiện ngay.
- Cho thi lại một em đã nộp: KetQua dòng của em có "Hủy", em vào thi lại được.
- Bài thi thật: file chữ có trong Drive `Bài thi - Góc học tập/…`; cột "Lưu Drive" = x.

## Không được làm
Không dán Database secret / khóa nào vào chat, Git, tệp bàn giao.

## Xong thì chuyển cho: Người dùng (kiểm tay) → Claude (nếu lỗi)
