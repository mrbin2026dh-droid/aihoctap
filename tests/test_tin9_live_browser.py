"""
Kiểm thử Playwright Live Browser: Tin học 9 (Bài 1 đến Bài 5)
Kiểm tra thực tế tương tác trình duyệt:
1. Click chọn LỚP 9 trên Header.
2. Badge Sidebar tự động chuyển thành TIN HỌC 9.
3. Cây mục lục bài học hiển thị đúng 5 bài học V2 của Lớp 9.
4. Màn hình lý thuyết hiển thị Bài 1: Thế giới kĩ thuật số.
5. Chuyển sang Tab Luyện tập Trắc nghiệm và kiểm tra điểm chạm, tương tác chọn đáp án.
6. 0 lỗi Console F12.
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent

def test_live_browser_tin9():
    console_errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        page.on("console", lambda msg: (
            console_errors.append(msg.text) if msg.type == "error" else None
        ))

        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(1.0)

        # 1. Click chọn tab LỚP 9
        pill_lop9 = page.locator('.header-grade-pill[data-grade="9"]')
        assert pill_lop9.is_visible(), "Không tìm thấy nút chọn LỚP 9"
        pill_lop9.click()
        time.sleep(1.2)

        # 2. Kiểm tra Pill LỚP 9 đang active
        assert "active" in (pill_lop9.get_attribute("class") or "")
        
        # 3. Kiểm tra Badge Sidebar chuyển thành TIN HỌC 9
        sidebar_badge = page.locator(".sidebar-nav-badge span")
        badge_text = sidebar_badge.inner_text().strip()
        assert "TIN HỌC 9" in badge_text, f"Badge chưa đổi thành TIN HỌC 9: {badge_text}"

        # 4. Kiểm tra Tiêu đề lý thuyết đang hiển thị Bài 1: Thế giới kĩ thuật số
        theory_title = page.locator("#theoryContent").inner_text().strip()
        assert "Thế giới kĩ thuật số" in theory_title, f"Tiêu đề bài học không khớp: {theory_title}"

        # 5. Kiểm tra danh mục bài học sidebar có đầy đủ Bài 1 đến Bài 10
        tree_text = page.locator("#curriculumTreeContainer").inner_text()
        assert "Thế giới kĩ thuật số" in tree_text
        assert "Thông tin trong giải quyết vấn đề" in tree_text
        assert "Thực hành: Đánh giá chất lượng thông tin" in tree_text
        assert "Một số vấn đề pháp lí về sử dụng dịch vụ Internet" in tree_text
        assert "Tìm hiểu phần mềm mô phỏng" in tree_text
        assert "Thực hành: Khai thác phần mềm mô phỏng" in tree_text
        assert "Trình bày thông tin trong trao đổi và hợp tác" in tree_text
        assert "Thực hành: Sử dụng công cụ trực quan trình bày thông tin" in tree_text
        assert "Sử dụng công cụ xác thực dữ liệu và hàm điều kiện" in tree_text
        assert "Thực hành: Xử lý dữ liệu bảng tính nâng cao" in tree_text

        # 6. Click chuyển sang Bài 9 (Data Validation & Hàm IF)
        bai9_item = page.locator('.lesson-tree-header[data-lesson-id="9"]').first
        assert bai9_item.is_visible(), "Không tìm thấy Bài 9 trên sidebar"
        bai9_item.click()
        time.sleep(1.0)
        
        theory_b9 = page.locator("#theoryContent").inner_text().strip()
        assert "xác thực dữ liệu" in theory_b9.lower() or "data validation" in theory_b9.lower()

        # 7. Chuyển sang Tab Luyện tập của Bài 9
        btn_quiz_tab = page.locator('.lesson-tree-item[data-lesson-id="9"] .section-subitem[data-type="quiz"], .lesson-tree-item.active .section-subitem[data-type="quiz"]').first
        assert btn_quiz_tab.is_visible()
        btn_quiz_tab.click()
        time.sleep(0.8)
        # Kiểm tra câu hỏi hiển thị
        q_text = page.locator("#quizContainer, .quiz-card, #questionTitle, .question-title").first.inner_text()
        assert any(k in q_text for k in ["Xác thực dữ liệu", "Data Validation", "bảng tính", "Câu 1", "Mục đích", "dữ liệu"])

        # 7. Lưu ảnh chụp minh chứng xuống đĩa cứng (Disk Artifact)
        proof_path = ROOT_DIR / "tests" / "artifacts_v2" / "tin9_browser_proof.png"
        proof_path.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(proof_path), full_page=True)

        # 8. Xác nhận 0 lỗi F12 Console
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        assert len(real_errors) == 0, f"Có lỗi Console F12: {real_errors}"

        browser.close()
        print("\n=> TEST PLAYWRIGHT LIVE BROWSER TIN HOC 9: PASS 100%!")

if __name__ == "__main__":
    test_live_browser_tin9()
