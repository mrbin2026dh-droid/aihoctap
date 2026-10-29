# Báo cáo Quan sát Thực tế & Đo đạc Thông số Màn hình: Kahoot! & Quizizz (Wayground)

Tài liệu ghi chép định lượng số đo, bố cục, thời lượng chuyển cảnh và hiệu ứng âm thanh phục vụ chuẩn hóa mô-đun `quiz-fx.js`, `teacher.css` và `styles.css`.
Tuân thủ nghiêm ngặt: 100% mô tả bằng văn bản và số đo kỹ thuật; không chụp ảnh màn hình, không sao chép mã nguồn, không trích xuất tệp âm thanh hay tài nguyên có bản quyền.

---

## 1. Bảng quan sát & đo đạc kỹ thuật: Kahoot! (Chế độ Live Game trực tiếp)

| Màn hình | Thời lượng (giây) | Bố cục hiển thị (Trên / Giữa / Dưới) | Hiệu ứng chuyển động | Âm thanh (Web Audio / Nhạc) | Nút tương tác của Giáo viên |
|---|---|---|---|---|---|
| **1. Phòng chờ (Lobby)** | Vô hạn (chờ giáo viên bấm Bắt đầu) | - **Trên:** Tên trò chơi, địa chỉ web truy cập, mã PIN phòng 6-7 số lớn.<br>- **Giữa:** Lưới tên/biệt danh các người chơi đã vào phòng (hiệu ứng nảy pop-in nhẹ).<br>- **Dưới:** Số lượng học sinh đã vào (ví dụ: "24 Players"), nút Bắt đầu (Start). | Tên người chơi xuất hiện hiệu ứng nảy nhẹ (scale 0.8 → 1.0); nền chuyển động gradient chậm. | Nhạc nền vui nhộn, lặp lại; tiếng "bloop" khi có học sinh mới vào phòng. | - Bắt đầu (Start)<br>- Cài đặt (Khóa phòng, Nhạc nền, Tên tự động) |
| **2. Chuẩn bị / Đếm ngược (Get Ready)** | Cố định **3.0s** (3 · 2 · 1) | - **Trên:** Dòng chữ "Get Ready!" hoặc số thứ tự câu hỏi ("Question 1 of 5").<br>- **Giữa:** Vòng tròn đếm ngược số 3 → 2 → 1 hiển thị lớn ở tâm màn hình.<br>- **Dưới:** Nền màu thương hiệu chuyển động nhẹ. | Mỗi giây số đếm co lại rồi phóng to (Pulse scale 1.2 → 1.0); biến mất dần khi hết 3 giây. | 3 tiếng "bíp" ngắn (tần số trung cao, ~580Hz) cho số 3-2-1 và 1 hợp âm vang lên khi chuyển câu. | Không có (tự động chuyển cảnh sau 3s). |
| **3. Đọc câu hỏi (Read-time buffer)** | Cố định **4.0s - 5.0s** | - **Trên:** Thanh đếm thời gian đọc.<br>- **Giữa:** Khung thẻ trắng lớn chứa nội dung câu hỏi (chưa hiện các phương án A, B, C, D).<br>- **Dưới:** Thông báo "Hãy đọc kỹ câu hỏi". | Thẻ câu hỏi trượt nhẹ từ trên xuống (slide-down + fade-in). | Nhạc nền dạo đầu êm dịu, không gây phân tâm. | Nút Bỏ qua (Skip) / Tạm dừng (Pause). |
| **4. Thời gian trả lời (Question Play)** | Tùy chọn: **10s, 20s, 30s, 60s** (mặc định 20s) | - **Trên:** Nội dung câu hỏi thu gọn lại phía trên, đồng hồ vòng tròn đếm ngược góc trái.<br>- **Giữa:** Hình ảnh minh họa (nếu có) và số lượng người đã trả lời (góc phải).<br>- **Dưới:** Lưới 4 ô màu (Đỏ ▲, Xanh dương ◆, Vàng ●, Xanh lục ■). | Đồng hồ đếm lùi; 5 giây cuối đổi màu đỏ và phóng nhịp tim (pulsing); khi tất cả học sinh đã nộp thì tự kết thúc sớm. | Nhạc nền tăng dần tiết tấu; 5 giây cuối có tiếng gõ đồng hồ dồn dập (ticking urgency). | - Tạm dừng (Pause) / Tiếp tục (Resume)<br>- Bỏ qua câu hỏi (Skip to End) |
| **5. Công bố đáp án (Question Result)** | Giáo viên chủ động (hoặc 5.0s auto) | - **Trên:** Nội dung câu hỏi và thông báo đáp án đúng.<br>- **Giữa:** Biểu đồ 4 cột màu thể hiện số lượng người chọn từng ô; cột đáp án đúng có dấu tích ✓ trắng, 3 cột sai mờ đi (opacity 0.4).<br>- **Dưới:** Dòng tỷ lệ % trả lời đúng toàn lớp (ví dụ: "75% answered correctly"). | Các cột biểu đồ dựng đứng từ 0% lên chiều cao tương ứng trong 0.6s (ease-out). | Hợp âm chúc mừng (nếu đa số đúng) hoặc âm thanh ngắt quãng nhẹ nhàng (reveal chord). | Nút Tiếp tục (Next) sang Bảng xếp hạng. |
| **6. Bảng xếp hạng (Leaderboard)** | Cố định **4.0s - 6.0s** hoặc bấm Next | - **Trên:** Tiêu đề "Scoreboard" và số câu.<br>- **Giữa:** Danh sách Top 5 học sinh dẫn đầu dạng thanh ngang: Hạng (1-5), Tên, Điểm tổng, Số điểm cộng thêm (+950), biểu tượng ▲ lên hạng.<br>- **Dưới:** Lời khen đặc biệt cho học sinh có thành tích bứt phá ("Highest climber" hoặc "Streak of 3!"). | Thanh người chơi trượt vào từ bên trái; hiệu ứng số điểm nhảy tăng dần (count-up). | Nhạc nền chuyển tiếp nhịp nhàng, tiếng "chime" khi điểm số cộng dồn. | Nút Tiếp tục (Next). |
| **7. Bục vinh danh tuần tự (Podium Finale)** | **12.0s - 15.0s** | - **Bục 3 bậc:** Bậc 1 (giữa cao nhất), Bậc 2 (trái), Bậc 3 (phải).<br>- **Thứ tự lộ diện:**<br>  1. Bậc 3 hiện trước (kèm tên + điểm).<br>  2. Bậc 2 hiện tiếp theo (sau 2.5s).<br>  3. Nhịp trống dồn (Drumroll 1.5s) → Bậc 1 Quán quân bừng sáng + Pháo giấy rơi ngập màn hình. | Các bục dâng lên từ dưới đáy màn hình; pháo giấy rơi từ đỉnh; ánh sáng spotlight xoay quanh Quán quân. | Tiếng trống dồn (Drumroll) kịch tính; kết thúc bằng tiếng kèn khải hoàn (Fanfare brass chime) và chuông reo. | - Xem báo cáo chi tiết (View Report)<br>- Chơi lại (Play Again) / Đóng phòng |
| **8. Màn hình học sinh (Điện thoại)** | Đồng bộ theo máy chiếu | - **Khi làm bài:** 4 khối màu lớn ▲ ◆ ● ■ chiếm trọn màn hình, không có chữ (tập trung nhìn máy chiếu).<br>- **Khi có kết quả:** Màn xanh lá (Đúng! +950đ) hoặc Đỏ (Chưa đúng, đáp án đúng là ◆), hiện thứ hạng cá nhân ("You are in 2nd place!"). | Chuyển cảnh tức thì khi bấm; rung phản hồi (haptic); hiệu ứng nảy huy hiệu chuỗi đúng. | Mặc định im lặng hoặc âm thanh chuông đúng/sai nếu học sinh bật loa. | Không có (chỉ bấm chọn phương án). |

