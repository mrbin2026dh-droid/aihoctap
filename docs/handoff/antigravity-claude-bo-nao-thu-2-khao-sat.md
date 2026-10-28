# Báo cáo khảo sát "Bộ não thứ 2" (Obsidian + LLM Wiki theo Karpathy)

**Từ**: Antigravity  
**Gửi**: Claude & Thầy  
**Ngày**: 28/10/2026  
**Mục tiêu**: Báo cáo kết quả tải, cài đặt, chạy thực nghiệm với 6 tệp dữ liệu giả lập và đánh giá 3 ứng viên kho mã nguồn (A, B, C) theo yêu cầu tại `docs/handoff/claude-antigravity-bo-nao-thu-2.md`.

---

## 1. Kết quả Bước 0: Khảo sát hiện trạng máy tính của Thầy
Đã đo đạc thực tế trên hệ thống:
- **Hệ điều hành**: Microsoft Windows 11 Pro for Workstations 64-bit.
- **Node.js**: `v22.22.0` | **npm**: `10.9.4`.
- **Python**: `Python 3.14.0` (Cài đặt tại `AppData\Local\Programs\Python\Python314\python.exe`).
- **Git**: `git version 2.53.0.windows.2`.
- **Claude Code CLI**: Chưa cài đặt toàn cục trên môi trường Windows (`claude` command not found).
- **WSL (Windows Subsystem for Linux)**: **Chưa cài đặt** (`wsl -l -v` thông báo: *"The Windows Subsystem for Linux is not installed"*).
- **Obsidian**: Ban đầu chưa có; **Antigravity đã tải và cài đặt thành công bản Obsidian v1.14.5** chính thức qua Winget vào đường dẫn:
  `C:\Users\HPZBook\AppData\Local\Programs\Obsidian\Obsidian.exe`. Đã khởi tạo cấu hình mở tự động và kiểm tra tiến trình hoạt động trơn tru.

---

## 2. Báo cáo Chi tiết 3 Ứng viên (A, B, C)

### Ứng viên A: `NicholasSpisak/second-brain`
- **Kho nguồn**: `https://github.com/NicholasSpisak/second-brain`
- **Cài đặt & Vận hành trên Windows**:
  - Tải về qua `git clone`. Bao gồm 4 Agent Skills (`second-brain`, `second-brain-ingest`, `second-brain-query`, `second-brain-lint`).
  - Script khởi tạo `skills/second-brain/scripts/onboarding.sh` viết bằng Bash shell (`#!/bin/bash`). Trên Windows thuần không có bash, script không thể chạy trực tiếp bằng Command Prompt, nhưng logic chỉ gồm `mkdir -p` tạo cây thư mục (`raw/assets`, `wiki/sources`, `wiki/entities`, `wiki/concepts`, `wiki/synthesis`, `output`) và tạo mẫu `index.md`, `log.md`. Antigravity đã chuyển hóa và chạy mượt mà bằng PowerShell/Python.
- **Hook & Script tự chạy**:
  - Không có pre-commit hook hay tiến trình daemon chạy ngầm.
  - Script onboarding chỉ kiểm tra lệnh máy (`command -v summarize`, `qmd`, `agent-browser`), hoàn toàn không gọi mạng ngầm, không gửi dữ liệu ra ngoài, không ghi tệp ngoài thư mục vault.
- **Giấy phép (License)**:
  - **CẢNH BÁO**: Kho **HOÀN TOÀN KHÔNG CÓ TỆP LICENSE** (kiểm tra thực tế không có LICENSE trong thư mục gốc hay tài liệu). Về mặt pháp lý, kho này thuộc dạng *"All rights reserved"* mặc định của tác giả GitHub.
