// @ts-check
import { api, ApiError, verifyPackage } from './api.js';
import * as db from './db.js';
import { el, button, notify, renderMarkdown } from './dom.js';

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
  dialog.showModal();
  /** @type {HTMLInputElement} */ (node('tutor-input')).focus();
}

function closeTutor() {
  /** @type {HTMLDialogElement} */ (node('tutor-dialog')).close();
}


/** @param {Error} error */
function report(error) { notify(error.message, true); }
/** @param {string} id @param {(event:Event)=>void|Promise<void>} action */
function on(id, action) { node(id).addEventListener('click', event => { Promise.resolve(action(event)).catch(report); }); }
function identityUI() {
  node('login').hidden = Boolean(session);
  node('account').hidden = !session;
  node('account').textContent = session ? session.identity.student_name || 'Tài khoản' : 'Tài khoản';
  node('logout').hidden = !session;
  node('login-form').hidden = Boolean(session);
  node('account-info').hidden = !session;
  node('account-info').textContent = session ? `${session.identity.student_name} · ${session.identity.class_code}` : '';
  if (session) /** @type {HTMLSelectElement} */ (node('grade')).value = String(session.identity.grade);
  /** @type {HTMLSelectElement} */ (node('grade')).disabled = Boolean(session);
  /** @type {HTMLButtonElement} */ (node('sync')).disabled = !session || !navigator.onLine;
}
/** @param {string} name */
function show(name) {
  viewGeneration++;
  currentView = name;
  for (const view of ['catalog', 'practice', 'lesson', 'downloads', 'progress']) node(`${view}-view`).hidden = view !== name;
  const destination = name === 'lesson' ? (practice ? 'practice' : 'catalog') : name;
  for (const tab of document.querySelectorAll('button[data-tab]')) {
    if (tab instanceof HTMLButtonElement && tab.dataset.tab === destination) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}
/** @param {string} text */
function fold(text) {return text.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');}
/** @param {HTMLElement} target @param {string} title @param {string} detail */
function empty(target, title, detail) {const card = el('div', '', 'empty-state'); card.append(el('h2', title), el('p', detail)); target.append(card); return card;}
function gradeCourses() {return catalog?.courses.filter(course => course.grade === Number(/** @type {HTMLSelectElement} */ (node('grade')).value)) || [];}
function updateResume() {node('resume-card').hidden = !active || !session || !draft || locked; node('resume-title').textContent = active?.title || '';}
/** @param {import('./contracts').Course} course @param {import('./contracts').LessonSummary} summary @param {boolean} [exerciseOnly] */
function lessonRow(course, summary, exerciseOnly = false) {
  const row = el('article', '', 'lesson-card'); const description = el('div', '', 'lesson-description');
  description.append(el('p', `${course.subject_name} · Lớp ${course.grade}`, 'meta'), el('h3', summary.title), el('p', `${summary.question_count} câu luyện tập`, 'meta'));
  const entry = button(exerciseOnly ? 'Luyện tập' : 'Mở bài', () => loadLesson(course.id, summary.id, summary.version, exerciseOnly), 'lesson-open');
  entry.dataset.lessonId = summary.id; entry.dataset.courseId = course.id;
  row.append(description, entry); return row;
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
    const card = el('article', '', 'course-card'); card.append(el('p', `${course.lessons.length} bài học`, 'meta'), el('h2', course.subject_name));
    const open = button(`Học ${course.subject_name}`, async () => {
      viewGeneration++;
      await saveDraft();
      selectedCourse = course.id; renderCatalog();
    });
    open.setAttribute('aria-pressed', String(selectedCourse === course.id));
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
    const tutorBtn = button('💡 Hỏi gợi ý AI', () => openTutor(question.id), 'question-tutor-btn');
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
}
/** @param {Ack} ack */
function renderResult(ack) {
  const target = node('result'); target.replaceChildren();
  target.append(el('h2', 'Kết quả bài làm'), el('p', `${ack.correct}/${ack.total} câu đúng${ack.needs_review ? ' · Tự luận chờ giáo viên xem.' : '.'}`, 'success'));
  for (const feedback of ack.feedback) {
    const question = active?.questions.find(item => item.id === feedback.id);
    const row = el('div', '', 'feedback-row'); row.append(el('strong', question?.prompt || feedback.id), el('p', feedback.correct === null ? 'Chờ giáo viên xem câu tự luận.' : (feedback.correct ? 'Em đã trả lời đúng.' : 'Chưa đúng. Em hãy xem lại bài.')));
    if (feedback.correct === false && feedback.hint) row.append(el('p', feedback.hint, 'hint'));
    target.append(row);
  }
  target.append(button('Làm lại', async () => {
    if (!draft || !active) return;
    const owner = session; const lesson = active; const generation = ++viewGeneration;
    await db.remove('drafts', draft.key);
    if (owner !== session || generation !== viewGeneration) return;
    draft = null; await openLesson(lesson, null, generation, owner, true); await saveDraft();
  }, 'primary'));
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
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) notify('Phiên đăng nhập cần kiểm tra. Bài chờ vẫn được giữ.', true);
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
on('account', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).showModal());
on('close-login', () => /** @type {HTMLDialogElement} */ (node('login-dialog')).close());
on('logout', async () => {
  viewGeneration++;
  await saveDraft(); session = null; active = null; draft = null; locked = false;
  await db.remove('meta', 'session'); identityUI(); renderCatalog(); show('catalog');
  /** @type {HTMLDialogElement} */ (node('login-dialog')).close();
  node('questions').replaceChildren(); node('result').replaceChildren(); node('progress').replaceChildren(); node('draft-status').textContent = '';
  notify('Đã đăng xuất. Nháp được giữ riêng theo tài khoản.');
});
form('login-form').addEventListener('submit', async event => {
  viewGeneration++;
  event.preventDefault(); node('login-error').textContent = '';
  const submitButton = /** @type {HTMLButtonElement} */ (form('login-form').querySelector('button[type=submit]'));
  submitButton.disabled = true;
  try {
    const guestLesson = !session ? active : null;
    const guestAnswers = guestLesson ? Object.fromEntries(new FormData(form('question-form')).entries()) : null;
    await saveDraft();
    const code = String(new FormData(form('login-form')).get('code') || '').trim();
    const response = await api('/student/lan-login', {method:'POST', body:{student_code:code}});
    const identity = await api('/pwa/me', {token:response.token});
    const next = {token:response.token, identity};
    await db.put('meta', 'session', next); session = next;
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
  } catch (error) { node('login-error').textContent = error instanceof Error ? error.message : 'Chưa đăng nhập được.'; }
  finally { submitButton.disabled = false; }
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
on('sync', async () => {await sync(); await progress();});
for (const tab of document.querySelectorAll('button[data-tab]')) tab.addEventListener('click', async () => {
  viewGeneration++;
  try {
    await saveDraft(); const name = /** @type {HTMLButtonElement} */ (tab).dataset.tab;
    if (name === 'downloads') await downloads();
    else if (name === 'progress') await progress();
    else if (name === 'practice') {show('practice'); renderPractice();}
    else {show('catalog'); renderCatalog();}
  } catch (error) {report(error instanceof Error ? error : new Error('Chưa chuyển được trang.'));}
});
function updateConnection() {node('connection').textContent = navigator.onLine ? 'Có kết nối mạng' : 'Đang offline'; node('connection').classList.toggle('is-offline', !navigator.onLine); /** @type {HTMLButtonElement} */ (node('sync')).disabled = !session || !navigator.onLine; updateTutorStatus();}
window.addEventListener('online', () => {updateConnection(); refreshCatalog().catch(report); sync().catch(report);});
window.addEventListener('offline', () => {updateConnection(); notify('Mất kết nối. Nháp vẫn được giữ trên máy.');});
window.addEventListener('focus', () => {refreshCatalog().catch(report);});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveDraft().catch(report);
  else {refreshCatalog().catch(report); sync().catch(report);}
});
on('update-app', async () => {
  await saveDraft();
  if (draft && !locked && Object.keys(draft.answers).length) {notify('Hoàn thành bài đang làm trước khi cập nhật ứng dụng.'); return;}
  registration?.waiting?.postMessage({type:'ACTIVATE'});
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First install claims the page; updates reload only after explicit activation.
    if (node('update-notice').hidden === false) location.reload();
  });
  navigator.serviceWorker.register('./sw.js', {scope:'./'}).then(result => {
    registration = result;
    const check = () => { if (result.waiting && navigator.serviceWorker.controller) node('update-notice').hidden = false; };
    check(); result.addEventListener('updatefound', () => result.installing?.addEventListener('statechange', check));
  }).catch(report);
}
/** @type {Event & {prompt:()=>Promise<void> }|null} */ let installPrompt = null;
let installedThisSession = false;
function installState() {
  const standalone = matchMedia('(display-mode: standalone)').matches;
  let label = 'Cài ứng dụng'; let detail = 'Trang hiện đang mở trong trình duyệt. Làm theo hướng dẫn phù hợp với thiết bị.';
  if (installedThisSession) {label = 'Đã cài ứng dụng'; detail = 'Trình duyệt đã xác nhận cài đặt. Em có thể mở từ biểu tượng SGK.';}
  if (standalone) {label = 'Đang dùng ứng dụng'; detail = 'Em đang mở ứng dụng ở chế độ độc lập.';}
  node('install').textContent = label; node('install-state').textContent = detail;
}
window.addEventListener('beforeinstallprompt', event => {event.preventDefault(); installPrompt = /** @type {typeof installPrompt} */ (event);});
window.addEventListener('appinstalled', () => {installPrompt = null; installedThisSession = true; installState(); notify('Trình duyệt đã xác nhận cài ứng dụng. Mở từ biểu tượng SGK để dùng.');});
on('install', async () => {
  if (installPrompt) {const prompt = installPrompt; installPrompt = null; await prompt.prompt();}
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
  } catch {
    loadingMsg.remove();
    const errMsg = el('div', '', 'tutor-msg tutor-bot');
    errMsg.append(el('p', 'Chưa kết nối được với Gia sư AI. Em hãy kiểm tra lại mạng hoặc thử lại sau nhé.'));
    msgs.append(errMsg);
  } finally {
    tutorPending = false;
    updateTutorStatus();
    msgs.scrollTop = msgs.scrollHeight;
    input.focus();
  }
});
installState(); updateConnection();
start().catch(error => {catalogUnavailable('Kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.'); report(error);});
