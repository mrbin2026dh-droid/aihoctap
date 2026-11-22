# 08. Bảng ánh xạ trường ↔ tài liệu gốc (gói `ai9_bai2`, rev 1)

Sinh từ `data/phieu/ai9_bai2.json` ngày 22/11/2026. Nhãn lấy nguyên văn PL9.2.2/9.2.7 trừ các nhãn giao diện liệt kê ở cuối. `mode` trống = cá nhân. Giáo viên sửa được mọi nhãn; `id` không bao giờ đổi.

## hd1 · Tuyển dụng năm 2035 (tiết 1, 5 phút) · KHBD HĐ 1; PL9.2.1; PL9.2.2 dòng đầu

| id | loại | nhãn | YCCĐ | minh chứng | nhóm |
|---|---|---|---|---|---|
| `hd1_chon` | multi | Lúc đầu em chọn thẻ số |  | mốc (không xét đạt) |  |
| `hd1_vi` | textarea | vì |  | mốc (không xét đạt) |  |

## hd21 · Sáu tình huống, sáu năng lực (tiết 1, 16 phút) · KHBD HĐ 2.1; PL9.2.2 phần A; PL9.2.3; PL9.2.4

| id | loại | nhãn | YCCĐ | minh chứng | nhóm |
|---|---|---|---|---|---|
| `tnl_nang_luc` | choice | Thẻ năng lực của nhóm | 9.A3.1 | bổ trợ | nhóm |
| `tnl_vi` | textarea | Cần hơn khi có AI vì | 9.A3.1 | bổ trợ | nhóm |
| `tnl_voi_nguoi` | textarea | Với người | 9.A3.1 | bổ trợ | nhóm |
| `tnl_voi_ai` | textarea | Với AI | 9.A3.1 | bổ trợ | nhóm |
| `tnl_vi_du` | textarea | Ví dụ | 9.A3.1 | bổ trợ | nhóm |
| `a_t1_nl` | choice | Tình huống 1: Năng lực cần dùng | 9.A3.1 | tối thiểu |  |
| `a_t1_lam` | text | Tình huống 1: Em sẽ làm gì (một cụm từ) | 9.A3.1 | tối thiểu |  |
| `a_t1_em` | scale | Tình huống 1: Em tự chấm |  | tự đánh giá HS |  |
| `a_t2_nl` | choice | Tình huống 2: Năng lực cần dùng | 9.A3.1 | tối thiểu |  |
| `a_t2_lam` | text | Tình huống 2: Em sẽ làm gì (một cụm từ) | 9.A3.1 | tối thiểu |  |
| `a_t2_em` | scale | Tình huống 2: Em tự chấm |  | tự đánh giá HS |  |
| `a_t3_nl` | choice | Tình huống 3: Năng lực cần dùng | 9.A3.1 | tối thiểu |  |
| `a_t3_lam` | text | Tình huống 3: Em sẽ làm gì (một cụm từ) | 9.A3.1 | tối thiểu |  |
| `a_t3_em` | scale | Tình huống 3: Em tự chấm |  | tự đánh giá HS |  |
| `a_t4_nl` | choice | Tình huống 4: Năng lực cần dùng | 9.A3.1 | tối thiểu |  |
| `a_t4_lam` | text | Tình huống 4: Em sẽ làm gì (một cụm từ) | 9.A3.1 | tối thiểu |  |
| `a_t4_em` | scale | Tình huống 4: Em tự chấm |  | tự đánh giá HS |  |
| `a_t5_nl` | choice | Tình huống 5: Năng lực cần dùng | 9.A3.1 | tối thiểu |  |
| `a_t5_lam` | text | Tình huống 5: Em sẽ làm gì (một cụm từ) | 9.A3.1 | tối thiểu |  |
| `a_t5_em` | scale | Tình huống 5: Em tự chấm |  | tự đánh giá HS |  |
| `a_t6_nl` | choice | Tình huống 6: Năng lực cần dùng | 9.A3.1 | tối thiểu |  |
| `a_t6_lam` | text | Tình huống 6: Em sẽ làm gì (một cụm từ) | 9.A3.1 | tối thiểu |  |
| `a_t6_em` | scale | Tình huống 6: Em tự chấm |  | tự đánh giá HS |  |
| `a_manh_nl` | choice | Năng lực mạnh nhất của em | 9.A3.1 | tối thiểu |  |
| `a_manh_mc` | textarea | Minh chứng (việc em đã làm) | 9.A3.1 | bổ trợ |  |
| `a_manh_vi` | textarea | Vì sao năng lực này quan trọng khi có AI? | 9.A3.1 | tối thiểu |  |
| `a_yeu_nl` | choice | Năng lực yếu nhất của em | 9.A3.1 | tối thiểu |  |
| `a_yeu_mc` | textarea | Minh chứng (việc em đã làm) | 9.A3.1 | bổ trợ |  |
| `a_yeu_vi` | textarea | Vì sao năng lực này quan trọng khi có AI? | 9.A3.1 | tối thiểu |  |

