"""
Test E2E bằng Playwright: Kiểm thử Chuyên sâu Sửa Triệt để Lỗi 422 Unprocessable Content khi mở trên máy khác
Nguyên nhân gốc: grade bị gán chuỗi 'all' khi giáo viên đăng nhập hoặc khôi phục phiên,
dẫn đến fetch /api/v2/curriculum/lessons/all và /api/v2/lesson/all/1 bị 422,
static fallback /tinall/bai1.json bị 404, và AI Socrates /api/chat bị 422.
"""

import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"


def test_grade_all_fix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        network_errors = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("response", lambda resp: network_errors.append(f"{resp.status} {resp.url}") if resp.status in (404, 422, 500) else None)

        print("\n=======================================================")
        print("KIỂM THỬ E2E: SỬA LỖI 422 UNPROCESSABLE CONTENT & 404 TINALL")
        print("=======================================================")

        # Giả lập máy tính khác có lưu trữ phiên giáo viên với grade: "all"
        page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded")
        page.evaluate("""() => {
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem("ai_sgk_student_auth", JSON.stringify({
                isLoggedIn: true,
                role: "teacher",
                studentName: "Giáo viên Tin học",
                classCode: "Tất cả các khối",
                grade: "all" // Lỗi trước đây lưu "all"
            }));
        }""")

        # Tải lại trang (mô phỏng người dùng F5 hoặc mở máy tính khác)
        print("\n[BƯỚC 1] Khôi phục phiên với grade='all' cũ...")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(1000)

        # Kiểm tra state.grade và studentAuthState.grade đã được tự động chuẩn hóa về số nguyên hợp lệ (6-9)
        grade_info = page.evaluate("""() => {
            return {
                appStateGrade: state.grade,
                authGrade: studentAuthState.grade,
                isNumber: typeof state.grade === 'number'
            };
        }""")
        print(f"  -> Trạng thái Grade sau tự động chuẩn hóa: {grade_info}")
        assert grade_info["isNumber"] == True, f"state.grade không phải number: {grade_info}"
        assert grade_info["appStateGrade"] in (6, 9), f"state.grade không thuộc [6, 9]: {grade_info}"
        assert grade_info["authGrade"] in (6, 9), f"studentAuthState.grade không thuộc [6, 9]: {grade_info}"
        print("  ✔ [PASS] Hệ thống đã tự động làm sạch grade='all' thành số nguyên hợp lệ!")

        # Chuyển sang xem Lý thuyết SGK và kiểm tra bài học được nạp thành công
        print("\n[BƯỚC 2] Kiểm tra nạp danh mục bài học và nội dung SGK...")
        page.evaluate("() => { if (typeof switchView === 'function') switchView('theory'); }")
        page.wait_for_timeout(500)
        page.wait_for_selector("#theoryContent", timeout=5000)
        theory_text = page.locator("#theoryContent").text_content()
        assert len(theory_text.strip()) > 50, f"Nội dung lý thuyết bị rỗng: {theory_text}"
        print(f"  ✔ [PASS] Nội dung SGK hiển thị đầy đủ, không còn bị 404 tinall hay 422 lessons/all!")

        # Kiểm tra switchGrade với tham số bất hợp lệ "all"
        print("\n[BƯỚC 3] Thử gọi switchGrade('all') để kiểm tra cơ chế phòng vệ...")
        page.evaluate("""async () => {
            await switchGrade('all');
        }""")
        page.wait_for_timeout(500)
        grade_after_switch = page.evaluate("() => state.grade")
        assert isinstance(grade_after_switch, int) and 6 <= grade_after_switch <= 9, f"switchGrade('all') gán giá trị lỗi: {grade_after_switch}"
        print(f"  ✔ [PASS] switchGrade('all') được phòng vệ hoàn hảo, trả về: Khối {grade_after_switch}")

        # Kiểm tra AI Socrates chat
        print("\n[BƯỚC 4] Kiểm tra gửi tin nhắn AI Socrates...")
        chat_res = page.evaluate("""async () => {
            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        grade: state.grade,
                        lesson_id: 1,
                        message: 'Xin chào AI Socrates'
                    })
                });
                return { status: res.status, ok: res.ok };
            } catch (e) {
                return { status: 0, error: e.message };
            }
        }""")
        print(f"  -> Kết quả gọi AI Socrates: {chat_res}")
        assert chat_res["status"] == 200, f"AI Socrates bị lỗi: {chat_res}"
        print("  ✔ [PASS] AI Socrates phản hồi HTTP 200 thành công, không còn bị lỗi 422 Unprocessable Content!")

        # Kiểm tra danh sách network errors không có 422 hoặc 404 tinall
        print("\n[BƯỚC 5] Rà soát toàn bộ gói tin HTTP 404/422/500...")
        critical_errors = [e for e in network_errors if "all" in e or "tinall" in e or "chat" in e]
        assert len(critical_errors) == 0, f"Vẫn còn lỗi HTTP nghiêm trọng: {critical_errors}"
        print(f"  ✔ [PASS] 0 lỗi 422 Unprocessable Content, 0 lỗi 404 tinall!")

        browser.close()

        print("\n=======================================================")
        print("🎉 TẤT CẢ CÁC BÀI TEST PHÒNG VỆ 422 & 404 ĐÃ PASS 100%!")
        print("=======================================================\n")


if __name__ == "__main__":
    test_grade_all_fix()
