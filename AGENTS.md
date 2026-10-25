# ĐỊNH TUYẾN 3 AI — BẮT BUỘC TUÂN THỦ 100% (Priority 0)

Áp dụng cho ChatGPT/Codex, Antigravity, Claude và mọi agent khác. Phần này đứng TRƯỚC mọi quy tắc bên dưới; các quy tắc cũ vẫn giữ nguyên hiệu lực. Vi phạm bất kỳ điều nào = chưa hoàn thành việc.

## A. Đọc tiết kiệm token (thay cho việc đọc cả `aisgk.md`)
1. CẤM đọc toàn bộ `aisgk.md`. Chỉ đọc: (a) từ đầu tệp đến hết mục "Hồ sơ cần đọc để tiếp nối" (trước dòng `## Nhật ký`), và (b) mục nhật ký cuối cùng (từ dòng `### ` cuối).
2. Nếu có việc được giao: đọc đúng tệp `docs/handoff/<tên>.md` mà người dùng chỉ định. Không đọc thêm tệp ngoài danh sách trong tệp đó, trừ khi bắt buộc và phải ghi lý do.
3. Chỉ tra mục nhật ký cũ khi cần một sự kiện cụ thể; dùng tìm kiếm, không đọc hết.

## B. Bảng định tuyến (ai làm loại việc nào)
| Loại việc | AI phụ trách | Chuyển tiếp cho |
|---|---|---|
| Nội dung bài học, câu hỏi, đáp án, đối chiếu SGK, dữ liệu học liệu | ChatGPT/Codex | Antigravity (đưa vào dữ liệu) |
| Viết/sửa code, giao diện, chạy test, sửa theo điều kiện audit | Antigravity | Claude (kiểm định) |
| Kiến trúc, bảo mật, rủi ro lộ đáp án, audit độc lập, phán quyết | Claude | Antigravity (nếu có điều kiện) hoặc người dùng (nếu ACCEPT) |
| Commit và push Git | Antigravity | Người dùng |

Ràng buộc cứng:
- Chỉ MỘT AI được sửa mã nguồn tại một thời điểm (mặc định Antigravity). ChatGPT/Codex và Claude chỉ ghi vào `docs/`, `docs/handoff/`, nhật ký và dữ liệu học liệu được giao.
- Việc có chữ "đáp án", "bảo mật", "xác thực" hoặc ngay trước `git push` PHẢI qua Claude và có phán quyết ACCEPT. Không có ACCEPT thì không push.
- Không AI nào sửa phán quyết/nhật ký do AI khác viết; chỉ thêm mục mới ở cuối.
- Việc ngoài phạm vi của mình: không tự làm, ghi vào handoff cho AI phụ trách.

## C. Kết thúc MỌI phiên làm việc (bắt buộc)
1. Thêm mục ngắn (3–5 dòng) vào cuối `aisgk.md`: AI, đã làm gì, tệp đã đổi, kiểm thử thực tế (chỉ ghi PASS khi đã chạy), việc dở. Không dán log lệnh dài.
2. Cập nhật đúng một dòng "Yêu cầu mới nhất" trong phần "Trạng thái hiện tại".
3. Tạo `docs/handoff/<từ>-<sang>-<việc>.md` theo mẫu `docs/handoff/README.md` cho AI tiếp theo.
4. Câu cuối cùng gửi người dùng phải đúng mẫu:
```
XONG: <việc đã làm, 1 dòng>
TIẾP THEO → <ChatGPT | Antigravity | Claude | Người dùng>
Dán cho họ: "Đọc AGENTS.md và docs/handoff/<tên>.md rồi làm theo."
```

---

## E. Yêu cầu cuộc thi (bắt buộc)
- Dự án dự thi Giáo viên sáng tạo ứng dụng AI 2026. Đọc `docs/REQUIREMENTS_CUOC_THI.md` trước khi làm tính năng; chỉ Claude được đánh dấu `[x]`.
- Cấm tuyệt đối AI gia sư đưa đáp án; tính mở nhiều môn không sửa mã; giao diện mobile-first chuẩn quốc tế, ít icon, chữ gọn.

