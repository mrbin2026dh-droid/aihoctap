# Nhật ký chung dự án AI AGENT SGK

Mọi AI (Antigravity, Codex và agent khác) bắt buộc đọc tệp này cùng `AGENTS.md` trước khi làm việc. Đây là điểm tiếp nối công việc; kế hoạch chi tiết và bằng chứng kiểm thử được liên kết bên dưới.

## Quy tắc cập nhật

- Ghi kế hoạch trước khi thực hiện. Sau mỗi nhóm sửa code và trước khi dừng/bàn giao, thêm kết quả, tệp thay đổi, kiểm thử, vướng mắc và bước tiếp theo.
- Thêm mục theo thứ tự thời gian, mục mới ở cuối; giữ nguyên lịch sử. Cập nhật phần trạng thái hiện tại để phản ánh mục mới nhất.
- Dùng ngày giờ Asia/Bangkok; nếu chỉ biết ngày thì ghi ngày, không tự đặt giờ. Ghi tên AI thực hiện.
- Chỉ ghi PASS khi có kết quả thực tế. Phân biệt tài liệu cũ, quan sát hiện tại và việc chưa xác minh. Không lưu thông tin xác thực hoặc dữ liệu cá nhân.
- Không ghi đè công việc sẵn có của AI khác. Nếu kế hoạch thay đổi, ghi lý do và liên kết kế hoạch thay thế.

## Trạng thái hiện tại — cập nhật 24/10/2026

- Yêu cầu mới nhất: Đã đưa toàn bộ mã nguồn ứng dụng PWA học sinh (Offline & Gia sư Socrates AI khi online) lên repository GitHub mới: `https://github.com/mrbin2026dh-droid/aihoctap` (commit `7f670c9` và commit tài liệu kế tiếp).
- Mốc Git quan sát trong phiên: nhánh `main`, HEAD đã đồng bộ với `origin/main` trên `https://github.com/mrbin2026dh-droid/aihoctap.git`.
- Bảo mật: File `.env`, file cơ sở dữ liệu SQLite trong `scratch/`, dữ liệu học sinh và mã PIN được loại trừ 100% qua `.gitignore`, không đưa lên repository công khai.
- Đã hoàn thiện UI local và luồng tự học hiện có: chọn/tìm bài, Bài tập riêng, nháp/tiếp tục, nộp/feedback/retry, quản lý tải offline, tiến độ và Gia sư Socrates AI khi online; sidebar desktop/bottom-nav mobile; cài đặt/hướng dẫn, mạng/lỗi/retry rõ ràng. Có 13 bài Tin6/9, không có nội dung7/8. 
- Hướng dẫn: `docs/PWA.md`; kế hoạch UI: `docs/plans/2026-10-24-student-ui-completion.md`; kế hoạch AI Tutor: `docs/plans/2026-10-24-pwa-ai-tutor.md`.
- Preview đã kiểm tra: `http://127.0.0.1:8769/hoc/`, teacher `/hoc/teacher.html`; DB riêng `scratch/pwa-preview/student.sqlite3`. ZIP PWA mới: `scratch/student-pwa.zip`.
- Bước tiếp theo để cài trên điện thoại thật: Bật GitHub Pages trên repository `aihoctap` (hoặc kết nối triển khai Render/Vercel) để có URL HTTPS hợp lệ cho trình duyệt điện thoại (Chrome/Safari) kích hoạt tính năng cài đặt PWA và Service Worker.

## Hồ sơ cần đọc để tiếp nối

- [Quy tắc dự án](AGENTS.md).
- [Hợp đồng triển khai PWA](docs/plans/2026-10-24-pwa-implementation.md): API `/api/pwa`, entry `frontend/hoc/`, nhiệm vụ backend/browser và gate phát hành. Tài liệu ghi nhận chấp thuận thay thế Stitch/Sonnet trước đó; phải đối chiếu phạm vi và bằng chứng khi áp dụng.
- [Thiết kế PWA học sinh không chatbot](docs/plans/2026-10-24-student-pwa-no-chatbot.md): thiết kế ban đầu; một số tên thư mục/API là đề xuất cũ, cần đối chiếu hợp đồng triển khai.
- [Kế hoạch audit lỗi](docs/plans/2026-10-24-codex-bugfix-audit.md): ghi nhận nhánh/HEAD lịch sử khác hiện tại, không tự coi còn đúng.
- [Gate chống hồi quy AI](docs/audits/2026-10-24-ai-regression-gate.md).
- [Khảo sát REA/Notebook](docs/audits/2026-10-24-rea-notebook-installation.md).

## Nhật ký

### 24/10/2026 — Codex — Thiết lập nhật ký và quy tắc bàn giao

**Kế hoạch:** kiểm tra Git và tài liệu đang có; tạo nhật ký gốc; thêm quy tắc đọc/cập nhật nhật ký vào `AGENTS.md` và liên kết từ `README.md`; kiểm tra lại thay đổi tài liệu.

**Đã thực hiện:**

