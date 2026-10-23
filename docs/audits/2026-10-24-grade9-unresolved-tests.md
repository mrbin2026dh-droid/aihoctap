# Tests ngoài phạm vi gia sư chưa đạt - 24/10/2026

Full run: 409 passed, 20 failed, 9 warnings, 400.16s.
Số toàn-suite đo trên workspace còn test_exam_api_integration.py sửa sẵn chưa commit; không phải kết quả checkout sạch. Gate AI riêng không dùng tệp đó.
Không xác nhận toàn dự án sẵn sàng phát hành. Không sửa PIN/đăng nhập/thi/dashboard trong tác vụ này.
Chi tiết lỗi và trace: scratch/tutor-release-suite.log (cục bộ).

Lỗi tập trung ở cổng đăng nhập chặn thao tác, selector cũ/trùng, xác thực thi và status not_started không khớp hợp đồng analytics.
Các luồng gia sư được kiểm tra riêng bằng server/browser cô lập.

- tests/test_default_view_h1.py::test_default_view_matches_h1
- tests/test_e2e_exam_system.py::test_full_exam_pipeline
- tests/test_e2e_real_exam_flow.py::test_playwright_real_exam_crud_and_student_flow
- tests/test_exam_toggle_lock_and_microcopy.py::test_exam_toggle_lock_and_microcopy
- tests/test_fix_teacher_home.py::test_teacher_home_navigation
- tests/test_h1_enhanced_design.py::test_enhanced_design_matches_reference
- tests/test_h1_h2_h3_auth_redesign.py::test_auth_redesign_h1_h2_h3
- tests/test_h1_h2_h3_new_features.py::test_h1_h2_h3_comprehensive
- tests/test_h1_to_h5_fixes.py::test_h1_forward_lock_and_h2_to_h5_features
- tests/test_live_exam_firebase_socrates.py::test_live_exam_socrates_firebase
- tests/test_login_portal_no_x_and_rbac.py::test_login_portal_no_x_and_rbac
- tests/test_prompt_suggestions_dynamic.py::test_dynamic_prompt_suggestions
- tests/test_security_ai_and_student_exam_e2e.py::test_server_side_lock_security
- tests/test_security_ai_and_student_exam_e2e.py::test_student_exam_taking_submission_and_responsive
- tests/test_student_analytics.py::test_api_get_students_overview
- tests/test_student_analytics.py::test_api_analyze_class_endpoint
- tests/test_student_dashboard_e2e.py::test_student_dashboard_e2e_playwright
- tests/test_student_login_ui.py::test_student_login_portal_and_responsive
- tests/test_tin9_live_browser.py::test_live_browser_tin9
- tests/test_ui_clean_layout.py::test_clean_layout_verification