# BẮT BUỘC ĐỌC NHẬT KÝ TRƯỚC KHI LÀM VIỆC

Áp dụng cho mọi AI làm việc với dự án này, gồm Antigravity, Codex và các agent khác.

1. Trước khi lập kế hoạch, sửa code hoặc tiếp tục công việc, bắt buộc đọc [aisgk.md](aisgk.md) ở thư mục gốc, nhất là phần trạng thái hiện tại và mục nhật ký mới nhất.
2. Mọi kế hoạch mới hoặc thay đổi kế hoạch phải được ghi vào `aisgk.md` trước khi thực hiện; liên kết tới tệp kế hoạch chi tiết nếu có.
3. Sau mỗi nhóm thay đổi code và trước khi bàn giao/dừng phiên, cập nhật `aisgk.md`: ngày giờ (Asia/Bangkok), AI thực hiện, mục tiêu, tệp đã sửa, kiểm thử thực tế, lỗi/vướng mắc và bước tiếp theo. Ghi cả công việc dở dang để AI khác tiếp nối.
4. Giữ nguyên lịch sử, thêm mục mới; không xóa hoặc ghi đè nhật ký cũ. Phân biệt rõ dự kiến, đã làm, đã kiểm chứng và chưa kiểm chứng; không ghi PASS khi chưa chạy kiểm thử.
5. Không ghi mật khẩu, token, nội dung `.env`, dữ liệu cá nhân hoặc dữ liệu học sinh vào nhật ký. Bảo toàn thay đổi sẵn có của người dùng/AI khác.
6. Nếu thiếu công cụ/skill bắt buộc, ghi rõ công cụ thiếu và phần việc bị chặn; không tự nhận đã chạy hoặc đã được phê duyệt.

---

# HIẾN PHÁP ANTIGRAVITY (THE MASTER PIPELINE) - BẮT BUỘC DỰ ÁN
**Mức độ ưu tiên**: Tuyệt đối cao nhất (Priority 1 - Workspace Root Law). CẤM SUY ĐOÁN (ZERO-GUESSWORK).
**Phạm vi áp dụng**: MỌI thao tác trong dự án `AI AGENT SGK`.

Antigravity Agent KHÔNG ĐƯỢC PHÉP tự suy đoán cách làm. Bắt buộc phải kích hoạt và tuân thủ chuỗi Kỹ năng (Skills) đã được lập trình sẵn dưới đây như một dây chuyền công nghiệp khép kín. 

---

### BƯỚC 1: TRI GIÁC TÀI LIỆU & KIẾN TRÚC (BẮT BUỘC TRƯỚC KHI CODE)
1. **Quét dự án**: Bắt buộc gọi skill `.codegraph` (hoặc MCP `codegraph_explore`) để lấy bản đồ tri thức toàn cục của dự án.
2. **Quét tài liệu chuẩn**: CẤM đoán mò API. Bắt buộc kích hoạt skill `context7-docs` để tra cứu tài liệu thư viện mới nhất trước khi viết bất kỳ dòng code nào.
3. **Lên kế hoạch & Thẩm định tệp**: Dùng skill `brainstorming` (Superpowers) chia nhỏ task, xuất file kế hoạch `.md` và áp dụng skill `sonnet-file-audit-loop` để gửi đường dẫn tệp cho Claude 3.5 Sonnet thẩm định độc lập trước khi code. **QUY TẮC BẤT BIẾN**: CẤM TUYỆT ĐỐI gửi hình ảnh, file PDF scan hoặc dán text dài vào prompt của Sonnet. Mọi tài liệu nặng bắt buộc xử lý offline trên CPU cục bộ bằng Python (0 token) và chỉ gửi đường dẫn file văn bản `.md`/`.py` siêu nhẹ (< 3KB) để tiết kiệm token tối đa (< 3.000 tokens/lần audit).