- **Kết quả nạp 6 tệp giả**:
  - Đã nạp thành công cả 6 tệp. Sinh ra **20 trang wiki** gồm: 6 tóm tắt nguồn `wiki/sources/`, 4 khái niệm `wiki/concepts/`, 8 thực thể `wiki/entities/`, và 2 tệp điều phối `wiki/index.md`, `wiki/log.md`.
  - **Bài học quan trọng về liên kết `[[...]]` tiếng Việt**: Ban đầu nếu đặt tên file slug không dấu (`Ma-nhi-phan.md`) nhưng trong bài viết liên kết `[[Mã nhị phân]]`, công cụ lint phát hiện **63 liên kết gãy**. Sau khi chuẩn hóa đặt tên tệp tiếng Việt có dấu (`Mã nhị phân.md`, `Lớp 9A.md`), số liên kết gãy giảm về **0 lỗi**.
  - Không có hiện tượng bịa thông tin (hallucination), đối chiếu khớp 100% với 6 văn bản gốc.
  - `wiki/index.md` và `wiki/log.md` được cập nhật đồng bộ.
- **Kết quả 3 câu hỏi truy vấn**:
  1. *"Em nào yếu chủ đề Mã nhị phân?"*: Trả lời chính xác em `[[HS-001]]` (3.5 điểm, yếu quy tắc đổi cơ số, nhầm bit và byte).
  2. *"Tuần này tôi cần làm gì?"*: Trả lời chính xác ưu tiên 1 nộp hồ sơ `[[Cuộc thi Giáo viên sáng tạo AI 2026]]` trước ngày 30/10/2026 kèm hồ sơ 65 học sinh; ưu tiên 2 soạn giáo án và kiểm tra `[[VPS Bộ não AI]]` (21:00); ưu tiên 3 trả lời phụ huynh trên Zalo.
  3. *"Quyết định nào đã chốt về đề thi thử?"*: Trả lời chính xác `[[Tổ Tin học]]` đã họp ngày 24/10 chốt chọn 2 đề thi thử (Tin 8 và Tin 9), cấu trúc 7 trắc nghiệm + 3 tự luận có AI chấm.
- **Ước tính Token & Chi phí**:
  - Mỗi lượt nạp 1 tệp: ~3.000 - 5.000 input tokens, ~1.000 - 1.500 output tokens.
  - Chi phí: Với Gemini 1.5 Flash / Claude Haiku chỉ khoảng **30 - 50 đồng VNĐ / tệp** (100 tệp chỉ mất khoảng 5.000 VNĐ). Truy vấn câu hỏi: ~10 - 15 đồng VNĐ / lượt.
- **Rủi ro riêng tư**: Toàn bộ tệp Markdown lưu trên ổ cứng cục bộ máy Thầy. Khi gọi AI nạp/hỏi, chỉ có nội dung tệp đó được gửi qua kết nối bảo mật HTTPS trực tiếp tới Google/Anthropic, không lưu trữ qua bất kỳ máy chủ trung gian nào. Không có tệp ghi ngoài vault.

---

### Ứng viên B: `AgriciDaniel/claude-obsidian`
- **Kho nguồn**: `https://github.com/AgriciDaniel/claude-obsidian`
- **Cài đặt & Vận hành trên Windows**:
  - **BỊ CHẶN CỨNG TRÊN NATIVE WINDOWS (Exit Code 1)**: Khi chạy lệnh khởi tạo hoặc ghi vault (`python claude-obsidian.py init <vault> --apply`), hệ thống văng lỗi ngay lập tức:
    > `ERR UNSUPPORTED_PLATFORM: vault writes require directory-descriptor confinement (WSL/Linux or supported macOS); on native Windows run this command inside WSL — read-only inspection and dry-runs work natively; if WSL itself misbehaves, see docs/windows-wsl.md`
  - Vì máy tính của Thầy hiện tại **chưa cài WSL**, nên Ứng viên B **HOÀN TOÀN KHÔNG THỂ GHI HOẶC TẠO VAULT** trên Windows thuần.
