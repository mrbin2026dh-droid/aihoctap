// @ts-check
// BẢNG THI ĐUA LUYỆN TẬP (30/10/2026) – phần tính điểm dùng chung cho máy giáo viên và máy học sinh (cùng một mã → cùng một kết quả).
// Quy tắc thầy chốt:
//   • Kỳ thi đua: theo THÁNG (giờ Việt Nam, tính theo lúc kết thúc buổi luyện tập).
//   • Điểm một buổi = số câu đúng / số câu của buổi × 10 (thang 10). Không tính tốc độ bấm (máy yếu, mạng chậm không bị thiệt).
//   • Điểm tháng = TRUNG BÌNH CÁC BUỔI CAO NHẤT: lấy N buổi điểm cao nhất của em, N = 60% số buổi lớp đã luyện trong tháng (làm tròn lên, ít nhất 1).
//     Em tham gia ít hơn N buổi → chưa được xếp hạng (hiện "cần thêm x buổi").
//   • Bằng điểm: xét số buổi tham gia nhiều hơn, rồi tổng số câu đúng nhiều hơn; vẫn bằng → cùng hạng (1, 1, 3).
//   • Học sinh xem: top 10 + hạng của chính em. Thảo luận không tính.
// Tính bằng PHÂN SỐ SỐ NGUYÊN (BigInt), không dùng số thực → không sai số làm tròn khi so sánh; chỉ làm tròn ở bước hiển thị (2 chữ số, làm tròn nửa lên).

