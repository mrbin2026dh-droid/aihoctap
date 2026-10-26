// @ts-check
/** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} [text] @param {string} [className] @param {Node[]} [children] */
export function el(tag, text = '', className = '', children = []) { const node = document.createElement(tag); node.textContent = text; node.className = className; if (children.length) node.append(...children); return node; }
/** @param {string} text @param {()=>void|Promise<void>} action @param {string} [className] */
export function button(text, action, className = '') {
  const node = el('button', text, className); node.type = 'button';
  node.addEventListener('click', () => { Promise.resolve(action()).catch(error => notify(error.message, true)); });
  return node;
}
const ICON_PATHS = {
  exam:'M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 14l2 2 4-4',
  trophy:'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3',
  target:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
  repeat:'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
  cap: 'M22 10 12 5 2 10l10 5 10-5z M6 12v5c3 2 9 2 12 0v-5',
  board: 'M3 4h18v11H3z M12 15v5 M8 20h8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  eyeoff: 'M3 3l18 18 M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8 M6.5 7.6A16.6 16.6 0 0 0 2 12s4 7 10 7c1.6 0 3-.4 4.3-1 M9.9 10a2.5 2.5 0 0 0 3.1 3.1',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  x: 'M6 6l12 12 M18 6L6 18',
  download: 'M12 4v11 M7 11l5 5 5-5 M5 20h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  wifi: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 20h.01',
  wifioff: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 20h.01 M3 3l18 18',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M9 7h6',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4z M14 6l4 4',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  refresh: 'M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5',
  inbox: 'M4 13l2-8h12l2 8 M4 13v6h16v-6 M4 13h5a3 3 0 0 0 6 0h5',
  check: 'M5 12.5l4.5 4.5L19 7',
  chart: 'M5 20V10 M12 20V4 M19 20v-7',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  file: 'M6 3h8l5 5v13H6z M14 3v5h5 M9 13h6 M9 17h6',
  send: 'M21 3L10 14 M21 3l-7 18-4-7-7-4z',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
  play: 'M8 5v14l11-7z'
};
/** Biểu tượng nét 24×24 (trang trí, ẩn khỏi trình đọc màn hình). @param {string} name @param {string} [cls] */
export function icon(name, cls = 'ic') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path'); path.setAttribute('d', ICON_PATHS[/** @type {keyof typeof ICON_PATHS} */ (name)] || ''); svg.append(path);
  return svg;
}
/** Thêm biểu tượng vào nút/liên kết; chữ được bọc trong span để căn hàng. @template {HTMLElement} T @param {T} node @param {string} name @param {boolean} [end] @returns {T} */
export function withIcon(node, name, end = false) {
  const text = node.textContent || ''; node.textContent = '';
  const label = document.createElement('span'); label.textContent = text;
  const svg = icon(name, end ? 'ic ic-end' : 'ic');
  if (end) node.append(label, svg); else node.append(svg, label);
  return node;
}
/** @param {string} text @param {boolean} [error] */
export function notify(text, error = false) { const node = document.getElementById('status'); if (node) {node.textContent = text; node.classList.toggle('error', error);} }
/** Safe restricted markdown: never parses raw HTML, links, embeds or event handlers.
 * @param {HTMLElement} container @param {string} markdown */
export function renderMarkdown(container, markdown) {
  container.replaceChildren();
  let code = false;
  /** @type {string[]} */
  let codeLines = [];
  const flushCode = () => {container.append(el('pre', codeLines.join('\n'))); codeLines = [];};
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {if (code) flushCode(); code = !code; continue;}
    if (code) {codeLines.push(line); continue;}
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {container.append(el(heading[1].length <= 2 ? 'h2' : 'h3', heading[2].replace(/\*\*/g,''))); continue;}
    if (/^---+$/.test(line.trim())) {container.append(el('hr')); continue;}
    if (line.startsWith('>')) {container.append(el('blockquote', line.slice(1).replace(/\*\*/g,'').trim())); continue;}
    const paragraph = el('p');
    const chunks = line.split(/(\*\*[^*]+\*\*)/g);
    for (const chunk of chunks) paragraph.append(chunk.startsWith('**') && chunk.endsWith('**') ? el('strong', chunk.slice(2,-2)) : document.createTextNode(chunk));
    container.append(paragraph);
  }
  if (codeLines.length) flushCode();
}

