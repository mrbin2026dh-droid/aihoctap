// @ts-check
// Tab Thi của học sinh: danh sách đề, màn hình làm bài (đồng hồ theo máy chủ, bảng câu hỏi, tự lưu), nộp bài và kết quả.
import { api, ApiError } from './api.js';
import { el, icon, confirmBox, renderMarkdown } from './dom.js';

/** @typedef {{exam_id:string,title:string,mode:'trial'|'real',kind:string,minutes:number|null,opens_at:number|null,closes_at:number|null,state:string,question_count:number,total_points:number,attempts_used:number,attempts_left:number|null,best_score:number|null,in_progress:boolean}} ExamItem */
/** @typedef {{id:string,kind:string,prompt:string,options?:Record<string,string>,hint?:string,topic?:string,points:number}} ExamQuestion */

const KIND_LABEL = { '15m': 'Kiểm tra 15 phút', period: 'Kiểm tra 1 tiết', midterm: 'Giữa kỳ', final: 'Cuối kỳ' };
const AUTOSAVE_MS = 1500;
const HEARTBEAT_MS = 30000;

/** @type {{getToken:()=>string|null,getUid:()=>string,onClose:()=>void}|null} */
let host = null;
/** Thiết lập nguồn token/uid của học sinh. @param {{getToken:()=>string|null,getUid:()=>string,onClose:()=>void}} h */
export function initExams(h) { host = h; }

/** @param {number|null} ms */
function fmtTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}
/** @param {number} sec */
export function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
/** @param {ExamItem} e */
function stateText(e) {
  if (e.in_progress) return 'Đang làm dở';
  if (e.mode === 'trial') return 'Luyện tập';
  if (e.state === 'upcoming') return `Mở lúc ${fmtTime(e.opens_at)}`;
  if (e.state === 'closed') return 'Đã đóng';
  return e.closes_at ? `Đóng lúc ${fmtTime(e.closes_at)}` : 'Đang mở';
}

/** @param {HTMLElement} target @param {boolean} loggedIn */
export async function renderExamList(target, loggedIn) {
  target.replaceChildren();
  const note = (/** @type {string} */ title, /** @type {string} */ body) => {
    const box = el('div', '', 'empty'); box.append(icon('exam', 'ic empty-ic'), el('h2', title), el('p', body)); target.append(box);
  };
  if (!loggedIn || !host?.getToken()) { note('Đăng nhập để xem bài kiểm tra', 'Bài kiểm tra do giáo viên mở cho lớp của em sẽ hiện ở đây.'); return; }
  target.append(el('p', 'Đang tải danh sách bài kiểm tra…', 'muted'));
  /** @type {{exams:ExamItem[]}} */ let data;
  try { data = await api('/pwa/exams', { token: host.getToken() || '' }); }
  catch (error) { target.replaceChildren(); note('Chưa tải được bài kiểm tra', error instanceof Error ? error.message : 'Hãy thử lại sau.'); return; }
  target.replaceChildren();
  if (!data.exams.length) { note('Chưa có bài kiểm tra', 'Khi giáo viên mở bài kiểm tra cho lớp của em, bài sẽ hiện ở đây. Bài luyện tập vẫn nằm ở mục Luyện tập.'); return; }
  const list = el('div', '', 'exam-list');
  for (const e of data.exams) list.append(examCard(e, target));
  target.append(list);
}

