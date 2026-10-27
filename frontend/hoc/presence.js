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
const url = (/** @type {string} */ path, /** @type {string} */ tok) => `${FB_CONFIG.dbUrl}/${path}.json?auth=${encodeURIComponent(tok)}`;

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
/** Mở lại app (phiên cũ còn) → tiếp tục nhịp. @param {keyof typeof STATES} [state] */
export function resumeStudent(state) {
  if (!ENABLED() || !load(KEY_HS)) return;
  void setState(/** @type {any} */ (state || getLast()));
  clearInterval(beat);
  beat = window.setInterval(() => { if (document.visibilityState === 'visible') void setState(/** @type {any} */ (getLast())); }, HEARTBEAT_MS);
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
let retry = 0;
/**
 * Nghe toàn bộ presence. onChange nhận bản đồ {mã: {name, lop, state, at}} mỗi khi có thay đổi.
 * onStatus báo 'live' | 'off' (chưa có vé / Firebase từ chối) để giao diện hiển thị.
 * @param {(map: Record<string, any>) => void} onChange @param {(s: 'live'|'off', why?: string) => void} onStatus
 */
export async function watch(onChange, onStatus) {
  stopWatch();
  if (!ENABLED()) { onStatus('off', 'Chưa cài dự án Firebase cho trạng thái trực tuyến (presence-config.js).'); return; }
  const s = await fresh(KEY_GV);
  if (!s) { onStatus('off', 'Chưa có vé Firebase của giáo viên. Đăng xuất rồi đăng nhập lại.'); return; }
  /** @type {Record<string, any>} */ let map = {};
  const src = new EventSource(url('presence', s.idToken));
  es = src;
  const apply = (/** @type {string} */ path, /** @type {any} */ data, /** @type {boolean} */ merge) => {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) { map = merge ? { ...map, ...(data || {}) } : (data || {}); }
    else if (parts.length === 1) { if (data === null) delete map[parts[0]]; else map[parts[0]] = merge ? { ...(map[parts[0]] || {}), ...data } : data; }
    else { const k = parts[0]; map[k] = { ...(map[k] || {}), [parts[1]]: data }; }
    onChange({ ...map });
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
export function stopWatch() { if (es) { es.close(); es = null; } }
