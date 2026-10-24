# Kế hoạch Tích hợp Gia sư Sư phạm Socrates AI vào PWA Học sinh (Online Mode)

**Ngày lập**: 24/10/2026  
**Người thực hiện**: Antigravity Agent  
**Mục tiêu**: Tích hợp tính năng Gia sư Sư phạm Socrates (`backend/agent.py`) vào giao diện PWA học sinh (`/hoc/`) khi có kết nối mạng, đồng thời bảo toàn 100% tính năng hoạt động offline khi mất mạng.

---

## 1. Ràng buộc Kiến trúc & Tiêu chuẩn Sư phạm

1. **Nguyên tắc Hybrid "Offline-First, Online-AI Enhanced"**:
   - Khi **Mất mạng (Offline)**: Ứng dụng hoạt động 100% bình thường (đọc bài, làm bài, lưu nháp, outbox nộp bài). Nút AI hiển thị trạng thái mờ (disabled) kèm thông báo `[Cần kết nối mạng để dùng Gia sư AI]`.
   - Khi **Có mạng (Online)**: Nút AI kích hoạt tức thì. Học sinh có thể bấm để nhận hướng dẫn sư phạm Socrates.

2. **Nguyên tắc Sư phạm Bất biến (Zero-Direct-Answer & Strict Grounding)**:
   - Sử dụng lại `chat_with_tutor()` từ [backend/agent.py](file:///~/Desktop/AI%20AGENT%20SGK/backend/agent.py).
   - Tuyệt đối KHÔNG mớm đáp án trắc nghiệm hay giải hộ bài tập.
   - Bám sát 100% nội dung bài học SGK từ bảng `packages` (SQLite).
   - Vành đai chống rò rỉ đáp án (`LEAK_PATTERNS`) và cơ chế Fallback Socratic cục bộ khi không có Gemini API key hoặc lỗi mạng.

3. **Bảo mật & Hiệu năng Web**:
   - Header API: `Cache-Control: private, no-store` cho mọi phản hồi AI.
   - Không đưa API AI vào cache của Service Worker (`sw.js`).
   - Giao diện hộp thoại / sheet thân thiện, đạt chuẩn Accessibility (WCAG AAA, touch target $\ge 44\text{px}$, font size $\ge 14\text{px}$, zero-overflow trên các kích thước 360px - 1920px).

---

## 2. Hợp đồng Kỹ thuật (Contract)

### Backend API: `POST /api/pwa/tutor`
- **Request Body**:
  ```json
  {
    "course_id": "tin-hoc-6",
    "lesson_id": "bai-1",
    "message": "Em chưa hiểu thế nào là dữ liệu?",
    "history": [{"role": "user", "content": "..."}, {"role": "model", "content": "..."}],
    "question_id": "q1",
    "selected_option": "B",
    "attempt_count": 1
  }
  ```
- **Response**:
  ```json
  {
    "reply": "Chào em! Trong bài học, dữ liệu là thông tin được ghi lại dưới các dạng...",
    "error": null
  }
  ```

---

## 3. Các bước thực hiện tuần tự (TDD Pipeline)

1. **Bước 1 (Ghi nhật ký)**: Cập nhật kế hoạch vào `aisgk.md`.
2. **Bước 2 (Contract & TDD Backend)**:
   - Thêm Pydantic model `TutorRequest` và `TutorResponse` vào `backend/pwa_contracts.py`.
   - Viết test backend `tests/test_pwa_tutor_api.py` (chạy kiểm tra FAIL trước khi viết code logic).
   - Triển khai endpoint trong `backend/pwa_service.py` và `backend/pwa_api.py`.
   - Chạy test backend `test_pwa_tutor_api.py` đạt PASS.
3. **Bước 3 (Giao diện Frontend & TDD Browser)**:
   - Cập nhật `frontend/hoc/index.html` (thêm hộp thoại Trợ lý Socrates `tutor-dialog`).
   - Cập nhật `frontend/hoc/app.js` (xử lý gọi API `/api/pwa/tutor`, lắng nghe sự kiện `online`/`offline`, render hội thoại).
   - Cập nhật `frontend/hoc/styles.css` (bố cục dialog/drawer squircle, nút bấm $\ge 44\text{px}$, không vỡ layout).
   - Viết test Playwright `tests/test_pwa_tutor_browser.py` kiểm tra tương tác online, chuyển trạng thái offline và kiểm tra zero-overflow.
4. **Bước 4 (Đóng gói & Chống hồi quy)**:
   - Cập nhật hash Service Worker bằng `tools/package_student_pwa.py --stamp`.
   - Chạy toàn bộ test suite PWA để đảm bảo không có bất kỳ regression nào.
5. **Bước 5 (Nghiệm thu & Bàn giao)**:
   - Cập nhật báo cáo thực tế vào `aisgk.md`.
