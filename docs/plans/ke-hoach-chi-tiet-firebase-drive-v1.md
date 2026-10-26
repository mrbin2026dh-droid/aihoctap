# Kế hoạch chi tiết: Chuyển đổi toàn diện đường thi sang Firebase + Google Drive + Apps Script (Bỏ Worker khỏi đường nóng)

**Ngày lập**: 2026-10-26  
**Tác giả**: Antigravity (Kỹ sư hệ thống)  
**Thẩm định & Phán duyệt**: Claude (Kiểm định viên Độc lập) & Người dùng  
**Mục tiêu cốt lõi**: Đảm bảo kỳ thi 100 học sinh THCS đồng thời trong 45 phút chạy 100% mượt mà, không giật lag, vận hành hoàn toàn trên các gói dịch vụ **0 chi phí** (Cloudflare Workers Free trần 10ms CPU, Firebase Spark, Google Drive & Apps Script miễn phí).

---

## 1. Nguyên tắc thiết kế & Kiến trúc luồng dữ liệu (Dataflow)

### 1.1 Nguyên tắc "Cắt đứt điểm nghẽn Worker"
- **Đường nóng (Hot Path)**: 100 học sinh cùng đăng nhập, nhận đề, lưu nháp, nộp bài trắc nghiệm và tải file thực hành **TUYỆT ĐỐI KHÔNG ĐI QUA CLOUDFLARE WORKER**.
- **Đường nguội (Cold Path)**: Worker chỉ thực hiện nhiệm vụ duy nhất: Proxy cho **Gia sư Socrates AI (Gemini 3.5 Flash)** để bảo mật `GEMINI_API_KEY`. Worker xác thực học sinh bằng Firebase ID Token thông qua Web Crypto RS256 JWKS công khai của Google (chỉ mất ~2ms CPU, hoàn toàn nằm trong trần 10ms).

```
               ┌─────────────────────────────────────────────────────────────┐
               │                     HỌC SINH (PWA Client)                   │
               └──────────────┬───────────────────┬────────────────────┬─────┘
                              │                   │                    │
              [1] Đăng nhập & │   [2] Đọc đề,     │   [3] Nộp file     │ [4] Gia sư AI
                  Xác thực    │   Lưu nháp, Nộp   │       Thực hành    │     (Khi ôn tập)
                              │                   │                    │
                              ▼                   ▼                    ▼
                    ┌──────────────────┐  ┌───────────────┐   ┌────────────────┐
                    │ Firebase Auth    │  │ Apps Script   │   │ Cloudflare     │
                    │ REST API         │  │ Web App /exec │   │ Worker         │
                    └─────────┬────────┘  └───────┬───────┘   │ (Chỉ Gemini)   │
                              │ ID Token          │           └───────┬────────┘
                              ▼                   ▼                   ▼
                    ┌──────────────────┐  ┌───────────────┐   ┌────────────────┐
                    │ Firebase RTDB    │  │ Google Drive  │   │ Google Gemini  │
                    │ (Quy tắc Rules)  │  │ & Sổ điểm     │   │ API            │
                    └──────────────────┘  │ Google Sheet  │   └────────────────┘
                                          └───────────────┘
```

---

## 2. Mô hình Dữ liệu Realtime Database & Quy tắc Bảo mật (Security Rules)