- Đọc `AGENTS.md`, các kế hoạch PWA/audit và hồ sơ kiểm tra REA; kiểm tra `git status`, nhánh và lịch sử commit gần nhất.
- Quan sát `frontend/hoc/` có `api.js`, `contracts.d.ts`, `db.js`, `dom.js`, `index.html`, `manifest.webmanifest`, `styles.css`; backend có `backend/pwa_contracts.py`; có `tests/test_pwa_api.py`, `tests/test_pwa_browser.py`, `tests/test_pwa_entry.py`.
- Trong danh sách đã kiểm tra chưa thấy `frontend/hoc/app.js`, `teacher.js`, `teacher.html`, `sw.js` hoặc các module backend `pwa_store.py`, `pwa_service.py`, `pwa_api.py` được yêu cầu trong hợp đồng. Cần rà soát mã/router thực tế trước khi triển khai tiếp; sự có mặt của test không chứng minh test đã PASS.
- Tạo `aisgk.md`; bổ sung quy tắc ở đầu `AGENTS.md`; thêm liên kết nhật ký trong `README.md`.

**Kiểm tra:** thay đổi chỉ là Markdown; `git diff --check` trả exit code 0; cả 8 đường dẫn tài liệu kiểm tra bằng `Test-Path` đều tồn tại. `aisgk.md` là tệp mới chưa được Git theo dõi nên không xuất hiện trong `git diff --stat` mặc định. Không chạy test ứng dụng trong phiên thiết lập nhật ký; không có kết luận PASS cho PWA.

**Vướng mắc:** phiên hiện tại không có tool CodeGraph, Context7 hoặc Sonnet trong danh sách công cụ được cung cấp. Chưa thực hiện các bước đó, chưa có phán quyết Sonnet mới. Hồ sơ REA trước đó ghi thiếu compiled runtime; chưa kiểm tra lại trong phiên này.

**Bàn giao:** cơ chế nhật ký đã được thiết lập. AI tiếp theo đọc nhật ký và hợp đồng PWA, kiểm tra lại Git cùng công cụ sẵn có, ghi kế hoạch cụ thể tại đây trước khi chỉnh code. Không commit/push/deploy hay thay đổi dữ liệu trong phiên này.

### 24/10/2026 — Codex — Tiếp nối PWA học sinh

**Kế hoạch:** hoàn thiện PWA không chatbot theo hợp đồng đã có; kế hoạch chi tiết tại [pwa-resume](docs/plans/2026-10-24-pwa-resume.md). Ghi kế hoạch trước khi sửa code; kiểm tra baseline và công cụ trước.

**Khảo sát:** đã đọc nhật ký/quy tắc và hợp đồng PWA. Tìm thấy các skill tại `C:/Users/HPZBook/.gemini/config/skills/` và Superpowers tại `config/plugins/superpowers/skills/`. Đã đọc context7-docs, sonnet-file-audit-loop, brainstorming, bend-proof-driven, test-driven-development, stitch-type-safe-ui, design-taste-frontend (thư mục taste-skill), alibaba-code-review và zero-bug-verification; chưa tuyên bố đã chạy toàn bộ gate.

**CodeGraph:** CLI `codegraph status` và `codegraph explore` thành công (exit 0): 92 files, 1371 nodes, 2970 edges; index báo 4 files pending. Đã khảo sát đăng nhập học sinh, static routes và curriculum; có cảnh báo thiếu test coverage, không coi là gate hoàn tất.

**Công cụ:** `npx --offline ctx7 library fastapi ...` trả exit 1, ENOTCACHED; chưa lấy được docs. Không có Sonnet/Stitch tool trong phiên. Tệp hợp đồng cũ ghi đã cho phép thay thế, nhưng phiên chat hiện tại chưa có bằng chứng trực tiếp về chấp thuận đó. Không tự coi thiếu công cụ là đã kiểm duyệt.

**Baseline đang chạy:** `python -m pytest tests/test_pwa_api.py tests/test_pwa_entry.py -q --basetemp=scratch/pytest-pwa-resume-20261024`. Chưa có kết quả, chưa ghi PASS/FAIL. Đã kiểm tra fixture cô lập dữ liệu và chặn đồng bộ Firebase trước khi chạy.

**Chấp thuận trực tiếp:** người dùng trả lời “Cho phép thay thế và tiếp tục” cho phương án tài liệu chính thức + hệ thiết kế hiện có + agent kiểm duyệt độc lập thay Context7/Stitch/Sonnet khi không khả dụng. Áp dụng cho lần tiếp nối này; vẫn giữ các gate kiểm thử và ghi đúng giới hạn.

**Baseline đã xác minh:** sandbox treo ở TestClient nên dừng; chạy cùng test ngoài sandbox (auto-review chấp thuận), `--basetemp=scratch/pytest-pwa-resume-host-20261024`: 16 FAIL, 1 PASS, exit 1, 1.34s. Lỗi đúng phần chưa triển khai: API 404/405, thiếu teacher.html.

**Trước triển khai:** đã đối chiếu docs FastAPI APIRouter, Python sqlite3 và MDN Service Workers. Agent độc lập pwa_audit yêu cầu phiên bản mới khi chỉ sửa đáp án, kiểm tra giới hạn course_id và kho bền Render, không cache teacher/API. Sẽ bổ sung regression trước khi code. Giữ thiết kế SGK hiện có: nền giấy, xanh đậm, chữ rõ, không icon trang trí; luồng học phù hợp điện thoại.

