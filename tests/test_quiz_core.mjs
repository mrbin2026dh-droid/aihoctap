// Lõi Luyện tập: điểm theo công thức Kahoot, chấm cả lớp, xếp hạng, danh hiệu, đọc file Excel.
// Chạy: node tests/test_quiz_core.mjs
import assert from 'node:assert/strict';
import { points, scoreQuestion, ranked, awards, parseQuizRows, setClasses, QUIZ_COLUMNS } from '../frontend/hoc/quiz-core.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };

ok(points(true, 0, 20) === 1000 && points(true, 20000, 20) === 500 && points(true, 10000, 20) === 750, 'công thức Kahoot: đúng ngay 1000, sát giờ 500, nửa thời gian 750');
ok(points(true, 99999, 20) === 500 && points(true, -5, 20) === 1000 && points(false, 0, 20) === 0, 'quá giờ vẫn tối thiểu 500; sai = 0');

const score = {}, players = { a: { ten: 'An' }, b: { ten: 'Bình' }, c: { ten: 'Chi' } };
let cnt = scoreQuestion(score, players, { a: { a: 'B', t: 1000 + 2000 }, b: { a: 'A', t: 1000 + 1000 } }, { ans: 'B' }, 1000, 20);
ok(cnt.B === 1 && cnt.A === 1 && cnt.none === 1, 'đếm phương án + em không trả lời');
ok(score.a.p === 950 && score.a.c === 1 && score.a.streak === 1 && score.a.last === 950, 'An đúng sau 2 giây: 950 điểm');
ok(score.b.p === 0 && score.b.streak === 0 && score.b.lastOk === false && score.c.lastOk === null, 'Bình sai, Chi không trả lời');
scoreQuestion(score, players, { a: { a: 'C', t: 5000 }, c: { a: 'C', t: 5000 } }, { ans: 'C' }, 0, 10);
ok(score.a.streak === 2 && score.a.best === 2 && score.c.p === 750, 'chuỗi đúng tăng; Chi đúng nửa giờ 750');
const rk = ranked(score);
ok(rk.map(r => r.k).join() === 'a,c,b', 'xếp hạng theo điểm');
const aw = awards(score);
ok(aw.find(x => x.giai === 'Quán quân').ten === 'An' && aw.find(x => x.giai === 'Chuỗi đúng dài nhất').ten === 'An', 'danh hiệu: quán quân, chuỗi đúng');
ok(aw.find(x => x.giai === 'Nhanh như chớp') && !aw.some(x => x.ten === 'Bình'), 'em không đúng câu nào không nhận danh hiệu');
ok(awards({ x: { ten: 'X', p: 0, c: 0, streak: 0, best: 0, tsum: 0, tc: 0, last: 0, lastOk: false, answered: 1 } }).length === 0, 'không ai đúng → không trao danh hiệu');

const rows = [QUIZ_COLUMNS, [1, '1 byte bằng bao nhiêu bit?', '4', '8', '16', '2', 'b', 'Đơn vị'], [2, 'Thiếu đáp án', 'x', 'y', '', '', 'C', ''], [3, '', '', '', '', '', '', ''], [4, 'CPU là gì?', 'Bộ xử lý', 'Màn hình', '', '', 'A', 'Phần cứng']];
let r = parseQuizRows(rows);
ok(r.qs.length === 2 && r.qs[0].ans === 'B' && r.qs[0].opts.D === '2' && r.qs[1].topic === 'Phần cứng', 'đọc file mẫu Luyện tập; đáp án chữ thường vẫn nhận');
ok(r.errors.length === 1 && r.errors[0].includes('Dòng 3'), 'báo đúng dòng lỗi; bỏ dòng trống');
const exam = [['STT', 'Loại (TN/TL)', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Điểm', 'Chủ đề', 'Gợi ý'], [1, 'TN', 'Bit là gì?', 'Đơn vị nhỏ nhất', 'Ổ cứng', '', '', 'A', 1, 'Mã nhị phân', ''], [2, 'TL', 'Nêu ví dụ', '', '', '', '', '', 2, '', 'gợi ý']];
r = parseQuizRows(exam);
ok(r.qs.length === 1 && r.qs[0].text === 'Bit là gì?' && !r.errors.length, 'nhận cả file mẫu đề thi (lấy câu trắc nghiệm, bỏ tự luận)');
ok(parseQuizRows([['x', 'y']]).fatal && parseQuizRows([['STT', 'Câu', 'A']]).fatal, 'sai mẫu → báo lỗi rõ');
ok(setClasses({ lop: '9A' }).join() === '9A' && setClasses({ lops: ['9A', '9B'], lop: '9A' }).join() === '9A,9B', 'bộ câu hỏi cũ một lớp vẫn dùng được');
console.log('QUIZ CORE OK ' + n);
import { classSummary } from '../frontend/hoc/quiz-core.js';
{
  const s = classSummary([{ text: 'a', opts: { A: 'x', B: 'y' }, ans: 'A', topic: 'Bit', pct: 90, counts: { A: 9, B: 1 } }, { text: 'b', opts: { A: 'CPU', B: 'RAM' }, ans: 'A', topic: 'Phần cứng', pct: 20, counts: { A: 2, B: 8 } }]);
  ok(s.muc_hieu === 'Trung bình' && s.muc[1].items[0].includes('Câu 1 (Bit)') && s.muc[2].items[0].includes('nhiều em chọn B. "RAM"') && s.muc[3].items[0].includes('Phần cứng'), 'nhận xét tính sẵn khi AI lỗi: mức hiểu, câu tốt, hiểu lầm, đề xuất');
  ok(classSummary([]).muc.length === 0, 'chưa có câu nào → không nhận xét');
  console.log('QUIZ CORE SUMMARY OK');
}
