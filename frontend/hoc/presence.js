// @ts-check
// Trạng thái trực tuyến qua Firebase Realtime Database (REST), KHÔNG qua Worker.
// Worker chỉ cấp vé (custom token 1 giờ) lúc đăng nhập; app đổi vé lấy idToken + refreshToken của Firebase rồi tự làm mới.
// Học sinh: ghi presence/{mã} = {name, lop, state, at}. Giáo viên: nghe presence bằng luồng sự kiện (cập nhật tức thì).
// Mọi lỗi ở đây đều im lặng: trạng thái trực tuyến là phụ, không được làm hỏng việc học/thi.
import { PRESENCE_CONFIG as FB_CONFIG } from './presence-config.js';
const ENABLED = () => Boolean(FB_CONFIG.apiKey && FB_CONFIG.dbUrl);

/** @typedef {{uid:string,idToken:string,refreshToken:string,exp:number,name?:string,lop?:string}} PSession */
export const STATES = /** @type {const} */ ({ hoc: 'Đang học', phong_cho: 'Phòng chờ thi', dang_thi: 'Đang thi', da_nop: 'Đã nộp', offline: 'Đã thoát' });
const KEY_HS = 'aisgk-presence', KEY_GV = 'aisgk-presence-gv';
const HEARTBEAT_MS = 60 * 1000;
/** Quá 2,5 phút không có nhịp → coi như mất kết nối (đóng máy, mất mạng). */
export const STALE_MS = 150 * 1000;

/** @param {string} key @returns {PSession|null} */
function load(key) { try { const s = JSON.parse(localStorage.getItem(key) || 'null'); return s && s.uid && s.refreshToken ? s : null; } catch { return null; } }
/** @param {string} key @param {PSession|null} s */
function save(key, s) { try { if (s) localStorage.setItem(key, JSON.stringify(s)); else localStorage.removeItem(key); } catch { /* bỏ qua */ } }

/** Đổi custom token (Worker cấp) lấy phiên Firebase. @param {string} customToken @returns {Promise<PSession>} */
async function exchange(customToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FB_CONFIG.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.idToken) throw new Error('Firebase từ chối vé: ' + (d?.error?.message || res.status));
  return { uid: d.localId, idToken: d.idToken, refreshToken: d.refreshToken, exp: Date.now() + Number(d.expiresIn || 3600) * 1000 };
}
/** Lấy idToken còn hạn (tự làm mới bằng refreshToken). @param {string} key @returns {Promise<PSession|null>} */
async function fresh(key) {
  const s = load(key); if (!s) return null;
  if (s.exp - Date.now() > 5 * 60 * 1000) return s;
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_CONFIG.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'omit',
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refreshToken)
  }).catch(() => null);
  const d = res ? await res.json().catch(() => ({})) : {};
  if (!res || !res.ok || !d.id_token) { if (res && res.status >= 400 && res.status < 500) save(key, null); return null; }
  const n = { ...s, idToken: d.id_token, refreshToken: d.refresh_token || s.refreshToken, exp: Date.now() + Number(d.expires_in || 3600) * 1000 };
  save(key, n); return n;
}
/** Có vé thì kèm ?auth=, không có vé (chế độ nhanh: luật cho ghi presence không cần vé) thì bỏ. */
const url = (/** @type {string} */ path, /** @type {string} */ tok) => `${FB_CONFIG.dbUrl}/${path}.json` + (tok ? `?auth=${encodeURIComponent(tok)}` : '');

/* ---------------- Học sinh ---------------- */
let beat = 0;
const KEY_ST = 'aisgk-presence-state';   // dùng chung giữa app và khung bài thi (cùng nguồn) để nhịp 1 phút không ghi đè "Đang thi"
const getLast = () => { try { return localStorage.getItem(KEY_ST) || 'hoc'; } catch { return 'hoc'; } };
export function currentState() { return getLast(); }

