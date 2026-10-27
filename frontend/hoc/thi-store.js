// @ts-check
// Đọc/ghi Firebase Realtime Database qua REST, KHÔNG qua Worker, không cần vé: nhanh (~0,2 giây) và cập nhật tức thì.
// Các nhánh (luật: spike/step0/database.rules.ai-sgk-final.json):
//   thi_hs/{mã}      : tài khoản học sinh {ma, ten, lop, khoi, h = sha256("mã thường:PIN")} — Google Sheet đẩy lên
//   thi_bai/{mã bài} : bài thi {tieu_de, che_do, khoi, lop, trang_thai, so_cau} — Google Sheet đẩy lên
//   thi_de/{mã bài}  : câu hỏi (kèm đáp án để máy học sinh tự chấm) — Google Sheet đẩy lên
//   thi_vao/{mã bài}/{mã}: giờ học sinh vào phòng thi (điểm danh) — học sinh ghi
//   thi_nop/{mã bài}/{mã}: bài nộp + điểm — học sinh ghi; Google Sheet chép về trang KetQua
import { PRESENCE_CONFIG } from './presence-config.js';

export const enabled = () => Boolean(PRESENCE_CONFIG.dbUrl);
const base = () => PRESENCE_CONFIG.dbUrl.replace(/\/$/, '');
/** Khóa Firebase của một mã học sinh (giống fbKey_ trong Code.gs). @param {string} ma */
export const keyOf = ma => String(ma || '').trim().toLowerCase().replace(/[.#$[\]/]/g, '_');

/** @param {string} path @param {RequestInit} [init] @param {number} [ms] */
async function req(path, init = {}, ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${base()}/${path}.json`, { ...init, credentials: 'omit', signal: ctl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(res.status === 401 || res.status === 403 ? 'Bài thi đang khóa hoặc em đã nộp rồi.' : 'Mạng đang chậm, thử lại.'), { status: res.status });
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw Object.assign(new Error('Mạng đang chậm, thử lại.'), { status: 0 });
    throw e;
  } finally { clearTimeout(t); }
}
/** @param {string} path */ export const get = path => req(path);
/** @param {string} path @param {unknown} val */ export const put = (path, val) => req(path, { method: 'PUT', body: JSON.stringify(val) });
export const SERVER_TIME = { '.sv': 'timestamp' };

/**
 * Nghe một nhánh: gọi onData(toàn bộ dữ liệu) mỗi khi có thay đổi. Tự nối lại khi mất mạng. Trả hàm dừng.
 * @param {string} path @param {(data:any)=>void} onData @param {(ok:boolean)=>void} [onState]
 */
export function listen(path, onData, onState = () => {}) {
  /** @type {any} */ let data = null; /** @type {EventSource|null} */ let es = null; let stopped = false; let retry = 0; let timer = 0;
  const apply = (/** @type {string} */ p, /** @type {any} */ v, /** @type {boolean} */ merge) => {
    const parts = p.split('/').filter(Boolean);
    if (!parts.length) { data = merge ? { ...(data || {}), ...(v || {}) } : v; return; }
    data = data && typeof data === 'object' ? { ...data } : {};
    let o = data;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] && typeof o[parts[i]] === 'object' ? { ...o[parts[i]] } : {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (v === null) delete o[last]; else o[last] = merge && o[last] && typeof o[last] === 'object' ? { ...o[last], ...v } : v;
  };
  const open = () => {
    if (stopped) return;
    es = new EventSource(`${base()}/${path}.json`);
    const on = (/** @type {string} */ type, /** @type {boolean} */ merge) => es?.addEventListener(type, ev => {
      retry = 0; onState(true);
      try { const d = JSON.parse(/** @type {MessageEvent} */ (ev).data); apply(d.path, d.data, merge); onData(data); } catch { /* bỏ qua */ }
    });
    on('put', false); on('patch', true);
    const again = () => { if (stopped) return; es?.close(); es = null; onState(false); timer = window.setTimeout(open, Math.min(15000, 1000 * 2 ** retry++)); };
    es.addEventListener('cancel', again);
    es.onerror = () => { if (es && es.readyState === EventSource.CLOSED) again(); };
  };
  open();
  return () => { stopped = true; clearTimeout(timer); es?.close(); es = null; };
}

/** SHA-256 dạng hex, viết tay (chạy cả khi trang mở qua http trong mạng LAN, nơi crypto.subtle bị tắt). @param {string} str */
export function sha256(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = [...new TextEncoder().encode(str)], len = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (len >>> (i * 8)) & 0xff);
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Array(64);
  const rot = (/** @type {number} */ x, /** @type {number} */ n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) { const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
/**
 * Đăng nhập nhanh bằng tài khoản giáo viên đã đẩy lên Firebase.
 * Trả {ma, ten, lop, khoi} nếu đúng; null nếu Firebase chưa có tài khoản này (app dùng đường đăng nhập cũ); ném lỗi nếu sai PIN.
 * @param {string} ma @param {string} pin
 */
export async function login(ma, pin) {
  if (!enabled()) return null;
  let rec = null;
  try { rec = await req('thi_hs/' + keyOf(ma), {}, 5000); } catch { return null; }
  if (!rec || !rec.h) return null;
  if (sha256(keyOf(ma) + ':' + String(pin).trim()) !== rec.h) throw new Error('Mã học sinh hoặc PIN không chính xác');
  return { ma: String(rec.ma || ma), ten: String(rec.ten || ma), lop: String(rec.lop || ''), khoi: Number(rec.khoi) || 0 };
}
