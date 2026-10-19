"""
Kiểm thử E2E Playwright cho Luồng Quản trị Giáo viên (Teacher Studio):
1. Mở modal Quản trị Giáo viên từ Header
2. Thử PIN sai -> Báo lỗi
3. Nhập PIN đúng -> Mở khóa Teacher Studio
4. Kiểm tra dữ liệu JSON Blocks tải đầy đủ
5. Chuyển sang Tab 2 Ngân hàng Trắc nghiệm
6. Bấm Lưu thay đổi thành công
7. Cách ly hoàn toàn dữ liệu thật bằng CURRICULUM_DIR_OVERRIDE (C1) và đọc PORT từ môi trường (C2).
"""
import os
import sys
import time
import shutil
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def run_teacher_e2e():
    print("=" * 60)
    print("KIỂM THỬ PLAYWRIGHT E2E: QUẢN TRỊ VIÊN GIÁO VIÊN (TEACHER STUDIO)")
    print("=" * 60)

    # C1: Cách ly dữ liệu bằng CURRICULUM_DIR_OVERRIDE sang thư mục tạm
    real_curriculum = ROOT_DIR / "data" / "curriculum"
    temp_dir = Path(tempfile.mkdtemp(prefix="e2e_teacher_curriculum_"))
    temp_curriculum = temp_dir / "curriculum"
    shutil.copytree(real_curriculum, temp_curriculum)
    os.environ["CURRICULUM_DIR_OVERRIDE"] = str(temp_curriculum)

    port = int(os.getenv("PORT", 8001))

    try:
        # Đảm bảo server đang chạy
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.connect(('127.0.0.1', port))
            server_running = True
            s.close()
        except Exception:
            server_running = False

        if not server_running:
            import uvicorn
            import threading
            from backend.server import app
            server_thread = threading.Thread(
                target=lambda: uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning"),
                daemon=True
            )
            server_thread.start()
            time.sleep(2)

        console_errors = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1366, "height": 768})
            page = context.new_page()

            page.on("console", lambda msg: (
                console_errors.append(msg.text) if msg.type == "error" else None
            ))

            # 1. Truy cập trang chủ
            page.goto(f"http://127.0.0.1:{port}/")
            page.wait_for_selector("#btnOpenTeacher", timeout=8000)
            print("[1/5] Truy cập trang chủ 1366x768 thành công.")

            # 2. Mở Modal Quản trị Giáo viên
            page.click("#btnOpenTeacher")
            page.wait_for_selector("#teacherModal", state="visible")
            print("[2/5] Đã mở Modal Quản trị Giáo viên.")

            # 3. Thử nhập sai mã PIN
            page.fill("#teacherPinInput", "999999")
            page.click("#btnVerifyPin")
            time.sleep(0.5)
            auth_msg = page.locator("#teacherAuthMsg").inner_text()
            print(f"      -> Thử PIN sai (999999): '{auth_msg}'")
            assert ("không đúng" in auth_msg.lower() or "không chính xác" in auth_msg.lower() or "thất bại" in auth_msg.lower()), "Không báo lỗi khi nhập sai PIN!"
            console_errors = [err for err in console_errors if "401" not in err]

            # 4. Nhập đúng mã PIN giáo viên từ cấu hình môi trường
            from backend.server import TEACHER_PIN
            page.fill("#teacherPinInput", TEACHER_PIN)
            page.click("#btnVerifyPin")
            time.sleep(1.0)
            auth_msg_2 = page.locator("#teacherAuthMsg").inner_text()
            print(f"      -> AuthMsg sau khi nhập PIN đúng: '{auth_msg_2}'")
            page.wait_for_selector("#teacherEditorBox", state="visible", timeout=10000)
            print("[3/6] Xác thực PIN thành công! Hộp biên tập Teacher Studio hiển thị.")

            # 5. Kiểm tra form editor đã nạp nội dung bài học (Tab 1: Lý thuyết)
            lesson_title = page.locator("#editLessonTitle").input_value()
            hero_desc = page.locator("#editHeroDesc").input_value()
            goals_text = page.locator("#editGoalsText").input_value()
            assert len(lesson_title) > 5, "Tiêu đề bài học rỗng!"
            assert len(hero_desc) > 10, "Mô tả bài học rỗng!"
            assert len(goals_text) > 10, "Mục tiêu bài học rỗng!"
            print(f"[4/6] Đã nạp thành công dữ liệu bài học Tab 1: '{lesson_title}'.")

            # 6. Chuyển sang Tab 2: Ngân hàng Trắc nghiệm
            btn_quiz_tab = page.locator(".studio-tab-btn[data-tab='quiz']")
            btn_quiz_tab.click()
            page.wait_for_selector("#tabContentQuiz", state="visible")
            quiz_cards = page.locator(".quiz-editor-card")
            quiz_count = quiz_cards.count()
            print(f"[5/6] Đã chuyển sang Tab 2 (Ngân hàng Trắc nghiệm): Hiển thị {quiz_count} câu hỏi.")
            assert quiz_count >= 4, f"Số câu hỏi hiển thị ({quiz_count}) ít hơn 4 câu chuẩn SGK!"

            # 7. Bấm nút Lưu thay đổi và kiểm tra lưu thành công
            page.click("#btnSaveLesson")
            page.wait_for_selector("#teacherSaveStatus:has-text('thành công')", timeout=8000)
            status_text = page.locator("#teacherSaveStatus").inner_text()
            print(f"[6/6] Trạng thái sau khi bấm Lưu: '{status_text}'")
            assert "thành công" in status_text, "Lưu bài học thất bại!"

            # Lọc bỏ các mã phản hồi HTTP dự kiến (401 khi thử sai PIN, 403 khi bài học ở trạng thái draft)
            runtime_errors = [err for err in console_errors if "401" not in err and "403" not in err]
            assert len(runtime_errors) == 0, f"Có lỗi Console F12: {runtime_errors}"
            print("=" * 60)
            print("KẾT QUẢ: 100% PASS CHO LUỒNG BIÊN SOẠN & LƯU CỦA GIÁO VIÊN!")
            print("=" * 60)

    finally:
        # Dọn dẹp thư mục tạm để đảm bảo cách ly tuyệt đối (C1)
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        os.environ.pop("CURRICULUM_DIR_OVERRIDE", None)


if __name__ == "__main__":
    run_teacher_e2e()
