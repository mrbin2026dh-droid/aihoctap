// Kiểm apps-script/sheet-exam/Code.gs trên giả lập Google Sheet: khối, tạo bài thi (thử/thật), khóa theo lớp, phòng chờ, trạng thái Chưa vào/Đã vào/Đã nộp.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/sheet-exam/Code.gs'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function env() {
  const sheets = {}, cacheMap = {};
  const mk = name => { const sh = { name, rows: [], appendRow(r) { this.rows.push([...r]); }, clear() { this.rows.length = 0; }, setFrozenRows() {}, getLastRow() { return this.rows.length; },
    getDataRange() { const rows = this.rows; return { getValues: () => rows.map(r => [...r]) }; },
    getRange(r, c) { if (typeof r === 'string') return { setNumberFormat() {} }; const rows = this.rows; return { getValue: () => (rows[r - 1] || [])[c - 1] ?? '', setValue: v => { (rows[r - 1] ||= [])[c - 1] = v; } }; } };
    sheets[name] = sh; return sh; };
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => mk(n) };
  const ctx = { SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({}) }, ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'j' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cacheMap[k] ?? null, put: (k, v) => { cacheMap[k] = v; }, remove: k => { delete cacheMap[k]; } }) }, Date };
  vm.createContext(ctx); vm.runInContext(src, ctx); return { ctx, sheets };
}
const { ctx, sheets } = env();
const call = p => ctx.doPost({ postData: { contents: JSON.stringify(p) } });
const GV = 'pin-giao-vien-123';
const gv = p => call({ gv: GV, ...p });
ok(call({ action: 'login', ma: 'x', pin: '1' }).error.includes('Tạo mẫu'), 'chưa có trang → báo dùng menu Tạo mẫu');
ctx.taoMau();
ok(sheets.DeThi.rows[0][1] === 'Khối' && sheets.DeThiThu && sheets.CauHinh, 'Tạo mẫu: DeThi cột Khối, có DeThiThu, CauHinh');
sheets.HocSinh.appendRow([3, 'Lê Chi', '9B', 'HS9B01', 12345, '']);
sheets.HocSinh.appendRow([4, 'Phạm Dũng', '8A', 'hs8a01', '111111', '']);
sheets.DeThi.appendRow([3, '9A', 'Câu ghi khối kiểu 9A vẫn là khối 9?', 'Đúng', 'Sai', '', '', 'a', 2]);
sheets.DeThi.appendRow([4, 8, 'Câu khối 8?', 'X', 'Y', 'Z', '', 'C', 10]);
// đăng nhập học (Worker gọi action login) không phụ thuộc bài thi
ok(call({ action: 'login', ma: 'hs9a01', pin: '000000' }).error === 'Mã PIN chưa đúng.', 'sai PIN');
ok(call({ action: 'login', ma: ' HS9A01 ', pin: '123456' }).ok, 'đăng nhập học: mã không phân biệt hoa thường');
ok(call({ action: 'exam', ma: 'hs9a01', pin: '123456' }).error.includes('Chưa có bài thi'), 'chưa tạo bài thi → báo chờ');
// giáo viên: mật khẩu = PIN giáo viên, lần đầu ghi nhớ
ok(call({ action: 'gv_info' }).error.includes('đăng nhập lại'), 'không gửi PIN giáo viên → từ chối');
const i0 = gv({ action: 'gv_info' });
ok(i0.ok && i0.exam === null && i0.bank[9] === 3 && i0.bank[8] === 1, 'gv_info: ngân hàng đề thật theo khối (khối 9: 3 câu, khối 8: 1 câu)');
ok(sheets.CauHinh.rows.find(r => r[0] === 'mat_khau_gv')[1] === GV, 'lần đầu ghi nhớ PIN giáo viên');
ok(call({ action: 'gv_info', gv: 'khac' }).error.includes('chưa khớp'), 'PIN giáo viên khác → từ chối');
// tạo thi thật lớp 9A
ok(gv({ action: 'gv_create', tieu_de: 'Giữa kỳ', che_do: 'that', khoi: 7, lop: '' }).error.includes('khối 7'), 'thi thật khối chưa có câu → báo rõ');
const c1 = gv({ action: 'gv_create', tieu_de: 'Giữa kỳ 9A', che_do: 'that', khoi: 9, lop: '9A' });
ok(c1.ok && c1.exam.tieu_de === 'Giữa kỳ 9A' && c1.exam.trang_thai === 'khoa' && c1.exam.questions === 3, 'tạo thi thật lớp 9A: mặc định khóa, 3 câu khối 9');
const an0 = c1.students.find(s => s.ma === 'hs9a01');
ok(an0.in_scope && an0.state === 'chua' && !c1.students.find(s => s.ma === 'HS9B01').in_scope, 'chỉ lớp 9A thuộc bài thi; trạng thái ban đầu Chưa vào');
// phòng chờ: khóa nhưng vẫn ghi nhận có mặt
const w = call({ action: 'exam', ma: 'hs9a01', pin: '123456' });
ok(w.ok && w.waiting && w.questions.length === 0 && w.title === 'Giữa kỳ 9A', 'đang khóa: học sinh vào phòng chờ, chưa thấy câu hỏi');
ok(gv({ action: 'gv_info' }).students.find(s => s.ma === 'hs9a01').state === 'vao', 'giáo viên thấy em đã vào (điểm danh)');
ok(call({ action: 'exam', ma: 'hs9b01', pin: '12345' }).error.includes('chỉ dành cho lớp 9A'), 'lớp 9B không vào được bài của 9A');
gv({ action: 'gv_set', trang_thai: 'mo' });
const ex = call({ action: 'exam', ma: 'hs9a01', pin: '123456' });
ok(ex.ok && !ex.waiting && ex.questions.length === 3 && !JSON.stringify(ex).includes('"answer"'), 'mở thi: nhận 3 câu khối 9, không lộ đáp án');
ok(ex.questions.every(q => !q.text.includes('khối 8')), 'không nhận câu khối 8');
const ids = ex.questions.map(q => q.id);
const sub = call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: { [ids[0]]: 'A', [ids[1]]: 'C', [ids[2]]: 'a' } });
ok(sub.ok && sub.score === 7 && sub.total === 12, 'chấm thi thật 7/12');
ok(call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).error === 'Em đã nộp bài rồi.', 'thi thật: nộp lần 2 bị chặn');
ok(call({ action: 'exam', ma: 'hs9a01', pin: '123456' }).student.done === true, 'vào lại sau khi nộp → báo đã nộp');
const i1 = gv({ action: 'gv_info' }).students.find(s => s.ma === 'hs9a01');
ok(i1.state === 'nop' && i1.score === 7, 'giáo viên thấy Đã nộp + điểm');
ok(sheets.KetQua.rows[1][8] === 'Thi thật' && sheets.KetQua.rows[1][9] === c1.exam.ma_de, 'KetQua ghi hình thức + mã bài thi');
gv({ action: 'gv_reset', ma: 'HS9A01' });
ok(gv({ action: 'gv_info' }).students.find(s => s.ma === 'hs9a01').state !== 'nop' && call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).ok, 'cho thi lại → làm lại được');
gv({ action: 'gv_set', trang_thai: 'khoa' });
ok(call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).error.includes('khóa'), 'khóa thi → không nộp được');
// tạo thi thử khối 8 từ Excel: làm nhiều lần, bài mới → trạng thái tính lại từ đầu
ok(gv({ action: 'gv_create', tieu_de: 'Ôn tập', che_do: 'thu', khoi: 8, lop: '' }).error.includes('Excel'), 'thi thử chưa tải đề → báo');
const c2 = gv({ action: 'gv_create', tieu_de: 'Ôn tập 8', che_do: 'thu', khoi: 8, lop: '', questions: [{ text: 'Q1?', options: { A: 'a', B: 'b' }, answer: 'b', points: 4 }, { text: 'Q2?', options: { A: 'a', B: 'b' }, answer: 'A', points: 6 }] });
ok(c2.ok && c2.exam.che_do === 'thu' && c2.exam.questions === 2 && sheets.DeThiThu.rows.length === 3, 'thi thử: ghi đề vào trang DeThiThu');
ok(c2.students.find(s => s.ma === 'hs8a01').in_scope && !c2.students.find(s => s.ma === 'hs9a01').in_scope, 'cả khối 8 thuộc bài thi, khối 9 không');
gv({ action: 'gv_set', trang_thai: 'mo' });
const e8 = call({ action: 'exam', ma: 'hs8a01', pin: '111111' });
ok(e8.mode === 'thu' && e8.questions.length === 2 && e8.questions[0].text === 'Q1?', 'học sinh khối 8 nhận đề thi thử, không nhận đề thật');
const t1 = call({ action: 'submit', ma: 'hs8a01', pin: '111111', answers: { [e8.questions[0].id]: 'B' } });
const t2 = call({ action: 'submit', ma: 'hs8a01', pin: '111111', answers: {} });
ok(t1.ok && t1.score === 4 && t2.ok && sheets.HocSinh.rows[4][5] !== 'Đã thi', 'thi thử: làm nhiều lần, không đánh dấu "Đã thi"');
ok(gv({ action: 'gv_info' }).students.find(s => s.ma === 'hs9a01').state === 'chua', 'bài thi mới: trạng thái cũ không bị tính');
for (let i = 0; i < 10; i++) call({ action: 'gv_info', gv: 'x' });
ok(gv({ action: 'gv_info' }).error.includes('quá nhiều'), 'dò PIN giáo viên → khóa 10 phút');
const { ctx: c3 } = env(); c3.taoMau();
const call3 = p => c3.doPost({ postData: { contents: JSON.stringify(p) } });
call3({ action: 'gv_info', gv: GV }); c3.datLaiMatKhau();
ok(call3({ action: 'gv_info', gv: 'pin-moi' }).ok, 'Đặt lại mật khẩu giáo viên → PIN mới được ghi nhớ');
console.log(fail ? `SHEET EXAM GS: ${fail} lỗi` : 'SHEET EXAM GS OK'); process.exit(fail ? 1 : 0);
