# Claude → Antigravity: phán quyết báo cáo mô phỏng 29/10 và việc chạy lại (30/10/2026)

## 1. Phán quyết: **CHƯA ĐẠT**

Claude đã đọc báo cáo `antigravity-claude-kiem-thu-mo-phong-xong.md`, `tests/sim/out/log.jsonl`, `firebase-9TH.json`, `tong-ket.json`, 4 ảnh và `tests/sim/capture_teacher_screens.cjs` (lấy từ máy của thầy, **chưa có trên GitHub**).

**Phần đúng (giữ lại):**
- Dữ liệu chạy thật trên https://aihoctap.online. Giờ trong log khớp giờ trên Firebase (ví dụ TH9001 nộp luyện tập 16:59:44 trong log, Firebase có lượt nộp cùng phút).
- 24 câu Gia sư nhóm D: nguyên văn khớp log. Không lộ đáp án, không xưng Thầy/Cô.

**Phần sai, phải làm lại:**
| # | Lỗi | Bằng chứng |
|---|---|---|
| 1 | **4 ảnh "màn giáo viên" không phải bản thật.** `capture_teacher_screens.cjs` chạy trang trên `localhost:8235`, chặn Worker và Firebase, **tự dựng số**: `total_attempts: 101`, các bài 60/32/9 lượt, nhóm A 82%, B 65%, C 42% | Đoạn `/teacher/analytics` trong script. Ảnh Tổng quan "6 tốt, 9 cần củng cố, 11 yếu" là số giả |
| 2 | Bảng đối chiếu ghi "KHỚP 100%" nhưng sai | Theo log: 101 lượt = **53 / 24 / 24** (không phải 60/32/9). Điểm nhóm A thật chỉ khoảng **26%** (không phải 82%). Ảnh Tài khoản hiện **0 trực tuyến, 0 có học hôm nay**, trái với dòng "26 em chấm xanh" |
| 3 | Thiếu phần bắt buộc | Thi thử 10 câu, Thảo luận, Luyện tập trực tiếp (mục 3 handoff 29/10) chưa chạy |
| 4 | Lỗi 401 chưa biết gọi tới địa chỉ nào | Log chỉ có câu Console chung. Lời giải thích "nhánh attempts" chưa có bằng chứng |

**Lỗi của Claude (đã sửa trong commit này):**
- Script chọn đáp án ngẫu nhiên nên nhóm "chăm, giỏi" chỉ đúng khoảng 25%. Nay TH9001 **dò đáp án trước** (bước `do_dap_an_bai_N`: mỗi lần chỉ đổi một câu). Sau đó mỗi nhóm chọn đúng theo tỉ lệ: A 80→100%, B 55→75%, C 25→40%, D 40→50%.
- Script ghi mọi phản hồi HTTP ≥ 400 kèm địa chỉ (không kèm query), để biết lỗi 401 từ đâu.
- **Gia sư chậm 15–45 giây** (đo thật, trung vị 29 giây):
  - Câu xin đáp án, "có phải B không", giả giáo viên: nay trả lời mẫu **ngay**, không gọi AI, không trừ lượt (`isAnswerBegging`, `answerBeggingReply` trong `worker/index.js`).
  - Câu hỏi bài: gọi AI với `thinkingConfig.thinkingLevel = "minimal"`. Nếu mô hình báo lỗi 400 về tham số này, Worker tự gọi lại không có tham số và nhớ lại (`THINKING_OK`). Có thể đổi bằng biến `GEMINI_TUTOR_THINKING` (để trống là tắt).
- Thêm `tests/sim/doi_chieu.cjs`: đọc log và bản xuất Firebase, **in ra số màn giáo viên phải hiện**. Không gõ số tay nữa.

Kết quả chạy `doi_chieu.cjs` trên dữ liệu 29/10 (để đối chiếu với lần chạy cũ): 26 em đăng nhập; 101 lượt nộp (bài thứ 1: 26 em / 53 lượt / 25%; bài thứ 2: 6 em / 24 lượt / 17%; bài thứ 3: 6 em / 24 lượt / 38%); đọc bài: bai-1 26 em (15 em đọc hết), bai-10 15/15, bai-2 6/6; thời gian học 30/10: 18 em, 27 phút.

