"""Disposable PDF upload and deletion persistence; Firebase writes are test-owned."""
from playwright.sync_api import expect
from tests.ui_release_helpers import teacher_login, student_login


def test_document_deletion_and_firebase_upload(ui_page, live_server, teacher_pin, tmp_path):
    import pymupdf
    page = ui_page
    teacher_login(page, teacher_pin)
    # Boundary stand-in records actual application calls, never connects to school cloud.
    page.evaluate("""() => {
      window.documentCloudCalls=[];
      window.firebase={apps:[{}],database:()=>({ref:path=>({
        set:async value=>documentCloudCalls.push({method:'set',path,value}),
        remove:async()=>documentCloudCalls.push({method:'remove',path}),
        once:async()=>({exists:()=>false,val:()=>null}), on(){}, off(){}
      })})};
      openExamHub();
    }""")
    page.locator('#btnTeacherOpenUploadDoc').click()
    page.locator('#inputDocTitle').fill('Synthetic uploaded PDF')
    pdf = tmp_path/'synthetic.pdf'
    document=pymupdf.open()
    document.new_page().insert_text((72,72),'Synthetic test document')
    document.save(str(pdf))
    document.close()
    page.locator('#inputDocFile').set_input_files(pdf)
    expect(page.locator('#docFileNameSelected')).to_contain_text('synthetic.pdf')
    page.locator('#btnSubmitUploadDoc').click()
    expect(page.locator('#teacherDocsGrid')).to_contain_text('Synthetic uploaded PDF')
    assert page.evaluate("documentCloudCalls.some(c=>c.method==='set' && c.path.startsWith('documents/') && c.value.title==='Synthetic uploaded PDF' && typeof c.value.data_url==='string' && c.value.data_url.startsWith('data:application/pdf;base64,'))")
    page.evaluate('clearAllTeacherDocuments()')
    expect(page.locator('#teacherDocsGrid .teacher-doc-card')).to_have_count(0)
    expect(page.locator('#teacherDocCountPill')).to_contain_text('0 tài liệu')
    assert page.evaluate("documentCloudCalls.some(c=>c.method==='remove' && c.path==='documents')")
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("window.appState && typeof openExamHub === 'function'")
    page.evaluate('openExamHub(); loadTeacherDocuments()')
    expect(page.locator('#teacherDocsGrid .teacher-doc-card')).to_have_count(0)
    assert page.evaluate("JSON.parse(localStorage.getItem('ai_sgk_documents')).length") == 0
    page.evaluate("sessionStorage.clear(); localStorage.removeItem('ai_sgk_student_auth')")
    page.reload(wait_until='domcontentloaded')
    student_login(page)
    page.evaluate("openExamHub(); switchStudentExamTab('documents'); loadStudentDocuments()")
    expect(page.locator('#studentDocumentsGrid .doc-card')).to_have_count(0)
    expect(page.locator('#studentDocumentsGrid')).to_contain_text('Chưa có tài liệu nào được giao')
    assert not page.page_errors
