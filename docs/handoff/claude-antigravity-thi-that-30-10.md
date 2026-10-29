# Claude → Antigravity: THI THẬT theo ca – deploy và thử thật có ảnh (30/10/2026)

Kế hoạch đã chốt: `docs/ke-hoach/thi-that.md` (bản 3). Mã đã viết xong, các test trên máy đều PASS. Antigravity làm: **deploy, cập nhật Apps Script, đăng luật, thử thật với lớp THỬ 9TH**, gửi bằng chứng.

## 0. Ràng buộc bắt buộc
- **Chỉ dùng lớp THỬ `9TH`** (tài khoản `[THỬ]`, mã `TH9001`…). KHÔNG đăng nhập tài khoản học sinh thật. Không ghi PIN, khóa bí mật hay tên học sinh thật vào repo, báo cáo hay chat.
- Không nhập mật khẩu vào trình duyệt thay thầy. Bước cần mật khẩu (Apps Script, Firebase Console): **dừng lại, nhờ thầy làm**, rồi chụp ảnh kết quả.
- Không tự sửa mã. Thấy lỗi thì ghi lại (bước tái hiện, mong đợi, thực tế, ảnh) và chuyển cho Claude.
- Mỗi kết luận phải có **ảnh chụp và phân tích ảnh** (ảnh cho thấy gì, khớp với bước nào). Không có ảnh coi như chưa làm.

## 1. Đã làm gì (để biết cần thử gì)
| Phần | Nội dung |
|---|---|
| Trạng thái từng em | `thi_tt/{bài}/{mã}` có 4 mức: Chưa mở thi (mặc định), Chưa thi, Đã thi, Thi lại. Giáo viên đổi qua Google Sheet; học sinh chỉ được đổi thành "Đã thi" **cùng lúc** nộp bài (luật Firebase kiểm) |
| Đề thi thật | `thi_de` không còn đáp án và gợi ý chấm. Gợi ý tự luận nằm ở `thi_goi_y` (khóa, chỉ Worker đọc). Google Sheet chấm trắc nghiệm khi kéo bài về |
| Đảo đề | Mỗi em có thứ tự câu và thứ tự đáp án riêng (theo mã em + lần thi). Thi lại thì ra thứ tự mới. Bài nộp kèm `thu_tu` để file minh chứng ghi đúng thứ tự em đã thấy |
| File minh chứng trên Drive | `Bài làm - Lần N.txt` trong thư mục của từng em: giờ vào, **giờ nộp (giờ:phút:giây ngày/tháng/năm, giờ Việt Nam)**, số lần rời màn hình, từng câu theo thứ tự em thấy (em chọn, đáp án đúng, đúng/sai), dòng đối chiếu với đề gốc, tự luận + gợi ý AI, file thực hành (kiểm file có thật trên Drive) |
| Học sinh | Thẻ bài thi thật có trạng thái; chỉ vào được khi Chưa thi/Thi lại. Đề Trắc nghiệm + Thực hành có 2 phần: Phần 1 Thực hành (nộp .docx/.xlsx/.pptx/.pdf), Phần 2 Trắc nghiệm. Thiếu câu hoặc chưa nộp thực hành thì không nộp được. Nộp xong chỉ thấy "Em đã nộp bài thành công" và giờ nộp, **không có điểm** |
| Giáo viên: Theo dõi ca thi | Chọn lớp → Mở thi cho lớp → xem tức thì: đã vào lúc, Trắc nghiệm x/y, thực hành đã nộp, đã nộp lúc. Em nộp → thông báo nổi + nút **Mở bài trên Drive**. Ghi chú vắng (Ốm, Có phép, Không phép, Khác), Cho thi lại (bắt buộc lý do), Mở cho em, Đóng thi lớp này, nhãn "Ngoài mạng trường", nút Lấy IP mạng trường |
| Thi lại | Sheet xóa file thực hành, tiến độ, giờ vào của lần trước trên Firebase (Drive vẫn giữ). Em phải nộp lại thực hành. Điểm lấy theo lần thi mới nhất; lần cũ đánh dấu Hủy ở trang KetQua |
| Lưu Drive nhanh | Trigger mỗi phút (chỉ chạy khi có ca đang mở) + giáo viên mở màn ca thi thì có em nộp là nhờ Sheet lưu ngay |
| Worker | `/api/thi/my-ip`, `/api/thi/ip` (chỉ lưu trong/ngoài trường + 2 số đầu IP); `/api/pwa/exam-essay` đọc gợi ý ở `thi_goi_y` khi chấm tự luận thi thật |