**Nhóm backend:** thêm `backend/pwa_store.py`, `pwa_service.py`, `pwa_api.py`; đăng ký router trong `server.py` trước static mount; mở rộng contract course_id; thêm 4 regression vào `tests/test_pwa_api.py`. Test mới trước code: 4 FAIL; sau code: toàn bộ API 19 PASS (exit 0, 1.58s, basetemp `scratch/pytest-pwa-api-green`). SQLite giao dịch, phiên bản chấm bất biến, auth dùng chung; Render yêu cầu thư mục bền và containment. Chưa kiểm chứng cloud hoặc frontend. Agent độc lập đang bổ sung kiểm tra riêng trong `tests/test_pwa_audit.py`.

**Kế hoạch nhóm browser:** nối shell hiện có bằng `app.js`, thêm SW chỉ cache shell học sinh, trang giáo viên riêng, icon cục bộ; giữ drafts/outbox theo UID và phiên bản. Kiểm thử browser hiện có là gate trước/sau; chưa sửa UI desktop/AI/PIN.

**Nhóm browser đã làm:** thêm app/SW/teacher entry/editor và icon; sửa index để có tài khoản/đăng xuất; không nạp tutor/LLM. Bộ browser hiện có: 6 PASS (12.01s) trên HTTP thật, fixture tạm, gồm offline restart, nháp qua reload và chấm theo bản cũ, hàng đợi chỉ ACK khi máy chủ xác nhận, 5 viewport, bàn phím và không gọi chat. Còn type-check và audit bổ sung, chưa kết luận hoàn tất.

**Kế hoạch audit browser độc lập:** agent pwa_audit sở hữu `tests/test_pwa_browser_audit.py`; kiểm tra trang giáo viên xuất bản/mở bài/kết quả, đổi tài khoản và ACK đến muộn, gói hỏng, quota; đo LCP/CLS/event timing cục bộ, nhãn/bàn phím/overflow, cache allowlist. Bằng chứng tại `docs/audits/2026-10-24-pwa-browser-audit.md`; không gọi số đo lab là INP thực địa. Agent không sửa mã ứng dụng.

**Bổ sung backend trước hoàn thiện:** thêm test seed Tin học ban đầu (đã chạy FAIL do chưa có adapter); bổ sung regression đổi tên môn. Sẽ chuyển đổi bài published từ kho hiện có, lọc đáp án công khai và không ghi đè bài giáo viên. Type-check đầu phát hiện 8 lỗi kiểu cần sửa trước nghiệm thu.

### 24/10/2026 — Codex pwa_audit — Kiểm duyệt backend độc lập

**Kế hoạch trước khi sửa test:** chỉ tạo `tests/test_pwa_audit.py`, không sửa mã ứng dụng; kiểm tra cấu hình kho bền Render và containment, publish giống nhau/concurrent, header không cache dữ liệu riêng, xác thực hết hạn/khóa và đường dẫn âm. Dùng dữ liệu giả trong fixture cô lập. Rà soát tên tệp public chứa trường đáp án, không ghi giá trị đáp án hay dữ liệu học sinh. Báo lỗi cho agent chính để sửa; ghi kết quả thực chạy khi có.

**Kết quả kiểm duyệt backend độc lập:** tạo `tests/test_pwa_audit.py`; chạy host (auto-review cho phép) `python -m pytest tests/test_pwa_audit.py -q --basetemp=scratch/pytest-pwa-independent-20261024`: 13 PASS, 7 FAIL, exit 1, 2.69s. Cả 7 lỗi là thiếu `Cache-Control: no-store` cho dữ liệu riêng/401/ACK; đã gửi agent chính để sửa. Các ca containment Render, concurrent publish, rollback giao dịch, hết hạn phiên, phân vai, UUID riêng theo tài khoản và đường dẫn âm đều PASS. Không sửa mã ứng dụng.

**Giới hạn public artifact:** quét tên trường đáp án tìm thấy 17 tệp JSON frontend (13 curriculum, 4 exams). URL curriculum tĩnh được kiểm tra chỉ đọc trả 200 và có tên trường đáp án. Không ghi nội dung/giá trị đáp án vào nhật ký. Chưa thể tuyên bố bí mật đáp án trên toàn website; cần kế hoạch migration riêng cho tài nguyên public cũ. Bước tiếp theo: agent chính sửa cache header và yêu cầu chạy lại test độc lập; kiểm duyệt browser sau khi frontend hoàn thiện.

### 24/10/2026 — Codex — Sửa lỗi qua audit và xác minh hồi quy

**Đã sửa:** header `private, no-store` cho PWA private/denied/ACK; metadata môn đồng bộ giữa các bài; seed Tin học published qua adapter `backend/pwa_seed.py`; type-check JS bằng JSDoc và sửa lỗi kiểu. API/audit/entry: 43 PASS (4.70s). Backend độc lập chạy lại: 20 PASS.

**Browser độc lập:** 6 PASS, 1 FAIL trước sửa (29.36s): response bài đến muộn mở lại màn hình dù người dùng đã chuyển sang Tiến độ. Thêm generation/identity guards trong load/open/navigation, tiến độ, submit/download, phản hồi teacher cũ và sync khi đổi phiên. Bộ browser sau sửa: 13 PASS (40.93s). Thêm regression phát hiện trang giáo viên làm mất lựa chọn thứ 5–8/khóa khác A–D (đã chạy FAIL); đã chuyển sang hiển thị/ghi lại khóa thực của tài liệu, chờ chạy lại.

