// Bảng thi đua: tính điểm tháng chính xác tuyệt đối (phân số), đúng quy tắc thầy chốt 30/10/2026.
import assert from 'node:assert/strict';
import { monthVN, monthLabel, prevMonth, needOf, shortName, sessionsOf, rankMonth, gapTop10, to100, fmt } from '../frontend/hoc/thidua-core.js';
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok  ', m); };
// Tháng theo giờ Việt Nam: 31/10 23:30 VN (16:30 UTC) vẫn là tháng 10; 31/10 17:30 UTC = 1/11 00:30 VN → tháng 11
ok(monthVN(Date.UTC(2026, 9, 31, 16, 30)) === '2026-10' && monthVN(Date.UTC(2026, 9, 31, 17, 30)) === '2026-11', 'tháng theo giờ Việt Nam (nửa đêm 31/10 sang 1/11)');
ok(monthLabel('2026-11') === 'tháng 11/2026' && prevMonth('2026-01') === '2025-12' && prevMonth('2026-11') === '2026-10', 'nhãn tháng, tháng trước');
// N = 60% làm tròn lên, ít nhất 1; số nguyên (0.6*45 trong số thực = 27.000000000000004 → sai nếu dùng Math.ceil)
const NS = [[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [6, 4], [10, 6], [15, 9], [20, 12], [45, 27]];
ok(NS.every(([K, N]) => needOf(K) === N), 'số buổi được tính = 60% làm tròn lên: ' + NS.map(([K, N]) => `${K}→${N}`).join(', '));
ok(shortName('Nguyễn Văn An') === 'Nguyễn V. An' && shortName('Lê Thị Thu Hà') === 'Lê T. T. Hà' && shortName('Trần Bình') === 'Trần Bình' && shortName('[THỬ] Nguyễn Văn An') === '[THỬ] Nguyễn V. An', 'tên rút gọn cho học sinh xem');
ok(fmt(875) === '8,75' && fmt(1000) === '10,00' && fmt(5) === '0,05' && to100(2n, 3n) === 667 && to100(1n, 3n) === 333 && to100(1n, 8n) === 125, 'hiển thị 2 chữ số, làm tròn nửa lên (2/3 → 6,67; 1/8 → 1,25)');
// Dữ liệu hỏng bị bỏ
const S = sessionsOf({ '111111': { at: 1, bo: 'B1', so_cau: 10, kq: { a: { c: 11, ten: 'X' }, b: { c: 5, ten: 'Bình' } } }, 'xx': { so_cau: 5 }, '222222': { so_cau: 0 } });
ok(S.length === 1 && !S[0].kq.a && S[0].kq.b.c === 5, 'bỏ bản ghi hỏng (số câu đúng > số câu, mã phòng sai, 0 câu)');
// Ví dụ tính tay: lớp có 5 buổi → N = 3
const mk = (room, at, so_cau, kq) => ({ room, at, bo: 'Bộ ' + room, so_cau, kq: Object.fromEntries(Object.entries(kq).map(([k, c]) => [k, { c, ten: { an: 'Nguyễn Văn An', binh: 'Trần Thị Bình', cuong: 'Lê Cường', dung: 'Phạm Dũng', em: 'Đỗ Em' }[k] || k }])) });
const sess = [
  mk('100001', 1, 10, { an: 9, binh: 10, cuong: 3, dung: 8 }),
  mk('100002', 2, 8, { an: 8, binh: 6, cuong: 4 }),
  mk('100003', 3, 5, { an: 4, binh: 5, cuong: 5, dung: 5 }),
  mk('100004', 4, 10, { an: 7, binh: 9, em: 10 }),
  mk('100005', 5, 6, { an: 6, cuong: 6, dung: 3 })
];
const R = rankMonth(sess);
ok(R.K === 5 && R.N === 3, '5 buổi → tính 3 buổi cao nhất');
// An: 0.9, 1, 0.8, 0.7, 1 → 3 cao nhất 1,1,0.9 → TB 29/30 → 9,67 ; Bình: 1, .75, 1, .9 → 1,1,.9 → 9,67 (bằng An!)
// An 5 buổi > Bình 4 buổi → An hạng 1. Cường: .3,.5,1,1 → 1,1,.5 → 25/30 = 8,33. Dũng: .8,1,.5 → 2.3/3 = 7,67. Em: 1 buổi → chưa đủ (thiếu 2)
const g = k => R.rows.find(r => r.k === k) || R.chua.find(r => r.k === k);
ok(g('an').diem === '9,67' && g('binh').diem === '9,67' && g('cuong').diem === '8,33' && g('dung').diem === '7,67', 'điểm tháng tính tay khớp: An 9,67, Bình 9,67, Cường 8,33, Dũng 7,67');
ok(g('an').hang === 1 && g('binh').hang === 2 && g('cuong').hang === 3 && g('dung').hang === 4, 'bằng điểm 9,67: An (5 buổi) xếp trên Bình (4 buổi)');
ok(!g('em').du && g('em').thieu === 2 && g('em').d100 === 1000 && !R.rows.includes(g('em')), 'một buổi 10 điểm chưa đủ 3 buổi → chưa xếp hạng (không vượt bạn chăm học)');
ok(g('an').cacBuoi.filter(b => b.tinh).length === 3 && g('an').cacBuoi.find(b => b.at === 4).tinh === false, 'đánh dấu đúng các buổi được tính / không tính');
ok(g('an').dung === 34 && g('an').tong === 39 && g('an').buoi === 5, 'tổng số câu đúng 34/39, 5 buổi');
ok(R.chamChi.map(r => r.k).join() === 'an', 'danh hiệu Chăm chỉ: nhiều buổi nhất (An 5 buổi)');
ok(rankMonth([mk('600001', 1, 4, { an: 1, binh: 2, cuong: 3, dung: 4 }), mk('600002', 2, 4, { an: 1, binh: 2, cuong: 3, dung: 4 })]).chamChi.length === 0, 'cả lớp đi đủ (4 em cùng 2 buổi) → không trao Chăm chỉ');
// Tiến bộ: buổi cuối − buổi đầu: An 1−0.9=0.1; Bình .9−1<0; Cường 1−.3=.7; Dũng .5−.8<0 → Cường +7,00
ok(R.tienBo.length === 1 && R.tienBo[0].row.k === 'cuong' && fmt(R.tienBo[0].tang) === '7,00', 'danh hiệu Tiến bộ: Cường tăng 7,00 điểm (3/10 → 6/6)');
ok(R.tbLop === '8,83', 'điểm trung bình lớp = TB 4 em được xếp hạng ((29/30·2 + 25/30 + 23/30)/4 = 8,83)');
// Bằng hoàn toàn → cùng hạng, hạng sau nhảy (1, 1, 3)
const T = rankMonth([mk('200001', 1, 4, { an: 4, binh: 4, cuong: 2 })]);
ok(T.rows.map(r => r.hang).join() === '1,1,3', 'bằng điểm, bằng số buổi, bằng số câu đúng → cùng hạng (1, 1, 3)');
// Phân số khó (1/3 + 2/7 ...) không sai số
const F = rankMonth([mk('300001', 1, 3, { an: 1, binh: 2 }), mk('300002', 2, 7, { an: 2, binh: 1 }), mk('300003', 3, 9, { an: 9, binh: 9 })]);
// N=2: An best: 1, 1/3 → TB 2/3 → 6,67 ; Bình: 1, 2/3 → 5/6 → 8,33
ok(F.rows[0].k === 'binh' && F.rows[0].diem === '8,33' && F.rows[1].diem === '6,67', 'phân số lẻ (1/3, 2/7, 2/3) tính chính xác');
// Top 10 và khoảng cách
const many = {}; for (let i = 0; i < 14; i++) many['h' + i] = 14 - i;
const M = rankMonth([mk('400001', 1, 20, many)]);
const me = M.rows.find(r => r.k === 'h12');
const gp = gapTop10(M.rows, me);
ok(me.hang === 13 && gp && gp.diem === '1,50' && !gp.bang && gapTop10(M.rows, M.rows[0]) === null, 'em hạng 13: còn 1,50 điểm nữa vào top 10; em trong top 10: không hiện khoảng cách');
ok(rankMonth([]).K === 0 && rankMonth([]).rows.length === 0 && rankMonth([]).tbLop === '–', 'tháng chưa có buổi nào: bảng trống, không lỗi');
console.log('THI DUA CORE OK ' + n);