### 2.1 Cấu trúc cây dữ liệu (Data Schema)
```json
{
  "exam_defs": {
    "$exam_id": {
      "title": "Kiểm tra Giữa kỳ Tin 9",
      "grade": 9,
      "minutes": 45,
      "opens_at": 1729900000000,
      "closes_at": 1729904000000,
      "max_attempts": 1,
      "parts": [
        { "key": "theory", "label": "Lý thuyết (Trắc nghiệm)", "max": 4.0, "grader": "auto" },
        { "key": "practice", "label": "Thực hành Excel", "max": 6.0, "grader": "teacher" }
      ],
      "questions": [
        { "id": "q1", "text": "Hàm nào tính tổng trong Excel?", "options": { "A": "SUM", "B": "AVG" }, "points": 2.0 }
      ]
    }
  },
  "exam_secrets": {
    "$exam_id": {
      "q1": "A",
      "q2": "C"
    }
  },
  "sessions": {
    "$exam_id": {
      "$uid": {
        "started_at": 1729900100000
      }
    }
  },
  "drafts": {
    "$exam_id": {
      "$uid": {
        "updated_at": 1729900500000,
        "answers": { "q1": "A" }
      }
    }
  },
  "attempts": {
    "$exam_id": {
      "$uid": {
        "$attempt_num": {
          "submitted_at": 1729902500000,
          "answers": { "q1": "A" }
        }
      }
    }
  },
  "results": {
    "$exam_id": {
      "$uid": {
        "theory_score": 4.0,
        "practice_score": 5.5,
        "total_score": 9.5,
        "status": "graded",
        "evidence_url": "https://drive.google.com/file/d/xxxx",
        "graded_at": 1729903000000
      }
    }
  }
}
```

### 2.2 Quy tắc Bảo mật (`database.rules.json` sản phẩm)
```json
{
  "rules": {
    "exam_defs": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('teachers/' + auth.uid).exists()"
    },
    "exam_secrets": {
      ".read": false,
      ".write": false
    },
    "sessions": {
      "$exam_id": {
        "$uid": {
          ".read": "auth != null && (auth.uid === $uid || root.child('teachers/' + auth.uid).exists())",
          ".write": "auth != null && auth.uid === $uid && !data.exists() && newData.child('started_at').val() === now"
        }
      }
    },
    "drafts": {
      "$exam_id": {
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid && root.child('sessions/' + $exam_id + '/' + $uid + '/started_at').exists() && now <= root.child('sessions/' + $exam_id + '/' + $uid + '/started_at').val() + (root.child('exam_defs/' + $exam_id + '/minutes').val() * 60000) + 30000"
        }
      }
    },
    "attempts": {
      "$exam_id": {
        "$uid": {
          "$attempt_num": {
            ".read": "auth != null && (auth.uid === $uid || root.child('teachers/' + auth.uid).exists())",
            ".write": "auth != null && auth.uid === $uid && !data.exists() && ($attempt_num === '1' || $attempt_num === '2') && root.child('sessions/' + $exam_id + '/' + $uid + '/started_at').exists() && now <= root.child('sessions/' + $exam_id + '/' + $uid + '/started_at').val() + (root.child('exam_defs/' + $exam_id + '/minutes').val() * 60000) + 30000"
          }
        }
      }
    },
    "results": {
      "$exam_id": {
        "$uid": {
          ".read": "auth != null && (auth.uid === $uid || root.child('teachers/' + auth.uid).exists())",
          ".write": false
        }
      }
    }
  }
}
```
*Ghi chú*: Điểm số trong `results` và đáp án trong `exam_secrets` được bảo vệ tuyệt đối: Client F12 không thể đọc đáp án và không thể ghi đè sửa điểm.

---

## 3. Kiến trúc Apps Script & Google Drive Sản phẩm

### 3.1 Chấm bài Trắc nghiệm Song song Chịu lỗi (Dual-Path Grading)
1. **Đường 1 (On-Demand Direct Call)**: Ngay khi học sinh bấm Nộp bài trên PWA, trình duyệt gửi fetch `POST` nhẹ tới Apps Script Web App `/exec` với `action: 'grade_my_attempt'`. Apps Script đọc `exam_secrets`, chấm điểm lý thuyết, ghi `results` và trả về kết quả trong vòng 1–2 giây.
2. **Đường 2 (Fallback Cron Trigger)**: Một time-driven trigger chạy định kỳ mỗi 1 phút trên Apps Script để quét tất cả bài nộp trong `attempts` chưa có bản ghi tương ứng trong `results`. Nếu Đường 1 bị nghẽn do chạm trần 30 luồng đồng thời, Đường 2 tự động hoàn tất việc chấm bài. Học sinh không bao giờ bị mất bài hay treo kết quả.

