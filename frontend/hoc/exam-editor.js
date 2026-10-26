// @ts-check
// Trình sửa câu hỏi của đề kiểm tra: hiện từng câu thành thẻ để giáo viên sửa trực tiếp, thêm, xóa rồi lưu.
import {el, button} from './dom.js';
import * as ui from './teacher-ui.js';

/** @typedef {{id?:string,row?:number,kind:'choice'|'text',prompt:string,options:Record<string,string>,correct_answer:string,points:number,topic:string,hint:string}} EditorQuestion */
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Mã câu mới không trùng mã đang có.
 * @param {EditorQuestion[]} list */
function nextId(list) {
  let max = 0; for (const q of list) { const m = /^q(\d+)$/.exec(q.id || ''); if (m) max = Math.max(max, Number(m[1])); }
  return `q${Math.max(max, list.length) + 1}`;
}
/** Bảo đảm mọi câu có mã duy nhất.
 * @param {EditorQuestion[]} list */
export function ensureIds(list) {
  const seen = new Set(); for (const q of list) { if (!q.id || seen.has(q.id)) q.id = nextId(list.filter(x => x !== q)); seen.add(q.id); }
}
/** @param {EditorQuestion[]} list */
export function totalPoints(list) { return Math.round(list.reduce((s, q) => s + (Number(q.points) > 0 ? Number(q.points) : 0), 0) * 100) / 100; }

/** Kiểm tra trước khi lưu; trả về lời nhắc tiếng Việt hoặc '' nếu hợp lệ.
 * @param {EditorQuestion[]} list */
export function validateQuestions(list) {
  if (!list.length) return 'Chưa có câu hỏi. Bấm "Thêm câu trắc nghiệm" hoặc tải file Excel.';
  for (let i = 0; i < list.length; i++) {
    const q = list[i]; const n = i + 1;
    if (!String(q.prompt || '').trim()) return `Câu ${n}: chưa nhập nội dung câu hỏi.`;
    const p = Number(q.points);
    if (!(p > 0 && p <= 100) || Math.round(p * 100) / 100 !== p) return `Câu ${n}: điểm phải lớn hơn 0, tối đa 100, nhiều nhất 2 chữ số thập phân.`;
    if (q.kind === 'choice') {
      const filled = KEYS.filter(k => String(q.options?.[k] || '').trim());
      if (filled.length < 2) return `Câu ${n}: trắc nghiệm cần ít nhất 2 đáp án có nội dung.`;
      if (!filled.includes(String(q.correct_answer))) return `Câu ${n}: hãy chọn đáp án đúng trong các đáp án đã nhập.`;
    }
  }
  return '';
}
/** Dữ liệu gửi lên máy chủ (bỏ đáp án trống, tự luận không có lựa chọn).
 * @param {EditorQuestion[]} list */
export function toPayload(list) {
  ensureIds(list);
  return list.map(q => {
    /** @type {Record<string,string>} */ const options = {};
    if (q.kind === 'choice') for (const k of KEYS) { const v = String(q.options?.[k] || '').trim(); if (v) options[k] = v; }
    return {id: q.id, kind: q.kind, prompt: q.prompt.trim(), options, correct_answer: q.kind === 'choice' ? q.correct_answer : '', points: Number(q.points), topic: (q.topic || '').trim(), hint: (q.hint || '').trim()};
  });
}

/** Vẽ trình sửa vào container; mọi thay đổi ghi thẳng vào mảng do getList() trả về.
 * @param {HTMLElement} container @param {() => EditorQuestion[]} getList @param {(list: EditorQuestion[]) => void} setList */
