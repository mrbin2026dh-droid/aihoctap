// Kiểm apps-script/sheet-exam/Code.gs trên giả lập Google Sheet: khối, tạo bài thi (thử/thật), khóa theo lớp, phòng chờ, trạng thái Chưa vào/Đã vào/Đã nộp.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/sheet-exam/Code.gs'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function env() {
  const sheets = {}, cacheMap = {}, props = {}, fbdb = {}, fbCalls = [];
  const mk = name => { const sh = { name, rows: [], appendRow(r) { this.rows.push([...r]); }, clear() { this.rows.length = 0; }, setFrozenRows() {}, getLastRow() { return this.rows.length; },
    getDataRange() { const rows = this.rows; return { getValues: () => rows.map(r => [...r]) }; },
    getRange(r, c) { if (typeof r === 'string') return { setNumberFormat() {} }; const rows = this.rows; return { getValue: () => (rows[r - 1] || [])[c - 1] ?? '', setValue: v => { (rows[r - 1] ||= [])[c - 1] = v; }, setValues: vs => vs.forEach((row, i) => row.forEach((v, j) => { (rows[r - 1 + i] ||= [])[c - 1 + j] = v; })) }; } };
    sheets[name] = sh; return sh; };
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => mk(n) };
  const ctx = { SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({}) }, ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'j' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cacheMap[k] ?? null, put: (k, v) => { cacheMap[k] = v; }, remove: k => { delete cacheMap[k]; } }) }, Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (a, str) => [...require('crypto').createHash('sha256').update(str, 'utf8').digest()].map(b => b > 127 ? b - 256 : b) },
    UrlFetchApp: { fetch: (url, opt) => {
      const u = new URL(url); fbCalls.push({ method: opt.method, path: u.pathname, auth: u.searchParams.get('auth') });
      const parts = u.pathname.replace(/\.json$/, '').split('/').filter(Boolean);
      const getAt = () => parts.reduce((o, k) => (o == null ? undefined : o[k]), fbdb);
      const setAt = v => { if (!parts.length) { Object.keys(fbdb).forEach(k => delete fbdb[k]); Object.assign(fbdb, v); return; } let o = fbdb; parts.slice(0, -1).forEach(k => { o = o[k] ||= {}; }); if (v === undefined) delete o[parts.at(-1)]; else o[parts.at(-1)] = v; };
      const body = opt.payload ? JSON.parse(opt.payload) : undefined; let out = null;
      if (opt.method === 'get') out = getAt() ?? null;
      else if (opt.method === 'patch') { const cur = getAt() || {}; setAt({ ...cur, ...body }); out = body; }
      else if (opt.method === 'put') { setAt(body); out = body; }
      else if (opt.method === 'delete') setAt(undefined);
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(out) };
    } } };
  vm.createContext(ctx); vm.runInContext(src, ctx); return { ctx, sheets, props, fbdb, fbCalls };
}
const { ctx, sheets } = env();
const call = p => ctx.doPost({ postData: { contents: JSON.stringify(p) } });
const GV = 'pin-giao-vien-123';
const gv = p => call({ gv: GV, ...p });
ok(call({ action: 'login', ma: 'x', pin: '1' }).error.includes('Tạo mẫu'), 'chưa có trang → báo dùng menu Tạo mẫu');
ctx.taoMau();
ok(sheets.DeThi.rows[0][1] === 'Khối' && sheets.DeThiThu && sheets.CauHinh && sheets.BaiThi && sheets.DiemDanh, 'Tạo mẫu: DeThi cột Khối, có DeThiThu, CauHinh, BaiThi, DiemDanh');
sheets.HocSinh.appendRow([3, 'Lê Chi', '9B', 'HS9B01', 12345, '']);
sheets.HocSinh.appendRow([4, 'Phạm Dũng', '8A', 'hs8a01', '111111', '']);
sheets.DeThi.appendRow([3, '9A', 'Câu ghi khối kiểu 9A vẫn là khối 9?', 'Đúng', 'Sai', '', '', 'a', 2]);
sheets.DeThi.appendRow([4, 8, 'Câu khối 8?', 'X', 'Y', 'Z', '', 'C', 10]);
const AN = { ma: 'hs9a01', pin: '123456' }, CHI = { ma: 'hs9b01', pin: '12345' }, DUNG = { ma: 'hs8a01', pin: '111111' };
ok(call({ action: 'login', ma: 'hs9a01', pin: '000000' }).error === 'Mã PIN chưa đúng.', 'sai PIN');
ok(call({ action: 'login', ma: ' HS9A01 ', pin: '123456' }).ok, 'đăng nhập học: mã không phân biệt hoa thường');
ok(call({ action: 'exams', ...AN }).exams.length === 0, 'chưa có bài thi → danh sách rỗng');
ok(call({ action: 'exam', ...AN, ma_de: 'x' }).error.includes('Không tìm thấy bài thi'), 'vào bài không tồn tại → báo');
ok(call({ action: 'gv_list' }).error.includes('đăng nhập lại'), 'không gửi PIN giáo viên → từ chối');
const i0 = gv({ action: 'gv_list' });
ok(i0.ok && i0.exams.length === 0 && i0.bank[9] === 3 && i0.bank[8] === 1, 'gv_list: ngân hàng đề thật theo khối (khối 9: 3 câu, khối 8: 1 câu)');
ok(sheets.CauHinh.rows.find(r => r[0] === 'mat_khau_gv')[1] === GV, 'lần đầu ghi nhớ PIN giáo viên');
ok(call({ action: 'gv_list', gv: 'khac' }).error.includes('chưa khớp'), 'PIN giáo viên khác → từ chối');
ok(gv({ action: 'gv_create', tieu_de: 'Giữa kỳ', che_do: 'that', khoi: 7, lop: '' }).error.includes('khối 7'), 'thi thật khối chưa có câu → báo rõ');
const c1 = gv({ action: 'gv_create', tieu_de: 'Giữa kỳ 9A', che_do: 'that', khoi: 9, lop: '9A' });
const E1 = c1.exams[0];
ok(c1.ok && c1.exams.length === 1 && E1.tieu_de === 'Giữa kỳ 9A' && E1.trang_thai === 'khoa' && E1.questions === 3 && E1.total === 2, 'tạo thi thật lớp 9A: mặc định khóa, 3 câu, 2 học sinh thuộc bài');
let st = gv({ action: 'gv_stats', ma_de: E1.ma_de });
ok(st.students.length === 2 && st.students.every(x => x.lop === '9A' && x.state === 'chua'), 'thống kê: chỉ lớp 9A thuộc bài, trạng thái ban đầu Chưa vào');
ok(call({ action: 'exams', ...AN }).exams.length === 1 && call({ action: 'exams', ...AN }).exams[0].trang_thai === 'khoa', 'thi thật đang khóa vẫn hiện cho học sinh 9A (vào phòng chờ)');
ok(call({ action: 'exams', ...CHI }).exams.length === 0, 'lớp 9B không thấy bài của 9A');
const w = call({ action: 'exam', ...AN, ma_de: E1.ma_de });
ok(w.ok && w.waiting && w.questions.length === 0 && w.title === 'Giữa kỳ 9A', 'đang khóa: học sinh vào phòng chờ, chưa thấy câu hỏi');
ok(gv({ action: 'gv_stats', ma_de: E1.ma_de }).students.find(x => x.ma === 'hs9a01').state === 'vao' && sheets.DiemDanh.rows.length === 2, 'giáo viên thấy em đã vào (điểm danh)');
call({ action: 'exam', ...AN, ma_de: E1.ma_de });
ok(sheets.DiemDanh.rows.length === 2, 'vào lại không thêm dòng điểm danh');
ok(call({ action: 'exam', ...CHI, ma_de: E1.ma_de }).error.includes('chỉ dành cho lớp 9A'), 'lớp 9B không vào được bài của 9A');
gv({ action: 'gv_set', ma_de: E1.ma_de, trang_thai: 'mo' });
const ex = call({ action: 'exam', ...AN, ma_de: E1.ma_de });
ok(ex.ok && !ex.waiting && ex.questions.length === 3 && !JSON.stringify(ex).includes('"answer"'), 'mở thi: nhận 3 câu khối 9, không lộ đáp án');
ok(ex.questions.every(q => !q.text.includes('khối 8')), 'không nhận câu khối 8');
const ids = ex.questions.map(q => q.id);
const sub = call({ action: 'submit', ...AN, ma_de: E1.ma_de, answers: { [ids[0]]: 'A', [ids[1]]: 'C', [ids[2]]: 'a' } });
ok(sub.ok && sub.score === 7 && sub.total === 12, 'chấm thi thật 7/12');
ok(call({ action: 'submit', ...AN, ma_de: E1.ma_de, answers: {} }).error === 'Em đã nộp bài rồi.', 'thi thật: nộp lần 2 bị chặn');
ok(call({ action: 'exam', ...AN, ma_de: E1.ma_de }).student.done === true, 'vào lại sau khi nộp → báo đã nộp');
const l1 = call({ action: 'exams', ...AN }).exams[0];
ok(l1.done && l1.score === 7, 'danh sách của học sinh: đã nộp + điểm');
st = gv({ action: 'gv_stats', ma_de: E1.ma_de });
ok(st.students.find(x => x.ma === 'hs9a01').state === 'nop' && st.students.find(x => x.ma === 'hs9a01').score === 7, 'giáo viên thấy Đã nộp + điểm');
ok(sheets.KetQua.rows[1][8] === 'Thi thật' && sheets.KetQua.rows[1][9] === E1.ma_de, 'KetQua ghi hình thức + mã bài thi');
ok(gv({ action: 'gv_reset', ma_de: E1.ma_de, ma: 'HS9B01' }).error.includes('chưa nộp'), 'cho thi lại em chưa nộp → báo');
const rs = gv({ action: 'gv_reset', ma_de: E1.ma_de, ma: 'HS9A01' });
ok(rs.ok && rs.students.find(x => x.ma === 'hs9a01').state === 'vao' && call({ action: 'submit', ...AN, ma_de: E1.ma_de, answers: {} }).ok, 'cho thi lại → làm lại được');
gv({ action: 'gv_set', ma_de: E1.ma_de, trang_thai: 'khoa' });
ok(call({ action: 'submit', ...AN, ma_de: E1.ma_de, answers: {} }).error.includes('khóa'), 'khóa thi → không nộp được');
ok(gv({ action: 'gv_create', tieu_de: 'Ôn tập', che_do: 'thu', khoi: 8, lop: '' }).error.includes('Excel'), 'thi thử chưa tải đề → báo');
const q8 = [{ text: 'Q1?', options: { A: 'a', B: 'b' }, answer: 'b', points: 4 }, { text: 'Q2?', options: { A: 'a', B: 'b' }, answer: 'A', points: 6 }];
const c2 = gv({ action: 'gv_create', tieu_de: 'Ôn tập 8', che_do: 'thu', khoi: 8, lop: '', questions: q8 });
const E2 = c2.exams.find(e => e.che_do === 'thu');
ok(c2.exams.length === 2 && E2.questions === 2 && E2.total === 1 && sheets.DeThiThu.rows.length === 3 && sheets.DeThiThu.rows[1][9] === E2.ma_de, 'thi thử: ghi đề vào DeThiThu kèm Mã bài thi; hai bài cùng tồn tại');
ok(call({ action: 'exams', ...DUNG }).exams.length === 0, 'thi thử đang khóa → ẩn khỏi học sinh');
ok(call({ action: 'exam', ...DUNG, ma_de: E2.ma_de }).error.includes('khóa'), 'thi thử khóa → không vào được');
gv({ action: 'gv_set', ma_de: E2.ma_de, trang_thai: 'mo' });
ok(call({ action: 'exams', ...DUNG }).exams.length === 1 && call({ action: 'exams', ...AN }).exams.length === 1, 'mở thi thử khối 8: em khối 8 thấy 1 bài, em 9A vẫn chỉ thấy bài của mình');
const e8 = call({ action: 'exam', ...DUNG, ma_de: E2.ma_de });
ok(e8.mode === 'thu' && e8.questions.length === 2 && e8.questions[0].text === 'Q1?', 'học sinh khối 8 nhận đề thi thử, không nhận đề thật');
const t1 = call({ action: 'submit', ...DUNG, ma_de: E2.ma_de, answers: { [e8.questions[0].id]: 'B' } });
const t2 = call({ action: 'submit', ...DUNG, ma_de: E2.ma_de, answers: {} });
ok(t1.ok && t1.score === 4 && t2.ok, 'thi thử: làm nhiều lần');
const up = gv({ action: 'gv_update', ma_de: E2.ma_de, tieu_de: 'Ôn tập 8 (mới)', khoi: 8, lop: '8A', questions: [q8[0]] });
const U2 = up.exams.find(e => e.ma_de === E2.ma_de);
ok(U2.tieu_de === 'Ôn tập 8 (mới)' && U2.lop === '8A' && U2.questions === 1 && sheets.DeThiThu.rows.length === 2, 'chỉnh sửa thi thử: đổi tiêu đề/lớp và thay đề');
ok(gv({ action: 'gv_update', ma_de: E1.ma_de, tieu_de: ' ' }).error.includes('tiêu đề'), 'sửa bỏ trống tiêu đề → báo');
const nKq = sheets.KetQua.rows.length;
const del = gv({ action: 'gv_delete', ma_de: E2.ma_de });
ok(del.exams.length === 1 && sheets.KetQua.rows.length === nKq && call({ action: 'exams', ...DUNG }).exams.length === 0, 'xóa bài thi: ẩn khỏi giáo viên và học sinh, KetQua còn nguyên');
ok(call({ action: 'exam', ...DUNG, ma_de: E2.ma_de }).error.includes('Không tìm thấy bài thi'), 'bài đã xóa không vào được');
// bản cũ có 1 bài trong CauHinh → tự chuyển sang BaiThi
const { ctx: c4, sheets: s4 } = env(); c4.taoMau();
['ma_de', 'tieu_de', 'che_do', 'khoi', 'lop', 'trang_thai', 'bat_dau'].forEach((k, i) => { const v = ['111', 'Cũ', 'thu', '9', '', 'mo', '2026-01-01'][i]; s4.CauHinh.appendRow([k, v]); });
s4.DeThiThu.appendRow([1, 9, 'Câu cũ?', 'a', 'b', '', '', 'A', 1]);
const mg = c4.doPost({ postData: { contents: JSON.stringify({ gv: GV, action: 'gv_list' }) } });
ok(mg.exams.length === 1 && mg.exams[0].ma_de === '111' && mg.exams[0].questions === 1 && mg.exams[0].trang_thai === 'mo', 'chuyển bài thi cũ trong CauHinh sang BaiThi, đề cũ gắn Mã bài thi');
// ---------- Firebase: đẩy đề lên, học sinh nộp trên Firebase, lấy điểm về Sheet ----------
{ const E = env(); const c = p => E.ctx.doPost({ postData: { contents: JSON.stringify({ gv: GV, ...p }) } }); E.ctx.taoMau();
  const r0 = c({ action: 'gv_create', tieu_de: 'TT', che_do: 'that', khoi: 9, lop: '9A' });
  ok(r0.ok && r0.fb === false && E.fbCalls.length === 0, 'chưa cài khóa Firebase → vẫn chạy bằng Sheet, không gọi Firebase');
  E.props.FB_SECRET = 'bi-mat';
  const pub = c({ action: 'gv_publish' });
  ok(pub.ok && pub.published === 1 && E.fbCalls[0].method === 'patch' && E.fbCalls[0].auth === 'bi-mat', 'Cập nhật lên Firebase: một lần gọi, dùng khóa bí mật');
  const hs = E.fbdb.thi_hs.hs9a01, hash = require('crypto').createHash('sha256').update('hs9a01:123456').digest('hex');
  ok(hs.ten === 'Nguyễn Văn An' && hs.lop === '9A' && hs.khoi === 9 && hs.h === hash && !JSON.stringify(E.fbdb.thi_hs).includes('123456'), 'thi_hs: tên, lớp, khối, PIN đã băm (không lộ PIN gốc)');
  const id = r0.exams[0].ma_de, bai = E.fbdb.thi_bai[id];
  ok(bai.tieu_de === 'TT' && bai.trang_thai === 'khoa' && bai.so_cau === 2 && E.fbdb.thi_de[id].length === 2 && E.fbdb.thi_de[id][0].answer === 'A', 'thi_bai + thi_de (kèm đáp án để máy học sinh tự chấm)');
  c({ action: 'gv_set', ma_de: id, trang_thai: 'mo' });
  ok(E.fbdb.thi_bai[id].trang_thai === 'mo', 'Mở thi → Firebase đổi ngay');
  E.fbdb.thi_nop = { [id]: { hs9a01: { ma: 'hs9a01', ten: 'Nguyễn Văn An', lop: '9A', diem: 5, tong: 10, dung: 1, so_cau: 2, tra_loi: { r2: 'A' }, at: 1761550000000 } } };
  c({ action: 'gv_list' }); c({ action: 'gv_list' });
  const rows = E.sheets.KetQua.rows.filter(r => r[9] === id);
  ok(rows.length === 1 && rows[0][4] === 5 && rows[0][8] === 'Thi thật' && rows[0][11].startsWith(id + '|hs9a01|'), 'mở danh sách → điểm trên Firebase chép về KetQua, không chép trùng');
  const rs = c({ action: 'gv_reset', ma_de: id, ma: 'HS9A01' });
  ok(rs.ok && !E.fbdb.thi_nop[id].hs9a01 && E.sheets.KetQua.rows.find(r => r[9] === id)[10] === 'Hủy', 'cho thi lại → xóa bài nộp trên Firebase + đánh dấu Hủy');
  c({ action: 'gv_delete', ma_de: id });
  ok(!E.fbdb.thi_bai[id] && !E.fbdb.thi_de[id], 'xóa bài → gỡ khỏi Firebase');
}
for (let i = 0; i < 10; i++) call({ action: 'gv_list', gv: 'x' });
ok(gv({ action: 'gv_list' }).error.includes('quá nhiều'), 'dò PIN giáo viên → khóa 10 phút');
const { ctx: c3 } = env(); c3.taoMau();
const call3 = p => c3.doPost({ postData: { contents: JSON.stringify(p) } });
call3({ action: 'gv_list', gv: GV }); c3.datLaiMatKhau();
ok(call3({ action: 'gv_list', gv: 'pin-moi' }).ok, 'Đặt lại mật khẩu giáo viên → PIN mới được ghi nhớ');
console.log(fail ? `SHEET EXAM GS: ${fail} lỗi` : 'SHEET EXAM GS OK'); process.exit(fail ? 1 : 0);