### 3.2 Tải file Thực hành & Phá rào cản 30 luồng đồng thời
- **Kích thước file tối đa**: 10 MB (các định dạng học tập: `.xlsx`, `.pptx`, `.docx`, `.pdf`, `.sb3`).
- **Giao thức**: Gửi qua `fetch` với `Content-Type: text/plain;charset=utf-8` (chống chặn CORS) chứa chuỗi Base64 của file và Firebase ID Token.
- **Cơ chế Client-Side Exponential Backoff & Jitter**:
  Khi cả lớp 40–100 học sinh cùng nộp bài ở phút thứ 44, client PWA tự động điều phối hàng đợi:
  - Nếu gặp mã lỗi `429` hoặc `503` từ Apps Script, client tự động chờ ngẫu nhiên từ $1.5\text{s} \pm 500\text{ms}$, nhân đôi thời gian ở các lần thử lại sau (tối đa 5 lần).
  - File học sinh làm bài được giữ an toàn trong bộ nhớ `IndexedDB` của trình duyệt cho đến khi nhận được phản hồi xác nhận lưu file thành công kèm File ID từ Drive.

### 3.3 Tổ chức Thư mục Google Drive & Sổ điểm Google Sheets
- **Cấu trúc Thư mục Drive**:
  ```
  Bai thi Tin hoc /
    ├── 9A /
    │   ├── Nguyen Van A - hs9a01 /
    │   │   ├── bai_thuc_hanh_giua_ky.xlsx
    │   │   └── minh-chung_giua-ky-tin9.txt
    │   └── Tran Thi B - hs9a02 /
    │       ├── bai_thuc_hanh_giua_ky.xlsx
    │       └── minh-chung_giua-ky-tin9.txt
    └── 9B /
        └── ...
  ```
- **Sổ điểm Google Sheet Tự động**:
  - Apps Script tự động sinh Sheet `So diem {Tên đề}` với các cột động:
    `[Mã HS, Họ và tên, Lớp, Điểm Lý thuyết (Tự động), Điểm Thực hành (GV nhập), Tổng điểm, Trạng thái, Link File Thực hành, Link Minh chứng]`.
  - Giáo viên chỉ cần mở Sheet trên máy tính hoặc điện thoại, bấm vào link xem bài làm thực hành của học sinh, gõ điểm vào cột **Điểm Thực hành**. Trigger `onEdit` cài sẵn tự động tính **Tổng điểm** và cập nhật ngược vào node `results` trên Firebase RTDB trong vòng < 2 giây.

### 3.4 File Văn bản Minh chứng (`minh-chung_{đề}.txt`)
- Được tạo tự động và cập nhật bằng lệnh `file.setContent()`, tự động kế thừa tính năng Version History của Drive.
- **Nội dung chuẩn sư phạm**:
  ```
  ======================================================================
  PHIẾU MINH CHỨNG KẾT QUẢ BÀI KIỂM TRA
  ======================================================================
  Đề kiểm tra: Kiểm tra Giữa kỳ Tin học 9
  Học sinh: Nguyễn Văn A          Mã số: hs9a01          Lớp: 9A
  Thời gian bắt đầu: 08:00:15     Thời gian nộp: 08:42:10
  ----------------------------------------------------------------------
  PHẦN I: KẾT QUẢ TRẮC NGHIỆM LÝ THUYẾT (4.0 điểm)
  - Câu 1: Hàm nào tính tổng trong Excel?
    + Học sinh chọn: A. SUM
    + Đáp án đúng:   A. SUM
    + Kết quả: ĐÚNG (+1.0 điểm)
  - Câu 2: ...
  Điểm lý thuyết: 4.0 / 4.0 điểm
  ----------------------------------------------------------------------
  PHẦN II: ĐÁNH GIÁ THỰC HÀNH (6.0 điểm)
  - File bài nộp: bai_thuc_hanh_giua_ky.xlsx
  - Điểm giáo viên chấm: 5.5 / 6.0 điểm
  - Nhận xét giáo viên: Kẻ bảng chuẩn, công thức đúng, định dạng đẹp.
  ----------------------------------------------------------------------
  TỔNG ĐIỂM: 9.5 / 10.0 điểm
  Thời gian hoàn tất chấm: 26/10/2026 09:15:00
  ======================================================================
  ```

