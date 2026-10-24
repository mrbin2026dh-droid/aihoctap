# Định hướng giao diện điện thoại và PWA — 23/10/2026

Đây là phân tích và đề xuất, chưa phải thay đổi giao diện hoặc triển khai PWA.

## 1. Quyết định đề xuất

Chọn web ưu tiên điện thoại, có thể cài PWA; dùng lại backend và dữ liệu hiện có. Giữ trải nghiệm desktop cho giáo viên/phòng máy. Chưa cần làm hai ứng dụng native riêng cho Android/iOS. Sửa các lỗi chức năng đã tái hiện trước khi thử nghiệm PWA với học sinh.

Tách ba tiêu chí nghiệm thu: dễ dùng trên điện thoại; cài lên màn hình chính; hoạt động trong điều kiện mạng yếu/mất mạng. Đạt một tiêu chí không tự động đạt hai tiêu chí còn lại.

## 2. Đánh giá bằng chứng hiện tại

- Có nền tảng responsive: đã mở được bài học, chọn/chấm đáp án và mở chat ở màn hình hẹp. Không thấy tràn ngang tại một số trạng thái ở 390/570/1366px.
- Chưa chứng minh trải nghiệm trên điện thoại thật: kiểm tra viewport desktop không mô phỏng đầy đủ bàn phím ảo, Safari, thao tác quay lại Android, ngắt mạng hay hệ điều hành thu hồi tab.
- Còn lỗi chat Dashboard, lời giải thiếu ngữ cảnh và lệch bài; số liệu tiến độ không thống nhất; hai câu luyện tập dở không khôi phục sau F5. Chi tiết ở BAO_CAO_TEST_WEBSITE_THUC_TE.md.
- Không nên đánh giá bằng việc hết tràn ngang: cần học sinh tìm bài, đọc, làm câu hỏi, hỏi AI và quay lại đúng chỗ mà không bị lạc.
- Mã local có CSS 100dvh/safe-area cho chat nhưng chưa đủ kết luận bàn phím và vùng tai thỏ hoạt động đúng. Trong frontend local chưa tìm thấy manifest, liên kết manifest hoặc đăng ký service worker.

## 3. Áp dụng hai hình tham khảo

Nên học cách tổ chức: danh sách bài dễ quét, một vùng nội dung chính, điều hướng dưới màn hình, thanh nhập chat cố định. Không cần sao chép tên Nguồn/Studio hoặc mọi màu và biểu tượng. Với bài học, phải đọc được số bài và tên đầy đủ; không cắt nhiều tiêu đề tương tự bằng dấu ba chấm.

Đề xuất thanh dưới nhất quán gồm Bài học / Luyện tập / Hỏi AI / Tiến độ. Hồ sơ ở thanh trên. Trong Luyện tập phân biệt ôn tập tự do và bài kiểm tra được giao; không nhầm nút kiểm tra một câu với nộp cả bài thi.

- Bài học: thẻ Tiếp tục học, danh sách bài có tên tối đa hai dòng, trạng thái Chưa học/Đang học/Hoàn thành. Mở bài thì chia nội dung theo mục, có ví dụ và nút luyện tập. Tránh mở chat tự động.
- Luyện tập: mỗi lần một câu; toàn bộ hàng đáp án bấm được; nút kiểm tra rõ ràng, giải thích dưới câu; lưu nháp ngay. Hiển thị đúng Câu 2/4 thay vì gán thành tiến độ cả khóa.
- Hỏi AI: một màn hình riêng trên điện thoại, header luôn ghi khối/bài/câu đang hỏi. Chuyển tab giữ vị trí đọc, đáp án dở và lịch sử phù hợp. Đổi bài không mang ngữ cảnh bài cũ sang âm thầm.
- Tiến độ: chỉ số từ một nguồn dữ liệu thống nhất; phân biệt đã đọc, làm dở, đã hoàn thành và điểm chính thức. Không dùng dữ liệu mẫu.
- Desktop: có thể giữ mục lục và vùng học cạnh nhau; giáo viên có giao diện quản lý rộng. Dùng chung dữ liệu, thích ứng bố cục theo vai trò và thiết bị.

Mục tiêu thiết kế: nội dung khoảng 16–18px, vùng chạm chính 44–48 CSS px, chữ tăng kích thước vẫn dùng được; sáng/tối theo nhu cầu; không chỉ dựa vào màu để báo đúng/sai. Đây là đề xuất, không phải chứng nhận WCAG hiện tại. Bảng/công thức dài cần vùng cuộn riêng, không kéo tràn toàn trang.

## 4. PWA trên hạ tầng dự án

Khả thi: GitHub Pages phục vụ phần tĩnh qua HTTPS; có thể chứa manifest, biểu tượng và service worker. FastAPI/Gemini và chấm điểm vẫn chạy ở backend, không chuyển thành Python chạy trên Pages. Cài PWA không chữa lỗi API, không cấp thêm quota Gemini và không đảm bảo backend luôn sẵn sàng.

