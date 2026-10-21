import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_exam_toggle_lock_and_microcopy():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        dialog_messages = []
        page.on("dialog", lambda dialog: (dialog_messages.append(dialog.message), dialog.accept()))

        print("\n[BƯỚC 1] Tải trang chủ ứng dụng và kiểm tra Micro-Copy chuẩn EdTech...")
        page.goto(BASE_URL, wait_until="networkidle")

        # 1. Kiểm tra Micro-Copy trên màn hình Giáo viên
        page.evaluate("""() => {
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_9a';
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
        }""")
        page.wait_for_selector("#examTeacherView:not(.hidden)", timeout=8000)

        teacher_h1 = page.locator("#examTeacherView .exam-heading").text_content().strip()
        teacher_sub = page.locator("#examTeacherView .exam-subheading").text_content().strip()
        print(f"  + Tiêu đề Giáo viên: '{teacher_h1}'")
        print(f"  + Mô tả Giáo viên: '{teacher_sub}' ({len(teacher_sub.split())} từ)")
        assert "Quản lý bài kiểm tra" in teacher_h1, f"Tiêu đề GV phải là 'Quản lý bài kiểm tra', nhận: {teacher_h1}"
        assert len(teacher_sub.split()) <= 12, "Mô tả GV phải ngắn gọn súc tích <= 12 từ!"

        print("\n[BƯỚC 2] Kiểm tra Công tắc gạt (Toggle Switch) Mở/Khóa trên thẻ bài thi của GV...")
        page.wait_for_selector("#examTeacherGrid .exam-card-item", timeout=10000)
        
        toggle_wrap = page.locator("#examTeacherGrid .exam-switch-toggle").first
        toggle_input = page.locator("#examTeacherGrid .exam-switch-toggle input").first
        toggle_label = page.locator("#examTeacherGrid .exam-status-toggle-label").first
        assert toggle_wrap.is_visible(), "Công tắc gạt .exam-switch-toggle phải hiển thị trên thẻ bài thi của GV!"
        assert toggle_label.is_visible(), "Nhãn công tắc .exam-status-toggle-label phải hiển thị!"
        
        initial_checked = toggle_input.is_checked()
        print(f"  + Trạng thái công tắc ban đầu: {'BẬT (Mở)' if initial_checked else 'TẮT (Khóa)'}")
        print(f"  + Nhãn trạng thái: '{toggle_label.text_content().strip()}'")

        # Giáo viên gạt công tắc để KHÓA đề thi
        print("\n[BƯỚC 3] Giáo viên gạt công tắc để KHÓA bài kiểm tra...")
        if initial_checked:
            # Gạt tắt
            page.locator("#examTeacherGrid .exam-switch-toggle").first.click()
            time.sleep(0.5)
            assert not toggle_input.is_checked(), "Công tắc phải chuyển sang trạng thái TẮT (Khóa)!"
            print(f"  + Nhãn sau khi khóa: '{toggle_label.text_content().strip()}'")
            assert "khóa" in toggle_label.text_content().lower(), "Nhãn phải hiển thị trạng thái khóa!"

        # 2. Đăng nhập với tư cách Học sinh để kiểm tra đề bị khóa
        print("\n[BƯỚC 4] Chuyển sang Học sinh kiểm tra hiển thị đề thi bị Khóa...")
        page.evaluate("""() => {
            state.teacherUnlocked = false;
            state.teacherToken = '';
            studentAuthState.isLoggedIn = true;
            studentAuthState.uid = 'xXIgILG2iOMXEoH0lZ6rf38DYnF2';
            studentAuthState.studentName = 'Mr KhangKhoi';
            studentAuthState.studentCode = 'MRHATRONGKHOI.DH';
            studentAuthState.classCode = '9A';
            studentAuthState.grade = 9;
            openExamHub();
        }""")
        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=8000)
        page.wait_for_selector("#examStudentGrid .exam-card-item", timeout=10000)

        # Kiểm tra Micro-Copy trên màn hình Học sinh
        student_h1 = page.locator("#examStudentView .exam-heading").text_content().strip()
        student_sub = page.locator("#examStudentView .exam-subheading").text_content().strip()
        print(f"  + Tiêu đề Học sinh: '{student_h1}'")
        print(f"  + Mô tả Học sinh: '{student_sub}' ({len(student_sub.split())} từ)")
        assert "Bài kiểm tra của em" in student_h1
        assert len(student_sub.split()) <= 12, "Mô tả HS phải ngắn gọn súc tích <= 12 từ!"

        # Kiểm tra thẻ bài thi hiển thị rõ ràng cho học sinh biết đề đang bị khóa
        locked_badge = page.locator("#examStudentGrid .exam-status-pill.closed, #examStudentGrid span:has-text('khóa')").first
        print(f"  + Huy hiệu trạng thái trên thẻ học sinh: '{locked_badge.text_content().strip()}'")
        assert "khóa" in locked_badge.text_content().lower(), "Thẻ học sinh phải có huy hiệu thông báo đề đang bị khóa!"

        # Thử gọi làm bài khi đề bị khóa -> phải bị chặn an toàn
        print("\n[BƯỚC 5] Thử làm bài khi đề đang khóa -> Chặn an toàn với thông báo...")
        page.evaluate("""async () => {
            const card = document.querySelector("#examStudentGrid .exam-card-item");
            const btn = card ? card.querySelector(".btn-exam-disabled") : null;
            if (btn && btn.onclick) {
                btn.onclick();
            } else {
                await window.startStudentExam("exam_tin9_15p_b1_b2");
            }
        }""")
        time.sleep(0.5)
        print("  + Thông báo chặn học sinh:", dialog_messages)
        assert any("khóa" in msg.lower() for msg in dialog_messages), "Phải có thông báo popup cho học sinh biết đề đang bị khóa!"

        # 3. Giáo viên MỞ lại đề thi
        print("\n[BƯỚC 6] Giáo viên MỞ lại đề thi...")
        page.evaluate("""() => {
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_9a';
            openExamHub();
        }""")
        page.wait_for_selector("#examTeacherView:not(.hidden)", timeout=8000)
        page.wait_for_selector("#examTeacherGrid .exam-card-item", timeout=10000)

        # Gạt bật mở lại
        page.locator("#examTeacherGrid .exam-switch-toggle").first.click()
        time.sleep(0.5)
        assert toggle_input.is_checked(), "Công tắc phải chuyển về trạng thái BẬT (Mở)!"
        print(f"  + Nhãn sau khi mở lại: '{toggle_label.text_content().strip()}'")
        assert "mở" in toggle_label.text_content().lower(), "Nhãn phải hiển thị trạng thái đang mở!"

        # Chuyển về học sinh kiểm tra đề đã mở lại
        print("\n[BƯỚC 7] Học sinh kiểm tra đề đã mở lại bình thường...")
        page.evaluate("""() => {
            state.teacherUnlocked = false;
            state.teacherToken = '';
            openExamHub();
        }""")
        page.wait_for_selector("#examStudentView:not(.hidden)", timeout=8000)
        page.wait_for_selector("#examStudentGrid .exam-card-item", timeout=10000)

        open_badge = page.locator("#examStudentGrid .exam-status-pill.open, #examStudentGrid span:has-text('Đang mở')").first
        assert open_badge.is_visible(), "Huy hiệu Đang mở phải hiển thị trở lại khi giáo viên mở đề!"

        # Kiểm tra F12 Console Errors
        clean_errors = [e for e in console_errors if "favicon" not in e.lower() and "livereload" not in e.lower()]
        print(f"  + Tổng lỗi Console F12: {len(clean_errors)}")
        assert len(clean_errors) == 0, f"Phát hiện lỗi Console: {clean_errors}"

        print("\n✅ KIỂM THỬ CÔNG TẮC MỞ/KHÓA ĐỀ VÀ TIÊU CHUẨN MICRO-COPY ĐẠT PASS 100%!")
        browser.close()

if __name__ == "__main__":
    test_exam_toggle_lock_and_microcopy()
