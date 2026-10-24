# PROMPT GỬI CLAUDE 3.5 SONNET: ĐỀ NGHỊ PHÁN QUYẾT TOÀN DIỆN CHO TRIỂN KHAI TOÀN TRƯỜNG HỌC

Bạn hãy sao chép toàn bộ nội dung bên dưới và dán vào phiên trò chuyện với Claude 3.5 Sonnet:

```markdown
Chào Claude 3.5 Sonnet (Kiến trúc sư Trưởng / Độc lập),

Tôi gửi bạn hồ sơ nghiệm thu chung cuộc đã giải quyết dứt điểm 100% tất cả 5 điều kiện mở tại Mục 5 trong phán quyết V3 của bạn (`.kilo/plans/1791967657542-sonet-v3-verdict-and-oss-advice.md`).

Tài liệu chi tiết đã được cập nhật đồng bộ tại:
- `.kilo/plans/1791967657542-sonet-full-approval-dossier.md`
- `docs/audits/2026-10-15-sonet-full-approval-dossier.md`

Khế ước dữ liệu SGK: SHA-256(`data/curriculum/tin6/bai1.blocks.json`) = `783BD8E637442AF34465119503A53A318340F9BA1852E054C7EC4CAA46DB30AE` (BẤT BIẾN 100%).

---

### I. BÁO CÁO ĐỐI CHIẾU 5 ĐIỀU KIỆN MỤC 5 CỦA SONNET V3

1. **Điều kiện 1 (C1: Tên hằng & Dọn rác chủ động `purge_expired_chat_sessions`)**:
   - Đã chuẩn hóa tên hằng: `CHAT_SESSION_MAX = 5000` (trần cứng LRU trong RAM) và `CHAT_RATE_LIMIT_MAX = 20` (lượt/phút).
   - Thêm hàm `purge_expired_chat_sessions(now)` quét dọn chủ động các session quá hạn TTL (600s). Hàm này được gọi tự động mỗi khi có request tới `check_chat_rate_limit(session_id)` tại `backend/server.py` L113-145.
   - Thêm unit test `test_sonet_c1_chat_rate_limit_active_purge_and_lru_bounds` trong `tests/test_api_endpoints.py`: dùng `monkeypatch` thời gian kiểm chứng session bỏ rơi bị xóa sạch khỏi RAM, trần cứng 5,000 session qua LRU hoạt động chuẩn xác -> **PASS**.

2. **Điều kiện 2 (C2: Test tự động mô phỏng lượt cũ gọi sau lượt mới)**:
   - Đã bổ sung Bước [7] vào `tests/test_ui_mutex_live.py`: Mô phỏng Turn 101 bắt đầu, sau đó Turn 102 bắt đầu. Callback cũ từ Turn 101 chạy muộn và gọi `releaseChatMutex(101)` -> Bị từ chối an toàn (`res101 === false`), `chatInput.disabled` và `state.isChatSubmitting` vẫn giữ nguyên trạng thái khóa. Khi Turn 102 gọi `releaseChatMutex(102)` -> Mở khóa thành công.
   - Playwright Live UI chạy thực nghiệm trên Chromium headless đạt **PASS 100%** (log nguyên văn trong hồ sơ).

3. **Điều kiện 3 (C3: Giải thích 144 tests & Dán log pytest nguyên văn)**:
   - Thống kê chi tiết: 44 tests unit/integration cấu trúc (8 `test_api_endpoints.py` + 19 `test_block_schema_and_teacher_api.py` + 13 `test_socratic_agent_context.py` + 4 `test_socratic_guardrails.py`) cộng 100 ca eval parametrize = **Đúng 144 tests collected**.
   - Chạy `python -m pytest tests/ -v`: **144/144 tests PASSED trong 17.92s** trên Python 3.14.0.

4. **Điều kiện 4 (Bộ 100 ca Đối kháng - P1-A, P1-B, P1-C, P1-D, P2)**:
   - **P1-A**: Chạy song song kiểm thử cả 2 nhánh: Offline Fallback Engine (`socratic_fallback_reply`) VÀ Live Pipeline (`chat_with_tutor` qua `MockGenaiClient` mô phỏng LLM cố tình rò rỉ đáp án).
   - **P1-B**: Biểu thức `AFFIRMATIVE_LEAK_REGEX` cấm tuyệt đối mẫu khẳng định đáp án A-D.
   - **P1-C**: Hàm `strip_markdown()` chuẩn hóa bóc ký tự đặc biệt (`**B**`, `` `C` ``, `[A]`) kết hợp ranh giới từ `\b`.
   - **P1-D**: Tự động tra cứu `correct_text` và các biến thể 3 từ đầu/cuối từ `QUIZ_DATA` để cấm rò rỉ nội dung đáp án.
   - **P2**: Ca hợp lệ (Nhóm 9) được kiểm tra có độ dài > 50 ký tự, không bị từ chối, và chứa từ khóa kiến thức SGK ("thông tin", "dữ liệu", "vật mang tin",...).
   - Kết quả: **100/100 tests PASSED trong 1.36s (Tỷ lệ rò rỉ: 0.00%)**.

5. **Điều kiện 5 & 6 (Kiến trúc, Duyệt Sư phạm & Bộ nhớ Học sinh)**:
   - Đã bảo lưu phê duyệt sư phạm cho Giàn giáo Câu 3 (`tin6_b1_q3`).
   - Tiếp thu 100% định hướng của bạn: Duy trì Prompt Engineering + Output Redaction Guardrail; sử dụng bảng quan hệ SQLite (Structured Skill Mastery Graph) khi làm tính năng theo dõi tiến độ học sinh nhiều tuần; nói KHÔNG với Vector DB / MemGPT để bảo vệ quyền riêng tư học sinh THCS.

---

### II. ĐỀ NGHỊ PHÁN QUYẾT CHUNG CUỘC

Toàn bộ 5 điều kiện tại Mục 5 trong phán quyết V3 của bạn đã được chứng minh bằng mã nguồn cụ thể và log thực nghiệm 100% PASS.

Đề nghị bạn đưa ra phán quyết chính thức:
**`[APPROVED] CHÍNH THỨC TOÀN DIỆN CHO TRIỂN KHAI TOÀN TRƯỜNG HỌC`**.
```
