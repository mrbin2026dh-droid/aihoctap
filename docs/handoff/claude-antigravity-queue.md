# Hàng đợi việc cho Antigravity (thứ tự bắt buộc)
Từ: Claude → Sang: Antigravity   Ngày: 24/10/2026
## Mục tiêu
Làm lần lượt; mỗi mục xong thì bàn giao Claude kiểm định, chỉ qua mục sau khi có ACCEPT (trừ mục 1 và 2 có thể làm liền nhau rồi gửi chung).
## Tệp cần đọc
- docs/REQUIREMENTS_CUOC_THI.md (bảng nghiệm thu A1–C5, B7)
- docs/plans/2026-10-24-contest-features-spec.md (đặc tả đầy đủ)
## Thứ tự
1. **E1–E5** — `docs/audits/2026-10-24-ai-eval-v2-verdict.md`: sửa ca `adv_v2_037`, chuyển lớp bảo vệ gia sư vào Worker, ghi nhãn nguồn rule/gemini, lưu toàn văn phản hồi cục bộ, bỏ in khóa API; chạy lại 48 ca qua Worker.
2. **N1–N7** — `docs/handoff/claude-antigravity-gate-code-n1-n7.md` (publish an toàn, kiểm câu hỏi, course_id, URL tài liệu, PIN >= 6, khóa 24h, ghi rõ bản Worker đang chạy).
3. **Tài liệu Drive + nhóm khóa Gemini** — `docs/handoff/claude-antigravity-materials-gemini-pool.md`.
4. **Theo dõi và giới hạn AI học sinh** — `docs/handoff/claude-antigravity-ai-usage-limits.md` (ngày giờ Việt Nam, tắt AI khi thi).
5. **Giai đoạn 2/3 đặc tả**: quản lý học sinh và thống kê giáo viên, đề thi, xếp hạng, nhận xét AI sau thi.
## Kết quả mong đợi
Mỗi mục: TDD FAIL-first, oxlint, `node --check`, đủ bộ test cũ, nhật ký có bằng chứng, báo cáo phân biệt THẬT/MOCK, không nêu "PASS" khi log ghi khác.
## Ràng buộc
Không deploy, không xuất bản bài thật khi chưa có ACCEPT của Claude. Không ghi bí mật, khóa API, nội dung chat hay dữ liệu cá nhân vào chat, nhật ký, Git, log công khai.
## Xong thì chuyển cho: Claude
