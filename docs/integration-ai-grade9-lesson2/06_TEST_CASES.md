# 06. Ca kiểm thử

Tình trạng 22/11/2026: **chưa chạy ca nào**, vì chưa có mã. Mọi ca phải viết theo FAIL-first (test đỏ trước khi viết mã). Dữ liệu thử dùng tên "[THỬ] Học sinh 1", lớp `9THU`.

## A. Hàm thuần `tests/test_phieu_core.mjs`
| # | Đầu vào | Mong đợi |
|---|---|---|
| C1 | Gói `ai9_bai2.json` | `validatePack` hợp lệ; đủ 6 hoạt động `hd1, hd21, hd22, hd23, hd3, hd4`; mỗi YCCĐ có ≥1 trường `toi_thieu` |
| C2 | Gói học sinh | Không chứa chuỗi đặc trưng của đáp án (ví dụ "Ngô Quyền", "thẻ 1–6"). Quét tự động |
| C3 | `checkDraft(pack, {khong_co: 'x'})` | Lỗi `FIELD_UNKNOWN` |
| C4 | Chuỗi 2.001 ký tự vào trường `max:2000` | Lỗi `FIELD_TOO_LONG` |
| C5 | `hd1_chon` có 4 lựa chọn | Lỗi `EXACT_3` |
| C6 | `csvSafe('=SUM(A1)')`, `'+1'`, `'-2'`, `'@x'` | Có `'` ở đầu; `'Bình thường'` giữ nguyên; dấu `"` được nhân đôi |
| C7 | `groupByYccd(pack)` | Trường `mode:nhom` nằm ở nhóm `bo_tro`, không ở `toi_thieu` của 9.A3.4 |

## B. Worker `tests/test_phieu_worker.mjs` (kiểu `test_accounts.mjs`, RTDB giả)
| # | Kịch bản | Mong đợi |
|---|---|---|
| W1 | GET không token | 401 |
| W2 | Học sinh lớp 8 mở gói lớp 9 | 403 `GRADE_MISMATCH` |
| W3 | Học sinh A lưu nháp | 200, dữ liệu ở `phieu_bai/ai9_bai2/9thu/{uidA}`; `name`, `class_code` lấy từ token dù body gửi tên khác |
| W4 | Body chứa `uid` của B | Bị bỏ qua, chỉ ghi vào A |
| W5 | Học sinh B GET | Không thấy bài A |
| W6 | Khóa `chot_dau_gio` rồi sửa `hd1_chon` | 409 `FIELD_LOCKED`, dữ liệu cũ giữ nguyên |
| W7 | Nộp | `status=submitted`, có `phieu_ls/{uid}/1` |
| W8 | Sửa nháp sau khi nộp (chưa trả bài) | 409 `NOT_EDITABLE` |
| W9 | GV trả bài → HS sửa → nộp lại | `phieu_ls/…/2` có, `…/1` **không đổi** (so chuỗi JSON) |
| W10 | Gửi `rev` cũ | 409 `REV_CONFLICT` |
| W11 | GV lớp `9A` (scope class) xem `?lop=9THU` | 403 |
| W12 | GV quản trị xem lớp `9THU` | 200, danh sách không có trường `answers` (chỉ gọn) |
| W13 | GV ghi mức `"9.A3.1":"10"` | 400 (chỉ nhận `chua_thay/dat/kha/tot`) |
| W14 | Token học sinh gọi route giáo viên | 403 |
| W15 | Học sinh không thuộc nhóm 3 sửa phiếu nhóm 3 | 403 |
| W16 | Thành viên sửa cột 2 nhóm | `phieu_nhom_ls` ghi `uid`, `fields:['c2']` |
| W17 | HS góp ý chính mình | 400 `SELF_PEER` |
| W18 | HS góp ý bạn khác lớp | 403 |
| W19 | Route học sinh | Không bao giờ trả `phieu_dapan` (quét body) |
| W20 | 61 lần ghi trong 1 phút | 429 |
| W21 | Các route cũ (`/api/login`, `/api/pwa/attempts`, `/api/pwa/change-pin`) | Bộ test hiện có vẫn xanh |

## C. Giao diện `tests/test_phieu_ui.cjs` (Playwright, kiểm DOM thật)
| # | Kịch bản | Mong đợi |
|---|---|---|
| U1 | Đăng nhập HS lớp 9, danh mục | Thấy thẻ "Phiếu học tập"; HS lớp 6 không thấy |
| U2 | API phiếu trả 404 (Worker cũ) | Không có thẻ, không lỗi bảng điều khiển |
| U3 | Hoàn thành từng hoạt động 1–6 | Lưu được; thanh tiến độ phần đã điền |
| U4 | Chọn thẻ thứ 4 ở HĐ 1 | Thông báo dưới trường (`aria-invalid`), không `alert` |
| U5 | Tắt mạng, gõ, tải lại trang | Nháp còn; bật mạng thì gửi; nhãn "Đang lưu…" có `aria-busy` |
| U6 | HĐ 4 trước khi trả lời ví dụ 2 | Không thấy phần của Tuấn; trả lời xong thì hiện |
| U7 | Nộp bài | Hộp thoại `<dialog>` xác nhận; Hủy/Esc không gửi; bấm "Nộp bài" chỉ gửi một lần |
| U8 | GV mở bài | Bản trước/sau phần B đặt cạnh nhau; góp ý ghi "của bạn …" |
| U9 | GV trả bài | Hộp thoại nêu tên HS, hành động, hậu quả (mục J) |
| U10 | GV xuất CSV | Tệp có BOM, cột: Mã HS, Họ tên, Lớp, Nhóm, Trạng thái, 4 YCCĐ, Phần còn thiếu, Hỗ trợ, Lần nộp; ô bắt đầu `=` được vô hiệu |
| U11 | Câu trả lời chứa `<img src=x onerror=…>` | Hiện thành chữ, không chạy |
| U12 | Màn 375px | Không tràn ngang; mục tiêu chạm ≥ 48px; ô nhập 16px |
| U13 | Câu mẫu dấu (ế ề ể ễ ệ … ữ ự) | Đúng phông; `test_fonts_vietnamese.cjs` xanh |
| U14 | Đăng xuất HS | Khóa `phieu:` trong IndexedDB bị xóa; `test_role_isolation.cjs` xanh |
| U15 | Trong phiếu | Không có nút Gia sư AI |

## D. Smoke test trên bản thật (sau deploy thử, dữ liệu "[THỬ]")
1. HS thử đăng nhập → mở phiếu → làm 6 hoạt động → nộp.
2. GV lớp đúng thấy bài; GV lớp khác không thấy.
3. GV trả bài → HS sửa → nộp lại → GV thấy hai bản.
4. Hai HS cùng nhóm sửa phiếu số 2 → GV thấy ai sửa ô nào.
5. Xuất CSV, mở bằng Excel, kiểm chữ Việt và ô công thức.
6. Bộ test cũ chạy lại toàn bộ.

Sai một mục thì quay lui theo 07 và báo Claude.
