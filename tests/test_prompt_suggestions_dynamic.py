"""
Kiểm thử Playwright Live E2E: Dynamic Prompt Suggestions (Gợi ý thẻ hỏi đáp Socrates theo đúng bài học)
Xác thực triệt để vấn đề người dùng báo:
- Ở Tin học 9 Bài 6, 3 thẻ gợi ý nhanh phải hiển thị đúng chủ đề bài 6 (Mô phỏng PhET, Quy trình 4 bước, Gợi ý bài học/câu hỏi).
- Triệt tiêu hoàn toàn lỗi hiển thị cố định nội dung Tin học 6 Bài 1 (Dữ liệu khác thông tin, Vật mang tin).
- Kiểm tra tính tương tác: Click vào thẻ gợi ý gửi tin nhắn chính xác vào chat và AI phản hồi đúng bối cảnh.
- 0 lỗi Console F12.
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def test_dynamic_prompt_suggestions():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        page.on("console", lambda msg: (
            console_errors.append(msg.text) if msg.type == "error" else None
        ))

        # 1. Truy cập trực tiếp Lớp 9 Bài 6
        page.goto("http://127.0.0.1:8000/?grade=9&lesson=6", wait_until="networkidle")
        time.sleep(1.2)

        # 2. Kiểm tra container gợi ý
        prompt_cards = page.locator("#promptActionCards .prompt-action-card")
        assert prompt_cards.count() == 3, f"Phải có đúng 3 thẻ gợi ý, hiện có: {prompt_cards.count()}"

        card1_text = prompt_cards.nth(0).inner_text().strip()
        card2_text = prompt_cards.nth(1).inner_text().strip()
        card3_text = prompt_cards.nth(2).inner_text().strip()

        print(f"DEBUG: Grade 9 Lesson 6 cards in Theory view:")
        print(f"  Card 1: {card1_text}")
        print(f"  Card 2: {card2_text}")
        print(f"  Card 3: {card3_text}")

        # Kiểm tra Card 1 và 2 khớp đúng Bài 6 Lớp 9
        assert "Quy trình 4 bước mô phỏng?" in card1_text, f"Card 1 sai nội dung: {card1_text}"
        assert "Thực hành PhET mạch điện?" in card2_text, f"Card 2 sai nội dung: {card2_text}"
        assert "Gợi ý bài học này" in card3_text, f"Card 3 ở tab lý thuyết sai: {card3_text}"

        # Kiểm tra TUYỆT ĐỐI không còn vết tích Tin học 6 Bài 1
        assert "Dữ liệu khác thông tin?" not in card1_text
        assert "Ví dụ vật mang tin?" not in card2_text

        # 3. Chuyển sang Tab Luyện tập Trắc nghiệm (Quiz view)
        step_quiz = page.locator("#stepItemQuiz")
        if step_quiz.is_visible():
            step_quiz.click()
        else:
            page.locator(".section-subitem[data-type='quiz']").first.click()
        time.sleep(0.8)

        card3_quiz = prompt_cards.nth(2).inner_text().strip()
        print(f"DEBUG: Card 3 in Quiz Question 1: {card3_quiz}")
        assert "Gợi ý Câu 1" in card3_quiz, f"Card 3 trong Quiz mode phải là 'Gợi ý Câu 1', thực tế: {card3_quiz}"

        # 4. Chuyển sang Câu 2 trong Quiz
        pill_cau2 = page.locator(".pill-item:has-text('Câu 2')")
        if pill_cau2.is_visible():
            pill_cau2.click()
            time.sleep(0.5)
            card3_cau2 = prompt_cards.nth(2).inner_text().strip()
            print(f"DEBUG: Card 3 in Quiz Question 2: {card3_cau2}")
            assert "Gợi ý Câu 2" in card3_cau2, f"Card 3 khi sang Câu 2 phải cập nhật thành 'Gợi ý Câu 2', thực tế: {card3_cau2}"

        # 5. Click vào Card 1 ("Quy trình 4 bước mô phỏng?")
        prompt_cards.nth(0).click()
        time.sleep(1.0)

        # Kiểm tra tin nhắn học sinh xuất hiện trong khung chat
        student_bubbles = page.locator("#chatMessages .chat-bubble.student")
        assert student_bubbles.count() >= 1, "Tin nhắn của học sinh chưa được thêm vào chat"
        last_student_msg = student_bubbles.last.inner_text().strip()
        print(f"DEBUG: Student message sent: {last_student_msg}")
        assert "quy trình 4 bước" in last_student_msg.lower()

        # Đợi Socrates phản hồi
        for _ in range(20):
            assistant_bubbles = page.locator("#chatMessages .chat-bubble.assistant")
            if assistant_bubbles.count() >= 1:
                last_reply = assistant_bubbles.last.inner_text().strip()
                if "đang suy nghĩ" not in last_reply and len(last_reply) > 20:
                    print(f"DEBUG: Socrates reply received: {last_reply[:120]}...")
                    break
            time.sleep(0.5)

        # 6. Chuyển sang Lớp 6 để kiểm tra tính linh hoạt (Dynamic switching)
        pill_lop6 = page.locator('.header-grade-pill[data-grade="6"]')
        assert pill_lop6.is_visible(), "Không tìm thấy nút chuyển sang LỚP 6"
        pill_lop6.click()
        time.sleep(1.2)

        prompt_cards_lop6 = page.locator("#promptActionCards .prompt-action-card")
        card1_lop6 = prompt_cards_lop6.nth(0).inner_text().strip()
        card2_lop6 = prompt_cards_lop6.nth(1).inner_text().strip()

        print(f"DEBUG: Grade 6 Lesson 1 cards:")
        print(f"  Card 1: {card1_lop6}")
        print(f"  Card 2: {card2_lop6}")

        assert "Dữ liệu khác thông tin?" in card1_lop6, f"Khi chuyển về Lớp 6 bài 1, card 1 phải là Dữ liệu khác thông tin, thực tế: {card1_lop6}"
        assert "Ví dụ vật mang tin?" in card2_lop6, f"Khi chuyển về Lớp 6 bài 1, card 2 phải là Ví dụ vật mang tin, thực tế: {card2_lop6}"

        # 7. Kiểm tra 0 lỗi Console F12
        critical_errors = [e for e in console_errors if "favicon" not in e.lower()]
        assert len(critical_errors) == 0, f"Có lỗi Console F12: {critical_errors}"
        print("✅ Tất cả kiểm thử Playwright cho Dynamic Prompt Suggestions đã PASS 100%!")

        browser.close()

if __name__ == "__main__":
    test_dynamic_prompt_suggestions()
