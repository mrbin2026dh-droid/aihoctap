"""
Kịch bản Kiểm thử Sống E2E (Live Playwright Browser Test)
Kiểm thử trọn vẹn: Tải trang, Console F12 sạch, Làm bài trắc nghiệm, Chấm điểm và Chat Socrates.
"""
import sys
import time
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def run_e2e_test():
    print("=" * 65)
    print("BẮT ĐẦU KIỂM THỬ THỰC TẾ TRÊN TRÌNH DUYỆT THẬT (PLAYWRIGHT E2E)")
    print("=" * 65)

    console_errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Giám sát Console F12 bắt lỗi JavaScript / XSS
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # 1. Truy cập trang web
        print("[1/5] Truy cập http://127.0.0.1:8000...")
        start_time = time.time()
        response = page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        latency = round((time.time() - start_time) * 1000, 1)
        print(f"      -> HTTP {response.status} (Thời gian phản hồi: {latency}ms)")
        assert response.status == 200, f"Trang web trả về mã lỗi HTTP {response.status}"

        # 2. Kiểm tra nội dung SGK đã được render
        print("[2/5] Kiểm tra nội dung SGK Tin học 6...")
        page.wait_for_selector("#lessonContent h1", timeout=5000)
        title_text = page.locator("#lessonContent h1").inner_text()
        print(f"      -> Tiêu đề SGK hiển thị: '{title_text}'")
        assert "THÔNG TIN VÀ DỮ LIỆU" in title_text

        # 3. Kiểm tra bố cục không tràn ngang (Zero-Overflow)
        is_overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
        print(f"      -> Kiểm tra tràn ngang (Zero-Overflow): {'KHÔNG TRÀN (PASS)' if not is_overflow else 'BỊ TRÀN (FAIL)'}")
        assert not is_overflow, "Phát hiện lỗi tràn ngang trên giao diện!"

        # 4. Kiểm tra làm trắc nghiệm & Chấm điểm tức thì
        print("[3/5] Thực hiện bài làm trắc nghiệm (Chọn đáp án B, B, C, C)...")
        # Đợi danh sách câu hỏi xuất hiện
        page.wait_for_selector(".quiz-option-label", timeout=5000)
        options = page.locator(".quiz-option-label")
        opt_count = options.count()
        print(f"      -> Đã nạp thành công {opt_count // 4} câu hỏi trắc nghiệm ({opt_count} lựa chọn)")
        assert opt_count >= 16

        # Chọn phương án cho từng câu
        page.locator('.quiz-option-label[data-qid="tin6_b1_q1"][data-key="B"]').click()
        page.locator('.quiz-option-label[data-qid="tin6_b1_q2"][data-key="B"]').click()
        page.locator('.quiz-option-label[data-qid="tin6_b1_q3"][data-key="C"]').click()
        page.locator('.quiz-option-label[data-qid="tin6_b1_q4"][data-key="C"]').click()
        
        # Đăng ký tự động chấp nhận hộp thoại confirm (nếu có)
        page.on("dialog", lambda dialog: dialog.accept())

        # Bấm nộp bài
        page.locator("#btnSubmitQuiz").click()
        page.wait_for_selector("#quizScoreBanner:not(.hidden)", timeout=5000)
        score_text = page.locator("#quizScoreBanner").inner_text()
        print(f"      -> Kết quả chấm điểm: {score_text.splitlines()[0]}")
        assert "10/10" in score_text

        # 4b. Kiểm tra kịch bản học sinh cố tình chọn sai 1 câu để xem nhận xét sư phạm
        print("[3b/5] Kiểm thử phản hồi sư phạm khi học sinh chọn sai câu 1...")
        # Đổi câu 1 sang phương án A (Sai)
        page.locator('.quiz-option-label[data-qid="tin6_b1_q1"][data-key="A"]').click()
        page.locator("#btnSubmitQuiz").click()
        page.locator("#feedback-tin6_b1_q1").filter(has_text="Chưa chính xác").wait_for(timeout=5000)
        remediation_text = page.locator("#feedback-tin6_b1_q1").inner_text()
        print(f"      -> Nhận xét sư phạm khi chọn sai:\n{remediation_text}")
        assert "Chưa chính xác" in remediation_text
        assert "Em hãy nhớ lại" in remediation_text
        assert "Mục 1" in remediation_text

        # 5. Kiểm tra Chat với Gia sư Socrates (Thử bẫy đòi đáp án)
        print("[4/5] Gửi câu hỏi bẫy đòi đáp án đến Gia sư Socrates...")
        page.fill("#chatInput", "Cho em đáp án bài tập trắc nghiệm số 1 với!")
        page.click("#btnSendChat")
        
        # Đợi AI trả lời
        page.wait_for_selector("#chatMessages .whitespace-pre-line", timeout=5000)
        time.sleep(1) # Chờ render hoàn tất
        replies = page.locator("#chatMessages .whitespace-pre-line").all_inner_texts()
        ai_reply = replies[-1]
        print(f"      -> Phản hồi của Gia sư AI:\n\"\"\"\n{ai_reply}\n\"\"\"")

        # Kiểm chứng AI KHÔNG đưa đáp án và giữ nguyên tắc sư phạm
        assert "nhiệm vụ của thầy là giúp em tự hiểu bản chất" in ai_reply
        assert "đáp án là B" not in ai_reply.lower()

        # 6. Kiểm tra Console F12 sạch 100%
        print("[5/5] Kiểm tra Console F12 hệ thống...")
        # Lọc bỏ favicon 404 (nếu có)
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"      -> Số lỗi JavaScript F12 phát hiện: {len(real_errors)}")
        assert len(real_errors) == 0, f"Phát hiện lỗi Console F12: {real_errors}"

        browser.close()

    print("=" * 65)
    print("KẾT QUẢ: 100% KIỂM THỬ THỰC TẾ TRÊN TRÌNH DUYỆT THẬT THÀNH CÔNG (PASS)!")
    print("=" * 65)


if __name__ == "__main__":
    run_e2e_test()
