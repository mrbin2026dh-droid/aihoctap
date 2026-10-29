// @ts-check
// Hiệu ứng dùng chung cho Luyện tập trên lớp (máy chiếu giáo viên + điện thoại học sinh):
//  - đếm ngược 3 · 2 · 1 · Bắt đầu! trước câu đầu tiên;
//  - âm thanh tự tổng hợp bằng Web Audio (không dùng tệp nhạc có bản quyền), có nút tắt/bật, nhớ theo máy;
//  - pháo giấy khi vinh danh.
// Tôn trọng "giảm chuyển động" của hệ điều hành: bỏ pháo giấy, số đếm chỉ đổi, không phóng to.

const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const KEY = 'lt-sound';
/** Âm thanh đang bật không. @param {boolean} [dflt] mặc định khi máy chưa chọn (máy chiếu: bật; điện thoại học sinh: tắt) */
export function soundOn(dflt = true) { try { const v = localStorage.getItem(KEY); return v === null ? dflt : v === '1'; } catch { return dflt; } }
/** @param {boolean} on */
export function setSound(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* bỏ qua */ } }

/** @type {AudioContext|null} */ let ctx = null;
let dfltOn = true;
/** Máy học sinh gọi setDefault(false) để mặc định im lặng. @param {boolean} on */
export function setDefault(on) { dfltOn = on; }
function audio() {
  if (!soundOn(dfltOn)) return null;
  try {
    // @ts-ignore Safari cũ
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    if (!ctx) ctx = new C();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
/** @param {number} f tần số Hz @param {number} dur giây @param {OscillatorType} type @param {number} vol @param {number} when trễ (giây) */
function tone(f, dur, type = 'sine', vol = 0.12, when = 0) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const seq = (/** @type {number[]} */ fs, step = 0.09, dur = 0.22, type = /** @type {OscillatorType} */ ('triangle'), vol = 0.12) => fs.forEach((f, i) => tone(f, dur, type, vol, i * step));
export const sfx = {
  count: () => tone(587, 0.16, 'square', 0.07),
  go: () => seq([523, 659, 784, 1047], 0.07, 0.3),
  join: () => tone(880, 0.09, 'sine', 0.06),
  tick: () => tone(440, 0.05, 'square', 0.03),
  reveal: () => seq([392, 523, 659], 0.08, 0.25),
  correct: () => seq([659, 988], 0.1, 0.25),
  wrong: () => seq([330, 247], 0.12, 0.28, 'sawtooth', 0.06),
  drum: () => { for (let i = 0; i < 20; i++) tone(110 + (i % 2) * 8, 0.06, 'square', 0.04 + i * 0.004, i * 0.07); },
  fanfare: () => seq([523, 659, 784, 1047, 784, 1047, 1319], 0.11, 0.32, 'triangle', 0.16),
};

const sleep = (/** @type {number} */ ms) => new Promise(r => setTimeout(r, ms));
/**
 * Đếm ngược phủ lên `host` (phần tử bố cục position:relative hoặc fixed). Trả về Promise khi xong.
 * @param {HTMLElement} host @param {{from?:number, step?:number, go?:string, title?:string}} [o]
 */
export async function countdown(host, o = {}) {
  const from = o.from ?? 3, step = o.step ?? 900, go = o.go ?? 'Bắt đầu!';
  host.querySelector('.qfx-count')?.remove();
  const box = document.createElement('div'); box.className = 'qfx-count'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'assertive');
  const title = document.createElement('p'); title.className = 'qfx-count-title'; title.textContent = o.title || 'Chuẩn bị!';
  const ring = document.createElement('div'); ring.className = 'qfx-ring';
  const num = document.createElement('span'); num.className = 'qfx-num';
  ring.append(num); box.append(title, ring); host.append(box);
  const show = (/** @type {string} */ v, /** @type {string} */ cls) => { num.textContent = v; ring.className = 'qfx-ring ' + cls; void ring.offsetWidth; ring.classList.add('is-on'); };
  for (let n = from; n >= 1; n--) { show(String(n), 'qfx-n' + n); sfx.count(); await sleep(step); }
  show(go, 'qfx-go'); title.textContent = ''; sfx.go(); await sleep(Math.round(step * 0.8));
  box.classList.add('is-out'); await sleep(reduce() ? 0 : 220); box.remove();
}

const COLORS = ['#ffd166', '#22c3a6', '#ef476f', '#4cc9f0', '#f8961e', '#ffffff'];
/** Pháo giấy rơi trong `host` (bỏ qua khi giảm chuyển động). @param {HTMLElement} host @param {number} [n] */
export function confetti(host, n = 90) {
  if (reduce()) return;
  const layer = document.createElement('div'); layer.className = 'qfx-confetti'; layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    p.style.setProperty('--d', (2.2 + Math.random() * 1.8).toFixed(2) + 's');
    p.style.setProperty('--w', (Math.random() * 0.9).toFixed(2) + 's');
    p.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
    p.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
    p.style.background = COLORS[i % COLORS.length];
    layer.append(p);
  }
  host.append(layer); setTimeout(() => layer.remove(), 4800);
}

/** Nút bật/tắt âm thanh (nhãn là hành động sẽ làm). @param {string} cls */
export function soundToggle(cls) {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls;
  const sync = () => { const on = soundOn(dfltOn); b.textContent = on ? 'Tắt tiếng' : 'Bật tiếng'; b.title = on ? 'Âm thanh đang bật' : 'Âm thanh đang tắt'; };
  b.addEventListener('click', () => { setSound(!soundOn(dfltOn)); sync(); if (soundOn(dfltOn)) sfx.join(); });
  sync(); return b;
}
