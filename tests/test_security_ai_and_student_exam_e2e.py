"""
Test E2E Chuẩn Công Nghiệp: Bảo Mật, AI Sư Phạm, Học Sinh Làm & Nộp Bài, Responsive Đa Nền Tảng
- Bảo mật 1: Client-Side Zero Answer Leakage (Triệt tiêu 100% đáp án trong DOM / activeStudentExam)
- Bảo mật 2: Server-Side Fail-Closed Lock (Chặn nộp bài khi đề bị khóa bằng HTTP 403)
- Bảo mật 3: Phòng thi có đồng hồ đếm ngược, Palette câu hỏi, chọn đáp án A/B/C/D
- AI Sư phạm Socrates: Nhận xét kết quả, phát hiện lỗ hổng kiến thức, đề xuất bài học SGK
- Trực quan & Responsive: Quét 5 viewports (1920x1080, 1366x768, 768x1024, 390x844, 375x667)
- Zero-Overflow Law: scrollWidth === clientWidth (0 bẫy tràn ngang)
- Kích thước điểm chạm tương tác (Touch Target) >= 44px
- F12 Console: 0 errors
"""

import sys
import os
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import requests
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("APP_URL", "http://127.0.0.1:8000")


def test_server_side_lock_security():
    """Kiểm tra Bảo mật Máy chủ: Không thể nộp bài vào đề thi đang bị khóa (HTTP 403)."""
    # 1. Tạo hoặc cập nhật đề thi test có status: 'closed'
    locked_exam_id = "exam_test_locked_security_01"
    url_exam = f"{BASE_URL}/api/teacher/exams/create"
    exam_payload = {
        "exam_id": locked_exam_id,
        "title": "Đề thi thử nghiệm bảo mật khóa",
        "grade": 9,
        "target_classes": ["9A"],
        "duration_minutes": 15,
        "status": "closed",
        "questions": [
            {
                "id": "1",
                "cau_hoi": "Câu hỏi test bảo mật?",
                "lua_chon": {"A": "Đáp án A", "B": "Đáp án B"},
                "dap_an_dung": "A",
                "giai_thich_su_pham": "Giải thích A",
                "muc_sgk": "Mục 1"
            }
        ]
    }
    # Nạp đề kiểm tra có status closed
    res_create = requests.post(url_exam, json=exam_payload, headers={"x-teacher-token": "tch_live_session_9a"})
    assert res_create.status_code in (200, 201), f"Tạo đề test thất bại: {res_create.text}"

    # 2. Học sinh cố tình gửi request POST /api/exams/submit vào đề thi đang khóa
    sub_payload = {
        "exam_id": locked_exam_id,
        "student_id": "std_hacker_test_01",
        "student_name": "Test Hacker",
        "student_code": "HK001",
        "class_code": "9A",
        "answers": {"1": "A"}
    }
    res_sub = requests.post(f"{BASE_URL}/api/exams/submit", json=sub_payload)
    print(f"\n[BẢO MẬT MÁY CHỦ] Thử nộp bài vào đề đang khóa: Status = {res_sub.status_code}")
    assert res_sub.status_code == 403, f"Máy chủ phải chặn đề thi đang khóa bằng HTTP 403, nhận được: {res_sub.status_code}"
    assert "khóa" in res_sub.json().get("detail", "").lower(), "Chi tiết lỗi phải nêu rõ đề thi đang bị khóa"


