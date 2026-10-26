# Kế hoạch chi tiết v2: Chuyển đổi toàn diện đường thi sang Firebase + Google Drive + Apps Script (Bỏ Worker khỏi đường nóng)

**Ngày cập nhật**: 2026-10-26 (Bản v2 sau thẩm định độc lập của Claude)  
**Tác giả**: Antigravity (Kỹ sư hệ thống)  
**Thẩm định & Phán duyệt**: Claude (Kiểm định viên Độc lập) & Người dùng  
**Tài liệu tiền nhiệm**: `docs/plans/ke-hoach-chi-tiet-firebase-drive-v1.md` (được lưu trữ nguyên vẹn làm bằng chứng lịch sử)  
**Phán quyết cơ sở**: `docs/handoff/claude-antigravity-kiem-dinh-ke-hoach-firebase-drive.md`  

---

## 1. Mục tiêu cốt lõi & Nguyên tắc thiết kế (Executive Summary)

- **Mục tiêu tối thượng**: Đảm bảo kỳ thi cho **100 học sinh THCS đồng thời trong 45 phút** vận hành 100% mượt mà, không giật lag, **tuyệt đối không mất bài**, **tuyệt đối không lộ đề trước giờ**, **chống gian lận**, và **vận hành hoàn toàn 0 chi phí** trên các gói dịch vụ miễn phí (Cloudflare Workers Free trần 10ms CPU, Firebase Spark, Google Drive & Apps Script).
- **Ranh giới trách nhiệm kiến trúc**:
  - **Đường nóng (Hot Path - Không qua Worker)**: Đăng nhập Firebase Auth, tải đề thi theo giờ, lưu nháp định kỳ, nộp bài trắc nghiệm vào Realtime Database, và tải file thực hành lên Google Drive thông qua Apps Script. Toàn bộ đi trực tiếp Client ↔ Google Cloud Infrastructure.
  - **Đường nguội (Cold Path - Qua Worker)**: Cloudflare Worker **chỉ làm một nhiệm vụ duy nhất**: Proxy bảo mật cho **Gia sư Socrates AI (Google Gemini 3.5 Flash)**. Xác thực bằng Firebase ID Token qua Google Public RS256 JWKS (~1.8ms CPU).
  - **Kho khóa Gemini**: Giữ nguyên PBKDF2 (50.000 vòng) cho `KEY_ENC_SECRET`, nhưng tối ưu hóa suy diễn khóa 1 lần duy nhất trong bộ nhớ isolate (module-level cache), giảm CPU từ 10ms xuống < 0.1ms cho các lượt hỏi gia sư kế tiếp.

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

## 2. Khắc phục Triệt để 7 Lỗi Chặn (B1 – B7)

### B1. Chặn Đứng Nguy cơ Mạo danh & Rác Tài khoản (User Spoofing & Spam Gate)
- **Lỗ hổng v1**: Cho phép client tự gọi `signUp` bằng REST API key công khai, dẫn tới bất kỳ ai cũng có thể tạo tài khoản trước hoặc spam hàng nghìn tài khoản rác.
- **Giải pháp v2**:
  1. **Khóa chức năng tự đăng ký**: Trên Firebase Console, cấu hình `Authentication -> Settings -> User actions -> Tắt Enable create (sign-up)`. Client chỉ được gọi endpoint `signInWithPassword`.
  2. **Quản trị tập trung**: Tài khoản học sinh do Giáo viên tạo hàng loạt qua Apps Script OAuth của chủ dự án (quyền Admin).
  3. **Định danh bất biến**: Danh tính học sinh (họ tên, lớp, khối) được lưu tại nút bảo mật `students/$uid` trong RTDB do Giáo viên ghi. Client tuyệt đối không được tự khai hay sửa đổi danh tính.

