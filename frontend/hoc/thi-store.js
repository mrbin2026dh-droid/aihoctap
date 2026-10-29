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

/** @param {string} path @param {RequestInit} [init] @param {number} [ms] @param {string} [query] */
async function req(path, init = {}, ms = 8000, query = '') {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${base()}/${path}.json${query}`, { ...init, credentials: 'omit', signal: ctl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(res.status === 401 || res.status === 403 ? 'Bài thi đang khóa hoặc em đã nộp rồi.' : 'Mạng đang chậm, thử lại.'), { status: res.status });
    return data;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw Object.assign(new Error('Mạng đang chậm, thử lại.'), { status: 0 });
    throw e;
  } finally { clearTimeout(t); }
}
/** Đọc; mạng chập chờn (quá giờ / máy chủ lỗi tạm) → tự thử lại một lần, chờ lâu hơn. @param {string} path */
export const get = path => req(path).catch(e => (e && (e.status === 0 || e.status >= 500)) ? req(path, {}, 15000) : Promise.reject(e));
/** Chỉ lấy danh sách khóa con (shallow): 18.000 học sinh ≈ 0,3 MB thay vì vài MB. @param {string} path @returns {Promise<string[]>} */
export const keys = async path => Object.keys((await req(path, {}, 15000, '?shallow=true')) || {});
/** @param {string} path @param {unknown} val */ export const put = (path, val) => req(path, { method: 'PUT', body: JSON.stringify(val) });
/** Ghi nhiều chỗ một lần (PATCH ở gốc khi path = ''). @param {string} path @param {Record<string, unknown>} val */ export const patch = (path, val) => req(path, { method: 'PATCH', body: JSON.stringify(val) });
export const SERVER_TIME = { '.sv': 'timestamp' };

/*
 * NGHE TỨC THÌ CÓ "NGÂN SÁCH KẾT NỐI".
 * Firebase REST chỉ chạy HTTP/1.1: trình duyệt cho tối đa 6 kết nối đồng thời tới một máy chủ, TÍNH CHUNG mọi tab.
 * Mỗi EventSource giữ chặt 1 kết nối. Trước đây trang giáo viên mở 7–10 EventSource (thi_hs, 3 nhánh × mỗi bài thi đang mở,
 * đọc bài, phòng luyện tập...) → các lệnh đọc thường (danh sách lớp, Hiệu quả, câu trả lời luyện tập) xếp hàng mãi rồi báo
 * "Mạng đang chậm" (đo thật 29/10: 6 EventSource mở sẵn → lệnh đọc treo quá 8 giây; 4 → 0,2 giây).
 * Cách xử lý:
 *  - nhiều chỗ nghe cùng một nhánh dùng chung một kết nối;
 *  - chỉ SLOTS nhánh ưu tiên cao nhất được giữ EventSource; các nhánh còn lại tự đọc lại định kỳ (2–10 giây theo mức ưu tiên);
 *  - tab bị ẩn: đóng hết EventSource, đọc lại thưa (20 giây) để nhường kết nối cho tab đang dùng.
 * Mức ưu tiên (prio): 3 = phải tức thì (câu trả lời luyện tập, trạng thái phòng), 2 = theo dõi đang diễn ra (bài thi đang mở),
 * 1 = mặc định, 0 = danh sách ít đổi (thi_hs, đọc bài).
 */
export const SLOTS = 2;   // 2 EventSource + 1 trạng thái trực tuyến (presence.js) = 3 mỗi tab: hai cửa sổ cùng mở vẫn còn chỗ cho lệnh đọc/ghi
const POLL_MS = [10000, 5000, 3000, 1500];
const HIDDEN_POLL_MS = 20000;
/** @typedef {{path:string, subs:Set<{onData:(d:any)=>void,onState:(ok:boolean)=>void,prio:number}>, data:any, has:boolean, mode:''|'sse'|'poll', es:EventSource|null, timer:number, retry:number, busy:boolean, at:number, sig:string}} Feed */
/** @type {Map<string, Feed>} */ const feeds = new Map();
let seq = 0, visHooked = false;
const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
const prioOf = (/** @type {Feed} */ f) => Math.max(0, ...[...f.subs].map(x => x.prio));
/** @param {Feed} f */
function emit(f) { const sig = JSON.stringify(f.data ?? null); if (f.has && sig === f.sig) return; f.sig = sig; f.has = true; for (const x of [...f.subs]) { try { x.onData(f.data); } catch { /* bỏ qua lỗi của chỗ nghe */ } } }
/** @param {Feed} f @param {boolean} ok */
const state = (f, ok) => { for (const x of [...f.subs]) { try { x.onState(ok); } catch { /* bỏ qua */ } } };
/** @param {Feed} f */
function halt(f) { clearTimeout(f.timer); f.timer = 0; f.es?.close(); f.es = null; f.mode = ''; }
/** @param {Feed} f */
function openSse(f) {
  halt(f); f.mode = 'sse';
  const es = new EventSource(`${base()}/${f.path}.json`); f.es = es;
  const apply = (/** @type {string} */ p, /** @type {any} */ v, /** @type {boolean} */ merge) => {
    const parts = p.split('/').filter(Boolean);
    if (!parts.length) { f.data = merge ? { ...(f.data || {}), ...(v || {}) } : v; return; }
    f.data = f.data && typeof f.data === 'object' ? { ...f.data } : {};
    let o = f.data;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] && typeof o[parts[i]] === 'object' ? { ...o[parts[i]] } : {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (v === null) delete o[last]; else o[last] = merge && o[last] && typeof o[last] === 'object' ? { ...o[last], ...v } : v;
  };
  const on = (/** @type {string} */ type, /** @type {boolean} */ merge) => es.addEventListener(type, ev => {
    if (f.es !== es) return;
    f.retry = 0; state(f, true);
    try { const d = JSON.parse(/** @type {MessageEvent} */ (ev).data); apply(d.path, d.data, merge); emit(f); } catch { /* bỏ qua */ }
  });
  on('put', false); on('patch', true);
  const again = () => { if (f.es !== es) return; es.close(); f.es = null; state(f, false); f.timer = window.setTimeout(() => { if (feeds.get(f.path) === f && f.mode === 'sse') openSse(f); }, Math.min(15000, 1000 * 2 ** f.retry++)); };
  es.addEventListener('cancel', again);
  es.onerror = () => { if (es.readyState === EventSource.CLOSED) again(); };
}
/** @param {Feed} f */
function startPoll(f) {
  if (f.mode === 'poll' && f.timer) return;
  halt(f); f.mode = 'poll';
  const tick = async () => {
    if (feeds.get(f.path) !== f || f.mode !== 'poll') return;
    if (!f.busy) {
      f.busy = true;
      try { f.data = await req(f.path, {}, 8000); f.retry = 0; state(f, true); emit(f); }
      catch { f.retry++; state(f, false); }
      finally { f.busy = false; }
    }
    if (feeds.get(f.path) !== f || f.mode !== 'poll') return;
    const wait = hidden() ? HIDDEN_POLL_MS : POLL_MS[Math.min(3, prioOf(f))] * Math.min(4, 1 + f.retry);
    f.timer = window.setTimeout(tick, wait);
  };
  f.timer = window.setTimeout(tick, 0);
}
/** Chia lại kết nối: SLOTS nhánh ưu tiên cao nhất dùng EventSource, còn lại đọc định kỳ. */
function rebalance() {
  const list = [...feeds.values()].sort((a, b) => prioOf(b) - prioOf(a) || a.at - b.at);
  list.forEach((f, i) => {
    const want = !hidden() && i < SLOTS && typeof EventSource !== 'undefined' ? 'sse' : 'poll';
    if (want === 'sse' && f.mode !== 'sse') openSse(f);
    else if (want === 'poll' && f.mode !== 'poll') startPoll(f);
  });
}
/** Số EventSource đang mở (cho kiểm thử / chẩn đoán). */
export const openStreams = () => [...feeds.values()].filter(f => f.mode === 'sse').length;

/**
 * Nghe một nhánh: gọi onData(toàn bộ dữ liệu) mỗi khi có thay đổi. Tự nối lại khi mất mạng. Trả hàm dừng.
 * @param {string} path @param {(data:any)=>void} onData @param {(ok:boolean)=>void} [onState] @param {{prio?:number}} [opt]
 */
export function listen(path, onData, onState = () => {}, opt = {}) {
  if (!visHooked && typeof document !== 'undefined') { visHooked = true; document.addEventListener('visibilitychange', rebalance); }
  const sub = { onData, onState, prio: Math.max(0, Math.min(3, Number(opt.prio ?? 1))) };
  let f = feeds.get(path);
  if (!f) { f = { path, subs: new Set(), data: null, has: false, mode: '', es: null, timer: 0, retry: 0, busy: false, at: seq++, sig: '' }; feeds.set(path, f); }
  f.subs.add(sub);
  const feed = f;
  if (feed.has) setTimeout(() => { if (feed.subs.has(sub)) { try { onData(feed.data); } catch { /* bỏ qua */ } } }, 0);   // đã có dữ liệu: báo ngay cho chỗ nghe mới
  rebalance();
  return () => {
    if (!feed.subs.delete(sub)) return;
    if (!feed.subs.size) { halt(feed); feeds.delete(path); }
    rebalance();
  };
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

/**
 * Đăng nhập giáo viên lớp (tài khoản quản trị cấp trong menu Tài khoản, đẩy lên thi_gv).
 * Trả {ma, ten, lop:string[]} nếu đúng; null nếu Firebase chưa có tài khoản; ném lỗi nếu sai PIN.
 * @param {string} ma @param {string} pin
 */
export async function teacherLogin(ma, pin) {
  if (!enabled()) return null;
  let rec = null;
  try { rec = await req('thi_gv/' + keyOf(ma), {}, 5000); } catch { return null; }
  if (!rec || !rec.h) return null;
  if (sha256(keyOf(ma) + ':' + String(pin).trim()) !== rec.h) throw new Error('Mã giáo viên hoặc PIN chưa đúng.');
  return { ma: String(rec.ma || ma), ten: String(rec.ten || ma), lop: Array.isArray(rec.lop) ? rec.lop.map(String) : Object.values(rec.lop || {}).map(String) };
}
