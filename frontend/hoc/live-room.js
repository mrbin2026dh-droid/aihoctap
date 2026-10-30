// @ts-check
// Phòng Luyện tập trực tiếp / Thảo luận "còn sống" không (30/10/2026).
// Lỗi: giáo viên tắt máy, đóng trình duyệt hoặc tải lại trang mà chưa bấm Kết thúc → phòng treo, học sinh thấy thông báo
// "Thầy cô đang mở…" cả ngày, vào phòng thì kẹt ở câu cũ.
// Cách làm: máy giáo viên ghi nhịp pub/hb (giờ máy chủ) mỗi phút. Máy học sinh coi phòng đã đóng khi nhịp đứng yên quá 5 phút
// (đo bằng đồng hồ máy học sinh từ lúc thấy nhịp đổi, nên máy học sinh chỉnh sai giờ cũng không ảnh hưởng).
// Phòng mở trước bản này (chưa có nhịp): coi là đã đóng sau 3 giờ kể từ lúc mở.

export const HB_MS = 60 * 1000;
export const STALE_MS = 5 * 60 * 1000;
export const NO_HB_MS = 3 * 3600 * 1000;
/** @type {Map<string, {hb:number, at:number}>} */ const seen = new Map();

/** @param {string} room @param {any} pub @param {number} [now] */
export function alive(room, pub, now = Date.now()) {
  if (!room || !pub || pub.phase === 'end') return false;
  const hb = Number(pub.hb) || 0;
  if (!hb) { const at = Number(pub.at) || 0; return !at || now - at < NO_HB_MS; }
  const s = seen.get(room);
  if (!s || s.hb !== hb) { seen.set(room, { hb, at: now }); return true; }
  return now - s.at < STALE_MS;
}
/** Chỉ dùng trong kiểm thử. */
export function _reset() { seen.clear(); }
