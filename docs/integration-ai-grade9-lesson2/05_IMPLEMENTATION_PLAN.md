# 05. Kế hoạch triển khai

Theo AGENTS.md: ChatGPT soạn **gói nội dung**; Antigravity viết **mã và test**; Claude **kiểm định và ACCEPT** từng giai đoạn; người dùng commit/deploy sau ACCEPT. Mỗi giai đoạn phát hành riêng (mục G), chỉ dữ liệu "[THỬ]".

## Tệp cần thêm
| Tệp | Nội dung |
|---|---|
| `data/phieu/ai9_bai2.json` | Gói phiếu cho học sinh (ChatGPT soạn từ PL9.2.1–9.2.8, giữ nguyên văn) |
| `data/phieu/ai9_bai2.dapan.json` | Đáp án/tiêu chí GV (PL9.2.9). **Không commit lên repo công khai**: đưa vào `.gitignore`, nạp bằng công cụ |
| `frontend/hoc/phieu-core.js` | Hàm thuần: kiểm lược đồ gói, kiểm trường, `csvSafe`, nhóm trường theo YCCĐ (dùng chung Worker/giao diện/test) |
| `frontend/hoc/phieu.js` | Màn học sinh |
| `frontend/hoc/teacher-phieu.js` | Màn giáo viên |
| `tools/upload_phieu_pack.py` | Nạp gói vào `phieu_bo`, `phieu_dapan` (dùng tài khoản dịch vụ ở máy GV, như `upload_private_packages.py`) |
| `tests/test_phieu_worker.mjs` | Test route, quyền, khóa, bản chụp |
| `tests/test_phieu_core.mjs` | Test hàm thuần |
| `tests/test_phieu_ui.cjs` | Test DOM (Playwright) học sinh + giáo viên |

## Tệp cần sửa (chỉ thêm, không đổi hành vi cũ)
| Tệp | Thay đổi |
|---|---|
| `worker/index.js` | Thêm khối route `phieu` (đặt trước nhánh 404 cuối), hàm `phieuValidate` dùng `phieu-core` (hoặc bản sao nếu Worker không import được từ `frontend/`) |
| `frontend/hoc/app.js` | Thẻ "Phiếu học tập" trên danh mục khi `GET /api/pwa/phieu?grade=` trả danh sách khác rỗng; `import('./phieu.js')` khi bấm |
| `frontend/hoc/index.html` | Vùng chứa `#phieu-view` (ẩn mặc định) |
| `frontend/hoc/teacher.html`, `teacher.js` | Thẻ con "Phiếu học tập" trong mục Hiệu quả; import động `teacher-phieu.js` |
| `frontend/hoc/styles.css` | Lớp CSS cho phiếu (biến màu sẵn có, không style nội tuyến) |
| `frontend/hoc/sw.js` | Thêm tệp mới vào danh sách đóng gói, đóng dấu lại (`--stamp`, `--check`) |
| `.gitignore` | `data/phieu/*.dapan.json` |