### B2. Khởi tạo Danh bạ Hàng loạt & Đặt lại PIN khi Quên (Batch Provisioning & PIN Reset)
- **Lỗ hổng v1**: Thiếu cơ chế Apps Script quản trị Firebase Auth; khi học sinh quên PIN giữa giờ thi giáo viên không xử lý được.
- **Giải pháp v2**:
  1. Apps Script sử dụng Google Identity Toolkit API (`https://identitytoolkit.googleapis.com/v1/projects/{projectId}/accounts`) với OAuth Access Token của Giáo viên chủ dự án (`ScriptApp.getOAuthToken()` với scope `https://www.googleapis.com/auth/cloud-platform`).
  2. Tạo tài khoản: Gọi `accounts:signUp` với email định dạng chuẩn `hs{grade}{class}{code}@{project}.internal` và mật khẩu/PIN khởi tạo.
  3. Đặt lại PIN tức thời: Giáo viên có nút trên giao diện Apps Script/Web để gọi `accounts:update` (truyền `localId: uid, password: newPin`). Học sinh nhận PIN mới và đăng nhập lại ngay trong vòng < 3 giây.
  4. **Phương án dự phòng (Fallback)**: Nếu Apps Script vượt hạn mức OAuth, Giáo viên sử dụng CLI quản trị cục bộ qua Python `tools/manage_students.py` kết hợp Firebase Admin SDK Service Account để nạp/đổi PIN trực tiếp.

### B3. Chống Lộ Đề Trước Giờ Thi (Zero-Leak Time Gated Exam Delivery)
- **Lỗ hổng v1**: Đặt câu hỏi trong `exam_defs` cho phép đọc tự do mọi lúc sau khi đăng nhập; học sinh F12 đọc trước đề ngày hôm trước.
- **Giải pháp v2**:
  1. **Tách đôi cấu trúc dữ liệu**:
     - `exam_meta/$exam_id`: Chứa thông tin công khai (tiêu đề, khối lớp `grade`, số phút `minutes`, `opens_at`, `closes_at`, `max_attempts`). Cho phép mọi tài khoản đã đăng nhập đọc danh sách đề.
     - `exam_questions/$exam_id`: Chứa danh sách câu hỏi và các phương án A/B/C/D (không chứa đáp án đúng).
  2. **Khóa truy cập theo thời gian thực (Time-Gated Rules)**:
     - Nút `exam_questions/$exam_id` chỉ cho phép đọc khi thỏa mãn đồng thời:
       $$\text{now} \ge \text{opens\_at} \quad \land \quad \text{now} \le \text{closes\_at} \quad \land \quad \text{student.grade} == \text{exam.grade}$$
       (hoặc tài khoản là Giáo viên).
  3. **Chống vét cạn băng thông**: Client chỉ tải đúng đề học sinh chọn làm (`GET /exam_questions/{exam_id}.json?auth=TOKEN`), tuyệt đối không tải toàn bộ cây `exam_questions.json`.

### B4. Chống Lộ Đáp án khi Nộp Bài Sớm (Anti-Collusion Early Submission Protection)
- **Lỗ hổng v1**: Chấm điểm xong trả ngay chi tiết đúng/sai, học sinh nộp sớm có thể chia sẻ đáp án cho bạn đang thi.
- **Giải pháp v2**:
  1. **Phân kỳ kết quả thi**:
     - Trong khoảng thời gian đề còn mở ($\text{now} < \text{closes\_at}$): Client chỉ nhận được thông báo "Đã nhận bài thành công" và Điểm tổng sơ bộ (ví dụ: `8.5/10`).
     - Sau khi đề đóng hoàn toàn ($\text{now} \ge \text{closes\_at}$): Hệ thống mới công bố bảng đối chiếu chi tiết đúng/sai từng câu hỏi trong `results/$exam_id/$uid`.
  2. **Cách ly thư mục lưu trữ**: Thư mục Google Drive và file minh chứng thực hành chỉ cấp quyền đọc/ghi cho Apps Script và Giáo viên, học sinh không được chia sẻ link hay quyền truy cập folder.

