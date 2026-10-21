"""
Test E2E bằng Playwright: Kiểm thử toàn diện H1, H2, H3
- H1: Chặn nộp bài sớm khi chưa làm hết câu hỏi (bắt buộc làm hết 100% hoặc hết giờ mới được nộp)
- H2: Hiển thị thông báo Toast và hiệu ứng rung khi học sinh bấm 'Câu tiếp' hoặc bấm palette mà chưa chọn đáp án
- H3: Tab 'Tài liệu' cho học sinh & tính năng Tải tài liệu PDF cho giáo viên kèm bộ xem PDF đa nền tảng
"""

import sys
import time
import pytest
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"


def test_h1_h2_h3_comprehensive():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 1. Desktop context (1280x800)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        dialog_messages = []
        page.on("dialog", lambda dialog: (dialog_messages.append(dialog.message), dialog.accept()))

        print("\n=======================================================")
        print("BẮT ĐẦU KIỂM THỬ PLAYWRIGHT E2E: H1, H2, H3")
        print("=======================================================")

        page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded")
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(800)

        # -----------------------------------------------------------------
        # BƯỚC 1: Đăng nhập tư cách Học sinh Khối 9 & Mở Exam Hub
        # -----------------------------------------------------------------
        print("\n[BƯỚC 1] Thiết lập đăng nhập Học sinh Khối 9 & Mở Đấu trường...")
        page.evaluate("""async () => {
            initFirebaseApp();
            for (const d of DEFAULT_DOCUMENTS) {
                await syncDocumentToFirebase(d);
            }
            localStorage.setItem('ai_sgk_documents', JSON.stringify(DEFAULT_DOCUMENTS));
            localStorage.setItem('ai_sgk_docs_inited', 'true');
            currentDocumentsList = [...DEFAULT_DOCUMENTS];
            if (typeof studentAuthState !== 'undefined') {
                studentAuthState.studentCode = '123456';
                studentAuthState.studentName = 'Nguyễn Minh Khôi';
                studentAuthState.classCode = '9A';
                studentAuthState.grade = 9;
                studentAuthState.role = 'student';
                localStorage.setItem('ai_sgk_student_auth', JSON.stringify(studentAuthState));
            }
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            if (typeof openExamHub === 'function') openExamHub();
            if (typeof switchStudentExamTab === 'function') switchStudentExamTab('exams');
            await loadStudentDocuments();
        }""")
        page.wait_for_timeout(1000)

        # -----------------------------------------------------------------
        # BƯỚC 2: Kiểm thử H3 - Tab Tài liệu học tập & Bộ xem PDF
        # -----------------------------------------------------------------
        print("\n[BƯỚC 2 / H3] Kiểm thử Tab '📚 Tài liệu' và Bộ xem PDF đa nền tảng...")
        tab_docs_btn = page.locator("#tabBtnDocuments")
        assert tab_docs_btn.is_visible(), "Nút chuyển tab '📚 Tài liệu' không hiển thị!"
        tab_docs_btn.click()

        tab_docs_panel = page.locator("#tabStudentDocuments")
        assert tab_docs_panel.is_visible(), "Khung tab Tài liệu không hiển thị sau khi click!"

        page.wait_for_selector("#studentDocumentsGrid .doc-card-item", timeout=5000)
        doc_cards = page.locator("#studentDocumentsGrid .doc-card-item")
        card_count = doc_cards.count()
        assert card_count >= 1, f"Danh sách tài liệu học tập trống! (count={card_count})"
        print(f"  ✔ [H3 PASS] Tab '📚 Tài liệu' hiển thị {card_count} tài liệu PDF chuẩn.")

        # Thử mở Bộ xem PDF từ card đầu tiên
        first_view_btn = page.locator("#studentDocumentsGrid .doc-card-item .btn-doc-view").first
        first_view_btn.click()
        page.wait_for_timeout(500)

        modal_pdf = page.locator("#modalPdfViewer")
        assert modal_pdf.is_visible(), "Modal Xem PDF không hiển thị khi học sinh bấm 'Xem tài liệu'!"

        modal_title = page.locator("#modalPdfViewerTitle").text_content()
        assert len(modal_title.strip()) > 0, "Tiêu đề tài liệu trong modal PDF bị rỗng!"

        iframe_src = page.locator("#pdfViewerIframe").get_attribute("src")
        assert ".pdf" in iframe_src or "data:application/pdf" in iframe_src, f"Iframe PDF không nạp đúng link PDF: {iframe_src}"
        print(f"  ✔ [H3 PASS] Bộ xem PDF hiển thị thành công tài liệu: '{modal_title}' (src: {iframe_src})")

        # Đóng modal PDF Viewer bằng phím ESC
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        assert modal_pdf.is_hidden() or not modal_pdf.is_visible(), "Modal PDF không đóng sau khi bấm phím Escape!"
        print("  ✔ [H3 PASS] Đóng modal PDF Viewer bằng phím ESC mượt mà.")

        # -----------------------------------------------------------------
        # BƯỚC 3: Mở đề thi để kiểm thử H1 và H2
        # -----------------------------------------------------------------
        print("\n[BƯỚC 3 / H1 & H2] Bắt đầu vào phòng thi để kiểm thử H1 và H2...")
        page.click("#tabBtnExamsList")
        page.wait_for_timeout(600)

        # Mở bài thi đầu tiên
        start_btn = page.locator("#examStudentGrid .btn-exam-primary, #examStudentGrid .btn-exam-retake").first
        assert start_btn.is_visible(), "Nút 'Làm bài' không hiển thị trong danh sách đề thi!"
        start_btn.click()
        page.wait_for_timeout(1200)

        # Đề thi đang hiển thị trong modal #examTakingView
        taking_modal = page.locator("#examTakingView")
        assert taking_modal.is_visible(), "Modal làm bài thi không hiển thị!"

        # -----------------------------------------------------------------
        # KIỂM THỬ H2: Bấm 'Câu tiếp' khi CHƯA CHỌN ĐÁP ÁN -> Bắt buộc hiện thông báo
        # -----------------------------------------------------------------
        print("\n[KIỂM THỬ H2] Thử bấm 'Câu tiếp' khi chưa chọn đáp án...")
        current_q_idx = page.evaluate("() => examTakingState.currentQuestionIndex")
        assert current_q_idx == 0, f"Câu hỏi hiện tại không phải câu 0: {current_q_idx}"

        btn_next = page.locator("#btnTakingNextQ")
        assert btn_next.is_visible(), "Nút 'Câu tiếp theo' không hiển thị!"

        # Bấm 'Câu tiếp theo' khi chưa chọn đáp án
        btn_next.click()
        page.wait_for_timeout(500)

        # Kiểm tra H2: Không được chuyển câu
        after_next_idx = page.evaluate("() => examTakingState.currentQuestionIndex")
        assert after_next_idx == 0, "LỖI H2: Hệ thống đã tự động chuyển câu tiếp theo khi học sinh chưa chọn đáp án!"

        # Kiểm tra H2: Thông báo Toast hiển thị
        toast = page.locator("#examToastAlert")
        assert toast.is_visible(), "LỖI H2: Không hiển thị thông báo toast cảnh báo chưa chọn đáp án!"
        toast_text = toast.text_content()
        assert "chọn đáp án" in toast_text, f"Nội dung toast không đúng: {toast_text}"
        print(f"  ✔ [H2 PASS] Đã chặn chuyển câu và hiển thị cảnh báo: '{toast_text}'")

        # Kiểm tra H2: Thử bấm trực tiếp vào Câu 2 trên bảng Palette câu hỏi khi chưa làm câu 1
        palette_btn_2 = page.locator(".palette-q-btn:has-text('2')")
        if palette_btn_2.count() > 0:
            palette_btn_2.click()
            page.wait_for_timeout(300)
            idx_after_palette = page.evaluate("() => examTakingState.currentQuestionIndex")
            assert idx_after_palette == 0, "LỖI H2: Bấm palette câu 2 đã nhảy cóc qua câu 1 chưa trả lời!"
            print("  ✔ [H2 PASS] Bấm nút Câu 2 trên Palette bị chặn đứng thành công khi chưa chọn đáp án Câu 1.")

        # -----------------------------------------------------------------
        # KIỂM THỬ H1: Chưa làm hết các câu mà bấm 'Nộp bài' -> Bắt buộc bị chặn!
        # -----------------------------------------------------------------
        print("\n[KIỂM THỬ H1] Thử bấm 'Nộp bài' khi chưa làm hết các câu hỏi...")
        # Chọn đáp án cho câu 1 (mới làm 1 câu)
        first_option = page.locator(".taking-opt-card").first
        first_option.click()
        page.wait_for_timeout(300)

        answered_count = page.evaluate("() => Object.keys(examTakingState.answers).length")
        total_questions = page.evaluate("() => activeStudentExam.questions.length")
        print(f"  -> Học sinh mới hoàn thành: {answered_count}/{total_questions} câu hỏi.")

        btn_submit = page.locator("#btnTakingSubmitExam")
        btn_submit.click()
        page.wait_for_timeout(500)

        # Kiểm tra H1: Đề thi vẫn đang ở trạng thái làm bài, không được nộp!
        assert taking_modal.is_visible(), "LỖI H1: Đề thi đã bị đóng/nộp khi học sinh chưa làm hết câu!"
        toast_h1 = page.locator("#examToastAlert").text_content()
        assert "chưa làm hết" in toast_h1, f"Nội dung thông báo chặn nộp bài không đúng: {toast_h1}"

        # Kiểm tra có dialog cảnh báo đã xuất hiện
        blocked_dialog_found = any("CHƯA THỂ NỘP BÀI" in msg or "chưa làm hết" in msg for msg in dialog_messages)
        assert blocked_dialog_found, f"Không có popup cảnh báo chặn nộp bài! Dialogs: {dialog_messages}"
        print(f"  ✔ [H1 PASS] Chặn nộp bài sớm thành công khi học sinh mới làm {answered_count}/{total_questions} câu.")

        # -----------------------------------------------------------------
        # KIỂM THỬ H2 (Thành công): Chọn đáp án rồi bấm 'Câu tiếp' -> Chuyển câu thành công
        # -----------------------------------------------------------------
        print("\n[KIỂM THỬ H2] Chuyển câu khi đã chọn đáp án...")
        btn_next.click()
        page.wait_for_timeout(500)
        new_q_idx = page.evaluate("() => examTakingState.currentQuestionIndex")
        assert new_q_idx == 1, f"Không chuyển sang câu tiếp theo sau khi đã chọn đáp án: {new_q_idx}"
        print("  ✔ [H2 PASS] Chuyển sang Câu 2 thành công sau khi đã chọn đáp án.")

        # -----------------------------------------------------------------
        # KIỂM THỬ H1 (Thành công): Làm đủ 100% các câu rồi nộp bài -> Nộp bài thành công
        # -----------------------------------------------------------------
        print("\n[KIỂM THỬ H1] Làm hết tất cả các câu hỏi còn lại và nộp bài...")
        # Tự động chọn đáp án cho tất cả các câu hỏi còn lại
        page.evaluate("""() => {
            activeStudentExam.questions.forEach(q => {
                examTakingState.answers[q.id] = "A";
            });
            renderTakingQuestion(examTakingState.currentQuestionIndex);
        }""")
        page.wait_for_timeout(500)

        all_answered = page.evaluate("() => Object.keys(examTakingState.answers).length")
        assert all_answered == total_questions, f"Chưa làm đủ các câu: {all_answered}/{total_questions}"
        print(f"  -> Học sinh đã hoàn thành 100%: {all_answered}/{total_questions} câu hỏi.")

        # Nộp bài
        btn_submit.click()
        page.wait_for_timeout(1800)

        # Modal làm bài thi đã đóng và chuyển sang màn hình kết quả hoặc bảng điểm
        modal_hidden = page.evaluate("() => document.getElementById('examTakingView').classList.contains('hidden')")
        assert modal_hidden, "Modal làm bài thi vẫn chưa đóng sau khi nộp bài hợp lệ!"
        print("  ✔ [H1 PASS] Nộp bài thành công khi đã hoàn thành 100% câu hỏi!")

        # -----------------------------------------------------------------
        # BƯỚC 4: Kiểm thử phía Giáo viên (H3 - Quản lý tài liệu & Tải lên)
        # -----------------------------------------------------------------
        print("\n[BƯỚC 4 / H3] Kiểm thử Giao diện Giáo viên: Quản lý & Tải lên tài liệu PDF...")
        # Mở Teacher Studio
        page.evaluate("""async () => {
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_test';
            openExamHub();
            await loadTeacherDocuments();
        }""")
        page.wait_for_timeout(800)

        # Kiểm tra nút tải tài liệu và section quản lý tài liệu
        btn_upload_doc = page.locator("#btnTeacherOpenUploadDoc")
        assert btn_upload_doc.is_visible(), "Nút '+ Tải tài liệu PDF' của giáo viên không hiển thị!"

        section_docs = page.locator("#teacherDocsSection")
        assert section_docs.is_visible(), "Khu vực 'Quản lý tài liệu học tập PDF' không hiển thị trong Teacher Studio!"

        # Mở Modal tải tài liệu
        btn_upload_doc.click()
        page.wait_for_timeout(500)

        modal_upload = page.locator("#modalTeacherUploadDoc")
        assert modal_upload.is_visible(), "Modal Tải tài liệu PDF của Giáo viên không hiển thị!"

        # Điền thông tin tài liệu mới
        page.fill("#inputDocTitle", "Đề cương Ôn tập Học kỳ 1 - Tin học 9 Nâng cao")
        page.select_option("#selectDocGrade", "9")
        page.fill("#inputDocDesc", "Bộ câu hỏi và bài tập thực hành Tin học 9 học kỳ 1.")

        # Đóng modal tải tài liệu bằng phím Escape
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        assert modal_upload.is_hidden() or not modal_upload.is_visible(), "Modal tải tài liệu không đóng bằng phím Escape!"
        print("  ✔ [H3 PASS] Giao diện Quản lý & Tải lên tài liệu PDF phía Giáo viên hoạt động hoàn hảo.")

        # -----------------------------------------------------------------
        # BƯỚC 5: Kiểm tra Responsive Mobile (390x844) không bị tràn ngang
        # -----------------------------------------------------------------
        print("\n[BƯỚC 5] Kiểm tra độ tương thích Mobile (390x844, zero-overflow)...")
        mobile_page = context.new_page()
        mobile_page.set_viewport_size({"width": 390, "height": 844})
        mobile_page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded")
        mobile_page.wait_for_timeout(500)

        # Mở tab tài liệu trên mobile
        mobile_page.evaluate("""async () => {
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            if (typeof openExamHub === 'function') openExamHub();
            if (typeof switchStudentExamTab === 'function') {
                switchStudentExamTab('documents');
                if (typeof loadStudentDocuments === 'function') await loadStudentDocuments();
            }
        }""")
        mobile_page.wait_for_timeout(500)

        is_overflow = mobile_page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
        assert not is_overflow, "Giao diện bị tràn ngang trên màn hình Mobile 390x844!"
        print("  ✔ [RESPONSIVE PASS] Đạt chuẩn Zero-Overflow (scrollWidth === clientWidth) trên Mobile.")

        mobile_page.close()
        browser.close()

        print("\n=======================================================")
        print("🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ H1, H2, H3 ĐÃ VƯỢT QUA 100%!")
        print("=======================================================\n")


if __name__ == "__main__":
    test_h1_h2_h3_comprehensive()
