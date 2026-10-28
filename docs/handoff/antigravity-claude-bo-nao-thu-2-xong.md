# Antigravity → Claude: Dựng xong Bộ não thứ 2 thật trong Obsidian của Thầy & Nạp lần đầu (28/10)

## 1. Vị trí kho Obsidian và Cấu hình
- **Đường dẫn kho xác nhận**: `C:\Users\HPZBook\Desktop\AI-KEN THUC\Mr.KhangKhoi` (kho thật Thầy đang mở trên Obsidian).
- **Bộ khởi động `second-brain-kit`**: Đã chép đầy đủ các tệp (`CLAUDE.md`, `AGENTS.md`, `HUONG-DAN.md`, `index.md`, `log.md`, cấu trúc thư mục `00-Hop-thu-den/da-nap/`, `wiki/{chuyen-mon,cong-viec,du-an,hoc-sinh,lop,nguoi,quyet-dinh}/`, `dau-ra/`).
- **Bảo toàn dữ liệu cũ**: Giữ nguyên vẹn 2 tệp gốc của Thầy (`create a link.md`, `Untitled.base`), không có xung đột hay ghi đè.
- **Cấu hình Obsidian (`.obsidian/app.json`)**:
  - `newFileFolderPath`: `00-Hop-thu-den`
  - `newLinkFormat`: `shortest`
  - `useMarkdownLinks`: `false` (bật `[[Wikilinks]]`)
  - `attachmentFolderPath`: `00-Hop-thu-den/tep`

---

## 2. Nạp lần đầu 3 tài liệu công việc
Đã đọc và nạp 3 tài liệu công việc từ dự án vào `00-Hop-thu-den/da-nap/`:
1. `Dự án Góc học tập - tổng quan.md` (2.796 bytes)
2. `Việc cần làm trước 30-10.md` (1.608 bytes)
3. `Quyết định đã chốt tháng 10.md` (1.968 bytes)

**5 trang wiki được tạo thành công**:
1. `wiki/du-an/Dự án Góc học tập.md`
2. `wiki/du-an/Cuộc thi AI 2026.md`
3. `wiki/cong-viec/Kế hoạch chuẩn bị nộp Cuộc thi AI 2026.md`
4. `wiki/quyet-dinh/Quyết định kiến trúc và dữ liệu tháng 10.md`
5. `wiki/nguoi/Thầy Khang Khởi.md`

Đã cập nhật đầy đủ `index.md` và ghi nhận lịch sử vào `log.md`.

---

## 3. Kết quả thử nghiệm truy vấn (Hỏi 2 câu)

### Câu 1: "Tuần này tôi cần làm gì?"
> **Trả lời:**
> Theo [[Kế hoạch chuẩn bị nộp Cuộc thi AI 2026]] và [[Cuộc thi AI 2026]]:
> - **Ưu tiên số 1 (Ngày 29/10/2026):**
>   1. Cho 2 lớp 9A10 và 9A9 làm bài thi thử trực tuyến thật trên PWA.
>   2. Kích hoạt Bộ não AI trên VPS chạy phân tích dữ liệu thật (độ khó p, độ phân cách D, hiểu lầm riêng) và gửi báo cáo tuần vào Google Sheet `NaoAI`.
>   3. Hoàn thiện Báo cáo minh chứng sư phạm với số liệu thực nghiệm thật.
> - **Việc Zalo Bot:** Thầy tạo ứng dụng trên `developers.zalo.me` lấy App ID và Secret để cấu hình thông báo.
> - **Hạn chót:** Hoàn thiện và nộp hồ sơ [[Cuộc thi AI 2026]] trước ngày **30/10/2026**.

### Câu 2: "Dự án đã chốt những quyết định nào?"
> **Trả lời:**
> Theo [[Quyết định kiến trúc và dữ liệu tháng 10]] và [[Dự án Góc học tập]]:
> 1. **Kiến trúc:** Mô hình Hybrid Serverless (Cloudflare Worker) + VPS (Ubuntu Python + SQLite); Firebase Realtime Database làm trung tâm đồng bộ; bảo mật danh tính học sinh.
> 2. **Sư phạm & Khảo thí:** Gia sư Socrates gợi mở, không đưa đáp án; đề thi kết hợp Trắc nghiệm chấm máy + Tự luận AI chấm sơ bộ; Bộ não AI lọc bỏ câu trả lời sai mã câu hỏi.
> 3. **Dữ liệu thực nghiệm (chốt 28/10):** Chọn Phương án A — Xóa sạch 66 bài thi giả lập và 65 bản đồ năng lực cũ trên Firebase; tổ chức cho học sinh thi thật ngày 29/10 để đảm bảo tính trung thực tuyệt đối.

---

## 4. Kiểm tra sức khỏe kho (Health Check)
- **Tổng số trang wiki**: 5 trang.
- **Liên kết gãy (Broken links)**: **0**.
- **Trang mồ côi (Orphan pages)**: **0** (tất cả các trang đều có liên kết qua lại và nằm trong `index.md`).
- **Tình trạng bảo mật**: **0 dữ liệu học sinh thật**, không có mật khẩu hay khóa API.

---

## 5. Hướng dẫn Thầy sử dụng hàng ngày
1. Thầy thả tài liệu thô vào `00-Hop-thu-den`.
2. Bảo trợ lý AI: *"Nạp tài liệu mới"*.
3. Đặt câu hỏi truy vấn: *"Tuần này tôi cần làm gì?"*, *"Tiến độ dự án ra sao?"*
