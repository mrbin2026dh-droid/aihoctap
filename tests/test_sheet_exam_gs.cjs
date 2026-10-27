// Kiểm apps-script/sheet-exam/Code.gs trên giả lập Google Sheet: khối, tạo bài thi (thử/thật), khóa theo lớp, phòng chờ, trạng thái Chưa vào/Đã vào/Đã nộp.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/sheet-exam/Code.gs'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const LOCK = { held: false };
function env() {
  const sheets = {}, cacheMap = {}, props = {}, fbdb = {}, fbCalls = [], drive = [];
  const mk = name => { const sh = { name, rows: [], appendRow(r) { this.rows.push([...r]); }, deleteRow(i) { this.rows.splice(i - 1, 1); }, clear() { this.rows.length = 0; }, setFrozenRows() {}, getLastRow() { return this.rows.length; },
    getDataRange() { const rows = this.rows; return { getValues: () => rows.map(r => [...r]) }; },
    getRange(r, c) { if (typeof r === 'string') return { setNumberFormat() {} }; const rows = this.rows; return { getValue: () => (rows[r - 1] || [])[c - 1] ?? '', setValue: v => { (rows[r - 1] ||= [])[c - 1] = v; }, setValues: vs => vs.forEach((row, i) => row.forEach((v, j) => { (rows[r - 1 + i] ||= [])[c - 1 + j] = v; })) }; } };
    sheets[name] = sh; return sh; };
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => mk(n) };
  const ctx = { SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({}) }, ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'j' } },
    LockService: { getScriptLock: () => ({ waitLock() { LOCK.held = true; }, tryLock() { LOCK.held = true; return true; }, hasLock() { return !!LOCK.held; }, releaseLock() { LOCK.held = false; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cacheMap[k] ?? null, put: (k, v) => { cacheMap[k] = v; }, remove: k => { delete cacheMap[k]; } }) }, Date,
    console, MimeType: { PLAIN_TEXT: 'text/plain' },
    DriveApp: (() => { const files = {}; const mkF = (name, path) => { const f = { name, path, folders: {}, files: [], getId: () => path, getFoldersByName: n => { const x = f.folders[n]; let used = false; return { hasNext: () => !!x && !used, next: () => { used = true; return x; } }; }, createFolder: n => (f.folders[n] = mkF(n, path + '/' + n)),
      getFilesByName: n => { const xs = f.files.filter(z => z.name === n && !z.trashed); let i = 0; return { hasNext: () => i < xs.length, next: () => xs[i++] }; },
      createFile: (a, b, c) => { const z = typeof a === 'string' ? { name: a, content: b, mime: c } : { name: a.name, content: a.bytes, mime: a.mime }; z.setTrashed = v => { z.trashed = v; }; z.getId = () => path + '/' + z.name; z.setSharing = (acc, perm) => { z.sharing = acc + ':' + perm; }; z.moveTo = d => { z.moved = d.path; }; files[z.getId()] = z; f.files.push(z); drive.push({ path: path + '/' + z.name, ...z }); return z; } }; return f; };
      const root = mkF('root', ''); return { Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' }, getRootFolder: () => root, getFolderById: () => { throw new Error('x'); }, getFileById: id => { if (!files[id]) throw new Error('no'); return files[id]; } }; })(),
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    Utilities: { base64Decode: b => [...Buffer.from(b, 'base64')], newBlob: (bytes, mime, name) => ({ bytes, mime, name }), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (a, str) => [...require('crypto').createHash('sha256').update(str, 'utf8').digest()].map(b => b > 127 ? b - 256 : b) },
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
  vm.createContext(ctx); vm.runInContext(src, ctx); return { ctx, sheets, props, fbdb, fbCalls, drive };
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
  ok(E.fbdb.thi_bai[id].xem_diem === false, 'thi thật: mặc định chưa cho xem điểm');
  const xd = c({ action: 'gv_set', ma_de: id, xem_diem: 'co' });
  ok(xd.exams[0].xem_diem === true && E.fbdb.thi_bai[id].xem_diem === true && E.fbdb.thi_bai[id].trang_thai === 'mo', 'bật Cho xem điểm → Firebase đổi ngay, vẫn giữ trạng thái mở');
  E.fbdb.thi_nop = { [id]: { hs9a01: { ma: 'hs9a01', ten: 'Nguyễn Văn An', lop: '9A', diem: 5, tong: 10, dung: 1, so_cau: 2, tra_loi: { r2: 'A' }, at: 1761550000000 } } };
  c({ action: 'gv_list' }); c({ action: 'gv_list' });
  const rows = E.sheets.KetQua.rows.filter(r => r[9] === id);
  ok(rows.length === 1 && rows[0][4] === 5 && rows[0][8] === 'Thi thật' && rows[0][11].startsWith(id + '|hs9a01|'), 'mở danh sách → điểm trên Firebase chép về KetQua, không chép trùng');
  const txt = E.drive.find(f => f.path.endsWith('hs9a01 - Nguyễn Văn An.txt'));
  ok(txt && txt.path.includes('/Bài thi - Góc học tập/') && txt.path.includes('/Lớp 9A/Khác - TT/') && txt.content.includes('Đáp án đúng: A · Em chọn: A · ĐÚNG') && txt.content.includes('Em chọn: (bỏ trống) · SAI') && txt.content.includes('ĐIỂM: 5/10'), 'thi thật: lưu file chữ bài làm lên Drive theo Năm học / Lớp / Hình thức - Tiêu đề');
  const rs = c({ action: 'gv_reset', ma_de: id, ma: 'HS9A01' });
  ok(rs.ok && !E.fbdb.thi_nop[id].hs9a01 && E.sheets.KetQua.rows.find(r => r[9] === id)[10] === 'Hủy', 'cho thi lại → xóa bài nộp trên Firebase + đánh dấu Hủy');
  c({ action: 'gv_delete', ma_de: id });
  const r2 = c({ action: 'gv_create', tieu_de: 'Cuối kỳ', che_do: 'that', khoi: 9, lop: '9A', nam_hoc: '2026-2027', hinh_thuc: 'Cuối kỳ I', noi_dung: 'tn_th' });
  const e2 = r2.exams.find(e => e.tieu_de === 'Cuối kỳ');
  ok(e2.nam_hoc === '2026-2027' && e2.hinh_thuc === 'Cuối kỳ I' && e2.noi_dung === 'tn_th' && E.fbdb.thi_bai[e2.ma_de].noi_dung === 'tn_th', 'thi thật: lưu năm học, hình thức, Trắc nghiệm + Thực hành');
  const call = p => E.ctx.doPost({ postData: { contents: JSON.stringify(p) } });
  ok(call({ action: 'nop_th', ma: 'hs9a01', pin: '123456', ma_de: e2.ma_de, ten_file: 'bai.docx', data: 'aGVsbG8=' }).error.includes('khóa'), 'nộp thực hành khi bài khóa → chặn');
  c({ action: 'gv_set', ma_de: e2.ma_de, trang_thai: 'mo' });
  const th = call({ action: 'nop_th', ma: 'hs9a01', pin: '123456', ma_de: e2.ma_de, ten_file: 'bai.docx', mime: 'application/msword', data: 'aGVsbG8=' });
  ok(th.ok && E.drive.some(f => f.path.endsWith('/Lớp 9A/Cuối kỳ I - Cuối kỳ/hs9a01 - Nguyễn Văn An - Thực hành - bai.docx')) && E.fbdb.thi_th[e2.ma_de].hs9a01.ten_file === 'bai.docx', 'nộp thực hành → file vào thư mục lớp trên Drive + báo Firebase');
  const qd = c({ action: 'gv_questions', ma_de: e2.ma_de });
  ok(qd.questions.length === 2 && qd.questions[0].answer === 'A', 'giáo viên lấy câu hỏi kèm đáp án để sửa');
  ok(c({ action: 'gv_update', ma_de: e2.ma_de, questions: [{ text: 'Q?', options: { A: 'x' }, answer: 'A', points: 1 }] }).error.includes('ít nhất 2 phương án'), 'sửa câu hỏi: kiểm phương án');
  c({ action: 'gv_update', ma_de: e2.ma_de, questions: [{ text: 'Câu mới?', options: { A: 'x', B: 'y' }, answer: 'B', points: 4 }] });
  ok(E.sheets.DeThi.rows.filter(r => String(r[1]) === '9').length === 1 && E.fbdb.thi_de[e2.ma_de][0].text === 'Câu mới?' && E.fbdb.thi_de[e2.ma_de][0].answer === 'B', 'lưu câu hỏi đã sửa → Sheet và Firebase');
  ok(!E.fbdb.thi_bai[id] && !E.fbdb.thi_de[id], 'xóa bài → gỡ khỏi Firebase');
  c({ action: 'gv_update', ma_de: e2.ma_de, questions: [{ text: 'Bit là gì?', options: { A: 'x', B: 'y' }, answer: 'A', points: 2, topic: 'Mã nhị phân', level: 'Hiểu' }, { text: 'Byte?', options: { A: 'x', B: 'y' }, answer: 'B', points: 2, topic: 'Mã nhị phân', level: 'Sai' }] });
  const dRow = E.sheets.DeThi.rows.find(r => r[2] === 'Bit là gì?');
  ok(dRow[9] === 'Mã nhị phân' && dRow[10] === 'Hiểu' && E.sheets.DeThi.rows.find(r => r[2] === 'Byte?')[10] === '' && E.fbdb.thi_de[e2.ma_de][0].topic === 'Mã nhị phân' && c({ action: 'gv_questions', ma_de: e2.ma_de }).questions[0].level === 'Hiểu', 'câu hỏi có Chủ đề + Mức độ (Biết/Hiểu/Vận dụng): lưu Sheet, đẩy chủ đề lên Firebase');
  const tt = c({ action: 'gv_create', tieu_de: 'TT chủ đề', che_do: 'thu', khoi: 9, lop: '9A', questions: [{ text: 'Q1', options: { A: 'a', B: 'b' }, answer: 'A', points: 1, topic: 'Dữ liệu số', level: 'Biết' }] });
  const ttId = tt.exams.find(e => e.tieu_de === 'TT chủ đề').ma_de;
  ok(E.sheets.DeThiThu.rows.find(r => r[9] === ttId)[10] === 'Dữ liệu số' && E.fbdb.thi_de[ttId][0].topic === 'Dữ liệu số', 'thi thử: chủ đề lưu ở DeThiThu (giữ cột Mã bài thi)');
}
// ---------- Lấy điểm về Sheet khi nhiều học sinh: nhanh, không chép trùng, đúng thứ tự khi cho thi lại ----------
{ const E = env(); const c = p => E.ctx.doPost({ postData: { contents: JSON.stringify({ gv: GV, ...p }) } }); E.ctx.taoMau(); E.props.FB_SECRET = 's';
  const id = c({ action: 'gv_create', tieu_de: 'Lớn', che_do: 'that', khoi: 9, lop: '9A' }).exams[0].ma_de; c({ action: 'gv_set', ma_de: id, trang_thai: 'mo' });
  const sub = (k, at) => ({ ma: k, ten: 'Em ' + k, lop: '9A', diem: 5, tong: 10, dung: 1, so_cau: 2, tra_loi: { r2: 'A' }, at });
  E.fbdb.thi_nop = { [id]: {} }; for (let i = 1; i <= 20; i++) E.fbdb.thi_nop[id]['k' + i] = sub('k' + i, 1761550000000 + i);
  c({ action: 'gv_list' });
  const kqOf = () => E.sheets.KetQua.rows.filter(r => r[9] === id);
  ok(kqOf().length === 20, '20 bài nộp chép về KetQua');
  const txts = () => E.drive.filter(f => f.path.includes('Khác - Lớn/') && f.path.endsWith('.txt') && !f.trashed).length;
  ok(txts() === 15, 'lưu Drive tối đa 15 bài mỗi lần (không quá giờ chạy Apps Script)');
  E.fbdb.thi_nop[id].k21 = sub('k21', 1761550000999);
  c({ action: 'gv_list' });
  ok(kqOf().length === 20, 'mở menu Thi lần nữa trong 2 phút → không tải lại Firebase (nhanh)');
  E.props.LAST_PULL = '0'; c({ action: 'gv_list' });
  ok(kqOf().length === 21 && txts() === 21, 'quá 2 phút → chép bài mới + lưu Drive phần còn lại');
  // cho thi lại: bài chưa chép về phải được chép rồi mới đánh Hủy
  E.fbdb.thi_nop[id].k22 = sub('k22', 1761550001111);
  c({ action: 'gv_reset', ma_de: id, ma: 'k22' });
  const k22 = kqOf().filter(r => r[1] === 'k22');
  ok(k22.length === 1 && k22[0][10] === 'Hủy' && !E.fbdb.thi_nop[id].k22, 'cho thi lại: chép bài về trước rồi đánh Hủy (không còn bài cũ tính điểm)');
  // bài đã khóa và đã chép xong → lần sau không tải lại
  c({ action: 'gv_set', ma_de: id, trang_thai: 'khoa' }); E.props.LAST_PULL = '0'; c({ action: 'gv_list' });
  const before = E.fbCalls.filter(x => x.method === 'get' && x.path === `/thi_nop/${id}.json`).length;
  E.props.LAST_PULL = '0'; c({ action: 'gv_list' });
  ok(E.fbCalls.filter(x => x.method === 'get' && x.path === `/thi_nop/${id}.json`).length === before, 'bài đã khóa và đã chép xong → không tải lại từ Firebase');
  ok(!E.fbCalls.some(x => x.method === 'get' && x.path === '/thi_nop.json'), 'không bao giờ tải cả cây thi_nop');
  c({ action: 'gv_set', ma_de: id, trang_thai: 'mo' }); E.fbdb.thi_nop[id].k23 = sub('k23', 1761550002222); E.props.LAST_PULL = '0'; c({ action: 'gv_list' });
  ok(kqOf().some(r => r[1] === 'k23'), 'mở lại bài → lại chép bài mới');
  E.fbdb.thi_nop[id].k24 = sub('k24', 1761550003333); c({ action: 'gv_delete', ma_de: id });
  ok(kqOf().some(r => r[1] === 'k24'), 'xóa bài: chép điểm còn trên Firebase về trước khi ẩn');
}
// ---------- Tài khoản: giáo viên lớp (trang GiaoVien), học sinh (trang HocSinh), phạm vi lớp ----------
{ const E = env(); const c = p => E.ctx.doPost({ postData: { contents: JSON.stringify({ gv: GV, ...p }) } }); E.ctx.taoMau(); E.props.FB_SECRET = 's';
  const call = p => E.ctx.doPost({ postData: { contents: JSON.stringify(p) } });
  E.sheets.HocSinh.appendRow([3, 'Lê Chi', '9B', 'hs9b01', '345678', '']);
  ok(E.sheets.GiaoVien && E.sheets.GiaoVien.rows[0][0] === 'Mã giáo viên', 'Tạo mẫu: có trang GiaoVien');
  ok(c({ action: 'gv_teacher_save', moi: true, ma: 'gv 01', ten: 'Cô Hoa', lop: '9A', pin: '111111' }).error.includes('Mã giáo viên'), 'mã giáo viên sai dạng → báo');
  const t1 = c({ action: 'gv_teacher_save', moi: true, ma: 'GV01', ten: 'Cô Hoa', lop: '9A', pin: '111111' });
  ok(t1.ok && t1.teachers.length === 1 && t1.teachers[0].lop.join() === '9A' && !JSON.stringify(t1).includes('111111'), 'quản trị thêm giáo viên lớp 9A (không trả PIN)');
  ok(E.fbdb.thi_gv.gv01.h === require('crypto').createHash('sha256').update('gv01:111111').digest('hex') && E.fbdb.thi_gv.gv01.lop[0] === '9A', 'tài khoản giáo viên đẩy lên Firebase (PIN băm) để đăng nhập nhanh');
  ok(c({ action: 'gv_teacher_save', moi: true, ma: 'gv01', ten: 'X', lop: '9B', pin: '222222' }).error.includes('đã có'), 'trùng mã giáo viên → báo');
  { const nb = E.fbCalls.length; c({ action: 'gv_student_save', moi: true, ma: 'hs8z77', ten: 'Em Mới', lop: '8Z', pin: '777777' }); const pc = E.fbCalls.slice(nb).filter(x => x.method === 'patch');
    ok(pc.length === 1 && E.fbdb.thi_hs.hs8z77 && E.fbdb.thi_hs.hs8z77.ten === 'Em Mới', 'sửa tài khoản: chỉ đẩy phần tài khoản lên Firebase (nhanh khi nhiều bài thi)'); }
  { const z0 = c({ action: 'gv_support_save', zalo: 'zalo.com/abc' }); ok(z0.error && z0.error.includes('Zalo'), 'Zalo sai dạng → báo');
    const z1 = c({ action: 'gv_support_save', zalo: '+84 912 345 678', ten: 'Thầy Hải' });
    ok(z1.ok && z1.zalo === 'https://zalo.me/0912345678' && E.fbdb.ho_tro.zalo === 'https://zalo.me/0912345678' && E.fbdb.ho_tro.ten === 'Thầy Hải', 'quản trị lưu Zalo chung → đường dẫn zalo.me, đẩy lên Firebase ho_tro');
    const z2 = call({ gv: '111111', gv_ma: 'GV01', action: 'gv_support_save', zalo: '0987654321' });
    ok(z2.ok && E.fbdb.ho_tro.lop['9a'].zalo === 'https://zalo.me/0987654321' && E.fbdb.ho_tro.lop['9a'].ten === 'Cô Hoa' && E.fbdb.ho_tro.zalo === 'https://zalo.me/0912345678', 'giáo viên lớp lưu Zalo riêng → học sinh lớp 9A thấy Zalo cô Hoa, Zalo chung giữ nguyên');
    ok(call({ gv: '111111', gv_ma: 'GV01', action: 'gv_support' }).zalo === 'https://zalo.me/0987654321', 'giáo viên lớp đọc lại Zalo của mình');
    c({ action: 'gv_support_save', zalo: '' }); ok(!E.fbdb.ho_tro.zalo, 'để trống → ẩn Zalo chung'); }
  ok(call({ action: 'gv_login', ma: 'GV01', pin: '111111' }).teacher.lop[0] === '9A' && call({ action: 'gv_login', ma: 'GV01', pin: 'sai' }).error.includes('chưa đúng'), 'gv_login: đúng/sai PIN');
  c({ action: 'gv_create', tieu_de: 'Bài 9A', che_do: 'that', khoi: 9, lop: '9A' }); c({ action: 'gv_create', tieu_de: 'Bài 9B', che_do: 'that', khoi: 9, lop: '9B' }); c({ action: 'gv_create', tieu_de: 'Bài khối 9', che_do: 'that', khoi: 9, lop: '' });
  const g = p => call({ gv: '111111', gv_ma: 'GV01', ...p });
  const gl = g({ action: 'gv_list' });
  ok(gl.ok && gl.exams.length === 1 && gl.exams[0].tieu_de === 'Bài 9A' && Object.keys(gl.classes).join() === '9A', 'giáo viên lớp: chỉ thấy bài và lớp mình phụ trách');
  const id9b = c({ action: 'gv_list' }).exams.find(e => e.tieu_de === 'Bài 9B').ma_de;
  ok(g({ action: 'gv_set', ma_de: id9b, trang_thai: 'mo' }).error.includes('không thuộc lớp'), 'không mở/khóa được bài lớp khác');
  ok(g({ action: 'gv_create', tieu_de: 'X', che_do: 'that', khoi: 9, lop: '9B' }).error.includes('lớp thầy cô phụ trách') && g({ action: 'gv_create', tieu_de: 'X', che_do: 'that', khoi: 9, lop: '' }).error.includes('lớp thầy cô phụ trách'), 'chỉ tạo bài cho lớp mình (không tạo cả khối)');
  ok(g({ action: 'gv_create', tieu_de: 'Bài cô Hoa', che_do: 'that', khoi: 9, lop: '9A' }).exams.length === 2, 'giáo viên lớp tạo bài cho lớp mình');
  ok(g({ action: 'gv_teachers' }).error.includes('Chỉ quản trị'), 'giáo viên lớp không quản lý được tài khoản giáo viên');
  const sl = g({ action: 'gv_students' });
  ok(sl.students.every(x => x.lop === '9A') && sl.students.length === 2, 'giáo viên lớp: chỉ thấy học sinh lớp mình');
  ok(g({ action: 'gv_student_save', moi: true, ma: 'hs9b09', ten: 'A', lop: '9B', pin: '123456' }).error.includes('lớp thầy cô phụ trách'), 'không thêm học sinh vào lớp khác');
  const add = g({ action: 'gv_student_save', moi: true, ma: 'hs9a09', ten: 'Học Sinh Mới', lop: '9A', pin: '654321' });
  ok(add.students.some(x => x.ma === 'hs9a09') && E.fbdb.thi_hs.hs9a09 && call({ action: 'login', ma: 'hs9a09', pin: '654321' }).ok, 'thêm học sinh → đăng nhập được ngay (Sheet + Firebase)');
  c({ action: 'gv_student_save', ma: 'hs9a09', ten: 'Học Sinh Mới', lop: '9A', trang_thai: 'Khóa' });
  ok(call({ action: 'login', ma: 'hs9a09', pin: '654321' }).error.includes('khóa') && !E.fbdb.thi_hs.hs9a09, 'khóa học sinh → không đăng nhập được, gỡ khỏi Firebase');
  c({ action: 'gv_student_save', ma: 'hs9a09', ten: 'Học Sinh Mới', lop: '9A', pin: '777777', trang_thai: 'Hoạt động' });
  ok(call({ action: 'login', ma: 'hs9a09', pin: '777777' }).ok, 'đặt lại PIN + mở khóa');
  const del = c({ action: 'gv_student_delete', ma: 'hs9a09' }); ok(!del.students.some(x => x.ma === 'hs9a09'), 'xóa học sinh');
  ok(g({ action: 'gv_repin', new_gv: '999999' }).ok && call({ action: 'gv_login', ma: 'GV01', pin: '999999' }).ok, 'giáo viên lớp tự đổi PIN của mình');
  c({ action: 'gv_teacher_save', ma: 'GV01', ten: 'Cô Hoa', lop: '9A', trang_thai: 'Khóa' });
  ok(g({ action: 'gv_list', gv: '999999' }).error.includes('khóa') && !E.fbdb.thi_gv.gv01, 'khóa giáo viên → không vào được');
  ok(c({ action: 'gv_teacher_delete', ma: 'GV01' }).teachers.length === 0, 'xóa giáo viên');
}
// ---------- Tài liệu PDF → Google Drive, học sinh đúng khối xem qua Firebase ----------
{ const E = env(); const c = p => E.ctx.doPost({ postData: { contents: JSON.stringify({ gv: GV, ...p }) } }); E.ctx.taoMau(); E.props.FB_SECRET = 's';
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  ok(c({ action: 'gv_doc_save', tieu_de: 'Đề cương', khoi: 9 }).error.includes('Chọn file PDF'), 'thêm tài liệu thiếu file → báo');
  ok(c({ action: 'gv_doc_save', tieu_de: 'Ảnh', khoi: 9, ten_file: 'a.png', mime: 'image/png', data: pdf }).error.includes('PDF'), 'không phải PDF → chặn');
  const r1 = c({ action: 'gv_doc_save', tieu_de: 'Đề cương HK1', khoi: 9, mo_ta: 'Ôn tập', ten_file: 'de-cuong.pdf', mime: 'application/pdf', data: pdf });
  const d1 = r1.docs[0];
  ok(r1.ok && d1.tieu_de === 'Đề cương HK1' && d1.khoi === 9 && d1.file_id.includes('/Tài liệu - Góc học tập/Khối 9/de-cuong.pdf'), 'tải PDF lên Drive: thư mục Tài liệu - Góc học tập / Khối 9');
  ok(E.drive.find(f => f.name === 'de-cuong.pdf') && E.fbdb.tai_lieu[d1.id].file_id === d1.file_id && E.fbdb.tai_lieu[d1.id].khoi === 9, 'đẩy danh sách tài liệu lên Firebase cho học sinh');
  const r2 = c({ action: 'gv_doc_save', id: d1.id, tieu_de: 'Đề cương HK1 (sửa)', khoi: 8 });
  ok(r2.docs[0].tieu_de === 'Đề cương HK1 (sửa)' && r2.docs[0].khoi === 8 && r2.docs[0].file_id === d1.file_id, 'sửa tiêu đề, khối (giữ file)');
  const r3 = c({ action: 'gv_doc_save', id: d1.id, tieu_de: 'Đề cương mới', khoi: 8, ten_file: 'moi.pdf', mime: 'application/pdf', data: pdf });
  ok(r3.docs[0].file_id.endsWith('/Khối 8/moi.pdf') && r3.docs.length === 1, 'thay file mới (file cũ vào thùng rác)');
  E.sheets.HocSinh.appendRow([9, 'X', '7A', 'hs7a01', '123456', '']);
  c({ action: 'gv_teacher_save', moi: true, ma: 'GV7', ten: 'Cô Lan', lop: '7A', pin: '777777' });
  const g = p => E.ctx.doPost({ postData: { contents: JSON.stringify({ gv: '777777', gv_ma: 'GV7', ...p }) } });
  ok(g({ action: 'gv_docs' }).docs.length === 0 && g({ action: 'gv_doc_save', tieu_de: 'X', khoi: 8, ten_file: 'x.pdf', mime: 'application/pdf', data: pdf }).error.includes('khối thầy cô phụ trách'), 'giáo viên lớp 7A: chỉ thấy/đăng tài liệu khối 7');
  ok(g({ action: 'gv_doc_save', tieu_de: 'Bài tập 7', khoi: 7, ten_file: 'bt7.pdf', mime: 'application/pdf', data: pdf }).docs.length === 1, 'giáo viên lớp đăng tài liệu khối mình');
  const del = c({ action: 'gv_doc_delete', id: d1.id });
  ok(del.docs.length === 1 && !E.fbdb.tai_lieu[d1.id], 'xóa tài liệu → gỡ khỏi Firebase');
}
for (let i = 0; i < 10; i++) call({ action: 'gv_list', gv: 'x' });
ok(gv({ action: 'gv_list' }).error.includes('quá nhiều'), 'dò PIN giáo viên → khóa 10 phút');
const { ctx: c3 } = env(); c3.taoMau();
const call3 = p => c3.doPost({ postData: { contents: JSON.stringify(p) } });
call3({ action: 'gv_list', gv: GV }); c3.datLaiMatKhau();
ok(call3({ action: 'gv_list', gv: 'pin-moi' }).ok, 'Đặt lại mật khẩu giáo viên → PIN mới được ghi nhớ');
console.log(fail ? `SHEET EXAM GS: ${fail} lỗi` : 'SHEET EXAM GS OK'); process.exit(fail ? 1 : 0);