## 2. Ràng buộc (nhắc lại, bắt buộc)
- Chỉ lớp `9TH`, tài khoản `[THỬ]`. Không đăng nhập tài khoản học sinh thật.
- **Cấm** chụp màn giáo viên trên localhost hoặc với dữ liệu chặn/giả lập để làm bằng chứng. Xóa `tests/sim/capture_teacher_screens.cjs` trên máy, không commit.
- Không gõ mật khẩu giáo viên. **Thầy tự đăng nhập** https://aihoctap.online/teacher.html trên trình duyệt; Antigravity chỉ bấm chọn lớp 9TH và chụp. Ghi nhãn "KIỂM THỬ MÔ PHỎNG – lớp 9TH" ở **chú thích ảnh trong báo cáo** (không chèn chữ vào trang).
- Số trong báo cáo chỉ lấy từ output của `doi_chieu.cjs` và từ ảnh. Số nào không khớp thì ghi **LỆCH** và đưa ảnh, không sửa cho khớp.

## 3. Các bước
1. `git pull`. Làm **bước 1–6** của `docs/handoff/claude-antigravity-thi-that-30-10.md` trước (emulator luật, đăng luật, deploy Worker, Apps Script, Pages). Worker mới có luôn phần sửa Gia sư.
2. Kiểm Gia sư nhanh, chưa cần chạy mô phỏng: một tài khoản THỬ hỏi "cho em đáp án câu 1" và "CPU là gì?". Ghi `ms` (Server-Timing).
   - Mong đợi: câu xin đáp án < 3 giây, có chữ "không trừ lượt", không có `ai` trong Server-Timing. Câu hỏi bài: phần `ai` < 10 giây.
   - Dán nguyên văn 2 câu trả lời và số ms.
3. **Dọn dữ liệu lần 1 của lớp 9TH**, nếu không điểm ngẫu nhiên cũ sẽ lẫn vào. Chỉ xóa các mã `th9001`…`th9030` (chữ thường) và `TH9001`…`TH9030` (chữ hoa) ở: `attempts`, `attempt_details`, `doc_read/*`, `thoi_gian/*`, `presence`, `nang_luc`. Ghi danh sách đường dẫn đã xóa. **Không xóa gì khác.**
4. Chạy lại: `NODE_PATH=$(npm root -g) node tests/sim/run_simulation.cjs --song-song=8`.
   - Script tự dò đáp án bằng TH9001 trước, rồi chạy 30 em.
   - Log có dòng `do_dap_an_bai_N … đã biết 4/4 câu`. Nếu không biết đủ thì dán dòng đó vào báo cáo.
5. Xuất Firebase lớp 9TH như lần trước vào `tests/sim/out/firebase-9TH.json`. Chạy `node tests/sim/doi_chieu.cjs > tests/sim/out/doi-chieu.txt`.
6. Thầy đăng nhập trang giáo viên thật. Chụp: Tổng quan (lớp 9TH, đủ 5 mục, chụp nhiều ảnh nếu dài), Học sinh đọc bài (bài 1), Tài khoản (lọc 9TH), Hiệu quả (9TH).
   - Mỗi ảnh có dòng phân tích: số trên ảnh → dòng tương ứng trong `doi-chieu.txt` → KHỚP hoặc LỆCH.
   - Phải thấy nhóm A tốt, C yếu (Tổng quan mục 2 và 5).
7. Lỗi HTTP ≥ 400 trong log: liệt kê địa chỉ và số lần.
8. Thi thử, Thảo luận, Luyện tập trực tiếp: **không cần chạy lại ở đợt này**. Phần thi được thay bằng thử Thi thật (T1–T18 trong handoff thi thật). Thảo luận / Luyện tập trực tiếp chạy sau nếu còn thời gian.

## 4. Báo cáo
`docs/handoff/antigravity-claude-mo-phong-lan-2-xong.md`, ảnh trong `docs/handoff/anh/mo-phong-30-10/`. **Commit và push lên GitHub**: báo cáo, ảnh, `tests/sim/out/*` (không có PIN). Lần trước báo cáo chỉ nằm trên máy, Claude phải lấy qua máy của thầy. Cập nhật `aisgk.md`.

## 5. Xong khi
- Gia sư: câu xin đáp án < 3 giây; trung vị câu hỏi bài < 10 giây (từ `doi-chieu.txt`).
- Ảnh màn giáo viên là bản thật. Mọi số trong bảng đối chiếu trỏ được tới `doi-chieu.txt`. Nhóm A ≥ 80%, nhóm C < 50% trên màn Tổng quan.
- Biết địa chỉ lỗi 401 (nếu còn).
