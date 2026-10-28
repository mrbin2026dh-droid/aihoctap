# Claude → Antigravity: sửa luật Trò chơi câu hỏi (quiz_proof) — 28/10

## Vì sao lỗi 401 (Hình 1 của thầy)
Luật Firebase trên mạng vẫn là bản cũ (chưa có nhánh `quiz_lop`, `quiz`…), nên app học sinh đọc `quiz_lop/9a10` bị 401.
Bản trước bị chặn đăng vì ca `quiz_proof` thất bại trong máy giả lập.

## Claude đã sửa (đã đẩy lên main)
1. **Luật** `spike/step0/database.rules.ai-sgk-final.json`:
   - Bỏ cách so `quiz_proof === quiz_key`: cách này hỏng vì sau lần ghi đầu, `quiz_proof` đã nằm sẵn trong dữ liệu → ai cũng ghi được trạng thái mà không cần khóa.
   - Cách mới: mỗi lần chủ phòng ghi phải kèm **bằng chứng MỚI** dạng `khóa|số đếm`. Luật kiểm tra bằng chứng `beginsWith(khóa + '|')` và **khác** bằng chứng đang lưu. Không biết khóa → không tạo được bằng chứng → bị chặn.
   - Mã phòng: thay regex `{6}` bằng `$room.length === 6 && $room.matches(/^[0-9]+$/)`.
2. **App giáo viên** `teacher-quiz.js`: mỗi lần ghi gửi bằng chứng mới.
3. **App học sinh** `quiz-play.js`: thử đọc `quiz_lop` một lần trước khi nghe. Nếu luật chưa có nhánh này thì im lặng, 10 phút sau thử lại → **hết báo lỗi đỏ liên tục ngay cả khi chưa đăng luật**.
4. **Điện thoại**: Gia sư AI mở toàn màn hình, co theo bàn phím (tiêu đề không bị đẩy mất).
5. Tệp kiểm thử luật `spike/step0/emulator/rules-thi-fast.test.mjs` viết lại phần quiz, có 4 ca chẩn đoán đánh số.

## Antigravity làm
1. `git pull`.
2. Báo cáo `docs/handoff/antigravity-claude-luat-quiz-proof-fail.md` chưa có trên GitHub → nhớ commit + push các báo cáo sau.
3. Chạy máy giả lập như lần trước (`rules-thi-fast.test.mjs` với tệp luật mới).
4. **Tất cả ca đạt** → đăng luật lên Firebase Console (Realtime Database → Rules), dán nguyên tệp `database.rules.ai-sgk-final.json`. Sau đó nhờ thầy mở app học sinh: Console không còn 401 ở `quiz_lop`.
5. **Còn ca hỏng** → KHÔNG đăng. Ghi vào báo cáo: tên ca hỏng (ưu tiên 4 ca "quiz chẩn đoán 1–4") và nguyên văn lỗi. Commit + push báo cáo.
   - Nếu chỉ hỏng các ca quiz, có thể đăng tạm luật **bỏ 4 nhánh** `quiz_key`, `quiz_proof`, `quiz`, `quiz_lop` (các phần khác đã đạt), để các tính năng khác dùng luật mới. App học sinh đã tự im lặng khi thiếu nhánh quiz.

## Không cần deploy lại
- Worker không đổi (giữ bản 294ac865).
- Code.gs không đổi.
- Trang web (GitHub Pages) tự cập nhật sau khi Claude đẩy lên.

## VPS của thầy
Gói Cloud Basic (2 vCPU, 2 GB RAM, 30 GB SSD) là đủ. Chọn **Ubuntu 24.04**, không chọn Windows. Làm theo `docs/huong-dan-vps-bo-nao-ai.md`.
