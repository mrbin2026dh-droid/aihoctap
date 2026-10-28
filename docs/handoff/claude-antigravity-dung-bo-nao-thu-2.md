# Claude → Antigravity: dựng Bộ não thứ 2 thật trong Obsidian của thầy (28/10)
Theo khảo sát của Antigravity (đề xuất: tự viết luật theo Karpathy, không phụ thuộc kho ngoài), Claude đã soạn bộ khởi động `second-brain-kit/`.
Làm trên máy thầy (Windows 11). **Không đụng dữ liệu học sinh thật, không đẩy kho của thầy lên GitHub.**

## 1. Tìm đúng kho Obsidian của thầy
- Đọc `%APPDATA%\obsidian\obsidian.json` để thấy đường dẫn các kho. Kho thầy đang mở có ghi chú "create a link" và tệp `Untitled.base`.
- Hỏi thầy xác nhận dùng kho đó (hoặc tạo kho mới tên `Bộ não thứ 2` trong `Documents`). Không dùng các kho thử `vault-candidate-*`.

## 2. Chép bộ khởi động
- `git pull`, chép **nội dung** `second-brain-kit/` vào gốc kho. **Không ghi đè** tệp đã có (gặp trùng tên thì dừng, hỏi thầy). Xóa các tệp `.gitkeep`.
- Kết quả: `CLAUDE.md`, `AGENTS.md`, `HUONG-DAN.md`, `index.md`, `log.md`, `00-Hop-thu-den/`, `wiki/{cong-viec,du-an,lop,hoc-sinh,chuyen-mon,quyet-dinh,nguoi}/`, `dau-ra/`.

## 3. Cài đặt Obsidian (hướng dẫn thầy bấm, hoặc sửa `.obsidian/app.json` khi Obsidian đã đóng)
- Tệp & liên kết → Nơi lưu ghi chú mới: `00-Hop-thu-den`; Định dạng liên kết mới: ngắn nhất; Dùng `[[Wikilinks]]`: bật.
- Thư mục tệp đính kèm: `00-Hop-thu-den/tep`.
- Không cài plugin cộng đồng ở bước này.

## 4. Obsidian Web Clipper (tiện ích chính thức của Obsidian)
- Hướng dẫn thầy cài trên Chrome/Edge từ trang obsidian.md/clipper (tiện ích do Obsidian phát hành). Đặt kho = kho ở mục 1, thư mục lưu = `00-Hop-thu-den`.
- Việc bấm cài tiện ích là của thầy (Antigravity không tự cài tiện ích trình duyệt).

## 5. Lần nạp đầu tiên (dữ liệu công việc, KHÔNG có dữ liệu học sinh)
Tạo trong `00-Hop-thu-den/` 3 ghi chú từ kho `aihoctap`:
1. `Dự án Góc học tập - tổng quan.md`: tóm tắt từ `README.md`, `docs/REQUIREMENTS_CUOC_THI.md` (tính năng, kiến trúc Worker/Firebase/VPS, ai làm gì).
2. `Việc cần làm trước 30-10.md`: các việc mở trong các handoff gần nhất (xử lý dữ liệu giả lập, báo cáo minh chứng, Zalo Bot chờ thầy quyết…), có hạn 2026-10-30.
3. `Quyết định đã chốt tháng 10.md`: các quyết định đã chốt ghi trong `aisgk.md` (ví dụ dùng Firebase serverless, VPS Bộ não AI, thi thử Trắc nghiệm + Tự luận).
- **Không** nạp `docs/bao-cao-minh-chung-cuoc-thi-ai-2026.md` (số liệu chưa xác minh, có tên học sinh thật).
- Sau đó làm đúng thao tác **Nạp** trong `CLAUDE.md`, rồi **Hỏi** 2 câu: "Tuần này tôi cần làm gì?", "Dự án đã chốt những quyết định nào?", rồi **Kiểm tra kho**.

## 6. Báo cáo
`docs/handoff/antigravity-claude-bo-nao-thu-2-xong.md`: đường dẫn kho (chỉ tên thư mục, không có dữ liệu cá nhân), số trang tạo ra, kết quả 2 câu hỏi, kết quả kiểm tra (liên kết gãy = 0?), ảnh Graph view (đặt trên máy thầy, chỉ ghi đường dẫn). Cập nhật `aisgk.md`.
