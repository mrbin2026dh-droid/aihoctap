// Kiểm apps-script/sheet-exam/Code.gs trên giả lập Google Sheet: đăng nhập, lấy đề theo lớp (không lộ đáp án), nộp, chấm, ghi KetQua, khóa nộp lần 2.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/sheet-exam/Code.gs'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function env() {
  const sheets = {};
  const mk = name => { const sh = { name, rows: [], appendRow(r) { this.rows.push([...r]); }, getDataRange() { const rows = this.rows; return { getValues: () => rows.map(r => [...r]) }; },
    getRange(r, c) { if (typeof r === 'string') return { setNumberFormat() {} }; const rows = this.rows; return { getValue: () => (rows[r - 1] || [])[c - 1] ?? '', setValue: v => { (rows[r - 1] ||= [])[c - 1] = v; } }; }, setFrozenRows() {} }; sheets[name] = sh; return sh; };
  const cacheMap = {}; const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => mk(n) };
  const ctx = { SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({}) }, ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'j' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, CacheService: { getScriptCache: () => { const m = cacheMap; return { get: k => m[k] ?? null, put: (k, v) => { m[k] = v; }, remove: k => { delete m[k]; } }; } }, Date };
  vm.createContext(ctx); vm.runInContext(src, ctx); return { ctx, sheets };
}
const { ctx, sheets } = env();
const call = p => ctx.doPost({ postData: { contents: JSON.stringify(p) } });
ok(call({ action: 'login', ma: 'x', pin: '1' }).error.includes('Tạo mẫu'), 'chưa có trang → báo dùng menu Tạo mẫu');
ctx.taoMau();
const setCfg = (k, v) => { const r = sheets.CauHinh.rows.find(x => x[0] === k); r[1] = v; };
ok(call({ action: 'exam', ma: 'hs9a01', pin: '123456' }).error.includes('đang khóa'), 'mặc định thi đang KHÓA → học sinh chưa vào thi được');
ok(call({ action: 'login', ma: 'hs9a01', pin: '123456' }).ok, 'khóa thi không chặn đăng nhập vào học');
setCfg('trang_thai', 'mo'); setCfg('che_do', 'that');
sheets.HocSinh.appendRow([3, 'Lê Chi', '8B', 'HS8B01', 12345, '']);           // PIN dạng số, mã viết hoa
sheets.DeThi.appendRow([3, '', 'Câu chung mọi lớp?', 'Đúng', 'Sai', '', '', 'a', 2]);
sheets.DeThi.appendRow([4, '8B', 'Câu riêng 8B?', 'X', 'Y', 'Z', '', 'C', 10]);
ok(call({ action: 'login', ma: 'hs9a01', pin: '000000' }).error === 'Mã PIN chưa đúng.', 'sai PIN → "Mã PIN chưa đúng."');
ok(call({ action: 'login', ma: 'khongco', pin: '1' }).error.includes('Không tìm thấy'), 'mã không có → báo không tìm thấy');
const lg = call({ action: 'login', ma: ' HS9A01 ', pin: '123456' });
ok(lg.ok && lg.student.name === 'Nguyễn Văn An' && lg.student.lop === '9A' && !lg.student.done, 'đăng nhập đúng (mã không phân biệt hoa thường, bỏ khoảng trắng)');
const ex = call({ action: 'exam', ma: 'hs9a01', pin: '123456' });
ok(ex.ok && ex.questions.length === 3, 'lớp 9A nhận 2 câu 9A + 1 câu chung (không nhận câu 8B)');
ok(!JSON.stringify(ex).includes('"answer"'), 'đề gửi về app không kèm đáp án đúng');
const ids = ex.questions.map(q => q.id);
const sub = call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: { [ids[0]]: 'A', [ids[1]]: 'C', [ids[2]]: 'a' } });
ok(sub.ok && sub.score === 7 && sub.total === 12 && sub.correct === 2 && sub.count === 3, 'chấm: câu1 đúng 5 + câu chung đúng 2 (đáp án chữ thường vẫn đúng) = 7/12');
ok(sheets.HocSinh.rows[1][5] === 'Đã thi', 'cột Trạng thái → "Đã thi"');
ok(sheets.KetQua && sheets.KetQua.rows.length === 2 && sheets.KetQua.rows[1][1] === 'hs9a01' && sheets.KetQua.rows[1][4] === 7, 'trang KetQua có dòng kết quả');
ok(call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).error === 'Em đã nộp bài rồi.', 'nộp lần 2 → chặn');
ok(call({ action: 'exam', ma: 'hs9a01', pin: '123456' }).student.done === true, 'lấy đề sau khi nộp → app biết đã thi');
ok(call({ action: 'login', ma: 'hs8b01', pin: '12345' }).ok, 'PIN lưu dạng số trong Sheet vẫn đăng nhập được');
const ex8 = call({ action: 'exam', ma: 'hs8b01', pin: '12345' });
ok(ex8.questions.length === 2 && ex8.questions[1].options.C === 'Z', 'lớp 8B nhận câu chung + câu 8B');
sheets.HocSinh.rows[1][5] = ''; ok(call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).ok, 'giáo viên xóa "Đã thi" → em được làm lại');
// --- Thi thử / thi thật, mở / khóa, giáo viên ---
const GV = sheets.CauHinh.rows.find(x => x[0] === 'mat_khau_gv')[1];
ok(/^\d{6}$/.test(GV), 'Tạo mẫu sinh mật khẩu giáo viên ngẫu nhiên 6 số');
ok(call({ action: 'gv_info', gv: 'sai' }).error.includes('chưa đúng'), 'sai mật khẩu giáo viên → từ chối');
const info = call({ action: 'gv_info', gv: GV });
ok(info.ok && info.che_do === 'that' && info.trang_thai === 'mo' && info.questions === 4 && info.students.length === 3, 'giáo viên xem: chế độ, đề, danh sách học sinh');
const an = info.students.find(x => x.ma === 'hs9a01');
ok(an.last !== '' && typeof an.last === 'string', 'ghi lại lần vào thi gần nhất');
sheets.HocSinh.rows[1][5] = 'Đã thi';
ok(call({ action: 'gv_reset', gv: GV, ma: 'hs9a01' }).students.find(x => x.ma === 'hs9a01').status === 'Chưa thi', 'giáo viên cho thi lại một em');
call({ action: 'gv_set', gv: GV, che_do: 'thu' });
const t1 = call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: { r2: 'A' } });
const t2 = call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: { r2: 'A' } });
ok(t1.ok && t2.ok && t1.mode === 'thu' && sheets.HocSinh.rows[1][5] !== 'Đã thi', 'thi thử: làm nhiều lần, không đánh dấu "Đã thi"');
ok(sheets.KetQua.rows[sheets.KetQua.rows.length - 1][8] === 'Thi thử', 'KetQua ghi hình thức "Thi thử"');
call({ action: 'gv_set', gv: GV, trang_thai: 'khoa' });
ok(call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).error.includes('khóa'), 'khóa thi → không nộp được');
ok(call({ action: 'exam', ma: 'hs9a01', pin: '123456' }).error.includes('khóa'), 'khóa thi → không lấy đề được');
call({ action: 'gv_set', gv: GV, trang_thai: 'mo', che_do: 'that' });
ok(call({ action: 'submit', ma: 'hs9a01', pin: '123456', answers: {} }).ok, 'mở lại thi thật → nộp được');
for (let i = 0; i < 10; i++) call({ action: 'gv_info', gv: 'x' });
ok(call({ action: 'gv_info', gv: GV }).error.includes('quá nhiều'), 'dò mật khẩu giáo viên → khóa 10 phút');
const { ctx: c2, sheets: s2 } = env(); c2.taoMau(); s2.CauHinh.rows.find(x => x[0] === 'trang_thai')[1] = 'mo'; s2.DeThi.rows.length = 1;
ok(c2.doPost({ postData: { contents: JSON.stringify({ action: 'exam', ma: 'hs9a01', pin: '123456' }) } }).error.includes('Chưa có đề cho lớp 9A'), 'chưa có câu cho lớp → báo rõ');
console.log(fail ? `SHEET EXAM GS: ${fail} lỗi` : 'SHEET EXAM GS OK'); process.exit(fail ? 1 : 0);
