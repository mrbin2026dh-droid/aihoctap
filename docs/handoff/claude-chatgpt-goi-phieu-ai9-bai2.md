# Soạn gói phiếu học tập Giáo dục AI lớp 9 – Bài 2 (dữ liệu JSON)
Từ: Claude → Sang: ChatGPT/Codex   Ngày: 22/11/2026 (Asia/Bangkok)
Điều kiện bắt đầu: người dùng đã trả lời 12 câu ở cuối `docs/integration-ai-grade9-lesson2/07_ROLLBACK_PLAN.md` (ghi câu trả lời vào cuối tệp này). Chưa có thì chỉ làm phần không phụ thuộc (mục 1, 2).

## Mục tiêu
Tạo gói nội dung cho phân hệ "Phiếu học tập" theo lược đồ ở `03_INTEGRATION_ARCHITECTURE.md`, giữ **nguyên văn** tài liệu gốc. Không viết mã.

## Tệp cần đọc
- `docs/integration-ai-grade9-lesson2/02_SOURCE_CONTENT_MAPPING.md` (cột "Việc cần làm")
- `docs/integration-ai-grade9-lesson2/03_INTEGRATION_ARCHITECTURE.md` (mục "Gói phiếu")
- Nguồn: `C:\Users\HPZBook\Downloads\Tài liệu cấp Trung học cơ sở\Tài liệu 12 tiết AI lớp 6-9\Lớp 9\Lop9.Bai02 - …\` hai tệp `.docx`

## Kết quả mong đợi
1. `data/phieu/ai9_bai2.json`: 6 hoạt động `hd1, hd21, hd22, hd23, hd3, hd4`. Mỗi trường có `id`, `type`, `label` (đúng chữ phiếu PL9.2.2/9.2.7), `max`, `evidence{code,kind}`, `source` (ví dụ "PL9.2.2 phần A"). Các khối học liệu PL9.2.1, 9.2.3–9.2.8 ở `blocks`. Câu bẫy PL9.2.5 và toàn bộ PL9.2.9 **không** có trong tệp này.
2. `data/phieu/ai9_bai2.dapan.json`: PL9.2.9 mục 1–7 tách theo hoạt động và YCCĐ, cho màn giáo viên. Tệp này **không commit** (sẽ vào `.gitignore`).
3. `docs/integration-ai-grade9-lesson2/08_FIELD_MAP.md`: bảng `fieldId | nhãn | nguồn | YCCĐ | loại minh chứng`. Mọi dòng "T"/"L" ở tệp 02 phải có trường tương ứng.

## Ràng buộc
- Không thêm, bớt hay sửa ý tài liệu gốc. Đề xuất cải tiến ghi riêng ở cuối 08, nhãn "Đề xuất".
- Không đưa đáp án vào gói học sinh. Không ghi dữ liệu học sinh thật.
- `ai_tutor: false`.

## Xong thì chuyển cho: Claude (đối chiếu nguyên văn tự động với văn bản trích docx), rồi Antigravity theo `05_IMPLEMENTATION_PLAN.md` giai đoạn 2.

## Câu trả lời của giáo viên (chốt 22/11/2026)
1. Thay hẳn phiếu giấy: mọi HS làm trên ứng dụng. Vẫn giữ ô "GV ghi nhận trình bày miệng" và GV nhập hộ khi máy hỏng/mất mạng (giáo án: phần nói được ghi nhận như phần viết).
2. Menu "Học AI" riêng ở trang HS (sau "Học") và GV (sau "Soạn bài"); "Tài liệu" gộp vào trang "Học".
3. Thang mức GV: Chưa thấy minh chứng / Đạt / Khá / Tốt + phần còn thiếu + cách hỗ trợ. Không quy đổi điểm.
4. Góp ý phần B: bạn gõ trên máy chủ phiếu, chọn tên mình từ danh sách lớp; góp ý tính cho người viết.
5. HS tự chọn số nhóm; GV đặt số nhóm của lớp và sửa được.
6. GV viết thẻ nghề địa phương theo khuôn 3 ô (trước đây / nay có AI / một lần máy sai), không in kĩ năng.
7. Trang 2 ví dụ 2: tự mở khi HS trả lời xong, và GV có nút mở cho cả lớp.
8. Nội dung học liệu giữ "kĩ" như gốc.
9. Lưu đến hết năm học; GV xuất CSV rồi xóa theo lớp (có xác nhận).
10. Xuất CSV (có BOM) mở bằng Excel; không làm .xlsx.
11. Dạng dữ liệu dùng chung cho mọi bài Giáo dục AI; Bài 2 là gói đầu tiên.
12. Không dùng PLC.1–PLC.8; phiếu quan sát nhóm dùng 3 chỉ báo PL9.2.9 mục 4.
