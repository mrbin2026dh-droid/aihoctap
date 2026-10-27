// @ts-check
import { api, ApiError, verifyPackage, isLocalhostBackend } from './api.js';
import * as db from './db.js';
import { renderExamList, initExams } from './exam.js';
import * as fb from './fb.js';
import { el, button, notify, renderMarkdown, withBusy, setFieldError, mapErrorMessage, confirmBox, icon, withIcon} from './dom.js';

/** @typedef {import('./contracts').Lesson} Lesson */
/** @typedef {import('./contracts').Draft} Draft */
/** @typedef {import('./contracts').Outbox} Outbox */
/** @typedef {import('./contracts').Ack} Ack */
/** @typedef {{token:string,identity:import('./contracts').Identity}} Session */
/** @param {string} id */
function node(id) { const value = document.getElementById(id); if (!value) throw new Error(`Thiếu phần tử ${id}`); return value; }
/** @param {string} id */
function form(id) { return /** @type {HTMLFormElement} */ (node(id)); }
/** @type {Session|null} */ let session = null;
/** @type {import('./contracts').Catalog|null} */ let catalog = null;
/** @type {Lesson|null} */ let active = null;
/** @type {Draft|null} */ let draft = null;
// @ts-ignore
if (typeof window !== 'undefined') window.__testHook = { setDraft: (d) => { draft = d; } };
let practice = false;
let locked = false;
let saveChain = Promise.resolve();
let syncing = false;
let refreshing = false;
let refreshAgain = false;
let viewGeneration = 0;
let currentView = 'catalog';
let selectedCourse = '';
let gradeChosen = false;
/** @type {ServiceWorkerRegistration|null} */ let registration = null;
/** @type {string|null} */ let tutorQuestionId = null;
/** @type {Array<{role:string, content:string}>} */ let tutorHistory = [];
let tutorPending = false;
/** Bài học mà Gia sư đang hỗ trợ (có thể khác bài đang mở khi hỏi từ nút AI trên thanh đầu). @type {{course_id:string,lesson_id:string,title:string}|null} */
let tutorLesson = null;

function updateTutorStatus() {
  const isOnline = navigator.onLine;
  const askBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('ask-tutor'));
  if (askBtn) {
    askBtn.disabled = !isOnline;
    askBtn.title = isOnline ? 'Hỏi Gia sư Socrates AI' : 'Cần kết nối mạng để dùng Gia sư AI';
  }
  const offlineBanner = document.getElementById('tutor-offline-banner');
  if (offlineBanner) offlineBanner.hidden = isOnline;
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById('tutor-input'));
  if (input) input.disabled = !isOnline || tutorPending || !tutorLesson;
  const submit = /** @type {HTMLButtonElement|null} */ (document.getElementById('tutor-submit'));
  if (submit) submit.disabled = !isOnline || tutorPending || !tutorLesson;
}

async function refreshTutorQuota() {
  const badge = document.getElementById('tutor-quota-badge');
  if (!badge) return;
  if (!session || !navigator.onLine) {
    badge.textContent = '';
    return;
  }
  try {
    /** @type {{ used: number, limit: number, remaining: number, locked: boolean, exam_mode: boolean }} */
    const quota = await api('/pwa/ai-quota', { token: session.token });
    if (quota.exam_mode) {
      badge.textContent = 'Giờ thi';
      badge.className = 'tutor-quota-badge is-locked';
    } else if (quota.locked) {
      badge.textContent = 'Tạm khóa';
      badge.className = 'tutor-quota-badge is-locked';
    } else {
      badge.textContent = Number.isFinite(quota.remaining) ? `Còn ${quota.remaining} lượt` : '';
      badge.className = 'tutor-quota-badge';
    }
  } catch {
    badge.textContent = '';
  }
}

/** @param {{course_id:string,lesson_id:string,title:string}} lesson */
function setTutorLesson(lesson) {
  if (tutorLesson && (tutorLesson.course_id !== lesson.course_id || tutorLesson.lesson_id !== lesson.lesson_id)) tutorHistory = [];
  tutorLesson = lesson;
  node('tutor-context-note').textContent = lesson.title;
  if (!tutorHistory.length) {
    const msgs = node('tutor-messages'); msgs.replaceChildren();
    const greeting = el('div', '', 'tutor-msg tutor-bot');
    greeting.append(el('p', 'Chào em! Em đang vướng ở phần nào của bài? Hãy chia sẻ, mình sẽ gợi ý từng bước để em tự tìm ra đáp án.'));
    msgs.append(greeting);
  }
  updateTutorStatus();
}
function chooseTutorLesson() {
  tutorLesson = null; tutorHistory = [];
  node('tutor-context-note').textContent = 'Chọn bài để hỏi';
  const msgs = node('tutor-messages'); msgs.replaceChildren();
  const intro = el('div', '', 'tutor-msg tutor-bot'); intro.append(el('p', 'Em muốn hỏi về bài nào? Gia sư chỉ trả lời dựa trên nội dung bài học.')); msgs.append(intro);
  const grade = session?.identity.grade; const list = el('div', '', 'tutor-picks');
  for (const course of (catalog?.courses || []).filter(item => item.grade === grade)) for (const lesson of course.lessons) {
    list.append(button(lesson.title, () => setTutorLesson({course_id: course.id, lesson_id: lesson.id, title: lesson.title}), 'tutor-pick'));
  }
  if (!list.childElementCount) msgs.append(el('p', 'Chưa có bài học cho khối của em.', 'meta')); else msgs.append(list);
  updateTutorStatus();
}
/** @param {string|null} [questionId] */
function openTutor(questionId = null) {
  if (!session) { notify('Hãy đăng nhập để hỏi gia sư.', true); /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal(); return; }
  tutorQuestionId = questionId;
  const dialog = /** @type {HTMLDialogElement} */ (node('tutor-dialog'));
  if (active) {
    setTutorLesson({course_id: active.course_id, lesson_id: active.lesson_id, title: active.title});
    if (questionId) { const q = active.questions.find(item => item.id === questionId); node('tutor-context-note').textContent = q ? `Câu hỏi: ${q.prompt.slice(0, 40)}…` : active.title; }
  } else if (tutorLesson) setTutorLesson(tutorLesson);
  else chooseTutorLesson();
  updateTutorStatus();
  refreshTutorQuota().catch(() => {});
  dialog.showModal();
  if (tutorLesson) /** @type {HTMLInputElement} */ (node('tutor-input')).focus();
}

function closeTutor() {
  /** @type {HTMLDialogElement} */ (node('tutor-dialog')).close();
}


