"""Independent real-browser PWA checks with synthetic local data only."""
import json

from playwright.sync_api import expect

from tests.test_pwa_browser import (
    exercise, isolated_pwa_store, login, publish, pwa_browser,
    wait_for_saved_draft,
)


def open_lesson(page):
    page.locator('[data-course-id="toan-9"]').first.click()
    page.locator('[data-lesson-id="bai-1"]').first.click()
    expect(page.locator('#lesson-title')).to_have_text('Phân số')


def logout(page):
    page.locator('#account').click()
    page.get_by_role('button', name='Đăng xuất', exact=True).click()
    expect(page.get_by_role('button', name='Đăng nhập', exact=True)).to_be_visible()


def fill_answers(page, text):
    exercise(page)
    page.locator('input[name="q1"][value="B"]').check()
    page.locator('textarea[name="q2"]').fill(text)
    wait_for_saved_draft(page)


def test_teacher_editor_publishes_loads_and_reads_results(pwa_browser, teacher_pin):
    page, _, teacher, errors, _ = pwa_browser
    editor = teacher.new_page()
    teacher_errors = []
    editor.on('pageerror', lambda error: teacher_errors.append(str(error)))
    editor.goto('/hoc/teacher.html')
    editor.get_by_label('Mã PIN giáo viên', exact=True).fill(teacher_pin)
    editor.get_by_role('button', name='Đăng nhập giáo viên', exact=True).click()
    expect(editor.locator('#editor')).to_be_visible()
    form = editor.locator('#publish-form')
    for name, value in {
        'subject_id': 'toan', 'subject_name': 'Toán học', 'lesson_id': 'bai-1',
        'title': 'Phân số', 'content_markdown': '# Nội dung phiên bản giáo viên\nĐọc và thực hành.',
    }.items():
        form.locator(f'[name="{name}"]').fill(value)
    editor.get_by_role('button', name='Thêm câu hỏi', exact=True).click()
    choice = editor.locator('#question-editors fieldset').nth(0)
    choice.locator('[name="question-id"]').fill('q1')
    choice.locator('[name="prompt"]').fill('Hai cộng ba bằng bao nhiêu?')
    choice.locator('[name="option-A"]').fill('Bốn')
    choice.locator('[name="option-B"]').fill('Năm')
    choice.locator('[name="correct_answer"]').select_option('B')
    editor.get_by_role('button', name='Thêm câu hỏi', exact=True).click()
    text = editor.locator('#question-editors fieldset').nth(1)
    text.locator('[name="question-id"]').fill('q2')
    text.locator('[name="prompt"]').fill('Giải thích cách đếm.')
    text.locator('[name="kind"]').select_option('text')
    editor.get_by_role('button', name='Xem trước nội dung', exact=True).click()
    expect(editor.locator('#preview')).to_contain_text('Đọc và thực hành.')
    editor.get_by_role('button', name='Xuất bản bài học', exact=True).click()
    expect(editor.locator('#status')).to_contain_text('Đã xuất bản')
    editor.get_by_role('button', name='Soạn bài mới', exact=True).click()
    expect(form.locator('[name="title"]')).to_have_value('')
    editor.locator('#published').select_option('toan-9/bai-1')
    editor.get_by_role('button', name='Mở bài đã chọn', exact=True).click()
    expect(form.locator('[name="title"]')).to_have_value('Phân số')
    expect(editor.locator('#question-editors fieldset')).to_have_count(2)
    expect(editor.locator('#question-editors [name="correct_answer"]').nth(0)).to_have_value('B')
    page.goto('/hoc/')
    login(page)
    open_lesson(page)
    fill_answers(page, 'Synthetic explanation from independent browser test.')
    page.get_by_role('button', name='Nộp bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Đã nộp')
    editor.get_by_role('button', name='Cập nhật kết quả', exact=True).click()
    expect(editor.locator('#teacher-results')).to_contain_text('Synthetic explanation')
    expect(editor.locator('#teacher-results')).to_contain_text('Cần xem tự luận')
    editor.get_by_role('button', name='Đăng xuất', exact=True).click()
    expect(editor.locator('#editor')).to_be_hidden()
    expect(editor.locator('#teacher-results')).to_be_empty()
    assert errors == teacher_errors == []


