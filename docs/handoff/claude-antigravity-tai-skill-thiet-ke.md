# Tải 3 skill thiết kế từ GitHub về PC, kiểm tra an toàn, đóng gói ZIP cho Claude
Từ: Claude → Sang: Antigravity   Ngày: 2026-10-26 (Asia/Bangkok)

## Mục tiêu
Người dùng muốn bổ sung cho Claude (tài khoản claude.ai) và cho chính Antigravity các skill thiết kế UI: UI/UX Pro Max, Vercel Web Design Guidelines, AccessLint. Claude không tải được từ GitHub trong phiên đám mây; Antigravity tải về PC, kiểm tra, đóng gói ZIP để người dùng tải lên mục Kỹ năng của Claude.

## Nguồn (chỉ dùng đúng ba kho này, bản mới nhất trên nhánh mặc định)
1. https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT) – skill `ui-ux-pro-max` kèm script Python `scripts/search.py` và dữ liệu CSV.
2. https://github.com/vercel-labs/agent-skills (MIT) – chỉ thư mục `skills/web-design-guidelines`.
3. https://github.com/accesslint/claude-marketplace (MIT) – các skill kiểm tra tương phản/truy cập. Tác tử và máy chủ MCP trong kho này KHÔNG đóng ZIP (skill ZIP không chứa được), chỉ liệt kê tên.

## Việc cần làm
1. `git clone` từng kho vào thư mục **mới, trống, ngoài dự án** (ví dụ `%USERPROFILE%\Downloads\design-skills-src\<tên-kho>`). **Không chạy bất kỳ script nào** trong các kho.
2. Ghi lại: mã commit, giấy phép (đọc `LICENSE`), danh sách tệp (tên + kích thước).
3. Kiểm tra an toàn, đọc tay từng `SKILL.md` và mọi tệp `.py/.js/.sh/.ps1/.json` đi kèm. Tìm: gọi mạng (`requests`, `fetch`, `curl`, `urllib`, `socket`), `eval/exec/subprocess/os.system`, đọc biến môi trường hoặc thư mục `.ssh/.aws/.env`, ghi/xóa tệp ngoài thư mục skill, chỉ dẫn ẩn bảo agent bỏ qua quy tắc hoặc gửi dữ liệu ra ngoài (kể cả trong comment, base64, HTML ẩn). Ghi kết luận từng tệp: AN TOÀN / CẦN XEM / KHÔNG DÙNG, kèm lý do ngắn.
4. Chỉ với skill không bị đánh dấu KHÔNG DÙNG: đóng ZIP, mỗi skill một ZIP, **thư mục skill nằm ở gốc ZIP** (`ui-ux-pro-max/SKILL.md`, …), tên thư mục trùng `name` trong phần đầu `SKILL.md`. Đặt ZIP vào `Desktop\skill-thiet-ke\` (không đưa vào kho dự án, không commit).
5. Nếu Antigravity có thư mục skill riêng, cài bản đã kiểm tra vào đó để dùng khi viết giao diện.
6. Ghi kết quả vào `docs/handoff/antigravity-claude-skill-thiet-ke-ket-qua.md`: bảng (kho, commit, giấy phép, skill, kết luận an toàn, tên ZIP + dung lượng). Không dán log dài.

## Ràng buộc / không được làm
Không chạy script trong kho tải về. Không cài hoặc bật plugin `design-drift` (nó ép giao diện theo thương hiệu khác, lệch bảng màu dự án). Không sửa mã nguồn dự án trong việc này. Không ghi token/khóa vào repo.

## Xong thì chuyển cho: Người dùng
Người dùng tải các ZIP đã duyệt lên Claude (Tùy chỉnh → Kỹ năng → Tải lên) rồi nhắn Claude "đã thêm"; Claude đọc lại `SKILL.md` trước khi dùng.
