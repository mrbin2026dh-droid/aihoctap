# Báo cáo: 2 ca SAI khi chạy Firebase Emulator luật quiz_proof

Từ: Antigravity → Sang: Claude  
Ngày: 28/10/2026

## 1. Kết quả chạy kiểm thử Emulator thực tế
- Lệnh chạy:
  `cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-fast.test.mjs"`
- Kết quả:
  ```
  PASS quiz_key: tạo khóa phòng → được; tạo lại → chặn; đọc → chặn
  PASS quiz: ghi trạng thái KHÔNG có khóa → chặn
  PASS quiz: ghi trạng thái với khóa SAI → chặn
  PASS quiz: chủ phòng (khóa đúng) mở phòng + gắn lớp → được
  PASS quiz_proof: không đọc được
  PASS quiz: học sinh vào phòng → được; vào lại → chặn
  PASS quiz: trả lời khi chưa hỏi → chặn
  PASS quiz: trả lời đúng câu đang hỏi → được; lần 2 → chặn
  PASS quiz: trả lời câu khác / đáp án lạ → chặn
  FAIL quiz: học sinh tự ghi điểm (kq) / sửa trạng thái → chặn - Expected request to fail, but it succeeded.
  FAIL quiz_lop: gỡ thẻ lớp không có khóa → chặn; có khóa → được - Expected request to fail, but it succeeded.
  2 CA SAI — KHÔNG ĐĂNG LUẬT NÀY
  ```

## 2. Phân tích nguyên nhân gốc rễ (Root Cause)
1. Trong Firebase Realtime Database Security Rules, biến `newData` đại diện cho **toàn bộ trạng thái dự kiến của cơ sở dữ liệu sau khi ghi**, chứ **không phải** chỉ là các trường gửi kèm trong request hiện tại.
2. Tại dòng 55 & 59 của `rules-thi-fast.test.mjs`:
   `update(ref(anon), { 'quiz/123456/pub': ..., 'quiz_proof/123456': KEY })`
   Gói tin này ghi `KEY` thành công vào nút `/quiz_proof/123456` và được **lưu cố định** trong cơ sở dữ liệu.
3. Đến dòng 62:
   `set(ref(anon, 'quiz/123456/kq/hs01'), { p: 9999 })`
   Request này là một lệnh `set` đơn lẻ, **hoàn toàn không gửi kèm** `quiz_proof`.
   Tuy nhiên, khi rule của `kq` và `pub` kiểm tra:
   `newData.parent().parent().parent().child('quiz_proof').child($room).val() === root.child('quiz_key').child($room).val()`
   Do `/quiz_proof/123456` đã có sẵn giá trị `KEY` từ dòng 55, nhánh `newData` chưa bị sửa đổi vẫn kế thừa giá trị `KEY` cũ từ cơ sở dữ liệu.
   Hệ quả: biểu thức `KEY === KEY` vẫn trả về `true`! Lệnh ghi lậu của học sinh được chấp nhận thay vì bị chặn!
4. Tương tự tại dòng 63 với `quiz_lop`:
   `set(ref(anon, 'quiz_lop/9a'), null)`
   Xóa thẻ lớp không kèm khóa nhưng vẫn thành công vì `/quiz_proof/123456` đã tồn tại trong DB.

## 3. Tuân thủ Hiến pháp & Quy tắc bàn giao
- Theo điều khoản bảo mật của AGENTS.md và chỉ thị rõ ràng trong bàn giao của Claude:
  *"Không publish luật khi emulator còn ca SAI. Nếu ca chủ phòng bị sai hoặc có lỗi thì báo Claude, không tự nới luật."*
- Antigravity **chặn việc publish luật này lên Firebase Console** để bảo vệ an toàn cho hệ thống.
- Chuyển Claude thiết kế lại cơ chế chứng thực phòng (ví dụ: `quiz_proof` kèm nonce/timestamp, hoặc xóa proof sau kiểm tra, hoặc dùng cơ chế token/nonce thích hợp).

## 4. Các phần việc khác đã hoàn tất 100%
1. **Worker**:
   - Đã sinh secret ngẫu nhiên `BRAIN_KEY` (48 hex chars) và đưa vào `npx wrangler secret put BRAIN_KEY`.
   - Đã deploy bản Worker mới `294ac865-3813-42bc-94a9-e108efe3f769` (Rollback ID: `675db789-800d-406f-aba6-bc0706694629`).
   - Smoke test live endpoint `/api/brain/export`: Không có header trả về 403 Forbidden; Có header trả về 200 `{ items: [] }`.
2. **Code.gs**:
   - `test_sheet_exam_gs.cjs` PASS **101/101 ca**.
3. **Bộ não AI Python**:
   - Đã đóng kết nối SQLite3 trong khối `finally`, giúp toàn bộ test chạy mượt mà trên mọi hệ điều hành.
   - `python -m unittest discover -s brain/tests -t .` PASS **7/7 ca**.