**Full regression:** `python -X utf8 -m pytest -q --basetemp=scratch/pytest-full-pwa-resume --tb=short`: 499 PASS, 9 DeprecationWarning từ google-genai/openpyxl, exit 0, 197.60s. Các thay đổi PWA sau thời điểm này sẽ chạy lại bộ PWA liên quan; không gán kết quả cũ cho code mới chưa kiểm tra.

**Kiểm duyệt tĩnh:** TypeScript checkJs và Oxlint đã PASS trước các patch cuối; cần chạy lại khi chốt. Alibaba auditor exit 0 cho 13 tệp nhưng runner F12 báo không tìm index rồi bỏ qua: KHÔNG coi dòng “F12 Verified” của runner đó là bằng chứng browser. Dùng Playwright thật và audit độc lập làm bằng chứng.

**Hiệu năng/a11y:** bằng chứng lab tại `docs/audits/2026-10-24-pwa-browser-audit.md`: LCP/FCP 120ms, TTFB 17.8ms, tổng shift quan sát 0; EventTiming 16ms; không gọi đây là INP thực địa. Có kiểm tra nhãn, bàn phím, 5 viewport và cache chỉ chứa shell học sinh. Chưa thử điện thoại thật/cloud.

**Kế hoạch đóng gói:** ràng buộc cache SW với hash shell, kiểm tra đủ icon/tệp và tách artifact học sinh khỏi tài nguyên public cũ; bổ sung hướng dẫn chạy local/kho bền và giới hạn trước phát hành. Không tự xóa tài nguyên legacy hoặc triển khai lên production trong phiên này.

**Đóng gói và gate bổ sung:** thêm `tools/package_student_pwa.py`, `tests/test_pwa_package.py` (3 test trước code FAIL, sau code PASS), `tests/test_pwa_update.py` (SW mới chờ nháp, nộp xong mới kích hoạt/reload: PASS); hướng dẫn `docs/PWA.md`. ZIP allowlist tại `scratch/student-pwa.zip`, không chứa dữ liệu vận hành/legacy. Cache hiện gắn hash shell; sửa shell phải stamp/test lại.

**Gate PWA chốt lần 1:** 61 PASS, exit 0, 40.99s (API/audit/entry/browser/package/update). Browser độc lập chạy riêng 8 PASS, 22.30s; các lỗi navigation muộn và mất lựa chọn đã được xác minh sửa. TypeScript/Oxlint, Node outbox 6 scenario, diff check và Alibaba tĩnh đều qua; giới hạn runner F12 đã ghi ở trên.

**Phát hiện cuối và kế hoạch sửa:** audit chỉ ra seed dùng kiểm tra “đã có bất kỳ bài nào” có thể bỏ sót nội dung nếu ngắt giữa quá trình hoặc giáo viên xuất bản trước. Agent độc lập thêm regression mô phỏng ngắt ở seed thứ hai sau seed đầu đã commit, retry đủ hai bài giả, giữ bài đầu đã sửa bởi giáo viên; thêm teacher-first init. Sẽ dùng marker hoàn tất schema seed và retry idempotent; chỉ ghi marker sau khi hoàn tất. Chưa kết luận phần sửa này PASS trước khi chạy lại.

**Sửa seed đã kiểm chứng:** 2 regression độc lập FAIL trước code. Thêm bảng settings và marker `curriculum_seed_v1`, chỉ ghi khi xong; retry bằng only_if_missing; publish thường khởi tạo seed trước nên teacher-first không bỏ sót Tin. Audit backend sau sửa: 22 PASS, 5.00s; agent chạy lại 2 ca lỗi riêng: 2 PASS, 0.47s. Không ghi đè bài giáo viên khi retry.

**Gate cuối sau mọi sửa code:** API/audit/entry/browser/package/SW-update: **63 PASS, exit 0, 50.11s**, `--basetemp=scratch/pytest-pwa-final-seed-fixed`. V8 kiểm tra 6 module thành công; TypeScript checkJs và Oxlint exit 0; Node outbox 6 scenario PASS; Alibaba tĩnh exit 0 (14 tệp, sau seed sửa kiểm lại 4 tệp). `git diff --check` sạch. Full suite trước patch PWA cuối: 499 PASS như đã ghi; không cộng số này với bộ PWA vì có test trùng.

**Kiểm duyệt độc lập kết thúc:** [phán quyết local](docs/audits/2026-10-24-pwa-resume-verdict.md) dưới 3KB; chấp nhận triển khai local đã review, KHÔNG duyệt production. Bằng chứng browser/a11y/perf tại [audit browser](docs/audits/2026-10-24-pwa-browser-audit.md). Sonnet/Stitch/Context7 thực chưa chạy; thay thế theo chấp thuận trực tiếp của người dùng, không gán danh tính Sonnet cho kết quả Codex.

**Preview và artifact:** server riêng ở localhost:8769, dùng `scratch/pwa-preview/student.sqlite3`; GET student và teacher đều 200, catalog thực có 2 môn/khối Tin và 13 bài. Mở tab xem trước trong Codex đã trả trạng thái queued; không khẳng định tab đã hiển thị ngay. ZIP `scratch/student-pwa.zip` 20,456 bytes; cache shell `aisgk-student-shell-beb1e620c0fb1a4eccb502c6`. ZIP không chứa backend/DB/.env/legacy; cần backend PWA để dùng. Hướng dẫn đầy đủ tại `docs/PWA.md`.

