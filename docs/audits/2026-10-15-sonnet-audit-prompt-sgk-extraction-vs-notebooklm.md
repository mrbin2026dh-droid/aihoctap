# PROMPT GỬI CLAUDE 3.5 SONNET THẨM ĐỊNH TỆP (THEO CHUẨN SKILL SONNET-FILE-AUDIT-LOOP)

*(Bạn chỉ cần copy toàn bộ nội dung trong khung code dưới đây và gửi cho Claude 3.5 Sonnet)*

```markdown
Chào bạn Claude 3.5 Sonnet, tôi gửi bạn tệp hồ sơ kỹ thuật cần thẩm định kiến trúc và phản biện chiến lược:

📁 Đường dẫn tệp cần đọc trực tiếp trên đĩa cứng:
- Đường dẫn tuyệt đối: `c:\Users\HPZBook\Desktop\AI AGENT SGK\.kilo\plans\1792075848696-sgk-extraction-vs-notebooklm-architectural-dossier.md`
- Đường dẫn tương đối: `docs/plans/2026-10-15-sgk-extraction-vs-notebooklm-architectural-dossier.md`

📋 Nhiệm vụ thẩm định của bạn:
1. Hãy dùng công cụ đọc tệp (view_file hoặc read_file) để đọc toàn bộ hồ sơ kỹ thuật tại đường dẫn trên.
2. Thẩm định toàn diện kiến trúc, so sánh 4 phương án (Tkinter PDF cục bộ vs. NotebookLM MCP vs. Gemini Long-Context File API vs. Cào học liệu Internet).
3. Trả lời chi tiết 4 câu hỏi trọng tâm của CTO về tính ổn định production, rủi ro Reverse-Engineered MCP, và bảo vệ khế ước Block Schema 2.0.
4. Xuất kết quả phán quyết của bạn thành một tệp markdown tại:
   `c:\Users\HPZBook\Desktop\AI AGENT SGK\.kilo\plans\1792075848696-sonet-extraction-vs-notebooklm-verdict.md`
```
