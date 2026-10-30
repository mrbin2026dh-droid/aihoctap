// @ts-check
import {api, ApiError, API_BASE} from './api.js';
import './netbar.js';
import * as db from './db.js';
import * as ui from './teacher-ui.js?v=20261030c';
import {renderEditor, validateQuestions, toPayload, totalPoints} from './exam-editor.js';
import {parseExamRows, templateRows} from './exam-import.js';
import './teacher-thi.js?v=20261030c';
import './teacher-accounts.js?v=20261030c';
import './teacher-read.js?v=20261030c';
import './teacher-docs.js?v=20261030c';
import './teacher-effect.js?v=20261030c';
import './teacher-quiz.js?v=20261030c';
import './teacher-tl.js?v=20261030c';
import './teacher-thidua.js?v=20261030c';
import * as thiStore from './thi-store.js';
import {parseStudentRows, templateRows as studentTemplateRows} from './student-import.js';
import {el, button, renderMarkdown, dialogBox, confirmBox, noticeBox, withBusy, setFieldError, mapErrorMessage} from './dom.js';
/** @typedef {import('./contracts').PublishLesson} PublishLesson */
/** @typedef {import('./contracts').PrivateQuestion} PrivateQuestion */
/** @param {string} id */
function node(id) {const result = document.getElementById(id); if (!result) throw new Error(`Thiếu ${id}`); return result;}
const form = /** @type {HTMLFormElement} */ (node('publish-form'));
let token = sessionStorage.getItem('aisgk-pwa-teacher') || '';
let mustChangePin = sessionStorage.getItem('aisgk-pwa-teacher-must-change') === 'true';
// Cách ly vai trò: máy đang có phiên học sinh thì không giữ phiên giáo viên cũ.
try {
  if (await db.get('meta', 'session')) {
    token = ''; mustChangePin = false;
    sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('thi-gv-mk'); sessionStorage.removeItem('aisgk-presence-gv-ticket'); try { localStorage.removeItem('aisgk-presence-gv'); } catch { /* bỏ qua */ } sessionStorage.removeItem('aisgk-pwa-teacher-must-change');
  }
} catch { /* không đọc được bộ nhớ: coi như chưa có phiên học sinh */ }
/** Thông báo dạng hộp thoại: mỗi thông báo một hộp thoại, hiện lần lượt (không dùng thanh nổi/toast).
 * @param {string} text @param {boolean} [error] */
function notify(text, error = false) {
  if (!text) return;
  void noticeBox({title: error ? 'Chưa thực hiện được' : 'Đã hoàn tất', body: text}).catch(() => {});
}
let generation = 0;
let lessonDirty = false;
let quotaDirty = false;
const DRAFT_KEY = 'aisgk-teacher-draft';
/** Phiên hết hạn: Worker trả 401, hoặc 403 kèm thông báo token cho đường dẫn giáo viên. */
function isAuthError(e) { return e instanceof ApiError && (e.status === 401 || (e.status === 403 && /Token xác thực/.test(e.message))); }
/** @param {Error} error */
function fail(error) {
  if (isAuthError(error)) {token = ''; sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('thi-gv-mk'); sessionStorage.removeItem('aisgk-presence-gv-ticket'); try { localStorage.removeItem('aisgk-presence-gv'); } catch { /* bỏ qua */ } sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); mustChangePin = false; generation++; updateAuth();}
  if (isAuthError(error)) { notify('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', true); return; }
  notify(error instanceof Error ? error.message : 'Thao tác chưa hoàn thành. Hãy thử lại.', true);
}
/** @param {string} id @param {()=>void|Promise<void>} action */
function on(id, action) {node(id).addEventListener('click', () => {
  const captured = generation;
  Promise.resolve(action()).catch(error => {if (captured === generation) fail(error);});
});}
/** Giáo viên lớp (Mã giáo viên + PIN, kiểm trên Firebase): không có token Worker, chỉ dùng Thi và Tài khoản. */
function classTeacher() { try { return JSON.parse(sessionStorage.getItem('aisgk-gv-info') || 'null'); } catch { return null; } }
function clearClassTeacher() { for (const k of ['aisgk-gv-info', 'thi-gv-ma']) sessionStorage.removeItem(k); }
/** Điện thoại/WebView cũ không hiểu 100dvh: đo chiều cao thật để thanh menu dưới luôn hiện. */
const setAppH = () => document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
setAppH(); window.addEventListener('resize', setAppH); window.addEventListener('orientationchange', setAppH);
function updateAuth() {
  const gv = classTeacher(), signed = Boolean(token) || Boolean(gv);
  document.body.classList.toggle('is-class-teacher', Boolean(gv) && !token);
  node('auth-section').hidden = signed;
  const mustChangeSec = node('teacher-must-change-section');
  if (mustChangeSec) mustChangeSec.hidden = !token || !mustChangePin;
  node('editor').hidden = !signed || (Boolean(token) && mustChangePin);
  node('teacher-logout').hidden = !signed;
  const prof = document.getElementById('nav-profile');   // đăng xuất xong thì đóng bảng Cài đặt (popover không tự đóng khi nút mở bị ẩn)
  if (!signed && prof) { try { prof.hidePopover?.(); } catch { /* đã đóng */ } prof.classList.remove('open'); }
  const openSettingsBtn = document.getElementById('open-settings');
  if (openSettingsBtn) openSettingsBtn.hidden = !signed || (Boolean(token) && mustChangePin);   // giáo viên lớp cũng có Cài đặt: Đổi mã PIN, Đăng xuất
  const hdrAcc = document.getElementById('hdr-accounts'); if (hdrAcc) hdrAcc.hidden = !signed || (Boolean(token) && mustChangePin);
  const who = document.getElementById('gv-who'); if (who) { who.hidden = !(gv && !token); who.textContent = gv && !token ? `${gv.ten || gv.ma} · Lớp ${(gv.lop || []).join(', ')}` : ''; }
}
/** @param {string} name @returns {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} */
function field(name) {return /** @type {HTMLInputElement} */ (form.elements.namedItem(name));}
/** @param {string} text @param {string} name @param {string} [value] @param {boolean} [multiline] */
function inputLabel(text, name, value = '', multiline = false) {
  const label = el('label', text); const input = multiline ? el('textarea') : el('input');
  input.name = name; input.value = value; input.required = true; input.maxLength = multiline ? 2000 : 500; label.append(input); return label;
}
/** @param {PrivateQuestion} [question] */
function addQuestion(question) {
  const container = node('question-editors'); const section = el('fieldset', '', 'question-edit');
  section.append(el('legend', 'Câu hỏi'));
  const code = inputLabel('Mã câu hỏi', 'question-id', question?.id || `q${crypto.randomUUID().slice(0,8)}`);
  /** @type {HTMLInputElement} */ (code.querySelector('input')).pattern = '[a-z0-9][a-z0-9_\-]{0,63}';
  section.append(code, inputLabel('Câu hỏi', 'prompt', question?.prompt || ''));
  const kindLabel = el('label', 'Loại câu hỏi'); const kind = el('select'); kind.name = 'kind';
  for (const [value, text] of [['choice','Trắc nghiệm'],['text','Tự luận']]) {const option = el('option', text); option.value = value; kind.append(option);}
  kind.value = question?.kind || 'choice'; kindLabel.append(kind); section.append(kindLabel);
  const options = el('div', '', 'teacher-grid');
  const storedKeys = Object.keys(question?.options || {});
  const keys = storedKeys.length ? storedKeys : ['A','B','C','D'];
  for (const key of keys) {const label = inputLabel(`Lựa chọn ${key}`, `option-${key}`, question?.options[key] || ''); const input = /** @type {HTMLInputElement} */ (label.querySelector('input')); input.dataset.optionKey = key; input.maxLength = 2000; input.required = false; options.append(label);}
  const correctLabel = el('label', 'Đáp án đúng'); const correct = el('select'); correct.name = 'correct_answer';
  for (const key of keys) {const option = el('option', key); option.value = key; correct.append(option);}
  correct.value = question?.correct_answer || 'A'; correctLabel.append(correct); options.append(correctLabel); section.append(options);
  const hint = inputLabel('Gợi ý (không ghi đáp án)', 'hint', question?.hint || '', true);
  /** @type {HTMLTextAreaElement} */ (hint.querySelector('textarea')).required = false;
  /** @type {HTMLTextAreaElement} */ (hint.querySelector('textarea')).maxLength = 1000;
  const topic = inputLabel('Chủ đề kiến thức (giúp báo cáo điểm yếu)', 'topic', question?.topic || '');
  const topicInput = /** @type {HTMLInputElement} */ (topic.querySelector('input')); topicInput.required = false; topicInput.maxLength = 60; topicInput.placeholder = 'Ví dụ: Phần cứng máy tính';
  section.append(topic, hint, ui.toIcon(/** @type {HTMLButtonElement} */ (button('Xóa câu hỏi', () => section.remove())), 'trash', 'Xóa câu hỏi này', true));
  const toggle = () => {options.hidden = kind.value === 'text'; for (const input of options.querySelectorAll('input,select')) /** @type {HTMLInputElement} */ (input).disabled = options.hidden;};
  kind.addEventListener('change', toggle); toggle(); container.append(section);
}
/** @returns {PublishLesson} */
function documentValue() {
  /** @type {PrivateQuestion[]} */ const questions = [];
  for (const section of node('question-editors').querySelectorAll('fieldset')) {
    /** @param {string} name */ const value = name => /** @type {HTMLInputElement} */ (section.querySelector(`[name="${name}"]`)).value.trim();
    const kind = value('kind') === 'text' ? 'text' : 'choice';
    /** @type {Record<string,string>} */ const options = {};
    if (kind === 'choice') for (const input of section.querySelectorAll('input[data-option-key]')) {
      const entry = /** @type {HTMLInputElement} */ (input);
      if (entry.value.trim() && entry.dataset.optionKey) options[entry.dataset.optionKey] = entry.value.trim();
    }
    questions.push({id:value('question-id'), prompt:value('prompt'), kind, options, correct_answer:kind === 'choice' ? value('correct_answer') : '', hint:value('hint'), topic:value('topic')});
  }
  return {subject_id:field('subject_id').value.trim(), subject_name:field('subject_name').value.trim(), grade:Number(field('grade').value), lesson_id:field('lesson_id').value.trim(), title:field('title').value.trim(), content_markdown:field('content_markdown').value, questions};
}
/** @type {Array<{course:string, courseTitle:string, grade:number, id:string, title:string, version:string, questions:number}>} */
let lessonIndex = [];
async function refresh() {
  const captured = generation;
  const catalog = /** @type {import('./contracts').Catalog} */ (await api('/pwa/catalog'));
  if (captured !== generation) return;
  const select = /** @type {HTMLSelectElement} */ (node('published'));
  select.replaceChildren(el('option', 'Chọn bài để chỉnh sửa'));
  lessonIndex = [];
  const courseSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('field-material-form-material_course_id'));
  courseSelect?.replaceChildren(Object.assign(el('option', 'Chọn khóa học'), {value: ''}));
  for (const course of catalog.courses) {
    if (courseSelect) { const o = el('option', course.title); o.value = course.id; courseSelect.append(o); }
    for (const lesson of course.lessons) {
      const option = el('option', `${course.title} · ${lesson.title}`); option.value = `${course.id}/${lesson.id}`; select.append(option);
      lessonIndex.push({course: course.id, courseTitle: course.title, grade: Number(course.grade), id: lesson.id, title: lesson.title, version: String(lesson.version || ''), questions: Number(lesson.question_count || 0)});
    }
  }
  const subjectFilter = /** @type {HTMLSelectElement|null} */ (document.getElementById('field-lesson_subject'));
  if (subjectFilter) {
    const keep = subjectFilter.value;
    subjectFilter.replaceChildren(Object.assign(el('option', 'Tất cả'), {value: ''}));
    for (const course of catalog.courses) { const o = el('option', course.title); o.value = course.id; subjectFilter.append(o); }
    subjectFilter.value = [...subjectFilter.options].some(o => o.value === keep) ? keep : '';
  }
  renderLessonList();
}
function renderLessonList() {
  const box = document.getElementById('lesson-list'); if (!box) return;
  const q = String(/** @type {HTMLInputElement|null} */ (document.getElementById('field-lesson_search'))?.value || '').trim().toLowerCase();
  const g = String(/** @type {HTMLSelectElement|null} */ (document.getElementById('field-lesson_grade'))?.value || '');
  const sj = String(/** @type {HTMLSelectElement|null} */ (document.getElementById('field-lesson_subject'))?.value || '');
  const items = lessonIndex.filter(l => (!g || String(l.grade) === g) && (!sj || l.course === sj) && (!q || `${l.title} ${l.courseTitle}`.toLowerCase().includes(q)));
  box.replaceChildren();
  if (!items.length) { box.append(el('p', lessonIndex.length ? 'Không có bài nào khớp bộ lọc.' : 'Chưa có bài học nào được xuất bản. Bấm "Soạn bài mới" để bắt đầu.', 't-muted')); return; }
  for (const l of items) {
    const card = el('article', '', 't-card t-list-item');
    const info = el('div');
    info.append(el('h3', l.title), el('p', `Lớp ${l.grade} · ${l.courseTitle} · ${l.questions} câu hỏi${l.version ? ` · Phiên bản ${l.version.slice(0, 6)}` : ''}`, 't-muted'), el('span', 'Đã xuất bản', 't-badge'));
    const open = button('Mở', async () => {
      await withBusy(open, 'Đang mở…', async () => {
        try {
          const captured = generation;
          const doc = await api(`/pwa/teacher/lesson/${l.course}/${l.id}`, {token});
          if (captured === generation && token) { fill(doc); lessonDirty = false; await ui.showSub('detail-lessons'); }
        } catch (error) { fail(error instanceof Error ? error : new Error('Chưa mở được bài học.')); }
      });
    });
    ui.toIcon(open, 'view', `Mở bài ${l.title}`);
    card.append(info, open); box.append(card);
  }
}
for (const id of ['field-lesson_search', 'field-lesson_grade', 'field-lesson_subject']) {
  document.getElementById(id)?.addEventListener('input', renderLessonList);
  document.getElementById(id)?.addEventListener('change', renderLessonList);
}
async function results() {
  const captured = generation;
  const data = await api('/pwa/teacher/results', {token});
  if (captured !== generation || !token) return;
  const target = node('teacher-results'); target.replaceChildren();
  const attempts = Array.isArray(data) ? data : (Array.isArray(data?.attempts) ? data.attempts : []);
  for (const attempt of attempts) {
    const card = el('article', '', 'progress-card');
    const who = [attempt.student_name || attempt.uid, attempt.class_code].filter(Boolean).join(' · ');
    const score = Number.isFinite(attempt.correct) && Number.isFinite(attempt.total) ? `${attempt.correct}/${attempt.total} câu đúng` : 'Chưa có điểm';
    card.append(el('h3', who || 'Học sinh'), el('p', `${attempt.course_id || ''} / ${attempt.lesson_id || ''}: ${score}${attempt.needs_review ? ' · Cần xem tự luận' : ''}`));
    if (attempt.answers && typeof attempt.answers === 'object') for (const [id, answer] of Object.entries(attempt.answers)) card.append(el('p', `${id}: ${answer}`));
    target.append(card);
  }
  if (!attempts.length) target.append(el('p', 'Chưa có bài nộp.'));
}
/** Thư viện Excel nạp khi cần (chỉ giáo viên dùng), lưu cục bộ trong thư mục vendor.
 * @param {string} src @returns {Promise<void>} */
