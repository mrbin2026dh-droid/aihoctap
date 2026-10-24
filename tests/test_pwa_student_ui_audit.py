"""Independent student-facing acceptance, synthetic data and isolated browser only."""
import json
import re
from pathlib import Path

from playwright.sync_api import expect

from tests.test_pwa_browser import (
    exercise, isolated_pwa_store, login, open_math_lesson, publish, pwa_browser,
    wait_for_saved_draft,
)


def test_empty_grade_explains_state_and_offers_available_grade(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    page.get_by_label('Khối lớp', exact=True).select_option('8')
    expect(page.locator('#catalog-view')).to_contain_text('Chưa có')
    expect(page.locator('#status')).not_to_contain_text('Chọn môn để bắt đầu học.')
    fallback = page.locator('#catalog-view').get_by_role('button', name=re.compile(r'(?:[Ll]ớp) (6|9)'))
    expect(fallback.first).to_be_visible()
    fallback.first.click()
    expect(page.locator('#catalog-view [data-lesson-id]').first).to_be_visible()
    assert errors == []


def test_search_and_exercise_tab_have_real_destinations(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    search = page.get_by_label('Tìm bài học', exact=True)
    search.fill('Phân số')
    expect(page.locator('#catalog-view [data-lesson-id="bai-1"]')).to_be_visible()
    search.fill('no-such-synthetic-lesson')
    expect(page.locator('#catalog-view')).to_contain_text(re.compile('Không tìm|Chưa tìm'))
    search.fill('')
    page.get_by_role('button', name='Bài tập', exact=True).click()
    expect(page.locator('#practice-view')).to_be_visible()
    entry = page.locator('#practice-view [data-lesson-id="bai-1"]').first
    expect(entry).to_be_visible()
    entry.click()
    expect(page.locator('#question-form')).to_be_visible()
    assert page.locator('button[data-tab="practice"]').get_attribute('aria-current') == 'page'
    assert errors == []


def test_authenticated_grade_remains_authoritative(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page, '600001')
    expect(page.locator('#grade')).to_have_value('6')
    expect(page.locator('#grade')).to_be_disabled()
    assert page.locator('#catalog-view [data-course-id="toan-9"]').count() == 0
    page.get_by_role('button', name='Bài tập', exact=True).click()
    expect(page.locator('#practice-view')).to_be_visible()
    assert page.locator('#practice-view [data-course-id="toan-9"]').count() == 0
    assert errors == []


def test_removing_download_keeps_account_draft(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('input[name="q1"][value="B"]').check()
    page.locator('textarea[name="q2"]').fill('Keep this synthetic draft after removing download.')
    wait_for_saved_draft(page)
    page.get_by_role('button', name='Tải bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Đã tải')
    page.get_by_role('button', name='Đã tải', exact=True).click()
    page.get_by_role('button', name=re.compile('Xóa bản tải')).first.click()
    expect(page.locator('#downloads')).to_contain_text('Chưa tải')
    assert page.evaluate("async () => (await (await import('./db.js')).all('packages')).length") == 0
    drafts = page.evaluate("async () => (await (await import('./db.js')).all('drafts')).filter(item => item.uid === 'std_123456').map(item => item.answers.q2)")
    assert 'Keep this synthetic draft after removing download.' in drafts
    assert errors == []


def test_acknowledged_result_and_retry_survive_reload(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    login(page)
    open_math_lesson(page)
    exercise(page)
    page.locator('input[name="q1"][value="B"]').check()
    page.locator('textarea[name="q2"]').fill('Synthetic completed explanation.')
    wait_for_saved_draft(page)
    page.get_by_role('button', name='Nộp bài', exact=True).click()
    expect(page.locator('#status')).to_contain_text('Đã nộp')
    expect(page.locator('#result')).to_contain_text('1/2')
    page.reload()
    expect(page.locator('#result')).to_contain_text('1/2')
    expect(page.locator('#result').get_by_role('button', name='Làm lại', exact=True)).to_be_visible()
    page.locator('#result').get_by_role('button', name='Làm lại', exact=True).click()
    expect(page.locator('textarea[name="q2"]')).to_have_value('')
    expect(page.locator('input[name="q1"][value="B"]')).not_to_be_checked()
    assert errors == []


def test_installation_help_is_available_without_native_prompt(pwa_browser):
    page, _, _, errors, _ = pwa_browser
    page.goto('/hoc/')
    expect(page.locator('#install')).to_be_visible()
    page.locator('#install').click()
    expect(page.locator('#install-help-dialog')).to_be_visible()
    expect(page.locator('#install-help-dialog')).to_contain_text(re.compile('Safari|Chrome|Edge'))
    page.keyboard.press('Escape')
    expect(page.locator('#install-help-dialog')).to_be_hidden()
    assert errors == []


def test_standalone_display_mode_ui_is_not_an_os_install_claim(pwa_browser):
    page, _, _, errors, _ = pwa_browser
    page.add_init_script("""
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const result = originalMatchMedia(query);
        if (query === '(display-mode: standalone)') Object.defineProperty(result,'matches',{value:true});
        return result;
      };
    """)
    page.goto('/hoc/')
    expect(page.locator('body')).to_contain_text(re.compile('Đang dùng ứng dụng|Đã cài|Ứng dụng độc lập'))
    assert errors == []


def test_manifest_and_browser_pwa_evidence_without_claiming_os_install(pwa_browser):
    page, context, _, errors, _ = pwa_browser
    page.goto('/hoc/')
    page.evaluate('navigator.serviceWorker.ready.then(() => true)')
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    client = context.new_cdp_session(page)
    manifest = client.send('Page.getAppManifest')
    installability = client.send('Page.getInstallabilityErrors')
    assert manifest['errors'] == []
    data = json.loads(manifest['data'])
    assert data['display'] == 'standalone'
    assert {'192x192', '512x512'} <= {icon['sizes'] for icon in data['icons']}
    observed = page.evaluate("({secureContext:isSecureContext, standalone:matchMedia('(display-mode: standalone)').matches, controlled:Boolean(navigator.serviceWorker.controller)})")
    assert observed['secureContext'] and observed['controlled']
    assert observed['standalone'] is False
    print('PWA_INSTALL_EVIDENCE ' + json.dumps({'manifest_url': manifest['url'], 'manifest_errors': manifest['errors'], 'installability': installability, 'observed': observed}))
    assert errors == []


def test_ui_layout_labels_performance_and_visual_artifacts(pwa_browser):
    page, _, teacher, errors, requests = pwa_browser
    publish(teacher)
    page.add_init_script("""
      window.uiAudit = {lcp:null, shifts:[], shiftSources:[], events:[]};
      new PerformanceObserver(list => {for(const e of list.getEntries()) window.uiAudit.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(list => {for(const e of list.getEntries()) if(!e.hadRecentInput) {window.uiAudit.shifts.push(e.value);window.uiAudit.shiftSources.push({value:e.value,sources:e.sources.map(s=>({node:s.node?.id||s.node?.className||s.node?.tagName,fromY:s.previousRect.y,toY:s.currentRect.y}))});}}).observe({type:'layout-shift',buffered:true});
      new PerformanceObserver(list => {for(const e of list.getEntries()) window.uiAudit.events.push(e.duration);}).observe({type:'event',buffered:true,durationThreshold:16});
    """)
    page.goto('/hoc/')
    expect(page.locator('#catalog-view [data-lesson-id]').first).to_be_visible()
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    initial = page.evaluate("({lcp:window.uiAudit.lcp,shifts:[...window.uiAudit.shifts],shiftSources:[...window.uiAudit.shiftSources],fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,ttfb:performance.getEntriesByType('navigation')[0].responseStart})")
    print('STUDENT_UI_INITIAL_LAYOUT ' + json.dumps(initial, ensure_ascii=False))
    assert sum(initial['shifts']) < 0.1, initial['shiftSources']
    artifact = Path('scratch/student-ui-audit')
    artifact.mkdir(parents=True, exist_ok=True)
    overflow = []
    for width, height in [(360,740),(390,844),(412,915),(768,1024),(1366,768),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        value = page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
        overflow.append(value)
        assert value['scrollWidth'] <= value['width']
        if width in (390,1366):
            page.screenshot(path=str(artifact / f'catalog-{width}.png'), full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button', name='Bài tập', exact=True).click()
    page.screenshot(path=str(artifact / 'practice-390.png'), full_page=True)
    page.get_by_role('button', name='Đã tải', exact=True).click()
    page.screenshot(path=str(artifact / 'downloads-empty-390.png'), full_page=True)
    page.get_by_role('button', name='Môn học', exact=True).click()
    page.locator('#catalog-view [data-lesson-id]').first.click()
    expect(page.locator('#lesson-content')).to_be_visible()
    page.screenshot(path=str(artifact / 'lesson-reading-390.png'), full_page=True)
    exercise(page)
    page.screenshot(path=str(artifact / 'lesson-exercise-390.png'), full_page=True)
    metrics = page.evaluate("""() => ({...window.uiAudit,
      missingLabels:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.getClientRects().length&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).length,
      unnamedButtons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.textContent.trim()&&!e.getAttribute('aria-label')).length,
      fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      ttfb:performance.getEntriesByType('navigation')[0].responseStart,
      transferBytes:performance.getEntriesByType('resource').reduce((sum,e)=>sum+e.transferSize,0)
    })""")
    assert metrics['missingLabels'] == metrics['unnamedButtons'] == 0
    assert not any('/api/chat' in url or 'generativelanguage' in url for url in requests)
    assert errors == []
    print('STUDENT_UI_AUDIT ' + json.dumps({'initial_load':initial,'whole_session_including_resizes':metrics,'overflow':overflow},ensure_ascii=False))


def test_mobile_meaningful_metadata_is_readable(pwa_browser):
    page, _, teacher, _, _ = pwa_browser
    publish(teacher)
    page.goto('/hoc/')
    expect(page.locator('#catalog-view [data-lesson-id]').first).to_be_visible()
    small = page.evaluate("""() => [...document.querySelectorAll('.meta,.connection,.hero-note small,.notice')]
      .filter(e=>e.getClientRects().length && parseFloat(getComputedStyle(e).fontSize)<12)
      .map(e=>({class:e.className,size:getComputedStyle(e).fontSize}))""")
    assert small == []


def test_delayed_catalog_keeps_first_paint_layout_stable(pwa_browser):
    page, _, teacher, errors, _ = pwa_browser
    publish(teacher)
    page.add_init_script("""
      window.delayedCatalogShifts=[];
      new PerformanceObserver(list=>{for(const entry of list.getEntries()) if(!entry.hadRecentInput) window.delayedCatalogShifts.push(entry.value);}).observe({type:'layout-shift',buffered:true});
    """)
    held = []
    page.route('**/api/pwa/catalog', lambda route: held.append(route))
    page.goto('/hoc/', wait_until='domcontentloaded')
    page.wait_for_function("performance.getEntriesByName('first-contentful-paint').length > 0")
    expect(page.locator('body')).to_have_class(re.compile('is-loading'))
    assert len(held) == 1
    response = held[0].fetch()
    held[0].fulfill(response=response)
    expect(page.locator('#catalog-view [data-lesson-id]').first).to_be_visible()
    expect(page.locator('body')).not_to_have_class(re.compile('is-loading'))
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    shifts = page.evaluate('window.delayedCatalogShifts')
    assert sum(shifts) < 0.1, shifts
    print('DELAYED_CATALOG_INITIAL_CLS ' + json.dumps(shifts))
    assert errors == []