## Thứ tự triển khai
| GĐ | Việc | Người | Xong khi |
|---|---|---|---|
| 0 | Giáo viên trả lời các câu hỏi xác nhận (07, cuối tệp) | Người dùng | Có câu trả lời ghi vào handoff |
| 1 | Gói nội dung JSON theo lược đồ 03; bảng đối chiếu từng trường ↔ phụ lục | ChatGPT | Claude kiểm khớp nguyên văn (so tự động với văn bản trích docx) |
| 2 | `phieu-core.js` + Worker route học sinh (GET, draft, lock, submit) + test FAIL-first | Antigravity | `test_phieu_core`, `test_phieu_worker` xanh; Claude ACCEPT (MOCK) |
| 3 | Màn học sinh `phieu.js` (6 hoạt động, nháp ngoại tuyến, nộp, mở trang 2 ví dụ 2) | Antigravity | Test DOM xanh, mục I (kiểm trường, đang tải, `<dialog>`), câu mẫu kiểm dấu tiếng Việt |
| 4 | Route + màn giáo viên: danh sách lớp, xem bài, so sánh bản trước/sau, nhận xét 4 YCCĐ, trả bài, CSV | Antigravity | Test quyền lớp chéo 403; CSV có `csvSafe` |
| 5 | Nhóm (phiếu số 2, thẻ năng lực, phân công, trạm), góp ý của bạn, quan sát nhóm | Antigravity | Test đóng góp từng thành viên; góp ý không tính cho chủ phiếu |
| 6 | Deploy thử Worker + trang (dữ liệu "[THỬ]"), smoke test thật, lưu ID bản để quay lui | Antigravity → người dùng | Claude ACCEPT đợt thật mới dùng với học sinh thật |
| 7 (bắt buộc trước khi dùng thật) | Trình soạn gói trong trang GV: sửa **mọi** nội dung (học liệu, hoạt động, trường, lựa chọn, YCCĐ, đáp án), bản gốc bất biến + khôi phục, đánh dấu mục đã sửa, `id` trường ổn định, tạo gói mới cho bài khác (xem 03, mục "Tính mở") | Antigravity | GV sửa nhãn một trường khi HS đã có nháp: nháp còn nguyên; ẩn trường: câu trả lời cũ vẫn xuất CSV; thêm thử gói Bài 1 lớp 9 bằng giao diện, không đổi mã |

## Rủi ro và khắc phục
| Rủi ro | Khắc phục |
|---|---|
| Bản PWA cũ trên máy học sinh | Không đổi `catalog`, không đổi store IndexedDB; route mới chỉ thêm; thẻ "Phiếu học tập" ẩn khi API 404 |
| `worker/index.js` quá lớn, xung đột khi sửa | Đặt khối route trong hàm riêng `handlePhieu(request, env, ctx)`; chỉ một dòng gọi trong `fetch` |
| Trùng tên | Tiền tố `phieu` cho route, nhánh, tệp, biến CSS (`.phieu-*`); đã kiểm, hiện chưa có tên nào dùng `phieu` |
| Hai máy sửa cùng bài/nhóm | `rev` + 409 + hộp thoại chọn bản |
| Ghi đè lịch sử | Worker kiểm `phieu_ls/{rev}` chưa tồn tại trước khi ghi |
| Mất mạng trong giờ | Nháp lưu IndexedDB; hàng đợi gửi lại như `outbox` hiện có |
| Bảng nhóm nhiều người sửa cùng lúc | Khóa mềm theo ô; lưu theo trường (PATCH), không ghi đè cả phiếu |
| Lộ đáp án qua repo công khai | Tệp đáp án không vào Git; gói học sinh không chứa đáp án; test quét gói |
| Thầy chốt thay hẳn phiếu giấy, nên mọi HS cần máy và mạng trong giờ | Nháp ngoại tuyến tự gửi lại; GV nhập hộ khi máy hỏng (đánh dấu "GV nhập hộ"); ô ghi nhận trình bày miệng; kiểm tra thiết bị trước tiết |

## Tiêu chí nghiệm thu theo bốn YCCĐ
| YCCĐ | Hệ thống phải cho giáo viên thấy đủ để kết luận |
|---|---|
| 9.A3.1 | Phần A: 6 tình huống (năng lực + việc sẽ làm), mạnh/yếu nhất (minh chứng + vì sao). Bổ trợ: thẻ năng lực nhóm, dòng 4 phần D, dòng nhìn lại kèm lựa chọn đầu giờ đã khóa. Tự chấm ●◐○ ghi rõ "nhận định HS" |
| 9.A3.2 | Phần B **bản trước và bản sau góp ý** đặt cạnh nhau; hướng mục tiêu 2; dòng "Nếu không dùng AI"; góp ý của bạn (ghi là của bạn) |
| 9.A3.3 | Phần D dòng 1–3. Bổ trợ: dòng 4 |
| 9.A3.4 | Phần C (cá nhân, chính). Bổ trợ: phiếu số 2 của nhóm, phân công, câu trả lời ở trạm, quan sát nhóm |
| Chung | Mức chỉ do GV chọn; không có điểm số tự động; dòng mức dùng AI không ảnh hưởng; có ô ghi nhận trình bày miệng; CSV theo lớp có 4 cột YCCĐ + phần thiếu + hỗ trợ |