### BƯỚC 2: RÀNG BUỘC CỨNG SẢN XUẤT UI/UX & FRONTEND
Nếu tác vụ liên quan đến Giao diện, Agent BẮT BUỘC chạy tuần tự qua 3 màng lọc Kỹ năng sau, cấm bỏ sót:
1. **Sinh cấu trúc (Type-Safe)**: Bắt buộc gọi skill `stitch-type-safe-ui`. Mọi component phải được sinh ra bằng Google Stitch MCP và bọc trong cấu trúc Microservice Type-Safe (Zod/GraphQL/Pydantic), tuyệt đối không tự code chay thiếu định dạng.
2. **Chống thiết kế ẩu (Anti-Slop)**: Ngay sau khi có khung, bắt buộc đưa qua skill `design-taste-frontend`. Kỹ năng này sẽ "giết chết" các thiết kế template đại trà, gạch bỏ toàn bộ icon thừa thãi, ép buộc từ ngữ Micro-Copy tối giản (1 mục tiêu - mô tả < 10 từ).
3. **Đóng gói Production**: Gọi skill `frontend-design` để xuất ra layout HTML/CSS đạt chuẩn production, đảm bảo Responsive 100% không tràn (Zero-Overflow).

### BƯỚC 3: LUẬT TOÁN HỌC & TDD (LAW-FIRST)
1. Kích hoạt `bend-proof-driven`: Biến mọi yêu cầu thành hợp đồng toán học/Zod Type/Pydantic Contract trước khi code logic.
2. Kích hoạt `test-driven-development`: Sinh Unit Test/E2E Test và đảm bảo Test báo FAIL trước khi code logic.

### BƯỚC 4: NGƯỜI GÁC CỔNG & TỰ VÁ LỖI (GATEKEEPERS)
Khi code xong, CẤM bàn giao ngay. Bắt buộc gọi chuỗi skill kiểm duyệt:
1. **Kiểm duyệt Cú pháp**: Chạy `alibaba-code-review` và `zero-bug-verification` (V8/Oxlint/Playwright).
2. **Kiểm duyệt UX/Accessibility**: Bắt buộc chạy skill `web-design-guidelines` để Audit toàn bộ giao diện xem có vi phạm chuẩn trợ năng và WCAG hay không.
3. **Kiểm duyệt Hiệu năng**: Bắt buộc chạy skill `web-perf` để đo đạc Core Web Vitals (LCP, INP, CLS) và chặn đứng các tài nguyên chặn render (render-blocking).
4. **Vòng lặp Phán quyết Sonnet (Sonnet File Audit Loop)**: Kích hoạt `sonnet-file-audit-loop`, đọc lại tệp `.md` phán quyết của Claude 3.5 Sonnet để phân tích từng điều kiện, tự động sửa đổi mã nguồn/kế hoạch và tái kiểm thử cho đến khi PASS 100%.
5. **Vòng lặp Self-Healing**: Bất kỳ skill gác cổng nào ở trên văng lỗi (Exit Code 1) hoặc báo hiệu năng kém, Agent PHẢI IM LẶNG TỰ SỬA CODE cho đến khi đạt điểm tối đa.

---
**Lệnh thực thi tối thượng**: Bất kỳ lúc nào sinh code, Agent phải rà soát xem mình đã gọi đủ tên các Skill: `context7-docs`, `stitch-type-safe-ui`, `design-taste-frontend`, `web-design-guidelines`, `web-perf`, `alibaba-code-review`, `sonnet-file-audit-loop` hay chưa. Nếu thiếu một mắt xích, coi như vi phạm Hiến pháp!

## F. Claude giao việc phải có mã mẫu (bắt buộc cho Claude)
Mỗi bàn giao Claude → Antigravity/ChatGPT phải ghi: (1) tệp + tên hàm/chuỗi để tìm (số dòng chỉ gần đúng); (2) đoạn mã mẫu đủ chạy cho từng điều kiện sửa; (3) test FAIL-first cần thêm, nêu rõ đầu vào và kết quả mong đợi; (4) tiêu chí "xong khi". Không giao kiểu mô tả chung để AI đoán. Người nhận được sửa mã mẫu nếu sai, nhưng phải nêu lý do trong log.