Manifest cần tên ứng dụng, biểu tượng thích hợp, chế độ standalone, định danh ổn định, start_url và scope đúng thư mục /aisgk/. Service worker cũng cần đặt và đăng ký đúng phạm vi này. Phải kiểm tra khởi chạy từ biểu tượng và deep link/refresh không đi vào đường dẫn 404. Scope manifest và scope service worker có mục đích khác nhau, cần cấu hình cả hai.

Service worker không phải điều kiện bắt buộc chung cho mọi cách cài hiện nay, nhưng cần cho chiến lược offline của dự án. Chỉ thêm biểu tượng màn hình chính chưa đồng nghĩa đã có trải nghiệm offline đáng tin cậy.

Android: dùng trình duyệt hỗ trợ để Cài ứng dụng/Thêm vào màn hình chính; lời mời cài phụ thuộc trình duyệt. iPhone: hướng dẫn qua Safari, Chia sẻ, Thêm vào Màn hình chính và Open as Web App nếu phiên bản có tùy chọn này. Không hứa một nút cài giống nhau trên mọi thiết bị; không bắt buộc qua App Store/Google Play để phát hành PWA từ web.

## 5. Mạng yếu và an toàn dữ liệu

| Chức năng | Chính sách đề xuất |
|---|---|
| Khung ứng dụng và bài đã tải | Có thể mở offline, ghi phiên bản bài |
| Luyện tập dở | Lưu đáp án cục bộ theo tài khoản/bài/phiên bản |
| Chấm chính thức, đồng bộ tiến độ | Khi có mạng, server xác nhận; trạng thái Đã lưu máy/Đã đồng bộ riêng |
| Gia sư Gemini | Cần mạng và backend; thông báo đúng trạng thái |
| Bài thi được giao | Giai đoạn đầu yêu cầu online; mất mạng lưu nháp, không tự báo đã nộp |

Không cache mọi API. Không lưu gói đáp án đề thi hoặc quyền giáo viên trong bộ cache public. Nội dung nhạy cảm phải có phân quyền, dữ liệu offline tách theo tài khoản và dọn khi đăng xuất. PWA không phải cơ chế chống gian lận.

Đề xuất IndexedDB cho nháp/hàng chờ, server giữ dữ liệu bền. Không hứa dữ liệu trên máy tồn tại vĩnh viễn: người dùng hoặc trình duyệt có thể xóa. Đồng bộ lại khi ứng dụng mở và online; không phụ thuộc việc trình duyệt chắc chắn chạy nền. Chống gửi trùng bằng mã yêu cầu và xử lý idempotent phía server.

Quản lý phiên bản cache; không ép reload giữa bài kiểm tra. Kiểm tra đăng nhập Google ở chế độ standalone trên máy thật; mã local đang dùng popup, không đổi sang redirect một cách máy móc vì khác biệt xử lý lưu trữ giữa trình duyệt.

## 6. Phạm vi học trên điện thoại

Phù hợp: đọc SGK, hình/video, ôn tập, trắc nghiệm, hỏi AI, xem nhận xét/tiến độ. Thực hành phần mềm máy tính, dựng video hoặc thao tác bảng tính cụ thể có thể vẫn cần máy tính. Gắn nhãn Cần máy tính và cung cấp phần chuẩn bị/xem mẫu trên điện thoại; không tuyên bố mọi mục tiêu thực hành đã đạt chỉ bằng mô phỏng.

## 7. Thứ tự làm và nghiệm thu

1. Đóng các lỗi LIVE-01..06, thống nhất trạng thái và lưu nháp; có regression test.
2. Duyệt luồng 4 màn hình và nguyên mẫu cho điện thoại trước khi viết lại diện rộng.
3. Triển khai dần trên kiến trúc hiện có, tách module thay vì nối thêm nhiều CSS override. Chưa có căn cứ phải chuyển framework.
4. Thêm PWA, offline chọn lọc, đồng bộ và cập nhật an toàn.
5. Thử với nhóm nhỏ học sinh trên Android cấu hình thấp và iPhone thật, cả trình duyệt lẫn bản cài. Ghi thao tác hoàn thành, lỗi và điểm gây nhầm lẫn.

Kiểm tra: màn hình 360/390/412px, desktop; bàn phím không che ô nhập/nút gửi; back không làm mất bài; tải lại/khóa màn hình vẫn khôi phục nháp; đổi tài khoản không lộ dữ liệu; mất mạng không báo nộp thành công; phục hồi mạng không nộp trùng; cập nhật không phá phiên thi; cài/mở/gỡ ứng dụng; phóng chữ và công nghệ hỗ trợ; tốc độ tải trên máy/mạng thật. Thời gian tải/AI phải đo, chưa đưa cam kết chưa kiểm chứng.

## Tài liệu chính thức đã đối chiếu

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://web.dev/learn/pwa/installation
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url
- https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest/Reference/scope
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
- https://web.dev/articles/service-worker-lifecycle
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://firebase.google.com/docs/auth/web/redirect-best-practices
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