/**
 * Common modal dialog for alerts, confirms, notices and prompt inputs.
 * Returns Promise<boolean|string|null>
 * @param {{
 *   title: string,
 *   body: string,
 *   kind?: 'notice' | 'confirm' | 'prompt',
 *   okText?: string,
 *   cancelText?: string,
 *   danger?: boolean,
 *   field?: { label: string, value?: string } | null,
 *   validate?: ((value: string) => string) | null,
 *   fields?: Array<{ name: string, label: string, value?: string, validate?: ((value: string) => string) | null }> | null
 * }} options
 */
/** Mỗi lần chỉ một hộp thoại: các yêu cầu sau xếp hàng, hiện lần lượt (mỗi thông báo một hộp thoại).
 * Khi chưa có hộp thoại nào đang mở, hộp thoại mới mở ngay (đồng bộ).
 * @param {any} options @returns {Promise<any>} */
export function dialogBox(options) {
  return new Promise((resolve, reject) => {
    const start = () => {
      activeDialogs++;
      const release = () => { activeDialogs--; const next = waitingDialogs.shift(); if (next) next(); };
      showDialog(options).then(value => { release(); resolve(value); }, error => { release(); reject(error); });
    };
    if (activeDialogs === 0) start(); else waitingDialogs.push(start);
  });
}
let activeDialogs = 0;
/** @type {Array<() => void>} */
const waitingDialogs = [];
function showDialog({
  title,
  body,
  kind = 'notice',
  okText = 'Đồng ý',
  cancelText = 'Hủy',
  danger = false,
  field = null,
  validate = null,
  fields = null
}) {
  const d = /** @type {HTMLDialogElement} */ (document.getElementById('msg-dialog'));
  const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

  $('msg-title').textContent = title;
  $('msg-body').textContent = body;
  $('msg-ok').textContent = okText;
  $('msg-cancel').textContent = cancelText;
  $('msg-cancel').hidden = kind === 'notice';
  $('msg-ok').classList.toggle('danger-btn', danger);

  const fieldsContainer = document.getElementById('msg-fields');
  if (fieldsContainer) {
    fieldsContainer.replaceChildren();
    fieldsContainer.hidden = !fields || !fields.length;
  }

  $('msg-field').hidden = !field;
  $('msg-error').hidden = true;
  $('msg-error').textContent = '';

  if (fields && fields.length && fieldsContainer) {
    for (const f of fields) {
      const lbl = el('label');
      const sp = el('span', f.label);
      const inp = /** @type {HTMLInputElement} */ (el('input'));
      inp.name = f.name;
      inp.value = f.value || '';
      inp.autocomplete = 'off';
      const err = el('p', '', 'field-error');
      err.hidden = true;
      lbl.append(sp, inp, err);
      fieldsContainer.append(lbl);
    }
  } else if (field) {
    $('msg-field-label').textContent = field.label;
    /** @type {HTMLInputElement} */ ($('msg-input')).value = field.value || '';
  }

  const opener = /** @type {HTMLElement|null} */ (document.activeElement);
  return new Promise(resolve => {
    const done = (/** @type {boolean|string|Record<string,string>|null} */ v) => {
      d.close();
      cleanup();
      opener?.focus?.();
      resolve(v);
    };

    const onSubmit = (/** @type {Event} */ e) => {
      e.preventDefault();
      if (fields && fields.length && fieldsContainer) {
        /** @type {Record<string,string>} */
        const result = {};
        /** @type {HTMLInputElement|null} */
        let firstInvalid = null;
        for (const f of fields) {
          const inp = /** @type {HTMLInputElement|null} */ (fieldsContainer.querySelector(`input[name="${f.name}"]`));
          const val = inp ? inp.value.trim() : '';
          result[f.name] = val;
          const lbl = inp?.closest('label');
          const errP = lbl?.querySelector('.field-error');
          const err = f.validate ? f.validate(val) : '';
          if (err) {
            if (errP) {
              errP.textContent = err;
              errP.removeAttribute('hidden');
            }
            inp?.setAttribute('aria-invalid', 'true');
            if (!firstInvalid && inp) firstInvalid = inp;
          } else {
            if (errP) {
              errP.textContent = '';
              errP.setAttribute('hidden', 'true');
            }
            inp?.removeAttribute('aria-invalid');
          }
        }
        if (firstInvalid) {
          firstInvalid.focus();
          return;
        }
        return done(result);
      }
      if (field) {
        const v = /** @type {HTMLInputElement} */ ($('msg-input')).value.trim();
        const err = validate ? validate(v) : '';
        if (err) {
          $('msg-error').textContent = err;
          $('msg-error').hidden = false;
          $('msg-input').setAttribute('aria-invalid', 'true');
          return;
        }
        return done(v);
      }
      done(true);
    };

    const onCancel = () => done(kind === 'notice' ? true : (field || (fields && fields.length) ? null : false));

    const onKeydown = (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Tab') return;
      const controls = Array.from(d.querySelectorAll('button:not(:disabled), input:not(:disabled)'))
        .filter(x => !/** @type {HTMLElement} */ (x).hidden && !x.closest('[hidden]'));
      if (!controls.length) { e.preventDefault(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        /** @type {HTMLElement} */ (last).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        /** @type {HTMLElement} */ (first).focus();
      }
    };

    const cleanup = () => {
      $('msg-form').removeEventListener('submit', onSubmit);
      $('msg-cancel').removeEventListener('click', onCancel);
      d.removeEventListener('cancel', onCancel);
      d.removeEventListener('keydown', onKeydown);
      $('msg-input').removeAttribute('aria-invalid');
      if (fieldsContainer) fieldsContainer.replaceChildren();
    };

    $('msg-form').addEventListener('submit', onSubmit);
    $('msg-cancel').addEventListener('click', onCancel);
    d.addEventListener('cancel', onCancel);
    d.addEventListener('keydown', onKeydown);

    d.showModal();
    let toFocus;
    if (fields && fields.length && fieldsContainer) {
      toFocus = fieldsContainer.querySelector('input') || $('msg-cancel');
    } else if (field) {
      toFocus = $('msg-input');
    } else {
      toFocus = $('msg-cancel').hidden ? $('msg-ok') : $('msg-cancel');
    }
    /** @type {HTMLElement} */ (toFocus).focus();
  });
}

/** @param {any} o */
export const confirmBox = o => dialogBox({kind: 'confirm', ...o});
/** @param {any} o */
export const noticeBox = o => dialogBox({kind: 'notice', ...o});

/**
 * Runs an async action with busy button state.
 * @template T
 * @param {HTMLButtonElement} btn
 * @param {string} busyText
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withBusy(btn, busyText, fn) {
  const iconOnly = Boolean(btn.classList?.contains('icon-btn') && btn.querySelector?.('svg'));
  const old = btn.textContent;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  if (!iconOnly) btn.textContent = busyText;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (!iconOnly) btn.textContent = old;
  }
}

/**
 * Sets or clears field validation error.
 * @param {HTMLInputElement} input
 * @param {string} msg
 * @returns {boolean} True if valid (no error), false otherwise.
 */
export function setFieldError(input, msg) {
  let e = document.getElementById(input.id + '-err');
  if (!e) {
    e = document.createElement('p');
    e.id = input.id + '-err';
    e.className = 'field-error';
    e.setAttribute('role', 'alert');
    input.closest('.field, label')?.append(e);
  }
  e.textContent = msg;
  e.hidden = !msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (msg) {
    input.setAttribute('aria-describedby', e.id);
  }
  return !msg;
}

/**
 * Error message mapping to user-friendly Vietnamese text.
 * @param {unknown} error
 * @returns {string}
 */
export function mapErrorMessage(error) {
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    return 'Không có kết nối mạng.';
  }
  const msg = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : String(error || ''));
  if ((error && typeof error === 'object' && 'status' in error && error.status === 429) || msg.includes('tạm khóa') || msg.includes('quá nhiều lần')) {
    return msg && msg !== '[object Object]' ? msg : 'Tài khoản đang bị tạm khóa. Vui lòng thử lại sau.';
  }
  if (msg.includes('INVALID_CREDENTIALS') || msg.includes('Mã học sinh hoặc PIN không chính xác') || msg.includes('sai')) {
    return 'Mã học sinh hoặc mã PIN chưa đúng.';
  }
  if (msg.includes('ACCOUNT_DISABLED') || msg.includes('khóa')) {
    return 'Tài khoản đang bị khóa. Liên hệ giáo viên.';
  }
  if (msg.includes('TEACHER_PIN_CHANGE_REQUIRED') || msg.includes('PIN_CHANGE_REQUIRED')) {
    return 'Cần đổi mã PIN trước khi tiếp tục.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('mạng')) {
    return 'Không có kết nối mạng.';
  }
  return 'Chưa thực hiện được. Thử lại sau.';
}