const scriptLoads = new Map();
function loadScript(src) {
  if (!scriptLoads.has(src)) scriptLoads.set(src, new Promise((resolve, reject) => {
    const tag = document.createElement('script'); tag.src = src; tag.onload = () => resolve(); tag.onerror = () => { scriptLoads.delete(src); reject(new Error('Không tải được bộ đọc Excel. Kiểm tra kết nối mạng rồi thử lại.')); }; document.head.append(tag);
  }));
  return /** @type {Promise<void>} */ (scriptLoads.get(src));
}
/** @type {{questions:import('./exam-import.js').ImportedQuestion[], total_points:number}} */
let importedExam = {questions: [], total_points: 0};
/** Vẽ lại trình sửa câu hỏi theo importedExam. */
function showQuestionEditor() {
  const box = document.getElementById('exam-question-editor'); if (!box) return;
  renderEditor(box, () => /** @type {any} */ (importedExam.questions), list => { importedExam.questions = list; importedExam.total_points = totalPoints(/** @type {any} */ (list)); });
}
async function downloadExamTemplate() {
  await loadScript('./vendor/write-excel-file.min.js');
  const sample = templateRows();
  /** @param {unknown} v @param {boolean} [bold] */
  const cell = (v, bold = false) => typeof v === 'number' ? {value: v, type: Number, ...(bold ? {fontWeight: 'bold'} : {})} : {value: String(v ?? ''), ...(bold ? {fontWeight: 'bold'} : {})};
  const questions = sample.questions.map((row, i) => row.map(v => cell(v, i === 0)));
  const guide = sample.guide.map((row, i) => row.map(v => cell(v, i === 0)));
  const widths = [6, 14, 52, 28, 28, 28, 28, 14, 8, 22, 34];
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([
    {data: questions, sheet: 'Câu hỏi', columns: widths.map(width => ({width})), stickyRowsCount: 1},
    {data: guide, sheet: 'Hướng dẫn', columns: [{width: 110}]}
  ]).toFile('mau-de-kiem-tra.xlsx');
}
/** @param {File} file */
async function importExamFile(file) {
  const target = node('exam-import-preview'); target.replaceChildren(el('p', 'Đang kiểm tra file…', 't-muted ld-box'));
  importedExam = {questions: [], total_points: 0};
  if (!/\.xlsx$/i.test(file.name)) { target.replaceChildren(el('p', 'Chỉ nhận file .xlsx. Hãy dùng file tải từ "Tải mẫu Excel đề".', 'notice error')); return; }
  if (file.size > 2 * 1024 * 1024) { target.replaceChildren(el('p', 'File lớn hơn 2 MB. Hãy tách thành nhiều đề.', 'notice error')); return; }
  /** @type {unknown[][]} */ let rows;
  try {
    await loadScript('./vendor/read-excel-file.min.js');
    // @ts-ignore thư viện nạp bằng thẻ script
    const result = await globalThis.readXlsxFile(file);
    rows = Array.isArray(result) && result.length && result[0] && !Array.isArray(result[0]) && result[0].data ? result[0].data : result;
  } catch (e) {
    target.replaceChildren(el('p', e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file. Hãy dùng file .xlsx tải từ mẫu, không đổi định dạng.', 'notice error')); return;
  }
  const parsed = parseExamRows(rows);
  target.replaceChildren();
  if (parsed.fatal) { target.append(el('p', parsed.fatal, 'notice error')); if (!parsed.reports.length) return; }
  const bad = parsed.reports.filter(r => !r.ok).length;
  if (parsed.valid) {
    importedExam = {questions: parsed.questions, total_points: parsed.total_points}; showQuestionEditor();
    const kinds = {choice: parsed.questions.filter(q => q.kind === 'choice').length, text: parsed.questions.filter(q => q.kind === 'text').length};
    target.append(el('p', `Tải lên thành công: ${parsed.questions.length} câu (${kinds.choice} trắc nghiệm, ${kinds.text} tự luận), tổng ${String(parsed.total_points).replace('.', ',')} điểm.`, 'notice success'));
    if (parsed.total_points !== 10) target.append(el('p', `Tổng điểm là ${String(parsed.total_points).replace('.', ',')}, không phải 10. Điểm của học sinh sẽ quy về thang 10.`, 't-muted'));
  } else if (bad) target.append(el('p', `Có ${bad} dòng chưa đúng. Sửa trong file rồi tải lại; chưa có câu nào được nhận.`, 'notice error'));
  const table = el('table', '', 't-table'); table.append(el('caption', 'Kết quả kiểm tra từng dòng'));
  const head = el('thead'); const hr = el('tr'); for (const name of ['Dòng', 'Câu hỏi', 'Loại', 'Điểm', 'Kết quả']) { const th = el('th', name); th.scope = 'col'; hr.append(th); } head.append(hr);
  const body = el('tbody');
  const byRow = new Map(parsed.questions.map(q => [q.row, q]));
  for (const report of parsed.reports) {
    const q = byRow.get(report.row); const tr = el('tr');
    const line = /** @type {unknown[]} */ (rows[report.row - 1] || []);
    const cells = [[String(report.row), 'Dòng'], [String(q?.prompt ?? line[2] ?? '').slice(0, 80), 'Câu hỏi'], [q ? (q.kind === 'choice' ? 'Trắc nghiệm' : 'Tự luận') : String(line[1] ?? ''), 'Loại'], [q ? String(q.points).replace('.', ',') : String(line[8] ?? ''), 'Điểm']];
    for (const [value, label] of cells) { const td = el('td', value); td.dataset.label = label; tr.append(td); }
    const result = el('td'); result.dataset.label = 'Kết quả';
    result.append(report.ok ? el('span', 'Hợp lệ', 't-badge') : el('span', report.errors.join('; '), 't-badge t-badge-error')); tr.append(result); body.append(tr);
  }
  table.append(head, body); target.append(table);
}
const examFileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('field-exam-file'));
examFileInput?.addEventListener('change', () => { const file = examFileInput.files?.[0]; if (file) importExamFile(file).catch(e => notify(e instanceof Error ? e.message : 'Chưa đọc được file.', true)).finally(() => { examFileInput.value = ''; }); });
document.getElementById('act-exams-template')?.addEventListener('click', () => { downloadExamTemplate().catch(e => notify(e instanceof Error ? e.message : 'Chưa tạo được file mẫu.', true)); });
/** @type {string|null} */
let editingExamId = null;
const EXAM_STATE_TEXT = {draft: 'Nháp', upcoming: 'Sắp mở', open: 'Đang mở', closed: 'Đã đóng'};
/** @param {number|null|undefined} ms */
function dateText(ms) { return ms ? new Date(ms).toLocaleString('vi-VN', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '—'; }
/** @param {number|null|undefined} ms */
function localInput(ms) { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
/** @param {string} id */
function examField(id) { return /** @type {HTMLInputElement} */ (node(`field-${id}`)); }
function resetExamForm() {
  editingExamId = null; importedExam = {questions: [], total_points: 0};
  /** @type {HTMLFormElement} */ (node('form-exams')).reset();
  node('exam-import-preview').replaceChildren(el('p', 'Chưa tải file. Bấm "Tải mẫu Excel đề", điền câu hỏi và điểm từng câu rồi tải lên.', 't-muted'));
  node('exam-save-status').textContent = '';
  examField('exam_mode').dispatchEvent(new Event('change')); showQuestionEditor();
}
async function loadExams() {
  const captured = generation;
  const body = node('exams-tbody');
  /** @type {any} */ let data;
  try { data = await api('/pwa/teacher/exams', {token}); }
  catch (error) {
    if (isAuthError(error)) throw error;
    if (captured === generation) { const tr = el('tr'); const td = el('td', error instanceof ApiError && error.status === 404 ? 'Máy chủ chưa cập nhật phần kiểm tra. Hãy triển khai bản máy chủ mới rồi tải lại.' : 'Chưa tải được danh sách đề.', 't-muted'); td.colSpan = 7; tr.append(td); body.replaceChildren(tr); }
    return;
  }
  if (captured !== generation || !token) return;
  body.replaceChildren();
  const exams = Array.isArray(data?.exams) ? data.exams : [];
  if (!exams.length) { const tr = el('tr'); const td = el('td', 'Chưa có đề kiểm tra. Bấm "Thêm đề kiểm tra".', 't-muted'); td.colSpan = 7; tr.append(td); body.append(tr); return; }
  for (const e of exams) {
    const tr = el('tr'); /** @param {string} label @param {Node|string} content */
    const cell = (label, content) => { const td = el('td'); td.dataset.label = label; td.append(content); tr.append(td); return td; };
    cell('Tên đề', e.title);
    cell('Lớp / Môn', `Lớp ${e.grade}${e.class_codes?.length ? ' · ' + e.class_codes.join(', ') : ''}`);
    cell('Loại / Thời lượng', e.mode === 'real' ? `Thật · ${e.minutes} phút` : 'Thử · không giới hạn giờ');
    cell('Mở – Đóng', e.mode === 'real' ? `${dateText(e.opens_at)} – ${dateText(e.closes_at)}` : '—');
    cell('Trạng thái', el('span', EXAM_STATE_TEXT[/** @type {keyof typeof EXAM_STATE_TEXT} */ (e.state)] || e.state, `t-badge${e.state === 'closed' ? ' t-badge-error' : ''}`));
    const n = cell('Bài nộp', String(e.submissions)); n.className = 't-number';
    const actions = el('div', '', 't-icon-actions'); actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', `Thao tác với đề ${e.title}`);
    const icon = (/** @type {string} */ label, /** @type {any} */ ic, /** @type {() => void} */ fn) => ui.toIcon(/** @type {HTMLButtonElement} */ (button(label, fn)), ic, `${label}: ${e.title}`);
    actions.append(icon('Sửa', 'edit', () => editExam(e.exam_id).catch(fail)));
    if (e.mode === 'real') actions.append(icon('Theo dõi', 'monitor', () => openExamMonitor(e.exam_id).catch(fail)));
    actions.append(icon('Thống kê', 'stats', () => openExamStats(e.exam_id).catch(fail)));
    const isOpen = e.status === 'open';
    actions.append(icon(isOpen ? 'Đóng đề' : 'Mở đề', isOpen ? 'lock' : 'play', () => setExamStatus(e.exam_id, isOpen ? 'closed' : 'open').catch(fail)));
    cell('Thao tác', actions); body.append(tr);
  }
}
/** @type {any} */ let examView = null; let monitorTimer = 0;
const EXAM_ROW_STATUS = {in_progress: 'Đang làm', not_started: 'Chưa vào', submitted: 'Đã nộp'};
/** @param {string} id */
async function fetchExamResults(id) { return api(`/pwa/teacher/exams/${id}/results`, {token}); }
/** @param {number|null} ms */
function remainText(ms) { if (ms === null || ms === undefined) return '—'; const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${m}:${String(s).padStart(2, '0')}`; }
/** @param {string} id @param {string[][]} items */
function fillMetrics(id, items) { const dl = node(id); dl.replaceChildren(); for (const [k, v] of items) { const d = el('div'); d.append(el('dt', k), el('dd', v)); dl.append(d); } }
/** @param {number|null|undefined} v */
const num = v => (v === null || v === undefined ? '—' : String(v).replace('.', ','));
/** @param {string} id */
async function openExamMonitor(id) {
  await ui.showSub('detail-exams-monitor');
  clearInterval(monitorTimer);
  const refresh = async () => {
    const data = await fetchExamResults(id); examView = {id, data};
    node('exam-mon-title').textContent = data.exam.title;
    node('exam-mon-sub').textContent = `Lớp ${data.exam.grade}${data.exam.class_codes?.length ? ' · ' + data.exam.class_codes.join(', ') : ''} · ${data.exam.minutes} phút · cập nhật ${new Date(data.server_now).toLocaleTimeString('vi-VN')}`;
    const s = data.stats;
    fillMetrics('exam-mon-metrics', [['Tổng học sinh', String(s.total)], ['Đang làm', String(s.in_progress)], ['Đã nộp', String(s.submitted)], ['Chưa vào', String(s.not_started)]]);
    const body = node('exam-mon-body'); body.replaceChildren();
    if (!data.rows.length) { const tr = el('tr'); const td = el('td', 'Chưa có học sinh thuộc đề này.', 't-muted'); td.colSpan = 7; tr.append(td); body.append(tr); }
    for (const r of data.rows) {
      const tr = el('tr'); /** @param {string} label @param {Node|string} c @param {string} [cls] */
      const cell = (label, c, cls = '') => { const td = el('td'); td.dataset.label = label; if (cls) td.className = cls; td.append(c); tr.append(td); return td; };
      cell('Học sinh', r.name); cell('Lớp', r.class_code || '—');
      cell('Trạng thái', el('span', `${EXAM_ROW_STATUS[/** @type {keyof typeof EXAM_ROW_STATUS} */ (r.status)]}${r.late ? ' (nộp muộn)' : ''}`, `t-badge${r.status === 'in_progress' ? '' : r.status === 'not_started' ? ' t-badge-error' : ''}`));
      cell('Còn lại', r.status === 'in_progress' ? remainText(r.remaining_ms) : '—', 't-number');
      cell('Rời tab', r.leaves ? String(r.leaves) : '0', `t-number${r.leaves >= 3 ? ' t-warn' : ''}`);
      cell('Điểm', r.status === 'submitted' ? `${num(r.best_score)}${r.needs_review ? ' *' : ''}` : '—', 't-number');
      const act = el('div', '', 't-icon-actions');
      if (r.status === 'in_progress' && data.exam.mode === 'real') act.append(ui.toIcon(/** @type {HTMLButtonElement} */ (button('Gia hạn', () => extendStudent(id, r, refresh))), 'clock', `Gia hạn cho ${r.name}`));
      cell('Thao tác', act.childElementCount ? act : '—');
      body.append(tr);
    }
  };
  await refresh();
  monitorTimer = window.setInterval(() => { if (document.getElementById('detail-exams-monitor')?.hidden) { clearInterval(monitorTimer); return; } refresh().catch(() => {}); }, 15000);
  node('exam-mon-refresh').onclick = () => { refresh().catch(fail); };
}
/** @param {string} id @param {any} row @param {()=>Promise<void>} refresh */
async function extendStudent(id, row, refresh) {
  const res = await dialogBox({kind: 'prompt', title: `Gia hạn cho ${row.name}`, body: 'Nhập số phút cộng thêm (1–120). Chỉ áp dụng cho bài đang làm.', okText: 'Gia hạn',
    fields: [{name: 'minutes', label: 'Số phút', value: '5', validate: v => (/^\d{1,3}$/.test(v) && +v >= 1 && +v <= 120) ? '' : 'Nhập số từ 1 đến 120.'}]});
  if (!res || typeof res !== 'object') return;
  await api(`/pwa/teacher/exams/${id}/extend`, {method: 'POST', token, body: {uid: row.uid, minutes: parseInt(res.minutes, 10)}});
  notify(`Đã gia hạn ${res.minutes} phút cho ${row.name}.`); await refresh();
}
const BUCKETS = ['0–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9–10'];
/** @param {string} id */
async function openExamStats(id) {
  await ui.showSub('detail-exams-stats');
  const data = await fetchExamResults(id); examView = {id, data};
  node('exam-stats-title').textContent = `Thống kê: ${data.exam.title}`;
  node('exam-stats-sub').textContent = `${data.stats.submitted}/${data.stats.total} học sinh đã nộp · * là còn câu tự luận chờ chấm`;
  const s = data.stats;
  fillMetrics('exam-stats-metrics', [['Điểm trung bình', num(s.avg)], ['Cao nhất', num(s.max)], ['Thấp nhất', num(s.min)], ['Đã nộp / Tổng', `${s.submitted} / ${s.total}`]]);
  const dist = s.distribution; const top = Math.max(1, ...dist);
  const NS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 400 170'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Phân bố điểm: ${dist.map((n, i) => `${BUCKETS[i]}: ${n}`).join('; ')}`);
  const axis = document.createElementNS(NS, 'path'); axis.setAttribute('class', 't-chart-axis'); axis.setAttribute('d', 'M10 140H390'); svg.append(axis);
  dist.forEach((n, i) => {
    const h = Math.round((n / top) * 110); const x = 14 + i * 38;
    const r = document.createElementNS(NS, 'rect'); r.setAttribute('class', 't-chart-bar'); r.setAttribute('x', String(x)); r.setAttribute('y', String(140 - h)); r.setAttribute('width', '30'); r.setAttribute('height', String(h)); svg.append(r);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', String(x + 15)); t.setAttribute('y', '156'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '10'); t.setAttribute('fill', 'currentColor'); t.textContent = String(i + 1); svg.append(t);
    if (n) { const v = document.createElementNS(NS, 'text'); v.setAttribute('x', String(x + 15)); v.setAttribute('y', String(136 - h)); v.setAttribute('text-anchor', 'middle'); v.setAttribute('font-size', '11'); v.setAttribute('fill', 'currentColor'); v.textContent = String(n); svg.append(v); }
  });
  node('exam-stats-chart').replaceChildren(svg);
  const fillBody = (/** @type {string} */ bid, /** @type {(string|number)[][]} */ rows, /** @type {number} */ cols) => {
    const b = node(bid); b.replaceChildren();
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'Chưa có dữ liệu.', 't-muted'); td.colSpan = cols; tr.append(td); b.append(tr); return; }
    for (const r of rows) { const tr = el('tr'); r.forEach((v, i) => { const td = el('td', String(v)); if (typeof v === 'number' || /^\d+%$/.test(String(v))) td.className = 't-number'; td.dataset.label = i === 0 ? 'Mục' : ''; tr.append(td); }); b.append(tr); }
  };
  fillBody('exam-stats-dist', dist.map((n, i) => [`${BUCKETS[i]} điểm`, n]), 2);
  fillBody('exam-stats-questions', (data.questions || []).map((/** @type {any} */ q) => [`Câu ${q.number}`, q.topic || '—', q.percent === null ? '—' : `${q.percent}%`, q.top_wrong ? `${q.top_wrong.key}. ${q.top_wrong.text} (${q.top_wrong.count})` : '—']), 4);
  fillBody('exam-stats-rank', data.ranking.map((/** @type {any} */ r) => [r.rank, r.name + (r.needs_review ? ' *' : ''), r.class_code || '—', num(r.score)]), 4);
  const exp = /** @type {HTMLButtonElement} */ (node('act-exams-export')); exp.disabled = false; exp.removeAttribute('aria-disabled'); exp.onclick = () => { exportExamResults().catch(fail); };
  const clr = /** @type {HTMLButtonElement} */ (node('act-exams-clear')); clr.disabled = false; clr.removeAttribute('aria-disabled');
  clr.onclick = () => { clearExamStats(id, data.exam.title).catch(fail); };
}
/** @param {string} id @param {string} title */
async function clearExamStats(id, title) {
  const n = examView?.data?.stats?.submitted ?? 0;
  if (!await confirmBox({title: 'Xóa toàn bộ thống kê?', body: `Xóa mọi bài nộp và tiến độ làm bài của đề "${title}" (${n} bài nộp). Học sinh sẽ được làm lại từ đầu. Không thể hoàn tác; hãy xuất Excel trước nếu cần lưu.`, okText: 'Xóa thống kê', danger: true})) return;
  const res = await api(`/pwa/teacher/exams/${id}/results`, {method: 'DELETE', token});
  notify(`Đã xóa ${res.deleted_attempts ?? 0} bài nộp của đề này.`);
  await openExamStats(id); await loadExams();
}
async function exportExamResults() {
  if (!examView) return; const {data} = examView;
  await loadScript('./vendor/write-excel-file.min.js');
  /** @param {unknown} v @param {boolean} [bold] */
  const cell = (v, bold = false) => typeof v === 'number' ? {value: v, type: Number, ...(bold ? {fontWeight: 'bold'} : {})} : {value: String(v ?? ''), ...(bold ? {fontWeight: 'bold'} : {})};
  const head = ['Hạng', 'Họ và tên', 'Lớp', 'Trạng thái', 'Số lượt', 'Điểm cao nhất', 'Rời tab', 'Nộp muộn', 'Chờ chấm tự luận'].map(v => cell(v, true));
  const rankOf = new Map(data.ranking.map((/** @type {any} */ r) => [r.uid, r.rank]));
  const rows = data.rows.map((/** @type {any} */ r) => [rankOf.get(r.uid) ?? '', r.name, r.class_code, EXAM_ROW_STATUS[/** @type {keyof typeof EXAM_ROW_STATUS} */ (r.status)], r.attempts_used, r.best_score ?? '', r.leaves, r.late ? 'Có' : '', r.needs_review ? 'Có' : ''].map(v => cell(v)));
  const safe = String(data.exam.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'bai_kiem_tra';
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([{data: [head, ...rows], sheet: 'Kết quả', columns: [6, 28, 8, 14, 9, 14, 9, 11, 18].map(width => ({width})), stickyRowsCount: 1}]).toFile(`ket_qua_${safe}.xlsx`);
  notify('Đã xuất file Excel kết quả.');
}
/** @param {string} id @param {string} status */
async function setExamStatus(id, status) {
  await api(`/pwa/teacher/exams/${id}/status`, {method: 'POST', token, body: {status}});
  notify(status === 'open' ? 'Đã mở đề cho học sinh.' : 'Đã đóng đề.');
  await loadExams();
}
/** @param {string} id */
async function editExam(id) {
  const exam = await api(`/pwa/teacher/exams/${id}`, {token});
  resetExamForm(); editingExamId = id;
  examField('exam_title').value = exam.title; examField('exam_grade').value = String(exam.grade); examField('exam_kind').value = exam.kind; examField('exam_mode').value = exam.mode;
  examField('exam_mode').dispatchEvent(new Event('change'));
  examField('exam_minutes').value = exam.minutes ?? ''; examField('exam_open').value = localInput(exam.opens_at); examField('exam_close').value = localInput(exam.closes_at);
  examField('exam_attempts').value = String(exam.max_attempts ?? 1); examField('exam_answers').value = exam.reveal; examField('exam-shuffle').checked = Boolean(exam.shuffle);
  importedExam = {questions: exam.questions.map(/** @param {any} q @param {number} i */ (q, i) => ({id: q.id, row: i + 2, kind: q.kind, prompt: q.prompt, options: q.options, correct_answer: q.correct_answer, points: q.points, topic: q.topic || '', hint: q.hint || ''})), total_points: exam.total_points};
  node('exam-import-preview').replaceChildren(el('p', `Đề đang có ${exam.questions.length} câu, tổng ${String(exam.total_points).replace('.', ',')} điểm. Sửa trực tiếp ở danh sách câu hỏi bên dưới rồi bấm "Lưu đề"; tải file Excel mới nếu muốn thay toàn bộ câu hỏi.`, 'notice success')); showQuestionEditor();
  await ui.showSub('detail-exams');
}
document.getElementById('act-exams-new')?.addEventListener('click', resetExamForm);
document.getElementById('form-exams')?.addEventListener('submit', async event => {
  event.preventDefault();
  const status = node('exam-save-status'); status.textContent = ''; const real = examField('exam_mode').value === 'real';
  const title = examField('exam_title');
  if (!title.value.trim()) { setFieldError(title, 'Nhập tiêu đề đề kiểm tra.'); title.focus(); return; }
  setFieldError(title, '');
  { const problem = validateQuestions(/** @type {any} */ (importedExam.questions)); if (problem) { status.textContent = problem; document.getElementById('exam-question-editor')?.scrollIntoView({block: 'nearest'}); return; } }
  const ms = (/** @type {string} */ id) => { const v = examField(id).value; return v ? new Date(v).getTime() : NaN; };
  if (real) {
    const o = ms('exam_open'); const c = ms('exam_close'); const m = Number(examField('exam_minutes').value);
    const bad = (/** @type {string} */ id, /** @type {string} */ msg) => { const f = examField(id); setFieldError(f, msg); f.focus(); status.textContent = msg; };
    for (const id of ['exam_minutes', 'exam_open', 'exam_close']) setFieldError(examField(id), '');
    if (!(m >= 1 && m <= 300)) { bad('exam_minutes', 'Thời gian làm bài phải từ 1 đến 300 phút.'); return; }
    if (!Number.isFinite(o)) { bad('exam_open', 'Chọn giờ mở bài thi.'); return; }
    if (!Number.isFinite(c)) { bad('exam_close', 'Chọn giờ đóng bài thi.'); return; }
    if (c <= o) { bad('exam_close', 'Giờ đóng phải sau giờ mở. Hãy chọn lại giờ đóng (ví dụ cùng ngày, muộn hơn giờ mở).'); return; }
    if (c - o < m * 60000) { bad('exam_close', `Từ giờ mở đến giờ đóng chỉ có ${Math.floor((c - o) / 60000)} phút, ngắn hơn thời gian làm bài ${m} phút. Hãy lùi giờ đóng.`); return; }
  }
  const payload = {
    exam_id: editingExamId || undefined, title: title.value.trim(), grade: Number(examField('exam_grade').value), subject_id: examField('exam_subject').value, mode: examField('exam_mode').value,
    kind: examField('exam_kind').value, minutes: real ? Number(examField('exam_minutes').value) : undefined, opens_at: real ? ms('exam_open') : undefined, closes_at: real ? ms('exam_close') : undefined,
    max_attempts: real ? Number(examField('exam_attempts').value) : undefined, shuffle: examField('exam-shuffle').checked, reveal: examField('exam_answers').value, status: 'draft',
    questions: toPayload(/** @type {any} */ (importedExam.questions))
  };
  const submit = /** @type {HTMLButtonElement} */ (node('save-exam'));
  await withBusy(submit, 'Đang lưu…', async () => {
    try {
      if (editingExamId) { const old = await api(`/pwa/teacher/exams/${editingExamId}`, {token}); payload.status = old.status; }
      const res = await api('/pwa/teacher/exams', {method: 'POST', token, body: payload});
      notify(payload.status === 'open' ? 'Đã lưu đề (đang mở).' : 'Đã lưu đề ở trạng thái nháp. Bấm "Mở đề" trong danh sách khi sẵn sàng giao cho học sinh.');
      editingExamId = res.exam_id; await loadExams(); await ui.showSub('list-exams');
    } catch (error) { if (isAuthError(error)) { fail(error); return; } status.textContent = error instanceof ApiError && error.status === 400 ? error.message : mapErrorMessage(error); }
  });
});
const LEVEL_TEXT = {weak: 'Yếu', fair: 'Cần củng cố', good: 'Tốt', none: 'Chưa có'};
/** @param {number|null} percent @param {string} level */
function levelBar(percent, level) {
  const row = el('div', '', 'a-bar-row'); const track = el('div', '', 'a-bar'); const fill = el('span', '', `a-fill a-${level}`); fill.style.width = `${percent ?? 0}%`; track.append(fill);
  row.append(track, el('span', percent === null ? '–' : `${percent}%`, 'a-pct'), el('span', LEVEL_TEXT[/** @type {keyof typeof LEVEL_TEXT} */ (level)] || '', `a-tag a-${level}`));
  return row;
}
/** @param {string} title @param {string} [note] */
function analyticsBlock(title, note) { const block = el('section', '', 'a-block'); block.append(el('h3', title)); if (note) block.append(el('p', note, 't-muted')); return block; }
/** @type {{data:any, level:string, query:string}} */ const overview = {data: null, level: '', query: ''};
/** @param {string} tag @param {string} text @param {string} [cls] */
const h = (tag, text, cls = '') => el(tag, text, cls);
/** @param {string} label @param {string} value @param {string} tone @param {string} [note] */
function aTile(label, value, tone, note = '') {
  const tile = h('div', '', `a-tile a-tone-${tone}`); tile.append(h('span', label, 'a-tile-label'), h('strong', value, 'a-tile-value'));
  if (note) tile.append(h('span', note, 'a-tile-note')); return tile;
}
/** Tiêu đề mục đánh số của Tổng quan. @param {string} no @param {string} title @param {string} note */
function aSection(no, title, note) { const d = h('div', '', 'a-sec'); const t = h('h3', '', 'a-sec-title'); t.append(h('span', no, 'a-sec-no'), document.createTextNode(title)); d.append(t, h('p', note, 't-muted')); return d; }
/** Sĩ số lấy từ danh sách tài khoản học sinh (thi_hs), như thẻ "Học sinh đọc bài": mọi lớp đều hiện, kể cả lớp chưa nộp bài. */
/** @type {{ma:string,ten:string,lop:string}[]|null} */ let overviewRoster = null;
async function loadRoster() {
  if (overviewRoster) return overviewRoster;
  try { const hs = thiStore.enabled() ? ((await thiStore.get('thi_hs')) || {}) : {}; overviewRoster = Object.entries(hs).filter(([, v]) => v && v.lop).map(([k, v]) => ({ ma: String(k).toLowerCase(), ten: String(v.ten || k), lop: String(v.lop) })); }
  catch { overviewRoster = []; }
  return overviewRoster;
}
const gradeOfClass = (/** @type {string} */ c) => Number(String(c).match(/^\d+/)?.[0]) || 0;
/** Lớp đang chọn ở Tổng quan → nhãn và sĩ số. "k:9" = cả khối 9. */
function overviewScope() {
  const v = /** @type {HTMLSelectElement} */ (node('overview-class')).value, all = overviewRoster || [];
  if (v.startsWith('k:')) { const g = Number(v.slice(2)); return { label: `Khối ${g}`, roster: all.filter(r => gradeOfClass(r.lop) === g) }; }
  return { label: v ? `Lớp ${v}` : 'Tất cả lớp', roster: v ? all.filter(r => r.lop.toUpperCase() === v.toUpperCase()) : all };
}
/** Điền ô Lớp: nhóm theo khối, ghi sĩ số; mặc định lớp đông nhất của khối cao nhất. Đồng bộ ô Lớp của thẻ "Học sinh đọc bài". */
function fillOverviewClasses(/** @type {string[]} */ extra) {
  const select = /** @type {HTMLSelectElement} */ (node('overview-class')), keep = select.value;
  const count = /** @type {Record<string, number>} */ ({});
  for (const r of overviewRoster || []) count[r.lop] = (count[r.lop] || 0) + 1;
  for (const c of extra) if (c && !(c in count) && !Object.keys(count).some(k => k.toUpperCase() === c.toUpperCase())) count[c] = 0;
  const classes = Object.keys(count).sort((x, y) => x.localeCompare(y, 'vi', { numeric: true }));
  select.replaceChildren();
  if (!classes.length) { const o = h('option', 'Chưa có lớp'); o.value = ''; select.append(o); return; }
  for (const g of [...new Set(classes.map(gradeOfClass))].sort((x, y) => y - x)) {
    const og = document.createElement('optgroup'); og.label = g ? `Khối ${g}` : 'Khác'; const cl = classes.filter(c => gradeOfClass(c) === g);
    for (const c of cl) { const o = h('option', count[c] ? `Lớp ${c} (${count[c]} em)` : `Lớp ${c}`); o.value = c; og.append(o); }
    if (g && cl.length > 1) { const o = h('option', `Cả khối ${g} (${cl.length} lớp)`); o.value = 'k:' + g; og.append(o); }
    select.append(og);
  }
  const values = [...select.options].map(o => o.value);
  if (values.includes(keep) && keep) select.value = keep;
  else { const top = gradeOfClass(classes.slice().sort((x, y) => gradeOfClass(y) - gradeOfClass(x))[0]); select.value = classes.filter(c => gradeOfClass(c) === top).sort((x, y) => count[y] - count[x])[0]; }
}
/** Thẻ "Học sinh đọc bài" theo cùng lớp đã chọn ở trên (một chỗ chọn lớp cho cả trang). */
function syncReadClass() {
  const v = /** @type {HTMLSelectElement} */ (node('overview-class')).value, rl = /** @type {HTMLSelectElement|null} */ (document.getElementById('read-lop'));
  if (!rl || !v || rl.value === v || ![...rl.options].some(o => o.value === v)) return;
  rl.value = v; rl.dispatchEvent(new Event('change'));
}
/** @param {number|null|undefined} ms */
function sinceText(ms) {
  if (!ms) return 'Chưa có bài nộp';
  const d = Math.floor((Date.now() - ms) / 86400000);
  return d <= 0 ? 'Nộp gần nhất: hôm nay' : d === 1 ? 'Nộp gần nhất: hôm qua' : `Nộp gần nhất: ${d} ngày trước`;
}
function renderOverview() {
  const target = node('teacher-analytics'); const data = overview.data; if (!data) return;
  target.replaceChildren();
  const students = /** @type {any[]} */ (data.students || []); const lessons = /** @type {any[]} */ (data.lessons || []); const topics = /** @type {any[]} */ (data.topics || []);
  // Quy trình thống nhất: mọi mục dưới đây đều tính trên ĐÚNG lớp (hoặc khối) đang chọn, mẫu số là sĩ số lớp.
  const sc = overviewScope(), roster = sc.roster, n = roster.length;
  const did = new Set(students.map(s => String(s.uid).toLowerCase()));
  const notYet = roster.filter(r => !did.has(r.ma));
  const courseText = data.course_filter ? ` · ${courseNames?.[data.course_filter] || data.course_filter}` : '';
  node('a-head-sub').textContent = `${sc.label}${n ? ` · ${n} học sinh` : ''}${courseText}`;
  if (!students.length) {
    const empty = h('section', '', 'a-card'); empty.append(h('h3', 'Chưa có bài nộp'), h('p', n ? `${sc.label} có ${n} học sinh nhưng chưa em nào nộp bài luyện tập hay kiểm tra. Báo cáo hiện ra khi có bài nộp đầu tiên.` : 'Lớp này chưa có bài nộp nào.', 't-muted'));
    target.append(empty); return;
  }
  const count = (/** @type {string} */ lv) => students.filter(s => s.level === lv).length;
  const classAvg = Math.round(students.reduce((sum, s) => sum + (s.avg_percent || 0), 0) / students.length);
  const joined = n ? Math.min(n, students.length) : students.length, joinPct = n ? Math.round(100 * joined / n) : 100;
  // 1. Tham gia
  target.append(aSection('1', 'Tham gia', 'Bao nhiêu em đã làm bài, trên sĩ số lớp.'));
  const tiles = h('div', '', 'a-tiles');
  tiles.append(aTile('Đã làm bài', n ? `${joined}/${n}` : String(joined), 'teal', n ? `${joinPct}% sĩ số` : ''), aTile('Chưa làm bài', n ? String(notYet.length) : '–', 'gray', n ? 'cần nhắc nhở' : 'chưa có sĩ số'),
    aTile('Lượt nộp', String(data.total_attempts || 0), 'blue', `${lessons.length} bài`), aTile('Đúng trung bình', `${classAvg}%`, 'green', 'của các em đã làm'), aTile('Cần hỗ trợ', String(count('weak')), 'red', 'dưới 50% đúng'));
  target.append(tiles);
  // 2. Mức nắm bài: phân bố cả lớp, gồm cả nhóm chưa làm (để tổng luôn bằng sĩ số)
  target.append(aSection('2', 'Mức nắm bài', 'Mỗi em xếp một mức theo điểm đúng trung bình (lần nộp gần nhất của mỗi bài).'));
  const ringCard = h('section', '', 'a-card a-ring-card');
  const ring = h('div', '', 'a-ring'); ring.style.setProperty('--p', `${classAvg}%`); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `Đúng trung bình ${classAvg} phần trăm`); ring.append(h('strong', `${classAvg}%`));
  const split = h('div', '', 'a-split'); split.append(h('h3', `${sc.label}: ${count('good')} tốt, ${count('fair')} cần củng cố, ${count('weak')} yếu${n ? `, ${notYet.length} chưa làm` : ''}`));
  const dist = h('div', '', 'a-dist'); dist.setAttribute('role', 'img');
  const parts = [['good', 'Tốt (từ 80%)', count('good')], ['fair', 'Cần củng cố (50–79%)', count('fair')], ['weak', 'Yếu (dưới 50%)', count('weak')]];
  if (n) parts.push(['none', 'Chưa làm', notYet.length]);
  dist.setAttribute('aria-label', parts.map(p => `${p[1]}: ${p[2]} học sinh`).join('; '));
  for (const [lv, , k] of parts) if (k) { const seg = h('span', '', `a-seg a-${lv}`); seg.style.flexGrow = String(k); dist.append(seg); }
  split.append(dist);
  const legend = h('ul', '', 'a-legend'); for (const [lv, name, k] of parts) { const li = h('li', ''); li.append(h('span', '', `a-dot a-${lv}`), h('span', `${name}: ${k}`)); legend.append(li); }
  split.append(legend);
  ringCard.append(ring, split); target.append(ringCard);
  // 3. Kết quả theo bài
  target.append(aSection('3', 'Kết quả theo bài', 'Bài nào cả lớp làm yếu nhất nằm trên cùng.'));
  const lessonCard = h('section', '', 'a-card');
  const lt = h('table', '', 't-table a-lessons'); lt.append(h('caption', 'Kết quả từng bài của lớp, xếp từ yếu đến tốt'));
  const lh = h('thead'); const lr = h('tr'); for (const [c, num] of [['Bài', false], ['Loại', false], ['Đã làm', true], ['Lượt nộp', true], ['Đúng trung bình', false]]) { const th = h('th', String(c)); th.scope = 'col'; if (num) th.className = 't-number'; lr.append(th); } lh.append(lr);
  const lb = h('tbody');
  for (const l of lessons) { const tr = h('tr'); const cells = [[l.title, 'Bài', ''], [l.is_exam ? 'Kiểm tra' : 'Luyện tập', 'Loại', ''], [n ? `${l.students}/${n}` : String(l.students), 'Đã làm', 't-number'], [String(l.attempts), 'Lượt nộp', 't-number']]; for (const [v, lab, cls] of cells) { const td = h('td', v, cls); td.dataset.label = lab; tr.append(td); } const td = h('td'); td.dataset.label = 'Đúng trung bình'; td.append(levelBar(l.avg_percent, l.level)); tr.append(td); lb.append(tr); }
  if (lessons.length) { lt.append(lh, lb); lessonCard.append(lt); } else lessonCard.append(h('p', 'Chưa có bài nào được làm.', 't-muted')); target.append(lessonCard);
  const hasDetail = lessons.some(l => l.questions.length);
  // 4. Kiến thức cần củng cố
  target.append(aSection('4', 'Kiến thức cần củng cố', 'Gom theo chủ đề và theo từng câu hỏi.'));
  // Chủ đề cần củng cố
  const topicCard = h('section', '', 'a-card'); topicCard.append(h('h3', 'Chủ đề cần củng cố'), h('p', 'Gom theo "Chủ đề kiến thức" gắn cho từng câu hỏi khi soạn bài.', 't-muted'));
  for (const item of topics.slice(0, 8)) { const row = h('div', '', 'a-item'); const top = h('div', '', 'a-item-top'); top.append(h('strong', item.topic), h('span', `${item.correct}/${item.total} lượt đúng`, 't-muted')); row.append(top, levelBar(item.percent, item.level)); topicCard.append(row); }
  if (!topics.length) topicCard.append(h('p', hasDetail ? 'Chưa có câu hỏi nào được gắn chủ đề. Hãy điền ô "Chủ đề kiến thức" khi soạn bài.' : 'Chưa có dữ liệu từng câu. Báo cáo sẽ xuất hiện sau khi học sinh nộp bài mới.', 't-muted'));
  // Câu hỏi nhiều bạn làm sai
  const qCard = h('section', '', 'a-card'); qCard.append(h('h3', 'Câu hỏi nhiều bạn làm sai'));
  /** @type {any[]} */ const flat = [];
  for (const lesson of lessons) for (const q of lesson.questions) if (q.level !== 'good') flat.push({lesson, q});
  flat.sort((x, y) => (x.q.percent ?? 101) - (y.q.percent ?? 101));
  for (const {lesson, q} of flat.slice(0, 8)) {
    const row = h('div', '', 'a-item'); const top = h('div', '', 'a-item-top'); top.append(h('strong', `${lesson.title} · Câu ${q.number}`), q.topic ? h('span', q.topic, 'a-chip') : h('span', ''));
    row.append(top, h('span', q.prompt, 'a-prompt'), levelBar(q.percent, q.level));
    const detail = [`${q.correct}/${q.answered} bạn đúng`]; if (q.blank) detail.push(`${q.blank} bạn bỏ trống`);
    if (q.top_wrong) detail.push(`nhiều bạn chọn ${q.top_wrong.key}${q.top_wrong.text ? `: ${q.top_wrong.text}` : ''} (${q.top_wrong.count} bạn)`);
    row.append(h('span', detail.join(' · '), 't-muted')); qCard.append(row);
  }
  if (!flat.length) qCard.append(h('p', hasDetail ? 'Chưa có câu nào cần chú ý. Cả lớp đang làm tốt.' : 'Chưa có dữ liệu từng câu.', 't-muted'));
  const two = h('div', '', 'a-two'); two.append(topicCard, qCard); target.append(two);
  // Học sinh: lọc theo mức và tên, mở ra xem chi tiết từng bài
  target.append(aSection('5', 'Từng học sinh', 'Bấm vào tên để xem điểm từng bài và chủ đề cần ôn.'));
  const people = h('section', '', 'a-card');
  const tools = h('div', '', 'a-tools');
  const find = document.createElement('input'); find.type = 'search'; find.placeholder = 'Tìm học sinh theo tên'; find.value = overview.query; find.setAttribute('aria-label', 'Tìm học sinh theo tên'); find.autocomplete = 'off';
  const chips = h('div', '', 'a-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Lọc theo mức');
  for (const [lv, name] of [['', 'Đã làm'], ['weak', 'Yếu'], ['fair', 'Cần củng cố'], ['good', 'Tốt'], ...(n ? [['none', `Chưa làm (${notYet.length})`]] : [])]) {
    const b = h('button', name, 'a-chipbtn'); b.type = 'button'; b.setAttribute('aria-pressed', String(overview.level === lv));
    b.addEventListener('click', () => { overview.level = lv; renderOverview(); }); chips.append(b);
  }
  tools.append(find, chips); people.append(tools);
  const list = h('div', '', 'a-people');
  const draw = () => {
    list.replaceChildren(); const q = find.value.trim().toLowerCase(); overview.query = find.value;
    if (overview.level === 'none') {   // danh sách em chưa nộp bài nào (theo sĩ số lớp)
      const rest = notYet.filter(r => !q || `${r.ten} ${r.ma}`.toLowerCase().includes(q));
      if (!rest.length) { list.append(h('p', notYet.length ? 'Không có học sinh phù hợp.' : 'Cả lớp đã làm bài.', 't-muted')); return; }
      const ul = h('ul', '', 'a-notyet'); for (const r of rest) { const li = h('li', ''); li.append(h('strong', r.ten), h('span', `Lớp ${r.lop} · chưa nộp bài nào`, 't-muted')); ul.append(li); } list.append(ul); return;
    }
    const shown = students.filter(s => (!overview.level || s.level === overview.level) && (!q || `${s.name} ${s.uid}`.toLowerCase().includes(q)));
    if (!shown.length) { list.append(h('p', 'Không có học sinh phù hợp bộ lọc.', 't-muted')); return; }
    for (const st of shown) {
      const d = document.createElement('details'); d.className = 'a-student';
      const sum = document.createElement('summary'); const name = h('span', '', 'a-sname'); name.append(h('strong', st.name), h('span', [st.class_code, `${st.lessons} bài`].filter(Boolean).join(' · '), 't-muted'));
      sum.append(name, levelBar(st.avg_percent, st.level)); d.append(sum);
      const body = h('div', '', 'a-sbody'); body.append(h('p', sinceText(st.last_at), 't-muted'));
      if (st.weak_topics?.length) { const wt = h('div', '', 'a-chiprow'); wt.append(h('span', 'Cần ôn:', 'a-label')); for (const w of st.weak_topics) wt.append(h('span', `${w.topic} (${w.percent}%)`, 'a-chip a-chip-weak')); body.append(wt); }
      else body.append(h('p', 'Chưa có chủ đề nào dưới 80%.', 't-muted'));
      const tbl = h('table', '', 't-table a-mini'); tbl.append(h('caption', `Điểm từng bài của ${st.name}`));
      const hd = h('thead'); const hr = h('tr'); for (const c of ['Bài', 'Loại', 'Đúng']) { const th = h('th', c); th.scope = 'col'; if (c === 'Đúng') th.className = 't-number'; hr.append(th); } hd.append(hr);
      const tb = h('tbody'); for (const it of st.items || []) { const tr = h('tr'); const c1 = h('td', it.title); c1.dataset.label = 'Bài'; const c2 = h('td', it.is_exam ? 'Kiểm tra' : 'Luyện tập'); c2.dataset.label = 'Loại'; const c3 = h('td', `${it.percent}%`, 't-number'); c3.dataset.label = 'Đúng'; tr.append(c1, c2, c3); tb.append(tr); }
      if ((st.items || []).length) { tbl.append(hd, tb); body.append(tbl); } else body.append(h('p', 'Chưa có bài nào.', 't-muted')); d.append(body); list.append(d);
    }
  };
  find.addEventListener('input', draw); draw(); people.append(list); target.append(people);

}
/** Danh mục bài (tên môn) cho bộ lọc Tổng quan. @type {Record<string,string>|null} */ let courseNames = null;
async function loadAnalytics() {
  const captured = generation;
  const target = node('teacher-analytics'); target.replaceChildren(h('p', 'Đang tải báo cáo…', 't-muted ld-box'));
  const select = /** @type {HTMLSelectElement} */ (node('overview-class')), csel = /** @type {HTMLSelectElement} */ (node('overview-course'));
  // Bước 1: sĩ số → ô Lớp (đủ mọi lớp, kể cả lớp chưa nộp bài). Bước 2: báo cáo của ĐÚNG lớp đó.
  if (!overviewRoster || !select.value) { await loadRoster(); if (captured !== generation) return; fillOverviewClasses([]); }
  const v = select.value, course = csel.value;
  const q = new URLSearchParams(); if (v.startsWith('k:')) q.set('grade', v.slice(2)); else if (v) q.set('class', v); if (course) q.set('course', course);
  /** @type {any} */ let data;
  try { data = await api(`/pwa/teacher/analytics${q.toString() ? '?' + q : ''}`, {token}); }
  catch (error) {
    if (isAuthError(error)) throw error;
    if (captured === generation) { node('a-head-sub').textContent = 'Chưa tải được báo cáo.'; target.replaceChildren(h('p', error instanceof ApiError && error.status === 404 ? 'Máy chủ chưa cập nhật tính năng báo cáo. Hãy triển khai bản máy chủ mới rồi tải lại.' : 'Chưa tải được báo cáo. Bấm "Tải lại báo cáo" để thử lại.', 't-muted')); }
    return;
  }
  if (captured !== generation || !token) return;
  // Lớp có bài nộp nhưng chưa có trong danh sách tài khoản: vẫn thêm vào ô Lớp
  const known = new Set([...select.options].map(o => o.value.toUpperCase()));
  if ((data.classes || []).some((/** @type {string} */ c) => c && !known.has(String(c).toUpperCase()))) fillOverviewClasses(data.classes);
  // Máy chủ cũ chưa lọc theo khối: lọc học sinh theo khối ở máy (bài/chủ đề vẫn gộp)
  if (v.startsWith('k:') && !data.grade_filter) data.students = (data.students || []).filter((/** @type {any} */ s) => gradeOfClass(s.class_code) === Number(v.slice(2)));
  // Môn: chỉ hiện khi dữ liệu có từ 2 môn/khóa học trở lên
  if (!courseNames) { courseNames = {}; try { const cat = await api('/pwa/catalog'); for (const c of cat?.courses || []) courseNames[c.id] = c.title || `${c.subject_name || c.id} ${c.grade || ''}`.trim(); } catch { /* bỏ qua */ } }
  const cs = /** @type {{id:string,n:number}[]} */ (data.courses || []);
  const ckeep = csel.value; csel.replaceChildren(); const ca = h('option', 'Tất cả các môn'); ca.value = ''; csel.append(ca);
  for (const c of cs.sort((x, y) => (courseNames?.[x.id] || x.id).localeCompare(courseNames?.[y.id] || y.id, 'vi', { numeric: true }))) { const o = h('option', `${courseNames?.[c.id] || c.id} (${c.n} bài nộp)`); o.value = c.id; csel.append(o); }
  csel.value = [...csel.options].some(o => o.value === ckeep) ? ckeep : '';
  node('overview-course-field').hidden = cs.length < 2 && !csel.value;
  overview.data = data; overview.level = ''; overview.query = ''; renderOverview(); syncReadClass();
}
document.getElementById('overview-class')?.addEventListener('change', () => { syncReadClass(); loadAnalytics().catch(fail); });
document.getElementById('overview-course')?.addEventListener('change', () => { loadAnalytics().catch(fail); });
/** @param {PublishLesson} document */
function fill(document) {
  /** @type {Array<keyof Omit<PublishLesson,'questions'>>} */
  const names = ['subject_id','subject_name','grade','lesson_id','title','content_markdown'];
  for (const name of names) field(name).value = String(document[name]);
  node('question-editors').replaceChildren(); for (const question of document.questions) addQuestion(question); node('preview').replaceChildren();
}
node('teacher-login').addEventListener('submit', async event => {
  event.preventDefault();
  const loginForm = /** @type {HTMLFormElement} */ (node('teacher-login'));
  const submit = /** @type {HTMLButtonElement} */ (loginForm.querySelector('button[type=submit]'));
  const pinInput = /** @type {HTMLInputElement} */ (loginForm.querySelector('[name=pin]'));
  const loginErr = document.getElementById('teacher-login-error');
  if (loginErr) { loginErr.textContent = ''; loginErr.className = 'notice error status'; }

  pinInput.addEventListener('input', () => setFieldError(pinInput, ''));
  const pin = pinInput.value.trim();
  const role = /** @type {HTMLInputElement|null} */ (loginForm.querySelector('[name=role]:checked'))?.value || 'admin';
  if (role === 'gv') {
    const codeInput = /** @type {HTMLInputElement} */ (loginForm.querySelector('[name=code]'));
    const code = codeInput.value.trim();
    codeInput.addEventListener('input', () => setFieldError(codeInput, ''), {once: true});
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(code)) { setFieldError(codeInput, 'Nhập Mã giáo viên (chữ, số, - và _).'); if (loginErr) loginErr.textContent = 'Nhập Mã giáo viên.'; codeInput.focus(); return; }
    if (pin.length < 6) { setFieldError(pinInput, 'Mã PIN tối thiểu 6 ký tự.'); if (loginErr) loginErr.textContent = 'Mã PIN tối thiểu 6 ký tự.'; pinInput.focus(); return; }
    await withBusy(submit, 'Đang đăng nhập…', async () => {
      try {
        const t = await thiStore.teacherLogin(code, pin);
        if (!t) throw new Error('Chưa có tài khoản giáo viên này. Nhờ quản trị thêm trong menu Tài khoản.');
        await db.remove('meta', 'session').catch(() => {});   // một máy một vai trò: đăng xuất học sinh
        token = ''; sessionStorage.removeItem('aisgk-pwa-teacher'); mustChangePin = false; generation++;
        sessionStorage.setItem('aisgk-gv-info', JSON.stringify(t)); sessionStorage.setItem('thi-gv-ma', t.ma); sessionStorage.setItem('thi-gv-mk', pin);
        sessionStorage.setItem('aisgk-presence-gv-ticket', '');
        window.dispatchEvent(new CustomEvent('thi-gv-login', {detail: {token: ''}}));
        loginForm.reset(); syncRole(); updateAuth(); ui.reset();
        document.getElementById('nav-sheetexam')?.click();
      } catch (error) { if (loginErr) loginErr.textContent = error instanceof Error && /Mã giáo viên|tài khoản giáo viên/.test(error.message) ? error.message : mapErrorMessage(error); }
    });
    return;
  }

  if (pin.length < 8) {
    setFieldError(pinInput, 'Mã PIN tối thiểu 8 ký tự.');
    if (loginErr) loginErr.textContent = 'Mã PIN tối thiểu 8 ký tự.';
    pinInput.focus();
    return;
  }

  await withBusy(submit, 'Đang đăng nhập…', async () => {
    try {
      const response = await api('/teacher/auth', {method:'POST', body:{pin}});
      token = response.token;
      mustChangePin = Boolean(response.must_change);
      sessionStorage.setItem('aisgk-pwa-teacher-must-change', String(mustChangePin));
      generation++;
      await db.remove('meta', 'session').catch(() => {});   // đăng nhập giáo viên thì đăng xuất học sinh trên máy này
      try { localStorage.removeItem('aisgk-fb'); } catch { /* bỏ qua */ }   // và cả phiên thi Firebase của học sinh
      clearClassTeacher(); sessionStorage.setItem('aisgk-pwa-teacher', token); try { sessionStorage.setItem('thi-gv-mk', pin); } catch { /* bỏ qua */ } try { sessionStorage.setItem('aisgk-presence-gv-ticket', response.fb_token || ''); } catch { /* bỏ qua */ } window.dispatchEvent(new CustomEvent('thi-gv-login', {detail: {token: response.fb_token || ''}}));
      loginForm.reset();
      updateAuth();
      ui.reset();
      if (!mustChangePin) {
        const parts = [['danh sách bài', refresh], ['bài học sinh đã nộp', results], ['báo cáo điểm yếu', loadAnalytics], ['danh sách đề kiểm tra', loadExams], ['khóa Gemini', loadGeminiKeys], ['hạn mức AI', loadAiUsage], ['danh sách học sinh', loadStudents]];
        const settled = await Promise.allSettled(parts.map(([, fn]) => fn()));
        const failed = parts.filter((_, i) => settled[i].status === 'rejected').map(([name]) => name);
        if (failed.length) notify(`Đã đăng nhập nhưng chưa tải được: ${failed.join(', ')}. Tải lại trang để thử lại.`, true);
      } else {
      }
    } catch (error) {
      const msg = mapErrorMessage(error);
      if (loginErr) {
        loginErr.textContent = msg;
      }
    }
  });
});

