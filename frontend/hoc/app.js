// @ts-check
import { api, ApiError, verifyPackage, isLocalhostBackend } from './api.js';
import * as db from './db.js';
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
  if (input) input.disabled = !isOnline || tutorPending;
  const submit = /** @type {HTMLButtonElement|null} */ (document.getElementById('tutor-submit'));
  if (submit) submit.disabled = !isOnline || tutorPending;
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
      badge.textContent = 'Đang trong giờ thi: tắt gia sư';
      badge.className = 'tutor-quota-badge is-locked';
    } else if (quota.locked) {
      badge.textContent = 'Gia sư đang tạm khóa';
      badge.className = 'tutor-quota-badge is-locked';
    } else {
      badge.textContent = `Còn ${quota.remaining} lượt hôm nay`;
      badge.className = 'tutor-quota-badge';
    }
  } catch {
    badge.textContent = '';
  }
}

/** @param {string|null} [questionId] */
function openTutor(questionId = null) {
  if (!active) { notify('Hãy mở bài học trước.', true); return; }
  tutorQuestionId = questionId;
  const dialog = /** @type {HTMLDialogElement} */ (node('tutor-dialog'));
  const note = node('tutor-context-note');
  if (questionId) {
    const q = active.questions.find(item => item.id === questionId);
    note.textContent = q ? `Đang hướng dẫn câu: ${q.prompt.slice(0, 45)}…` : 'Đang hướng dẫn câu hỏi luyện tập';
  } else {
    note.textContent = `Đang hỗ trợ bài: ${active.title}`;
  }
  if (!tutorHistory.length) {
    const msgs = node('tutor-messages');
    msgs.replaceChildren();
    const greeting = el('div', '', 'tutor-msg tutor-bot');
    greeting.append(el('p', 'Chào em! Thầy/Cô là Gia sư Sư phạm Tin học. Em đang băn khoăn ở phần nào trong bài, hãy chia sẻ để Thầy/Cô gợi ý từng bước nhé!'));
    msgs.append(greeting);
  }
  updateTutorStatus();
  refreshTutorQuota().catch(() => {});
  dialog.showModal();
  /** @type {HTMLInputElement} */ (node('tutor-input')).focus();
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
    await db.remove('meta', 'session');
    identityUI(); renderCatalog(); show('catalog');
    const help = document.getElementById('login-help'); const normal = help?.textContent || '';
    if (help) { help.textContent = 'Phiên đăng nhập đã hết hạn. Bài làm vẫn được giữ. Nhập mã PIN để tiếp tục.'; const dlg = /** @type {HTMLDialogElement} */ (node('login-dialog')); dlg.addEventListener('close', () => { help.textContent = normal; }, {once: true}); }
    const code = /** @type {HTMLInputElement|null} */ (document.getElementById('student-code')); if (code) code.value = uid;
    const pin = /** @type {HTMLInputElement|null} */ (document.getElementById('student-pin')); if (pin) pin.value = '';
    /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal();
    pin?.focus();
  } finally { expiring = false; }
}
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
  /** @type {HTMLButtonElement} */ (node('sync')).disabled = !session || !navigator.onLine;
}
/** @param {string} name */
function show(name) {
  viewGeneration++;
  currentView = name;
  if (studentSettingsActive) {
    studentSettingsActive = false;
    renderStudentSettings(false);
  }
  for (const view of ['catalog', 'practice', 'lesson', 'downloads', 'progress', 'materials']) node(`${view}-view`).hidden = view !== name;
  const destination = name === 'lesson' ? (practice ? 'practice' : 'catalog') : name;
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
  const tile = el('span', '', 'tile'); tile.append(icon(exerciseOnly ? 'pencil' : 'book'));
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
    const card = el('article', '', 'course-card'); const ctile = el('span', '', 'tile'); ctile.append(icon('folder')); card.append(ctile, el('p', `${course.lessons.length} bài học`, 'meta'), el('h2', course.subject_name));
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
  node('lesson-version').textContent = `Phiên bản ${lesson.version.slice(0, 8)} · Giữ nguyên khi làm bài`;
  renderMarkdown(node('lesson-content'), lesson.content_markdown);
  node('result').replaceChildren(); renderQuestions(); setPractice(practice);
  if (pending?.ack) renderResult(pending.ack);
  else if (pending) node('result').append(el('p', 'Chờ máy chủ xác nhận. Bài nộp được giữ trên máy.', 'inline-note'));
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
/** @param {Ack} ack */
function renderResult(ack) {
  const target = node('result'); target.replaceChildren();
  const rh = el('h2', '', 'result-title'); rh.append(icon('check'), el('span', 'Kết quả bài làm')); target.append(rh, el('p', `${ack.correct}/${ack.total} câu đúng${ack.needs_review ? ' · Tự luận chờ giáo viên xem.' : '.'}`, 'success'));
  for (const feedback of ack.feedback) {
    const question = active?.questions.find(item => item.id === feedback.id);
    const row = el('div', '', 'feedback-row'); row.append(el('strong', question?.prompt || feedback.id), el('p', feedback.correct === null ? 'Chờ giáo viên xem câu tự luận.' : (feedback.correct ? 'Em đã trả lời đúng.' : 'Chưa đúng. Em hãy xem lại bài.')));
    if (feedback.correct === false && feedback.hint) row.append(el('p', feedback.hint, 'hint'));
    target.append(row);
  }
  target.append(withIcon(button('Làm lại', async () => {
    if (!draft || !active) return;
    const owner = session; const lesson = active; const generation = ++viewGeneration;
    await db.remove('drafts', draft.key);
    if (owner !== session || generation !== viewGeneration) return;
    draft = null; await openLesson(lesson, null, generation, owner, true); await saveDraft();
  }, 'primary'), 'refresh'));
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
    for (const item of queue.filter(entry => entry.uid === captured.identity.uid && !entry.ack)) {
      if (session !== captured) break;
      try {
        const ack = /** @type {Ack} */ (await api('/pwa/attempts', {method:'POST', token:captured.token, body:item.body}));
        if (ack.status !== 'submitted' || ack.attempt_id !== item.body.attempt_id || ack.version !== item.body.version) throw new Error('Máy chủ chưa xác nhận đúng bài nộp.');
        await db.put('outbox', item.key, {...item, ack, error: undefined});
        if (session !== captured) continue;
        notify('Đã nộp bài. Máy chủ đã xác nhận.');
        if (draft?.attempt_id === ack.attempt_id) renderResult(ack);
      } catch (error) {
        await db.put('outbox', item.key, {...item, error: error instanceof Error ? error.message : 'Đồng bộ chưa xong.'});
        if (session === captured) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { void expireSession(); }
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
async function progress() {
  show('progress'); const target = node('progress'); target.replaceChildren();
  const generation = viewGeneration;
  if (!session) {const card = empty(target, 'Tiến độ riêng của em', 'Đăng nhập để xem tiến độ của em.'); card.append(button('Đăng nhập để xem tiến độ', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal(), 'primary')); return; }
  const captured = session;
  const queue = /** @type {Outbox[]} */ (await db.all('outbox'));
  let attempts = queue.filter(item => item.uid === captured.identity.uid && item.ack).map(item => /** @type {Ack} */ (item.ack));
  if (navigator.onLine) {
    try { attempts = (await api('/pwa/progress', {token:captured.token})).attempts; }
    catch (error) { if (session === captured) report(error instanceof Error ? error : new Error('Chưa tải được tiến độ.')); }
  }
  if (session !== captured || generation !== viewGeneration) return;
  for (const item of queue.filter(item => item.uid === captured.identity.uid && !item.ack)) {
    const row = el('article', '', 'progress-card'); row.append(el('h2', lessonTitle(item.body)), el('p', `Chờ đồng bộ${item.error ? ` · ${item.error}` : ''}`, 'hint')); target.append(row);
  }
  for (const item of attempts) {
    const row = el('article', '', 'progress-card'); row.append(el('h2', lessonTitle(item)), el('p', `${item.correct}/${item.total} câu đúng`, 'score-text'), el('p', item.needs_review ? 'Máy chủ đã nhận · Chờ xem tự luận' : 'Máy chủ đã nhận', 'meta'));
    target.append(row);
  }
  if (!target.childElementCount) {const card = empty(target, 'Chưa có bài nộp', 'Luyện tập một bài để bắt đầu ghi nhận tiến độ.'); card.append(button('Chọn bài tập', () => {show('practice'); renderPractice();}, 'primary'));}
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
  await db.remove('meta', 'session'); identityUI(); renderCatalog(); show('catalog');
  /** @type {HTMLDialogElement} */ (node('login-dialog')).close();
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
      draft = null; locked = false; identityUI(); renderCatalog();
      if (active) {
        const course = catalog?.courses.find(item => item.id === active?.course_id);
        if (course && course.grade !== session.identity.grade) {active = null; draft = null; locked = false; show('catalog'); updateResume();}
        else {
          await openLesson(active);
          if (guestLesson && guestAnswers) await adoptGuestAnswers(guestLesson, /** @type {Record<string,string>} */ (guestAnswers));
        }
      }
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
on('close-tutor', closeTutor);
form('tutor-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!navigator.onLine) { notify('Cần kết nối mạng để gửi câu hỏi.', true); return; }
  if (!active || tutorPending) return;
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
      course_id: active.course_id,
      lesson_id: active.lesson_id,
      message: text,
      history: tutorHistory,
      question_id: tutorQuestionId || undefined,
      selected_option: tutorQuestionId && draft?.answers[tutorQuestionId] ? draft.answers[tutorQuestionId] : undefined,
      attempt_count: 1
    };
    /** @type {import('./contracts').TutorResponse} */
    const res = await api('/pwa/tutor', { method: 'POST', body: payload });
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
  const tabs = ['catalog-view', 'practice-view', 'lesson-view', 'downloads-view', 'progress-view', 'materials-view'];
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
  meta.setAttribute('content', dark ? '#111113' : '#ffffff');
}
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('aisgk-theme', next); } catch { /* chế độ riêng tư: chỉ đổi trong phiên */ }
  syncThemeButton();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeButton);
syncThemeButton();