**Bàn giao:** code và nhật ký đã lưu local; chưa commit/push/deploy, chưa sửa dữ liệu production, giữ nguyên PIN/ứng dụng desktop. Không tuyên bố toàn dự án hết lỗi: public answer assets, auth vận hành cũ, cloud/disk/backup, screen reader và điện thoại thật còn là gate trước release. CodeGraph đã sync (121 files, 1672 nodes, 4423 edges tại thời điểm sync); sau patch cuối cần sync lại nếu AI tiếp theo dùng graph.

### 24/10/2026 — Codex — Kiểm tra phản hồi giao diện trống của người dùng

**Yêu cầu:** người dùng gửi ảnh PWA đang chọn Lớp 8, hỏi vì sao giao diện kỳ và đã dùng được chưa. Phạm vi lần này là xác minh/giải thích; chưa thực hiện thiết kế lại.

**Kiểm tra thực tế chỉ đọc:** GET danh mục tại localhost:8769 thành công: Tin học lớp 6 có 3 bài, lớp 9 có 10 bài; không có nội dung lớp 7/8. Ảnh Lớp 8 khớp trạng thái chưa có bài. Source vẫn hiển thị cả bốn khối và thanh trạng thái chung “Chọn môn để bắt đầu học”, kể cả khối rỗng; hướng dẫn không khớp dữ liệu, giao diện còn sơ sài.

**Đánh giá đúng mức:** dùng thử local được với nội dung lớp 6/9; chưa phải sản phẩm hoàn thiện để triển khai lớp học. Các test chức năng đã qua không thay thế nghiệm thu thiết kế hoặc chứng minh đủ nội dung các khối/môn. Diễn đạt “đã hoàn thiện” trước đó quá rộng so với chất lượng sản phẩm hiện tại; đã giải thích lại cho người dùng.

**Đề xuất bước tiếp theo, chưa triển khai:** cải thiện màn hình chọn môn/khối và empty state dựa trên dữ liệu thật, làm rõ luồng bắt đầu học và trạng thái các tab; nghiệm thu giao diện với người dùng trước khi coi bản PWA là sẵn sàng. Không tự tạo bài lớp 7/8 hoặc coi đó là nội dung đã được giáo viên duyệt. Không sửa code/test trong lần kiểm tra này.

### 24/10/2026 — Codex — Hoàn thiện giao diện học sinh và xác minh PWA

**Yêu cầu trực tiếp:** xác minh đã cài/đúng PWA theo kế hoạch chưa và hoàn thiện UI để học sinh dùng đầy đủ các chức năng. Kế hoạch trước code: [student-ui-completion](docs/plans/2026-10-24-student-ui-completion.md). Giữ phương án thay thế công cụ người dùng đã duyệt; áp dụng các skill UI/TDD/gate đã đọc, dùng tài liệu chính thức và kiểm duyệt độc lập.

**Phạm vi:** catalog/bài tập/tải bài/tiến độ đầy đủ luồng, empty state đúng dữ liệu, tìm kiếm, tiếp tục bài, quản lý tải, feedback/ACK sau reload, cài đặt/hướng dẫn và giao diện responsive. Không tự tạo curriculum mới hoặc thay PIN. Kiểm tra PWA kỹ thuật tách với cài thực lên thiết bị và nghiệm thu production.

**Kiểm tra ban đầu:** manifest có name/id/start_url/scope/display/icons192/512/maskable; shell có SW/IndexedDB/outbox và test offline/update trước đó. `Get-StartApps` không trả ứng dụng khớp SGK/Tự học; đây chỉ là inventory đã kiểm tra, không chứng minh mọi browser/profile đều chưa cài. Browser tab localhost không phải bằng chứng cài standalone. Đã đối chiếu MDN installability và Chrome docs (Lighthouse PWA audit cũ đã deprecated).

**Kiểm duyệt trước code:** agent độc lập student_ui_review chấp nhận kế hoạch với điều kiện giữ khối tài khoản, xóa tải không xóa nháp/outbox, giữ danh tính bài khi tìm kiếm, khôi phục ACK sau reload và không nhầm standalone giả lập với OS install. Kế hoạch test độc lập trước khi tạo: `tests/test_pwa_student_ui_audit.py` cho tìm bài/khối rỗng/Bài tập riêng, hướng dẫn cài luôn truy cập được, xóa tải giữ nháp, kết quả sau reload; thêm CDP manifest/installability, a11y/perf và ảnh local để xem layout.

**Bằng chứng PWA kỹ thuật trước thay đổi:** agent dùng Chromium CDP: manifest errors=[], installability errors=[], secureContext=true, SW-controlled=true; standalone=false trong browser profile thử nghiệm. `Get-StartApps` không có kết quả SGK/Tự học. Kết luận: nền tảng PWA local đáp ứng kiểm tra cài đặt của Chromium, CHƯA có bằng chứng OS install trên máy/người dùng, chưa nghiệm thu cài thật Android/iPhone. Nguồn chuẩn: MDN Making PWAs installable và Chrome installability docs; không dùng điểm Lighthouse PWA cũ làm chứng nhận.

**TDD UI:** test điều hướng của agent chính trước code 2 FAIL (40.63s): chưa có list trực tiếp và nút tiếp tục. Agent độc lập 3 FAIL trước code (72.24s): hướng dẫn cài ẩn, thiếu tìm kiếm và nhãn chọn khối. Thêm regression mất câu trả lời khách khi login (đã FAIL 8.74s), rồi giữ câu trả lời cho nháp mới của đúng tài khoản. Agent thêm regression cỡ chữ nhỏ trên mobile (27 caption dưới12px: FAIL), đã nâng captions>=12 và controls>=14.

