"""Bộ não AI của Góc học tập — chạy trên VPS của giáo viên.

Mỗi tối: lấy dữ liệu học tập (Firebase + nhật ký câu hỏi Gia sư từ Worker), lưu lịch sử vào SQLite
(Firebase chỉ giữ trạng thái mới nhất, bộ não giữ cả quá khứ để thấy xu hướng), phân tích từng lớp
(máy tính, không AI), nhờ Gemini viết báo cáo cho giáo viên, rồi gửi báo cáo về Google Sheet.

Chỉ GỌI RA NGOÀI, không mở cổng nào trên VPS. Chỉ dùng thư viện chuẩn của Python 3.10+.
"""
__version__ = "1.0.0"
