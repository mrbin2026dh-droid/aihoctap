# Kiểm định kế hoạch chi tiết Firebase + Drive + Apps Script
Từ: Claude (Opus 5.5) → Sang: Antigravity & Người dùng   Ngày: 26/10/2026
Đã đọc: docs/plans/ke-hoach-chi-tiet-firebase-drive.md, docs/handoff/antigravity-claude-buoc0-ket-qua.md, docs/plans/kien-truc-firebase-drive.md (mục 8), worker/index.js (PBKDF2, route thi), AGENTS.md.

## Phán quyết: CHƯA DUYỆT — SỬA RỒI NỘP LẠI (hướng đi đúng, chưa đủ an toàn để làm)
Hướng "đường thi không qua Worker, Worker chỉ giữ khóa Gemini" đúng với mục tiêu và gói miễn phí. Nhưng có 7 lỗi chặn (B1–B7); làm theo bản hiện tại có thể **mất bài**, **lộ đề trước giờ**, **mạo danh học sinh**, và **không quay lui được**. Bước 0 mới là khung — chưa có số đo thật nào, nên chưa được bắt đầu Phase 2.

## Lỗi chặn (bắt buộc sửa trước khi viết mã)

**B1. Học sinh tự tạo tài khoản → mạo danh và rác tài khoản.** Kế hoạch để học sinh `signUp` qua REST bằng API key công khai. Bất kỳ ai cũng tạo được `hs9a02@...` trước học sinh thật và chiếm danh tính, hoặc tạo hàng nghìn tài khoản rác.
Sửa: tắt tự đăng ký (Firebase Console → Authentication → Settings → User actions → bỏ "Enable create (sign-up)" — cần kiểm thật trong Bước 0). Tài khoản do giáo viên/Apps Script tạo. Danh tính lấy từ nút `students/$uid` (họ tên, lớp, khối) do giáo viên ghi; client không tự khai.

**B2. Chưa có cách tạo hàng loạt và đặt lại PIN.** Bước 0 ghi "Chưa thử" mục Apps Script dùng quyền quản trị Firebase Auth. Không có cái này thì Phase 5 (chuyển danh bạ) không làm được, và học sinh quên PIN giữa giờ thi thì giáo viên bó tay.
Sửa: thêm vào Bước 0: Apps Script gọi Identity Toolkit quản trị (`accounts:signUp` tạo tài khoản, `accounts:update` đổi mật khẩu) bằng OAuth của chủ dự án; đo 100 tài khoản. Nếu không được → phương án dự phòng phải ghi rõ trước khi duyệt.

**B3. Đề lộ trước giờ thi.** `exam_defs` cho mọi người đã đăng nhập đọc mọi lúc, kể cả câu hỏi. Học sinh F12 đọc đề hôm trước.
Sửa: tách `exam_meta` (tiêu đề, giờ, khối, số phút — đọc tự do) và `exam_questions/$exam_id` (chỉ đọc khi `now` trong khung `opens_at..closes_at` và đúng khối của học sinh, hoặc giáo viên). Đọc theo từng đề, không `GET /exam_defs.json` cả cây (tốn băng thông Spark).

**B4. Lộ đáp án sau khi nộp sớm.** Kế hoạch: Apps Script chấm xong "trả về kết quả trong 1–2 giây". Nếu trả đáp án đúng/sai từng câu thì học sinh nộp sớm báo đáp án cho bạn đang làm.
Sửa: trước `closes_at` chỉ trả điểm tổng (hoặc chỉ "Đã nhận bài"). Chi tiết đúng/sai chỉ sau `closes_at`. Thư mục Drive và file minh chứng không chia sẻ cho học sinh.

**B5. Mất bài sát giờ.** Rule `attempts` từ chối ghi sau `started_at + minutes + 30s`. Mạng chậm ở phút 44:50 → nộp trượt → bài mất (trái mục tiêu số 1 của người dùng).
Sửa: (a) nháp tự lưu là nguồn dự phòng; (b) Apps Script, khi đóng đề, **tự nộp từ nháp cuối** cho ai có phiên mà chưa có `attempts`, đánh dấu `auto_from_draft: true`; (c) đồng hồ client tính theo giờ máy chủ (đọc lại `started_at` server-timestamp), không theo giờ máy học sinh.

**B6. Quay lui không thật.** Cờ `USE_FIREBASE_DIRECT_EXAM` là hằng số trong `api.js` (đổi phải deploy lại, không "ngay lập tức"), và Phase 5 **xóa route thi + chuyển tài khoản** khỏi Worker → sau Phase 5 không còn gì để quay về.
Sửa: giữ nguyên route thi Worker và danh bạ cũ đến khi đã chạy thành công **≥2 kỳ thi thật** trên đường mới; cờ đặt **theo từng đề** (`exam_meta.backend: "firebase"|"worker"`), một đề bắt đầu ở đâu thì kết thúc ở đó. Xóa mã Worker là một phase riêng, sau cùng.

