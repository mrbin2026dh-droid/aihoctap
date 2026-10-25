// Kiểm tra dữ liệu file Excel đề: đúng mẫu, loại câu, đáp án, điểm mỗi câu, lỗi từng dòng.
import assert from 'node:assert/strict';
import {parseExamRows, templateRows, EXAM_COLUMNS, MAX_QUESTIONS} from '../frontend/hoc/exam-import.js';
const H = EXAM_COLUMNS.slice();
const tn = (over = {}) => { const base = {stt: 1, kind: 'TN', q: 'Câu một?', a: 'Đáp án một', b: 'Đáp án hai', c: 'Đáp án ba', d: 'Đáp án bốn', ans: 'A', pts: 1, topic: 'Phần cứng', hint: ''}; const o = {...base, ...over}; return [o.stt, o.kind, o.q, o.a, o.b, o.c, o.d, o.ans, o.pts, o.topic, o.hint]; };
const errs = (rows, i = 0) => parseExamRows([H, ...rows]).reports[i].errors.join('|');

// File mẫu đọc lại được và hợp lệ
const tpl = templateRows(); const ok = parseExamRows(tpl.questions);
assert.ok(ok.valid, JSON.stringify(ok.reports)); assert.equal(ok.questions.length, 2); assert.equal(ok.total_points, 3);
assert.deepEqual(ok.questions[0].options.A, 'Bộ xử lí trung tâm (CPU)'); assert.equal(ok.questions[0].correct_answer, 'A'); assert.equal(ok.questions[1].kind, 'text');

// Sai mẫu
assert.match(parseExamRows([]).fatal, /File trống/);
assert.match(parseExamRows([['a', 'b']]).fatal, /không đúng mẫu: cột 1/);
assert.match(parseExamRows([H.map((x, i) => i === 8 ? 'Mark' : x)]).fatal, /cột 9 phải là "Điểm"/);
assert.match(parseExamRows([H]).fatal, /chưa có câu hỏi/);
assert.ok(parseExamRows([H.map(x => ' ' + x.toUpperCase() + ' '), tn()]).valid, 'tiêu đề không phân biệt hoa thường/khoảng trắng');

// Điểm mỗi câu
assert.match(errs([tn({pts: ''})]), /Thiếu điểm/);
assert.match(errs([tn({pts: 'abc'})]), /Điểm phải là số/);
assert.match(errs([tn({pts: 0})]), /lớn hơn 0/);
assert.match(errs([tn({pts: -1})]), /Điểm phải là số|lớn hơn 0/);
assert.match(errs([tn({pts: 101})]), /Điểm tối đa 100/);
assert.match(errs([tn({pts: 0.333})]), /2 chữ số thập phân/);
const dec = parseExamRows([H, tn({pts: '0,5'}), tn({stt: 2, q: 'Câu hai?', pts: 0.25}), tn({stt: 3, q: 'Câu ba?', pts: '1.25'})]);
assert.ok(dec.valid, JSON.stringify(dec.reports)); assert.deepEqual(dec.questions.map(q => q.points), [0.5, 0.25, 1.25]); assert.equal(dec.total_points, 2);

// Loại câu
assert.match(errs([tn({kind: 'XX'})]), /TN hoặc TL/);
assert.equal(parseExamRows([H, tn({kind: 'Trắc nghiệm'})]).questions[0].kind, 'choice');
assert.equal(parseExamRows([H, tn({kind: 'tự luận', a: '', b: '', c: '', d: '', ans: ''})]).questions[0].kind, 'text');

// Trắc nghiệm
assert.match(errs([tn({q: ''})]), /Thiếu nội dung câu hỏi/);
assert.match(errs([tn({a: '', b: '', c: '', d: ''})]), /ít nhất đáp án A và B/);
assert.match(errs([tn({b: ''})]), /liền nhau|ít nhất/);
assert.match(errs([tn({b: '', c: 'Đáp án ba'})]), /liền nhau/);
assert.match(errs([tn({ans: ''})]), /Thiếu đáp án đúng/);
assert.match(errs([tn({ans: 'E'})]), /chỉ ghi một chữ cái/);
assert.match(errs([tn({ans: 'A,B'})]), /chỉ ghi một chữ cái/);
assert.match(errs([tn({d: '', ans: 'D'})]), /Đáp án đúng D đang để trống/);
assert.match(errs([tn({b: 'Đáp án một'})]), /hai đáp án giống nhau/);
assert.ok(parseExamRows([H, tn({ans: 'c'})]).valid, 'chữ thường được chấp nhận');
assert.ok(parseExamRows([H, tn({c: '', d: ''})]).valid, 'chỉ A và B vẫn hợp lệ');

// Tự luận
const tl = (over = {}) => tn({kind: 'TL', a: '', b: '', c: '', d: '', ans: '', ...over});
assert.match(errs([tl({a: 'x'})]), /không điền đáp án A/);
assert.match(errs([tl({ans: 'A'})]), /không điền "Đáp án đúng"/);
assert.ok(parseExamRows([H, tl()]).valid);

// Trùng câu, dòng trống, số dòng báo đúng
const mix = parseExamRows([H, tn(), ['', '', '', '', '', '', '', '', '', '', ''], tn({stt: 2}), tn({stt: 3, q: 'Câu khác?', pts: ''})]);
assert.equal(mix.valid, false); assert.deepEqual(mix.reports.map(r => [r.row, r.ok]), [[2, true], [4, false], [5, false]]);
assert.match(mix.reports[1].errors.join('|'), /Trùng với câu ở dòng 2/);
assert.equal(mix.questions.length, 1, 'chỉ đếm các câu hợp lệ');
assert.equal(parseExamRows([H, tn({topic: 'x'.repeat(61)})]).valid, false);
assert.equal(parseExamRows([H, tn({hint: 'x'.repeat(1001)})]).valid, false);
const many = parseExamRows([H, ...Array.from({length: MAX_QUESTIONS + 1}, (_, i) => tn({stt: i + 1, q: 'Câu số ' + i}))]);
assert.match(many.fatal, /tối đa 200/); assert.equal(many.valid, false);
console.log('EXAM IMPORT OK');