export function renderEditor(container, getList, setList) {
  const redraw = () => renderEditor(container, getList, setList);
  const list = getList(); ensureIds(list);
  container.replaceChildren();
  const bar = el('div', '', 't-qe-bar');
  const total = el('p', '', 't-qe-total'); total.id = 'exam-total-points'; total.setAttribute('role', 'status');
  const updateTotal = () => { total.textContent = `${getList().length} câu · tổng ${String(totalPoints(getList())).replace('.', ',')} điểm (quy về thang 10)`; };
  const addBtn = (/** @type {string} */ label, /** @type {'choice'|'text'} */ kind) => {
    const b = button(label, () => {
      const cur = getList(); const q = /** @type {EditorQuestion} */ ({id: nextId(cur), kind, prompt: '', options: kind === 'choice' ? {A: '', B: '', C: '', D: ''} : {}, correct_answer: kind === 'choice' ? 'A' : '', points: 1, topic: '', hint: ''});
      setList([...cur, q]); redraw();
      const cards = container.querySelectorAll('.t-qe-card'); /** @type {HTMLElement|null} */ (cards[cards.length - 1]?.querySelector('textarea'))?.focus();
    }, 't-button'); b.dataset.qeAdd = kind; return b;
  };
  bar.append(total, el('div', '', 't-qe-add', [addBtn('Thêm câu trắc nghiệm', 'choice'), addBtn('Thêm câu tự luận', 'text')]));
  container.append(bar); updateTotal();
  if (!list.length) container.append(el('p', 'Chưa có câu hỏi. Thêm câu trắc nghiệm, tự luận hoặc tải file Excel.', 't-muted'));

  list.forEach((q, i) => {
    const card = el('article', '', 't-card t-qe-card'); card.dataset.qid = q.id || '';
    const head = el('div', '', 't-qe-head'); head.append(el('h4', `Câu ${i + 1}`));
    const kind = el('select'); kind.setAttribute('aria-label', `Loại câu ${i + 1}`);
    for (const [v, t] of [['choice', 'Trắc nghiệm'], ['text', 'Tự luận']]) { const o = el('option', t); o.value = v; kind.append(o); }
    kind.value = q.kind;
    const pts = el('input'); pts.type = 'number'; pts.min = '0.25'; pts.max = '100'; pts.step = '0.25'; pts.value = String(q.points ?? 1); pts.setAttribute('aria-label', `Điểm câu ${i + 1}`); pts.className = 't-qe-points';
    pts.addEventListener('input', () => { q.points = Number(pts.value); updateTotal(); });
    const ptsWrap = el('label', 'Điểm', 't-qe-pts'); ptsWrap.append(pts);
    const del = ui.toIcon(/** @type {HTMLButtonElement} */ (button('Xóa', () => { setList(getList().filter(x => x !== q)); redraw(); })), 'trash', `Xóa câu ${i + 1}`, true);
    head.append(kind, ptsWrap, del); card.append(head);

    const promptL = el('label', 'Nội dung câu hỏi', 't-field'); const prompt = el('textarea'); prompt.rows = 2; prompt.maxLength = 2000; prompt.value = q.prompt || '';
    prompt.addEventListener('input', () => { q.prompt = prompt.value; }); promptL.append(prompt); card.append(promptL);

    const opts = el('div', '', 't-qe-options'); opts.setAttribute('role', 'radiogroup'); opts.setAttribute('aria-label', `Đáp án câu ${i + 1}; chọn vòng tròn ở đáp án đúng`);
    const keys = KEYS.filter((k, idx) => idx < 4 || (q.options && q.options[k]));
    for (const k of keys) {
      const row = el('div', '', 't-qe-opt'); const radio = el('input'); radio.type = 'radio'; radio.name = `correct-${q.id}`; radio.value = k; radio.checked = q.correct_answer === k;
      radio.setAttribute('aria-label', `Đáp án đúng là ${k}`); radio.addEventListener('change', () => { q.correct_answer = k; });
      const text = el('input'); text.type = 'text'; text.maxLength = 2000; text.value = (q.options && q.options[k]) || ''; text.setAttribute('aria-label', `Đáp án ${k} của câu ${i + 1}`); text.placeholder = `Đáp án ${k}`;
      text.addEventListener('input', () => { q.options = {...(q.options || {}), [k]: text.value}; });
      row.append(el('span', k, 't-qe-key'), text, radio); opts.append(row);
    }
    card.append(opts);

    const metaL1 = el('label', 'Chủ đề kiến thức', 't-field'); const topic = el('input'); topic.type = 'text'; topic.maxLength = 60; topic.value = q.topic || ''; topic.addEventListener('input', () => { q.topic = topic.value; }); metaL1.append(topic);
    const metaL2 = el('label', 'Gợi ý (không ghi đáp án)', 't-field'); const hint = el('input'); hint.type = 'text'; hint.maxLength = 1000; hint.value = q.hint || ''; hint.addEventListener('input', () => { q.hint = hint.value; }); metaL2.append(hint);
    card.append(el('div', '', 't-qe-meta', [metaL1, metaL2]));
    const sync = () => { opts.hidden = q.kind === 'text'; };
    kind.addEventListener('change', () => {
      q.kind = /** @type {'choice'|'text'} */ (kind.value);
      if (q.kind === 'choice') { q.options = {A: '', B: '', C: '', D: '', ...(q.options || {})}; if (!q.correct_answer) q.correct_answer = 'A'; if (!opts.childElementCount) redraw(); }
      sync();
    });
    sync(); container.append(card);
  });
}