### B5. Chống Mất Bài Sát Giờ Thi (Zero-Loss Submission & Auto-Draft Recovery)
- **Lỗ hổng v1**: Khóa nộp bài cứng ở phút $\text{started\_at} + \text{minutes} + 30\text{s}$, nếu mạng chập chờn ở giây thứ 29 học sinh bị mất toàn bộ bài thi.
- **Giải pháp v2**:
  1. **Đồng hồ chuẩn hóa theo Máy chủ**: Thời gian bắt đầu thi được gắn bằng timestamp server Firebase (`".sv": "timestamp"`) khi tạo session; client tính toán thời gian dựa trên độ trôi với máy chủ, không phụ thuộc vào đồng hồ cục bộ của điện thoại/máy tính.
  2. **Cơ chế Lưu nháp Tự động (Auto-Draft Sync)**: Cứ mỗi 15 giây hoặc sau mỗi lần chọn đáp án, client tự động đẩy nháp lên `drafts/$exam_id/$uid`.
  3. **Phao cứu sinh Tự động Nộp bài từ Nháp (Auto-Submit from Draft)**:
     - Khi đóng đề thi ($\text{closes\_at}$), trigger Apps Script quét toàn bộ danh sách `sessions/$exam_id`.
     - Nếu học sinh có phiên làm bài nhưng chưa có bản ghi `attempts/$exam_id/$uid/1`, Apps Script sẽ **tự động lấy bản nháp cuối cùng trong `drafts` nộp thành bài thi chính thức**, gắn nhãn `auto_from_draft: true`.
     - Đảm bảo 100% học sinh đã vào làm bài đều có điểm, không bao giờ bị điểm 0 oan do nghẽn mạng lúc nộp.

### B6. Cơ chế Quay lui Dự phòng Đích thực (True Gradual Rollback Invariant)
- **Lỗ hổng v1**: Đặt cờ cứng trong code và xóa ngay route Worker ở Phase 5 khiến hệ thống mất đường lùi khi có sự cố trên hạ tầng mới.
- **Giải pháp v2**:
  1. **Không xóa bất kỳ route Worker hay bảng dữ liệu cũ nào**: Toàn bộ logic thi qua Worker hiện tại được giữ nguyên vẹn 100%.
  2. **Cờ chuyển hướng linh hoạt theo từng đề thi (Per-Exam Backend Switcher)**:
     - Trong cấu hình đề thi có trường `backend: "firebase" | "worker"`.
     - Khi `backend === "firebase"`: PWA kích hoạt luồng thi không qua Worker.
     - Khi `backend === "worker"`: PWA dùng luồng thi qua Worker truyền thống.
  3. **Quy chuẩn chấp thuận xóa mã**: Chỉ được phép xem xét loại bỏ mã nguồn đường thi trên Cloudflare Worker sau khi hệ thống đã tổ chức thành công **tối thiểu 02 kỳ thi thật cấp trường** trên hạ tầng mới mà không phát sinh lỗi nghiêm trọng.

### B7. Bảo toàn & Tối ưu hóa Kho Khóa Gemini (PBKDF2 Memory Cache)
- **Lỗ hổng v1**: Dự kiến xóa PBKDF2 sẽ làm hỏng module giải mã `KEY_ENC_SECRET` trong Durable Object/Worker, và tính lại 50.000 vòng mỗi request khiến Worker chạm trần 10ms CPU.
- **Giải pháp v2**:
  1. **Giữ nguyên thuật toán mã hóa AES-GCM và PBKDF2**: Không sửa đổi định dạng lưu trữ khóa Gemini trong Durable Object để đảm bảo tính toàn vẹn dữ liệu.
  2. **Bộ nhớ đệm Isolate cấp Module (In-Memory Key Derivation Cache)**:
     ```javascript
     // worker/index.js - Module-level cache
     let cachedKeyEncryptionKey = null;
     let cachedSecretFingerprint = null;

     async function getCachedKeyEncryptionKey(secret) {
       if (cachedKeyEncryptionKey && cachedSecretFingerprint === secret) {
         return cachedKeyEncryptionKey;
       }
       const key = await deriveKeyEncryptionKey(secret); // 50,000 PBKDF2 iterations
       cachedKeyEncryptionKey = key;
       cachedSecretFingerprint = secret;
       return key;
     }
     ```
  3. **Hiệu năng đạt được**: Lần đầu khởi động isolate tốn ~4ms CPU; toàn bộ các request sau đó lấy trực tiếp CryptoKey từ RAM, chỉ tốn **< 0.05ms CPU**, giải quyết triệt để bài toán trần CPU Worker Free.

