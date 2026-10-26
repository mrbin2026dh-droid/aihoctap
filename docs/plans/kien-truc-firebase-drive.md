# Kế hoạch kiến trúc: chuyển đường thi sang Firebase + Google Drive (không qua Worker)

Ngày: 2026-10-26. Trạng thái: **bản phân tích, chưa viết code**. Quyết định của chủ dự án: dùng gói miễn phí (Cloudflare Free, Firebase Spark), thi 45 phút ở phòng tin, học sinh THCS (không cần chống gian lận cao cấp, chỉ cần không lộ đáp án khi bấm F12), có bài thực hành Excel/PowerPoint nộp lên Drive.

## 1. Vì sao Worker là điểm nghẽn (đã đo)

Đo trên bản Worker hiện tại, dữ liệu mô phỏng 100 học sinh, 500 bài nộp (CPU trong Node, chỉ cùng bậc độ lớn với Cloudflare):

| Việc | CPU | Dữ liệu đọc từ Firebase |
|---|---|---|
| Xác thực PIN giáo viên (PBKDF2 100.000 vòng) | 23 ms (lần đầu 108 ms) | nhỏ |
| Bài học sinh đã nộp | 27 ms | 124 KB |
| Báo cáo điểm yếu | 32–45 ms | 670 KB |
| Thống kê một đề | 22–40 ms | 677 KB |
| Đăng nhập học sinh (PBKDF2) | ≈ 16 ms | nhỏ |