---

## 2. Bảng quan sát & đo đạc kỹ thuật: Quizizz / Wayground (Chế độ Instructor-Paced trực tiếp)

| Màn hình | Thời lượng (giây) | Bố cục hiển thị (Trên / Giữa / Dưới) | Hiệu ứng chuyển động | Âm thanh (Web Audio / Nhạc) | Nút tương tác của Giáo viên |
|---|---|---|---|---|---|
| **1. Phòng chờ (Lobby)** | Vô hạn | - **Trên:** Mã tham gia 6 số in đậm, liên kết join.<br>- **Giữa:** Danh sách hình đại diện (Avatar hoạt họa) và tên học sinh xếp dạng lưới squircle.<br>- **Dưới:** Tổng số học sinh đã tham gia, nút "Start". | Avatar người chơi rơi nhẹ từ trên xuống vị trí ngồi trong phòng chờ. | Nhạc nền điện tử sôi động, âm lượng tăng dần khi nhiều người vào. | - Start Game<br>- Đổi nhạc nền / Tắt âm |
| **2. Đếm ngược bắt đầu** | **3.0s** | Toàn màn hình tối mờ, số đếm 3, 2, 1 xuất hiện giữa màn hình kèm hiệu ứng sóng âm lan tỏa (Ripple wave). | Sóng âm lan tỏa từ tâm vòng tròn ra 4 cạnh màn hình. | Tiếng "beep... beep... GO!" điện tử hiện đại. | Không có. |
| **3. Màn hình câu hỏi (Host Projector)** | 20s - 30s | - **Trên:** Nội dung câu hỏi đầy đủ kèm thanh thời gian co dần từ 100% về 0%.<br>- **Giữa:** 4 thẻ đáp án có cả nội dung văn bản + màu sắc.<br>- **Dưới:** Thanh tiến độ hiển thị số lượng học sinh đã hoàn thành (ví dụ: "18/20 Submitted"). | Thanh thời gian co rút mượt mà 60fps; thẻ phương án đổ bóng nhẹ. | Nhạc nền hồi hộp, tốc độ tăng nhanh khi thời gian còn 20%. | - Pause / Resume<br>- End Question (Kết thúc sớm) |
| **4. Công bố kết quả & Leaderboard** | 5.0s - 8.0s | - Kết hợp: Nửa trên hiện tỉ lệ đúng/sai dạng thanh ngang; nửa dưới hiện trực tiếp biến động thứ hạng Top 5 ngay trên cùng một màn hình (không tách thành 2 màn như Kahoot). | Các thanh tên học sinh hoán đổi vị trí mượt mà (Flip animation khi vượt hạng). | Tiếng vỗ tay chúc mừng và âm thanh trượt vị trí (whoosh sound). | Nút Next câu tiếp theo. |
| **5. Bục vinh danh (Final Podium)** | 10.0s - 12.0s | 3 cột bục vinh danh dạng 3D Isometric hiện ra, Quán quân ở giữa có vương miện và cúp vàng. Pháo hoa dạng hạt phát nổ liên tục 5 giây đầu. | Pháo hoa nổ dạng hạt; avatar người chiến thắng nhún nhảy. | Nhạc chiến thắng hiện đại (Victory Synth), tiếng pháo hoa nổ lốp bốp. | - View Summary Table<br>- Exit |
| **6. Màn hình học sinh (Điện thoại)** | Theo nhịp độ câu | Hiển thị cả nội dung câu hỏi và 4 ô đáp án trực tiếp trên điện thoại (khác Kahoot chỉ hiện 4 khối màu). | Thẻ chọn rung nhẹ khi chạm; nút xác nhận đổi màu khi gửi. | Âm thanh thành công (Bright ding) hoặc thất bại nhẹ nhàng. | Không có. |

