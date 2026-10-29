# Kế hoạch dài hạn: ứng dụng phụ huynh quản lý con dùng điện thoại / máy tính (ghi nhớ 29/10/2026)

> **Trạng thái:** CHƯA LÀM. Thầy dặn ghi nhớ để làm sau. AI nào được thầy yêu cầu làm phần này **phải đọc hết tệp này trước**.
> Thầy đã xin phép Ban giám hiệu và có **một lớp phụ huynh đồng ý** thí điểm. Lúc trang bị điện thoại cho con, phụ huynh đã có cam kết với con về việc giám sát.
> Bắt đầu sau ngày 30/10/2026 (sau cuộc thi).

## 1. Mong muốn của thầy
- Phụ huynh cài ứng dụng, thêm tài khoản điện thoại của các con.
- Biết con đang ở đâu.
- Biết con dùng điện thoại vào việc gì: mạng xã hội, game.
- AI phân tích con có dấu hiệu dùng mạng xã hội / chơi game quá mức hay không.
- Học sinh không dùng điện thoại mà dùng máy tính bố mẹ mua: có tiện ích cài vào máy tính để bố mẹ yên tâm.
- Làm **Android trước**, chạy thử **1 lớp**, sau đó nhân rộng.

## 2. Kết luận kỹ thuật
- Ứng dụng web hiện tại (PWA) **không** đọc được việc dùng app khác, **không** theo dõi được vị trí khi app đóng. Muốn làm phải có ứng dụng gốc.
- **Android:** làm được gần đủ.
  - Thời gian dùng từng app: công cụ thống kê sử dụng của Android (`UsageStatsManager`), con bật quyền "Truy cập dữ liệu sử dụng" một lần.
  - Vị trí chạy nền: con cấp quyền "luôn cho phép" (`ACCESS_BACKGROUND_LOCATION`), dịch vụ chạy nền có **thông báo cố định**.
  - Vùng Trường / Nhà: báo phụ huynh khi con vào hoặc rời vùng (geofence).
  - Giới hạn giờ chơi (giai đoạn sau): hiện màn hình che lên app (`SYSTEM_ALERT_WINDOW`).
  - Không chặn gỡ app được nếu máy không thuộc quản lý doanh nghiệp. Chỉ **phát hiện** con tắt quyền hoặc mất tín hiệu, rồi báo phụ huynh.
- **iPhone:** Apple không cho đưa dữ liệu thời gian dùng app ra khỏi máy. Phải xin Apple cấp phép Family Controls, và chỉ có tín hiệu thô. Phụ huynh iPhone: hướng dẫn dùng Screen Time của Apple.
- **Phụ huynh xem bằng trang Phụ huynh trong AI Học Tập** (web), dùng được trên cả iPhone và Android.
- **Điểm khác biệt so với Family Link:** Bộ não AI đặt dữ liệu dùng máy cạnh dữ liệu học tập (phút học, điểm, hiểu lầm).

## 3. Máy tính (học sinh không có điện thoại)
- **Tiện ích Chrome/Edge (Manifest V3).**
  - Làm được:
    - đo thời gian thật từng trang (`chrome.idle`, `chrome.tabs`);
    - chặn trang hoặc chặn theo khung giờ (`declarativeNetRequest`);
    - bật Tìm kiếm an toàn, YouTube chế độ hạn chế;
    - gửi báo cáo về trang Phụ huynh.
  - Không làm được: không thấy game cài trên máy (Steam, Roblox bản máy tính), không thấy trình duyệt khác.
  - Claude viết và kiểm thử trọn vẹn được (công nghệ web).
- **Bố trí chống gỡ:**
  1. Con dùng **tài khoản Windows thường**, bố mẹ giữ quyền quản trị.
  2. Bật **Microsoft Family Safety** (miễn phí; Microsoft đã bỏ tính năng vị trí, máy tính để bàn không cần): giới hạn giờ dùng máy, giới hạn app và game, báo cáo.
  3. Cài bắt buộc tiện ích qua **Chrome Enterprise Core** (miễn phí), khóa chế độ ẩn danh. Edge trên máy không được quản lý chỉ cho cài bắt buộc tiện ích từ Microsoft Store.
  4. (Nên) đặt DNS lọc nội dung cho gia đình ở modem wifi.
- Theo dõi game cài trên máy cần thêm chương trình nhỏ chạy trên Windows: để giai đoạn sau, vì cần chứng chỉ ký mã.

## 4. AI phân tích: KHÔNG chẩn đoán "nghiện"
- **Chỉ số:**
  - phút mạng xã hội, game, video mỗi ngày;
  - dùng sau 22 giờ;
  - dùng trong giờ học;
  - số lần mở máy;
  - xu hướng theo tuần so với mức bình thường của chính em;
  - đặt cạnh phút học và điểm số.