/** Ghi trạng thái của học sinh đang đăng nhập. @param {keyof typeof STATES} state */
export async function setState(state) {
  if (!ENABLED()) return false;
  try {
    const s = await fresh(KEY_HS); if (!s) return false;
    if (state !== 'offline') { try { localStorage.setItem(KEY_ST, state); } catch { /* bỏ qua */ } }
    const res = await fetch(url('presence/' + s.uid, s.idToken), {
      method: 'PATCH', credentials: 'omit', body: JSON.stringify({ name: s.name || '', lop: s.lop || '', state, at: { '.sv': 'timestamp' } })
    });
    return res.ok;
  } catch { return false; }
}
/** Ngày theo giờ Việt Nam (UTC+7), dạng 2026-10-29. @param {number} [t] */
export const dayVN = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
/** Mỗi phút app đang mở trên màn hình và em đang học/thi: cộng 1 phút vào thoi_gian/{ngày}/{mã} (phép cộng phía máy chủ). */
async function addMinute() {
  const s = await fresh(KEY_HS) || load(KEY_HS); if (!s || !s.uid) return;
  try {
    await fetch(url(`thoi_gian/${dayVN()}/${s.uid}`, s.idToken || ''), { method: 'PUT', credentials: 'omit', body: JSON.stringify({ '.sv': { increment: 1 } }) });
  } catch { /* mất mạng: bỏ qua phút này */ }
}
/** Đọc số phút học N ngày gần nhất (nhánh thoi_gian đọc công khai, chỉ có mã + số phút).
 * @param {number} [days] @returns {Promise<{days:string[], byDay: Record<string, Record<string, number>>}>} */
export async function minutes(days = 7) {
  const list = Array.from({ length: days }, (_, i) => dayVN(Date.now() - i * 864e5));
  /** @type {Record<string, Record<string, number>>} */ const byDay = {};
  if (!ENABLED()) return { days: list, byDay };
  await Promise.all(list.map(async d => {
    try {
      const r = await fetch(url('thoi_gian/' + d, ''), { credentials: 'omit' });
      const j = r.ok ? await r.json() : null;
      byDay[d] = {}; for (const [k, v] of Object.entries(j || {})) byDay[d][k.toLowerCase()] = (byDay[d][k.toLowerCase()] || 0) + (Number(v) || 0);
    } catch { byDay[d] = {}; }
  }));
  return { days: list, byDay };
}
/** Nghe presence cho màn hình phụ (Tài khoản) mà không giành kênh của màn hình Thi. @param {(map: Record<string, any>) => void} fn */
export function listen(fn) {
  const off = subscribe(fn);
  if (!es && !connecting()) void watch(() => {}, () => {});
  return off;
}
/** Gọi sau khi học sinh đăng nhập: đổi vé, ghi "Đang học", bắt đầu nhịp 1 phút. @param {string} fbToken @param {{name?:string,class_code?:string}} identity */
export async function startStudent(fbToken, identity) {
  if (!fbToken || !ENABLED()) return false;
  try {
    const s = await exchange(fbToken);
    save(KEY_HS, { ...s, name: String(identity?.name || identity?.student_name || ''), lop: String(identity?.class_code || '') });
  } catch { save(KEY_HS, null); return false; }
  resumeStudent('hoc');
  return true;
}
/** Chế độ nhanh: không cần vé Worker — ghi thẳng presence/{mã}. @param {{uid:string,student_name?:string,name?:string,class_code?:string}} identity */
export function startStudentLite(identity) {
  if (!ENABLED() || !identity?.uid) return false;
  save(KEY_HS, { uid: String(identity.uid), idToken: '', refreshToken: 'lite', exp: Number.MAX_SAFE_INTEGER, name: String(identity.student_name || identity.name || ''), lop: String(identity.class_code || '') });
  resumeStudent('hoc');
  return true;
}
/** Mở lại app (phiên cũ còn) → tiếp tục nhịp. @param {keyof typeof STATES} [state] */
export function resumeStudent(state) {
  if (!ENABLED() || !load(KEY_HS)) return;
  // Mở lại app sau khi đã nộp bài → đang học (không kẹt "Đã nộp", vẫn đếm phút học).
  const last = getLast();
  void setState(/** @type {any} */ (state || (last === 'da_nop' ? 'hoc' : last)));
  clearInterval(beat);
  beat = window.setInterval(() => { if (document.visibilityState === 'visible') { const st = /** @type {any} */ (getLast()); void setState(st); if (st === 'hoc' || st === 'dang_thi' || st === 'phong_cho') void addMinute(); } }, HEARTBEAT_MS);
}
/** Đăng xuất: ghi "Đã thoát" rồi xóa phiên. */
export async function stopStudent() {
  clearInterval(beat); beat = 0;
  await setState('offline');
  save(KEY_HS, null); try { localStorage.removeItem(KEY_ST); } catch { /* bỏ qua */ }
}
export function hasStudentSession() { return Boolean(load(KEY_HS)); }