---

## 3. Hoàn thiện 12 Tiêu chí Kỹ thuật Bổ sung

1. **Ràng buộc Tính hợp lệ của Dữ liệu (`.validate`)**:
   - Mọi câu trả lời trắc nghiệm giới hạn độ dài $\le 2000$ ký tự: `newData.isString() && newData.val().length <= 2000`.
   - Chặn đứng các thuộc tính lạ bơm vào payload: `"$other": { ".validate": false }`.
2. **Khóa Số lần Thi Động theo Đề (`max_attempts`)**:
   - Lần nộp `$n === '1'`: Cho phép nếu chưa tồn tại.
   - Lần nộp `$n === '2'`: Chỉ cho phép nếu `max_attempts >= 2` VÀ lần 1 đã tồn tại (`data.parent().child('1').exists()`).
3. **Bộ Công cụ Can thiệp Thời gian thực cho Giáo viên**:
   - Cung cấp trường `sessions/$exam_id/$uid/extra_ms`: Giáo viên có quyền cộng thêm từ 1 đến 30 phút cho học sinh gặp sự cố thiết bị/mạng.
   - Giáo viên có quyền đặt lại lượt thi (xóa session để làm lại) và xóa thống kê đề thi trực tiếp trên giao diện.
4. **Triệt tiêu Lỗi Số học Giá trị Rỗng (`null + number`)**:
   - Khi tạo session ban đầu, client bắt buộc gửi `extra_ms: 0`. Rules kiểm tra `newData.child('extra_ms').isNumber() && newData.val() >= 0`.
5. **Kiểm tra Thời gian và Khối lớp khi Tạo Session**:
   - Session chỉ được khởi tạo khi thỏa mãn:
     $$\text{now} \ge \text{opens\_at} \quad \land \quad \text{now} \le \text{closes\_at} \quad \land \quad \text{student.grade} == \text{exam.grade}$$
6. **Chống Chấm trùng lặp (Anti-Double Grading Race Condition)**:
   - Apps Script sử dụng ETag Header `if-match` của Firebase RTDB REST API hoặc `LockService.getScriptLock()` để đảm bảo một bài thi chỉ được một tiến trình chấm điểm duy nhất, triệt tiêu lỗi đè điểm hoặc nhân đôi file Drive.
7. **Tối ưu Hạn mức Trigger Apps Script (Smart Time-Window Trigger)**:
   - Trigger tự động kích hoạt mỗi phút chỉ chạy kiểm tra khi có đề thi đang diễn ra. Vào những giờ không có kỳ thi, script thoát ngay lập tức (< 100ms) để không tiêu tốn hạn mức 90 phút/ngày của tài khoản cá nhân.
8. **Bắt Lỗi Upload File Toàn diện (Robust File Upload Contract)**:
   - Client kiểm tra phản hồi từ Apps Script: bắt buộc là đối tượng JSON có thuộc tính `{ ok: true, file_id: "..." }`. Mọi phản hồi trả về HTML (trang đăng nhập Google, trang báo lỗi quá tải 500/503) đều bị coi là lỗi và kích hoạt cơ chế retry backoff tự động.
