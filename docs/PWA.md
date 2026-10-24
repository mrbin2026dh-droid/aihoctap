# PWA học sinh và trang xuất bản

PWA nằm tại `/hoc/`; trang giáo viên tại `/hoc/teacher.html`. Dùng cùng backend FastAPI hiện có. Học sinh đăng nhập bằng mã sáu chữ số trong sổ bộ nhà trường; phiên PWA hiện hỗ trợ luồng mã học sinh. Trang đầy đủ giữ luồng đăng nhập Google hiện có.

## Giao diện học sinh đã hoàn thiện trong bản local

- **Môn học:** chọn khối, tìm tên bài/môn, lọc môn và mở bài trực tiếp. Khối chưa có bài được ghi rõ; chỉ khách được chuyển sang khối có nội dung, tài khoản học sinh giữ đúng khối server cấp.
- **Bài tập:** danh sách luyện tập riêng. Đọc bài, xem gợi ý, theo dõi số câu đã trả lời, lưu nháp, tiếp tục bài đang làm, nộp bài và xem feedback từng câu. Câu trả lời khách được chuyển sang nháp mới khi đăng nhập đúng khối; không ghi đè nháp tài khoản đã có. Kết quả được xác nhận và nút Làm lại vẫn xuất hiện sau reload.
- **Đã tải:** mở bài offline hoặc xóa riêng bản tải; thao tác này không xóa nháp/bài chờ nộp. Không tự tải mọi bài khi cài app.
- **Tiến độ:** tách chờ gửi, máy chủ đã nhận và tự luận chờ giáo viên. Chỉ đồng bộ khi có phiên và mạng. Cỡ chữ, điều khiển cảm ứng, nhãn và bố cục đã kiểm tra trên mobile/desktop.
- **Cài ứng dụng:** nút luôn có; trình duyệt hỗ trợ thì mở native prompt, trường hợp khác hiển thị hướng dẫn Chrome/Edge/Safari. Chỉ xác nhận cài theo sự kiện trình duyệt hoặc trạng thái standalone; đóng prompt không bị coi là đã cài.

## PWA đạt đến đâu?

Kiểm tra Chromium local ngày 24/10/2026: manifest không lỗi, installability errors rỗng, secure context và SW điều khiển trang; offline/restart/nháp/outbox/cập nhật đã có test. Đây là bằng chứng kỹ thuật local, **chưa xác nhận cài OS thực tế trên thiết bị của người dùng**. Tab trình duyệt không phải ứng dụng đã cài. [Phán quyết UI/PWA độc lập](audits/2026-10-24-student-ui-verdict.md).

Toàn bộ kế hoạch sản phẩm chưa nghiệm thu production: còn cài/thử điện thoại thật, HTTPS/kho bền/auth/backup cloud và migration đáp án legacy. Lớp 7/8 chưa có nội dung. PWA hiện dùng mã học sinh; Google ở trang desktop riêng. Tự luận được gửi và hiển thị chờ giáo viên; quy trình giáo viên nhập/chốt điểm tự luận đầy đủ chưa được triển khai ở đợt UI này.

## Chạy tại máy

Từ thư mục gốc, dùng runtime/dependencies hiện có:

```powershell
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

Mở `http://127.0.0.1:8000/hoc/` hoặc `http://127.0.0.1:8000/hoc/teacher.html`. Không dùng file:// vì Service Worker/IndexedDB cần web origin. Điện thoại cần HTTPS hợp lệ; truy cập HTTP bằng IP LAN không bảo đảm Service Worker hoạt động.

Lần đọc danh mục hoặc xuất bản đầu tiên nhập các bài Tin học có trạng thái published từ kho backend hiện có; không tự xuất bản bản nháp hoặc nội dung AI mới. Marker chỉ ghi khi hoàn tất; nếu gián đoạn, lần sau nhập tiếp các bài thiếu và giữ nguyên bài đã được giáo viên sửa. Sau đó giáo viên có thể thêm môn/bài ở trang xuất bản. Bài đang làm gắn với phiên bản bất biến, kể cả khi đáp án được sửa.