/** @param {ExamItem} e @param {HTMLElement} target */
function examCard(e, target) {
  const card = el('article', '', `exam-card ${e.mode === 'real' ? 'is-real' : 'is-trial'}`);
  const head = el('div', '', 'exam-card-head');
  head.append(el('span', e.mode === 'real' ? 'Thi thật' : 'Thi thử', `exam-badge ${e.mode}`), el('span', KIND_LABEL[/** @type {keyof typeof KIND_LABEL} */ (e.kind)] || 'Bài kiểm tra', 'exam-kind'));
  const meta = [`${e.question_count} câu`, `${e.total_points} điểm`];
  if (e.mode === 'real' && e.minutes) meta.push(`${e.minutes} phút`);
  if (e.mode === 'real' && e.attempts_left !== null) meta.push(`còn ${e.attempts_left} lượt`);
  const best = e.best_score === null || e.best_score === undefined ? '' : `Điểm cao nhất: ${e.best_score}`;
  const foot = el('div', '', 'exam-card-foot');
  const status = el('span', stateText(e), `exam-state state-${e.in_progress ? 'progress' : e.state}`);
  const canStart = e.in_progress || (e.state === 'open' && (e.mode === 'trial' || (e.attempts_left ?? 0) > 0));
  const label = e.in_progress ? 'Tiếp tục làm bài' : e.mode === 'trial' ? (e.attempts_used ? 'Làm lại' : 'Làm thử') : 'Vào thi';
  const go = el('button', label, 'primary exam-go'); go.type = 'button'; go.disabled = !canStart;
  if (!canStart) go.title = e.state === 'upcoming' ? 'Chưa đến giờ mở' : e.state === 'closed' ? 'Bài đã đóng' : 'Đã hết lượt làm bài';
  go.addEventListener('click', () => { void startExam(e, target); });
  foot.append(status, go);
  card.append(head, el('h2', e.title, 'exam-title'), el('p', meta.join(' · '), 'exam-meta'));
  if (best) card.append(el('p', best, 'exam-best'));
  card.append(foot);
  return card;
}

/** @param {ExamItem} e @param {HTMLElement} target */
async function startExam(e, target) {
  const token = host?.getToken(); if (!token) return;
  if (!e.in_progress && e.mode === 'real') {
    const lines = [`Bài có ${e.question_count} câu, ${e.total_points} điểm.`, e.minutes ? `Thời gian làm bài ${e.minutes} phút, đồng hồ chạy ngay khi em bấm Bắt đầu và không dừng lại được.` : '', e.attempts_left !== null ? `Em còn ${e.attempts_left} lượt làm bài. Lượt này được tính khi em bắt đầu.` : '', 'Nếu mất mạng, bài vẫn được lưu trên máy và em có thể vào lại để làm tiếp trong thời gian còn lại.'].filter(Boolean);
    const ok = await confirmBox({ title: `Bắt đầu "${e.title}"?`, body: lines.join('\n'), okText: 'Bắt đầu thi', cancelText: 'Để sau' });
    if (!ok) return;
  }
  try {
    const data = await api('/pwa/exams/start', { method: 'POST', token, body: { exam_id: e.exam_id } });
    openSession(/** @type {any} */ (data), () => { void renderExamList(target, true); });
  } catch (error) {
    await confirmBox({ title: 'Chưa vào được bài kiểm tra', body: error instanceof Error ? error.message : 'Hãy thử lại.', okText: 'Đã hiểu', kind: 'notice' });
    void renderExamList(target, true);
  }
}

/**
 * Phiên làm bài đang mở. Toàn bộ trạng thái nằm ở đây để màn hình chỉ việc vẽ lại.
 * @typedef {{exam_id:string,title:string,mode:'trial'|'real',minutes:number|null,total_points:number,questions:ExamQuestion[],attempt_id:string,attempt_no:number,deadline:number|null,answers:Record<string,string>,server_now:number}} Start
 */
