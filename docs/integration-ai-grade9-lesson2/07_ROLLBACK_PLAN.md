# 07. Sao lưu và quay lui

## Nguyên tắc
- Mọi thay đổi chỉ **thêm**: nhánh RTDB mới, route mới, tệp mới. Không đổi dữ liệu, luật hay route cũ, nên quay lui không làm mất bài cũ.
- Không sửa trực tiếp dữ liệu production bằng tay. Nạp gói qua `tools/upload_phieu_pack.py`, có chế độ `--dry-run`.

## Trước mỗi lần deploy
1. Test xanh toàn bộ (mới và cũ); quét bí mật rỗng.
2. Ghi ID bản Worker đang chạy:
   ```bash
   npx wrangler deployments list
   ```
3. Ghi commit giao diện đang chạy (GitHub Pages): `git rev-parse HEAD`.
4. Xuất bản sao RTDB các nhánh `phieu_*` (nếu đã có dữ liệu) ra tệp JSON ở máy GV, không đưa lên Git.
5. Đóng dấu và kiểm `sw.js`:
   ```bash
   python tools/package_student_pwa.py --stamp
   ```
   ```bash
   python tools/package_student_pwa.py --check
   ```

## Công tắc tắt nhanh (không cần deploy lại mã)
- Biến `PHIEU_ENABLED = "0"` trong `[vars]` của `wrangler.toml`: Worker trả 404 cho mọi route `phieu`. Giao diện thấy 404 thì ẩn thẻ "Phiếu học tập". Bật lại bằng `"1"`.
- Gói đơn lẻ: đặt `phieu_bo/{packId}/an = true` để ẩn một bài mà không xóa dữ liệu.

## Quay lui
| Sự cố | Cách làm |
|---|---|
| Worker lỗi sau deploy | `npx wrangler rollback <ID đã ghi>` |
| Giao diện lỗi | `git revert <commit>` rồi đẩy (Antigravity làm, người dùng duyệt); học sinh nhận bản cũ qua cơ chế cập nhật PWA (mục L) |
| Dữ liệu phiếu sai do lỗi mã | Không xóa; dừng bằng công tắc; khôi phục bài từ `phieu_ls` (bản chụp bất biến) bằng công cụ có `--dry-run` |
| Lộ dữ liệu (nghi ngờ) | Tắt công tắc ngay; báo Claude kiểm; không deploy lại cho tới khi có ACCEPT |

## Danh sách giáo viên cần xác nhận trước khi dùng chính thức
1. Dùng phân hệ như **phương án tùy chọn** bên cạnh phiếu giấy (giáo án ghi HS không cần thiết bị)? Học sinh không có máy thì giáo viên nhập hộ hay chỉ lưu phiếu giấy?
2. ĐÃ CHỐT 22/11/2026: thêm mục "Học AI" ở cả trang học sinh và giáo viên. "Tài liệu" gộp vào trang "Học" (thẻ con) để thanh dưới điện thoại giữ 5 mục.
3. Thang mức GV: "Chưa thấy minh chứng / Đạt / Khá / Tốt" có đúng ý thầy không?
4. Góp ý của bạn (phần B): bạn góp ý ngay trên máy chủ phiếu (ghi tên người góp ý) hay mỗi em góp ý trên máy mình bằng cách chọn bạn cùng lớp?
5. Số nhóm: giáo viên đặt sẵn 8 nhóm/lớp và gán học sinh, hay học sinh tự chọn số nhóm?
6. Thẻ nghề địa phương (nhóm 7, 8): thầy có muốn tự viết trong trang giáo viên không?
7. Trang 2 của ví dụ mẫu PL9.2.8: tự mở sau khi học sinh trả lời, hay giáo viên bấm mở cho cả lớp?
8. Chính tả: giữ "kĩ" như tài liệu gốc trong nội dung học liệu?
9. Thời hạn lưu dữ liệu bài làm (đề xuất: hết năm học, xuất CSV rồi xóa theo lớp)?
10. Có cần xuất Excel `.xlsx` không, hay CSV mở bằng Excel là đủ?
11. Có làm luôn dạng dữ liệu dùng chung cho Bài 1, 3–8 lớp 9 và lớp 6–8 (đề xuất), hay chỉ Bài 2 trước?
12. Thiếu phụ lục chung PLC.1–PLC.8 (rubric chung, phiếu quan sát nhóm, mẫu khai báo dùng AI): thầy gửi để đối chiếu không?

**Đã chốt toàn bộ 12 câu ngày 22/11/2026**: xem mục "Câu trả lời của giáo viên" trong `docs/handoff/claude-chatgpt-goi-phieu-ai9-bai2.md`.