- **Mức cảnh báo:** Bình thường / Cần chú ý / Đáng lo, kèm lý do bằng số và gợi ý cách nói chuyện với con.
- Không dùng chữ "nghiện". Rối loạn chơi game theo phân loại bệnh của WHO (ICD-11) cần bác sĩ đánh giá. Chỉ khuyên gặp chuyên gia khi dấu hiệu kéo dài.

## 5. Pháp lý, dữ liệu (bắt buộc trước khi chạy thử)
- **Luật Bảo vệ dữ liệu cá nhân 2025** (Luật 91/2025/QH15, hiệu lực 1/1/2026): cha mẹ thay con thực hiện quyền về dữ liệu. Công bố hoặc tiết lộ đời sống riêng tư của trẻ **từ đủ 7 tuổi** cần sự đồng ý của **cả trẻ và cha mẹ**.
- **Vị trí là dữ liệu nhạy cảm.** Hỏi pháp chế về hồ sơ đánh giá tác động xử lý dữ liệu cá nhân.
- **Giấy đồng ý:** phụ huynh ký, con được giải thích rồi đồng ý. Trên máy con có màn hình "Bố mẹ thấy được gì", ghi rõ không thu thập tin nhắn, ảnh, mật khẩu.
- **Google Play (chính sách stalkerware):**
  - chỉ dành cho cha mẹ theo dõi con;
  - **thông báo cố định** khi app chạy;
  - biểu tượng rõ ràng;
  - cấm ẩn, cấm quảng bá là "theo dõi lén".
- **Kiến trúc dữ liệu:**
  - **KHÔNG** dùng nhánh Firebase đọc công khai như phần thi.
  - Bắt buộc đăng nhập; chỉ phụ huynh của đúng em đó đọc được.
  - **Giáo viên và nhà trường không xem được** vị trí và mạng xã hội.
  - Lịch sử vị trí tự xóa sau 30 ngày.
  - Liên kết phụ huynh với con bằng mã ghép hoặc QR.
- Học sinh là trẻ vị thành niên: không đưa dữ liệu thật lên kho GitHub công khai, không dùng dữ liệu giả trên Firebase thật.

## 6. Phát hành Android cho 1 lớp
- Từ 2026, Google bắt buộc mọi app Android (kể cả cài ngoài Play) phải đăng ký nhà phát triển. Bốn nước đầu tiên áp dụng từ 30/9/2026, toàn cầu từ 2027. Gói miễn phí chỉ cài tối đa 20 máy, **không đủ cho 1 lớp**.
- Đề xuất: tài khoản nhà phát triển **25 USD**, phát hành qua **kênh thử nghiệm nội bộ của Google Play** (tối đa 100 máy).
- **Máy Oppo, Xiaomi, Vivo, Samsung hay tự tắt app chạy nền:** app phải có hướng dẫn bật Tự khởi động và tắt Tối ưu pin theo từng hãng (tham khảo dontkillmyapp.com). Khảo sát hãng máy của lớp trước khi làm.
- Tham khảo mã nguồn mở **TimeLimit.io**: kiểm lại giấy phép. Nếu là GPL thì chỉ học cách làm, không chép mã.
- Build APK: Antigravity build bằng Android Studio trên máy thầy (môi trường đám mây của Claude có thể không tải được Android SDK).

## 7. Lộ trình
| Giai đoạn | Việc | Ước tính |
|---|---|---|
| 0 | Giấy đồng ý; hồ sơ dữ liệu; khảo sát máy điện thoại/máy tính của lớp; đăng ký tài khoản nhà phát triển Google | 1–2 tuần |
| 1 | Trang Phụ huynh (việc học của con: phút học, điểm, chủ đề yếu, báo cáo tuần AI) + đăng nhập kín + tiện ích Chrome/Edge | 2–3 tuần |
| 2 | App Android cho con: thời gian từng app, vị trí, vùng Trường/Nhà, phát hiện tắt app; báo cáo AI | 4–6 tuần |
| 3 | Giới hạn giờ chơi; đánh giá sau 1 tháng; báo cáo Ban giám hiệu | 4 tuần |

## 8. Nguồn đã kiểm (29/10/2026)
- Apple: dữ liệu Device Activity không được đưa ra ngoài phần mở rộng — https://developer.apple.com/forums/thread/727958
- Google Play: chính sách stalkerware — https://support.google.com/googleplay/android-developer/answer/10065487
- Xác minh nhà phát triển Android 2026 — https://thehackernews.com/2026/06/google-sets-sept-30-deadline-for.html
- Microsoft Family Safety: thay đổi tính năng — https://support.microsoft.com (What's new in Microsoft Family)
- Luật 91/2025/QH15 về dữ liệu trẻ em — https://pbgdpl.cantho.gov.vn/quy-dinh-ve-bao-ve-du-lieu-ca-nhan-cua-tre-em-nguoi-bi-mat-hoac-han-che-nang-luc-hanh-vi-dan-su-nguoi-co-kho-khan-trong-nhan-thuc-lam-chu-hanh-vi
