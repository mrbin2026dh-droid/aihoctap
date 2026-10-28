# Rà soát tính năng AI Học Tập trước hạn nộp (28/10/2026, Claude)

Mức xác minh:
- **KT** = có mã + kiểm thử tự động đạt (Claude chạy, dữ liệu mô phỏng / AI giả lập).
- **THẬT** = đã chạy trên hệ thống thật theo báo cáo của Antigravity / thầy (Claude chưa tự chạy thật).
- **CHƯA** = chưa có hoặc chưa kiểm chứng.

## Học sinh
| Tính năng | Mức | Ghi chú |
|---|---|---|
| Đăng nhập mã + PIN (đường nhanh Firebase, dự phòng Worker) | KT + THẬT | `test_login_gate` 7 ca |
| Học lý thuyết, % đã đọc, Bản đồ năng lực | KT | `test_lesson_ai_docs_ui` 51 ca |
| Bài luyện tập chấm ở máy chủ (không lộ đáp án) | KT | |
| Gia sư AI hỏi gợi mở, không đưa đáp án, giới hạn lượt | KT + THẬT | thử đối kháng ghi ở REQUIREMENTS (A7); Gia sư biết hiểu lầm riêng: 16 ca |
| Thi thử (làm nhiều lần) + thi thật trên lớp (mỗi em 1 lần, theo dõi rời màn hình, xếp hạng khi bật "Cho xem điểm") | KT | `test_teacher_thi_ui` 136, `test_exam_*` |
| Trắc nghiệm + Tự luận gõ trên dòng chấm, AI chấm theo gợi ý | KT | `test_thi_tuluan` 68, `test_essay_ai` 17 |
| AI nhận xét sau bài thi (không nêu đáp án) | KT | chế độ `exam_review` |
| Trò chơi câu hỏi trên lớp (giáo viên trình chiếu, học sinh trả lời bằng điện thoại, xếp hạng, AI nhận xét lớp) | KT | `test_quiz_live` 30 |
| Tài liệu PDF (Google Drive) | KT + THẬT | mở/tải cần mạng |
| Cài app (PWA), học bài đã tải khi mất mạng, tự cập nhật khi đăng nhập | KT | `test_pwa_update_integrity` 7, `test_auto_update_login` 11 |
| Trợ giúp nhanh (câu hỏi có sẵn) | KT | `test_help_widget` 30 |

## Giáo viên
| Tính năng | Mức | Ghi chú |
|---|---|---|
| Đăng nhập Quản trị + Giáo viên lớp (chỉ thấy lớp mình) | KT + THẬT | |
| Soạn bài học, đăng tài liệu | KT | |
| Tạo đề từ Excel / AI soạn theo ma trận (phải duyệt) / thêm tự luận + gợi ý chấm | KT | |
| Theo dõi thi trực tiếp, thống kê đề | KT | `test_exam_teacher_monitor` |
| Tài khoản học sinh: tạo, nhập danh sách, đặt lại PIN, khóa/mở | KT | `test_student_import_browser` |
| Hiệu quả: thống kê, xuất CSV, báo cáo Bộ não AI | KT + THẬT | |
| Hạn mức AI theo lớp/học sinh, nhiều khóa Gemini | KT | |
| Menu điện thoại gọn 5 mục | KT | `test_teacher_mobile_nav` 21 |

## Bộ não AI (VPS)
| Tính năng | Mức | Ghi chú |
|---|---|---|
| Thu thập hằng đêm, báo cáo tuần (Gemini, ẩn danh tên) | KT + THẬT | 18 ca; **timer đang TẮT** từ khi dọn dữ liệu giả |
| Hiểu lầm phổ biến, chất lượng câu hỏi, hiểu lầm riêng → Gia sư | KT + THẬT (trên dữ liệu mô phỏng, đã xóa) | cần dữ liệu thi thật |

## Hạ tầng / thương hiệu
| Mục | Mức | Ghi chú |
|---|---|---|
| Tên miền aihoctap.online | THẬT (http) | **HTTPS chưa bật** khi báo cáo: trên http không mở được bài học (cần `crypto.randomUUID`), không cài app/không chạy offline |
| SEO, logo, ảnh chia sẻ | KT | `test_seo_brand` 28 |
| Worker nhận nhiều tên miền | KT + THẬT | `test_worker_multi_origin` 8 |

## Còn thiếu / rủi ro trước khi nộp
1. **Bật Enforce HTTPS**, rồi bỏ `http://aihoctap.online` khỏi `ALLOWED_ORIGIN`.
2. **Bật lại `brain.timer`** sau bài thi thật để có báo cáo (hoặc chạy tay `python3 -m brain run`).
3. Kiểm thử trên điện thoại thật của học sinh (C4): CHƯA có báo cáo.
4. Lớp DEMO cho Ban giám khảo: CHƯA thấy báo cáo đã tạo.
5. Đề thi thử chạy trên Firebase: đáp án nằm trong dữ liệu đề (ứng dụng không hiện) → thi thật tổ chức có giám sát.
6. Tính mở nhiều môn (C1): mới kiểm bằng dữ liệu mô phỏng.
