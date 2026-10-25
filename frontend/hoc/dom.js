// @ts-check
/** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} [text] @param {string} [className] */
export function el(tag, text = '', className = '') { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; }
/** @param {string} text @param {()=>void|Promise<void>} action @param {string} [className] */
export function button(text, action, className = '') {
  const node = el('button', text, className); node.type = 'button';
  node.addEventListener('click', () => { Promise.resolve(action()).catch(error => notify(error.message, true)); });
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
export function dialogBox({
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
  const old = btn.textContent;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = busyText;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = old;
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