/** Tháng theo giờ Việt Nam, dạng 2026-11. @param {number} [t] */
export const monthVN = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 7);
/** "tháng 11/2026". @param {string} m */
export const monthLabel = m => `tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
/** Tháng trước. @param {string} m */
export const prevMonth = m => { const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
/** Số buổi được tính: 60% số buổi trong tháng, làm tròn lên, ít nhất 1 (số nguyên, không dùng 0.6 * K để tránh sai số). @param {number} K */
export const needOf = K => (K > 0 ? Math.max(1, Math.floor((3 * K + 4) / 5)) : 0);
/** Tên rút gọn cho học sinh xem: "Nguyễn Văn An" → "Nguyễn V. An". @param {string} ten */
export function shortName(ten) {
  const w = String(ten || '').replace(/^\[THỬ\]\s*/, '[THỬ] ').trim().split(/\s+/).filter(Boolean);
  const tag = w[0] === '[THỬ]' ? w.shift() + ' ' : '';
  if (w.length <= 2) return tag + w.join(' ');
  return tag + [w[0], ...w.slice(1, -1).map(x => x.charAt(0).toUpperCase() + '.'), w[w.length - 1]].join(' ');
}

/** @typedef {{c:number, n:number}} Buoi */
/** @typedef {{room:string, at:number, bo:string, so_cau:number, kq:Record<string,{c:number,ten:string}>}} Session */
/** @typedef {{k:string, ten:string, buoi:number, tinh:number, dung:number, tong:number, diem:string, d100:number, hang:number, du:boolean, thieu:number, cacBuoi:{room:string,at:number,bo:string,c:number,n:number,tinh:boolean}[], num:bigint, den:bigint}} Row */

/** Chuẩn hóa dữ liệu Firebase quiz_kq_lop/{lớp}/{tháng} (bỏ bản ghi hỏng). @param {any} data @returns {Session[]} */
export function sessionsOf(data) {
  /** @type {Session[]} */ const out = [];
  for (const [room, v] of Object.entries(data && typeof data === 'object' ? data : {})) {
    const n = Number(v?.so_cau);
    if (!/^\d{6}$/.test(room) || !Number.isInteger(n) || n < 1 || n > 200) continue;
    /** @type {Record<string,{c:number,ten:string}>} */ const kq = {};
    for (const [k, e] of Object.entries(v?.kq && typeof v.kq === 'object' ? v.kq : {})) {
      const c = Number(/** @type {any} */ (e)?.c);
      if (Number.isInteger(c) && c >= 0 && c <= n && k.length <= 64) kq[k] = { c, ten: String(/** @type {any} */ (e)?.ten || k).slice(0, 100) };
    }
    out.push({ room, at: Number(v?.at) || 0, bo: String(v?.bo || '').slice(0, 120), so_cau: n, kq });
  }
  return out.sort((a, b) => a.at - b.at || a.room.localeCompare(b.room));
}

/** So sánh phân số a/b với c/d (mẫu dương). @param {bigint} a @param {bigint} b @param {bigint} c @param {bigint} d */
const cmpFrac = (a, b, c, d) => { const x = a * d, y = c * b; return x > y ? 1 : x < y ? -1 : 0; };
const gcd = (/** @type {bigint} */ a, /** @type {bigint} */ b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a || 1n; };
/** Điểm thang 10 × 100, làm tròn nửa lên (số nguyên): num/den là trung bình tỉ lệ đúng (0..1). @param {bigint} num @param {bigint} den */
export const to100 = (num, den) => Number((2000n * num + den) / (2n * den));
/** 875 → "8,75". @param {number} d100 */
export const fmt = d100 => `${Math.floor(d100 / 100)},${String(d100 % 100).padStart(2, '0')}`;

/** Xếp hạng một lớp trong một tháng.
 * @param {Session[]} sessions
 * @returns {{K:number, N:number, rows:Row[], chua:Row[], tbLop:string, chamChi:Row[], tienBo:{row:Row, tang:number}[]}} */
export function rankMonth(sessions) {
  const K = sessions.length, N = needOf(K);
  /** @type {Map<string, {ten:string, at:number, list:{room:string,at:number,bo:string,c:number,n:number}[]}>} */ const by = new Map();
  for (const s of sessions) for (const [k, e] of Object.entries(s.kq)) {
    const x = by.get(k) || { ten: e.ten, at: 0, list: [] };
    if (s.at >= x.at) { x.ten = e.ten; x.at = s.at; }   // tên mới nhất
    x.list.push({ room: s.room, at: s.at, bo: s.bo, c: e.c, n: s.so_cau }); by.set(k, x);
  }
  /** @type {Row[]} */ const all = [];
  for (const [k, x] of by) {
    // N buổi điểm cao nhất: sắp theo c/n giảm dần (so phân số chính xác), bằng điểm lấy buổi sớm hơn để kết quả ổn định
    const best = [...x.list].sort((a, b) => cmpFrac(BigInt(b.c), BigInt(b.n), BigInt(a.c), BigInt(a.n)) || a.at - b.at).slice(0, N);
    let num = 0n, den = 1n;
    for (const b of best) { num = num * BigInt(b.n) + BigInt(b.c) * den; den *= BigInt(b.n); const g = gcd(num, den); num /= g; den /= g; }
    const cnt = best.length || 1; den *= BigInt(cnt); { const g = gcd(num, den); num /= g; den /= g; }
    const used = new Set(best);
    const du = x.list.length >= N && N > 0;
    all.push({
      k, ten: x.ten, buoi: x.list.length, tinh: best.length,
      dung: x.list.reduce((a, b) => a + b.c, 0), tong: x.list.reduce((a, b) => a + b.n, 0),
      d100: to100(num, den), diem: fmt(to100(num, den)), hang: 0, du, thieu: Math.max(0, N - x.list.length),
      cacBuoi: x.list.sort((a, b) => a.at - b.at).map(b => ({ ...b, tinh: used.has(b) })), num, den
    });
  }
  const order = (/** @type {Row} */ a, /** @type {Row} */ b) => cmpFrac(b.num, b.den, a.num, a.den) || b.buoi - a.buoi || b.dung - a.dung;
  const rows = all.filter(r => r.du).sort((a, b) => order(a, b) || a.ten.localeCompare(b.ten, 'vi'));
  rows.forEach((r, i) => { r.hang = i > 0 && order(rows[i - 1], r) === 0 ? rows[i - 1].hang : i + 1; });
  const chua = all.filter(r => !r.du).sort((a, b) => b.buoi - a.buoi || a.ten.localeCompare(b.ten, 'vi'));
  // Điểm trung bình lớp (của các em được xếp hạng), cũng tính bằng phân số
  let sn = 0n, sd = 1n; for (const r of rows) { sn = sn * r.den + r.num * sd; sd *= r.den; const g = gcd(sn, sd); sn /= g; sd /= g; }
  const tbLop = rows.length ? fmt(to100(sn, sd * BigInt(rows.length))) : '–';
  // Danh hiệu khách quan: Chăm chỉ (nhiều buổi nhất, ≥ 2 buổi, chỉ khi tối đa 3 em đạt – cả lớp đi đủ thì không ai "nhất");
  // Tiến bộ (điểm buổi cuối − buổi đầu lớn nhất, > 0, ≥ 2 buổi)
  const maxB = Math.max(0, ...all.map(r => r.buoi)), most = all.filter(r => r.buoi === maxB);
  const chamChi = maxB >= 2 && most.length <= 3 ? most.sort((a, b) => a.ten.localeCompare(b.ten, 'vi')) : [];
  const tang = all.filter(r => r.cacBuoi.length >= 2).map(r => { const f = r.cacBuoi[0], l = r.cacBuoi[r.cacBuoi.length - 1];
    return { row: r, num: BigInt(l.c) * BigInt(f.n) - BigInt(f.c) * BigInt(l.n), den: BigInt(l.n) * BigInt(f.n) }; }).filter(x => x.num > 0n);
  tang.sort((a, b) => cmpFrac(b.num, b.den, a.num, a.den) || a.row.ten.localeCompare(b.row.ten, 'vi'));
  const top = tang[0];
  const tienBo = top ? tang.filter(x => cmpFrac(x.num, x.den, top.num, top.den) === 0).slice(0, 3).map(x => ({ row: x.row, tang: to100(x.num, x.den) })) : [];
  return { K, N, rows, chua, tbLop, chamChi, tienBo };
}

/** Khoảng cách tới top 10 (theo điểm hiển thị, thang 10). null = đã trong top 10 hoặc chưa được xếp hạng.
 * bang = true: bằng điểm bạn hạng 10 nhưng thua ở số buổi / số câu đúng. @param {Row[]} rows @param {Row|undefined} me */
export function gapTop10(rows, me) {
  if (!me || !me.du || me.hang <= 10) return null;
  const inTop = rows.filter(r => r.hang <= 10), last = inTop[inTop.length - 1];
  if (!last) return null;
  const g = last.d100 - me.d100;
  return g > 0 ? { diem: fmt(g), bang: false } : { diem: '0,00', bang: true };
}