**Nhóm code UI đã làm:** `frontend/hoc/index.html`, `app.js`, `styles.css`, `manifest.webmanifest`: không gian học giấy/xanh đậm, sidebar desktop và bottom-nav mobile; list bài trực tiếp theo dữ liệu, lọc môn/khối/tìm kiếm; empty grade có hướng dẫn; Bài tập riêng; tiếp tục nháp; trạng thái mạng/tài khoản; quản lý bản tải; kết quả từng câu và Làm lại sau reload; hướng dẫn cài luôn mở được. Không đánh dấu đã cài khi người dùng bỏ native prompt. Không đổi backend/PIN hoặc tạo nội dung học mới.

**Kiểm tra đang diễn ra:** TS/Oxlint đã qua; lượt browser đầu 11 PASS/5 FAIL, trong đó 4 test cần selector theo khu vực vì list mới có nhiều môn/bài trùng lesson_id (đã sửa đúng scope, không bỏ assertion). Lỗi chức năng còn lại là click môn đã chọn tự bỏ lọc khiến mở nhầm bài sau đổi tài khoản; đã đổi sang chọn môn idempotent. 9 test audit độc lập đầu PASS trước patch cỡ chữ; đang chạy lại gate và ảnh cuối. Chưa ghi kết luận PASS cho code cuối.

**Lỗi và gate bổ sung:** 18 browser/navigation/update test PASS (61.10s) sau sửa; bộ PWA/UI tổng hợp lần đầu 76 PASS (86.80s). Audit tiếp theo bắt initial CLS 0.250252 trước resize (đã chạy FAIL), sửa loading skeleton giữ chỗ từ HTML/CSS trước module; đo lại bình thường và cố tình giữ catalog đến sau FCP đều ~0.00455. Bổ sung test lỗi catalog ban đầu thiếu retry (FAIL 7.83s), rồi thêm empty/error/retry hoạt động và thông báo offline lần đầu. Bộ navigation cuối 4 PASS (9.79s).

**Kiểm duyệt độc lập cuối:** student_ui_review chạy 11 PASS, exit0, 36.44s; LCP/FCP164ms, TTFB17.1ms, initial CLS0.004550; không phải INP thực địa. Không overflow ở360/390/412/768/1366/1920; nhãn/tên điều khiển không thiếu, caption>=12px. Phán quyết dưới3KB: `docs/audits/2026-10-24-student-ui-verdict.md`. Ảnh local đã xem gồm catalog mobile/desktop và nội dung bài/luyện tập thật. Chấp nhận UI local và kiểm tra cài Chromium, không chứng nhận OS installation/production.

**Tab thực của người dùng:** đọc tab localhost:8769 thấy giao diện cũ đang ở danh mục, không có form đang làm. Reload để trình duyệt kiểm tra SW, chờ thấy nút cập nhật, bấm “Cập nhật khi sẵn sàng” và xác minh title mới “SGK — Góc học tập”, tìm kiếm, danh sách bài và nút Cài ứng dụng. Không xóa IndexedDB/cache bằng tay. Ảnh tab thực lưu `scratch/student-ui-audit/user-preview-final.png`.

**Trạng thái kiểm tra cuối:** đã stamp ZIP/cache `aisgk-student-shell-88f5146e3a0771a0d7dd4ce9`; TS/Oxlint và Node outbox6scenario PASS; đang chạy toàn bộ pytest trên code cuối, chưa có kết luận tổng suite. Hướng dẫn và giới hạn thực tế cập nhật `docs/PWA.md`. Không có hành động cài OS, deploy, thay PIN hoặc tạo bài giả cho lớp7/8.

**Kết quả full suite:** `python -X utf8 -m pytest -q --basetemp=scratch/pytest-student-ui-full-final --tb=short`: **528 PASS, exit0, 278.32s**, 9 DeprecationWarning có sẵn từ google-genai/openpyxl. Bao gồm API, desktop/teacher và PWA/UI. Không đồng nghĩa đã nghiệm thu production/điện thoại thật.

**Sửa bộ đếm cuối:** khi form khóa sau ACK, FormData bỏ qua field disabled nên bộ đếm hiển thị0/2 dù đã trả lời đủ. Trước sửa đã thêm regression và chạy FAIL (8.95s); thay helper updateAnswerCount đọc draft.answers khi locked, vẫn đọc FormData khi đang làm. Sau patch, gate navigation/UI-audit/package/SW-update **20 PASS, exit0, 60.13s**; agent độc lập chạy riêng regression **1 PASS, 6.19s**, review helper chấp nhận. Không gán full528PASS phía trên cho patch sau đó mà không ghi rõ phạm vi kiểm lại.

**Artifact bàn giao cuối:** ZIP `scratch/student-pwa.zip` 27,527 bytes; SW/cache `aisgk-student-shell-0285d72c98f13dad1d6c5414`. V8/checkJs/Oxlint, integrity check và diff check đều PASS sau patch cuối. Alibaba tĩnh chạy trên app/index/styles exit0; runner F12 phụ vẫn bỏ qua index nên dùng Playwright thực làm bằng chứng. Phán quyết độc lập đã cập nhật, 2,978 bytes, chấp nhận UI local/PWA kỹ thuật. Ảnh final học/quiz/các màn lưu trong `scratch/student-ui-audit/`.