/* ---------------- Giáo viên ---------------- */
/** Gọi sau khi giáo viên đăng nhập (token Worker là custom token 1 giờ). @param {string} customToken */
export async function startTeacher(customToken) {
  if (!ENABLED()) { teacherError = 'CHUA_CAI_DU_AN'; return false; }
  try { save(KEY_GV, await exchange(customToken)); teacherError = ''; return true; }
  catch (e) { teacherError = e instanceof Error ? e.message : String(e); return false; }
}
let teacherError = '';
/** Lý do lần đổi vé giáo viên gần nhất thất bại (mã lỗi Firebase), '' nếu ổn. */
export function lastTeacherError() { return teacherError; }
export function stopTeacher() { save(KEY_GV, null); stopWatch(); }

/** @type {EventSource|null} */ let es = null;
/** Nhiều màn hình (Thi, Tài khoản) cùng nghe một kênh presence. @type {Set<(map: Record<string, any>) => void>} */
const subs = new Set();
/** @type {Record<string, any>|null} */ let lastMap = null;
/** Đăng ký nhận bản đồ trực tuyến (nhận ngay bản mới nhất nếu có). @param {(map: Record<string, any>) => void} fn @returns {() => void} */
export function subscribe(fn) { subs.add(fn); if (lastMap) fn({ ...lastMap }); return () => { subs.delete(fn); }; }
export const isWatching = () => Boolean(es);
let connectingFlag = false;
const connecting = () => connectingFlag;
let retry = 0;
/**
 * Nghe toàn bộ presence. onChange nhận bản đồ {mã: {name, lop, state, at}} mỗi khi có thay đổi.
 * onStatus báo 'live' | 'off' (chưa có vé / Firebase từ chối) để giao diện hiển thị.
 * @param {(map: Record<string, any>) => void} onChange @param {(s: 'live'|'off', why?: string) => void} onStatus
 */
let pending = 0;
export async function watch(onChange, onStatus) {
  stopWatch(); const my = ++pending; connectingFlag = true;
  if (!ENABLED()) { connectingFlag = false; onStatus('off', 'Chưa cài dự án Firebase cho trạng thái trực tuyến (presence-config.js).'); return; }
  const s = await fresh(KEY_GV).catch(() => null);   // có vé thì dùng; không có vé vẫn nghe được (luật cho đọc presence công khai)
  if (my !== pending) return;   // đã có lệnh nghe mới hơn (màn hình khác) hoặc đã đăng xuất → nhường
  connectingFlag = false; closeEs();
  /** @type {Record<string, any>} */ let map = {};
  const src = new EventSource(url('presence', s ? s.idToken : ''));
  es = src;
  const apply = (/** @type {string} */ path, /** @type {any} */ data, /** @type {boolean} */ merge) => {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) { map = merge ? { ...map, ...(data || {}) } : (data || {}); }
    else if (parts.length === 1) { if (data === null) delete map[parts[0]]; else map[parts[0]] = merge ? { ...(map[parts[0]] || {}), ...data } : data; }
    else { const k = parts[0]; map[k] = { ...(map[k] || {}), [parts[1]]: data }; }
    lastMap = { ...map };
    onChange({ ...map }); for (const f of subs) { try { f({ ...map }); } catch { /* bỏ qua */ } }
  };
  src.addEventListener('put', ev => { retry = 0; onStatus('live'); try { const d = JSON.parse(/** @type {MessageEvent} */ (ev).data); apply(d.path, d.data, false); } catch { /* bỏ qua */ } });
  src.addEventListener('patch', ev => { try { const d = JSON.parse(/** @type {MessageEvent} */ (ev).data); apply(d.path, d.data, true); } catch { /* bỏ qua */ } });
  const reconnect = (/** @type {string} */ why) => {
    if (es !== src) return;
    src.close(); es = null; onStatus('off', why);
    const wait = Math.min(30000, 2000 * 2 ** retry++);
    setTimeout(() => { if (!es) void watch(onChange, onStatus); }, wait);
  };
  src.addEventListener('auth_revoked', () => reconnect('Đang làm mới vé Firebase…'));   // idToken hết hạn (1 giờ) → lấy vé mới
  src.addEventListener('cancel', () => reconnect('Firebase từ chối quyền đọc. Kiểm tra luật Firebase (nhánh presence).'));
  src.onerror = () => { if (src.readyState === EventSource.CLOSED) reconnect('Mất kết nối Firebase, đang thử lại…'); };
}
function closeEs() { if (es) { es.close(); es = null; } }
export function stopWatch() { pending++; connectingFlag = false; closeEs(); }