Tệp: `apps-script/sheet-exam/Code.gs`, `spike/step0/database.rules.ai-sgk-final.json`, `worker/index.js`, `frontend/hoc/{thi-app.js,app.js,styles.css,teacher-thi.js,teacher-ui.js,teacher.html,teacher.css,sw.js,whats-new.json}`, test mới `tests/test_ca_thi_ui.cjs`, `tests/test_worker_thi_ip.mjs`, `spike/step0/emulator/rules-thi-that.test.mjs`.

Test đã chạy PASS trên máy Claude: test_sheet_exam_gs, test_thi_firebase_ui (124), test_ca_thi_ui (68, khổ 1280 và 390), test_teacher_thi_ui (120), test_exam_teacher_monitor, test_thi_sheet_ui, test_thi_tuluan, test_worker_thi_ip, các test Worker (gate, tutor, teacher scope, student contract), chuẩn UI giáo viên và học sinh (0 vi phạm), cập nhật PWA (P1–P7).
**Chưa chạy được:** kiểm luật Firebase bằng emulator (máy Claude không tải được emulator). Antigravity phải chạy (bước 2).

## 2. Các bước làm (đúng thứ tự)
1. `git pull` lấy commit mới nhất trên `main`.
2. **Kiểm luật bằng emulator trước khi đăng:**
   `cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-that.test.mjs"`
   Phải ra `THI THAT RULES OK` (20 dòng PASS). Chạy thêm các file `*.test.mjs` khác trong thư mục đó để chắc luật cũ không hỏng. Dán nguyên văn kết quả vào báo cáo. Có dòng FAIL thì **dừng**, chuyển Claude.
3. Đăng luật `spike/step0/database.rules.ai-sgk-final.json` lên Firebase `ai-sgk-tinhoc` (nhờ thầy đăng nhập Console). Chụp ảnh trang Rules sau khi Publish.
4. Deploy Worker: `cd worker && npx wrangler deploy`. Thử `curl https://aihoctap-gate.mrbin2026dh.workers.dev/api/thi/my-ip -H "Origin: https://aihoctap.online"` → phải trả `{"ip":"…"}`. **Không dán IP đầy đủ vào báo cáo** (che 2 số cuối).
5. Apps Script: nhờ thầy dán `apps-script/sheet-exam/Code.gs` mới → Deploy → Manage deployments → **New version** (giữ nguyên URL). Rồi chạy menu Sheet **"Tự đẩy…"** (bật tự đẩy) để cài trigger mỗi phút; chụp ảnh trang Triggers có `keoBaiTuDong_`.
6. Deploy Pages (frontend/hoc). Mở https://aihoctap.online/teacher.html, kiểm tra tệp tải về có `?v=20261030a`.

## 3. Thử thật với lớp 9TH (chụp ảnh mỗi bước)
Chuẩn bị: thêm vào trang DeThi vài câu khối 9 (có cả câu TL nếu thử đề TN+TL). Tạo 2 bài thi thật cho **lớp 9TH**: (A) Trắc nghiệm + Thực hành; (B) Trắc nghiệm + Tự luận. Dùng 3 tài khoản THỬ trên 3 cửa sổ ẩn danh khác nhau (TH9001, TH9002, TH9003).