**B7. "Xóa PBKDF2" sẽ làm hỏng kho khóa Gemini.** Trong `worker/index.js` có hai PBKDF2: băm PIN (100k vòng, dòng ~154) và **giải mã kho khóa Gemini** (50k vòng, dòng ~85). Cái thứ hai vẫn cần. Ngoài ra nó chạy mỗi lần gọi gia sư (~10 ms CPU ước lượng từ số đo 100k ≈ 23 ms) → vẫn chạm trần 10 ms của Worker Free.
Sửa: chỉ bỏ băm PIN khi không còn đăng nhập qua Worker; khóa giải mã Gemini **tính một lần rồi giữ trong bộ nhớ isolate** (biến cấp module) thay vì suy lại mỗi request. Đo CPU sau khi sửa.

## Cần sửa (không chặn nhưng bắt buộc có trong bản kế hoạch mới)
1. **Rules thiếu kiểm tra dữ liệu (`.validate`)**: học sinh có thể ghi câu trả lời 10 MB vào `attempts`/`drafts` → tốn dung lượng/băng thông Spark. Giới hạn khóa câu hỏi, chuỗi ≤2000 ký tự, `$other: {".validate": false}`.
2. **Số lần làm cứng `'1' || '2'`** trong khi đề có `max_attempts`. Rule phải so với `exam_meta.max_attempts`; lần 2 chỉ khi lần 1 đã tồn tại.
3. **Giáo viên không làm được việc đang có**: gia hạn thời gian từng học sinh, đặt lại lượt, xóa thống kê (đã có ở bản Worker). Cần `sessions/$exam/$uid/extra_ms` (giáo viên ghi) và quyền giáo viên ghi/xóa ở cấp `$exam_id`.
4. **Rule số học với giá trị rỗng**: trong RTDB rules, `null + số` làm biểu thức lỗi → từ chối ghi. Khi tạo phiên phải ghi luôn `extra_ms: 0`.
5. **Phiên được tạo ngoài giờ thi**: rule `sessions` không kiểm `opens_at/closes_at` và khối lớp.
6. **Chấm đôi (đường 1 và đường 2 cùng chấm một bài)** → trùng file minh chứng, ghi đè điểm. Cần khóa theo học sinh (ghi `grading/$exam/$uid` có điều kiện bằng ETag `if-match` của RTDB REST, hoặc `LockService` khi số bài ít). Đường 1 phải lấy `uid` từ ID token đã xác minh, không từ body.
7. **Hạn mức Apps Script tài khoản thường**: trigger mỗi phút cả ngày ≈1440 lần/ngày, dễ chạm tổng thời gian trigger/ngày. Trigger chỉ chạy trong khung giờ thi (tự thoát nhanh khi không có đề mở, hoặc giáo viên bật/tắt).
8. **Lỗi tải file không chỉ là 429/503**: Apps Script khi quá tải hay trả trang lỗi HTML. Client chỉ coi là thành công khi nhận JSON `{ok:true, file_id}`; còn lại thì thử lại (backoff đã có).
9. **Thư mục Drive phải đặt tên theo `students/$uid`** (máy chủ đọc), không theo tên client gửi; kiểm phần mở rộng + kích thước ở Apps Script. `.sb3` là thêm mới so với người dùng đã chốt (.xlsx/.pptx/.docx/.pdf) → người dùng xác nhận.
10. **Token hết hạn sau 1 giờ**: thi 45 phút + nộp file có thể vượt; client làm mới bằng `securetoken.googleapis.com` refresh token.
11. **Phạm vi bị thiếu**: kế hoạch chỉ nói đường thi. Đăng nhập học sinh dùng chung cho luyện tập, gia sư, tiến độ; trang giáo viên (tổng quan/phân tích — chính là route nặng CPU nhất đã đo 32–45 ms) vẫn ở Worker. Phải ghi rõ: học sinh có **một** đăng nhập (Firebase) cho mọi thứ, và phân tích giáo viên chuyển sang đâu (gợi ý: Apps Script tổng hợp vào Sheet hoặc nút `stats/` tính sẵn).
12. **Lịch 6 ngày** không thực tế với Phase 6 thi thật. Thay ngày bằng **cổng**: không sang phase sau khi phase trước chưa có test xanh/số đo thật.

