# Kiểm tra REA và bản Notebook cài trên máy — 24/10/2026

Phạm vi: kiểm tra chỉ đọc, phục vụ thiết kế PWA học sinh. Không đọc notebook, cookie, token hoặc tài liệu cá nhân; không giải mã hay can thiệp tiến trình Google.

## Quan sát trực tiếp

- Có checkout `rea/`, remote đã bỏ thông tin xác thực: https://github.com/morluto/rea.git . package.json ghi `rea-agents` 6.6.0.
- Không có `rea/node_modules` hoặc `rea/dist`; không thấy lệnh `rea`/`rea-agents` trên PATH hay launcher npm global ở vị trí đã kiểm tra.
- Lệnh `node rea/scripts/rea.mjs doctor --client antigravity --json` thất bại: **REA's compiled runtime is missing**. Node hiện có: v22.22.0.
- Cấu hình Antigravity `.gemini/antigravity/mcp_config.json` có entry `gemini-notebook-mcp`, không có REA. Codex config đã kiểm tra cũng không có MCP REA; phiên hiện tại không có tool REA.
- Có Antigravity.exe 2.25.0.0 và Antigravity IDE riêng. CLI Antigravity IDE báo 1.107.0, hỗ trợ `chat` với ask/edit/agent.
- `Desktop/Gemini Notebook.lnk` trỏ tới `C:/Program Files/Google/Chrome/Application/chrome_proxy.exe`, app-id `kjfmejlnnfibknebffpdmphoiomckhdb`, Chrome Profile 8.
- Thư mục Web Applications tương ứng tồn tại, chứa Gemini Notebook.ico và checksum; không phải gói mã nguồn nghiệp vụ Notebook trên máy.

## Kết luận và giới hạn

Checkout REA đã có, nhưng bản local được kiểm tra chưa chạy được; không đủ căn cứ nói REA đã cài và kết nối hoàn chỉnh. Không loại trừ một bản npx cache hoặc môi trường khác chưa được kiểm tra. MCP Notebook hiện có không chứng minh REA đã được cấu hình.

Bản Notebook được cài qua Chrome. Không thể suy ra toàn bộ backend, mô hình, cơ sở dữ liệu hoặc mã nguồn gốc Google từ shortcut/biểu tượng. Chưa đo manifest, service worker, cache hay mạng của Notebook; các chi tiết đó vẫn CHƯA XÁC MINH. Có thể giao REA khảo sát bản web/client trong phạm vi được phép, tách quan sát khỏi suy luận.

Chưa cài package, build REA, sửa MCP hoặc thay đổi ứng dụng hiện hành trong bước kiểm tra này.
