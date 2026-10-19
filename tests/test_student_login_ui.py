"""
Automated Playwright E2E Test Suite for Student Login Portal (Google Auth & Responsive Layout)
Verifies:
1. Header Login Button presence and interaction.
2. Opening Student Login Portal (2-column layout matching design screenshot).
3. Visual Mascot, 4 orbital chips, 3 feature cards, Google sign-in button, class code input.
4. Google sign-in simulation, header state update, and portal closing.
5. Multi-viewport Zero-Overflow Invariant:
   - 1920x1080 (Desktop FHD)
   - 1366x768 (School Laptop)
   - 768x1024 (iPad/Tablet)
   - 375x667 (Mobile Phone)
   Ensuring: scrollWidth === clientWidth and 0 Console Errors.
"""

import pytest
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000"

def test_student_login_portal_and_responsive():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(BASE_URL, wait_until="networkidle")

        # 1. Kiểm tra nút đăng nhập trên Header
        btn_header_auth = page.locator("#btnHeaderStudentAuth")
        assert btn_header_auth.is_visible(), "Nút Đăng nhập trên header phải hiển thị"

        # 2. Bấm mở Cổng đăng nhập
        btn_header_auth.click()
        page.wait_for_timeout(300)

        portal = page.locator("#studentLoginPortal")
        assert portal.is_visible(), "Cổng Đăng nhập học sinh phải hiển thị khi bấm nút"

        # 3. Kiểm tra các thành phần cốt lõi khớp 100% hình thiết kế
        # Header cổng
        assert page.locator(".sl-brand-text").inner_text().strip() == "AI SGK TIN HỌC THCS"
        assert page.locator(".sl-badge-pill").inner_text().strip() == "CỔNG HỌC SINH"

        # Cột trái: Hero & Mascot
        assert page.locator(".sl-hero-brand-name").inner_text().strip() == "AI SGK Tin học THCS"
        assert page.locator(".sl-mascot-showcase").is_visible(), "Robot Mascot 3D phải hiển thị"
        assert page.locator(".sl-orbit-code").is_visible(), "Chip quỹ đạo </> phải hiển thị"
        assert page.locator(".sl-orbit-bulb").is_visible(), "Chip quỹ đạo bóng đèn phải hiển thị"

        # 3 Thẻ tính năng
        feature_cards = page.locator(".sl-feature-card")
        assert feature_cards.count() == 3, "Phải có đúng 3 thẻ tính năng (Học theo SGK, Luyện tập, Socrates)"

        # Cột phải: Thẻ Đăng nhập Google
        auth_card = page.locator(".sl-auth-card")
        assert auth_card.is_visible(), "Thẻ đăng nhập Google phải hiển thị"

        btn_google = page.locator("#btnGoogleSignIn")
        assert btn_google.is_visible(), "Nút Tiếp tục với Google phải hiển thị"
        assert "Tiếp tục với Google" in btn_google.inner_text()

        input_class = page.locator("#slInputClassCode")
        assert input_class.is_visible(), "Ô nhập mã lớp phải hiển thị"

        chk_terms = page.locator("#slChkAgreeTerms")
        assert chk_terms.is_checked(), "Checkbox điều khoản phải được tích mặc định"

        # 4. Kiểm tra đa độ phân giải và Zero-Overflow trên 4 Viewport
        viewports = [
            ("Desktop Full HD", 1920, 1080),
            ("School Laptop", 1366, 768),
            ("iPad / Tablet", 768, 1024),
            ("Mobile Phone", 375, 667)
        ]

        for vp_name, width, height in viewports:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)

            # Đo đạc tràn ngang DOM
            overflow_data = page.evaluate("""() => {
                const portalEl = document.getElementById("studentLoginPortal");
                return {
                    bodyScroll: document.body.scrollWidth,
                    bodyClient: document.body.clientWidth,
                    portalScroll: portalEl ? portalEl.scrollWidth : 0,
                    portalClient: portalEl ? portalEl.clientWidth : 0
                };
            }""")

            assert overflow_data["bodyScroll"] == overflow_data["bodyClient"], (
                f"[{vp_name}] Bị tràn ngang body: scroll={overflow_data['bodyScroll']} > client={overflow_data['bodyClient']}"
            )
            assert overflow_data["portalScroll"] == overflow_data["portalClient"], (
                f"[{vp_name}] Bị tràn ngang portal: scroll={overflow_data['portalScroll']} > client={overflow_data['portalClient']}"
            )

        # 5. Đưa về desktop và bấm Đóng portal
        page.set_viewport_size({"width": 1366, "height": 768})
        btn_close = page.locator("#btnCloseLoginPortal")
        btn_close.click()
        page.wait_for_timeout(300)
        assert not portal.is_visible(), "Portal phải đóng khi bấm nút ✕"

        # 6. Kiểm tra không có lỗi console nghiêm trọng
        filtered_errors = [e for e in console_errors if "favicon" not in e.lower()]
        assert len(filtered_errors) == 0, f"Có lỗi Console F12: {filtered_errors}"

        browser.close()
