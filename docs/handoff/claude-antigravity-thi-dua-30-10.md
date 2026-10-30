# Claude → Antigravity: Bảng thi đua Luyện tập theo tháng – đăng luật, deploy, thử thật (30/10/2026 chiều)

Kế hoạch: `docs/ke-hoach/quan-ly-luyen-tap-thi-dua.md`. Thầy chốt: theo **tháng**, **trung bình các buổi cao nhất**, học sinh thấy **top 10 và hạng của mình**, **Thảo luận không tính**.

## 1. Đã làm (Claude)
| Phần | Nội dung |
|---|---|
| `thidua-core.js` (mới, dùng chung cho giáo viên và học sinh) | Điểm buổi = số câu đúng ÷ số câu × 10, **không tính tốc độ**. Điểm tháng = trung bình N buổi cao nhất, N = 60% số buổi của lớp trong tháng (làm tròn lên, ≥ 1). Tham gia < N buổi thì chưa xếp hạng. Bằng điểm: xét số buổi, rồi số câu đúng; vẫn bằng thì cùng hạng (1, 1, 3). Tính bằng **phân số BigInt**, chỉ làm tròn khi hiển thị (2 chữ số, làm tròn nửa lên). Tháng theo giờ Việt Nam. Danh hiệu: Chăm chỉ nhất (nhiều buổi nhất, chỉ khi ≤ 3 em đạt), Tiến bộ nhất (buổi cuối hơn buổi đầu nhiều nhất) |
| Giáo viên kết thúc buổi Luyện tập (`teacher-quiz.js` `saveThiDua`) | Ghi `quiz_kq_lop/{lớp}/{tháng}/{phòng} = {at, bo, so_cau, kq:{mã:{c, ten}}}` theo **đúng lớp của từng em** (lớp gửi kèm khi em vào phòng; thiếu thì tra `thi_hs`). Ghi lịch sử `quiz_ls/{mã riêng giáo viên}/{phòng}` kèm khóa phòng. Ghi **sau** khi đã kết thúc phòng: lỗi ở đây không làm kẹt học sinh; thử lại 3 lần, lỗi thì báo |
| Tab **Thi đua** (`teacher-thidua.js`, `teacher.html` `#tools-p-td`) | Chọn lớp và tháng (6 tháng gần nhất). Chỉ số: số buổi, số buổi được tính, số em được xếp hạng, điểm TB lớp. Bảng xếp hạng có huy hiệu top 3 và điểm từng buổi (✓ = được tính). Danh sách em chưa đủ buổi, danh sách các buổi. **Tải Excel (CSV)** có cách tính và thời điểm xuất. **Chốt tháng** (lưu bản chốt kèm thời điểm, báo nếu dữ liệu đổi sau khi chốt). **Bỏ buổi khỏi thi đua** (có xác nhận, chỉ với buổi tài khoản này mở) |
| Học sinh (`thidua-play.js`, mục Luyện tập) | Thẻ Bảng thi đua: Tháng này / Tháng trước. Thẻ của em: hạng, điểm, số buổi, câu đúng, và "còn x điểm nữa vào top 10" hoặc "tham gia thêm x buổi". Bục top 3 và danh sách hạng 4–10 (tên rút gọn "Nguyễn V. An"). Danh hiệu. Phần "Cách tính" mở ra xem được |
| Luật Firebase | `quiz_kq_lop`: đọc công khai. Chỉ ghi được khi có khóa phòng (`quiz_key` + `quiz_proof` đổi), **ghi một lần** (xóa được, không sửa được). Số câu đúng ≤ số câu; tháng đúng dạng; không có trường lạ. `quiz_ls`: nhánh riêng của giáo viên (đường dẫn 64 ký tự, không liệt kê được) |

**Lưu ý trung thực:** học sinh không đăng nhập Firebase (chỉ có mã + PIN), nên luật không chặn được việc đọc kỹ thuật toàn bộ `quiz_kq_lop` của lớp. Tình trạng này giống `quiz/{phòng}/kq` hiện có. Giao diện chỉ hiện top 10 và hạng của em. Mức dữ liệu: điểm luyện tập, không phải điểm thi.

Test PASS (đã chạy):
- `test_thidua_core.mjs` 20: ví dụ tính tay, phân số lẻ, bằng điểm, tháng qua nửa đêm, 60% của 45 = 27.
- `test_thidua_ui.cjs` 26: 15 em × 5 buổi; em hạng 13 thấy khoảng cách tới top 10 và không thấy tên các bạn hạng 11–14; em 1 buổi "cần thêm 2 buổi"; giáo viên đủ 14 em đúng thứ tự; 390 px và chế độ tối.
- `test_quiz_live.cjs` 67: kết thúc buổi thật → lưu đúng lớp 9A/9B; tab Thi đua; CSV; chốt; bỏ buổi có xác nhận; thẻ học sinh.
- `test_live_room.mjs`, `test_tl_live.cjs` 61, `test_teacher_thi_ui` 120, `test_teacher_overview`, chuẩn UI học sinh và giáo viên 0 vi phạm, PWA P1–P7.

**Chưa chạy:** `spike/step0/emulator/rules-thidua.test.mjs` (máy Claude không tải được emulator).

## 2. Việc của Antigravity
1. `git pull`.
2. Chạy emulator luật (bắt buộc trước khi đăng):
   `cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thidua.test.mjs"`
   Kết quả phải là `THI DUA RULES OK`. Chạy lại cả `rules-thi-that.test.mjs` và các file test luật cũ. Dán nguyên văn kết quả. Có dòng FAIL thì dừng, báo Claude.
3. Đăng luật lên Firebase (thầy đăng nhập Console). Chụp ảnh sau khi Publish.
4. Deploy Pages (có cả Worker nếu chưa deploy bản trước). Kiểm tệp tải về có `?v=20261030c`.
5. **Thử trên bản thật**, lớp 9TH, tài khoản THỬ. Thầy đăng nhập giáo viên; không gõ mật khẩu hộ.
   - Tạo bộ 4 câu cho 9TH, mở Luyện tập. 3 em vào (TH9001 trả lời đúng hết, TH9002 đúng 2, TH9003 đúng 0), chạy đến hết, bấm Kết thúc.
   - Firebase: `quiz_kq_lop/9th/<tháng>/<phòng>` có 3 em với `c` = 4, 2, 0 và `so_cau` = 4. Chụp ảnh.
   - Tab Thi đua lớp 9TH: TH9001 10,00 hạng 1; TH9002 5,00; TH9003 0,00. Tải CSV, mở bằng Excel, chụp.
   - Mở thêm buổi thứ 2 với 2 em (TH9001, TH9002). Bảng phải ghi "Buổi được tính 2/2". TH9003 nằm ở "Chưa đủ buổi" (1/2, cần thêm 1).
   - Học sinh TH9003 mở mục Luyện tập: thẻ Bảng thi đua ghi "Tham gia thêm 1 buổi để được xếp hạng". TH9001 thấy hạng 1. Chụp ở khổ điện thoại.
   - Chốt tháng → thấy "Đã chốt lúc …". Bỏ buổi 2 (có hộp xác nhận) → bảng tính lại.
6. Báo cáo `docs/handoff/antigravity-claude-thi-dua-xong.md`: ghi rõ phần nào **trên bản thật**, phần nào **giả lập**; mỗi ảnh có phân tích ảnh. Commit, push, cập nhật `aisgk.md`. **Không sửa mã nguồn**; thấy lỗi thì báo Claude.