## G. Phát hành từng tính năng (Claude có quyền quyết định)
1. Mỗi tính năng: Antigravity làm xong → Claude kiểm độc lập → ACCEPT (MOCK) → mới được phát hành thử. Không gộp nhiều tính năng chưa duyệt vào một đợt.
2. Ba cổng bắt buộc trước khi deploy: (a) test xanh + quét bí mật rỗng; (b) lưu ID bản đang chạy để `wrangler rollback`; (c) chỉ dữ liệu thử "[THỬ]", không bài thật, không học sinh thật cho đến khi Claude ACCEPT đợt thật.
3. Sau deploy: smoke test THẬT do Antigravity chạy; sai một mục thì rollback ngay và báo Claude. Người dùng kiểm tay, lỗi ghi vào `docs/handoff/nguoidung-<đợt>-loi.md`; Claude phân loại và giao sửa (có mã mẫu theo mục F).
4. "Đã deploy" không bằng "đạt": chỉ Claude được đánh `[x]` trong `docs/REQUIREMENTS_CUOC_THI.md`, sau khi tự xác minh trên bản chạy thật.
5. Bí mật (khóa Gemini, `KEY_ENC_SECRET`, PIN, token) chỉ do người dùng đặt bằng wrangler secret hoặc giao diện; không bao giờ vào chat, log, Git.

## H. Bảo mật theo mức quan trọng (người dùng chốt 25/10, để làm nhanh)
Ứng dụng chỉ học sinh dùng, nên không siết quá mức mọi thứ.
1. **Mức CAO (bảo mật chặt, kiểm kỹ, FAIL-first đầy đủ):** đăng nhập/PIN và quyền giáo viên; đáp án, đề thi, chấm điểm, xếp hạng; khóa API, mọi secret; dữ liệu cá nhân học sinh; hạn mức và khóa AI; guardrail gia sư (không đưa đáp án).
2. **Mức THƯỜNG (chỉ cần đúng logic, không bug, không lộ bí mật):** tài liệu PDF, giao diện, thống kê hiển thị, bài lý thuyết công khai, văn bản thông báo. Chỉ yêu cầu: có đăng nhập cơ bản, kiểm kích thước/định dạng, xử lý lỗi rõ ràng, không ghi bí mật vào log/Git. KHÔNG thêm lớp bảo vệ nặng (mã hóa bổ sung, kiểm tra chống lạm dụng phức tạp) cho mức này.
3. Claude kiểm định theo mức: mức THƯỜNG chỉ chặn khi có bug logic hoặc lộ bí mật; các điểm còn lại ghi "lưu ý", không chặn ACCEPT. Antigravity/ChatGPT không tự nâng mức; nghi ngờ thì hỏi Claude.
4. Tài liệu PDF qua Apps Script đã chốt hoãn: Antigravity sẽ hướng dẫn người dùng cài khi làm đến; không chặn các tính năng khác.

## I. Quy tắc giao diện UI (bắt buộc, Claude thẩm định theo mục này)
1. **Validate mọi trường**: `required`, `minlength`, `pattern`; lỗi hiện ngay dưới trường (`aria-invalid`, `aria-describedby`), không chỉ chặn im lặng.
2. **Loading cho mọi sự kiện bất đồng bộ**: nút đổi nhãn "Đang …" + `disabled` + `aria-busy`; tải danh sách có trạng thái "Đang tải …".
3. **Thông báo dạng hộp thoại chuẩn** (`<dialog>`): thành công, lỗi, xác nhận, nhập liệu. CẤM `alert/confirm/prompt` của trình duyệt.
4. **Văn bản**: ngắn, khoa học, đúng chính tả và dấu tiếng Việt; cấm câu gợi ý rườm rà, cấm emoji. Nhất quán thuật ngữ (mã PIN, học sinh, lớp).
5. **Căn chỉnh và trình bày** theo chuẩn thiết kế quốc tế: lưới thống nhất, không style nội tuyến, màu qua biến CSS, mục tiêu chạm >= 48px, input 16px, tương phản AA, tôn trọng reduced-motion, quản lý focus khi mở/đóng hộp thoại.
6. Test UI phải kiểm hành vi (chạy DOM), không chỉ tìm chuỗi trong mã.