document.addEventListener('click', e => {
  const target = /** @type {HTMLElement|null} */ (e.target);
  const b = target?.closest('[data-reveal]');
  if (!b) return;
  const targetId = b.getAttribute('data-reveal');
  if (!targetId) return;
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById(targetId));
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.setAttribute('aria-label', (show ? 'Ẩn ' : 'Hiện ') + 'mã PIN');
  b.setAttribute('aria-pressed', String(show));
});

async function loadGeminiKeys() {
  if (!token) return;
  const captured = generation;
  const tbody = node('keys-tbody');
  const banner = node('pool-banner');
  try {
    const data = await api('/teacher/gemini-keys', { token });
    if (captured !== generation || !token) return;
    tbody.replaceChildren();

    const usable = (data.keys || []).filter(k => k.status === 'active').length;
    banner.hidden = usable > 0;
    banner.textContent = usable > 0 ? '' : 'Gia sư AI đang tạm dừng: bể khóa trống hoặc đã hết hạn mức. Thêm khóa mới bên dưới để học sinh dùng tiếp.';

    if (!data.keys || !data.keys.length) {
      tbody.append(el('tr', '', '', [el('td', 'Chưa có khóa nào trong bể. Hãy thêm khóa mới bên trên.', '', [], { colSpan: '5' })]));
      return;
    }
    for (const key of data.keys) {
      const tr = el('tr');
      const statusText = key.status === 'active' ? 'Hoạt động' : key.status === 'cooldown' ? 'Chờ hồi phục' : 'Hết hạn mức ngày';
      const statusClass = key.status === 'active' ? 'status-ok' : key.status === 'cooldown' ? 'status-wait' : 'status-out';
      tr.append(
        el('td', `...${key.key_suffix}`),
        el('td', key.note || '(Không ghi chú)'),
        el('td', '', '', [el('span', statusText, statusClass)]),
        el('td', `${key.daily_count || 0} / ${key.daily_limit || 1500}`),
        el('td', '', '', [
          ui.toIcon(/** @type {HTMLButtonElement} */ (button('Xóa', async () => {
            if (!await confirmBox({
              title: 'Xóa khóa API?',
              body: `Xóa khóa …${key.key_suffix}? Khóa này sẽ không còn dùng cho kết nối AI. Không thể hoàn tác.`,
              okText: 'Xóa khóa',
              danger: true
            })) return;
            try {
              await api(`/teacher/gemini-keys?id=${encodeURIComponent(key.id)}`, { method: 'DELETE', token });
              await loadGeminiKeys();
              notify('Đã xóa khóa khỏi bể.');
            } catch (err) {
              fail(err instanceof Error ? err : new Error('Chưa xóa được khóa.'));
            }
          })), 'trash', `Xóa khóa …${key.key_suffix}`, true)
        ])
      );
      tbody.append(tr);
    }
  } catch (err) {
    if (captured === generation) fail(err instanceof Error ? err : new Error('Chưa tải được danh sách khóa.'));
  }
}