/** @param {Error} error */
function report(error) { if (error instanceof ApiError && error.status === 401) { void expireSession(); return; } notify(error.message, true); }
let expiring = false;
/** Token học sinh hết hạn sau 1 giờ: giữ nháp và bài chờ nộp, yêu cầu đăng nhập lại một lần. */
async function expireSession() {
  if (!session || expiring) return;
  expiring = true;
  const uid = session.identity?.uid || '';
  try {
    viewGeneration++;
    await saveDraft();
    session = null; active = null; draft = null; locked = false;
    await db.remove('meta', 'session'); fb.clear();
    identityUI(); renderCatalog(); show('catalog');
    const help = document.getElementById('login-help'); const normal = help?.textContent || '';
    if (help) { help.textContent = 'Phiên đăng nhập đã hết hạn. Bài làm vẫn được giữ. Nhập mã PIN để tiếp tục.'; const dlg = /** @type {HTMLDialogElement} */ (node('login-dialog')); dlg.addEventListener('close', () => { help.textContent = normal; }, {once: true}); }
    const code = /** @type {HTMLInputElement|null} */ (document.getElementById('student-code')); if (code) code.value = uid;
    const pin = /** @type {HTMLInputElement|null} */ (document.getElementById('student-pin')); if (pin) pin.value = '';
    /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal();
    pin?.focus();
  } finally { expiring = false; }
}
initExams({getToken: () => session?.token || null, getUid: () => session?.identity?.uid || '', onClose: () => {}});
window.addEventListener('aisgk:unauthorized', () => { void expireSession(); });
/** @param {string} id @param {(event:Event)=>void|Promise<void>} action */
function on(id, action) { node(id).addEventListener('click', event => { Promise.resolve(action(event)).catch(report); }); }
function clearTeacherSession() {
  try { sessionStorage.removeItem('aisgk-pwa-teacher'); sessionStorage.removeItem('aisgk-pwa-teacher-must-change'); } catch { /* bỏ qua */ }
}
function gateUI() {
  const gated = !session;
  if (session) clearTeacherSession();
  const teacherLink = document.querySelector('.teacher-link');
  if (teacherLink) /** @type {HTMLElement} */ (teacherLink).hidden = Boolean(session);
  document.body.classList.remove('booting');
  document.body.classList.toggle('is-gated', gated);
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = !gated;
}
function identityUI() {
  gateUI();
  node('login').hidden = Boolean(session);
  node('account').hidden = !session;
  const accountName = session ? session.identity.student_name || 'Tài khoản' : 'Tài khoản';
  node('account').setAttribute('aria-label', accountName); node('account').title = accountName;
  node('account-avatar').textContent = (accountName.trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase();
  node('logout').hidden = !session;
  const loginSection = document.getElementById('login-section');
  if (loginSection) loginSection.hidden = Boolean(session);
  const accountSection = document.getElementById('account-section');
  if (accountSection) accountSection.hidden = !session;
  node('login-form').hidden = Boolean(session);
  node('account-info').hidden = !session;
  node('account-info').textContent = session ? `${session.identity.student_name} · Lớp ${session.identity.class_code}` : '';
  const changePinForm = node('student-change-pin-form');
  if (changePinForm) changePinForm.hidden = !session;
  const mustChangeNotice = node('account-must-change');
  if (mustChangeNotice) mustChangeNotice.hidden = !(session && session.identity.must_change_pin);
  const openSettingsBtn = document.getElementById('open-settings');
  if (openSettingsBtn) openSettingsBtn.hidden = !session;
  if (session) /** @type {HTMLSelectElement} */ (node('grade')).value = String(session.identity.grade);
  /** @type {HTMLSelectElement} */ (node('grade')).disabled = Boolean(session);
  const syncEl = /** @type {HTMLButtonElement|null} */ (document.getElementById('sync')); if (syncEl) syncEl.disabled = !session || !navigator.onLine;
}
/** @param {string} name */
function show(name) {
  viewGeneration++;
  currentView = name;
  if (studentSettingsActive) {
    studentSettingsActive = false;
    renderStudentSettings(false);
  }
  for (const view of ['catalog', 'practice', 'lesson', 'downloads', 'progress', 'exams', 'materials', 'result']) node(`${view}-view`).hidden = view !== name;
  const destination = name === 'lesson' ? (practice ? 'practice' : 'catalog') : name === 'result' ? 'practice' : name;
  for (const tab of document.querySelectorAll('button[data-tab]')) {
    if (tab instanceof HTMLButtonElement && tab.dataset.tab === destination) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}
/** @param {string} text */
function fold(text) {return text.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');}
/** @param {HTMLElement} target @param {string} title @param {string} detail */
function empty(target, title, detail, name = 'inbox') {const card = el('div', '', 'empty-state'); const badge = el('span', '', 'empty-icon'); badge.append(icon(name)); card.append(badge, el('h2', title), el('p', detail)); target.append(card); return card;}
function gradeCourses() {return catalog?.courses.filter(course => course.grade === Number(/** @type {HTMLSelectElement} */ (node('grade')).value)) || [];}
function updateResume() {node('resume-card').hidden = !active || !session || !draft || locked; node('resume-title').textContent = active?.title || '';}
/** @param {import('./contracts').Course} course @param {import('./contracts').LessonSummary} summary @param {boolean} [exerciseOnly] */
function lessonRow(course, summary, exerciseOnly = false) {
  const row = el('article', '', 'lesson-card'); const description = el('div', '', 'lesson-description');
  const tile = el('span', '', exerciseOnly ? 'tile tone-amber' : 'tile tone-blue'); tile.append(icon(exerciseOnly ? 'pencil' : 'book'));
  const chip = el('span', '', 'chip'); chip.append(icon('list', 'ic ic-sm'), el('span', `${summary.question_count} câu luyện tập`));
  description.append(el('p', `${course.subject_name} · Lớp ${course.grade}`, 'meta'), el('h3', summary.title), chip);
  const entry = withIcon(button(exerciseOnly ? 'Luyện tập' : 'Mở bài', () => loadLesson(course.id, summary.id, summary.version, exerciseOnly), 'lesson-open'), 'arrow', true);
  entry.dataset.lessonId = summary.id; entry.dataset.courseId = course.id;
  row.append(tile, description, entry); return row;
}
function renderCatalog() {
  updateResume();
  const courses = node('courses'); courses.replaceChildren(); node('lesson-list').replaceChildren();
  if (!catalog) {
    node('catalog-view').setAttribute('aria-busy', 'true');
    courses.append(el('div', '', 'course-skeleton'));
    for (let index = 0; index < 3; index++) {const skeleton = el('div', '', 'lesson-skeleton'); skeleton.setAttribute('aria-hidden', 'true'); node('lesson-list').append(skeleton);}
    node('catalog-summary').textContent = 'Đang tải danh mục';
    return;
  }
  node('catalog-view').removeAttribute('aria-busy');
  const select = /** @type {HTMLSelectElement} */ (node('grade'));
  if (catalog && !session && !gradeChosen && !gradeCourses().length && catalog.courses.length) select.value = String(catalog.courses[0].grade);
  for (const option of select.options) {
    const count = catalog?.courses.filter(course => course.grade === Number(option.value)).reduce((sum, course) => sum + course.lessons.length, 0) || 0;
    option.textContent = `Lớp ${option.value}${catalog ? (count ? ` · ${count} bài` : ' · Chưa có bài') : ''}`;
  }
  const filtered = gradeCourses();
  const count = filtered.reduce((sum, course) => sum + course.lessons.length, 0);
  node('catalog-summary').textContent = `${filtered.length} môn học · ${count} bài học`;
  if (!filtered.some(course => course.id === selectedCourse)) selectedCourse = '';
  for (const course of filtered) {
    const card = el('article', '', 'course-card'); const ctile = el('span', '', 'tile tone-blue'); ctile.append(icon('folder')); card.append(ctile, el('p', `${course.lessons.length} bài học`, 'meta'), el('h2', course.subject_name));
    const open = button(`Học ${course.subject_name}`, async () => {
      viewGeneration++;
      await saveDraft();
      selectedCourse = course.id; renderCatalog();
    });
    withIcon(open, 'arrow', true); open.setAttribute('aria-pressed', String(selectedCourse === course.id));
    open.dataset.courseId = course.id; card.append(open); courses.append(card);
  }
  const list = node('lesson-list');
  if (!filtered.length) {
    const card = empty(list, `Chưa có bài cho Lớp ${select.value}`, 'Giáo viên chưa xuất bản nội dung cho khối này.');
    if (!session) for (const grade of new Set(catalog.courses.map(course => course.grade))) card.append(button(`Xem bài Lớp ${grade}`, () => {select.value = String(grade); gradeChosen = true; selectedCourse = ''; renderCatalog();}));
    else card.append(el('p', 'Em hãy liên hệ giáo viên để nhận bài học.'));
    if (currentView === 'catalog') notify(`Lớp ${select.value} chưa có bài xuất bản.`);
    document.body.classList.remove('is-loading');
    return;
  }
  const query = fold(/** @type {HTMLInputElement} */ (node('search')).value.trim());
  list.append(el('h2', query ? 'Kết quả tìm kiếm' : 'Bài học dành cho em', 'section-title'));
  let found = 0;
  for (const course of filtered) if (!selectedCourse || course.id === selectedCourse) for (const summary of course.lessons) {
    if (query && !fold(`${course.subject_name} ${summary.title}`).includes(query)) continue;
    list.append(lessonRow(course, summary)); found++;
  }
  if (!found) {const card = empty(list, 'Không tìm thấy bài học', 'Thử tên khác hoặc xóa từ khóa tìm kiếm.'); card.append(button('Xóa tìm kiếm', () => {/** @type {HTMLInputElement} */ (node('search')).value = ''; selectedCourse = ''; renderCatalog();}));}
  if (currentView === 'catalog') notify(navigator.onLine ? 'Bài học đã sẵn sàng. Chọn bài để học.' : 'Đang mất mạng. Mở mục Đã tải để học offline.');
  updateResume();
  document.body.classList.remove('is-loading');
}
function renderPractice() {
  const target = node('practice-list'); target.replaceChildren();
  for (const course of gradeCourses()) for (const summary of course.lessons) if (summary.question_count) target.append(lessonRow(course, summary, true));
  if (!target.childElementCount) {const card = empty(target, 'Chưa có bài tập cho khối này', 'Bài tập xuất hiện khi giáo viên xuất bản.'); card.append(button('Về môn học', () => show('catalog')));}
}
/** @param {string} detail */
function catalogUnavailable(detail) {
  document.body.classList.remove('is-loading'); node('catalog-view').removeAttribute('aria-busy');
  node('courses').replaceChildren(); const target = node('lesson-list'); target.replaceChildren();
  node('catalog-summary').textContent = 'Chưa có danh mục trên máy';
  const card = empty(target, 'Chưa tải được danh mục', detail);
  card.append(button('Thử tải lại', async () => {
    if (!navigator.onLine) {notify('Kết nối mạng để tải danh mục lần đầu.', true); return;}
    document.body.classList.add('is-loading'); renderCatalog(); await refreshCatalog();
  }, 'primary'));
}
async function refreshCatalog() {
  if (!navigator.onLine) return;
  if (refreshing) {refreshAgain = true; return;}
  refreshing = true;
  try {
    const next = /** @type {import('./contracts').Catalog} */ (await api('/pwa/catalog'));
    if (next.schema_version !== 1 || !Array.isArray(next.courses)) throw new Error('Danh mục chưa được hỗ trợ.');
    const changed = next.revision !== catalog?.revision;
    await db.put('meta', 'catalog', next); catalog = next;
    if (changed) {renderCatalog(); if (currentView === 'practice') renderPractice();}
  } catch (error) { if (!catalog) {catalogUnavailable('Chưa kết nối được máy chủ. Em có thể thử lại.'); report(error instanceof Error ? error : new Error('Chưa tải được danh mục.'));} }
  finally {
    refreshing = false;
    if (refreshAgain) {refreshAgain = false; refreshCatalog().catch(report);}
  }
}
/** @param {string} courseId @param {string} lessonId @param {string} version @param {boolean} [exerciseOnly] */
async function loadLesson(courseId, lessonId, version, exerciseOnly = false) {
  const generation = ++viewGeneration;
  const owner = session;
  await saveDraft();
  const uid = owner?.identity.uid;
  const saved = uid ? (await db.all('drafts')).find(item => item.uid === uid && item.lesson.course_id === courseId && item.lesson.lesson_id === lessonId) : null;
  if (generation !== viewGeneration || owner !== session) return;
  if (saved) { await openLesson(saved.lesson, saved, generation, owner, exerciseOnly); return; }
  const key = `${courseId}/${lessonId}/${version}`;
  let lesson = /** @type {Lesson|undefined} */ (await db.get('packages', key));
  if (!lesson) lesson = /** @type {Lesson} */ (await api(`/pwa/lessons/${courseId}/${lessonId}/${version}`));
  if (generation !== viewGeneration || owner !== session) return;
  await verifyPackage(lesson);
  await openLesson(lesson, null, generation, owner, exerciseOnly);
}
/** @param {Lesson} lesson @param {Draft|null} [saved] @param {number} [generation] @param {Session|null} [owner] @param {boolean} [exerciseOnly] */
async function openLesson(lesson, saved = null, generation = ++viewGeneration, owner = session, exerciseOnly = practice) {
  await verifyPackage(lesson);
  if (generation !== viewGeneration || owner !== session) return;
  let nextDraft = saved;
  let nextLocked = false;
  /** @type {Outbox|undefined} */ let pending;
  if (owner) {
    const key = db.draftKey(owner.identity.uid, lesson);
    nextDraft = saved || /** @type {Draft|undefined} */ (await db.get('drafts', key)) || {
      key, uid: owner.identity.uid, lesson, answers: {}, attempt_id: crypto.randomUUID(), updated_at: Date.now()
    };
    pending = /** @type {Outbox|undefined} */ (await db.get('outbox', `${nextDraft.uid}/${nextDraft.attempt_id}`));
    if (generation !== viewGeneration || owner !== session) return;
    await db.put('meta', `active:${owner.identity.uid}`, {key, practice:exerciseOnly});
    if (pending?.ack || pending?.rejected) {
      // Bài trước đã nộp xong: bắt đầu lượt mới (luyện tập làm lại không giới hạn). Kết quả xem ở Tiến độ.
      await db.remove('drafts', key);
      nextDraft = {key, uid: owner.identity.uid, lesson, answers: {}, attempt_id: crypto.randomUUID(), updated_at: Date.now()};
      pending = undefined;
    }
    nextLocked = Boolean(pending);
  }
  if (generation !== viewGeneration || owner !== session) return;
  active = lesson; draft = nextDraft; locked = nextLocked; practice = exerciseOnly;
  tutorHistory = [];
  tutorQuestionId = null;
  const tutorMsgs = document.getElementById('tutor-messages');
  if (tutorMsgs) tutorMsgs.replaceChildren();
  updateTutorStatus();
  show('lesson');
  node('lesson-title').textContent = lesson.title;
  node('lesson-subject').textContent = catalog?.courses.find(course => course.id === lesson.course_id)?.title || lesson.course_id;
  node('lesson-version').textContent = `Phiên bản ${lesson.version.slice(0, 8)}`;
  renderMarkdown(node('lesson-content'), lesson.content_markdown);
  node('result').replaceChildren(); renderQuestions(); setPractice(practice);
  if (pending) node('result').append(el('p', 'Chờ máy chủ xác nhận. Bài nộp được giữ trên máy.', 'inline-note'));
  updateResume();
  notify(navigator.onLine ? 'Bài học đã sẵn sàng.' : 'Đang học từ bài đã lưu trên máy.');
}
function renderQuestions() {
  const questions = node('questions'); questions.replaceChildren();
  for (const question of active?.questions || []) {
    const fieldset = el('fieldset', '', 'question'); fieldset.disabled = locked;
    fieldset.append(el('legend', question.prompt));
    if (question.kind === 'text') {
      const label = el('label', 'Câu trả lời của em');
      const input = el('textarea'); input.name = question.id; input.required = true; input.maxLength = 10000;
      input.value = draft?.answers[question.id] || ''; label.append(input); fieldset.append(label);
    } else {
      for (const [value, text] of Object.entries(question.options)) {
        const label = el('label', '', 'option'); const input = el('input');
        input.type = 'radio'; input.name = question.id; input.value = value; input.required = true;
        input.checked = draft?.answers[question.id] === value;
        label.append(input, document.createTextNode(`${value}. ${text}`)); fieldset.append(label);
      }
    }
    if (question.hint) {
      const details = el('details'); details.append(el('summary', 'Xem gợi ý'), el('p', question.hint, 'hint')); fieldset.append(details);
    }
    const tutorBtn = button('Hỏi gợi ý AI', () => openTutor(question.id), 'question-tutor-btn');
    tutorBtn.dataset.questionId = question.id;
    fieldset.append(tutorBtn);
    questions.append(fieldset);
  }
  /** @type {HTMLButtonElement} */ (form('question-form').querySelector('button[type=submit]')).disabled = locked || !active?.questions.length;
  updateAnswerCount();
}
/** @param {boolean} value */
function setPractice(value) {
  practice = value; node('question-form').hidden = !value; node('lesson-content').hidden = value;
  node('read-lesson').setAttribute('aria-pressed', String(!value)); node('practice-lesson').setAttribute('aria-pressed', String(value));
  node('practice-help').hidden = !value;
  node('practice-help').textContent = session ? (locked ? 'Bài đã khóa để giữ nguyên nội dung nộp.' : 'Câu trả lời được lưu nháp trên máy.') : 'Em có thể luyện tập. Đăng nhập để lưu nháp và nộp bài.';
  if (!active?.questions.length) node('practice-help').textContent = 'Bài này chưa có câu luyện tập. Em có thể đọc bài học.';
  if (currentView === 'lesson') for (const tab of document.querySelectorAll('button[data-tab]')) {
    if (/** @type {HTMLButtonElement} */ (tab).dataset.tab === (value ? 'practice' : 'catalog')) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  }
  updateAnswerCount();
}
function updateAnswerCount() {
  const answers = locked && draft ? draft.answers : Object.fromEntries(new FormData(form('question-form')).entries());
  const answered = Object.values(answers).filter(value => String(value).trim()).length;
  node('answer-count').textContent = `${answered}/${active?.questions.length || 0} câu đã trả lời`;
  node('answer-count').parentElement?.style.setProperty('--p', String(active?.questions.length ? Math.round(100 * answered / active.questions.length) : 0) + '%');
}
/** @param {string} label @param {string} value @param {string} iconName @param {string} [tone] */
function statTile(label, value, iconName, tone = 'teal') {
  const tile = el('div', '', `stat-tile tone-${tone}`);
  const head = el('span', '', 'stat-ic'); head.append(icon(iconName));
  tile.append(head, el('strong', value, 'stat-value'), el('span', label, 'stat-label'));
  return tile;
}
/** @param {Ack} ack */
async function showResult(ack) {
  show('result');
  const target = node('result-view'); target.replaceChildren();
  const pct = ack.total ? Math.round(100 * ack.correct / ack.total) : 0;
  const level = pct >= 90 ? ['Xuất sắc', 'Em nắm rất vững bài này.'] : pct >= 70 ? ['Khá tốt', 'Em đã hiểu phần lớn bài học.'] : pct >= 50 ? ['Cần ôn thêm', 'Hãy đọc lại bài rồi làm lại.'] : ['Cố lên', 'Hãy đọc lại bài học, sau đó làm lại nhé.'];
  const queue = /** @type {Outbox[]} */ (await db.all('outbox'));
  const same = queue.filter(item => item.uid === session?.identity.uid && item.ack && item.ack.course_id === ack.course_id && item.ack.lesson_id === ack.lesson_id).map(item => /** @type {Ack} */ (item.ack));
  const tries = Math.max(same.length, 1);
  const best = Math.max(Number(ack.score) || 0, ...same.map(item => Number(item.score) || 0));
  const head = el('div', '', 'page-heading'); const h1 = el('h1', 'Kết quả'); h1.id = 'result-title'; h1.tabIndex = -1;
  head.append(h1, el('p', lessonTitle(ack)));
  const hero = el('section', '', 'result-hero');
  const ring = el('div', '', 'score-ring'); ring.style.setProperty('--p', pct + '%'); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `${pct} phần trăm`);
  ring.append(el('strong', pct + '%'));
  const text = el('div', '', 'result-text'); text.append(el('h2', level[0]), el('p', `${ack.correct}/${ack.total} câu đúng`, 'result-count'), el('p', level[1], 'meta'));
  if (ack.needs_review) text.append(el('p', 'Có câu tự luận đang chờ giáo viên xem.', 'meta'));
  hero.append(ring, text);
  const tiles = el('div', '', 'stat-grid');
  tiles.append(statTile('Điểm', ack.score == null ? '–' : `${ack.score}/10`, 'target', 'teal'), statTile('Lần làm', String(tries), 'repeat', 'blue'), statTile('Cao nhất', `${best}/10`, 'trophy', 'amber'));
  const actions = el('div', '', 'result-actions');
  actions.append(
    withIcon(button('Làm lại', async () => {
      if (!draft || !active) return;
      const owner = session; const lesson = active; const generation = ++viewGeneration;
      await db.remove('drafts', draft.key);
      if (owner !== session || generation !== viewGeneration) return;
      draft = null; await openLesson(lesson, null, generation, owner, true); await saveDraft();
    }, 'primary'), 'refresh'),
    withIcon(button('Xem bài', async () => { if (active) { practice = false; await openLesson(active, null, ++viewGeneration, session, false); } }), 'book'),
    withIcon(button('Tổng quan', () => { progress().catch(report); }), 'chart'));
  target.append(head, hero, tiles, actions);
  window.scrollTo(0, 0);
  h1.focus({preventScroll: true});
}
function saveDraft() {
  if (!session || !active || !draft || locked) return saveChain;
  const snapshot = {...draft, answers: Object.fromEntries(new FormData(form('question-form')).entries()), updated_at: Date.now()};
  // Capture UID, lesson and state before asynchronous storage or account changes.
  const view = practice; draft = /** @type {Draft} */ (snapshot);
  const write = async () => {
    await db.put('drafts', snapshot.key, snapshot);
    await db.put('meta', `active:${snapshot.uid}`, {key: snapshot.key, practice: view});
    if (session?.identity.uid === snapshot.uid && draft?.key === snapshot.key) node('draft-status').textContent = 'Đã lưu nháp trên máy.';
  };
  saveChain = saveChain.catch(report).then(write);
  return saveChain;
}
async function submit() {
  if (!session) { /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal(); return; }
  const owner = session;
  const generation = viewGeneration;
  await saveDraft();
  if (!draft || !active || locked || session !== owner || generation !== viewGeneration) return;
  const item = {key: `${draft.uid}/${draft.attempt_id}`, uid: draft.uid,
    body: {attempt_id: draft.attempt_id, course_id: active.course_id, lesson_id: active.lesson_id, version: active.version, answers: {...draft.answers}}, created_at: Date.now()};
  await db.put('outbox', item.key, item);
  if (session !== owner || generation !== viewGeneration) return;
  locked = true; renderQuestions();
  notify('Chờ đồng bộ bài nộp. Bài đã được giữ trên máy.');
  if (navigator.onLine) await sync();
}
async function sync() {
  if (syncing || !session || !navigator.onLine) return;
  const captured = session;
  syncing = true;
  try {
    const queue = /** @type {Outbox[]} */ (await db.all('outbox'));
    for (const item of queue.filter(entry => entry.uid === captured.identity.uid && !entry.ack && !entry.rejected)) {
      if (session !== captured) break;
      try {
        const ack = /** @type {Ack} */ (await api('/pwa/attempts', {method:'POST', token:captured.token, body:item.body}));
        if (ack.status !== 'submitted' || ack.attempt_id !== item.body.attempt_id || (ack.version != null && ack.version !== item.body.version)) throw new Error('Máy chủ chưa xác nhận đúng bài nộp.');
        await db.put('outbox', item.key, {...item, ack, error: undefined});
        if (session !== captured) continue;
        notify('Đã nộp bài. Máy chủ đã xác nhận.');
        if (draft?.attempt_id === ack.attempt_id) void showResult(ack);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          // Máy chủ từ chối hẳn (ví dụ bài kiểm tra chỉ được nộp 1 lần): không thử lại, không chặn các bài khác.
          await db.put('outbox', item.key, {...item, rejected: error.message, error: undefined});
          if (draft?.attempt_id === item.body.attempt_id) { await db.remove('drafts', draft.key); locked = false; if (active) await openLesson(active, null, ++viewGeneration, captured, practice); }
          if (session === captured) notify(error.message, true);
          continue;
        }
        await db.put('outbox', item.key, {...item, error: error instanceof Error ? error.message : 'Đồng bộ chưa xong.'});
        if (session === captured) {
          if (error instanceof ApiError && error.status === 401) { void expireSession(); }
          else report(error instanceof Error ? error : new Error('Chưa đồng bộ được bài.'));
        }
        break;
      }
    }
  } finally { syncing = false; if (session && session !== captured) sync().catch(report); }
}
async function downloads() {
  show('downloads'); const target = node('downloads'); target.replaceChildren();
  const generation = viewGeneration;
  const packages = /** @type {Lesson[]} */ (await db.all('packages'));
  if (generation !== viewGeneration) return;
  for (const lesson of packages) {
    const row = el('article', '', 'download-card'); row.append(el('h2', lesson.title), el('p', `Phiên bản ${lesson.version.slice(0,8)}`, 'meta'));
    const open = button('Mở bài', async () => {
      const generation = ++viewGeneration; const owner = session;
      await saveDraft(); await openLesson(lesson, null, generation, owner);
    });
    open.dataset.lessonId = lesson.lesson_id; row.append(open); target.append(row);
    row.append(button('Xóa bản tải', async () => {
      await db.remove('packages', db.packageKey(lesson));
      if (currentView === 'downloads') await downloads();
      notify('Đã xóa bản tải. Nháp và bài nộp vẫn được giữ.');
    }, 'text-button'));
  }
  if (!packages.length) {const card = empty(target, 'Chưa tải bài nào', 'Chọn bài và bấm Tải bài khi có mạng.'); card.append(button('Chọn bài để tải', () => show('catalog'), 'primary'));}
}
const MASTERED_PERCENT = 80;
const REVIEW_PERCENT = 50;
const DAY_MS = 86400000;
/** @param {number} stamp */
function dayStart(stamp) { const day = new Date(stamp); day.setHours(0, 0, 0, 0); return day.getTime(); }
/** @param {number} stamp */
function dateLabel(stamp) {
  const diff = Math.round((dayStart(Date.now()) - dayStart(stamp)) / DAY_MS);
  if (diff <= 0) return 'Hôm nay'; if (diff === 1) return 'Hôm qua';
  const day = new Date(stamp); return `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
}
/** @param {Ack} item */
function percentOf(item) { return item.total ? Math.round(100 * item.correct / item.total) : 0; }
async function progress() {
  show('progress'); const syncButton = node('sync'); node('progress-view').prepend(syncButton); const target = node('progress'); target.replaceChildren();
  const generation = viewGeneration;
  if (!session) {const card = empty(target, 'Tổng quan học tập', 'Đăng nhập để xem tiến độ và lộ trình của em.', 'chart'); card.append(button('Đăng nhập', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal(), 'primary')); return;}
  const captured = session;
  const queue = /** @type {Outbox[]} */ (await db.all('outbox'));
  let attempts = queue.filter(item => item.uid === captured.identity.uid && item.ack).map(item => /** @type {Ack} */ (item.ack));
  let fresh = false;
  /** @type {{course_id:string,lesson_id:string,lesson_title:string,topic:string,correct:number,total:number,percent:number}[]} */
  let review = [];
  if (navigator.onLine) {
    try { const data = await api('/pwa/progress', {token:captured.token}); attempts = data.attempts; review = Array.isArray(data.review) ? data.review : []; fresh = true; }
    catch (error) { if (session === captured) report(error instanceof Error ? error : new Error('Chưa tải được tiến độ.')); }
  }
  if (session !== captured || generation !== viewGeneration) return;
  const rejected = queue.filter(item => item.uid === captured.identity.uid && !item.ack && item.rejected);
  const waiting = queue.filter(item => item.uid === captured.identity.uid && !item.ack && !item.rejected);
  const name = String(captured.identity.student_name || '').trim().split(/\s+/).pop() || 'em';
  // Gom theo bài: chỉ tính các lượt đã được máy chủ xác nhận.
  /** @type {Map<string,{count:number,best:number,last:Ack}>} */
  const stats = new Map(); let sumCorrect = 0; let sumTotal = 0;
  for (const item of attempts) {
    const key = `${item.course_id}/${item.lesson_id}`; const row = stats.get(key) || {count: 0, best: 0, last: item};
    row.count += 1; row.best = Math.max(row.best, percentOf(item)); if ((Number(item.submitted_at) || 0) >= (Number(row.last.submitted_at) || 0)) row.last = item;
    stats.set(key, row); sumCorrect += item.correct; sumTotal += item.total;
  }
  const courses = (catalog?.courses || []).filter(course => course.grade === captured.identity.grade);
  /** @type {{course:import('./contracts').Course,summary:import('./contracts').LessonSummary,state:'none'|'learning'|'mastered',best:number,count:number}[]} */
  const path = [];
  for (const course of courses) for (const summary of course.lessons) {
    const row = stats.get(`${course.id}/${summary.id}`);
    path.push({course, summary, best: row?.best || 0, count: row?.count || 0, state: !row ? 'none' : row.best >= MASTERED_PERCENT ? 'mastered' : 'learning'});
  }
  const practiced = path.filter(item => item.summary.question_count > 0);
  const mastered = practiced.filter(item => item.state === 'mastered').length;
  const learning = practiced.filter(item => item.state === 'learning').length;
  const notStarted = practiced.length - mastered - learning;
  const done = mastered + learning;
  const donePct = practiced.length ? Math.round(100 * mastered / practiced.length) : 0;
  // Gợi ý bài tiếp theo: bài đang làm dở > bài chưa học đầu tiên > bài điểm thấp nhất cần ôn.
  const resume = active && draft && !locked && session ? practiced.find(item => item.course.id === active?.course_id && item.summary.id === active?.lesson_id) : undefined;
  const nextNew = practiced.find(item => item.state === 'none');
  const weakest = practiced.filter(item => item.state === 'learning').sort((x, y) => x.best - y.best)[0];
  const suggestion = resume ? {item: resume, label: 'Tiếp tục bài đang làm', practice: true} : nextNew ? {item: nextNew, label: done ? 'Bài tiếp theo' : 'Bắt đầu học', practice: false} : weakest ? {item: weakest, label: 'Nên ôn lại', practice: true} : null;

  const hero = el('section', '', 'dash-hero');
  const greet = el('div', '', 'dash-greet'); const greetTop = el('div', '', 'dash-greet-top'); greetTop.append(el('h2', `Xin chào, ${name}`), syncButton); greet.append(greetTop, el('p', `Lớp ${captured.identity.class_code}${practiced.length ? ` · ${practiced.length} bài luyện tập` : ''}`, 'meta'));
  hero.append(greet);
  if (suggestion) {
    const next = el('div', '', 'dash-next'); next.append(el('span', suggestion.label, 'dash-next-label'), el('strong', suggestion.item.summary.title));
    next.append(withIcon(button(suggestion.item === resume ? 'Tiếp tục' : 'Vào học', () => loadLesson(suggestion.item.course.id, suggestion.item.summary.id, suggestion.item.summary.version, suggestion.practice), 'primary'), 'play'));
    hero.append(next);
  } else if (practiced.length) hero.append(el('p', 'Em đã thành thạo toàn bộ lộ trình. Hãy ôn lại thường xuyên nhé.', 'dash-next-label'));
  target.append(hero);
  if (waiting.length) {
    const note = el('div', '', 'notice pending-note');
    note.append(icon('clock'), el('span', `${waiting.length} bài đang chờ gửi lên máy chủ${waiting[0].error ? ` · ${waiting[0].error}` : ''}. Số liệu chưa gồm các bài này.`));
    target.append(note);
  }
  if (rejected.length) {
    const note = el('div', '', 'notice pending-note'); note.append(icon('x'), el('span', `${rejected.length} bài không được máy chủ nhận: ${rejected[0].rejected}`));
    note.append(button('Xóa thông báo', async () => { for (const item of rejected) await db.remove('outbox', item.key); await progress(); }, 'quiet'));
    target.append(note);
  }
  if (!fresh && attempts.length) { const stale = el('div', '', 'notice pending-note'); stale.append(icon('wifioff'), el('span', 'Đang xem số liệu đã lưu trên máy. Kết nối mạng để cập nhật.')); target.append(stale); }

  // Thời điểm nộp (chỉ có với bài nộp sau khi Worker mới được triển khai)
  const stamps = attempts.map(item => Number(item.submitted_at)).filter(value => value > 0);
  const activeDays = new Set(stamps.map(dayStart));
  let streak = 0; { let day = dayStart(Date.now()); if (!activeDays.has(day)) day -= DAY_MS; while (activeDays.has(day)) { streak += 1; day -= DAY_MS; } }
  const average = stats.size ? [...stats.values()].reduce((sum, row) => sum + row.best, 0) / stats.size : 0;

  const overview = el('div', '', 'dash-overview');
  const ringCard = el('section', '', 'panel dash-ring-card');
  const ring = el('div', '', 'score-ring'); ring.style.setProperty('--p', donePct + '%'); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `Thành thạo ${mastered} trên ${practiced.length} bài`);
  const ringText = el('strong', ''); ringText.append(document.createTextNode(`${mastered}/${practiced.length}`)); ring.append(ringText);
  const legend = el('ul', '', 'dash-legend');
  for (const [cls, label, value] of [['is-mastered', 'Thành thạo (từ 80% câu đúng)', mastered], ['is-learning', 'Đang học', learning], ['is-none', 'Chưa bắt đầu', notStarted]]) {
    const li = el('li'); li.append(el('i', '', `dot ${cls}`), el('span', `${label}: ${value}`)); legend.append(li);
  }
  const ringBody = el('div'); ringBody.append(el('h2', 'Lộ trình của em', 'panel-title'), legend);
  ringCard.append(ring, ringBody);
  const tiles = el('div', '', 'stat-grid stat-grid-2');
  const streakTile = statTile('Ngày học liên tiếp', stamps.length ? String(streak) : '–', 'spark', 'amber');
  tiles.append(streakTile, statTile('Lượt làm bài', String(attempts.length), 'repeat', 'blue'), statTile('Điểm trung bình', stats.size ? (Math.round(average) / 10).toString() : '–', 'target', 'teal'), statTile('Tỉ lệ câu đúng', sumTotal ? `${Math.round(100 * sumCorrect / sumTotal)}%` : '–', 'check', 'green'));
  overview.append(ringCard, tiles); target.append(overview);

  if (stamps.length) {
    const days = []; const today = dayStart(Date.now());
    for (let offset = 6; offset >= 0; offset--) { const start = today - offset * DAY_MS; days.push({start, label: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(start).getDay()], count: 0}); }
    for (const stamp of stamps) { const slot = days.find(day => stamp >= day.start && stamp < day.start + DAY_MS); if (slot) slot.count += 1; }
    const peak = Math.max(1, ...days.map(day => day.count));
    const card = el('section', '', 'panel week-panel'); card.append(el('h2', `7 ngày gần đây · ${days.reduce((sum, day) => sum + day.count, 0)} lượt`, 'panel-title'));
    const chart = el('div', '', 'week-chart');
    for (const day of days) {
      const col = el('div', '', 'week-col'); const bar = el('span', '', 'week-bar'); bar.style.height = Math.max(day.count ? 12 : 4, Math.round(100 * day.count / peak)) + '%';
      bar.title = `${day.count} lượt`; col.append(el('em', String(day.count), 'week-num'), bar, el('span', day.label, 'week-day')); chart.append(col);
    }
    card.append(chart); target.append(card);
  }

  // Nên ôn lại: chủ đề còn yếu ở các bài luyện tập (máy chủ tính, chỉ gồm tên chủ đề và số câu đúng).
  if (fresh && review.length) {
    const card = el('section', '', 'panel review-panel'); card.append(el('h2', 'Em nên ôn lại', 'panel-title'), el('p', 'Các nội dung em còn làm chưa tốt ở bài luyện tập gần nhất.', 'meta'));
    for (const item of review) {
      const row = el('article', '', 'stat-row'); const top = el('div', '', 'stat-row-top');
      top.append(el('h3', item.topic), el('strong', `${item.correct}/${item.total} câu đúng`, 'stat-row-score'));
      const bar = el('div', '', 'bar'); const fill = el('span'); fill.style.width = item.percent + '%'; bar.append(fill);
      const meta = el('p', `Trong bài: ${item.lesson_title}`, 'meta');
      const summary = path.find(entry => entry.course.id === item.course_id && entry.summary.id === item.lesson_id);
      row.append(top, bar, meta);
      if (summary) row.append(withIcon(button('Ôn lại bài này', () => loadLesson(summary.course.id, summary.summary.id, summary.summary.version, true), 'quiet'), 'repeat'));
      card.append(row);
    }
    target.append(card);
  }

  // Lộ trình: mỗi bài một chặng, nối nhau theo thứ tự giáo viên xếp.
  for (const course of courses) {
    const section = el('section', '', 'panel path-panel'); section.append(el('h2', course.title, 'panel-title'));
    const list = el('ol', '', 'path');
    let index = 0;
    for (const item of path.filter(entry => entry.course === course)) {
      index += 1;
      const readOnly = item.summary.question_count === 0;
      const li = el('li', '', `path-step is-${readOnly ? 'read' : item.state}${item.state === 'learning' && item.best < REVIEW_PERCENT ? ' is-review' : ''}`);
      const node_ = el('span', '', 'path-node'); if (item.state === 'mastered') node_.append(icon('check')); else node_.append(document.createTextNode(String(index)));
      const body = el('div', '', 'path-body'); const top = el('div', '', 'stat-row-top');
      top.append(el('h3', item.summary.title), el('strong', readOnly ? 'Chỉ đọc' : item.state === 'none' ? 'Chưa làm' : `${item.best}%`, 'stat-row-score'));
      body.append(top);
      if (!readOnly) {
        const bar = el('div', '', 'bar'); const fill = el('span'); fill.style.width = item.best + '%'; bar.append(fill); body.append(bar);
        const status = item.state === 'none' ? `${item.summary.question_count} câu luyện tập` : `${item.count} lượt làm · tốt nhất ${item.best}% câu đúng${item.best < REVIEW_PERCENT ? ' · cần ôn' : ''}`;
        body.append(el('p', status, 'meta'));
      }
      const go = withIcon(button(readOnly ? 'Đọc' : item.state === 'none' ? 'Bắt đầu' : item.state === 'mastered' ? 'Xem lại' : 'Ôn lại', () => loadLesson(item.course.id, item.summary.id, item.summary.version, !readOnly && item.state === 'learning'), 'path-go'), 'arrow', true);
      li.append(node_, body, go); list.append(li);
    }
    section.append(list); target.append(section);
  }
  if (!path.length) { const card = empty(target, 'Chưa có bài cho khối của em', 'Bài học xuất hiện khi giáo viên xuất bản.', 'book'); void card; }

  const recent = attempts.filter(item => Number(item.submitted_at) > 0).sort((x, y) => Number(y.submitted_at) - Number(x.submitted_at)).slice(0, 5);
  if (recent.length) {
    const section = el('section', '', 'panel'); section.append(el('h2', 'Hoạt động gần đây', 'panel-title'));
    for (const item of recent) {
      const row = el('article', '', 'stat-row'); const top = el('div', '', 'stat-row-top');
      top.append(el('h3', lessonTitle(item)), el('strong', `${item.correct}/${item.total}`, 'stat-row-score'));
      row.append(top, el('p', `${dateLabel(Number(item.submitted_at))} · ${percentOf(item)}% câu đúng`, 'meta')); section.append(row);
    }
    target.append(section);
  }
  const how = el('details', '', 'how-calc'); how.append(el('summary', 'Cách tính số liệu'),
    el('p', `Số liệu lấy từ các bài máy chủ đã nhận. "Thành thạo" là bài có lượt làm đạt từ ${MASTERED_PERCENT}% câu đúng; "Đang học" là đã làm nhưng chưa đạt. Điểm trung bình là trung bình kết quả tốt nhất của mỗi bài. Tỉ lệ câu đúng tính trên mọi lượt làm. Ngày học liên tiếp đếm các ngày có nộp bài.`, 'meta'));
  target.append(how);
}
/** @param {{course_id:string,lesson_id:string}} item */
function lessonTitle(item) {return catalog?.courses.find(course => course.id === item.course_id)?.lessons.find(lesson => lesson.id === item.lesson_id)?.title || 'Bài học đã nộp';}
/** @param {Lesson} lesson @param {Record<string,string>} answers */
async function adoptGuestAnswers(lesson, answers) {
  if (!draft || locked || Object.keys(draft.answers).length || active?.version !== lesson.version) return;
  draft.answers = answers; renderQuestions(); await saveDraft();
}
async function start() {
  session = /** @type {Session|null} */ (await db.get('meta', 'session')) || null;
  catalog = /** @type {import('./contracts').Catalog|null} */ (await db.get('meta', 'catalog')) || null;
  identityUI(); renderCatalog();
  if (session) {
    const saved = await db.get('meta', `active:${session.identity.uid}`);
    const restored = saved ? /** @type {Draft|undefined} */ (await db.get('drafts', saved.key)) : null;
    if (restored?.uid === session.identity.uid) { practice = Boolean(saved.practice); await openLesson(restored.lesson, restored); }
    else await progress();
  }
  await refreshCatalog(); await sync();
  if (!catalog && !navigator.onLine) {catalogUnavailable('Cần kết nối mạng để nhận danh mục lần đầu.'); notify('Thiết bị chưa có bài tải offline.', true);}
}
on('login', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal());
on('gate-student', () => {
  /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal();
  document.getElementById('student-code')?.focus();
});
on('account', () => {
  if (session) {
    openStudentSettings();
  } else {
    /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal();
  }
});
on('close-login', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).close());
if (document.getElementById('close-account')) {
  on('close-account', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).close());
}
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
  const what = b.getAttribute('data-reveal') === 'student-pin' || /pin/i.test(b.getAttribute('data-reveal') || '') ? 'mã PIN' : 'mật khẩu';
  b.setAttribute('aria-label', (show ? 'Ẩn ' : 'Hiện ') + what);
  b.setAttribute('aria-pressed', String(show));
});
on('logout', async () => {
  viewGeneration++;
  if (studentSettingsActive) {
    studentSettingsActive = false;
    renderStudentSettings(false);
  }
  await saveDraft(); session = null; active = null; draft = null; locked = false;
  await db.remove('meta', 'session'); fb.clear(); identityUI(); renderCatalog(); show('catalog');
  /** @type {HTMLDialogElement} */ (node('login-dialog')).close();
  // Nút đồng bộ nằm trong bảng tổng quan → đưa về chỗ cũ trước khi xóa, nếu không lần đăng nhập sau (máy dùng chung) báo lỗi.
  const syncBtn = document.getElementById('sync'); if (syncBtn) node('progress-view').prepend(syncBtn);
  node('questions').replaceChildren(); node('result').replaceChildren(); node('progress').replaceChildren(); node('draft-status').textContent = '';
  notify('Đã đăng xuất. Nháp được giữ riêng theo tài khoản.');
});
form('login-form').addEventListener('submit', async event => {
  viewGeneration++;
  event.preventDefault();
  node('login-error').textContent = '';
  const loginForm = form('login-form');
  const submitButton = /** @type {HTMLButtonElement} */ (loginForm.querySelector('button[type=submit]'));
  const codeInput = /** @type {HTMLInputElement} */ (loginForm.querySelector('[name=code]'));
  const pinInput = /** @type {HTMLInputElement} */ (loginForm.querySelector('[name=pin]'));

  codeInput.addEventListener('input', () => setFieldError(codeInput, ''));
  pinInput.addEventListener('input', () => setFieldError(pinInput, ''));

  const code = codeInput.value.trim();
  const pin = pinInput.value.trim();

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) {
    setFieldError(codeInput, 'Mã học sinh chỉ gồm chữ, số, - và _.');
    codeInput.focus();
    return;
  }
  if (pin.length < 6) {
    setFieldError(pinInput, 'Mã PIN tối thiểu 6 ký tự.');
    pinInput.focus();
    return;
  }

  await withBusy(submitButton, 'Đang đăng nhập…', async () => {
    try {
      const guestLesson = !session ? active : null;
      const guestAnswers = guestLesson ? Object.fromEntries(new FormData(form('question-form')).entries()) : null;
      await saveDraft();
      const response = isLocalhostBackend
        ? await api('/student/lan-login', {method:'POST', body:{student_code:code}})
        : await api('/login', {method:'POST', body:{student_id:code, pin}});
      const identity = await api('/pwa/me', {token:response.token});
      identity.must_change_pin = Boolean(response.must_change_pin);
      const next = {token:response.token, identity};
      await db.put('meta', 'session', next); session = next;
      clearTeacherSession();
      // Cổng 2: đăng nhập song song hệ thống thi Firebase bằng cùng mã + PIN. Chưa có tài khoản Firebase thì bỏ qua (chỉ thấy đề Worker).
      fb.clear(); if (!isLocalhostBackend) void fb.signIn(code, pin).catch(() => {});
      draft = null; locked = false; identityUI(); renderCatalog();
      if (active) {
        const course = catalog?.courses.find(item => item.id === active?.course_id);
        if (course && course.grade !== session.identity.grade) {active = null; draft = null; locked = false; show('catalog'); updateResume();}
        else {
          await openLesson(active);
          if (guestLesson && guestAnswers) await adoptGuestAnswers(guestLesson, /** @type {Record<string,string>} */ (guestAnswers));
        }
      } else { void progress().catch(report); }
      /** @type {HTMLDialogElement} */ (node('login-dialog')).close();
      notify('Đã đăng nhập. Nháp được lưu riêng cho em.'); await sync();
    } catch (error) {
      node('login-error').textContent = mapErrorMessage(error);
    }
  });
});
form('student-change-pin-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = /** @type {HTMLFormElement} */ (event.target);
  const statusNode = node('student-change-pin-status');
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
  if (newPin.length < 6) {
    setFieldError(newPinInput, 'Mã PIN tối thiểu 6 ký tự.');
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

  const submitBtn = /** @type {HTMLButtonElement} */ (formEl.querySelector('button[type=submit]'));
  await withBusy(submitBtn, 'Đang đổi mã PIN…', async () => {
    try {
      await api('/pwa/change-pin', {
        method: 'POST',
        body: { old_pin: oldPin, new_pin: newPin },
        token: session?.token
      });
      statusNode.textContent = 'Đã đổi mã PIN.';
      statusNode.className = 'notice success status';
      // Hệ thống thi (Firebase) dùng cùng PIN → đổi theo, nếu không lần đăng nhập sau sẽ không thấy đề thi.
      if (!isLocalhostBackend) {
        try { await fb.changePassword(oldPin, newPin); }
        catch { statusNode.textContent = 'Đã đổi mã PIN học tập, nhưng CHƯA đổi được PIN hệ thống thi. Hãy báo thầy cô trước buổi kiểm tra.'; statusNode.className = 'notice error status'; }
      }
      formEl.reset();
      if (session) {
        session.identity.must_change_pin = false;
        await db.put('meta', 'session', session);
        node('account-must-change').hidden = true;
      }
    } catch (err) {
      statusNode.textContent = mapErrorMessage(err);
      statusNode.className = 'notice error status';
    }
  });
});
node('grade').addEventListener('change', () => {gradeChosen = true; selectedCourse = ''; renderCatalog();});
node('search').addEventListener('input', renderCatalog);
on('resume', async () => {if (!active) return; const lesson = active; const saved = draft; const owner = session; const generation = ++viewGeneration; await saveDraft(); await openLesson(lesson, saved, generation, owner, practice);});
on('back', async () => {viewGeneration++; await saveDraft(); show('catalog');});
on('read-lesson', async () => {setPractice(false); await saveDraft();});
on('practice-lesson', async () => {setPractice(true); await saveDraft();});
form('question-form').addEventListener('input', () => {updateAnswerCount(); saveDraft().catch(report);});
form('question-form').addEventListener('submit', event => {event.preventDefault(); submit().catch(report);});
on('download', async () => {
  const lesson = active;
  const generation = viewGeneration;
  if (!lesson) return; await verifyPackage(lesson); await db.put('packages', db.packageKey(lesson), lesson);
  if (generation !== viewGeneration || active !== lesson) return;
  notify('Đã tải đủ bài. Em có thể mở lại khi mất mạng.');
  if (navigator.storage?.persist) await navigator.storage.persist();
});
/** Tab Thi: danh sách bài kiểm tra của lớp, vào làm bài ở màn hình thi riêng. */
function exams() {
  show('exams'); void renderExamList(node('exams'), Boolean(session));
}
async function materials() {
  show('materials');
  const generation = viewGeneration;
  const select = /** @type {HTMLSelectElement} */ (node('materials-course-select'));
  const list = node('materials-list');

  if (!select.options.length && catalog?.courses?.length) {
    for (const course of catalog.courses) {
      const opt = el('option', `${course.title} · Lớp ${course.grade}`);
      opt.value = course.id;
      select.append(opt);
    }
    select.addEventListener('change', () => {
      materials().catch(report);
    });
  }

  const courseId = select.value || catalog?.courses?.[0]?.id;
  if (!courseId) {
    list.replaceChildren();
    empty(list, 'Chưa có môn học', 'Hãy chọn môn học để xem tài liệu.');
    return;
  }

  list.replaceChildren();
  const loading = el('div', '', 'lesson-skeleton');
  list.append(loading);

  try {
    const data = await api(`/pwa/materials/${encodeURIComponent(courseId)}`);
    if (generation !== viewGeneration) return;
    list.replaceChildren();

    const items = data.materials || [];
    if (!items.length) {
      empty(list, 'Chưa có tài liệu', 'Giáo viên chưa đăng tải tài liệu bổ trợ cho môn học này.');
      return;
    }

    const cache = 'caches' in window ? await caches.open('aisgk-materials-v1') : null;

    for (const mat of items) {
      const card = el('article', '', 'download-card');
      const desc = el('div', '', 'lesson-description');
      desc.append(
        el('h3', mat.title),
        el('p', mat.description || 'Tài liệu tóm tắt bài học', 'meta')
      );

      const fileUrl = `/api/pwa/materials/${encodeURIComponent(mat.course_id)}/${encodeURIComponent(mat.id)}/file`;
      const isCached = cache ? Boolean(await cache.match(fileUrl)) : false;

      const actions = el('div', '', 'actions');
      const statusBadge = el('span', isCached ? 'Đã lưu offline' : 'Chưa tải', 'offline-label');
      statusBadge.style.fontSize = '13px';
      statusBadge.style.color = isCached ? 'var(--blue)' : 'var(--muted)';
      actions.append(statusBadge);

      if (isCached) {
        actions.append(button('Mở xem', async () => {
          if (!cache) return;
          const res = await cache.match(fileUrl);
          if (res) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
          }
        }));
        actions.append(button('Xóa offline', async () => {
          if (!cache) return;
          await cache.delete(fileUrl);
          await materials();
          notify('Đã xóa bản offline của tài liệu.');
        }, 'danger'));
      } else {
        actions.append(button('Tải về học offline', async () => {
          if (!navigator.onLine) {
            notify('Cần có kết nối mạng để tải tài liệu.', true);
            return;
          }
          try {
            notify('Đang tải tài liệu PDF...');
            const fetchHeaders = session?.token ? { Authorization: `Bearer ${session.token}` } : {};
            const res = await fetch(fileUrl, { headers: fetchHeaders });
            if (!res.ok) throw new Error(`Tải lỗi HTTP ${res.status}`);
            if (cache) await cache.put(fileUrl, res.clone());
            await materials();
            notify('Đã tải tài liệu về máy thành công.');
          } catch (err) {
            report(err instanceof Error ? err : new Error('Không thể tải tài liệu.'));
          }
        }, 'primary'));
      }

      card.append(desc, actions);
      list.append(card);
    }
  } catch {
    if (generation !== viewGeneration) return;
    list.replaceChildren();
    empty(list, 'Không tải được tài liệu', 'Em hãy kiểm tra lại kết nối mạng hoặc thử lại sau nhé.');
  }
}

on('sync', async () => {await sync(); await progress();});
for (const tab of document.querySelectorAll('button[data-tab]')) tab.addEventListener('click', async () => {
  viewGeneration++;
  try {
    await saveDraft(); const name = /** @type {HTMLButtonElement} */ (tab).dataset.tab;
    if (name === 'downloads') await downloads();
    else if (name === 'progress') await progress();
    else if (name === 'practice') {show('practice'); renderPractice();}
    else if (name === 'exams') exams();
    else if (name === 'materials') await materials();
    else {show('catalog'); renderCatalog();}
  } catch (error) {report(error instanceof Error ? error : new Error('Chưa chuyển được trang.'));}
});
function updateConnection() {const connText = navigator.onLine ? 'Có kết nối mạng' : 'Đang offline'; node('connection-text').textContent = connText; node('connection').title = connText; node('connection').classList.toggle('is-offline', !navigator.onLine); /** @type {HTMLButtonElement} */ (node('sync')).disabled = !session || !navigator.onLine; updateTutorStatus();}
window.addEventListener('online', () => {updateConnection(); refreshCatalog().catch(report); sync().catch(report);});
window.addEventListener('offline', () => {updateConnection(); notify('Mất kết nối. Nháp vẫn được giữ trên máy.');});
window.addEventListener('focus', () => {refreshCatalog().catch(report);});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveDraft().catch(report);
  else {refreshCatalog().catch(report); sync().catch(report);}
});
let updateRequested = false, hadController = Boolean(navigator.serviceWorker?.controller);
const swVersion = () => (document.documentElement.dataset.build || '');
/** @param {boolean} [manual] */
async function checkForUpdate(manual = false) {
  if (!registration || !navigator.onLine) {
    if (manual) await confirmBox({ title: 'Không kiểm tra được', body: 'Cần kết nối mạng để kiểm tra cập nhật.', okText: 'Đã hiểu', kind: 'notice' });
    return;
  }
  try {
    await registration.update();
  } catch {
    if (manual) await confirmBox({ title: 'Chưa kiểm tra được', body: 'Thử lại sau.', okText: 'Đã hiểu', kind: 'notice' });
    return;
  }
  const has = Boolean(registration.waiting || registration.installing);
  if (manual && !has) await confirmBox({ title: 'Đã là bản mới nhất', body: `Phiên bản ${swVersion()}.`, okText: 'Đã hiểu', kind: 'notice' });
}

on('update-app', async () => {
  const btn = /** @type {HTMLButtonElement} */ (node('update-app'));
  await withBusy(btn, 'Đang cập nhật…', async () => {
    await saveDraft();
    if (draft && !locked && Object.keys(draft.answers).length) {
      notify('Hoàn thành bài đang làm trước khi cập nhật ứng dụng.', true);
      await confirmBox({
        title: 'Chưa thể cập nhật',
        body: 'Em hãy hoàn thành bài đang làm trước khi cập nhật ứng dụng.',
        okText: 'Đã hiểu',
        kind: 'notice'
      });
      return;
    }
    if (node('update-notice').dataset.reload) {
      location.reload();
      return;
    }
    if (!registration?.waiting) {
      notify('Đang kiểm tra bản cập nhật…');
      await checkForUpdate();
      return;
    }
    updateRequested = true;
    registration.waiting.postMessage({ type: 'ACTIVATE' });
  });
});

if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }     // lần cài đầu: không tải lại
    if (reloading) return;
    if (updateRequested) { reloading = true; location.reload(); return; }
    node('update-text').textContent = 'Ứng dụng vừa cập nhật ở cửa sổ khác. Tải lại để dùng bản mới.'; node('update-app').title = node('update-text').textContent; node('update-app').setAttribute('aria-label', 'Tải lại để dùng bản mới');
    node('update-notice').hidden = false;
    node('update-notice').dataset.reload = '1';   // P5
  });
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data?.type === 'VERSION') {
      document.documentElement.dataset.build = ev.data.value;
      const vSpan = document.getElementById('app-version');
      if (vSpan) vSpan.textContent = ev.data.value;
    }
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(result => {
    registration = result;
    const check = () => { if (result.waiting && navigator.serviceWorker.controller) node('update-notice').hidden = false; };
    check();
    result.addEventListener('updatefound', () => result.installing?.addEventListener('statechange', check));
    navigator.serviceWorker.controller?.postMessage({ type: 'VERSION' });
    setInterval(() => checkForUpdate(), 60 * 60 * 1000);                       // P4: mỗi giờ
    window.addEventListener('online', () => checkForUpdate());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  }).catch(report);
}

if (document.getElementById('check-update')) {
  on('check-update', () => withBusy(/** @type {HTMLButtonElement} */ (node('check-update')), 'Đang kiểm tra…', () => checkForUpdate(true)));
}
/** @type {Event & {prompt:()=>Promise<void> }|null} */ let installPrompt = null;
let installedThisSession = false;
function installState() {
  const standalone = matchMedia('(display-mode: standalone)').matches;
  let label = 'Cài ứng dụng'; let detail = 'Trang hiện đang mở trong trình duyệt. Làm theo hướng dẫn phù hợp với thiết bị.';
  if (installedThisSession) {label = 'Đã cài ứng dụng'; detail = 'Trình duyệt đã xác nhận cài đặt. Em có thể mở từ biểu tượng SGK.';}
  if (standalone) {label = 'Đang dùng ứng dụng'; detail = 'Em đang mở ứng dụng ở chế độ độc lập.';}
  node('install-label').textContent = label; node('install').setAttribute('aria-label', label); node('install').title = label; node('install-state').textContent = detail;
}
window.addEventListener('beforeinstallprompt', event => {event.preventDefault(); installPrompt = /** @type {typeof installPrompt} */ (event);});
window.addEventListener('appinstalled', () => {installPrompt = null; installedThisSession = true; installState(); notify('Trình duyệt đã xác nhận cài ứng dụng. Mở từ biểu tượng SGK để dùng.');});
on('install', async () => {
  if (installPrompt) {const pwaPrompt = installPrompt; installPrompt = null; await pwaPrompt.prompt();}
  else {installState(); /** @type {HTMLDialogElement} */ (node('install-help-dialog')).showModal();}
});
on('close-install', () => /** @type {HTMLDialogElement} */ (node('install-help-dialog')).close());
on('ask-tutor', () => openTutor(null));
on('open-tutor', () => openTutor(null));
on('close-tutor', closeTutor);
form('tutor-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!navigator.onLine) { notify('Cần kết nối mạng để gửi câu hỏi.', true); return; }
  if (!tutorLesson || tutorPending) return;
  const input = /** @type {HTMLInputElement} */ (node('tutor-input'));
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const msgs = node('tutor-messages');
  const userMsg = el('div', '', 'tutor-msg tutor-user');
  userMsg.append(el('p', text));
  msgs.append(userMsg);

  const loadingMsg = el('div', '', 'tutor-msg tutor-bot is-loading');
  loadingMsg.append(el('p', 'Thầy/Cô đang suy nghĩ…'));
  msgs.append(loadingMsg);
  msgs.scrollTop = msgs.scrollHeight;

  tutorPending = true;
  updateTutorStatus();

  try {
    const payload = {
      course_id: tutorLesson.course_id,
      lesson_id: tutorLesson.lesson_id,
      message: text,
      history: tutorHistory,
      question_id: active && tutorQuestionId && tutorLesson.lesson_id === active.lesson_id ? tutorQuestionId : undefined,
      selected_option: active && tutorQuestionId && tutorLesson.lesson_id === active.lesson_id && draft?.answers[tutorQuestionId] ? draft.answers[tutorQuestionId] : undefined,
      attempt_count: 1
    };
    /** @type {import('./contracts').TutorResponse} */
    const res = await api('/pwa/tutor', { method: 'POST', body: payload, token: session?.token });
    loadingMsg.remove();
    const botMsg = el('div', '', 'tutor-msg tutor-bot');
    renderMarkdown(botMsg, res.reply || 'Thầy/Cô chưa có câu trả lời cho câu này.');
    msgs.append(botMsg);
    tutorHistory.push({ role: 'user', content: text });
    tutorHistory.push({ role: 'model', content: res.reply || '' });
    refreshTutorQuota().catch(() => {});
  } catch (err) {
    loadingMsg.remove();
    const errMsg = el('div', '', 'tutor-msg tutor-bot');
    let messageText = 'Chưa kết nối được với Gia sư AI. Em hãy kiểm tra lại mạng hoặc thử lại sau nhé.';
    if (err instanceof ApiError && err.status === 401) { closeTutor(); void expireSession(); }
    const errCode = (err && typeof err === 'object' && 'code' in err) ? /** @type {any} */ (err).code : null;
    if (errCode === 'AI_LIMIT_REACHED') {
      messageText = 'Em đã dùng hết lượt hỏi gia sư hôm nay. Hãy tự ôn tập và quay lại vào ngày mai nhé!';
    } else if (errCode === 'AI_LOCKED') {
      messageText = 'Giáo viên đã tạm khóa gia sư với em. Hãy hỏi thầy/cô nhé.';
    } else if (errCode === 'AI_DISABLED_IN_EXAM') {
      messageText = 'Đang trong giờ thi, gia sư tạm tắt.';
    } else if (err && typeof err === 'object' && ('status' in err && err.status === 429)) {
      messageText = 'Gia sư đang nghỉ ngơi một chút, em hãy tự suy nghĩ thêm hoặc quay lại sau nhé!';
    }
    errMsg.append(el('p', messageText));
    msgs.append(errMsg);
    refreshTutorQuota().catch(() => {});
  } finally {
    tutorPending = false;
    updateTutorStatus();
    msgs.scrollTop = msgs.scrollHeight;
    input.focus();
  }
});
installState(); updateConnection();
start().catch(error => {catalogUnavailable('Kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.'); report(error);});


// ==========================================
// STUDENT ADAPTIVE SETTINGS MENU (AGENTS.md J & K)
// ==========================================
let studentSettingsActive = false;
let studentActiveView = '';

async function renderDownloadedLessonsForSettings() {
  const container = document.getElementById('settings-offline-list');
  if (!container) return;
  container.replaceChildren();
  const lessons = await db.allLessons();
  if (!lessons.length) {
    const emptyP = el('p', 'Chưa có bài tải ngoại tuyến.', 'muted');
    container.append(emptyP);
    return;
  }
  for (const lesson of lessons) {
    const row = el('article', '', 'card');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '12px';
    const info = el('div');
    info.append(el('h3', lesson.title), el('p', `${lesson.subject_name || 'Bài học'} · Đã lưu`, 'muted'));
    const delBtn = button('Xóa bản tải', async () => {
      if (!await confirmBox({
        title: 'Xóa bản tải?',
        body: `${lesson.title}. Em cần kết nối mạng để tải lại bài trên thiết bị này.`,
        okText: 'Xóa bản tải',
        danger: true
      })) return;
      await db.deleteLesson(lesson.id);
      notify('Đã xóa bản tải.');
      await renderDownloadedLessonsForSettings();
      renderDownloads();
    }, 'danger');
    row.append(info, delBtn);
    container.append(row);
  }
}

function renderStudentSettings(focus = true) {
  const settingsEl = document.getElementById('settings');
  const openSettingsBtn = document.getElementById('open-settings');
  const settingsLayout = document.getElementById('settings-layout');
  if (!settingsEl) return;

  settingsEl.hidden = !studentSettingsActive;
  if (openSettingsBtn) openSettingsBtn.setAttribute('aria-expanded', String(studentSettingsActive));

  if (!studentSettingsActive) {
    if (focus) {
      document.getElementById('open-settings')?.focus();
    }
    return;
  }

  const isWide = window.matchMedia('(min-width: 960px)').matches;
  if (isWide && !studentActiveView) studentActiveView = 'account';
  if (settingsLayout) {
    if (isWide) {
      settingsLayout.classList.add('has-detail');
    } else {
      settingsLayout.classList.toggle('has-detail', Boolean(studentActiveView));
    }
  }

  const panels = ['account', 'offline', 'help'];
  for (const p of panels) {
    const elP = document.getElementById('panel-' + p);
    if (elP) elP.hidden = p !== studentActiveView;
  }

  document.querySelectorAll('#settings .settings-menu .group-link').forEach(btn => {
    const b = /** @type {HTMLButtonElement} */ (btn);
    if (b.dataset.view === studentActiveView) {
      b.setAttribute('aria-current', 'page');
    } else {
      b.removeAttribute('aria-current');
    }
  });

  if (studentActiveView === 'offline') {
    renderDownloadedLessonsForSettings();
  }

  if (focus) {
    const heading = document.getElementById('heading-' + studentActiveView) || document.getElementById('settings-title');
    heading?.focus();
  }
}

function studentSettingsBack() {
  const wide = window.matchMedia('(min-width: 960px)').matches;
  if (!wide && studentActiveView) { studentActiveView = ''; renderStudentSettings(false); return true; }
  return false;
}

function openStudentSettings() {
  studentSettingsActive = true;
  const wide = window.matchMedia('(min-width: 960px)').matches;
  if (!wide) studentActiveView = '';
  history.pushState({ studentSettings: 1 }, '');
  const tabs = ['catalog-view', 'practice-view', 'lesson-view', 'downloads-view', 'progress-view', 'exams-view', 'materials-view', 'result-view'];
  tabs.forEach(id => { const elem = document.getElementById(id); if (elem) elem.hidden = true; });
  renderStudentSettings();
  window.scrollTo(0, 0);
}

function closeStudentSettings() {
  if (history.state?.studentSettings) {
    history.back();
  } else {
    studentSettingsActive = false;
    renderStudentSettings(false);
    show(active ? 'lesson' : 'catalog');
    document.getElementById('open-settings')?.focus();
  }
}

window.addEventListener('popstate', () => {
  if (!studentSettingsActive) return;
  if (studentSettingsBack()) history.pushState({ studentSettings: 1 }, '');
  else {
    studentSettingsActive = false;
    renderStudentSettings(false);
    show(active ? 'lesson' : 'catalog');
  }
});

if (document.getElementById('close-settings')) {
  on('close-settings', closeStudentSettings);
}

document.getElementById('open-settings')?.addEventListener('click', () => {
  if (session) openStudentSettings();
  else /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal();
});

document.querySelectorAll('#settings .settings-menu .group-link').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = /** @type {HTMLElement} */ (btn).dataset.view;
    if (!v) return;
    const wide = window.matchMedia('(min-width: 960px)').matches;
    if (!wide && !studentActiveView) {
      history.pushState({ studentSettings: 1, studentView: v }, '');
    }
    studentActiveView = v;
    renderStudentSettings();
    window.scrollTo(0, 0);
  });
});

document.querySelectorAll('#settings .settings-detail [data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    const old = studentActiveView;
    const isWide = window.matchMedia('(min-width: 960px)').matches;
    if (!isWide) {
      studentActiveView = '';
      renderStudentSettings(false);
      const item = /** @type {HTMLElement|null} */ (document.querySelector(`#settings .settings-menu [data-view="${old}"]`));
      if (item) item.focus();
      else document.getElementById('settings-title')?.focus();
    } else {
      closeStudentSettings();
    }
  });
});

window.matchMedia('(min-width: 960px)').addEventListener('change', () => {
  if (studentSettingsActive && !studentActiveView) studentActiveView = 'account';
  renderStudentSettings(false);
});

// Giao diện sáng/tối: mặc định theo hệ thống; nút mặt trời/mặt trăng lưu lựa chọn trên thiết bị.
function effectiveTheme() {
  const set = document.documentElement.dataset.theme;
  return set === 'light' || set === 'dark' ? set : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function syncThemeButton() {
  const dark = effectiveTheme() === 'dark';
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(dark));
  const label = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  btn.setAttribute('aria-label', label); btn.title = label;
  let meta = document.querySelector('meta[name="theme-color"][data-dynamic]');
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'theme-color'); meta.setAttribute('data-dynamic', ''); document.head.prepend(meta); }
  meta.setAttribute('content', dark ? '#262624' : '#ffffff');
}
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('aisgk-theme', next); } catch { /* chế độ riêng tư: chỉ đổi trong phiên */ }
  syncThemeButton();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeButton);
syncThemeButton();