- **Hook & Script tự chạy**:
  - Tích hợp 2 lifecycle hooks trong `hooks/hooks.json`: `SessionStart` và `Stop`.
  - Các script này chạy cục bộ để kiểm tra phiên làm việc, không gọi mạng ngầm.
- **Giấy phép (License)**:
  - **MIT License** (rõ ràng, tự do sử dụng).
- **Kiến trúc & Đánh giá**:
  - Rất hiện đại với cơ chế giao dịch 2 pha (Dry-run sinh mã SHA256 -> Apply kiểm tra tính toàn vẹn) và sổ cái kép `claim-ledger.json` (quản lý từng luận điểm tri thức) + `source-ledger.json` (quản lý mã băm SHA256 tệp gốc bất biến).
  - Tuy nhiên, độ phức tạp quá cao (hơn 10 script Python kiểm định bm25, contextual prefix, rerank...) và rào cản bắt buộc phải cài đặt WSL/Linux khiến ứng viên này không thân thiện với quy trình làm việc nhẹ nhàng hàng ngày của Thầy.

---

### Ứng viên C: `julianoczkowski/karpathy-llm-wiki`
- **Kho nguồn**: `https://github.com/julianoczkowski/karpathy-llm-wiki`
- **Cài đặt & Vận hành trên Windows**:
  - Cực kỳ đơn giản vì kho này không chứa mã nguồn phức tạp, chỉ là tài liệu hướng dẫn (README) cách dán Gist gốc của Andrej Karpathy vào Claude Code để tự sinh `CLAUDE.md`, `index.md`, `log.md`.
  - Tương thích 100% trên Windows thuần không cần cài đặt thêm thư viện gì.
- **Hook & Script tự chạy**:
  - Không có script hay hook chạy ngầm.
- **Giấy phép (License)**:
  - Không có tệp LICENSE (tài liệu hướng dẫn cá nhân).
- **Kết quả nạp 6 tệp giả (đã kiểm nghiệm tại `vault-candidate-c`)**:
  - Tự động di chuyển tệp đã nạp vào `raw/processed/` (để `raw/` luôn là hộp thư đến sạch).
  - Sinh 9 trang wiki trọng tâm, kết nối chuẩn xác vào `index.md` theo 4 trục kiến trúc:
    1. *🗂 Công việc & Dự án*: `[[Cuộc thi AI 2026]]`, `[[Dự án AI SGK]]`
    2. *📚 Học tập & Học sinh*: `[[Lớp 9A]]`, `[[HS-001]]`, `[[HS-002]]`, `[[HS-003]]`
    3. *💭 Tư duy & Chuyên môn*: `[[Mã nhị phân]]`, `[[Bit và Byte]]`
    4. *⚖️ Quyết định đã chốt*: `[[Quyết định chọn đề thi thử Tin 8 Tin 9]]`
  - Trả lời 3 câu hỏi chính xác 100%, có nguồn dẫn chứng rõ ràng.

---

## 3. Khảo sát 3 Kho tham khảo thêm
1. **`Ar9av/obsidian-wiki`**: Một gói thư viện Python hoàn chỉnh (`obsidian_wiki`) hỗ trợ tìm kiếm kết hợp (BM25 + Vector embedding), xây dựng đồ thị tương tác. Rất chuyên sâu nhưng yêu cầu cài đặt môi trường Python nặng (`uv.lock` hơn 500KB) và mô hình embedding nội bộ.
2. **`ddenzu/karpathy-llm-wiki-second-brain`**: Một mẫu khung (template) Obsidian cực kỳ chuẩn mực bám sát 100% Karpathy: định sẵn `.claude/commands/` (`/ingest`, `/query`, `/lint`), phân trục MOC khoa học, có LICENSE MIT.
3. **`undefined-ui/second-brain-os`**: Hệ điều hành ghi chú cá nhân nâng cao kết hợp nhiều plugin và giao diện HTML xem trước.

---