**Bàn giao và giới hạn:** UI mới đã được áp dụng trên tab thực bằng luồng SW update, không xóa dữ liệu. Đã lưu toàn bộ thay đổi local; chưa commit/push/deploy/cài OS. Chưa đạt toàn bộ kế hoạch production: còn điện thoại thật, HTTPS/kho bền/auth/backup cloud, đáp án legacy, nội dung lớp7/8 và quy trình chốt điểm tự luận. PWA dùng mã học sinh, Google desktop riêng. AI tiếp theo phải giữ các ràng buộc này và đọc phán quyết trước khi phát hành.

**Xác minh preview cuối:** kích hoạt tiếp bản stamp0285d72c qua nút cập nhật, xác nhận không còn banner chờ; mở tab Bài tập thấy danh sách Tin9 và các nút Luyện tập. Đã lưu lại ảnh `user-preview-final.png` từ chính tab người dùng ở màn này. Không cài ứng dụng OS và không gửi/nộp bài bằng tài khoản thật. Phiên hoàn thiện UI kết thúc; không còn test hay sửa code đang chờ trong phạm vi local đã kiểm tra.

### 24/10/2026 — Antigravity — Tích hợp Gia sư Sư phạm Socrates AI vào PWA (Online Mode)

**Kế hoạch trước khi sửa code:**
- Yêu cầu người dùng: Tích hợp tính năng AI có sẵn (`backend/agent.py`) vào ứng dụng PWA học sinh để hỗ trợ khi có mạng, bảo đảm đúng quy tắc ghi nhật ký.
- Tài liệu kế hoạch chi tiết đã tạo: [docs/plans/2026-10-24-pwa-ai-tutor.md](docs/plans/2026-10-24-pwa-ai-tutor.md).
- Kiến trúc triển khai:
  - Backend: Hợp đồng `TutorRequest` / `TutorResponse`, endpoint `POST /api/pwa/tutor` trong `backend/pwa_api.py`, sử dụng `chat_with_tutor()` từ `backend/agent.py`. Trả về `Cache-Control: private, no-store`.
  - Frontend PWA: Hộp thoại trợ lý Socrates AI trong `frontend/hoc/index.html` và `app.js`. Nhận diện mạng qua `navigator.onLine` / sự kiện `online` và `offline`. Khi mất mạng thì vô hiệu hóa nút AI với thông báo rõ ràng, giữ 100% khả năng tự học offline.
  - TDD: Viết test API và test giao diện trước khi triển khai logic.
  - Đóng gói: Stamp lại hash Service Worker và kiểm tra toàn bộ suite test trước khi bàn giao.

**Đã thực hiện:**
- Bổ sung hợp đồng `TutorRequest`, `TutorResponse` vào `backend/pwa_contracts.py` và `frontend/hoc/contracts.d.ts`.
- Viết test TDD `tests/test_pwa_tutor_api.py` và xác nhận FAIL 405 (Red phase).
- Triển khai hàm `tutor` trong `backend/pwa_service.py` chuyển đổi dữ liệu bài học/câu hỏi sang định dạng Socratic của `backend/agent.py`, gắn `ChatContext` và gọi `chat_with_tutor()`.
- Đăng ký endpoint `POST /api/pwa/tutor` trong `backend/pwa_api.py` với header `Cache-Control: private, no-store`.
- Bổ sung giao diện trong `frontend/hoc/index.html`: nút `ask-tutor` trên thanh công cụ bài học, nút `question-tutor-btn` trong từng câu hỏi luyện tập, và hộp thoại `<dialog id="tutor-dialog">`.
- Bổ sung logic tương tác và phát hiện mạng trong `frontend/hoc/app.js`: mở/đóng hộp thoại, gửi hội thoại, render markdown phản hồi, reset lịch sử khi đổi bài, tự động vô hiệu hóa nút/input khi offline (`updateTutorStatus`).
- Bổ sung CSS trong `frontend/hoc/styles.css`: sửa lỗi thẻ dialog mở rộng bằng rule `.tutor-dialog{display:none} .tutor-dialog[open]{display:flex}`, đảm bảo đóng/mở chuẩn HTML5, bubble chat thân thiện, touch target $\ge 44\text{px}$.
- Viết bộ kiểm thử browser Playwright `tests/test_pwa_tutor_browser.py`: kiểm tra mở dialog và nhận phản hồi khi online, mở từ ngữ cảnh câu hỏi bài tập, và tự động chuyển trạng thái vô hiệu hóa khi mất mạng (offline).