node('add-key-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('add-key-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const formData = new FormData(formEl);
  try {
    await api('/teacher/gemini-keys', {
      method: 'POST',
      token,
      body: {
        api_key: String(formData.get('gemini_api_key')).trim(),
        note: String(formData.get('gemini_key_note')).trim()
      }
    });
    formEl.reset();
    await loadGeminiKeys();
    notify('Đã thêm khóa Gemini API vào bể thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa thêm được khóa.'));
  } finally {
    submit.disabled = false;
  }
});

{
  const matForm = /** @type {HTMLFormElement} */ (node('material-form'));
  const matId = /** @type {HTMLInputElement} */ (matForm.querySelector('[name=material_id]'));
  const matTitle = /** @type {HTMLInputElement} */ (matForm.querySelector('[name=material_title]'));
  /** @param {string} text */
  const slug = text => {
    const base = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tai-lieu';
    return `${base}-${Date.now().toString(36).slice(-4)}`;
  };
  matTitle.addEventListener('input', () => { if (matId.dataset.touched !== '1') matId.value = slug(matTitle.value); });
  matId.addEventListener('input', () => { matId.dataset.touched = '1'; });
  matForm.addEventListener('reset', () => { delete matId.dataset.touched; });
}
node('material-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('material-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const formData = new FormData(formEl);
  try {
    await api('/pwa/teacher/materials', {
      method: 'POST',
      token,
      body: {
        id: String(formData.get('material_id')).trim(),
        course_id: String(formData.get('material_course_id')).trim(),
        title: String(formData.get('material_title')).trim(),
        drive_url: String(formData.get('material_drive_url')).trim(),
        description: String(formData.get('material_desc')).trim()
      }
    });
    formEl.reset();
    notify('Đã đăng tải tài liệu Google Drive thành công.');
    await ui.showSub('list-materials');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa đăng tải được tài liệu.'));
  } finally {
    submit.disabled = false;
  }
});