Cloudflare Workers Free: **10 ms CPU mỗi request**, 100.000 request/ngày ([nguồn](https://developers.cloudflare.com/workers/platform/limits)). Thời gian chờ mạng không tính vào CPU. Kết luận: đăng nhập và các màn hình thống kê vượt giới hạn; tải nhỏ (lưu nháp, nộp bài) thì vừa.

## 2. Các giới hạn đã xác nhận / chưa xác nhận

Đã xác nhận từ tài liệu:
- Firebase Spark: Realtime Database tối đa **100 kết nối đồng thời**, lưu 1 GB; Cloud Functions **không dùng được** (cần Blaze); Authentication email/ẩn danh 50.000 người dùng/tháng miễn phí; vượt hạn mức miễn phí thì Firebase **khóa sản phẩm đó đến hết tháng** chứ không tính tiền ([magora](https://magora-systems.com/firebase-pricing/)).
- Chỉ số "kết nối" của Realtime Database **không tính request REST** ([Firebase billing](https://firebase.google.com/docs/database/usage/billing)); mọi lưu lượng, kể cả bị rules từ chối, tính vào băng thông.
- Apps Script: **30 lần chạy đồng thời**, mỗi lần tối đa 6 phút, URL Fetch 20.000 lần/ngày (tài khoản cá nhân) ([modelmonkey](https://modelmonkey.io/blog/google-apps-script-quotas-limits-2026), [Google](https://developers.google.com/apps-script/guides/services/quotas)). Google có thể đổi hạn mức không báo trước.

Chưa xác nhận (theo trí nhớ, phải thử thật trước khi tin):
- Hạn mức tải xuống hằng tháng của Realtime Database trên Spark (tôi nhớ khoảng 10 GB).
- Giới hạn tốc độ đăng nhập của Firebase Authentication khi 100 học sinh cùng một địa chỉ IP trường.
- Rules của Realtime Database dùng được `now` để kiểm tra giờ và `root.child()` để đọc đề; không có hàm băm trong rules.
- Apps Script: tổng thời gian chạy trigger mỗi ngày (tôi nhớ khoảng 90 phút với tài khoản cá nhân).
- Trình duyệt gọi được Apps Script web app bằng `fetch` với `Content-Type: text/plain` (không bị chặn CORS).

## 3. Kiến trúc đề xuất

Nguyên tắc: **đường nóng (100 em cùng thi) không đi qua Worker**. Worker chỉ làm việc hiếm, nhẹ.

```
Học sinh (trình duyệt)
  ├─ Đăng nhập: Firebase Authentication (email giả mã@hs.aihoc + PIN làm mật khẩu) qua REST  → ID token
  ├─ Đọc đề: Firebase RTDB REST  exam_defs/{id}  (không có đáp án)
  ├─ Lưu nháp / nộp bài: RTDB REST, rules chỉ cho ghi vào đúng nhánh của chính mình, ghi một lần, kiểm tra giờ
  ├─ Nộp file thực hành: Apps Script web app → Drive (tải thẳng, không qua Worker)
  └─ Xem điểm: RTDB results/{đề}/{uid} (chỉ đọc của mình)

Apps Script (chạy bằng tài khoản giáo viên, trigger mỗi phút khi có đề mở)
  ├─ Đọc bài nộp mới từ RTDB (OAuth của chủ dự án), chấm bằng khóa đáp án exam_secrets
  ├─ Ghi results/{đề}/{uid}, ghi Google Sheet bản lưu
  └─ (hiếm) quản trị tài khoản học sinh: tạo/đặt lại PIN/khóa

Giáo viên (trình duyệt)
  ├─ Đăng nhập Firebase Authentication (uid nằm trong teachers/ do Antigravity khai báo)
  └─ Thống kê tính ngay trong trình duyệt từ results/{đề} (nhỏ, theo từng đề)

Cloudflare Worker (giữ lại, chỉ phần hiếm/nhẹ)
  ├─ Gia sư Gemini (giữ khóa API)           → kiểm tra Firebase ID token (RS256, vài ms)
  ├─ Chấm bài luyện tập có đáp án riêng     → như trên
  └─ Quản trị tài khoản học sinh (nếu không dùng Apps Script)
```

### 3.1 Vì sao Firebase Authentication thay cho tự kiểm tra PIN
- Google băm và giới hạn số lần thử giúp mình; không tốn CPU Worker.
- ID token cho phép rules biết `auth.uid`, nên mỗi học sinh chỉ ghi được vào nhánh của mình và không đọc được bài của bạn khác.
- Mật khẩu tối thiểu 6 ký tự, khớp quy tắc PIN 6–16 hiện nay.
- Cần: tạo học sinh phải dùng quyền quản trị (REST tạo tài khoản từ trình duyệt có thể bị người ngoài tạo thêm tài khoản rác; rules chỉ cho tài khoản có trong `students/` mới được dùng nên rác vô hại). Đặt lại PIN cần quyền quản trị → làm bằng Apps Script hoặc Worker.

### 3.2 Đáp án không lộ khi bấm F12
- `exam_secrets/{id}` chỉ giáo viên đọc. Học sinh chỉ nộp câu trả lời; **chấm do Apps Script** (trigger) hoặc nút "Chấm ngay" ở máy giáo viên.
- Hệ quả: học sinh thấy điểm sau tối đa khoảng 1 phút thay vì ngay lập tức (giới hạn trigger 1 phút).

### 3.3 Giờ làm bài và số lần làm bằng rules
- Bắt đầu: ghi `sessions/{uid}/{đề}/started_at = now` (rules bắt buộc đúng bằng `now`, ghi một lần).
- Nộp: chỉ nhận nếu `now ≤ started_at + phút×60000 + 30 giây` và `now ≤ closes_at + 30 giây`.
- Số lần làm: nhánh `attempts/{đề}/{uid}/{n}` với `n ≤ max_attempts`, mỗi `n` ghi một lần.
- Kém chặt hơn máy chủ hiện nay (không có tự nộp khi hết hạn: lưu nháp được chấm khi quá hạn, xem 5.3).

### 3.4 Không dùng SDK WebSocket cho học sinh
100 học sinh + 1 giáo viên bằng SDK = 101 kết nối, **vượt trần 100** của Spark. Dùng REST (không tính kết nối). Giáo viên theo dõi bằng cách tải lại 10–15 giây một lần, không dùng listener.

## 4. Các phương án thay thế đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| A. Giữ Worker, chỉ làm nhẹ (băm nhanh, tính sẵn thống kê, tải tab khi cần) | ít việc, giữ chấm bài ngay | vẫn bị trần 10 ms, giáo viên vẫn quét dữ liệu qua Worker | phương án dự phòng nếu B gặp trở ngại |
| **B. Firebase Auth + RTDB REST + Apps Script (đề xuất)** | bỏ trần CPU, mượt nhất, miễn phí | điểm chậm ≤1 phút, viết lại phần thi, rules phức tạp | **chọn** |
| C. Như B nhưng dùng Firestore | rules mạnh hơn | Spark chỉ 50.000 lượt đọc, 20.000 lượt ghi mỗi ngày; thống kê dễ vượt | không chọn |
| D. Google Sheet/Apps Script làm cơ sở dữ liệu cho cả đăng nhập và thi | không cần Firebase | mỗi lần gọi 1–3 giây, chỉ 30 lần đồng thời → 100 em chắc chắn nghẽn | chỉ dùng cho nộp file và bản lưu |
| E. Supabase miễn phí (Postgres + Auth + RLS) | chấm bài bằng hàm SQL ngay, bảo mật tốt | phải đổi toàn bộ nền tảng; dự án tạm dừng khi không dùng một tuần | chỉ xét nếu B thất bại |
| F. Nâng cấp Cloudflare Paid / Firebase Blaze | gỡ mọi trần | tốn tiền, bạn đã từ chối | không |

## 5. Rủi ro và cách xử lý

1. **Đăng nhập hàng loạt từ một IP.** Firebase Authentication có thể chặn tạm khi nhiều lượt đăng nhập cùng IP. → Thử thật với 30–50 em cùng lớp trước khi quyết (cổng quyết định G1). Phương án lùi: A.
2. **Spark khóa sản phẩm khi vượt hạn mức.** Giữ dữ liệu nhỏ: lưu nháp dạng gọn, không quét toàn bộ cây. Theo dõi băng thông trong Firebase Console sau mỗi buổi thi. → cổng G2.
3. **Apps Script 30 lần đồng thời.** Nộp file: tự thử lại ngẫu nhiên; mỗi lớp một tài khoản Drive/Script. Chấm điểm là một trigger duy nhất nên không chịu giới hạn này.
4. **Quá hạn không nộp.** Trình duyệt tự nộp khi hết giờ; nếu mất mạng, lưu nháp cuối cùng được Apps Script chấm là "nộp muộn" sau hạn + 30 giây (như logic `finalizeExamAttempt` hiện tại).
5. **Học sinh đăng nhập thay bạn nếu biết PIN.** Chấp nhận trong phòng tin; nhắc giữ kín PIN. Mật khẩu do Firebase băm nên không lộ hàng loạt.
6. **Mất bài thực hành.** Chỉ báo "đã nộp" khi Apps Script trả về mã file và dung lượng khớp; file nằm trong trình duyệt đến khi xác nhận; nộp lại giữ cả bản cũ.
7. **Rules sai gây lộ dữ liệu.** Viết test bằng Firebase Emulator trước khi triển khai; mỗi quy tắc có test cho cả trường hợp được và bị từ chối.

## 6. Lộ trình (đề xuất, có cổng quyết định)

- **Bước 0 – Thử nghiệm kỹ thuật (nửa ngày, chưa đụng hệ thống cũ).** Một trang thử: đăng nhập Firebase Authentication bằng REST, ghi nháp, ghi nộp bài qua rules, đọc kết quả. Người dùng (hoặc Antigravity) chạy thử với 30–50 máy cùng mạng trường. **Cổng G1**: đăng nhập không bị chặn, độ trễ dưới 1 giây.
- **Bước 1 – Rules và mô hình dữ liệu** (`students`, `teachers`, `sessions`, `attempts`, `results`, `exam_secrets`) kèm test Firebase Emulator.
- **Bước 2 – Apps Script chấm điểm** (trigger), ghi `results` và Sheet bản lưu. **Cổng G2**: chấm đúng với bộ đề mẫu, thời gian dưới 1 phút với 100 bài.
- **Bước 3 – Màn hình học sinh** chuyển sang đăng nhập và thi qua REST; giữ cờ bật/tắt để vẫn dùng được hệ thống cũ.
- **Bước 4 – Màn hình giáo viên:** tạo/sửa đề, theo dõi, thống kê tính trong trình duyệt theo từng đề; xóa thống kê.
- **Bước 5 – Nộp file thực hành** qua Apps Script (tối đa 10 MB; `.xlsx`, `.pptx`, `.docx`, `.pdf`).
- **Bước 6 – Chuyển tài khoản học sinh hiện có** sang Firebase Authentication (nhập Excel, PIN mới).
- **Bước 7 – Thi thử thật 30–50 học sinh**, rồi thi chính thức một lớp.

## 7. Điều cần chủ dự án quyết định

1. Chấp nhận điểm hiện sau tối đa khoảng 1 phút (vì chấm do trigger) — hay muốn học sinh thấy điểm ngay (phải giữ Worker chấm)?
2. Chấp nhận cách học sinh làm lại: bản cũ và bản mới đều được giữ?
3. Cho phép làm Bước 0 trước để kiểm chứng đăng nhập Firebase từ mạng trường?
4. Tài khoản Google nào làm chủ Apps Script và Drive (Gmail cá nhân hay Workspace trường)?
