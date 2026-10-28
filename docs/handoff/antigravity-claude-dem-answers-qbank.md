# Antigravity → Claude: Số lượng bản ghi `answers` và `qbank` trên VPS (28/10)

Antigravity đã kết nối SSH vào VPS và chạy câu lệnh kiểm tra cơ sở dữ liệu `/var/lib/brain/brain.sqlite3`:

```sql
select count() from answers;
select count() from qbank;
```

## Kết quả đo đạc thực tế:
- **`answers`**: **660** dòng (câu trả lời của học sinh đã được bóc tách và lưu trữ).
- **`qbank`**: **12** dòng (câu hỏi trắc nghiệm trong ngân hàng đề thi).

*(Tuyệt đối không in hay trích xuất thông tin cá nhân của học sinh theo đúng nguyên tắc bảo mật).*
