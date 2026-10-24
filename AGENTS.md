# BẮT BUỘC ĐỌC NHẬT KÝ TRƯỚC KHI LÀM VIỆC

Áp dụng cho mọi AI làm việc với dự án này, gồm Antigravity, Codex và các agent khác.

1. Trước khi lập kế hoạch, sửa code hoặc tiếp tục công việc, bắt buộc đọc [aisgk.md](aisgk.md) ở thư mục gốc, nhất là phần trạng thái hiện tại và mục nhật ký mới nhất.
2. Mọi kế hoạch mới hoặc thay đổi kế hoạch phải được ghi vào `aisgk.md` trước khi thực hiện; liên kết tới tệp kế hoạch chi tiết nếu có.
3. Sau mỗi nhóm thay đổi code và trước khi bàn giao/dừng phiên, cập nhật `aisgk.md`: ngày giờ (Asia/Bangkok), AI thực hiện, mục tiêu, tệp đã sửa, kiểm thử thực tế, lỗi/vướng mắc và bước tiếp theo. Ghi cả công việc dở dang để AI khác tiếp nối.
4. Giữ nguyên lịch sử, thêm mục mới; không xóa hoặc ghi đè nhật ký cũ. Phân biệt rõ dự kiến, đã làm, đã kiểm chứng và chưa kiểm chứng; không ghi PASS khi chưa chạy kiểm thử.
5. Không ghi mật khẩu, token, nội dung `.env`, dữ liệu cá nhân hoặc dữ liệu học sinh vào nhật ký. Bảo toàn thay đổi sẵn có của người dùng/AI khác.
6. Nếu thiếu công cụ/skill bắt buộc, ghi rõ công cụ thiếu và phần việc bị chặn; không tự nhận đã chạy hoặc đã được phê duyệt.

---

# HIẾN PHÁP ANTIGRAVITY (THE MASTER PIPELINE) - BẮT BUỘC DỰ ÁN
**Mức độ ưu tiên**: Tuyệt đối cao nhất (Priority 1 - Workspace Root Law). CẤM SUY ĐOÁN (ZERO-GUESSWORK).
**Phạm vi áp dụng**: MỌI thao tác trong dự án `AI AGENT SGK`.

Antigravity Agent KHÔNG ĐƯỢC PHÉP tự suy đoán cách làm. Bắt buộc phải kích hoạt và tuân thủ chuỗi Kỹ năng (Skills) đã được lập trình sẵn dưới đây như một dây chuyền công nghiệp khép kín. 

---

### BƯỚC 1: TRI GIÁC TÀI LIỆU & KIẾN TRÚC (BẮT BUỘC TRƯỚC KHI CODE)
1. **Quét dự án**: Bắt buộc gọi skill `.codegraph` (hoặc MCP `codegraph_explore`) để lấy bản đồ tri thức toàn cục của dự án.
2. **Quét tài liệu chuẩn**: CẤM đoán mò API. Bắt buộc kích hoạt skill `context7-docs` để tra cứu tài liệu thư viện mới nhất trước khi viết bất kỳ dòng code nào.
3. **Lên kế hoạch & Thẩm định tệp**: Dùng skill `brainstorming` (Superpowers) chia nhỏ task, xuất file kế hoạch `.md` và áp dụng skill `sonnet-file-audit-loop` để gửi đường dẫn tệp cho Claude 3.5 Sonnet thẩm định độc lập trước khi code. **QUY TẮC BẤT BIẾN**: CẤM TUYỆT ĐỐI gửi hình ảnh, file PDF scan hoặc dán text dài vào prompt của Sonnet. Mọi tài liệu nặng bắt buộc xử lý offline trên CPU cục bộ bằng Python (0 token) và chỉ gửi đường dẫn file văn bản `.md`/`.py` siêu nhẹ (< 3KB) để tiết kiệm token tối đa (< 3.000 tokens/lần audit).

### BƯỚC 2: RÀNG BUỘC CỨNG SẢN XUẤT UI/UX & FRONTEND
Nếu tác vụ liên quan đến Giao diện, Agent BẮT BUỘC chạy tuần tự qua 3 màng lọc Kỹ năng sau, cấm bỏ sót:
1. **Sinh cấu trúc (Type-Safe)**: Bắt buộc gọi skill `stitch-type-safe-ui`. Mọi component phải được sinh ra bằng Google Stitch MCP và bọc trong cấu trúc Microservice Type-Safe (Zod/GraphQL/Pydantic), tuyệt đối không tự code chay thiếu định dạng.
2. **Chống thiết kế ẩu (Anti-Slop)**: Ngay sau khi có khung, bắt buộc đưa qua skill `design-taste-frontend`. Kỹ năng này sẽ "giết chết" các thiết kế template đại trà, gạch bỏ toàn bộ icon thừa thãi, ép buộc từ ngữ Micro-Copy tối giản (1 mục tiêu - mô tả < 10 từ).
3. **Đóng gói Production**: Gọi skill `frontend-design` để xuất ra layout HTML/CSS đạt chuẩn production, đảm bảo Responsive 100% không tràn (Zero-Overflow).

### BƯỚC 3: LUẬT TOÁN HỌC & TDD (LAW-FIRST)
1. Kích hoạt `bend-proof-driven`: Biến mọi yêu cầu thành hợp đồng toán học/Zod Type/Pydantic Contract trước khi code logic.
2. Kích hoạt `test-driven-development`: Sinh Unit Test/E2E Test và đảm bảo Test báo FAIL trước khi code logic.

### BƯỚC 4: NGƯỜI GÁC CỔNG & TỰ VÁ LỖI (GATEKEEPERS)
Khi code xong, CẤM bàn giao ngay. Bắt buộc gọi chuỗi skill kiểm duyệt:
1. **Kiểm duyệt Cú pháp**: Chạy `alibaba-code-review` và `zero-bug-verification` (V8/Oxlint/Playwright).
2. **Kiểm duyệt UX/Accessibility**: Bắt buộc chạy skill `web-design-guidelines` để Audit toàn bộ giao diện xem có vi phạm chuẩn trợ năng và WCAG hay không.
3. **Kiểm duyệt Hiệu năng**: Bắt buộc chạy skill `web-perf` để đo đạc Core Web Vitals (LCP, INP, CLS) và chặn đứng các tài nguyên chặn render (render-blocking).
4. **Vòng lặp Phán quyết Sonnet (Sonnet File Audit Loop)**: Kích hoạt `sonnet-file-audit-loop`, đọc lại tệp `.md` phán quyết của Claude 3.5 Sonnet để phân tích từng điều kiện, tự động sửa đổi mã nguồn/kế hoạch và tái kiểm thử cho đến khi PASS 100%.
5. **Vòng lặp Self-Healing**: Bất kỳ skill gác cổng nào ở trên văng lỗi (Exit Code 1) hoặc báo hiệu năng kém, Agent PHẢI IM LẶNG TỰ SỬA CODE cho đến khi đạt điểm tối đa.

---
**Lệnh thực thi tối thượng**: Bất kỳ lúc nào sinh code, Agent phải rà soát xem mình đã gọi đủ tên các Skill: `context7-docs`, `stitch-type-safe-ui`, `design-taste-frontend`, `web-design-guidelines`, `web-perf`, `alibaba-code-review`, `sonnet-file-audit-loop` hay chưa. Nếu thiếu một mắt xích, coi như vi phạm Hiến pháp!