on('refresh-keys', loadGeminiKeys);
/** Kiểm tra AI: gọi thử Gemini bằng từng khóa × mô hình, hiện mã lỗi + lý do để biết vì sao Gia sư / AI chấm báo lỗi. */
node('ai-check').addEventListener('click', async () => {
  const btn = /** @type {HTMLButtonElement} */ (node('ai-check')), out = node('ai-check-out');
  btn.disabled = true; btn.setAttribute('aria-busy', 'true'); out.textContent = 'Đang gọi thử AI…';
  try {
    const d = await api('/teacher/ai-check', { method: 'POST', token, body: {}, timeout: 60000 });
    const hint = (/** @type {any} */ r) => r.ok ? 'Chạy tốt' : /location is not supported|FAILED_PRECONDITION/i.test(r.ly_do || '') ? 'Google chặn vùng đặt máy chủ (cần đổi vị trí Worker)' : /API[_ ]?key not valid|API_KEY_INVALID/i.test(r.ly_do || '') ? 'Khóa sai hoặc đã bị xóa (tạo khóa mới ở AI Studio)' : r.ma === 429 ? 'Hết lượt (đợi hoặc thêm khóa khác)' : r.ma === 403 || r.ma === 401 ? 'Khóa bị từ chối (khóa sai, hết hạn, bị giới hạn trang web/IP, hoặc chưa bật Gemini API)' : r.ma === 404 ? 'Sai tên mô hình AI' : r.ma >= 500 ? 'Máy chủ AI quá tải / lỗi tạm thời' : r.ma === 0 ? (r.ly_do || 'Không có khóa') : 'Lỗi khác';
    const ok = (d.results || []).some((/** @type {any} */ r) => r.ok);
    const cell = (/** @type {string} */ label, /** @type {string} */ text, cls = '') => { const c = el('td', text, cls); c.dataset.label = label; return c; };
    const head = el('tr', '', '', ['Khóa', 'Mô hình', 'Mã', 'Kết luận', 'Chi tiết'].map(t => { const h = el('th', t); h.scope = 'col'; return h; }));
    const rows = (d.results || []).map((/** @type {any} */ r) => el('tr', '', '', [cell('Khóa', r.nguon), cell('Mô hình', r.mo_hinh), cell('Mã', String(r.ma || '—')), cell('Kết luận', hint(r), r.ok ? 'ai-ok' : 'ai-bad'), cell('Chi tiết', r.ly_do || (r.ok ? `${r.ms} ms` : ''))]));
    const tb = el('table', '', 't-table', [el('caption', ok ? 'AI đang chạy được (ít nhất một khóa + mô hình trả lời).' : 'AI ĐANG KHÔNG CHẠY: không khóa / mô hình nào trả lời được.'), el('thead', '', '', [head]), el('tbody', '', '', rows)]);
    const where = el('p', `Máy chủ AI đang gọi Google từ: ${d.noi_chay || 'không rõ'}${d.vao_tu ? ' · nhận yêu cầu tại: ' + d.vao_tu : ''}${/HKG|\/ HK/.test(d.noi_chay || '') ? ' (Hong Kong: Google không cho dùng Gemini)' : ''}`, 't-muted');
    const ag = d.agent ? el('p', d.agent.ok ? `Bộ não đa agent (VPS): đang chạy, phiên bản ${d.agent.version}, mô hình ${(d.agent.models || []).join(' → ')}, ${(d.agent.khoa || []).length} khóa. Chấm 24 giờ qua: ${d.agent.thong_ke?.cham_24h ?? 0} câu, cần giáo viên xem lại: ${d.agent.thong_ke?.can_xem_lai ?? 0}.` : `Bộ não đa agent (VPS): KHÔNG kết nối được — AI chấm đang dùng đường dự phòng (Gemini trực tiếp). Lý do: ${d.agent.ly_do || 'không rõ'}${d.agent.dia_chi ? ' · địa chỉ: ' + d.agent.dia_chi : ''}${d.agent.do_dai_khoa !== undefined ? ' · độ dài khóa ở Worker: ' + d.agent.do_dai_khoa + ' ký tự (đúng là 64)' : ''}`, d.agent.ok ? 'ai-ok' : 'ai-bad') : el('p', 'Bộ não đa agent (VPS): chưa cài (chưa đặt AGENT_URL).', 't-muted');
    out.replaceChildren(where, ag, tb);
  } catch (err) { out.textContent = err instanceof Error ? err.message : 'Chưa kiểm tra được.'; }
  finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
});