## Mẫu rules đã sửa (khung — PHẢI chạy Firebase Emulator trước khi tin)
```json
{"rules":{
 "teachers":{".read":false,".write":false},
 "students":{"$uid":{".read":"auth.uid===$uid||root.child('teachers/'+auth.uid).exists()",".write":"root.child('teachers/'+auth.uid).exists()"}},
 "exam_meta":{".read":"auth!=null","$e":{".write":"root.child('teachers/'+auth.uid).exists()"}},
 "exam_questions":{"$e":{
   ".read":"auth!=null&&(root.child('teachers/'+auth.uid).exists()||(now>=root.child('exam_meta/'+$e+'/opens_at').val()&&now<=root.child('exam_meta/'+$e+'/closes_at').val()&&root.child('students/'+auth.uid+'/grade').val()===root.child('exam_meta/'+$e+'/grade').val()))",
   ".write":"root.child('teachers/'+auth.uid).exists()"}},
 "exam_secrets":{".read":false,".write":false},
 "sessions":{"$e":{
   ".read":"root.child('teachers/'+auth.uid).exists()",".write":"root.child('teachers/'+auth.uid).exists()",
   "$uid":{".read":"auth.uid===$uid",
     ".write":"auth.uid===$uid&&!data.exists()&&now>=root.child('exam_meta/'+$e+'/opens_at').val()&&now<=root.child('exam_meta/'+$e+'/closes_at').val()&&root.child('students/'+auth.uid+'/grade').val()===root.child('exam_meta/'+$e+'/grade').val()",
     ".validate":"newData.child('started_at').val()===now&&newData.child('extra_ms').isNumber()",
     "extra_ms":{".validate":"newData.val()>=0&&newData.val()<=1800000"},
     "$other":{".validate":false}}}},
 "drafts":{"$e":{"$uid":{".read":"auth.uid===$uid||root.child('teachers/'+auth.uid).exists()",
   ".write":"auth.uid===$uid&&now<=root.child('sessions/'+$e+'/'+$uid+'/started_at').val()+root.child('exam_meta/'+$e+'/minutes').val()*60000+root.child('sessions/'+$e+'/'+$uid+'/extra_ms').val()+30000",
   "answers":{"$q":{".validate":"newData.isString()&&newData.val().length<=2000"}},
   "updated_at":{".validate":"newData.val()===now"},"$other":{".validate":false}}}},
 "attempts":{"$e":{".read":"root.child('teachers/'+auth.uid).exists()",".write":"root.child('teachers/'+auth.uid).exists()",
   "$uid":{"$n":{".read":"auth.uid===$uid",
     ".write":"auth.uid===$uid&&!data.exists()&&($n==='1'||($n==='2'&&root.child('exam_meta/'+$e+'/max_attempts').val()>=2&&data.parent().child('1').exists()))&&now<=root.child('sessions/'+$e+'/'+$uid+'/started_at').val()+root.child('exam_meta/'+$e+'/minutes').val()*60000+root.child('sessions/'+$e+'/'+$uid+'/extra_ms').val()+30000",
     "submitted_at":{".validate":"newData.val()===now"},
     "answers":{"$q":{".validate":"newData.isString()&&newData.val().length<=2000"}},
     "$other":{".validate":false}}}}},
 "results":{"$e":{".read":"root.child('teachers/'+auth.uid).exists()","$uid":{".read":"auth.uid===$uid"},".write":false}}
}}
```
Ghi chú: phiên tạo bằng REST `PUT .../sessions/{e}/{uid}.json?auth=TOKEN` với `{"started_at":{".sv":"timestamp"},"extra_ms":0}`. `results` chỉ Apps Script ghi (OAuth chủ dự án bỏ qua rules). Chi tiết đúng/sai trong `results` chỉ ghi sau `closes_at` (B4).

## Bước 0 phải có số thật trước Phase 2 (cổng 1)
- Đăng nhập 30/50/100 tài khoản cùng IP mạng trường: thời gian p50/p95 và có gặp `TOO_MANY_ATTEMPTS_TRY_LATER` không. **Đây là rủi ro lớn nhất**: nếu bị chặn thì cả kế hoạch hỏng ở phút 0. Phương án dự phòng: đăng nhập rải trước giờ thi 10 phút.
- Tắt tự đăng ký có hiệu lực (B1); Apps Script tạo/đổi mật khẩu tài khoản (B2).
- Emulator: chạy bộ test rules trên (đọc đề trước giờ = từ chối; ghi bài người khác = từ chối; nộp sau hạn = từ chối; câu trả lời 3000 ký tự = từ chối; giáo viên gia hạn rồi học sinh nộp được).
- Apps Script: 30 lần nộp file 10 MB đồng thời → bao nhiêu lần lỗi, có mất file không; thời gian chạy trigger mỗi lần.

## Việc tiếp
Antigravity sửa kế hoạch theo B1–B7 và 12 mục, ghi bản mới (giữ bản cũ làm lịch sử), chạy Bước 0 có số thật, rồi chuyển lại Claude kiểm định. Không viết mã sản phẩm trước khi Claude ACCEPT.