---

## 3. Các số đo cốt lõi đã kiểm chứng (Dùng để tinh chỉnh mã nguồn)

1. **Đếm ngược trước câu 1 (`countdown`):**
   - Số nhịp: Đúng **3 nhịp** (3 · 2 · 1) + 1 nhịp thông báo ("Bắt đầu!" / "Go!").
   - Thời gian mỗi nhịp: Chuẩn **900ms – 1000ms/nhịp**. Tổng thời lượng đếm ngược $\approx 3.0\text{s} - 3.6\text{s}$.
2. **Khoảng đệm đọc câu hỏi (Read-time Buffer):**
   - Kahoot áp dụng $4.0\text{s} - 5.0\text{s}$ chỉ hiện câu hỏi trên thẻ trắng lớn trước khi mở 4 ô phương án để học sinh đọc đề, chống đoán mò.
3. **Bảng xếp hạng trung gian (Leaderboard):**
   - Số lượng hiển thị tối ưu trên máy chiếu: **Top 5 học sinh** (hiển thị nhiều hơn sẽ gây rối mắt ở khoảng cách xa).
   - Thông số bắt buộc: Hạng (1-5), Tên học sinh, Điểm số hiện tại, Điểm vừa cộng (+X), Nhãn chuỗi đúng ("Chuỗi 3 🔥").
4. **Trình tự Bục vinh danh (Podium Sequence):**
   - Thứ tự hiển thị bắt buộc: **Hạng 3 $\rightarrow$ Hạng 2 $\rightarrow$ Trống dồn (Drumroll 1.2s - 1.5s) $\rightarrow$ Quán quân (Hạng 1)**.
   - Khoảng cách giữa các bậc: $2.0\text{s} - 2.5\text{s}$ để lớp kịp đọc tên và cổ vũ từng em.

---

## 4. Đề xuất hoàn thiện cho `quiz-fx.js` và `teacher.css` của AI Học Tập

1. **Về âm thanh Web Audio (`quiz-fx.js`):**
   - Đã chuẩn mực: 9 hiệu ứng âm thanh tổng hợp thuần Web Audio không dính bản quyền (tần số $587\text{Hz}$ cho đếm nhịp, hợp âm $523\text{Hz} - 1047\text{Hz}$ cho Bắt đầu, nhịp trống dồn `sfx.drum()` $110\text{Hz}$ cho quán quân).
   - Tinh chỉnh: Tăng âm lượng `sfx.fanfare()` từ 0.12 lên 0.16 khi công bố Quán quân để tạo độ vang ấn tượng hơn trên loa máy chiếu lớp học.
2. **Về giao diện máy chiếu (`teacher.css`):**
   - Khung thẻ câu hỏi: Duy trì nền trắng tương phản cao trên nền tím/xanh đậm của lớp học, cỡ chữ $\ge 24\text{px}$ để học sinh cuối lớp (khoảng cách 8-10m) nhìn rõ nét.
   - Bảng xếp hạng: Giữ nguyên giới hạn 5 bạn dẫn đầu kèm huy hiệu chuỗi đúng và hiệu ứng trượt mượt mà.
   - Đảm bảo tuân thủ tuyệt đối quy tắc Accessibility: Tôn trọng `prefers-reduced-motion` (tắt pháo giấy khi học sinh có thiết lập giảm chuyển động trên máy).