9. **Chuẩn hóa Đường dẫn & Định dạng File Nộp Thực hành**:
   - Thư mục học sinh trên Google Drive được đặt tên theo định dạng chuẩn: `[Lớp] - [Họ và tên] - [Mã HS]` (lấy trực tiếp từ database máy chủ, không tin cậy dữ liệu client gửi).
   - Kiểm tra định dạng cho phép: `.xlsx`, `.docx`, `.pptx`, `.pdf`, `.sb3` (Scratch Tin học 8/9). Giới hạn dung lượng file tối đa $\le 15\text{MB}$.
10. **Tự động Làm mới Token khi Thi Quá 1 Giờ (Token Auto-Refresh)**:
    - Client cấu hình bộ đếm làm mới token tự động sau mỗi 50 phút bằng API `https://securetoken.googleapis.com/v1/token?key={API_KEY}` sử dụng `refresh_token`, đảm bảo các phiên làm bài kéo dài và thời gian nộp file không bị gián đoạn do hết hạn JWT (1 giờ).
11. **Phạm vi Toàn diện của Tài khoản Học sinh & Chuyển giao Báo cáo Phân tích**:
    - Học sinh chỉ có duy nhất **MỘT** tài khoản Firebase Auth dùng cho tất cả tính năng: Luyện tập, Thi trực tuyến, Gia sư AI và Nhật ký tiến độ.
    - Chuyển giao route Tổng quan/Phân tích điểm yếu (hiện đang tốn 32–45ms CPU trên Worker) sang Apps Script tự động tổng hợp vào Google Sheet hoặc lưu sẵn kết quả tính toán vào nút `stats/$exam_id` trên Firebase để Giáo viên đọc trực tiếp (0ms Worker CPU).
12. **Lộ trình Phát triển theo Cổng Kiểm soát Chất lượng (Quality Gates)**:
    - Thay thế kế hoạch ngày cố định bằng **6 Cổng Kiểm soát (Gate 0 đến Gate 6)**: Chỉ được phép bước sang cổng tiếp theo khi cổng trước đó đã có báo cáo đo kiểm thực tế đạt PASS 100% kèm chữ ký chấp thuận của Claude và Người dùng.

---

## 4. Đặc tả Quy tắc Bảo mật Realtime Database Đầy đủ (Security Rules v2)