## hd22 · Đặt mục tiêu học tập khi có AI (tiết 1, 24 phút) · KHBD HĐ 2.2; PL9.2.2 phần B; PL9.2.5

| id | loại | nhãn | YCCĐ | minh chứng | nhóm |
|---|---|---|---|---|---|
| `b_nhom1` | heading | Mục tiêu 1 (kĩ năng mềm) |  | tiêu đề |  |
| `b1_toi_se` | textarea | TÔI SẼ | 9.A3.2 | tối thiểu |  |
| `b1_bang_cach` | textarea | BẰNG CÁCH | 9.A3.2 | tối thiểu |  |
| `b1_truoc_ngay` | text | TRƯỚC NGÀY | 9.A3.2 | tối thiểu |  |
| `b1_biet_dat` | textarea | BIẾT MÌNH ĐẠT VÌ | 9.A3.2 | tối thiểu |  |
| `b_nhom2` | heading | Mục tiêu 2 |  | tiêu đề |  |
| `b2_huong` | choice | Mục tiêu 2, hướng | 9.A3.2 | tối thiểu |  |
| `b2_toi_se` | textarea | TÔI SẼ | 9.A3.2 | tối thiểu |  |
| `b2_bang_cach` | textarea | BẰNG CÁCH | 9.A3.2 | tối thiểu |  |
| `b2_truoc_ngay` | text | TRƯỚC NGÀY | 9.A3.2 | tối thiểu |  |
| `b2_biet_dat` | textarea | BIẾT MÌNH ĐẠT VÌ | 9.A3.2 | tối thiểu |  |
| `b2_khong_ai` | textarea | Nếu không dùng AI, em làm bằng cách | 9.A3.2 | tối thiểu |  |
| `tu_dg_1` | scale | 1. Em xác định được mục tiêu rõ ràng. |  | tự đánh giá HS |  |
| `tu_dg_3` | scale | 3. Em đã xem lại và sửa sản phẩm sau góp ý. |  | tự đánh giá HS |  |
| `tc_hoi_1` | textarea | 1. Mấy năm qua, công việc của người được hỏi thay đổi gì vì máy tính, điện thoại hay AI? |  | không chấm |  |
| `tc_hoi_2` | textarea | 2. Việc nào máy vẫn chưa làm được? |  | không chấm |  |
| `tc_hoi_3` | textarea | 3. Người được hỏi đã phải học thêm gì? |  | không chấm |  |

Góp ý của bạn (`peer_review`): ba câu kiểm và ô "Bạn góp ý" cho mỗi mục tiêu; minh chứng của **người góp ý**, không tính cho chủ phiếu; lưu bản chụp phần B trước góp ý (`truoc_gop_y`).

## hd23 · Một nghề đổi thay (tiết 2, 20 phút) · KHBD HĐ 2.3; PL9.2.6; PL9.2.7

