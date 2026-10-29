// Kiểm lại điểm bài nộp (teacher-thi.js → checkScore): điểm do máy học sinh tự tính rồi gửi lên Firebase,
// nên thầy cô cần thấy ngay bài nào có điểm không khớp câu trả lời + đáp án.
// Chạy: node tests/test_check_score.mjs
import fs from 'node:fs';
import assert from 'node:assert';
const src = fs.readFileSync(new URL('../frontend/hoc/teacher-thi.js', import.meta.url), 'utf8');
const m = src.match(/export function checkScore\([\s\S]*?\n}\n/);
assert(m, 'tìm thấy checkScore');
const checkScore = new Function(m[0].replace('export ', '') + '; return checkScore;')();
let n = 0; const ok = (c, msg) => { assert(c, msg); n++; };
const de = [
  { id: 'q1', answer: 'A', points: 1 }, { id: 'q2', answer: 'b', points: 2 }, { id: 'q3', answer: 'C' },
  { id: 't1', kind: 'tl', points: 3 }
];
ok(checkScore({ diem: 5, tong: 7, tra_loi: { q1: 'a', q2: 'B', q3: 'D' }, tu_luan: { t1: { d: 2, max: 3 } } }, de) === null, 'khớp (không phân biệt hoa thường) → không cảnh báo');
ok(JSON.stringify(checkScore({ diem: 7, tong: 7, tra_loi: { q1: 'A' }, tu_luan: {} }, de)) === JSON.stringify({ tinh: 1, tong: 7 }), 'tự nâng điểm → cảnh báo, tính lại 1/7');
ok(checkScore({ diem: 6, tong: 7, tra_loi: { q1: 'A', q2: 'B' }, tu_luan: { t1: { d: 9, max: 3 } } }, de) !== null, 'điểm tự luận vượt tối đa → cảnh báo');
ok(checkScore({ diem: 3, tong: 4, tra_loi: { q1: 'A', q2: 'B' } }, de, true) === null, 'thi thật: bỏ câu tự luận (app không hiện) → khớp 3/4');
ok(checkScore({ diem: 3, tong: 7, tra_loi: { q1: 'A', q2: 'B' } }, de, true) !== null, 'thi thật: tổng điểm sai → cảnh báo');
ok(checkScore({ diem: 1, tong: 4 }, { a: { id: 'q1', answer: 'A' } }) !== null, 'đề dạng object vẫn đọc được');
ok(checkScore({ diem: 0, tong: 0 }, []) === null && checkScore(null, de) === null, 'thiếu dữ liệu → không kết luận');
ok(checkScore({ diem: 1.33, tong: 4, tra_loi: { q1: 'A' } }, [{ id: 'q1', answer: 'A', points: 1.333 }, { id: 'q2', answer: 'B', points: 2.667 }]) === null, 'làm tròn 2 chữ số như app học sinh');
console.log('CHECK SCORE OK ' + n);