| # | Làm | Phải thấy (đối chiếu trong ảnh) |
|---|---|---|
| T1 | Mở Firebase `thi_de/{bài A}` | Không có `answer`, không có `goi_y` ở câu nào |
| T2 | Học sinh mở tab Thi khi chưa mở thi | Thẻ bài "Chưa mở thi", không có nút Vào thi |
| T3 | Giáo viên: Thi → bài A → Theo dõi ca thi → Lớp 9TH → Mở thi cho lớp | Hộp xác nhận nêu số em; sau đó mọi em "Chưa thi"; học sinh tự sang tab Thi, thấy nút Vào thi |
| T4 | 2 em vào bài A | Thứ tự câu **khác nhau** giữa 2 em; thứ tự A/B/C/D trong một câu khác nhau. Chụp 2 màn cạnh nhau, ghi câu nào khác |
| T5 | Màn giáo viên khi em đang làm | "Vào lúc hh:mm:ss", "Trắc nghiệm x/y" tăng dần khi em chọn, "Thực hành: chưa nộp" |
| T6 | Em làm đủ trắc nghiệm nhưng chưa nộp thực hành → Nộp bài | Hộp "Em chưa nộp bài thực hành" + nút tới Phần 1; Firebase không có bài nộp |
| T7 | Em nộp file .xlsx ở Phần 1 | "Đã nhận: tên file, dung lượng, lúc …"; giáo viên thấy "Thực hành: đã nộp ✓" |
| T8 | Em nộp bài | Học sinh: "Em đã nộp bài thành công", giờ nộp, **không có số điểm** ở mọi trang (Tổng quan, Bản đồ năng lực). Giáo viên: thông báo nổi "… đã nộp bài lúc hh:mm:ss" |
| T9 | Chờ ≤ 1 phút | Nút "Mở bài trên Drive" sáng; dòng "Bài làm ✓ · Thực hành ✓"; bấm mở đúng thư mục `Lớp 9TH / TH9001 - …` |
| T10 | Mở `Bài làm - Lần 1.txt` | Giờ nộp khớp giờ trên màn giáo viên (đến giây); câu theo đúng thứ tự em thấy ở T4; có dòng "(Đối chiếu đề gốc …)"; điểm trắc nghiệm đúng khi tự đếm lại. Chụp file và tự đếm |
| T11 | Em đã nộp thử vào lại | Thẻ "Đã thi", không vào được |
| T12 | Ghi chú vắng cho TH9003: chọn Khác, để trống → Lưu; rồi chọn Ốm → Lưu | Lần 1 báo "Ghi rõ lý do khác"; lần 2 lưu; trang `DiemDanhThi` trong Sheet có dòng; màn giáo viên hiện "Ốm" |
| T13 | Cho thi lại TH9001, lý do Máy hỏng | Em thấy "Vào thi lại"; thứ tự câu **khác** lần 1; phải nộp lại thực hành; nộp xong Drive có `Bài làm - Lần 2.txt`, KetQua lần 1 ghi Hủy; trang `NhatKyThi` có dòng |
| T14 | Lấy IP mạng trường trên máy giáo viên; 1 em dùng 4G điện thoại vào thi | Em dùng 4G có nhãn "Ngoài mạng trường"; em dùng mạng trường thì không |
| T15 | Đóng thi lớp này khi còn 1 em chưa nộp | Hộp xác nhận nêu số em; em đó về "Chưa mở thi"; Mở cho em → em vào làm tiếp được |
| T16 | Bài B (TN + TL) | Một trang; nộp xong KetQua có gợi ý AI cho câu tự luận; giáo viên duyệt điểm được |
| T17 | Thử phá: tài khoản đang "Chưa mở thi" gửi PATCH thẳng lên `thi_nop` bằng curl | Firebase trả `Permission denied` (dán nguyên văn) |
| T18 | Giao diện giáo viên ở 390 px và chế độ tối | Không tràn ngang, nút đủ to, chữ đọc được |

## 4. Báo cáo bắt buộc: `docs/handoff/antigravity-claude-thi-that-xong.md`
- Kết quả bước 2 (nguyên văn), 3–6 (ảnh).
- Bảng T1–T18: Đạt/Không đạt, ảnh, **phân tích ảnh** (ảnh cho thấy gì, khớp hay lệch với cột "Phải thấy").
- Danh sách lỗi (nếu có): bước tái hiện, mong đợi, thực tế, ảnh, nhật ký Console.
- Ảnh để ở `docs/handoff/anh/thi-that-30-10/`, ghi nhãn **"KIỂM THỬ – lớp 9TH, không phải học sinh thật"**.
- Cập nhật `aisgk.md`: thêm mục nhật ký và dòng "Yêu cầu mới nhất". Commit + push.

## 5. Dọn sau khi thử
Chỉ xóa dữ liệu của lớp 9TH và 2 bài thử: Firebase `thi_tt|thi_nop|thi_vao|thi_tien_do|thi_th|thi_drive|thi_ip/{bài thử}`; Sheet: dòng KetQua, DiemDanhThi, NhatKyThi của bài thử; thư mục Drive của bài thử. Ghi đường dẫn đã xóa vào báo cáo.