| id | loại | nhãn | YCCĐ | minh chứng | nhóm |
|---|---|---|---|---|---|
| `n_nghe` | choice | Tên nghề | 9.A3.4 | bổ trợ | nhóm |
| `n_pc_c1` | members | Phân công: cột 1 | 9.A3.4 | đóng góp nhóm | nhóm |
| `n_pc_c2` | members | Phân công: cột 2 | 9.A3.4 | đóng góp nhóm | nhóm |
| `n_pc_c3` | members | Phân công: cột 3 | 9.A3.4 | đóng góp nhóm | nhóm |
| `n_pc_c4` | members | Phân công: cột 4 | 9.A3.4 | đóng góp nhóm | nhóm |
| `n_pc_phan_bien` | members | Phân công: người phản biện | 9.A3.4 | đóng góp nhóm | nhóm |
| `n_c1` | textarea | (1) Trước đây người làm việc này thế nào? | 9.A3.4 | bổ trợ | nhóm |
| `n_c2` | textarea | (2) Nay hoặc tới đây có AI, việc gì thay đổi? | 9.A3.4 | bổ trợ | nhóm |
| `n_c3` | textarea | (3) Việc gì vẫn cần người: quyết định, kiểm tra, giao tiếp, chịu trách nhiệm? | 9.A3.4 | bổ trợ | nhóm |
| `n_c4_tieu_de` | heading | (4) Hai kĩ năng nghề này cần trang bị (ít nhất một kĩ năng để làm việc cùng AI), vì… |  | tiêu đề | nhóm |
| `n_c4_kn1` | text | Cột 4, kĩ năng 1 | 9.A3.4 | bổ trợ | nhóm |
| `n_c4_vi1` | textarea | vì | 9.A3.4 | bổ trợ | nhóm |
| `n_c4_kn2` | text | Cột 4, kĩ năng 2 | 9.A3.4 | bổ trợ | nhóm |
| `n_c4_vi2` | textarea | vì | 9.A3.4 | bổ trợ | nhóm |
| `n_tram_1` | textarea | Câu hỏi của khách ở trạm: ① Việc gì trong nghề này đã thay đổi? | 9.A3.4 | bổ trợ | nhóm |
| `n_tram_2` | textarea | Câu hỏi của khách ở trạm: ② Nếu máy làm sai trong việc này thì ai phải phát hiện, ai quyết | 9.A3.4 | bổ trợ | nhóm |

## hd3 · Nghề em quan tâm (tiết 2, 6 phút) · KHBD HĐ 3; PL9.2.2 phần C

| id | loại | nhãn | YCCĐ | minh chứng | nhóm |
|---|---|---|---|---|---|
| `c_nghe` | text | Nghề em quan tâm | 9.A3.4 | tối thiểu |  |
| `c_truoc_day` | textarea | Một thay đổi AI có thể mang lại. Trước đây | 9.A3.4 | tối thiểu |  |
| `c_nay` | textarea | Nay hoặc tới đây | 9.A3.4 | tối thiểu |  |
| `c_kn1` | text | Kĩ năng 1 | 9.A3.4 | tối thiểu |  |
| `c_vi1` | textarea | vì | 9.A3.4 | tối thiểu |  |
| `c_kn2` | text | Kĩ năng 2 | 9.A3.4 | tối thiểu |  |
| `c_vi2` | textarea | vì | 9.A3.4 | tối thiểu |  |

## hd4 · AI giúp em thể hiện mình (tiết 2, 19 phút) · KHBD HĐ 4; PL9.2.2 phần D; PL9.2.8