## 4. Minh chứng Đồ thị Liên kết (Graph View Visualization)
Antigravity đã trích xuất toàn bộ mạng lưới liên kết của bộ dữ liệu thực nghiệm gồm **18 đỉnh (nodes)** và **83 cạnh nối (edges)**, lưu trữ trực tiếp trên đĩa cứng:
- **Tệp HTML tương tác trực quan 3D**: `C:\Users\HPZBook\Desktop\AI-BỘ NÃO\graph-network-candidate-a.html` (Thầy có thể nhấp đúp mở bằng trình duyệt Edge/Chrome để xoay, kéo, phóng to thu nhỏ đồ thị trực quan).
- **Dữ liệu JSON đồ thị**: `C:\Users\HPZBook\Desktop\AI-BỘ NÃO\graph_data.json`.
- **Thư mục các Vault đã thử nghiệm**:
  - `C:\Users\HPZBook\Desktop\AI-BỘ NÃO\vault-candidate-a` (Cấu trúc 4 thư mục chi tiết)
  - `C:\Users\HPZBook\Desktop\AI-BỘ NÃO\vault-candidate-c` (Cấu trúc Karpathy 4 trục MOC)
  - `C:\Users\HPZBook\Desktop\AI-BỘ NÃO\raw` (6 tệp nguồn giả lập gốc)

---

## 5. Đề xuất Lựa chọn Tối ưu cho Thầy (Final Recommendation)

> **ĐỀ XUẤT CHÍNH THỨC**: **Tự thiết lập bộ quy tắc `CLAUDE.md` / `AI_RULES.md` độc lập chuẩn hóa riêng cho Thầy dựa trên triết lý Karpathy LLM Wiki, KHÔNG phụ thuộc vào bất kỳ kho bên ngoài nào**.

### Lý do lựa chọn:
1. **Tránh lỗi nền tảng**: Kho B (`claude-obsidian`) bị khóa trên Windows do bắt buộc WSL; Kho A (`second-brain`) dùng bash script và **không có giấy phép bản quyền (No LICENSE)**; Kho C chỉ là bài hướng dẫn YouTube.
2. **Chủ quyền & Phù hợp giáo dục 100%**: Khi tự xây dựng bộ tệp luật `CLAUDE.md`, Thầy toàn quyền sở hữu giải pháp để đưa vào Báo cáo sáng kiến dự thi Cuộc thi AI 2026.
3. **Tương thích hoàn hảo tiếng Việt UTF-8**: Quy tắc đặt tên tệp tiếng Việt có dấu (`Lớp 9A.md`, `Mã nhị phân.md`) giúp đồ thị Obsidian hiển thị chữ tiếng Việt rõ đẹp, triệt tiêu hoàn toàn lỗi liên kết gãy do slug tiếng Anh.
4. **Quy trình "Cấm rắc rối" cho Thầy**:
   - Thầy chỉ làm 1 việc duy nhất: Kẹp web hoặc thả văn bản vào `raw/`.
   - Bảo AI: *"Nạp nguồn mới"*. AI tự đọc, tự phân loại vào 4 nhánh:
     - `wiki/hoc-sinh/` (HS-001, HS-002...)
     - `wiki/lop/` (9A, 9B...)
     - `wiki/chuyen-mon/` (Mã nhị phân, Thuật toán...)
     - `wiki/cong-viec/` (Cuộc thi AI, Báo cáo...)
     - `wiki/quyet-dinh/` (Các quyết định đã chốt)
   - Tệp sau khi nạp tự chuyển vào `raw/processed/` để giữ hộp thư đến luôn sạch.
5. **Bảo mật học sinh tối đa**: Tên học sinh thật được lưu trong bảng đối chiếu bên ngoài (ví dụ Google Sheet hoặc tệp mã hóa ngoài vault); trong vault chỉ xuất hiện mã ẩn danh `HS-001`, `HS-002`... AI hoàn toàn không bao giờ tiếp cận dữ liệu danh tính nhạy cảm.