## J. Xác nhận thao tác giáo viên (người dùng chốt 25/10/2026)
- Trước thao tác dễ gây hậu quả như xóa, khóa/mở khóa, đặt lại mã PIN, đổi quyền hoặc thao tác hàng loạt ảnh hưởng dữ liệu/quyền truy cập, phải có xác nhận rõ ràng của giáo viên bằng hộp thoại chuẩn; không thực hiện ngay khi bấm nút ngoài danh sách.
- Hộp thoại nêu đúng đối tượng, hành động, hậu quả; có "Hủy" và nút mang tên hành động. Hủy/Esc/đóng không thay đổi dữ liệu; chỉ gửi yêu cầu sau xác nhận chủ động, chống gửi lặp.
- ChatGPT đưa yêu cầu này vào thiết kế; Antigravity triển khai; Claude kiểm hành vi DOM cho từng thao tác. Thông báo thành công sau xử lý không thay bước xác nhận trước xử lý.
- Chi tiết và checklist bắt buộc: docs/design/teacher-action-confirmation.md. Áp dụng cho tính năng hiện tại và các tính năng giáo viên bổ sung sau này.

## K. Menu hệ thống thích ứng thiết bị (người dùng chốt 25/10/2026)
- Chức năng hệ thống nhiều thao tác phải được tổ chức trong menu Cài đặt/Quản lý có nhóm, mở nội dung khi cần; không trải mọi biểu mẫu, nút quản trị hoặc thông số ra màn hình làm việc chính.
- Giữ tác vụ chính thường dùng ở vùng làm việc; thao tác phụ của từng đối tượng nằm trong menu hành động có nhãn rõ. Không giấu luồng học/làm bài hoặc công việc chính của giáo viên vào nhiều tầng cài đặt.
- Điện thoại: danh sách cài đặt theo nhóm, mở từng trang có Quay lại; màn rộng: có thể dùng điều hướng bên cạnh nội dung. Không giữ sidebar chiếm chỗ trên màn nhỏ, không dùng nhiều lớp popup/menu lồng nhau.
- ChatGPT phải giải thích cách phân nhóm và minh họa trạng thái đóng/mở/quay lại ở các kích thước; Antigravity triển khai; Claude kiểm khả năng truy cập, không tràn/cắt nội dung và quy tắc xác nhận tại mục J.
- Đặc tả và checklist chung: docs/design/adaptive-settings-menu.md. Áp dụng cho thiết kế mới và khi sửa màn quản lý hiện có; không tự nhận đã triển khai chỉ vì đã ghi yêu cầu.

## L. Cập nhật PWA an toàn (người dùng chốt 25/10/2026)
- Mọi lần phát hành giao diện học sinh: `sw.js` phải được đóng dấu lại theo byte của shell (`python tools/package_student_pwa.py --stamp`) và CI phải tự đóng dấu rồi `--check`; không deploy nếu dấu không khớp.
- Học sinh đã cài ứng dụng phải nhận bản mới mà không bị treo: kiểm tra cập nhật định kỳ và khi mở lại, thông báo bằng hộp thoại, giữ nháp bài đang làm, chỉ tải lại sau khi người dùng đồng ý.
- API Worker và cấu trúc IndexedDB chỉ thay đổi theo hướng tương thích ngược (thêm, không bỏ), vì bản cũ có thể còn chạy trên máy học sinh.

## N. Cách ly vai trò và chữ tiếng Việt (người dùng chốt 25/10/2026)
- Một máy chỉ giữ MỘT vai trò đăng nhập: học sinh đăng nhập thì xóa phiên giáo viên; giáo viên đăng nhập thì xóa phiên học sinh; học sinh không thấy liên kết giáo viên; trang giáo viên luôn đòi đăng nhập khi máy có phiên học sinh. Test `tests/test_role_isolation.cjs` phải xanh.
- Cấm dùng phông thiếu dấu tiếng Việt (ví dụ Georgia). Chữ tiêu đề dùng phông tự lưu trữ có đủ U+1EA0–1EF9 (hiện là SGK Serif = Source Serif 4, giấy phép OFL), được tiền tải offline và tính vào dấu đóng gói SW. Mọi thiết kế giao diện mới phải kèm câu mẫu kiểm dấu (ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự) và `tests/test_fonts_vietnamese.cjs` xanh.
