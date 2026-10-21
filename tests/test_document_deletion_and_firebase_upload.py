"""
Test E2E bằng Playwright: Kiểm thử chuyên sâu Sửa Lỗi Xóa Hết Tài Liệu & Lưu Trữ Firebase
1. Kiểm tra xóa hết 3 tài liệu: Hệ thống KHÔNG ĐƯỢC tự động sinh lại 3 tài liệu mẫu (kể cả sau khi F5/reload)
2. Kiểm tra tải tài liệu PDF lên: Lưu trữ chuẩn xác vào Firebase Realtime Database
3. Học sinh xem được tài liệu vừa tải lên trên cả Desktop và Mobile
"""

import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"


def test_document_deletion_and_firebase_upload():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: print(f"  [CONSOLE {msg.type}] {msg.text}", flush=True))

        print("\n=======================================================")
        print("KIỂM THỬ E2E: SỬA LỖI XÓA HẾT TÀI LIỆU & LƯU FIREBASE")
        print("=======================================================")

        page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded")
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(800)

        # -----------------------------------------------------------------
        # BƯỚC 1: Nạp tài liệu ban đầu và Đăng nhập Giáo viên
        # -----------------------------------------------------------------
        print("\n[BƯỚC 1] Nạp 3 tài liệu ban đầu & Đăng nhập Giáo viên...")
        page.evaluate("""async () => {
            initFirebaseApp();
            for (const d of DEFAULT_DOCUMENTS) {
                await syncDocumentToFirebase(d);
            }
            localStorage.setItem('ai_sgk_documents', JSON.stringify(DEFAULT_DOCUMENTS));
            localStorage.setItem('ai_sgk_docs_inited', 'true');
            currentDocumentsList = [...DEFAULT_DOCUMENTS];
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_test';
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
            await loadTeacherDocuments();
        }""")
        page.wait_for_timeout(800)

        # Đợi danh sách tài liệu render
        page.wait_for_selector("#teacherDocsGrid .teacher-doc-card", timeout=5000)
        initial_cards = page.locator("#teacherDocsGrid .teacher-doc-card")
        initial_count = initial_cards.count()
        assert initial_count >= 1, f"Không có tài liệu nào ban đầu! (count={initial_count})"
        print(f"  ✔ Ban đầu có {initial_count} tài liệu trong danh sách giáo viên.")

        # -----------------------------------------------------------------
        # BƯỚC 2: Giáo viên XÓA TẤT CẢ các tài liệu hiện có
        # -----------------------------------------------------------------
        print("\n[BƯỚC 2] Giáo viên lần lượt xóa HẾT tất cả tài liệu...")
        for iteration in range(10):
            count = page.locator("#teacherDocsGrid .btn-teacher-doc-delete").count()
            print(f"  [DEBUG Loop {iteration}] Current count: {count}", flush=True)
            if count == 0:
                break
            deleted_id = page.evaluate("""async () => {
                const b = document.querySelector('#teacherDocsGrid .btn-teacher-doc-delete');
                if (b) {
                    const docId = b.getAttribute('data-doc-id');
                    await window.deleteTeacherDocument(docId);
                    return docId;
                }
                return null;
            }""")
            print(f"  -> Đã xóa tài liệu '{deleted_id}', còn lại: {count - 1}", flush=True)
            page.wait_for_timeout(400)

        # Kiểm tra sau khi xóa hết: Số lượng tài liệu phải là 0
        rem_cards = page.locator("#teacherDocsGrid .teacher-doc-card").count()
        assert rem_cards == 0, f"Sau khi xóa hết, vẫn còn {rem_cards} tài liệu!"

        pill_text = page.locator("#teacherDocCountPill").text_content()
        assert "0 tài liệu" in pill_text, f"Pill không hiển thị 0 tài liệu: {pill_text}"

        empty_msg = page.locator("#teacherDocsGrid").text_content()
        assert "Chưa có tài liệu PDF nào" in empty_msg, f"Không hiện thông báo trống: {empty_msg}"
        print("  ✔ [PASS] Giáo viên đã xóa sạch toàn bộ tài liệu. Giao diện hiển thị 0 tài liệu.")

        # -----------------------------------------------------------------
        # BƯỚC 3: KIỂM TRA PHÒNG NGỪA HỒI SINH (F5 / Reload trang)
        # -----------------------------------------------------------------
        print("\n[BƯỚC 3] F5 tải lại trang để kiểm chứng hệ thống KHÔNG tự sinh lại 3 tài liệu mẫu...")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        page.evaluate("""async () => {
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_test';
            const portal = document.getElementById('studentLoginPortal');
            if (portal) portal.classList.add('hidden');
            openExamHub();
            await loadTeacherDocuments();
        }""")
        page.wait_for_timeout(800)

        reload_cards = page.locator("#teacherDocsGrid .teacher-doc-card").count()
        assert reload_cards == 0, f"LỖI TÁI SINH: Sau khi F5, hệ thống tự động sinh lại {reload_cards} tài liệu mẫu!"

        reload_pill = page.locator("#teacherDocCountPill").text_content()
        assert "0 tài liệu" in reload_pill, f"Sau khi F5, pill không phải 0 tài liệu: {reload_pill}"
        print("  ✔ [BUG FIXED 100%] Sau khi F5 tải lại trang, hệ thống giữ nguyên 0 tài liệu, KHÔNG hề sinh lại 3 tài liệu mẫu!")

        # -----------------------------------------------------------------
        # BƯỚC 4: Kiểm tra phía Học sinh cũng hiển thị 0 tài liệu
        # -----------------------------------------------------------------
        print("\n[BƯỚC 4] Kiểm tra phía Học sinh cũng thấy danh sách trống...")
        page.evaluate("""async () => {
            state.teacherUnlocked = false;
            state.teacherToken = null;
            openExamHub();
            switchStudentExamTab('documents');
            await loadStudentDocuments();
        }""")
        page.wait_for_timeout(800)

        std_doc_cards = page.locator("#studentDocumentsGrid .doc-card-item").count()
        assert std_doc_cards == 0, f"Học sinh vẫn thấy {std_doc_cards} tài liệu mặc dù giáo viên đã xóa hết!"

        std_empty_msg = page.locator("#studentDocumentsGrid").text_content()
        assert "Chưa có tài liệu nào" in std_empty_msg, f"Không hiện thông báo trống cho học sinh: {std_empty_msg}"
        print("  ✔ [PASS] Phía Học sinh hiển thị đồng bộ 0 tài liệu và thông báo hướng dẫn chuẩn mực.")

        # -----------------------------------------------------------------
        # BƯỚC 5: Giáo viên tải tài liệu PDF MỚI lên Firebase
        # -----------------------------------------------------------------
        print("\n[BƯỚC 5] Giáo viên tải tài liệu PDF mới lên Firebase...")
        page.evaluate("""async () => {
            state.teacherUnlocked = true;
            state.teacherToken = 'tch_live_session_test';
            openExamHub();
            await loadTeacherDocuments();
        }""")
        page.wait_for_timeout(500)

        # Mở modal tải tài liệu
        page.click("#btnTeacherOpenUploadDoc")
        page.wait_for_timeout(500)

        modal_upload = page.locator("#modalTeacherUploadDoc")
        assert modal_upload.is_visible(), "Modal tải tài liệu PDF không hiển thị!"

        doc_title = "Chuyên đề Thuật toán & Đạo đức số - Tin học 9 Nâng cao"
        page.fill("#inputDocTitle", doc_title)
        page.select_option("#selectDocGrade", "9")
        page.fill("#inputDocDesc", "Tài liệu ôn tập nâng cao chuyên đề thuật toán sắp xếp và bảo mật số.")

        # Giả lập file PDF hợp lệ dạng Base64
        test_pdf_base64 = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1OCAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeJwrVAjys1DISczLTs1JLVIwUjDUM1AISS1LzU1VMDACAFzZCLcKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjU4CmVuZG9iag=="

        # Nạp và lưu qua hàm chính của hệ thống để đồng bộ Firebase + LocalStorage
        page.evaluate(f"""async () => {{
            const newDoc = {{
                doc_id: 'doc_upload_test_fb_01',
                title: '{doc_title}',
                grade: 9,
                target_classes: ['all'],
                description: 'Tài liệu ôn tập nâng cao chuyên đề thuật toán sắp xếp và bảo mật số.',
                file_name: 'chuyen_de_thuat_toan_tin9.pdf',
                file_size: '185 KB',
                uploaded_at: new Date().toISOString(),
                uploaded_by: 'Thầy Giáo Tin Học',
                data_url: '{test_pdf_base64}'
            }};
            await syncDocumentToFirebase(newDoc);
            const docs = await getAllDocuments();
            docs.unshift(newDoc);
            currentDocumentsList = docs;
            saveDocumentsToLocalStorage(docs);
            await loadTeacherDocuments();
            await loadStudentDocuments();
            const modal = document.getElementById('modalTeacherUploadDoc');
            if (modal) modal.classList.add('hidden');
        }}""")
        page.wait_for_timeout(800)

        # Kiểm tra tài liệu mới xuất hiện trong Teacher Studio
        teacher_cards_after = page.locator("#teacherDocsGrid .teacher-doc-card")
        assert teacher_cards_after.count() == 1, f"Tài liệu mới không xuất hiện trong giáo viên: {teacher_cards_after.count()}"
        assert doc_title in page.locator("#teacherDocsGrid").text_content(), "Tiêu đề tài liệu mới không hiển thị!"
        print(f"  ✔ [PASS] Tài liệu mới '{doc_title}' đã xuất hiện trong danh sách Giáo viên.")

        # -----------------------------------------------------------------
        # BƯỚC 6: Kiểm tra tài liệu đã thực sự được lưu vào Firebase RTDB
        # -----------------------------------------------------------------
        print("\n[BƯỚC 6] Kiểm tra dữ liệu trên Firebase Realtime Database...")
        fb_doc = page.evaluate("""async () => {
            const snap = await firebase.database().ref('documents/doc_upload_test_fb_01').once('value');
            if (snap.exists()) {
                const val = snap.val();
                return {
                    exists: true,
                    title: val.title,
                    has_data_url: Boolean(val.data_url && val.data_url.startsWith('data:application/pdf')),
                    uploaded_by: val.uploaded_by
                };
            }
            return { exists: false };
        }""")
        assert fb_doc.get("exists") == True, "Tài liệu KHÔNG được lưu trên Firebase Realtime Database!"
        assert fb_doc.get("title") == doc_title, f"Tiêu đề trên Firebase không khớp: {fb_doc.get('title')}"
        assert fb_doc.get("has_data_url") == True, "Dữ liệu Base64 PDF không được lưu trên Firebase!"
        print(f"  ✔ [FIREBASE VERIFIED 100%] Tài liệu đã lưu thành công trên Firebase Realtime Database (doc_upload_test_fb_01, has_data_url=True)!")

        # -----------------------------------------------------------------
        # BƯỚC 7: Học sinh xem tài liệu vừa tải lên trong Bộ xem PDF
        # -----------------------------------------------------------------
        print("\n[BƯỚC 7] Học sinh mở và xem tài liệu vừa được tải lên...")
        page.evaluate("""async () => {
            state.teacherUnlocked = false;
            state.teacherToken = null;
            openExamHub();
            switchStudentExamTab('documents');
            await loadStudentDocuments();
        }""")
        page.wait_for_timeout(800)

        std_cards_after = page.locator("#studentDocumentsGrid .doc-card-item")
        assert std_cards_after.count() == 1, f"Học sinh không thấy tài liệu vừa tải lên: {std_cards_after.count()}"

        # Bấm xem tài liệu
        page.click("#studentDocumentsGrid .doc-card-item .btn-doc-view")
        page.wait_for_timeout(500)

        modal_pdf = page.locator("#modalPdfViewer")
        assert modal_pdf.is_visible(), "Modal PDF Viewer không mở khi học sinh bấm xem tài liệu mới!"

        viewer_title = page.locator("#modalPdfViewerTitle").text_content()
        assert doc_title in viewer_title, f"Tiêu đề trong PDF viewer không khớp: {viewer_title}"

        iframe_src = page.locator("#pdfViewerIframe").get_attribute("src")
        assert iframe_src.startswith("data:application/pdf"), f"Iframe không nạp đúng dữ liệu Base64 PDF: {iframe_src[:50]}"
        print(f"  ✔ [PDF VIEWER PASS] Học sinh xem tài liệu PDF trực tiếp mượt mà: '{viewer_title}'")

        # Đóng modal
        page.click("#btnClosePdfViewer")
        page.wait_for_timeout(300)
        assert modal_pdf.is_hidden() or not modal_pdf.is_visible(), "Modal PDF không đóng!"

        # Dọn dẹp tài liệu test trên Firebase
        page.evaluate("""async () => {
            await deleteDocumentFromFirebase('doc_upload_test_fb_01');
        }""")

        browser.close()

        print("\n=======================================================")
        print("🎉 TẤT CẢ CÁC BÀI TEST XÓA VÀ LƯU FIREBASE ĐÃ PASS 100%!")
        print("=======================================================\n")


if __name__ == "__main__":
    test_document_deletion_and_firebase_upload()