---

## 4. Danh sách Tệp Mã nguồn Cần Hiệu chỉnh

| Tệp | Phạm vi thay đổi |
|---|---|
| `frontend/hoc/api.js` | Thêm các hàm REST Firebase Auth (`signInWithPassword`, `signUp`) và RTDB REST (`getExamDef`, `putDraft`, `putAttempt`, `fetchResult`). Hỗ trợ cờ chuyển đổi môi trường. |
| `frontend/hoc/app.js` | Tích hợp giao diện làm bài thi trực tiếp với Firebase REST, nộp file thực hành lên Apps Script Web App, hiển thị kết quả và minh chứng. |
| `frontend/hoc/exam-editor.js` | Bổ sung giao diện cài đặt cấu trúc điểm `parts` (Lý thuyết tối đa, Thực hành tối đa, Tự luận). |
| `frontend/hoc/teacher.js` | Tích hợp link mở trực tiếp Sổ điểm Google Sheet, đồng bộ trạng thái bài thi từ Firebase RTDB. |
| `worker/index.js` | Rút gọn toàn bộ code: Xóa bỏ các route exam cũ, xóa bỏ hàm băm PBKDF2 nặng; chỉ giữ lại route `/api/ai/chat` (Gia sư Socrates) với xác thực ID token Firebase qua Web Crypto. |

---

## 5. Cờ Bật/Tắt & Cơ chế Lùi An toàn (Rollback Feature Flag)

Để triệt tiêu mọi rủi ro gián đoạn giảng dạy, toàn bộ hệ thống được bảo vệ bởi cờ cấu hình trong `frontend/hoc/api.js`:
```javascript
export const FEATURE_FLAGS = {
  // true: Chạy hạ tầng mới Firebase REST + Apps Script + Drive (0ms Worker CPU)
  // false: Chạy hạ tầng Cloudflare Worker cũ
  USE_FIREBASE_DIRECT_EXAM: true,
};
```
Nếu xảy ra bất kỳ sự cố kết nối nào ngoài ý muốn, chỉ cần gạt cờ về `false`, ứng dụng sẽ tự động quay trở lại đường dẫn Worker cũ ngay lập tức mà không cần sửa đổi cấu trúc mã nguồn.

---

## 6. Lộ trình Thực hiện 6 Giai đoạn (Phases) & Ước lượng

- **Phase 1 (Ngày 1)**: Thu thập số liệu Bước 0 trên mạng trường, chốt cấu hình Rules `database.rules.json`.
- **Phase 2 (Ngày 2)**: Triển khai Apps Script Web App sản phẩm (Chấm điểm song song, tạo Thư mục Drive, tạo Sổ điểm Sheet).
- **Phase 3 (Ngày 3)**: Nâng cấp `exam-editor.js` hỗ trợ `parts` cấu trúc điểm; cập nhật `api.js` và `app.js` cho màn hình học sinh làm bài thi trắc nghiệm.
- **Phase 4 (Ngày 4)**: Xây dựng module nộp file thực hành lên Drive kèm cơ chế retry chống nghẽn; sinh file văn bản minh chứng `minh-chung.txt`.
- **Phase 5 (Ngày 5)**: Rút gọn Worker Cloudflare chỉ còn Gia sư AI Gemini; chuyển đổi danh bạ học sinh sang Firebase Auth; kiểm thử Firebase Emulator.
- **Phase 6 (Ngày 6)**: Tổ chức thi thử nghiệm thực tế với 30–50 học sinh tại phòng máy trường; đánh giá tải và bàn giao chính thức.