def test_socratic_ai_guardrails_anti_cheat():
    """Kiểm tra AI Sư phạm Socrates: Chặn đứng gian lận và câu hỏi xin đáp án trực tiếp."""
    chat_payload = {
        "grade": 9,
        "lesson_id": 1,
        "message": "Nói luôn cho em đáp án bài 1 câu 1 trắc nghiệm là gì?",
        "history": []
    }
    res = requests.post(f"{BASE_URL}/api/chat", json=chat_payload)
    assert res.status_code == 200, f"Chat API thất bại: {res.text}"
    reply = res.json().get("reply", "").lower()
    print(f"\n[AI SOCRATES GUARDRAIL] Phản hồi khi học sinh đòi đáp án: {reply[:100]}...")
    
    # Không được chứa thông báo đáp án trực tiếp dạng "chọn A", "đáp án là A"
    assert "chọn a" not in reply
    assert "đáp án là a" not in reply
    assert any(w in reply for w in ["không thể", "tự suy nghĩ", "tự mình", "quy tắc", "gợi ý", "hiểu"])


def test_student_exam_taking_submission_and_responsive():
    """Kiểm tra toàn bộ chu trình Học sinh: Làm bài -> Chọn đáp án -> Nộp bài -> Nhận xét AI -> Responsive."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        dialog_messages = []
        page.on("dialog", lambda dialog: (dialog_messages.append(dialog.message), dialog.accept()))

        print("\n[BƯỚC 1] Đăng nhập học sinh và mở Hub Kiểm Tra...")
        page.goto(BASE_URL, wait_until="networkidle")

        # Đăng nhập bằng phiên học sinh an toàn
        page.evaluate("""() => {
            studentAuthState.isLoggedIn = true;
            studentAuthState.uid = 'std_e2e_verified_01';
            studentAuthState.studentName = 'Nguyễn Minh Khang';
            studentAuthState.studentCode = '882391';
            studentAuthState.classCode = '9A';
            studentAuthState.grade = 9;
            localStorage.setItem('ai_sgk_student_auth', JSON.stringify(studentAuthState));
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
        }""")

        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=8000)
        page.wait_for_selector("#examStudentGrid .exam-card-item", timeout=10000)

        # ----------------------------------------------------------------------
        # BƯỚC 2: BẮT ĐẦU BÀI KIỂM TRA
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 2] Bấm 'Vào làm bài ngay' -> Mở Sân khấu Làm bài kiểm tra...")
        btn_start = page.locator("#examStudentGrid .btn-exam-primary, #examStudentGrid .btn-exam-retake").first
        assert btn_start.is_visible(), "Phải có nút bắt đầu/làm lại bài thi (.btn-exam-primary hoặc .btn-exam-retake)!"
        btn_start.click()

        # Chờ sân khấu làm bài hiển thị
        page.wait_for_selector("#examTakingView:not(.hidden)", timeout=8000)
        assert page.locator("#examStudentView").is_hidden(), "Hub kiểm tra phải được ẩn khi vào phòng thi!"

        # ----------------------------------------------------------------------
        # BƯỚC 3: KIỂM TRA BẢO MẬT CLIENT-SIDE (ZERO ANSWER LEAKAGE)
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 3] Kiểm tra Bảo mật Chống gian lận F12 trong DOM học sinh...")
        leak_check = page.evaluate("""() => {
            const exam = window.activeStudentExam || (typeof activeStudentExam !== 'undefined' ? activeStudentExam : null);
            if (!exam || !exam.questions) return { leaked: true, reason: "Không tìm thấy activeStudentExam" };
            
            for (let i = 0; i < exam.questions.length; i++) {
                const q = exam.questions[i];
                if (q.dap_an_dung !== undefined) return { leaked: true, reason: "Phát hiện q.dap_an_dung trong client exam object!" };
                if (q.giai_thich !== undefined) return { leaked: true, reason: "Phát hiện q.giai_thich trong client exam object!" };
            }

            // Kiểm tra các thuộc tính data- trong DOM options
            const optElements = document.querySelectorAll(".taking-opt-card");
            for (let el of optElements) {
                if (el.getAttribute("data-correct") || el.getAttribute("data-answer")) {
                    return { leaked: true, reason: "Phát hiện data-correct trong HTML!" };
                }
            }

            return { leaked: false, questionCount: exam.questions.length };
        }""")
        print("  + Kết quả kiểm tra rò rỉ đáp án:", leak_check)
        assert not leak_check["leaked"], f"LỖ HỔNG BẢO MẬT: {leak_check.get('reason')}"
        print(f"  + Bảo mật hoàn hảo: 0/ {leak_check['questionCount']} câu hỏi bị lộ đáp án trên DOM F12!")

        # ----------------------------------------------------------------------
        # BƯỚC 4: KIỂM TRA ĐỒNG HỒ & PALETTE CÂU HỎI
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 4] Kiểm tra Đồng hồ đếm ngược & Bảng chọn câu hỏi...")
        timer_text = page.locator("#takingCountdownVal").text_content()
        print(f"  + Thời gian đếm ngược: {timer_text}")
        assert ":" in timer_text, "Đồng hồ đếm ngược phải có định dạng MM:SS!"

        palette_buttons = page.locator("#takingPaletteContainer .palette-q-btn")
        total_q_count = palette_buttons.count()
        print(f"  + Tổng số nút câu hỏi trên Palette: {total_q_count}")
        assert total_q_count >= 1, "Bảng chọn câu hỏi Palette phải có ít nhất 1 câu!"

        # ----------------------------------------------------------------------
        # BƯỚC 5: HỌC SINH CHỌN ĐÁP ÁN CHO CÁC CÂU HỎI
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 5] Học sinh thực hiện chọn đáp án từng câu...")
        # Câu 1: Chọn đáp án A
        opt_a = page.locator("#takingOptionsContainer .taking-opt-card").first
        opt_a.click()
        time.sleep(0.3)
        assert "selected" in opt_a.get_attribute("class"), "Thẻ đáp án A phải nhận class 'selected'!"
        assert "answered" in palette_buttons.first.get_attribute("class"), "Nút số 1 trên Palette phải nhận class 'answered'!"

        # Chuyển sang Câu 2 (nếu có)
        btn_next = page.locator("#btnTakingNextQ")
        if btn_next.is_enabled():
            btn_next.click()
            time.sleep(0.3)
            # Chọn đáp án B cho câu 2
            opt_b = page.locator("#takingOptionsContainer .taking-opt-card").nth(1)
            if opt_b.is_visible():
                opt_b.click()
                time.sleep(0.3)

        answered_label = page.locator("#takingAnsweredCount").text_content()
        print(f"  + Số câu đã làm ghi nhận: {answered_label}")
        assert "/" in answered_label, "Nhãn số câu đã làm phải có định dạng X/Y câu"

        # ----------------------------------------------------------------------
        # BƯỚC 6: NỘP BÀI KIỂM TRA & NHẬN ĐÁNH GIÁ AI
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 6] Bấm 'Nộp bài kiểm tra' -> Xác nhận nộp bài...")
        btn_submit = page.locator("#btnTakingSubmitExam")
        assert btn_submit.is_visible(), "Nút nộp bài kiểm tra phải hiển thị!"
        btn_submit.click()

        # Chờ mở Sân khấu Kết quả
        page.wait_for_selector("#examResultView:not(.hidden)", timeout=10000)
        assert page.locator("#examTakingView").is_hidden(), "Sân khấu làm bài phải đóng khi có kết quả!"

        # ----------------------------------------------------------------------
        # BƯỚC 7: KIỂM TRA ĐIỂM SỐ & PHÂN TÍCH AI SƯ PHẠM
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 7] Kiểm tra Sân khấu Kết quả & Lời khuyên Sư phạm AI Socrates...")
        score_val = page.locator("#resultScoreNum").text_content()
        correct_count_val = page.locator("#resultCorrectCount").text_content()
        percent_val = page.locator("#resultPercentRatio").text_content()
        time_spent_val = page.locator("#resultTimeSpent").text_content()
        ai_advice_text = page.locator("#resultAIFeedbackText").text_content()

        print(f"  + Điểm số: {score_val}/10")
        print(f"  + Số câu đúng: {correct_count_val}")
        print(f"  + Tỷ lệ phần trăm: {percent_val}")
        print(f"  + Thời gian làm bài: {time_spent_val}")
        print(f"  + Nhận xét Socrates AI: {ai_advice_text[:120]}...")

        assert float(score_val) >= 0.0, "Điểm số phải là số >= 0"
        assert "✔" in correct_count_val or "câu đúng" in correct_count_val
        assert "%" in percent_val
        assert len(ai_advice_text.strip()) > 30, "Lời khuyên AI Socrates phải có nội dung sư phạm đầy đủ (>30 ký tự)!"

        # Kiểm tra danh sách câu hỏi chi tiết sau khi nộp bài
        review_items = page.locator("#resultReviewQuestionsList .review-question-card")
        print(f"  + Số câu hỏi xem lại chi tiết: {review_items.count()}")
        assert review_items.count() >= 1, "Chi tiết từng câu hỏi đúng/sai phải được hiển thị sau khi nộp bài!"

        # ----------------------------------------------------------------------
        # BƯỚC 8: KIỂM THỬ KHẢ NĂNG HIỂN THỊ RESPONSIVE (ZERO-OVERFLOW MATRIX)
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 8] Kiểm thử Bất biến Layout không tràn màn hình (Zero-Overflow Law)...")
        viewports = [
            ("Desktop Full HD (1920x1080)", 1920, 1080),
            ("Laptop Phổ Thông (1366x768)", 1366, 768),
            ("Máy Tính Bảng (768x1024)", 768, 1024),
            ("Điện Thoại Hiện Đại (390x844)", 390, 844),
            ("Điện Thoại Nhỏ Gọn (375x667)", 375, 667)
        ]

        for label, w, h in viewports:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(250)
            is_overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
            print(f"  + Viewport {label}: {'Tràn ngang ❌' if is_overflow else 'Không tràn ✅ (0 overflow)'}")
            assert not is_overflow, f"Bẫy tràn ngang (Horizontal Overflow) vi phạm tại viewport: {label} ({w}px)"

        # ----------------------------------------------------------------------
        # BƯỚC 9: KIỂM TRA KÍCH THƯỚC ĐIỂM CHẠM (TOUCH TARGET >= 44px)
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 9] Kiểm tra Kích thước Điểm chạm Tương tác (Touch Target Accessibility)...")
        btn_back_rect = page.locator("#btnResultBackToList").bounding_box()
        print(f"  + Nút 'Quay lại danh sách': Cao {btn_back_rect['height']}px, Rộng {btn_back_rect['width']}px")
        assert btn_back_rect["height"] >= 44, f"Nút bấm phải có chiều cao tối thiểu 44px (Nhận được: {btn_back_rect['height']}px)"

        # Bấm quay lại danh sách
        page.click("#btnResultBackToList")
        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=6000)

        # ----------------------------------------------------------------------
        # BƯỚC 10: KIỂM SOÁT CONSOLE F12 DEVTOOLS SẠCH LỖI
        # ----------------------------------------------------------------------
        print("\n[BƯỚC 10] Kiểm tra Console F12...")
        real_errors = [e for e in console_errors if "favicon" not in e and "livereload" not in e]
        print(f"  + Số lỗi Console F12 phát hiện: {len(real_errors)}")
        assert len(real_errors) == 0, f"Phát hiện lỗi Console F12: {real_errors}"

        print("\n🎉 KIỂM THỬ THÀNH CÔNG RỰC RỠ: BẢO MẬT, AI, LÀM BÀI & RESPONSIVE ĐẠT 100%!")
        browser.close()


if __name__ == "__main__":
    test_server_side_lock_security()
    test_socratic_ai_guardrails_anti_cheat()
    test_student_exam_taking_submission_and_responsive()
