// Lõi Thảo luận (kiểu Mentimeter): đám mây từ khóa, lọc từ ngữ, bình chọn, thang điểm, hỏi đáp, gỡ ý, Excel, tổng hợp.
// Chạy: node tests/test_tl_core.mjs
import assert from 'node:assert/strict';
import { badWord, cloud, cloudSize, pollCounts, scaleStats, scaleValue, entriesOf, visible, qaRank, slideError, cleanSlide, parseTlRows, TL_COLUMNS, summarize, localNotes, fold, MAX_LEN } from '../frontend/hoc/tl-core.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };

const c = cloud(['Internet', 'internet ', 'INTERNET!', 'Học tập', 'học  tập', 'Giải trí', 'đm', 'cấm'], ['cấm']);
ok(c[0].w === 'internet' && c[0].n === 3 && c[1].w === 'học tập' && c[1].n === 2, 'đám mây: gộp chữ thường, bỏ dấu câu, đếm, xếp nhiều lên trước');
ok(!c.some(x => x.w === 'đm') && !c.some(x => x.w === 'cấm'), 'đám mây: bỏ từ bị lọc và từ giáo viên đã ẩn');
ok(cloudSize(1, 10) === 20 && cloudSize(10, 10) === 76 && cloudSize(5, 10) > 40, 'cỡ chữ đám mây tăng theo số lần');
ok(MAX_LEN.cloud === 25 && MAX_LEN.open === 200, 'giới hạn độ dài: từ khóa 25, ý kiến 200 ký tự');

ok(badWord('Bạn ấy đm thật') && badWord('d.m') === 'dm' && badWord('VCL') === 'vcl' && badWord('đ1t m3') !== '', 'lọc từ ngữ: viết tắt, chữ hoa, chèn dấu chấm, lách bằng số');
ok(badWord('đồ ngu') && badWord('do ngu'), 'lọc cụm từ có dấu và không dấu');
ok(!badWord('Các bạn mua lon nước') && !badWord('cac ban hoc tot') && !badWord('Con chó nhà em') && !badWord('mạng xã hội'), 'không chặn nhầm từ thường ("các", "lon nước", "con chó")');
ok(badWord('bạn thật xấu tính', ['xấu tính']) === 'xau tinh' || badWord('bạn thật xấu tính', ['xấu tính']) === 'xấu tính', 'giáo viên thêm từ cấm riêng');
ok(fold('Đ1T  mẹẹẹ') === 'dit me', 'chuẩn hóa: bỏ dấu, đổi số thành chữ, gộp chữ lặp');

ok(pollCounts(['0', '1', '1', '2', '9', 'x', '1'], 3).join() === '1,3,1', 'bình chọn: đếm, bỏ giá trị lạ');
const sc = scaleStats(['4|5', '2|5', '3', '6|1', '5|4'], 2);
ok(sc[0].n === 3 && sc[0].avg === 3.7 && sc[1].avg === 4.7 && sc[0].dist[3] === 1, 'thang điểm: trung bình từng tiêu chí, bỏ bài gửi sai dạng');
ok(scaleValue([4, 5, 3]) === '4|5|3' && scaleValue([0, 5]) === '', 'thang điểm: chuỗi gửi lên hợp lệ');

const y = { hs01: { 0: { v: 'Tìm tài liệu', t: 3 }, 1: { v: 'Giải trí', t: 5 } }, hs02: { 0: { v: 'tìm tài liệu', t: 4 } } };
const list = entriesOf(y);
ok(list.length === 3 && list[0].id === 'hs01~0' && list[1].ma === 'hs02', 'gom ý: mỗi ý có mã "mã học sinh~số thứ tự", xếp theo thời gian');
ok(visible(list, { 'hs01~0': true }).map(e => e.id).join() === 'hs01~1', 'gỡ một ý thì gỡ mọi ý giống hệt (như Mentimeter)');
const qa = qaRank(list, { 'hs01~1': { a: true, b: true }, 'hs02~0': { a: true } }, { 'hs01~1': true });
ok(qa[0].id === 'hs02~0' && qa[0].votes === 1 && qa.at(-1).id === 'hs01~1' && qa.at(-1).done, 'hỏi đáp: nhiều phiếu lên trên, câu đã trả lời xuống cuối');

ok(slideError({ type: 'poll', text: 'Chọn?', opts: ['A'] }).includes('2 lựa chọn') && slideError({ type: 'scale', text: 'Đánh giá', items: [] }).includes('tiêu chí') && !slideError({ type: 'cloud', text: 'Một từ' }), 'kiểm trang khi soạn');
const cs = cleanSlide({ type: 'qa', text: '  Hỏi  gì? ', max: 9, mod: undefined });
ok(cs.text === 'Hỏi gì?' && cs.max === 3 && cs.mod === true && cleanSlide({ type: 'open', text: 'x', mod: false }).mod === false, 'chuẩn hóa trang: duyệt trước bật sẵn, giới hạn số ý mỗi em');

const rows = [TL_COLUMNS, [1, 'Đám mây', 'Một từ về Internet?', '', '', '', '', '', '', 2], [2, 'Bình chọn', 'Em dùng mạng bao lâu?', '<1 giờ', '1–2 giờ', '>2 giờ', '', '', '', ''], [3, 'Bình chọn', 'Thiếu lựa chọn', 'A', '', '', '', '', '', ''], [4, 'Thang điểm', 'Tự đánh giá', 'Hiểu bài', 'Hứng thú', '', '', '', '', ''], [5, 'Sai loại', 'x'], [6, 'Hỏi đáp', 'Em còn thắc mắc gì?']];
const p = parseTlRows(rows);
ok(p.slides.length === 4 && p.slides[0].max === 2 && p.slides[1].opts.length === 3 && p.slides[2].items.join() === 'Hiểu bài,Hứng thú' && p.slides[3].type === 'qa', 'đọc Excel: đủ 4 loại, số ý mỗi em, lựa chọn, tiêu chí');
ok(p.errors.length === 2 && p.errors[0].includes('Dòng 4') && p.errors[1].includes('Dòng 6'), 'Excel: báo đúng dòng lỗi');
ok(parseTlRows([['a', 'b']]).fatal, 'Excel sai mẫu → báo rõ');

const sOpen = cleanSlide({ type: 'open', text: 'Ý kiến?' });
const sumO = summarize(sOpen, list, { ok: { 'hs01~1': true, 'hs02~0': true }, an: {} });
ok(sumO.open.length === 2 && sumO.people === 2, 'tổng hợp câu mở: chỉ ý đã duyệt');
const sPoll = cleanSlide({ type: 'poll', text: 'Chọn', opts: ['A', 'B'] });
const sumP = summarize(sPoll, entriesOf({ a: { 0: { v: '1', t: 1 } }, b: { 0: { v: '1', t: 2 } }, c: { 0: { v: '0', t: 3 } } }), {});
ok(sumP.counts.join() === '1,2' && localNotes([sPoll], [sumP])[0].includes('"B" 67%'), 'nhận xét tính sẵn khi AI lỗi');
console.log('TL CORE OK ' + n);