def test_drafts_stay_separate_across_account_switches(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page, '123456')
    open_lesson(page)
    fill_answers(page, 'Draft for synthetic account A.')
    logout(page)
    login(page, '112233')
    open_lesson(page)
    exercise(page)
    expect(page.locator('textarea[name="q2"]')).to_have_value('')
    fill_answers(page, 'Draft for synthetic account B.')
    logout(page)
    login(page, '123456')
    open_lesson(page)
    exercise(page)
    expect(page.locator('textarea[name="q2"]')).to_have_value('Draft for synthetic account A.')
    assert errors == []


def test_teacher_edit_preserves_valid_nonstandard_option_keys(pwa_browser, teacher_pin):
    _, _, teacher, _, _ = pwa_browser
    from tests.test_pwa_api import lesson_document
    document = lesson_document()
    document['lesson_id'] = 'bai-1'
    document['questions'] = document['questions'][:1]
    options = {'A': 'First', 'B': 'Second', 'C': 'Third', 'D': 'Fourth',
               'E': 'Fifth', 'F': 'Sixth', 'G': 'Seventh', 'option8': 'Eighth'}
    document['questions'][0]['options'] = options
    response = teacher.request.post('/api/pwa/teacher/publish', data=document)
    assert response.ok, response.text()
    editor = teacher.new_page()
    editor.goto('/hoc/teacher.html')
    editor.get_by_label('Mã PIN giáo viên', exact=True).fill(teacher_pin)
    editor.get_by_role('button', name='Đăng nhập giáo viên', exact=True).click()
    expect(editor.locator('#editor')).to_be_visible()
    expect(editor.locator('#published option[value="toan-9/bai-1"]')).to_have_count(1)
    editor.locator('#published').select_option('toan-9/bai-1')
    editor.get_by_role('button', name='Mở bài đã chọn', exact=True).click()
    expect(editor.locator('#publish-form [name="title"]')).to_have_value('Phân số')
    editor.locator('#publish-form [name="title"]').fill('Title-only correction')
    editor.get_by_role('button', name='Xuất bản bài học', exact=True).click()
    expect(editor.locator('#status')).to_contain_text('Đã xuất bản')
    saved = teacher.request.get('/api/pwa/teacher/lesson/toan-9/bai-1').json()
    assert saved['questions'][0]['options'] == options


def test_delayed_ack_does_not_cross_accounts(pwa_browser):
    page, student, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page, '123456')
    open_lesson(page)
    fill_answers(page, 'Queued explanation for account A only.')
    student.set_offline(True)
    page.get_by_role('button', name='Nộp bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Chờ')
    held = []
    page.route('**/api/pwa/attempts', lambda route: held.append(route))
    student.set_offline(False)
    with page.expect_request('**/api/pwa/attempts'):
        page.evaluate("window.dispatchEvent(new Event('online'))")
    logout(page)
    login(page, '112233')
    expect(page.locator('#status')).to_contain_text('Đã đăng nhập')
    assert len(held) == 1
    response = held[0].fetch()
    assert response.ok
    held[0].fulfill(response=response)
    page.wait_for_function("async () => (await (await import('./db.js')).all('outbox')).some(item => item.uid === 'std_123456' && item.ack)")
    assert 'Đã nộp' not in page.locator('#status').inner_text()
    page.get_by_role('button', name='Tiến độ', exact=True).click()
    expect(page.locator('#progress')).to_contain_text('Chưa có bài nộp')
    results = teacher.request.get('/api/pwa/teacher/results').json()['attempts']
    assert len(results) == 1
    assert results[0]['uid'] == 'std_123456'
    assert errors == []