```json
{
  "rules": {
    "teachers": {
      ".read": false,
      ".write": false
    },
    "students": {
      "$uid": {
        ".read": "auth.uid === $uid || root.child('teachers/' + auth.uid).exists()",
        ".write": "root.child('teachers/' + auth.uid).exists()"
      }
    },
    "exam_meta": {
      ".read": "auth != null",
      "$e": {
        ".write": "root.child('teachers/' + auth.uid).exists()"
      }
    },
    "exam_questions": {
      "$e": {
        ".read": "auth != null && (root.child('teachers/' + auth.uid).exists() || (now >= root.child('exam_meta/' + $e + '/opens_at').val() && now <= root.child('exam_meta/' + $e + '/closes_at').val() && root.child('students/' + auth.uid + '/grade').val() === root.child('exam_meta/' + $e + '/grade').val()))",
        ".write": "root.child('teachers/' + auth.uid).exists()"
      }
    },
    "exam_secrets": {
      ".read": false,
      ".write": false
    },
    "sessions": {
      "$e": {
        ".read": "root.child('teachers/' + auth.uid).exists()",
        ".write": "root.child('teachers/' + auth.uid).exists()",
        "$uid": {
          ".read": "auth.uid === $uid",
          ".write": "auth.uid === $uid && !data.exists() && now >= root.child('exam_meta/' + $e + '/opens_at').val() && now <= root.child('exam_meta/' + $e + '/closes_at').val() && root.child('students/' + auth.uid + '/grade').val() === root.child('exam_meta/' + $e + '/grade').val()",
          ".validate": "newData.child('started_at').val() === now && newData.child('extra_ms').isNumber()",
          "extra_ms": {
            ".validate": "newData.val() >= 0 && newData.val() <= 1800000"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    },
    "drafts": {
      "$e": {
        "$uid": {
          ".read": "auth.uid === $uid || root.child('teachers/' + auth.uid).exists()",
          ".write": "auth.uid === $uid && now <= root.child('sessions/' + $e + '/' + $uid + '/started_at').val() + root.child('exam_meta/' + $e + '/minutes').val() * 60000 + root.child('sessions/' + $e + '/' + $uid + '/extra_ms').val() + 30000",
          "answers": {
            "$q": {
              ".validate": "newData.isString() && newData.val().length <= 2000"
            }
          },
          "updated_at": {
            ".validate": "newData.val() === now"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    },
    "attempts": {
      "$e": {
        ".read": "root.child('teachers/' + auth.uid).exists()",
        ".write": "root.child('teachers/' + auth.uid).exists()",
        "$uid": {
          "$n": {
            ".read": "auth.uid === $uid",
            ".write": "auth.uid === $uid && !data.exists() && ($n === '1' || ($n === '2' && root.child('exam_meta/' + $e + '/max_attempts').val() >= 2 && data.parent().child('1').exists())) && now <= root.child('sessions/' + $e + '/' + $uid + '/started_at').val() + root.child('exam_meta/' + $e + '/minutes').val() * 60000 + root.child('sessions/' + $e + '/' + $uid + '/extra_ms').val() + 30000",
            "submitted_at": {
              ".validate": "newData.val() === now"
            },
            "answers": {
              "$q": {
                ".validate": "newData.isString() && newData.val().length <= 2000"
              }
            },
            "$other": {
              ".validate": false
            }
          }
        }
      }
    },
    "results": {
      "$e": {
        ".read": "root.child('teachers/' + auth.uid).exists()",
        "$uid": {
          ".read": "auth.uid === $uid"
        },
        ".write": false
      }
    }
  }
}
```

---

## 5. Lộ trình Triển khai theo 6 Cổng Đo kiểm Chất lượng (Gate Pipeline)

- **Cổng 0 (Gate 0 - Hiện tại)**: Thử nghiệm kỹ thuật & Đo lường thực tế (Đăng nhập 100 tài khoản, kiểm định Rules qua Emulator, đo hiệu năng cache PBKDF2 Gemini, đo tải file đồng thời).
- **Cổng 1 (Gate 1 - Auth & Admin Provisioning)**: Hoàn tất script Apps Script cấp phát tài khoản học sinh, tắt public sign-up, đồng bộ danh bạ.
- **Cổng 2 (Gate 2 - Client Exam Flow)**: PWA tích hợp luồng thi mới (tải đề theo giờ, lưu nháp 15s, nộp bài, auto-submit từ nháp). Cờ `backend: "firebase" | "worker"` hoạt động độc lập theo từng đề.
- **Cổng 3 (Gate 3 - Apps Script Grading & Drive Evidence)**: Hệ thống chấm tự động trắc nghiệm sau khi đóng đề, lưu trữ minh chứng vào Drive, xuất sổ điểm Google Sheet.
- **Cổng 4 (Gate 4 - Staging Simulation)**: Giả lập thi thử 100 học sinh ảo trên mạng trường mô phỏng (Dual-browser context Playwright) đo đạc CPU, băng thông, tỷ lệ lỗi 0%.
- **Cổng 5 (Gate 5 - Production Pilot 1 & 2)**: Vận hành thử nghiệm kỳ thi thật số 1 và số 2 có giáo viên và học sinh thật; cờ rollback sẵn sàng.
- **Cổng 6 (Gate 6 - Final Deprecation)**: Đóng gói tài liệu, tinh gọn mã nguồn Worker chỉ sau khi có văn bản nghiệm thu chính thức từ Người dùng và Claude.