async function loadAiUsage() {
  if (!token) return;
  const captured = generation;
  const tbody = /** @type {HTMLTableSectionElement} */ (node('ai-usage-tbody'));
  try {
    const [settingsRes, statsRes] = await Promise.all([
      api('/teacher/ai-settings', { token }),
      api('/teacher/ai-stats', { token })
    ]);
    if (captured !== generation || !token) return;

    if (settingsRes && settingsRes.settings) {
      const defInput = /** @type {HTMLInputElement|null} */ (document.getElementById('ai-default-limit'));
      if (defInput && !defInput.matches(':focus')) {
        defInput.value = String(settingsRes.settings.default_limit ?? 10);
      }
      const examCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('ai-exam-mode'));
      if (examCheck) {
        examCheck.checked = Boolean(settingsRes.settings.exam_mode);
      }
    }

    tbody.replaceChildren();
    const stats = statsRes.stats || [];
    if (!stats.length) {
      tbody.append(el('tr', '', '', [el('td', 'Chưa có học sinh nào dùng gia sư hôm nay.', '', [], { colSpan: '5' })]));
      return;
    }

    for (const item of stats) {
      const tr = el('tr');
      const isLocked = Boolean(item.locked);
      const statusText = isLocked ? 'Đã khóa' : 'Hoạt động';
      const statusClass = isLocked ? 'status-out' : 'status-ok';
      tr.append(
        el('td', item.student_id),
        el('td', `${item.used} / ${item.limit}`),
        el('td', item.grant ? `+${item.grant}` : '0'),
        el('td', '', '', [el('span', statusText, statusClass)]),
        el('td', '', '', [
          ui.toIcon(/** @type {HTMLButtonElement} */ (button(isLocked ? 'Mở khóa' : 'Khóa', async () => {
            await api('/teacher/ai-lock', {
              method: 'POST',
              token,
              body: { student_id: item.student_id, locked: !isLocked }
            });
            await loadAiUsage();
            notify(isLocked ? `Đã mở khóa gia sư cho ${item.student_id}.` : `Đã tạm khóa gia sư với ${item.student_id}.`);
          })), isLocked ? 'unlock' : 'lock', `${isLocked ? 'Mở khóa' : 'Khóa'} gia sư của ${item.student_id}`),
          ui.toIcon(/** @type {HTMLButtonElement} */ (button('+5 lượt', async () => {
            await api('/teacher/ai-grant', {
              method: 'POST',
              token,
              body: { student_id: item.student_id, extra: 5 }
            });
            await loadAiUsage();
            notify(`Đã cộng 5 lượt hỏi gia sư cho ${item.student_id}.`);
          })), 'plus', `Cộng 5 lượt hỏi cho ${item.student_id}`)
        ])
      );
      tbody.append(tr);
    }
  } catch (err) {
    if (captured === generation) fail(err instanceof Error ? err : new Error('Chưa tải được thống kê dùng AI.'));
  }
}

node('ai-settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('ai-settings-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const formData = new FormData(formEl);
  try {
    await api('/teacher/ai-settings', {
      method: 'PUT',
      token,
      body: {
        default_limit: Number(formData.get('default_limit')) || 10,
        exam_mode: Boolean(formData.get('exam_mode'))
      }
    });
    quotaDirty = false;
    await loadAiUsage();
    notify('Đã lưu cài đặt gia sư thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa lưu được cài đặt gia sư.'));
  } finally {
    submit.disabled = false;
  }
});

on('refresh-ai-stats', loadAiUsage);