def test_corrupt_package_does_not_replace_prior_download(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    open_lesson(page)
    page.get_by_role('button', name='Tải bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Đã tải')
    page.get_by_role('button', name='Về danh sách', exact=True).click()
    publish(teacher, body='Nội dung phiên bản hai.')
    with page.expect_response('**/api/pwa/catalog'):
        page.evaluate("window.dispatchEvent(new Event('focus'))")

    def corrupt(route):
        response = route.fetch()
        package = response.json()
        package['content_markdown'] = 'Corrupted bytes that do not match the version.'
        route.fulfill(response=response, json=package)

    page.route('**/api/pwa/lessons/**', corrupt)
    page.locator('[data-course-id="toan-9"]').first.click()
    page.locator('[data-lesson-id="bai-1"]').first.click()
    expect(page.locator('#status')).to_contain_text('chưa toàn vẹn')
    page.get_by_role('button', name='Đã tải', exact=True).click()
    page.locator('#downloads [data-lesson-id="bai-1"]').first.click()
    expect(page.locator('#lesson-content')).to_contain_text('Nội dung phiên bản một.')
    assert errors == []


def test_quota_failure_does_not_claim_successful_download(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    open_lesson(page)
    page.evaluate("""() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'packages') throw new DOMException('Bộ nhớ đầy (kiểm thử).', 'QuotaExceededError');
        return original.apply(this, args);
      };
    }""")
    page.get_by_role('button', name='Tải bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Bộ nhớ đầy')
    assert 'Đã tải' not in page.locator('#status').inner_text()
    assert page.evaluate("async () => (await (await import('./db.js')).all('packages')).length") == 0
    assert errors == []


def test_delayed_lesson_response_cannot_override_navigation(pwa_browser):
    page, _, teacher, _, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    held = []
    page.route('**/api/pwa/lessons/**', lambda route: held.append(route))
    page.locator('[data-course-id="toan-9"]').first.click()
    with page.expect_request('**/api/pwa/lessons/**'):
        page.locator('[data-lesson-id="bai-1"]').first.click()
    page.get_by_role('button', name='Tiến độ', exact=True).click()
    expect(page.locator('#progress-view')).to_be_visible()
    assert len(held) == 1
    response = held[0].fetch()
    held[0].fulfill(response=response)
    page.evaluate("async () => { await fetch('./manifest.webmanifest'); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }")
    expect(page.locator('#progress-view')).to_be_visible()
    expect(page.locator('#lesson-view')).to_be_hidden()


def test_local_performance_accessibility_and_student_cache(pwa_browser):
    page, _, teacher, errors, requests = pwa_browser
    publish(teacher)
    page.add_init_script("""
      window.audit = {lcp: null, shifts: [], events: [], clickPaint: []};
      new PerformanceObserver(list => {for (const entry of list.getEntries()) window.audit.lcp = entry.startTime;}).observe({type:'largest-contentful-paint', buffered:true});
      new PerformanceObserver(list => {for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.audit.shifts.push(entry.value);}).observe({type:'layout-shift', buffered:true});
      new PerformanceObserver(list => {for (const entry of list.getEntries()) window.audit.events.push(entry.duration);}).observe({type:'event', buffered:true, durationThreshold:16});
      document.addEventListener('click', () => {const start = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => window.audit.clickPaint.push(performance.now() - start)));}, true);
    """)
    page.goto('/hoc/')
    expect(page.locator('#courses [data-course-id="toan-9"]')).to_be_visible()
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    open_lesson(page)
    exercise(page)
    measurements = page.evaluate("""() => ({
      lcp_ms: window.audit.lcp,
      observed_cls_sum: window.audit.shifts.reduce((sum,value) => sum + value, 0),
      observed_event_durations_ms: window.audit.events,
      click_to_two_frames_ms: window.audit.clickPaint,
      fcp_ms: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      ttfb_ms: performance.getEntriesByType('navigation')[0].responseStart,
      resource_bytes: performance.getEntriesByType('resource').reduce((sum,entry) => sum + entry.transferSize, 0),
      missing_labels: [...document.querySelectorAll('input,select,textarea')].filter(el => el.getClientRects().length && !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length,
      unnamed_buttons: [...document.querySelectorAll('button')].filter(el => el.getClientRects().length && !el.textContent.trim() && !el.getAttribute('aria-label')).length,
      stylesheet_count: document.styleSheets.length
    })""")
    assert measurements['missing_labels'] == measurements['unnamed_buttons'] == 0
    overflow = []
    for width, height in [(360, 740), (390, 844), (412, 915), (1366, 768), (1920, 1080)]:
        page.set_viewport_size({'width': width, 'height': height})
        result = page.evaluate('({width:innerWidth, scrollWidth:document.documentElement.scrollWidth})')
        overflow.append(result)
        assert result['scrollWidth'] <= result['width']
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement !== document.body')
    page.evaluate('navigator.serviceWorker.ready.then(() => true)')
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    cached = page.evaluate("async () => { const entries = []; for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) entries.push(new URL(request.url).pathname); return entries; }")
    assert cached
    assert all('/api/' not in path and 'teacher' not in path for path in cached)
    assert not any('/api/chat' in url or 'generativelanguage' in url for url in requests)
    assert errors == []
    print('PWA_AUDIT_METRICS ' + json.dumps({**measurements, 'overflow': overflow, 'cached_paths': cached}, ensure_ascii=False))
