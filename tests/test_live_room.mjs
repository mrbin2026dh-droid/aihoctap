// Phòng Luyện tập trực tiếp / Thảo luận còn mở không (live-room.js): giáo viên tắt máy chưa bấm Kết thúc → học sinh tự thoát sau 5 phút.
import assert from 'node:assert/strict';
import { alive, _reset, STALE_MS, NO_HB_MS } from '../frontend/hoc/live-room.js';
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok  ', m); };
const T = 1_800_000_000_000;
ok(!alive('', { phase: 'open' }) && !alive('1', null) && !alive('1', { phase: 'end', hb: T }), 'không có phòng / đã kết thúc → không mở');
_reset();
ok(alive('1', { phase: 'open', hb: T }, T + 10), 'thấy nhịp lần đầu → đang mở');
ok(alive('1', { phase: 'open', hb: T }, T + STALE_MS - 1000), 'nhịp đứng yên dưới 5 phút → vẫn mở');
ok(!alive('1', { phase: 'open', hb: T }, T + STALE_MS + 1000), 'nhịp đứng yên quá 5 phút → coi như đã đóng');
ok(alive('1', { phase: 'open', hb: T + 400000 }, T + STALE_MS + 2000), 'giáo viên mở máy lại, nhịp chạy tiếp → mở lại');
_reset();
ok(alive('2', { phase: 'q', hb: T }, T - 5 * 365 * 864e5), 'máy học sinh chỉnh sai giờ (lùi 5 năm) vẫn vào được phòng đang có nhịp');
ok(alive('2b', { phase: 'q', hb: T }, T + 30 * 864e5), 'máy học sinh chạy nhanh giờ vẫn vào được (đo theo lúc thấy nhịp đổi)');
_reset();
ok(!alive('3', { phase: 'open', at: T }, T + NO_HB_MS + 1), 'phòng bản cũ (không có nhịp) mở quá 3 giờ → đã đóng');
ok(alive('3', { phase: 'open', at: T }, T + 3600e3), 'phòng bản cũ mở dưới 3 giờ → vẫn mở');
console.log('LIVE ROOM OK ' + n);