on('download-ai-csv', async () => {
  try {
    const res = await fetch(`${API_BASE}/teacher/ai-stats?format=csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Không thể tải tệp CSV.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_usage_stats_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify('Đã tải báo cáo CSV thành công.');
  } catch (err) {
    fail(err instanceof Error ? err : new Error('Chưa tải được báo cáo CSV.'));
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault(); const submit = /** @type {HTMLButtonElement} */ (form.querySelector('button[type=submit]')); submit.disabled = true;
  const captured = generation;
  try {await api('/pwa/teacher/publish', {method:'POST',token,body:documentValue()}); if (captured !== generation) return; lessonDirty = false; try {localStorage.removeItem(DRAFT_KEY);} catch {/* không có bộ nhớ */} await refresh(); if (captured === generation) {notify('Đã xuất bản. Học sinh nhận bản mới khi có mạng.'); await ui.showSub('list-lessons');}}
  catch (error) {if (captured === generation) fail(error instanceof Error ? error : new Error('Chưa xuất bản được.'));} finally {submit.disabled = false;}
});
on('teacher-logout', async () => {
  const oldToken = token; token = ''; mustChangePin = false; generation++; clearClassTeacher(); sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('thi-gv-mk'); sessionStorage.removeItem('aisgk-presence-gv-ticket'); try { localStorage.removeItem('aisgk-presence-gv'); } catch { /* bỏ qua */ } sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); updateAuth();
  form.reset(); lessonDirty = false; quotaDirty = false; try {localStorage.removeItem(DRAFT_KEY);} catch {/* không có bộ nhớ */} ui.reset(); node('question-editors').replaceChildren(); node('preview').replaceChildren(); node('teacher-results').replaceChildren(); node('published').replaceChildren(); node('lesson-list').replaceChildren(); allStudents = []; overviewRoster = null; overview.data = null; node('students-tbody').replaceChildren();
  if (oldToken) { try {await api('/teacher/logout', {method:'POST',token:oldToken});} catch {notify('Đã đăng xuất trên máy. Phiên máy chủ chưa xác nhận thu hồi.', true);} }
});
on('load-lesson', async () => {
  const value = /** @type {HTMLSelectElement} */ (node('published')).value;
  if (!value.includes('/')) {notify('Chọn bài cần chỉnh sửa.'); return;}
  const captured = generation; const document = await api(`/pwa/teacher/lesson/${value}`, {token}); if (captured === generation && token) {fill(document); lessonDirty = false; await ui.showSub('detail-lessons');}
});
on('preview-button', () => {renderMarkdown(node('preview'), field('content_markdown').value); document.getElementById('tab-lesson-theory')?.click(); document.getElementById('tab-theory-preview')?.click();});
on('add-question', () => addQuestion());
on('new-lesson', async () => {
  if (!(await leaveGuard())) return;
  form.reset(); node('question-editors').replaceChildren(); node('preview').replaceChildren(); lessonDirty = false;
  for (const tab of document.querySelectorAll('#tab-lesson-info')) /** @type {HTMLElement} */ (tab).click();
  /** @type {any} */ let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
  await ui.showSub('detail-lessons');
  if (draft && typeof draft.title === 'string' && Array.isArray(draft.questions) && await confirmBox({title: 'Khôi phục bản nháp?', body: 'Máy này có một bản nháp đã lưu. Khôi phục để soạn tiếp?', okText: 'Khôi phục'})) {
    fill(draft); lessonDirty = false;  return;
  }
  
});
form.addEventListener('input', () => {lessonDirty = true;});
on('act-lessons-draft', () => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(documentValue()));
    lessonDirty = false;
    notify('Đã lưu nháp trên máy này. Nháp sẽ bị xóa khi bạn đăng xuất.');
  } catch { notify('Không lưu được nháp trên máy này.', true); }
});
on('refresh-results', results);
on('refresh-analytics', loadAnalytics);
{
  const mode = document.getElementById('field-exam_mode'); const attempts = /** @type {HTMLInputElement|null} */ (document.getElementById('field-exam_attempts')); const hint = document.getElementById('exam-mode-hint');
  const apply = () => {
    const real = /** @type {HTMLSelectElement} */ (mode).value === 'real';
    if (hint) hint.textContent = real ? 'Thật: học sinh vào màn hình thi riêng, có giờ mở/đóng, đồng hồ và nộp một lần theo số lần cho phép.' : 'Thử: học sinh làm như bài luyện tập, làm được nhiều lần, không giới hạn giờ.';
    if (attempts) { attempts.disabled = !real; if (!real) attempts.value = '1'; }
  };
  if (mode) { mode.addEventListener('change', () => { apply(); if (/** @type {HTMLSelectElement} */ (mode).value === 'real') fillExamTimes(false); }); apply(); }
  for (const id of ['exam_open', 'exam_minutes']) document.getElementById(`field-${id}`)?.addEventListener('change', () => fillExamTimes(false));
}
/** Gợi ý giờ mở/đóng cho đề Thật: mở từ giờ tròn kế tiếp, đóng sau 1 ngày. Chỉ sửa giờ đóng khi đang trống hoặc không sau giờ mở. @param {boolean} force */
function fillExamTimes(force) {
  const open = examField('exam_open'); const close = examField('exam_close'); const minutes = Number(examField('exam_minutes').value) || 45;
  if (!examField('exam_minutes').value) examField('exam_minutes').value = String(minutes);
  if (force || !open.value) { const d = new Date(); d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0); open.value = localInput(d.getTime()); }
  const o = new Date(open.value).getTime();
  if (Number.isFinite(o) && (force || !close.value || new Date(close.value).getTime() <= o + minutes * 60000)) close.value = localInput(o + 24 * 3600000);
  setFieldError(open, ''); setFieldError(close, '');
}
/** @type {Array<any>} */
let allStudents = [];

const inFlight = new Set();
/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T|undefined>}
 */
async function guarded(key, fn) {
  if (inFlight.has(key)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
  inFlight.add(key);
  const sid = key.split(':')[1];
  const row = document.querySelector(`[data-sid="${CSS.escape(sid)}"]`);
  row?.setAttribute('aria-busy', 'true');
  const actionBtns = row?.querySelectorAll('.t-icon-btn');
  actionBtns?.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
  try { return await fn(); } finally {
    inFlight.delete(key);
    row?.removeAttribute('aria-busy');
    actionBtns?.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });
  }
}

/** @type {Set<string>} */
const selectedStudents = new Set();
function updateBulkBar() {
  const bar = document.querySelector('[data-bulk]');
  const count = document.querySelector('[data-selection-count]');
  if (count) count.textContent = String(selectedStudents.size);
  if (bar) /** @type {HTMLElement} */ (bar).hidden = selectedStudents.size === 0;
}
document.getElementById('students-tbody')?.addEventListener('change', event => {
  const t = /** @type {HTMLInputElement|null} */ (event.target instanceof HTMLInputElement ? event.target : null);
  if (!t || t.dataset.action !== 'select-student' || !t.dataset.id) return;
  if (t.checked) selectedStudents.add(t.dataset.id); else selectedStudents.delete(t.dataset.id);
  updateBulkBar();
});
document.getElementById('field-student_search')?.addEventListener('input', () => renderStudentsTable());
/** @param {'lock'|'unlock'|'delete'} kind */
async function bulkAction(kind) {
  const ids = [...selectedStudents];
  if (!ids.length) return;
  const names = ids.map(id => allStudents.find(x => x.id === id)?.name || id);
  const label = {lock: 'Khóa', unlock: 'Mở khóa', delete: 'Xóa'}[kind];
  const preview = names.slice(0, 5).join(', ') + (names.length > 5 ? ` và ${names.length - 5} học sinh khác` : '');
  if (!await confirmBox({
    title: `${label} ${ids.length} học sinh?`,
    body: `${preview}. ${kind === 'delete' ? 'Thao tác xóa không thể hoàn tác.' : kind === 'lock' ? 'Các học sinh này sẽ không đăng nhập được.' : 'Các học sinh này sẽ đăng nhập lại được.'}`,
    okText: `${label} ${ids.length} học sinh`,
    danger: kind !== 'unlock'
  })) return;
  const key = 'bulk';
  if (inFlight.has(key)) return;
  inFlight.add(key);
  const buttons = document.querySelectorAll('[data-bulk] button');
  buttons.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
  let done = 0; let failed = 0;
  try {
    for (const id of ids) {
      try {
        if (kind === 'delete') await api(`/teacher/students/${id}`, {method: 'DELETE', token});
        else await api(`/teacher/students/${id}/lock`, {method: 'POST', token, body: {locked: kind === 'lock'}});
        done++; selectedStudents.delete(id);
      } catch (e) { failed++; if (isAuthError(e)) { fail(e); return; } }
    }
  } finally {
    inFlight.delete(key);
    buttons.forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });
  }
  await loadStudents();
  notify(failed ? `${label}: xong ${done}, chưa được ${failed} học sinh. Hãy thử lại những học sinh còn được chọn.` : `${label}: đã xong ${done} học sinh.`, failed > 0);
}
node('act-accounts-bulk-lock').addEventListener('click', () => { void bulkAction('lock'); });
node('act-accounts-bulk-unlock').addEventListener('click', () => { void bulkAction('unlock'); });
node('act-accounts-bulk-delete').addEventListener('click', () => { void bulkAction('delete'); });

/** Thông tin tài khoản hiện một lần trong hộp thoại (không lưu, không ghi nhật ký). */
async function showStudentPinBanner(id, pin, name) {
  const copy = await confirmBox({
    title: 'Thông tin tài khoản học sinh',
    body: `${name ? `Học sinh: ${name}\n` : ''}Mã học sinh: ${id}\nMã PIN: ${pin}\n\nMã PIN chỉ hiện một lần. Hãy sao chép hoặc ghi lại ngay.`,
    okText: 'Sao chép thông tin',
    cancelText: 'Đóng'
  });
  if (!copy) return;
  try {
    await navigator.clipboard.writeText(`Mã HS: ${id}\nMã PIN: ${pin}`);
    notify('Đã sao chép thông tin tài khoản.');
  } catch { notify('Chưa sao chép được. Hãy ghi lại thông tin trong lần hiện trước.', true); }
}

/** Danh sách đang hiển thị (theo lớp và ô tìm kiếm). */
function filteredStudents() {
  const filterVal = /** @type {HTMLSelectElement} */ (node('students-class-filter')).value;
  const query = String(/** @type {HTMLInputElement|null} */ (document.getElementById('field-student_search'))?.value || '').trim().toLowerCase();
  return allStudents.filter(s => (!filterVal || s.class_code === filterVal) && (!query || `${s.name} ${s.id}`.toLowerCase().includes(query)));
}
function renderStudentsTable() {
  node('students-table')?.removeAttribute('aria-busy');
  const tbody = /** @type {HTMLTableSectionElement} */ (node('students-tbody'));
  tbody.replaceChildren();
  const filterVal = /** @type {HTMLSelectElement} */ (node('students-class-filter')).value;
  const query = String(/** @type {HTMLInputElement|null} */ (document.getElementById('field-student_search'))?.value || '').trim().toLowerCase();
  const filtered = filteredStudents();
  const count = document.getElementById('students-count'); if (count) count.textContent = filtered.length === allStudents.length ? `${allStudents.length} học sinh` : `Hiện ${filtered.length}/${allStudents.length} học sinh`;
  for (const id of [...selectedStudents]) if (!allStudents.some(s => s.id === id)) selectedStudents.delete(id);

  if (filtered.length === 0) {
    const tr = el('tr');
    const td = el('td', 'Chưa có học sinh nào.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const s of filtered) {
    const tr = el('tr');
    tr.dataset.sid = s.id;
    /** @param {string} label @param {string|Node} content */
    const cell = (label, content) => {const td = el('td'); td.dataset.label = label; td.append(content); return td;};
    const pick = document.createElement('input'); pick.type = 'checkbox'; pick.dataset.action = 'select-student'; pick.dataset.id = s.id; pick.checked = selectedStudents.has(s.id);
    const pickLabel = el('label', '', 't-check t-select-row'); pickLabel.append(pick, el('span', `Chọn học sinh ${s.name}`, 'visually-hidden'));
    tr.append(
      cell('Chọn', pickLabel),
      cell('Mã học sinh', s.id),
      cell('Họ và tên', s.name),
      cell('Lớp', `${s.class_code} (khối ${s.grade})`),
      cell('Trạng thái', el('span', s.disabled ? 'Bị khóa' : 'Hoạt động', s.disabled ? 't-badge t-badge-error' : 't-badge'))
    );

    const tdActions = el('td'); tdActions.dataset.label = 'Thao tác';
    const editBtn = button('Sửa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      const res = await dialogBox({
        kind: 'prompt',
        title: 'Sửa học sinh',
        body: 'Cập nhật họ tên và lớp.',
        okText: 'Lưu',
        fields: [
          { name: 'name', label: 'Họ và tên', value: s.name, validate: v => v.length < 2 ? 'Họ và tên tối thiểu 2 ký tự.' : '' },
          { name: 'class_code', label: 'Mã lớp', value: s.class_code, validate: v => /^[A-Za-z0-9._-]{1,16}$/.test(v) ? '' : 'Mã lớp gồm chữ, số, tối đa 16 ký tự.' }
        ]
      });
      if (!res || typeof res !== 'object') return;
      const newName = res.name.trim();
      const newClass = res.class_code.trim().toUpperCase();
      if (newName === s.name && newClass === s.class_code) return;
      await guarded('s:' + s.id, async () => {
        try {
          await api(`/teacher/students/${s.id}`, {
            method: 'PATCH',
            token,
            body: { name: newName, class_code: newClass }
          });
          notify('Đã cập nhật thông tin học sinh.');
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa cập nhật được học sinh.'));
        }
      });
    });

    const resetPinBtn = button('Đặt lại PIN', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      if (!await confirmBox({
        title: 'Đặt lại mã PIN?',
        body: `Học sinh: ${s.name} (${s.id}). Mã PIN cũ sẽ không còn sử dụng được.`,
        okText: 'Đặt lại mã PIN',
        danger: true
      })) return;
      await guarded('s:' + s.id, async () => {
        try {
          const res = await api(`/teacher/students/${s.id}/reset-pin`, {
            method: 'POST',
            token,
            body: {}
          });
          void showStudentPinBanner(s.id, res.pin, s.name);
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa đặt lại được mã PIN.'));
        }
      });
    });

    const lockBtn = button(s.disabled ? 'Mở khóa' : 'Khóa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      const actionName = s.disabled ? 'mở khóa' : 'khóa';
      if (!await confirmBox({
        title: s.disabled ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?',
        body: `Học sinh: ${s.name} (${s.id}). ${s.disabled ? 'Học sinh sẽ có thể đăng nhập lại.' : 'Học sinh sẽ không thể đăng nhập.'}`,
        okText: s.disabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
        danger: !s.disabled
      })) return;
      await guarded('s:' + s.id, async () => {
        try {
          await api(`/teacher/students/${s.id}/lock`, {
            method: 'POST',
            token,
            body: { locked: !s.disabled }
          });
          notify(`Đã ${actionName} tài khoản học sinh.`);
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error(`Chưa ${actionName} được tài khoản.`));
        }
      });
    });

    const delBtn = button('Xóa', async () => {
      if (inFlight.has('s:' + s.id)) { notify('Đang xử lý học sinh này. Chờ hoàn tất.', true); return; }
      if (!await confirmBox({
        title: 'Xóa học sinh?',
        body: `Học sinh: ${s.name} (${s.id}). Thao tác xóa không thể hoàn tác.`,
        okText: 'Xóa học sinh',
        danger: true
      })) return;
      await guarded('s:' + s.id, async () => {
        try {
          await api(`/teacher/students/${s.id}`, {
            method: 'DELETE',
            token
          });
          notify('Đã xóa học sinh thành công.');
          await loadStudents();
        } catch (e) {
          fail(e instanceof Error ? e : new Error('Chưa xóa được học sinh.'));
        }
      });
    }, 'danger');

    const viewBtn = button('Xem', () => {
      void noticeBox({
        title: 'Thông tin học sinh',
        body: `Mã học sinh: ${s.id}\nHọ và tên: ${s.name}\nLớp: ${s.class_code} (khối ${s.grade})\nTrạng thái: ${s.disabled ? 'Bị khóa' : 'Hoạt động'}`
      });
    });
    const who = ` ${s.name}`;
    const group = el('div', '', 't-icon-actions');
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', `Thao tác với học sinh ${s.name}`);
    group.append(
      ui.toIcon(/** @type {HTMLButtonElement} */ (viewBtn), 'view', 'Xem chi tiết' + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (editBtn), 'edit', 'Sửa' + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (resetPinBtn), 'key', 'Đặt lại mã PIN' + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (lockBtn), s.disabled ? 'unlock' : 'lock', (s.disabled ? 'Mở khóa' : 'Khóa') + who),
      ui.toIcon(/** @type {HTMLButtonElement} */ (delBtn), 'trash', 'Xóa' + who, true)
    );
    tdActions.append(group);
    tr.append(tdActions);
    tbody.append(tr);
  }
  updateBulkBar();
}

async function loadStudents() {
  if (!token || mustChangePin) return;
  const tbody = /** @type {HTMLTableSectionElement} */ (node('students-tbody'));
  const filterSelect = /** @type {HTMLSelectElement} */ (node('students-class-filter'));
  const table = node('students-table');
  table.setAttribute('aria-busy', 'true');
  try {
    const students = await api('/teacher/students', { token });
    allStudents = Array.isArray(students) ? students : [];

    const classes = [...new Set(allStudents.map(s => s.class_code).filter(Boolean))].sort();
    const currentVal = filterSelect.value;
    filterSelect.replaceChildren();
    const allOpt = el('option', 'Tất cả các lớp');
    allOpt.value = '';
    filterSelect.append(allOpt);
    for (const c of classes) {
      const opt = el('option', `Lớp ${c}`);
      opt.value = c;
      filterSelect.append(opt);
    }
    filterSelect.value = currentVal;

    renderStudentsTable();
  } catch {
    table.removeAttribute('aria-busy');
    tbody.replaceChildren();
    const tr = el('tr');
    const td = el('td', 'Chưa tải được danh sách học sinh.');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
  }
}

node('add-student-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('add-student-form'));
  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  submit.disabled = true;
  const data = new FormData(formEl);
  const name = String(data.get('name') || '').trim();
  const grade = Number(data.get('grade')) || 6;
  const classCode = String(data.get('class_code') || '').trim();
  const pin = String(data.get('pin') || '').trim();
  const studentId = String(data.get('student_id') || '').trim();

  await withBusy(submit, 'Đang tạo học sinh…', async () => {
    try {
      const res = await api('/teacher/students', {
        method: 'POST',
        token,
        body: { student_id: studentId || undefined, name, grade, class_code: classCode, pin: pin || undefined }
      });
      formEl.reset();
      void showStudentPinBanner(res.id, res.pin, res.name);
      await loadStudents();
      await ui.showSub('list-accounts');
    } catch (e) {
      fail(e instanceof Error ? e : new Error('Chưa thêm được học sinh.'));
    }
  });
});


/* ---------- Excel tài khoản học sinh ---------- */
/** @param {unknown} v @param {boolean} [bold] */
const xcell = (v, bold = false) => typeof v === 'number' ? {value: v, type: Number, ...(bold ? {fontWeight: 'bold'} : {})} : {value: String(v ?? ''), ...(bold ? {fontWeight: 'bold'} : {})};
/** @param {string} s */
const asciiName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tat_ca';
async function downloadStudentTemplate() {
  await loadScript('./vendor/write-excel-file.min.js');
  const sample = studentTemplateRows();
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([
    {data: sample.students.map((row, i) => row.map(v => xcell(v, i === 0))), sheet: 'Học sinh', columns: [16, 28, 8, 10, 14].map(width => ({width})), stickyRowsCount: 1},
    {data: sample.guide.map((row, i) => row.map(v => xcell(v, i === 0))), sheet: 'Hướng dẫn', columns: [[110]].flat().map(width => ({width}))}
  ]).toFile('mau-hoc-sinh.xlsx');
}
async function exportStudents() {
  const list = filteredStudents();
  if (!list.length) { notify('Chưa có học sinh nào để xuất.', true); return; }
  await loadScript('./vendor/write-excel-file.min.js');
  const head = ['Mã học sinh', 'Họ và tên', 'Khối', 'Lớp', 'Trạng thái'].map(v => xcell(v, true));
  const rows = list.map(s => [s.id, s.name, s.grade, s.class_code, s.disabled ? 'Bị khóa' : 'Hoạt động'].map(v => xcell(v)));
  const cls = /** @type {HTMLSelectElement} */ (node('students-class-filter')).value;
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([{data: [head, ...rows], sheet: 'Học sinh', columns: [16, 28, 8, 10, 14].map(width => ({width})), stickyRowsCount: 1}]).toFile(`hoc_sinh_${asciiName(cls || 'tat_ca')}.xlsx`);
  notify(`Đã xuất ${list.length} học sinh. File không có mã PIN vì PIN được lưu dạng mã hóa; cần PIN mới thì dùng "Đặt lại PIN".`);
}
/** @type {import('./student-import.js').StudentRow[]} */ let studentImportRows = [];
/** @type {{id:string,name:string,class_code:string,pin:string}[]} */ let createdAccounts = [];
/** @param {File} file */
async function readStudentFile(file) {
  const target = node('student-import-preview'); const run = /** @type {HTMLButtonElement} */ (node('student-import-run'));
  const dl = /** @type {HTMLButtonElement} */ (node('student-import-download'));
  studentImportRows = []; createdAccounts = []; run.disabled = true; dl.hidden = true; run.textContent = 'Tạo tài khoản';
  target.replaceChildren(el('p', 'Đang kiểm tra file…', 't-muted ld-box'));
  if (!/\.xlsx$/i.test(file.name)) { target.replaceChildren(el('p', 'Chỉ nhận file .xlsx. Hãy dùng file tải từ "Tải mẫu Excel".', 'notice error')); return; }
  if (file.size > 2 * 1024 * 1024) { target.replaceChildren(el('p', 'File lớn hơn 2 MB. Hãy tách thành nhiều file.', 'notice error')); return; }
  /** @type {unknown[][]} */ let rows;
  try {
    await loadScript('./vendor/read-excel-file.min.js');
    // @ts-ignore thư viện nạp bằng thẻ script
    const result = await globalThis.readXlsxFile(file);
    rows = Array.isArray(result) && result.length && result[0] && !Array.isArray(result[0]) && result[0].data ? result[0].data : result;
  } catch (e) {
    target.replaceChildren(el('p', e instanceof Error && /Không tải được/.test(e.message) ? e.message : 'Không đọc được file. Hãy dùng file .xlsx tải từ mẫu, không đổi định dạng.', 'notice error')); return;
  }
  const parsed = parseStudentRows(rows);
  target.replaceChildren();
  if (parsed.fatal) { target.append(el('p', parsed.fatal, 'notice error')); if (!parsed.rows.length || parsed.rows.length > 300) return; }
  const bad = parsed.rows.length - parsed.ok;
  studentImportRows = parsed.rows;
  target.append(el('p', `Đọc được ${parsed.rows.length} dòng: ${parsed.ok} hợp lệ${bad ? `, ${bad} chưa đúng (sẽ bị bỏ qua, sửa trong file rồi tải lại nếu cần)` : ''}.`, bad ? 'notice error' : 'notice success'));
  target.append(studentPreviewTable(parsed.rows, null));
  run.disabled = parsed.ok === 0; run.textContent = parsed.ok ? `Tạo ${parsed.ok} tài khoản` : 'Tạo tài khoản';
}
/** @param {import('./student-import.js').StudentRow[]} rows @param {Map<number,{ok:boolean,error?:string,id?:string}>|null} outcome */
function studentPreviewTable(rows, outcome) {
  const table = el('table', '', 't-table t-student-result'); table.append(el('caption', 'Kết quả kiểm tra từng dòng'));
  const head = el('thead'); const hr = el('tr'); for (const name of ['Dòng', 'Mã học sinh', 'Họ và tên', 'Lớp', 'Kết quả']) { const th = el('th', name); th.scope = 'col'; hr.append(th); } head.append(hr);
  const body = el('tbody');
  rows.forEach((r, i) => {
    const tr = el('tr'); const out = outcome?.get(i);
    const cells = [[String(r.row), 'Dòng'], [out?.id || r.student_id || 'Tự sinh', 'Mã học sinh'], [r.name, 'Họ và tên'], [`${r.class_code} (khối ${Number.isFinite(r.grade) ? r.grade : '?'})`, 'Lớp']];
    for (const [value, label] of cells) { const td = el('td', value); td.dataset.label = label; tr.append(td); }
    const res = el('td'); res.dataset.label = 'Kết quả';
    const errors = r.errors.length ? r.errors : out && !out.ok ? [out.error || 'Chưa tạo được'] : [];
    res.append(errors.length ? el('span', errors.join('; '), 't-badge t-badge-error') : el('span', out ? 'Đã tạo' : 'Hợp lệ', 't-badge'));
    tr.append(res); body.append(tr);
  });
  table.append(head, body); return table;
}
async function runStudentImport() {
  const valid = studentImportRows.filter(r => !r.errors.length);
  if (!valid.length) return;
  const run = /** @type {HTMLButtonElement} */ (node('student-import-run'));
  await withBusy(run, 'Đang tạo tài khoản…', async () => {
    const res = await api('/teacher/students/import', {method: 'POST', token, body: {students: valid.map(r => ({student_id: r.student_id || undefined, name: r.name, grade: r.grade, class_code: r.class_code, pin: r.pin || undefined}))}});
    /** @type {Map<number,{ok:boolean,error?:string,id?:string}>} */ const outcome = new Map();
    createdAccounts = [];
    for (const item of res.results || []) {
      const row = valid[item.index]; const at = studentImportRows.indexOf(row);
      outcome.set(at, {ok: item.ok, error: item.error, id: item.id});
      if (item.ok) createdAccounts.push({id: item.id, name: item.name, class_code: item.class_code, pin: item.pin});
    }
    const target = node('student-import-preview'); target.replaceChildren();
    target.append(el('p', `Đã tạo ${res.created} tài khoản${res.failed ? `, ${res.failed} dòng chưa tạo được (xem cột Kết quả)` : ''}. Hãy tải danh sách có PIN ngay: PIN chỉ hiện một lần.`, res.failed ? 'notice error' : 'notice success'));
    target.append(studentPreviewTable(studentImportRows, outcome));
    run.disabled = true; studentImportRows = [];
    const dl = /** @type {HTMLButtonElement} */ (node('student-import-download')); dl.hidden = !createdAccounts.length;
    await loadStudents();
  });
}
async function downloadCreatedAccounts() {
  if (!createdAccounts.length) return;
  await loadScript('./vendor/write-excel-file.min.js');
  const head = ['Mã học sinh', 'Họ và tên', 'Lớp', 'Mã PIN'].map(v => xcell(v, true));
  const rows = createdAccounts.map(a => [a.id, a.name, a.class_code, a.pin].map(v => xcell(v)));
  // @ts-ignore thư viện nạp bằng thẻ script
  await globalThis.writeXlsxFile([{data: [head, ...rows], sheet: 'Tài khoản', columns: [16, 28, 10, 14].map(width => ({width})), stickyRowsCount: 1}]).toFile('tai-khoan-vua-tao.xlsx');
  notify('Đã tải danh sách tài khoản kèm PIN. Hãy giữ file này an toàn và chỉ phát cho đúng học sinh.');
}
/** @param {string} id @param {()=>Promise<void>} fn */
const wire = (id, fn) => document.getElementById(id)?.addEventListener('click', () => { fn().catch(e => notify(e instanceof Error ? e.message : 'Chưa thực hiện được.', true)); });
wire('act-accounts-template', downloadStudentTemplate); wire('act-accounts-template-2', downloadStudentTemplate);
wire('act-accounts-export', exportStudents); wire('student-import-run', runStudentImport); wire('student-import-download', downloadCreatedAccounts);
const studentFileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('field-student-file'));
studentFileInput?.addEventListener('change', () => { const f = studentFileInput.files?.[0]; if (f) readStudentFile(f).catch(e => notify(e instanceof Error ? e.message : 'Chưa đọc được file.', true)); });
document.getElementById('act-accounts-import')?.addEventListener('click', () => { if (studentFileInput) studentFileInput.value = ''; studentImportRows = []; createdAccounts = []; node('student-import-preview').replaceChildren(el('p', 'Chưa tải file.', 't-muted')); /** @type {HTMLButtonElement} */ (node('student-import-run')).disabled = true; node('student-import-download').hidden = true; });

node('students-class-filter')?.addEventListener('change', renderStudentsTable);
on('refresh-students', loadStudents);

node('teacher-must-change-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('teacher-must-change-form'));
  const errNode = node('teacher-must-change-error');
  errNode.hidden = true;

  const oldPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=old_pin]'));
  const newPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=new_pin]'));
  const confirmPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=confirm_pin]'));

  oldPinInput.addEventListener('input', () => setFieldError(oldPinInput, ''));
  newPinInput.addEventListener('input', () => setFieldError(newPinInput, ''));
  confirmPinInput.addEventListener('input', () => setFieldError(confirmPinInput, ''));

  const oldPin = oldPinInput.value.trim();
  const newPin = newPinInput.value.trim();
  const confirmPin = confirmPinInput.value.trim();

  if (!oldPin) {
    setFieldError(oldPinInput, 'Vui lòng nhập mã PIN hiện tại.');
    oldPinInput.focus();
    return;
  }
  if (newPin.length < 8) {
    setFieldError(newPinInput, 'Mã PIN tối thiểu 8 ký tự.');
    newPinInput.focus();
    return;
  }
  if (newPin !== confirmPin) {
    setFieldError(confirmPinInput, 'Mã PIN xác nhận không khớp.');
    confirmPinInput.focus();
    return;
  }
  if (newPin === oldPin) {
    setFieldError(newPinInput, 'Mã PIN mới phải khác mã cũ.');
    newPinInput.focus();
    return;
  }

  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  await withBusy(submit, 'Đang đổi mã PIN…', async () => {
    try {
      const res = await api('/teacher/change-pin', {
        method: 'POST',
        token,
        body: { old_pin: oldPin, new_pin: newPin }
      });
      token = res.token;
      sessionStorage.setItem('aisgk-pwa-teacher', token); window.dispatchEvent(new CustomEvent('thi-gv-repin', {detail: {oldPin, newPin}}));
      mustChangePin = false;
      sessionStorage.removeItem('aisgk-pwa-teacher-must-change');
      formEl.reset();
      updateAuth();
      ui.reset();
      await refresh(); await results(); await loadAnalytics(); await loadExams(); await loadGeminiKeys(); await loadAiUsage(); await loadStudents();
      notify('Đổi mã PIN giáo viên thành công. Đã mở khóa quyền quản trị.');
    } catch (e) {
      errNode.textContent = mapErrorMessage(e);
      errNode.hidden = false;
    }
  });
});

node('teacher-regular-change-pin-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (node('teacher-regular-change-pin-form'));
  const statusNode = node('teacher-change-pin-status');
  statusNode.textContent = '';
  statusNode.className = 'notice status';

  const oldPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=old_pin]'));
  const newPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=new_pin]'));
  const confirmPinInput = /** @type {HTMLInputElement} */ (formEl.querySelector('[name=confirm_pin]'));

  oldPinInput.addEventListener('input', () => setFieldError(oldPinInput, ''));
  newPinInput.addEventListener('input', () => setFieldError(newPinInput, ''));
  confirmPinInput.addEventListener('input', () => setFieldError(confirmPinInput, ''));

  const oldPin = oldPinInput.value.trim();
  const newPin = newPinInput.value.trim();
  const confirmPin = confirmPinInput.value.trim();

  if (!oldPin) {
    setFieldError(oldPinInput, 'Vui lòng nhập mã PIN hiện tại.');
    oldPinInput.focus();
    return;
  }
  if (newPin.length < 8) {
    setFieldError(newPinInput, 'Mã PIN tối thiểu 8 ký tự.');
    newPinInput.focus();
    return;
  }
  if (newPin !== confirmPin) {
    setFieldError(confirmPinInput, 'Mã PIN xác nhận không khớp.');
    confirmPinInput.focus();
    return;
  }
  if (newPin === oldPin) {
    setFieldError(newPinInput, 'Mã PIN mới phải khác mã cũ.');
    newPinInput.focus();
    return;
  }

  const submit = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  await withBusy(submit, 'Đang đổi mã PIN…', async () => {
    try {
      const res = await api('/teacher/change-pin', {
        method: 'POST',
        token,
        body: { old_pin: oldPin, new_pin: newPin }
      });
      token = res.token;
      sessionStorage.setItem('aisgk-pwa-teacher', token); window.dispatchEvent(new CustomEvent('thi-gv-repin', {detail: {oldPin, newPin}}));
      statusNode.textContent = 'Đã đổi mã PIN.';
      statusNode.className = 'notice success status';
      formEl.reset();
      notify('Đổi mã PIN giáo viên thành công.');
    } catch (e) {
      statusNode.textContent = mapErrorMessage(e);
      statusNode.className = 'notice error status';
    }
  });
});

/** Ô Mã giáo viên chỉ hiện khi chọn "Giáo viên lớp". */
function syncRole() {
  const gv = /** @type {HTMLInputElement|null} */ (document.querySelector('#teacher-login [name=role][value=gv]'))?.checked;
  const f = document.getElementById('teacher-code-field'); if (f) f.hidden = !gv;
  const lab = document.querySelector('label[for=teacher-pin]'); if (lab) lab.textContent = gv ? 'Mã PIN' : 'Mã PIN giáo viên';
}
document.querySelectorAll('#teacher-login [name=role]').forEach(r => r.addEventListener('change', () => { syncRole(); if (/** @type {HTMLInputElement} */ (r).checked && /** @type {HTMLInputElement} */ (r).value === 'gv') document.getElementById('teacher-code')?.focus(); }));
syncRole();
updateAuth();
if (!token && classTeacher()) setTimeout(() => document.getElementById('nav-sheetexam')?.click(), 0);   // mở lại trang: giáo viên lớp vào thẳng Thi
if (token && !mustChangePin) {
  const captured = generation;
  refresh().then(() => {
    if (captured === generation) {
      results();
      loadAnalytics().catch(fail);
      loadExams().catch(fail);
      loadGeminiKeys();
      loadAiUsage();
      loadStudents();
    }
  }).catch(error => {
    if (captured === generation) fail(error);
  });
}


// ==========================================
// ĐIỀU HƯỚNG VÀ BẢO VỆ THAY ĐỔI CHƯA LƯU (AGENTS.md J)
// Khung hiển thị: teacher-ui.js. Hồ sơ (đổi PIN, gia sư AI, khóa API) mở từ nút "Hồ sơ".
// ==========================================
/** @returns {Promise<boolean>} true nếu được phép rời màn hình hiện tại */
async function leaveGuard() {
  if (!lessonDirty && !quotaDirty) return true;
  const what = lessonDirty ? 'Bài học đang soạn' : 'Cài đặt gia sư';
  const ok = await confirmBox({
    title: 'Bỏ thay đổi chưa lưu?',
    body: `${what} chưa được lưu.`,
    okText: 'Bỏ thay đổi',
    danger: true
  });
  if (ok) {
    if (quotaDirty) { quotaDirty = false; /** @type {HTMLFormElement|null} */ (document.getElementById('ai-settings-form'))?.reset(); }
    lessonDirty = false;
  }
  return ok;
}
node('ai-settings-form').addEventListener('input', () => { quotaDirty = true; });
window.addEventListener('beforeunload', event => { if (lessonDirty || quotaDirty) { event.preventDefault(); } });
ui.init({guard: leaveGuard});

// Trang giáo viên dùng chung vài tệp với app học sinh (styles.css, thi-store.js, dom.js…) do service worker giữ.
// Có bản service worker mới đang chờ → bật ngay rồi tải lại trang MỘT lần, để giáo viên không chạy lẫn tệp cũ và mới.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;
    let done = false; const t0 = Date.now();
    const swap = () => {
      const w = reg.waiting; if (!w || !navigator.serviceWorker.controller) return;
      if (Date.now() - t0 > 15000) return;   // chỉ ngay lúc mở trang: không bao giờ tải lại giữa buổi luyện tập / chấm bài
      try { if (Date.now() - Number(sessionStorage.getItem('gv-sw-swap') || 0) < 60000) return; sessionStorage.setItem('gv-sw-swap', String(Date.now())); } catch { /* bỏ qua */ }   // chống tải lại lặp
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!done) { done = true; location.reload(); } });
      w.postMessage({ type: 'ACTIVATE' });
    };
    swap();
    const watch = (/** @type {ServiceWorker|null} */ w) => w?.addEventListener('statechange', () => { if (w.state === 'installed') swap(); });
    watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
    void reg.update().catch(() => {});
  }).catch(() => {});
}
