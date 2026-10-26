# Bước 0: đo kỹ thuật Firebase + Apps Script, rồi lập kế hoạch chi tiết bỏ Worker khỏi đường thi
Từ: Claude → Sang: Antigravity   Ngày: 2026-10-26 (Asia/Bangkok)

## Mục tiêu
Người dùng muốn gói miễn phí (Cloudflare Free 10 ms CPU, Firebase Spark) mà thi 100 học sinh không giật. Hướng đã chốt: đăng nhập bằng Firebase Authentication, nộp bài vào Realtime Database bằng REST, Apps Script chấm trắc nghiệm + lưu Drive + Sổ điểm Google Sheet; **Worker chỉ còn giữ khóa Gemini**. Việc của bạn: (1) chạy Bước 0 để có số liệu thật; (2) từ số liệu đó viết kế hoạch chi tiết để sửa hệ thống, tránh lỗi/giật.

## Tệp cần đọc
`docs/plans/kien-truc-firebase-drive.md` (nhất là mục 3, 5, 8), `spike/step0/README.md`. Không đọc thêm.

## Việc 1 – Chạy Bước 0 (không đụng dữ liệu thật)
1. **Khuyên:** tạo một dự án Firebase thử riêng (Spark), bật Authentication → Email/Password, tạo Realtime Database, triển khai `spike/step0/database.rules.spike-only.json`. (Nếu buộc dùng dự án thật: dùng `database.rules.merged.json`, xóa nhánh `spike` sau khi xong.)
2. Tạo dự án Apps Script bằng tài khoản Google định dùng thật; dán `spike/step0/apps-script/Code.gs`, `appsscript.json`; đặt Script properties `FIREBASE_API_KEY`, `DB_URL`; thêm tài khoản đó làm thành viên dự án Firebase (Editor). Chạy tay `testRtdb`, `testDrive`, `installTriggers`; triển khai Web app (Execute as: Me, Who has access: Anyone) và lấy URL `/exec`.
3. Mở trang đo `https://mrbin2026dh-droid.github.io/aihoctap/spike-step0/` (sau khi push lên Pages xong) hoặc chạy cục bộ thư mục `frontend/hoc`. Điền API key, Database URL, URL Apps Script.
4. Bấm nút 1 (một học sinh). Bấm nút 2 với N=30 hai lần (lần 1 tạo tài khoản, lần 2 đo đăng nhập thuần), rồi N=50 và N=100, **từ máy ở mạng trường/mạng nhà (cùng một IP)**; nếu được nhờ 5–10 máy cùng bấm nút 1 cùng lúc.
5. Sửa ô D2 trong Sổ điểm thử, đo độ trễ trigger (`showLastEdit`); để trigger mỗi phút chạy 10 phút, xem Executions.

## Báo cáo cần điền vào `docs/handoff/antigravity-claude-buoc0-ket-qua.md`
| Mục | Kết quả |
|---|---|
| Đăng nhập Firebase N=30/50/100 cùng IP: số thành công, p50/p95 ms, mã lỗi (đặc biệt TOO_MANY_ATTEMPTS_TRY_LATER) | |
| Quy tắc: nộp không hợp lệ/nộp đè/ghi bài người khác/đọc khóa đáp án đều bị 401? Quy tắc `now` chạy đúng? | |
| Lưu nháp p50/p95 ms | |
| Apps Script gọi từ trình duyệt (github.io): có bị chặn CORS không, ms | |
| Apps Script đọc/ghi RTDB bằng OAuth (`testRtdb`) | |
| Drive: tạo thư mục+file ms (`testDrive`), ghi đè được không | |
| Trigger mỗi phút: có trễ không, thời gian chạy mỗi lần; trigger "khi sửa" trễ bao lâu | |
| Băng thông/kết nối RTDB trong Console sau thử nghiệm | |
| Apps Script tạo/đặt lại PIN tài khoản Firebase bằng quyền quản trị được không (nếu chưa thử: ghi "chưa thử") | |
Số nào chưa đo: ghi "chưa đo", không đoán.

## Việc 2 – Kế hoạch chi tiết (sau khi có báo cáo)
Viết `docs/plans/ke-hoach-chi-tiet-firebase-drive.md`: mô hình dữ liệu và quy tắc `database.rules.json` mới (kèm test Firebase Emulator), danh sách tệp phải sửa (`frontend/hoc/*`, `worker/index.js` rút gọn chỉ còn Gemini + kiểm tra ID token), Apps Script sản phẩm (chấm, Sổ điểm, thư mục học sinh, file minh chứng, nộp file ≤10 MB `.xlsx/.pptx/.docx/.pdf`, tối đa 30 lần đồng thời → tự thử lại), cấu trúc điểm do giáo viên cài đặt (`exam_defs.parts`, xem mục 8.3), chuyển tài khoản học sinh cũ, cờ bật/tắt để lùi về hệ thống cũ, kiểm thử tải, rủi ro, thứ tự và ước lượng. Ghi vào `aisgk.md` trước khi làm. Việc có "xác thực/đáp án/bảo mật" phải qua Claude (ACCEPT) trước khi push.

## Ràng buộc / không được làm
Không ghi API key, token, PIN thật vào repo/nhật ký. Không sửa dữ liệu hay quy tắc của dự án Firebase thật khi chưa có dự án thử. Không xóa Worker hiện tại.

## Xong thì chuyển cho: Claude (kiểm định kế hoạch)