/** @param {Start} data @param {()=>void} afterClose */
function openSession(data, afterClose) {
  const uid = host?.getUid() || '';
  const localKey = `aisgk-exam:${uid}:${data.exam_id}`;
  /** @type {{attempt_id?:string,answers?:Record<string,string>,flags?:string[],leaves?:number}} */ let local = {};
  try { local = JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { local = {}; }
  const sameAttempt = local.attempt_id === data.attempt_id;
  /** @type {Record<string,string>} */ const answers = { ...(data.answers || {}), ...(sameAttempt ? local.answers || {} : {}) };
  const flags = new Set(sameAttempt ? local.flags || [] : []);
  let leaves = sameAttempt ? local.leaves || 0 : 0;
  const offset = data.server_now - Date.now();
  const real = data.mode === 'real' && Boolean(data.deadline);
  const questions = data.questions;
  let current = 0; let dirty = Object.keys(answers).length > 0 && sameAttempt; let finished = false; let submitting = false;
  let lastSaved = /** @type {number|null} */ (null); let saveTimer = 0; let saving = false; let saveFailed = false;
  /** @type {number} */ let tick = 0; let heartbeat = 0;

  const root = /** @type {HTMLElement} */ (document.getElementById('exam-screen'));
  root.hidden = false; root.replaceChildren();
  document.body.classList.add('exam-open');
  const previousFocus = document.activeElement;

  const bar = el('header', '', 'ex-bar');
  const title = el('div', '', 'ex-title');
  title.append(el('strong', data.title), el('span', data.mode === 'real' ? `Thi thật · lượt ${data.attempt_no}` : 'Thi thử · không giới hạn giờ'));
  const clock = el('div', '', 'ex-clock'); clock.setAttribute('role', 'timer'); clock.setAttribute('aria-label', 'Thời gian còn lại');
  const exit = el('button', data.mode === 'trial' ? 'Thoát' : 'Tạm rời', 'ex-exit'); exit.type = 'button';
  const submit = el('button', 'Nộp bài', 'primary ex-submit'); submit.type = 'button';
  bar.append(title, clock, exit, submit);
  if (!real) clock.hidden = true;

  const body = el('div', '', 'ex-body');
  const stage = el('main', '', 'ex-stage'); stage.id = 'ex-stage';
  const side = el('aside', '', 'ex-side'); side.setAttribute('aria-label', 'Bảng câu hỏi');
  const paletteTitle = el('h2', 'Bảng câu hỏi', 'ex-side-title');
  const palette = el('div', '', 'ex-palette');
  const legend = el('p', '', 'ex-legend');
  legend.innerHTML = '<span class="lg lg-done"></span>Đã trả lời <span class="lg lg-flag"></span>Đánh dấu <span class="lg lg-none"></span>Chưa làm';
  const counts = el('p', '', 'ex-counts');
  side.append(paletteTitle, palette, legend, counts);
  const foot = el('footer', '', 'ex-foot');
  const status = el('span', '', 'ex-save'); status.setAttribute('role', 'status');
  const prev = el('button', '‹ Câu trước', 'ex-nav'); prev.type = 'button';
  const flagBtn = el('button', '', 'ex-flag'); flagBtn.type = 'button';
  const next = el('button', 'Câu sau ›', 'ex-nav'); next.type = 'button';
  const paletteToggle = el('button', 'Bảng câu', 'ex-pal-toggle'); paletteToggle.type = 'button'; paletteToggle.setAttribute('aria-expanded', 'false');
  foot.append(status, prev, flagBtn, next, paletteToggle);
  body.append(stage, side);
  root.append(bar, body, foot);

  const remainingSec = () => real && data.deadline ? (data.deadline - (Date.now() + offset)) / 1000 : Infinity;
  const answered = () => questions.filter(q => (answers[q.id] || '').trim()).length;

  const persistLocal = () => { try { localStorage.setItem(localKey, JSON.stringify({ attempt_id: data.attempt_id, answers, flags: [...flags], leaves })); } catch { /* bỏ qua */ } };
  const setStatus = (/** @type {string} */ text, bad = false) => { status.textContent = text; status.classList.toggle('bad', bad); };

  async function save() {
    if (finished || submitting || saving) return;
    persistLocal();
    saving = true; setStatus('Đang lưu…');
    try {
      await api('/pwa/exams/save', { method: 'PUT', token: host?.getToken() || '', body: { exam_id: data.exam_id, attempt_id: data.attempt_id, answers, leaves } });
      dirty = false; saveFailed = false; lastSaved = Date.now();
      setStatus(`Đã lưu ${new Date(lastSaved).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
    } catch (error) {
      saveFailed = true;
      const hard = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401;
      setStatus(hard ? error.message : 'Chưa lưu lên máy chủ, bài vẫn được giữ trên máy. Sẽ thử lại.', true);
      if (hard && real && remainingSec() <= 0) void doSubmit(true);
    } finally { saving = false; }
  }
  const scheduleSave = () => { dirty = true; persistLocal(); clearTimeout(saveTimer); saveTimer = window.setTimeout(() => { void save(); }, AUTOSAVE_MS); };

  function renderPalette() {
    palette.replaceChildren();
    questions.forEach((q, i) => {
      const b = el('button', String(i + 1), `ex-pn${i === current ? ' is-current' : ''}${(answers[q.id] || '').trim() ? ' is-done' : ''}${flags.has(q.id) ? ' is-flag' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-label', `Câu ${i + 1}${(answers[q.id] || '').trim() ? ', đã trả lời' : ', chưa trả lời'}${flags.has(q.id) ? ', đã đánh dấu' : ''}`);
      if (i === current) b.setAttribute('aria-current', 'step');
      b.addEventListener('click', () => { go(i); closePalette(); });
      palette.append(b);
    });
    counts.textContent = `Đã trả lời ${answered()}/${questions.length} · Đánh dấu ${flags.size}`;
  }
  function closePalette() { side.classList.remove('is-open'); paletteToggle.setAttribute('aria-expanded', 'false'); }

  function renderQuestion() {
    const q = questions[current]; stage.replaceChildren();
    const card = el('section', '', 'ex-card'); card.setAttribute('aria-labelledby', 'ex-q-title');
    const head = el('div', '', 'ex-q-head');
    const h = el('h1', `Câu ${current + 1}/${questions.length}`, 'ex-q-num'); h.id = 'ex-q-title';
    head.append(h, el('span', `${q.points} điểm`, 'ex-q-pts'));
    const prompt = el('div', '', 'ex-prompt'); renderMarkdown(prompt, q.prompt);
    card.append(head, prompt);
    if (q.kind === 'choice' && q.options) {
      const group = el('div', '', 'ex-options'); group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-labelledby', 'ex-q-title');
      for (const [key, text] of Object.entries(q.options)) {
        const on = answers[q.id] === key;
        const o = el('button', '', `ex-opt${on ? ' is-on' : ''}`); o.type = 'button'; o.setAttribute('role', 'radio'); o.setAttribute('aria-checked', String(on)); o.dataset.key = key;
        o.append(el('span', key, 'ex-opt-key'), el('span', text, 'ex-opt-text'));
        o.addEventListener('click', () => { if (answers[q.id] === key) delete answers[q.id]; else answers[q.id] = key; scheduleSave(); renderQuestion(); renderPalette(); });
        group.append(o);
      }
      card.append(group);
    } else {
      const area = document.createElement('textarea'); area.className = 'ex-text'; area.rows = 8; area.maxLength = 4000; area.value = answers[q.id] || '';
      area.setAttribute('aria-label', `Câu trả lời câu ${current + 1}`); area.placeholder = 'Viết câu trả lời của em ở đây';
      const count = el('span', `${area.value.length}/4000`, 'ex-count');
      area.addEventListener('input', () => { if (area.value.trim()) answers[q.id] = area.value; else delete answers[q.id]; count.textContent = `${area.value.length}/4000`; scheduleSave(); renderPalette(); });
      card.append(area, count);
    }
    stage.append(card);
    prev.disabled = current === 0; next.disabled = current === questions.length - 1;
    const flagged = flags.has(q.id);
    flagBtn.textContent = flagged ? '⚑ Bỏ đánh dấu' : '⚐ Đánh dấu xem lại'; flagBtn.setAttribute('aria-pressed', String(flagged));
  }
  /** @param {number} i */
  function go(i) { current = Math.max(0, Math.min(questions.length - 1, i)); renderQuestion(); renderPalette(); stage.scrollTo?.(0, 0); }

  prev.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  flagBtn.addEventListener('click', () => { const id = questions[current].id; if (flags.has(id)) flags.delete(id); else flags.add(id); persistLocal(); renderQuestion(); renderPalette(); });
  paletteToggle.addEventListener('click', () => { const open = side.classList.toggle('is-open'); paletteToggle.setAttribute('aria-expanded', String(open)); });

  const onKey = (/** @type {KeyboardEvent} */ ev) => {
    if (finished || document.querySelector('dialog[open]')) return;
    const t = /** @type {HTMLElement} */ (ev.target);
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); go(current + 1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(current - 1); }
    else if (/^[a-dA-D]$/.test(ev.key) && questions[current].kind === 'choice') { const b = /** @type {HTMLElement|null} */ (stage.querySelector(`.ex-opt[data-key="${ev.key.toUpperCase()}"]`)); b?.click(); }
    else if (ev.key.toLowerCase() === 'f') flagBtn.click();
  };
  const onVisibility = () => { if (document.hidden && real && !finished) { leaves += 1; persistLocal(); void save(); } };
  const onOnline = () => { if (!finished && (dirty || saveFailed)) void save(); };
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVisibility); window.addEventListener('online', onOnline);

  let warned5 = false; let warned1 = false;
  function updateClock() {
    if (!real) return;
    const left = remainingSec();
    clock.textContent = fmtClock(left);
    clock.classList.toggle('warn', left <= 300); clock.classList.toggle('danger', left <= 60);
    if (left <= 300 && !warned5) { warned5 = true; setStatus('Còn 5 phút. Hãy kiểm tra lại bài làm.'); }
    if (left <= 60 && !warned1) { warned1 = true; setStatus('Còn 1 phút, bài sẽ tự nộp khi hết giờ.', true); }
    if (left <= 0 && !finished && !submitting) void doSubmit(true);
  }

  function cleanup() {
    clearInterval(tick); clearInterval(heartbeat); clearTimeout(saveTimer);
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('online', onOnline);
  }
  function close() {
    cleanup(); root.hidden = true; root.replaceChildren(); document.body.classList.remove('exam-open');
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
    afterClose();
  }

  /** @param {boolean} auto */
  async function doSubmit(auto) {
    if (finished || submitting) return;
    if (!auto) {
      const blank = questions.length - answered();
      const parts = [`Em đã trả lời ${answered()}/${questions.length} câu.`];
      if (blank) parts.push(`Còn ${blank} câu chưa trả lời.`);
      if (flags.size) parts.push(`Có ${flags.size} câu đang đánh dấu xem lại.`);
      parts.push('Sau khi nộp, em không sửa được bài.');
      const ok = await confirmBox({ title: 'Nộp bài?', body: parts.join('\n'), okText: 'Nộp bài', cancelText: 'Làm tiếp' });
      if (!ok || finished || submitting) return;
    }
    submitting = true; submit.disabled = true; clearTimeout(saveTimer);
    let attempt = 0;
    for (;;) {
      setStatus(auto ? 'Hết giờ, đang nộp bài…' : 'Đang nộp bài…');
      try {
        const ack = await api('/pwa/exams/submit', { method: 'POST', token: host?.getToken() || '', body: { exam_id: data.exam_id, attempt_id: data.attempt_id, answers } });
        finished = true; try { localStorage.removeItem(localKey); } catch { /* bỏ qua */ }
        cleanup(); showResult(/** @type {any} */ (ack)); return;
      } catch (error) {
        if (error instanceof ApiError && error.status !== 0 && error.status < 500 && error.status !== 401) {
          submitting = false; submit.disabled = false; setStatus(error.message, true);
          await confirmBox({ title: 'Chưa nộp được bài', body: error.message, okText: 'Đã hiểu', kind: 'notice' }); return;
        }
        attempt += 1; setStatus(`Chưa nộp được (mất mạng?). Bài vẫn được giữ trên máy, tự thử lại sau ${Math.min(10, attempt * 2)} giây…`, true);
        await new Promise(r => setTimeout(r, Math.min(10, attempt * 2) * 1000));
      }
    }
  }

  /** @param {{score:number,earned:number,total_points:number,correct:number,total:number,needs_review?:number,late?:boolean,message?:string,answers_key?:Record<string,string>}} ack */
  function showResult(ack) {
    root.replaceChildren();
    const wrap = el('main', '', 'ex-result'); wrap.id = 'ex-result';
    const hero = el('section', '', 'ex-result-hero');
    hero.append(icon('exam', 'ic ex-result-ic'), el('h1', 'Em đã nộp bài'), el('p', data.title, 'ex-result-title'));
    const big = el('div', '', 'ex-score'); big.append(el('strong', String(ack.score)), el('span', '/10'));
    const grid = el('div', '', 'ex-result-grid');
    const tile = (/** @type {string} */ label, /** @type {string} */ value) => { const t = el('div', '', 'ex-tile'); t.append(el('span', label), el('strong', value)); return t; };
    grid.append(tile('Điểm đạt được', `${ack.earned}/${ack.total_points}`), tile('Câu đúng', `${ack.correct}/${ack.total}`), tile('Đã trả lời', `${answered()}/${questions.length}`));
    hero.append(big, grid);
    if (ack.needs_review) hero.append(el('p', `Có ${ack.needs_review} câu tự luận chờ thầy cô chấm. Điểm có thể tăng sau khi chấm.`, 'ex-note'));
    if (ack.late) hero.append(el('p', ack.message || 'Bài được nộp sau giờ; chỉ tính phần đã lưu trước khi hết giờ.', 'ex-note warn'));
    wrap.append(hero);
    if (ack.answers_key) {
      const key = ack.answers_key;
      const review = el('section', '', 'ex-review'); review.append(el('h2', 'Đối chiếu đáp án'));
      questions.forEach((q, i) => {
        const mine = (answers[q.id] || '').trim(); const right = key[q.id];
        const ok = q.kind === 'choice' && mine === right;
        const row = el('div', '', `ex-review-row ${q.kind !== 'choice' ? 'is-text' : ok ? 'is-ok' : 'is-bad'}`);
        row.append(el('strong', `Câu ${i + 1}`));
        const p = el('div', '', 'ex-review-prompt'); renderMarkdown(p, q.prompt); row.append(p);
        if (q.kind === 'choice' && q.options) {
          row.append(el('p', mine ? `Em chọn: ${mine}. ${q.options[mine] || ''}` : 'Em chưa trả lời.', 'ex-mine'));
          if (!ok) row.append(el('p', `Đáp án đúng: ${right}. ${q.options[right] || ''}`, 'ex-right'));
        } else {
          row.append(el('p', mine ? `Bài làm của em: ${mine}` : 'Em chưa trả lời.', 'ex-mine'));
          if (right) row.append(el('p', `Gợi ý đáp án: ${right}`, 'ex-right'));
        }
        review.append(row);
      });
      wrap.append(review);
    } else if (data.mode === 'real') {
      wrap.append(el('p', 'Đáp án sẽ được mở theo cài đặt của giáo viên.', 'ex-note'));
    }
    const actions = el('div', '', 'ex-result-actions');
    const back = el('button', 'Về danh sách bài thi', 'primary'); back.type = 'button'; back.addEventListener('click', close);
    actions.append(back);
    wrap.append(actions); root.append(wrap);
    back.focus();
  }

  exit.addEventListener('click', async () => {
    if (finished) return;
    const ok = await confirmBox({ title: data.mode === 'trial' ? 'Thoát bài thi thử?' : 'Tạm rời bài thi?', body: real ? 'Đồng hồ vẫn chạy khi em rời đi. Em có thể vào lại để làm tiếp trong thời gian còn lại.' : 'Bài làm dở được giữ lại, em có thể làm tiếp sau.', okText: 'Thoát', cancelText: 'Ở lại' });
    if (!ok) return;
    await save(); cleanup(); close();
  });
  submit.addEventListener('click', () => { void doSubmit(false); });

  renderQuestion(); renderPalette(); updateClock();
  setStatus(sameAttempt && Object.keys(local.answers || {}).length ? 'Đã khôi phục bài đang làm.' : 'Bài làm tự động lưu.');
  if (real) tick = window.setInterval(updateClock, 1000);
  heartbeat = window.setInterval(() => { if (dirty || saveFailed) void save(); }, HEARTBEAT_MS);
  (stage.querySelector('.ex-opt, textarea') instanceof HTMLElement ? /** @type {HTMLElement} */ (stage.querySelector('.ex-opt, textarea')) : stage).focus?.();
  if (dirty) void save();
}
