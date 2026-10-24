# Kế hoạch Chuyển đổi sang Firebase Serverless (Zero-Server Architecture)

**Ngày lập**: 24/10/2026  
**Người lập**: Antigravity Agent  
**Mục tiêu**: Vận hành PWA học sinh và trang giáo viên 100% không cần máy chủ riêng (Zero-Server), lưu trữ và đồng bộ đám mây qua Firebase Realtime Database / Firestore, duy trì 100% tính năng học offline khi mất mạng.

---

## 1. Kiến trúc Đề xuất (Zero-Server Architecture)

```
[ Điện thoại Học sinh (PWA) ] ── (IndexedDB Offline / Cache)
             │
             ├── (Đọc bài / Đồng bộ bài nộp)
             ▼
[ Google Firebase Realtime Database ] ◄── (Xuất bản bài / Chấm điểm) ── [ Trang Giáo viên ]
             ▲
             └── (Ủy quyền bảo mật: database.rules.json)
```

1. **Hosting Tĩnh Miễn phí 100%**:
   - Host toàn bộ thư mục `frontend/hoc/` trên **GitHub Pages** hoặc **Firebase Hosting** (0 chi phí duy trì, hoạt động 24/7, có sẵn HTTPS hợp lệ cho PWA).
2. **Kho Dữ liệu Đám mây (Firebase RTDB)**:
   - `/courses/{course_id}`: Danh mục môn và bài học (`public`).
   - `/packages/{course_id}/{lesson_id}/{version}/public`: Bài học công khai (lý thuyết Markdown, câu hỏi, lựa chọn, gợi ý; KHÔNG có đáp án).
   - `/packages_private/{course_id}/{lesson_id}/{version}`: Đáp án đúng và barem chấm (chỉ tài khoản giáo viên mới có quyền đọc).
   - `/attempts/{uid}/{attempt_id}`: Bài làm và điểm số học sinh nộp (đồng bộ thời gian thực).
3. **Bộ điều hợp Kép (Dual Storage Driver)**:
   - Giữ nguyên giao thức API hiện có (`api.js`), tạo adapter `frontend/hoc/firebase_adapter.js`.
   - Nếu chạy có server local: dùng FastAPI + SQLite.
   - Nếu chạy không server (GitHub Pages/Hosting): PWA tự động kích hoạt `firebase_adapter.js` kết nối trực tiếp Firebase SDK.

---

## 2. Giải pháp An toàn & Sư phạm

1. **Bảo vệ Đáp án (Zero-Answer-Leak Law)**:
   - Áp dụng triệt để [database.rules.json](file:///c:/Users/HPZBook/Desktop/AI%20AGENT%20SGK/database.rules.json): Học sinh chỉ đọc được nhánh `/public`, nhánh `/packages_private` bị khóa cứng (`auth.token.admin === true`).
   - Chấm điểm trắc nghiệm: Thực hiện qua cơ chế so khớp hash SHA-256 client-side (với salt per-question) hoặc Cloud Function siêu nhẹ để học sinh không đọc được đáp án gốc.
2. **Bảo vệ Gemini API Key cho Gia sư Socrates**:
   - Không hardcode API key vào JavaScript public trên GitHub Pages.
   - Sử dụng 1 Cloudflare Worker (hoặc Vercel Edge Serverless Function) miễn phí làm proxy bảo mật che giấu `GEMINI_API_KEY`, kiểm soát Rate-Limiting theo IP/UID.
3. **Bảo toàn Chế độ Offline**:
   - Mọi bài học khi tải từ Firebase sẽ được ghi thẳng vào IndexedDB (`aisgk-student-pwa`). Mất mạng hoàn toàn ứng dụng vẫn mở học và làm bài tập bình thường.

---

## 3. Các bước triển khai tuần tự (TDD)

* **Bước 1**: Tạo cấu hình Firebase và kiểm thử kết nối (`tests/test_firebase_pwa_adapter.py`).
* **Bước 2**: Xây dựng `firebase_adapter.js` tương thích 100% hợp đồng `contracts.d.ts`.
* **Bước 3**: Thiết lập Cloudflare Worker proxy cho Gia sư Socrates AI.
* **Bước 4**: Kiểm thử Playwright 2 Browser Contexts xác minh phân quyền `database.rules.json` (chặn học sinh đọc đáp án, đồng bộ thời gian thực đến giáo viên).