## Lưu trữ và quyền

- Local mặc định: `scratch/pwa/student-pwa.sqlite3` (không vào Git). Đặt `PWA_DATABASE_PATH` để chọn vị trí lưu được sao lưu thường xuyên. Không xóa thư mục chứa DB đang dùng.
- Render: gắn persistent disk thật, đặt `PWA_DURABLE_DIRECTORY` tới thư mục đã tồn tại trên disk; `PWA_DATABASE_PATH`, nếu đặt, phải nằm bên trong. Không có cấu hình này, API từ chối ghi bằng HTTP 503. Tên biến môi trường không tự chứng minh disk đã được gắn: phải kiểm tra hạ tầng và restart persistence trước pilot.
- Bản hiện tại dùng SQLite; không có adapter Firebase PWA. Cần một service instance dùng cùng disk. Không dùng nhiều replica độc lập hoặc disk tạm. Cơ chế phiên đăng nhập hiện có vẫn ở RAM, có thể yêu cầu đăng nhập lại sau restart.
- API private yêu cầu phiên giáo viên/học sinh hiện có; phản hồi private/401/ACK mang no-store. Danh tính nộp bài lấy từ server. PWA không gọi LLM và không ghi Firebase ẩn danh.
- Nội dung công khai có thể đọc không đăng nhập. Quyền nộp bài kiểm tra khối lớp; chưa có phân quyền nội dung theo từng lớp/assignment riêng. Bản này phục vụ tự học, chưa nghiệm thu cho bài thi cần giữ bí mật đáp án.

## Offline và cập nhật

Tải bài khi có mạng để kiểm tra SHA-256 rồi lưu gói hoàn chỉnh vào IndexedDB. Service Worker chỉ cache tệp khung học sinh; không cache trang giáo viên/API private. Nháp và bài chờ tách theo tài khoản. Chỉ khi nhận ACK phù hợp mới báo đã nộp; mất mạng không tự tạo điểm chính thức.

Khi thiết bị đóng/offline, không hứa đồng bộ nền. Mở lại với mạng và phiên hợp lệ để gửi hàng đợi. Đăng xuất giữ nháp riêng trên thiết bị; đây không phải mã hóa dữ liệu trước người có quyền truy cập cùng browser profile. Hệ điều hành có thể thu hồi storage: bản chưa đồng bộ có thể mất nếu người dùng xóa dữ liệu hoặc máy hết dung lượng. Sao lưu DB phía máy chủ là trách nhiệm vận hành.

SW mới chờ kích hoạt; nút cập nhật lưu nháp và chặn cập nhật khi còn câu trả lời đang làm. Không thay phiên bản nội dung của attempt đang mở.

## Kiểm thử và đóng gói

```powershell
python tools/package_student_pwa.py --stamp --output scratch/student-pwa.zip
python -m pytest tests/test_pwa_api.py tests/test_pwa_audit.py tests/test_pwa_entry.py tests/test_pwa_browser.py tests/test_pwa_browser_audit.py tests/test_pwa_package.py -q --basetemp=scratch/pytest-pwa
```

`--stamp` gắn hash byte của shell vào tên cache. Sau mọi sửa shell, chạy lại stamp, test và review trước khi phát hành. ZIP dùng allowlist gồm thư mục `hoc/`, không đóng gói backend, sổ bộ, DB, `.env` hoặc curriculum/exams legacy. ZIP cần backend có API `/api/pwa`; không phải ứng dụng server độc lập. API client nhận backend cùng origin hoặc hostname GitHub Pages đã cấu hình trong `api.js`.

Chưa deploy trong lần tiếp nối này. Trước release cần kiểm tra hạ tầng bền, backup/restore, HTTPS, tài khoản thật trên staging và Android/iPhone thật. Website cũ vẫn có JSON tĩnh chứa đáp án; đóng gói PWA riêng không sửa được các URL legacy đó. Phải có migration tương thích và kiểm tra artifact public toàn site trước khi cam kết bí mật đáp án. Không tự xóa dữ liệu cũ hoặc nới quyền để vượt gate.