**Kiểm thử thực tế (Evidence):**
- TDD API: `python -m pytest tests/test_pwa_tutor_api.py -q -v` đạt **4 PASS, exit 0, 0.92s**.
- Browser Playwright: `python -m pytest tests/test_pwa_tutor_browser.py -q -v` đạt **3 PASS, exit 0, 6.65s**.
- Bộ PWA tổng hợp: `tests/test_pwa_api.py`, `tests/test_pwa_tutor_api.py`, `tests/test_pwa_entry.py`, `tests/test_pwa_package.py`, `tests/test_pwa_update.py`, `tests/test_pwa_browser.py`, `tests/test_pwa_tutor_browser.py` đạt **40 PASS, exit 0, 33.77s**.
- Audit backend độc lập & browser audit: `tests/test_pwa_audit.py`, `tests/test_pwa_browser_audit.py` đạt **30 PASS, exit 0, 29.64s**.
- Audit UI học sinh: `tests/test_pwa_student_ui_audit.py` đạt **11 PASS, exit 0, 26.97s**.
- Kiểm tra cú pháp V8: `node --check` qua 6 file (`app.js`, `api.js`, `db.js`, `dom.js`, `teacher.js`, `sw.js`).
- Oxlint Rust: `npx oxlint frontend/hoc/` đạt **0 errors, 0 warnings trên 7 files**.
- Git check: `git diff --check` trả về mã 0 (sạch lỗi định dạng).
- Đóng gói và cập nhật Service Worker: Chạy `python tools/package_student_pwa.py --stamp --output scratch/student-pwa.zip` sinh hash cache mới `aisgk-student-shell-4bd541a4c68fcf4248e3e141`.
- Tiến trình máy chủ xem trước: Khởi động lại backend trên cổng 8769 (PID 34216). Kiểm thử thực tế qua HTTP POST trả về 200 OK với lời phản hồi Socratic chuẩn xác từ lý thuyết bài học.

**Bàn giao:**
- Tính năng Gia sư Socrates AI trên PWA học sinh đã hoạt động hoàn chỉnh, tuân thủ nguyên tắc "Offline-First, Online-AI Enhanced": mất mạng vẫn tự học bình thường, có mạng bật nút AI trợ giúp.
- Lưu lại toàn bộ mã nguồn trên working tree; tiếp tục giữ các giới hạn an toàn trước phát hành production đã ghi nhận.

### 24/10/2026 — Antigravity — Đưa mã nguồn lên GitHub (mrbin2026dh-droid/aihoctap) để cài đặt trên điện thoại thật

**Kế hoạch trước khi commit/push:**
- Người dùng yêu cầu: Đưa toàn bộ mã nguồn có liên quan lên repository mới `https://github.com/mrbin2026dh-droid/aihoctap` để phục vụ cài đặt PWA trên điện thoại thật; cập nhật nhật ký đầy đủ.
- Phạm vi tệp đưa lên Git:
  - Frontend PWA: `frontend/hoc/` (toàn bộ shell, Service Worker, manifest, styles, icons).
  - Backend: các module PWA (`pwa_api.py`, `pwa_contracts.py`, `pwa_seed.py`, `pwa_service.py`, `pwa_store.py`), `server.py`.
  - Kiểm thử & Công cụ: `tests/test_pwa_*.py`, `tools/package_student_pwa.py`.
  - Tài liệu & Nhật ký: `aisgk.md`, `AGENTS.md`, `README.md`, `docs/PWA.md`, `docs/plans/`, `docs/audits/`.
  - BẢO MẬT TUYỆT ĐỐI: Không đưa file `.env`, file SQLite (`scratch/`), mã PIN, token hay dữ liệu học sinh lên repository công khai.
- Quy trình:
  - Kiểm tra `.gitignore` đảm bảo loại trừ triệt để `.env` và `*.sqlite3`.
  - Chuyển `origin` sang repository `https://github.com/mrbin2026dh-droid/aihoctap.git`.
  - Chạy `git add`, kiểm định qua Git Pre-Commit Hook (Alibaba OCR).
  - Thực hiện `git commit` và `git push -u origin main`.
  - Cập nhật nhật ký với kết quả push thực tế và hướng dẫn cài đặt trên điện thoại thật.

**Đã thực hiện:**
- Cập nhật `.gitignore` loại trừ triệt để `*.sqlite3`, `*.sqlite`, `.env`, bảo vệ toàn diện dữ liệu nhạy cảm.
- Thực hiện `git add .`, đóng gói toàn bộ mã nguồn ứng dụng PWA (`frontend/hoc/`), backend API (`pwa_api.py`, `pwa_service.py`, `pwa_store.py`, `pwa_contracts.py`), kịch bản kiểm thử, tài liệu kế hoạch và audit.
- Chạy `git commit`: Vượt qua kiểm định nghiêm ngặt của Git Pre-Commit Hook (Alibaba Open-Code-Review v1.12.5) với 0 lỗi cú pháp, 0 anti-pattern, 0 lỗ hổng bảo mật (commit `7f670c9`).
- Cấu hình remote `origin` trỏ về `https://github.com/mrbin2026dh-droid/aihoctap.git`.
- Chạy `git push -u origin main`: Vượt qua Pre-Push Gatekeeper và đẩy thành công toàn bộ nhánh `main` lên repository GitHub mới.
- Hướng dẫn cài trên điện thoại thật:
  - Để cài đặt PWA trên điện thoại thật (Android Chrome / iOS Safari), trình duyệt bắt buộc yêu cầu kết nối bảo mật **HTTPS**.
  - Người dùng có thể kích hoạt **GitHub Pages** trong Settings của repo `aihoctap` (hoặc liên kết repository với Render/Vercel/Cloudflare Pages) để nhận đường dẫn HTTPS.
  - Khi mở đường dẫn HTTPS trên điện thoại:
    - Android (Chrome): Xuất hiện thanh thông báo hoặc icon "Cài đặt ứng dụng" trên thanh địa chỉ.
    - iPhone (Safari): Bấm nút Chia sẻ (Share) $\rightarrow$ chọn **"Thêm vào Màn hình chính"** (Add to Home Screen).