| id | loại | nhãn | YCCĐ | minh chứng | nhóm |
|---|---|---|---|---|---|
| `d_vd2_hoi_lai` | textarea | Ở ví dụ 2, chỗ nào trong gợi ý của AI cần hỏi lại? |  | không chấm |  |
| `d_thich_ai` | textarea | Em thích… AI có thể giúp em… (khâu nào) | 9.A3.3 | tối thiểu |  |
| `d_di_tiep` | textarea | Nhờ vậy em đi tiếp sở thích này bằng cách | 9.A3.3 | tối thiểu |  |
| `d_tu_lam` | textarea | Phần em tự làm, vì đó là cái của riêng em | 9.A3.3 | tối thiểu |  |
| `d_kiem_tra` | textarea | Khi AI giúp, em cần kiểm tra lại | 9.A3.1 | bổ trợ |  |
| `nl_giu_doi` | choice | Nhìn lại lựa chọn đầu giờ: Bây giờ em | 9.A3.1 | bổ trợ |  |
| `nl_chon_moi` | multi | Các thẻ em chọn bây giờ | 9.A3.1 | bổ trợ |  |
| `nl_vi` | textarea | vì | 9.A3.1 | bổ trợ |  |
| `tu_dg_2` | scale | 2. Em giải thích được lựa chọn nghề, kĩ năng của mình. |  | tự đánh giá HS |  |
| `tu_dg_4` | scale | 4. Em tách được phần AI giúp và phần của riêng em. |  | tự đánh giá HS |  |
| `muc_dung_ai` | choice | Mức dùng AI khi làm phiếu này |  | không chấm |  |

## Học liệu (`blocks`)

| id | nguồn | hiển thị |
|---|---|---|
| `pl921` | PL9.2.1 | luôn hiện |
| `pl923` | PL9.2.3 | luôn hiện |
| `pl924` | PL9.2.4 | luôn hiện |
| `pl925` | PL9.2.5 | GV mở |
| `pl926` | PL9.2.6 | luôn hiện |
| `pl928_1` | PL9.2.8 | luôn hiện |
| `pl928_2` | PL9.2.8 | hiện sau khi trả lời `d_vd2_hoi_lai` hoặc GV mở |

## Không có trong gói học sinh (ở `ai9_bai2.dapan.json`, không commit)
- PL9.2.9 mục 1–7 (đáp án, ví dụ đạt, mức Khá/Tốt, mẫu nhận xét); câu bẫy PL9.2.5; PL9.2.10; ma trận IV.1; rubric IV.2–IV.3.
- Mỗi hoạt động: mục tiêu (a), sản phẩm và kiến thức chốt (c), điểm kiểm soát AI và an toàn dữ liệu (e), câu hỏi (2) HĐ 2.3 về số liệu 170/92/78 triệu (vì số liệu chỉ GV nêu ở B4).

## Nội dung không nguyên văn (Claude đặt, GV duyệt/sửa được)
- Nhiệm vụ ngắn HĐ 1, HĐ 2.1, HĐ 4 (tóm từ mục b KHBD). Các HĐ còn lại dùng nguyên câu trên phiếu.
- Nhãn giao diện: tiêu đề bài viết thường, "Chốt lựa chọn đầu giờ", "Thẻ năng lực của nhóm", "Năng lực mạnh/yếu nhất của em", "Phân công: cột 2/3/4/người phản biện", "Cột 4, kĩ năng 1/2", "Nhìn lại lựa chọn đầu giờ: Bây giờ em", "Các thẻ em chọn bây giờ", tiêu đề trang 1/2 ví dụ mẫu, khuôn thẻ nghề địa phương (từ hướng dẫn PL9.2.6), "Chưa thấy minh chứng".
- Lưu ý riêng tư (`nguon: de_xuat`): HĐ 2.3 và ba câu tùy chọn hỏi người lớn, rút từ mục e KHBD.

## Kiểm tự động (22/11/2026, Claude chạy)
- Mọi chuỗi > 12 ký tự còn lại có nguyên văn trong văn bản trích từ hai docx: PASS.
- Gói HS không chứa chuỗi đặc trưng đáp án (Ngô Quyền, thẻ 1–6, câu bẫy, 170/92 triệu, mức Đạt/Khá/Tốt…): PASS.
- `id` trường không trùng; mỗi YCCĐ có trường minh chứng tối thiểu cá nhân; khối được tham chiếu đều tồn tại; `ai_tutor:false`: PASS.
- Ca đối chứng (chèn nhãn bịa + chèn "Ngô Quyền"): trình kiểm báo FAIL 3 lỗi đúng như mong đợi.
- Trình kiểm hiện ở thư mục tạm của Claude; Antigravity đưa thành `tests/test_phieu_core.mjs` ca C1–C2 (xem bàn giao).
