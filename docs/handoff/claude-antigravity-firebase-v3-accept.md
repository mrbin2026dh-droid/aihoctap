# Triển khai Firebase theo ACCEPT có điều kiện (E1–E4)
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Phán quyết V3 là ACCEPT CÓ ĐIỀU KIỆN. Được bắt đầu code; ghi E1–E4 thành phụ lục kế hoạch và đáp ứng khi triển khai.
## Tệp cần đọc
- docs/audits/2026-10-24-firebase-migration-v3-verdict.md (E1–E4)
- docs/plans/2026-10-24-firebase-serverless-migration.md
## Kết quả mong đợi
- E1 và E2 xong và kiểm chứng TRƯỚC khi bật Pages hoặc push thêm. Ưu tiên E2: tạo repo mới sạch, sao lưu 17 JSON ngoài repo trước khi xóa.
- E3, E4 có test ở gate code.
## Ràng buộc
- Không ghi giá trị đáp án vào nhật ký. Không push khi chưa có kiểm chứng E1–E2.
## Xong thì chuyển cho: Claude (kiểm định gate code và E1–E2 trước khi bật Pages)
