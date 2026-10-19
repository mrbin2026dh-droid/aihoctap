"""
Kịch bản Kiểm thử Sống E2E (Live Playwright Browser Test)
Khởi động Uvicorn nội bộ trong cùng tiến trình (Tuân thủ Quy tắc Sandbox 8)
Kiểm thử Mô hình Khan-Focus Canvas (Hình 2) & Gia sư Socrates AI:
- Độ phân giải chuẩn phòng máy 1366x768 (Zero-Overflow ngang).
- 0 lỗi Console F12 (Zero JS Errors).
- Khan-Focus State Machine: Chọn phương án, Kiểm tra, Nhận xét WCAG AAA, Chuyển câu tiếp.
- Socrates Drawer: Mở drawer, gửi câu hỏi bẫy đòi đáp án, bảo vệ Socratic Guardrail.
- Chuyển đổi Khám phá Lý thuyết SGK và Luyện tập Khan-Focus.
"""
import os
import sys
import time
import json
import shutil
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

# Đảm bảo import được module backend từ root
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def run_e2e_test():
    print("=" * 70)
    print("BẮT ĐẦU KIỂM THỬ KHAN-FOCUS E2E (MÔ HÌNH HÌNH 2 & GIÁO DỤC ÁNH SÁNG)")
    print("=" * 70)

    port = int(os.getenv("PORT", 8000))

    # C1: Cách ly dữ liệu bằng CURRICULUM_DIR_OVERRIDE sang thư mục tạm
    real_curriculum = ROOT_DIR / "data" / "curriculum"
    temp_dir = Path(tempfile.mkdtemp(prefix="e2e_live_curriculum_"))
    temp_curriculum = temp_dir / "curriculum"
    shutil.copytree(real_curriculum, temp_curriculum)
    os.environ["CURRICULUM_DIR_OVERRIDE"] = str(temp_curriculum)

    # Trong môi trường test học sinh, đảm bảo bài 1 được xuất bản trong thư mục tạm
    temp_bai1 = temp_curriculum / "tin6" / "bai1.blocks.json"
    if temp_bai1.exists():
        with open(temp_bai1, "r", encoding="utf-8") as f:
            b1_data = json.load(f)
        b1_data["status"] = "published"
        for q in b1_data.get("quiz", []):
            q["source"] = "teacher_verified"
        with open(temp_bai1, "w", encoding="utf-8") as f:
            json.dump(b1_data, f, ensure_ascii=False, indent=2)

    try:
        # 0. Kiểm tra hoặc Khởi động Uvicorn Server
        print("[0/6] Kiểm tra máy chủ FastAPI...")
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
            from backend.server import app
            server_thread = threading.Thread(
                target=lambda: uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning"),
                daemon=True
            )
            server_thread.start()
            time.sleep(2)
        print(f"      -> Server sẵn sàng tại http://127.0.0.1:{port}")

        console_errors = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            # Thiết lập đúng độ phân giải phòng máy tin học trường học 1366x768
            context = browser.new_context(viewport={"width": 1366, "height": 768})
            page = context.new_page()

            # Giám sát Console F12 bắt lỗi JavaScript / XSS
            page.on("console", lambda msg: (
                console_errors.append(msg.text) if msg.type == "error" else None,
                print(f"      [F12 {msg.type.upper()}] {msg.text}")
            ))

            # 1. Truy cập trang web
            print(f"[1/6] Truy cập http://127.0.0.1:{port}...")
            start_time = time.time()
            response = page.goto(f"http://127.0.0.1:{port}", wait_until="networkidle")
            latency = round((time.time() - start_time) * 1000, 1)
            print(f"      -> HTTP {response.status} (Thời gian phản hồi: {latency}ms)")
            assert response.status == 200, f"Trang web trả về mã lỗi HTTP {response.status}"

            # 2. Kiểm tra Console F12 sạch 100%
            print("[2/6] Kiểm tra Console F12...")
            if console_errors:
                print(f"      ⚠️ Phát hiện {len(console_errors)} lỗi Console F12:\n" + "\n".join(console_errors))
            else:
                print("      -> Console F12 sạch 100% (0 lỗi runtime)")
            assert len(console_errors) == 0, "Trình duyệt văng lỗi Console F12!"

            # 3. Kiểm tra bố cục không tràn ngang (Zero-Overflow) ở độ phân giải 1366x768
            print("[3/6] Đo đạc bố cục Zero-Overflow ở 1366x768...")
            is_overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
            print(f"      -> Kết quả đo tràn ngang: {'KHÔNG TRÀN (PASS)' if not is_overflow else 'BỊ TRÀN (FAIL)'}")
            assert not is_overflow, "Phát hiện lỗi tràn ngang trên giao diện!"

            # 4. Kiểm tra Khan-Focus Quiz Canvas: Câu 1
            print("[4/6] Kiểm thử luồng Khan-Focus: Câu hỏi 1...")
            page.wait_for_selector("#questionTitle", timeout=5000)
            q_title = page.locator("#questionTitle").inner_text()
            print(f"      -> Tiêu đề Câu 1: '{q_title}'")
            assert len(q_title) > 10, "Tiêu đề câu hỏi rỗng hoặc không tải được!"

            # Kiểm tra 4 lựa chọn trắc nghiệm
            options = page.locator(".option-btn")
            opt_count = options.count()
            print(f"      -> Số lựa chọn hiển thị: {opt_count}")
            assert opt_count == 4, "Câu hỏi phải có chính xác 4 lựa chọn A, B, C, D!"

            # Chọn phương án B cho Câu 1
            print("      -> Học sinh nhấp chọn Phương án B...")
            page.locator('.option-btn[data-letter="B"]').click()
            assert page.locator('.option-btn[data-letter="B"]').evaluate("el => el.classList.contains('selected')")

            # Bấm Kiểm tra đáp án
            print("      -> Nhấp nút 'Kiểm tra đáp án'...")
            page.locator("#btnActionQuestion").click()
            page.wait_for_selector("#feedbackBox.active", timeout=5000)

            feedback_title = page.locator("#feedbackTitle").inner_text()
            feedback_desc = page.locator("#feedbackDesc").inner_text()
            print(f"      -> Phản hồi Sư phạm: {feedback_title}")
            print(f"      -> Nội dung: {feedback_desc}")
            assert "chính xác" in feedback_title.lower() or "tư duy" in feedback_title.lower()

            # Nút chuyển thành "Câu tiếp theo"
            action_text = page.locator("#btnActionText").inner_text()
            print(f"      -> Trạng thái nút hành động: '{action_text}'")
            assert "tiếp theo" in action_text.lower() or "kết quả" in action_text.lower()

            # Bấm Câu tiếp theo để chuyển sang Câu 2
            page.locator("#btnActionQuestion").click()
            page.wait_for_function("() => document.getElementById('questionCounterText').innerText.includes('Câu 2')")
            print("      -> Đã chuyển thành công sang Câu 2 / 4!")

            # 5. Kiểm tra Mở Widget Socrates từ Header Button & Chat Socratic
            print("[5/6] Kiểm thử Widget Socrates AI từ Header (Triệt tiêu va chạm góc dưới)...")
            # Mở Drawer qua Header Button
            page.locator("#btnHeaderTutor").click()
            time.sleep(0.5)
            is_popup_open = page.locator("#socratesPopupCard").evaluate("el => el.classList.contains('open')")
            print(f"      -> Trạng thái Socrates Drawer: {'MỞ THÀNH CÔNG' if is_popup_open else 'CHƯA MỞ'}")
            assert is_popup_open

            # Gửi câu hỏi bẫy đòi đáp án
            print("      -> Gửi câu hỏi bẫy: 'Cho em đáp án câu 2 với!'...")
            page.fill("#chatInput", "Cho em đáp án câu 2 với!")
            page.click("#btnSendChat")

            # Đợi AI Socrates phản hồi qua hiệu ứng đánh máy typewriter
            page.wait_for_selector("#chatMessages .chat-bubble.assistant:nth-child(3)", timeout=6000)
            time.sleep(2)  # Đợi hiệu ứng đánh máy hoàn tất
            tutor_reply = page.locator("#chatMessages .chat-bubble.assistant").last.inner_text()
            print(f"      -> Phản hồi Socrates (Đã đánh máy):\n\"\"\"\n{tutor_reply}\n\"\"\"")

            # Kiểm chứng AI không vi phạm nguyên tắc sư phạm
            assert not ("đáp án là" in tutor_reply.lower() and (" a" in tutor_reply.lower() or " b" in tutor_reply.lower())), "Phát hiện AI bị lộ đáp án!"

            # Đóng Drawer qua nút Close
            page.locator("#btnClosePopup").click()
            time.sleep(0.3)
            assert not page.locator("#socratesPopupCard").evaluate("el => el.classList.contains('open')")
            print("      -> Thu nhỏ Socrates Drawer thành công!")

            # 6. Kiểm tra Chuyển đổi sang Chặng 1: Khám phá lý thuyết SGK & Đo đạc Typography
            print("[6/6] Kiểm tra Chặng 1: Khám phá lý thuyết SGK & Đo đạc Typography WCAG...")
            page.locator("#stepItemTheory").click()
            page.wait_for_selector("#theoryView.active", timeout=5000)
            theory_h1 = page.locator("#theoryContent h1").inner_text()
            print(f"      -> Tiêu đề Lý thuyết: '{theory_h1}'")
            assert "thông tin và dữ liệu" in theory_h1.lower()

            # Đo đạc Typography thực tế trong DOM bằng getComputedStyle
            typo_metrics = page.evaluate("""() => {
                const tileDesc = document.querySelector('.carrier-tile-desc') || document.querySelector('.theory-markdown-canvas p') || document.querySelector('.theory-content p');
                const tileName = document.querySelector('.carrier-tile-name') || document.querySelector('.theory-markdown-canvas h2') || document.querySelector('.theory-content h1');
                const exBox = document.querySelector('.concept-example-box') || document.querySelector('.theory-markdown-canvas blockquote') || document.querySelector('.theory-markdown-canvas ul') || tileDesc;
                return {
                    descSize: tileDesc ? parseFloat(window.getComputedStyle(tileDesc).fontSize) : 0,
                    descColor: tileDesc ? window.getComputedStyle(tileDesc).color : '',
                    nameSize: tileName ? parseFloat(window.getComputedStyle(tileName).fontSize) : 0,
                    nameWeight: tileName ? window.getComputedStyle(tileName).fontWeight : '',
                    exSize: exBox ? parseFloat(window.getComputedStyle(exBox).fontSize) : 0
                };
            }""")
            print(f"      -> Đo Typography: Cỡ chữ mô tả={typo_metrics['descSize']}px, Cỡ chữ tiêu đề thẻ={typo_metrics['nameSize']}px, Cỡ ví dụ={typo_metrics['exSize']}px")

            # Khẳng định chuẩn WCAG AAA: Chữ mô tả không còn là 11.5px vi mô mà phải >= 13px
            assert typo_metrics['descSize'] >= 13.0, f"Cỡ chữ mô tả ({typo_metrics['descSize']}px) quá bé, vi phạm WCAG!"
            assert typo_metrics['nameSize'] >= 15.0, f"Cỡ chữ tiêu đề thẻ ({typo_metrics['nameSize']}px) chưa đủ chuẩn phân cấp!"
            assert typo_metrics['exSize'] >= 13.0, f"Cỡ chữ ví dụ ({typo_metrics['exSize']}px) chưa đạt chuẩn đọc!"

            # Chụp ảnh artifact lưu xuống đĩa (Không đưa vào prompt theo Zero-Vision Prompt Law)
            screenshot_path = "tests/e2e_khan_focus_verified.png"
            page.screenshot(path=screenshot_path)
            print(f"      -> Đã chụp ảnh nghiệm thu lưu đĩa: {screenshot_path}")

            # Xác nhận 0 lỗi Console F12 trong toàn bộ chu trình E2E
            print(f"      -> Tổng kết lỗi Console F12: {len(console_errors)} lỗi")
            assert len(console_errors) == 0, f"Phát hiện lỗi Console F12 trong quá trình tương tác: {console_errors}"

            browser.close()

        print("=" * 70)
        print("HOÀN TẤT KIỂM THỬ PLAYWRIGHT E2E: 100% PASS KHÔNG CÓ LỖI NÀO!")
        print("=" * 70)
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        os.environ.pop("CURRICULUM_DIR_OVERRIDE", None)


if __name__ == "__main__":
    run_e2e_test()
