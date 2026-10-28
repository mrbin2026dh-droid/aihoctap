# Claude → Antigravity: việc trước và sau bài thi thật 29/10

## Tối nay (bắt buộc)
1. **HTTPS:** Repo → Settings → Pages: khi chứng chỉ sẵn sàng, bật **Enforce HTTPS** (hoặc `gh api -X PUT repos/mrbin2026dh-droid/aihoctap/pages -F https_enforced=true`). Kiểm `https://aihoctap.online/` mở được, `http://` tự chuyển sang `https://`.
   - Lý do: trên `http` ứng dụng không mở được bài học (`crypto.randomUUID` chỉ có trên trang bảo mật), không cài app, không chạy offline. Kiểm thử trước đó chỉ bấm nút ở trang đăng nhập nên chưa thấy lỗi này.
2. Sau khi HTTPS chạy: đặt lại `ALLOWED_ORIGIN` = `https://aihoctap.online,https://mrbin2026dh-droid.github.io` (bỏ bản `http://`), `npx wrangler deploy`.
3. Kiểm thật trên HTTPS bằng tài khoản học sinh DEMO/giả (không dùng tài khoản học sinh thật): đăng nhập → mở 1 bài học → hỏi Gia sư 1 câu → mở tab Thi. Ghi kết quả.
4. Đẩy GitHub Pages bản mới (phần giới thiệu: bỏ nhãn GIÁO VIÊN, tiêu đề căn giữa, thêm thẻ "Thi thử và thi trên lớp", "Trò chơi câu hỏi trên lớp").

## Ngày 29/10 (thầy làm, Antigravity hỗ trợ)
1. Kiểm đề thi trong Google Sheet → bấm cập nhật lên Firebase → mở bài (trạng thái "mở") cho 9A10, 9A9.
2. Học sinh mở **https://aihoctap.online**, đăng nhập, làm bài.
3. Xong bài: **bật lại Bộ não** `systemctl enable --now brain.timer` và chạy ngay `sudo -u brain python3 -m brain run --env /opt/brain/.env` → kiểm `diag` (không lỗi khớp mã câu) → trang giáo viên → Hiệu quả → báo cáo.
4. Thầy chấm lại khoảng 10 bài tự luận để so với điểm AI (mục IV.5 báo cáo minh chứng).
5. Điền số liệu thật vào `docs/bao-cao-minh-chung-cuoc-thi-ai-2026.md` mục IV (Claude hỗ trợ khi có số liệu).
