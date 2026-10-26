// @ts-check
// Firebase REST cho học sinh (Cổng 2): đăng nhập Email/Password, làm mới token, đọc/ghi RTDB qua REST.
// Không dùng SDK WebSocket (gói Spark giới hạn 100 kết nối đồng thời; REST không tính vào giới hạn này).
// Khóa API web Firebase là thông tin công khai theo thiết kế; quyền thật nằm ở luật RTDB.
import { ApiError } from './api.js';

export const FB_CONFIG = {
  apiKey: 'AIzaSyCC2tCURXYAMpdN687kcjY537K7zUhh_Fg',
  dbUrl: 'https://day-hoc-tuong-tac-7ee69-default-rtdb.asia-southeast1.firebasedatabase.app',
  emailDomain: 'hs.aihoc.test',
  // URL /exec của Apps Script chấm thi (apps-script/exam/Code.gs). Để trống thì học sinh thấy "Đã nhận bài, điểm sẽ có sau".
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbz-bNti_nTpFESXHykLsX2HpOVa0TPilIjdUmzUe_8vzdd3q7QPCRhHiaUQ23GgjLp_/exec'
};
const STORE = 'aisgk-fb';
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

/** @typedef {{uid:string,idToken:string,refreshToken:string,exp:number}} FbSession */

/** Email Firebase của học sinh — phải khớp getEmailOf_() trong apps-script/provisioning/Code.gs. @param {string} code */
export function emailOf(code) { return code.toLowerCase().replace(/[^a-z0-9_-]/g, '') + '@' + FB_CONFIG.emailDomain; }

/** @returns {FbSession|null} */
function load() { try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); return s && s.uid && s.refreshToken ? s : null; } catch { return null; } }
/** @param {FbSession|null} s */
function store(s) { try { if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE); } catch { /* bỏ qua */ } }

export function hasSession() { return Boolean(load()); }
export function uid() { return load()?.uid || ''; }
export function clear() { store(null); offsetMs = 0; }

/** Đăng nhập Firebase bằng mã học sinh + PIN. Trả về uid; ném lỗi nếu sai/chưa có tài khoản. @param {string} code @param {string} pin */
export function signIn(code, pin) {
  inflight = doSignIn(code, pin).finally(() => { inflight = null; });
  return inflight;
}
/** @type {Promise<string>|null} */ let inflight = null;
/** Chờ lượt đăng nhập đang chạy (nếu có) — tránh mở tab Thi ngay sau đăng nhập mà chưa thấy đề Firebase. */
export async function ready() { if (inflight) await Promise.race([inflight.catch(() => {}), new Promise(r => setTimeout(r, 4000))]); }
/** @param {string} code @param {string} pin */
async function doSignIn(code, pin) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_CONFIG.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal,
      body: JSON.stringify({ email: emailOf(code), password: pin, returnSecureToken: true })
    });
  } catch { throw new ApiError(0, 'Chưa kết nối được hệ thống thi.'); }
  finally { clearTimeout(timer); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, authMessage(data?.error?.message || ''), data?.error?.message);
  store({ uid: data.localId, idToken: data.idToken, refreshToken: data.refreshToken, exp: Date.now() + Number(data.expiresIn || 3600) * 1000 });
  return /** @type {string} */ (data.localId);
}

/** @param {string} code */
function authMessage(code) {
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(code)) return 'Mã học sinh hoặc mã PIN chưa đúng.';
  if (/TOO_MANY_ATTEMPTS/.test(code)) return 'Đăng nhập sai quá nhiều lần. Đợi vài phút hoặc nhờ thầy cô đặt lại PIN.';
  if (/USER_DISABLED/.test(code)) return 'Tài khoản đang bị khóa. Hãy báo thầy cô.';
  return 'Chưa đăng nhập được hệ thống thi. Thử lại sau.';
}

/** Token còn hạn (tự làm mới khi còn dưới 5 phút; token Firebase sống 1 giờ). @param {boolean} [force] */
export async function token(force = false) {
  const s = load();
  if (!s) throw new ApiError(401, 'Chưa đăng nhập hệ thống thi. Đăng xuất rồi đăng nhập lại.');
  if (!force && s.exp - Date.now() > REFRESH_BEFORE_MS) return s.idToken;
  let res;
  try {
    res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_CONFIG.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'omit',
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`
    });
  } catch { throw new ApiError(0, 'Mất kết nối. Bài vẫn được giữ trên máy.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 400) store(null); throw new ApiError(401, 'Phiên thi đã hết hạn. Đăng xuất rồi đăng nhập lại.'); }
  store({ uid: data.user_id || s.uid, idToken: data.id_token, refreshToken: data.refresh_token, exp: Date.now() + Number(data.expires_in || 3600) * 1000 });
  return /** @type {string} */ (data.id_token);
}

/**
 * Đọc/ghi một nút RTDB. Bị luật chặn → ApiError 403 (không thử lại); mất mạng → ApiError 0 (thử lại được).
 * @template T @param {string} path @param {{method?:'GET'|'PUT'|'PATCH'|'DELETE',body?:unknown,timeout?:number}} [opt] @returns {Promise<T>}
 */
export async function rtdb(path, opt = {}) {
  for (let round = 0; round < 2; round++) {
    const t = await token(round > 0);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), opt.timeout || 20000);
    let res;
    try {
      res = await fetch(`${FB_CONFIG.dbUrl}/${path}.json?auth=${encodeURIComponent(t)}`, {
        method: opt.method || 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: opt.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: opt.body === undefined ? undefined : JSON.stringify(opt.body)
      });
    } catch { throw new ApiError(0, 'Mất kết nối. Bài vẫn được giữ trên máy và sẽ thử lại.'); }
    finally { clearTimeout(timer); }
    if (res.ok) return /** @type {Promise<T>} */ (res.json());
    const text = await res.text().catch(() => '');
    // Token hết hạn giữa chừng → làm mới một lần rồi thử lại.
    if (res.status === 401 && round === 0 && /expired|Auth token|invalid/i.test(text) && !/Permission denied/i.test(text)) continue;
    if (res.status === 401 || res.status === 403) throw new ApiError(403, 'Không có quyền thực hiện (có thể đã hết giờ hoặc hết lượt).', 'PERMISSION_DENIED');
    if (res.status >= 500 || res.status === 429) throw new ApiError(0, 'Máy chủ đang bận. Bài vẫn được giữ và sẽ thử lại.');
    throw new ApiError(res.status, 'Dữ liệu chưa hợp lệ.');
  }
  throw new ApiError(401, 'Phiên thi đã hết hạn. Đăng xuất rồi đăng nhập lại.');
}

let offsetMs = 0;
/** Giờ máy chủ Firebase: ghi {".sv":"timestamp"} vào clock/{uid}, REST trả lại giá trị đã điền. */
export async function serverNow() {
  const before = Date.now();
  const v = await rtdb(`clock/${uid()}`, { method: 'PUT', body: { '.sv': 'timestamp' } });
  const after = Date.now();
  if (typeof v === 'number') offsetMs = v - Math.round((before + after) / 2);
  return Date.now() + offsetMs;
}
export function now() { return Date.now() + offsetMs; }
