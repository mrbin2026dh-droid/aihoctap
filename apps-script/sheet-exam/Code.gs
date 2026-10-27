/**
 * BÀI THI TỪ MỘT FILE GOOGLE SHEET — nhiều bài thi cùng lúc, không cần Worker.
 * Các trang (tự tạo bằng menu "Bài thi → Tạo mẫu" hoặc tự tạo khi cần):
 *   HocSinh : Stt | Họ tên | Lớp | Mã học sinh | Mã PIN | Trạng thái
 *   DeThi   : Stt | Khối | Đề bài | A | B | C | D | Đáp án đúng | Điểm      (ngân hàng đề THI THẬT; Khối: 9 hoặc 9A đều hiểu là khối 9; để trống = mọi khối)
 *   BaiThi  : danh sách bài thi do giáo viên tạo trong app (tiêu đề, loại thi thử/thật, khối, lớp, mở/khóa)
 *   DeThiThu: câu hỏi các bài THI THỬ (tải từ Excel trong app), cột "Mã bài thi" cho biết thuộc bài nào
 *   DiemDanh: học sinh nào đã vào phòng thi của bài nào
 *   KetQua  : mỗi lần nộp một dòng (có Mã bài thi)
 *   CauHinh : chỉ còn mật khẩu giáo viên (tự ghi)
 * Cài: Apps Script → dán file này → Lưu → Triển khai → Ứng dụng web (Thực thi: Tôi; Truy cập: Bất kỳ ai).
 */
var SH_HS = 'HocSinh', SH_DE = 'DeThi', SH_DT = 'DeThiThu', SH_KQ = 'KetQua', SH_CH = 'CauHinh', SH_BT = 'BaiThi', SH_DD = 'DiemDanh';
var HS_HEAD = ['Stt', 'Họ tên', 'Lớp', 'Mã học sinh', 'Mã PIN', 'Trạng thái'];
var DE_HEAD = ['Stt', 'Khối', 'Đề bài', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Điểm'];
var DT_HEAD = DE_HEAD.concat(['Mã bài thi']);
var KQ_HEAD = ['Thời gian nộp', 'Mã học sinh', 'Họ tên', 'Lớp', 'Điểm', 'Tổng điểm', 'Số câu đúng', 'Bài làm', 'Hình thức', 'Mã bài thi', 'Hủy'];
var BT_HEAD = ['Mã bài thi', 'Tiêu đề', 'Loại', 'Khối', 'Lớp', 'Trạng thái', 'Tạo lúc'];
var DD_HEAD = ['Mã bài thi', 'Mã học sinh', 'Vào lúc'];

function doGet(e) { return route_((e && e.parameter) || {}); }
function doPost(e) {
  var p = {}; try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { /* bỏ qua */ }
  return route_(p);
}
function route_(p) {
  try {
    if (p.action === 'ping') return out_({ ok: true });
    if (/^gv_/.test(String(p.action || ''))) return out_(teacher_(p));
    if ((p.action === 'exams' || p.action === 'exam' || p.action === 'submit') && !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BT)) schema_();
    var hs = findStudent_(p.ma, p.pin);
    if (p.action === 'login') return out_({ ok: true, student: pub_(hs) });
    if (p.action === 'exams') return out_(list_(hs));
    if (p.action === 'exam') return out_(enter_(hs, p.ma_de));
    if (p.action === 'submit') return out_(submit_(hs, p.ma_de, p.answers || {}));
    throw new Error('Yêu cầu không hợp lệ.');
  } catch (err) { return out_({ ok: false, error: err.message }); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Chưa có trang "' + name + '". Giáo viên mở menu Bài thi → Tạo mẫu.');
  return sh;
}
function norm_(s) { return String(s === null || s === undefined ? '' : s).trim().toLowerCase(); }
/** Khối từ chữ đầu: "9A" → 9, "9" → 9, "" → 0. */
function khoiOf_(s) { var m = String(s === null || s === undefined ? '' : s).trim().match(/^\d+/); return m ? parseInt(m[0], 10) : 0; }

/** Tìm học sinh theo Mã học sinh + Mã PIN (mã không phân biệt hoa thường). */

function findStudent_(ma, pin) {
  ma = norm_(ma); pin = String(pin === undefined ? '' : pin).trim();
  if (!ma || !pin) throw new Error('Nhập Mã học sinh và Mã PIN.');
  var v = sheet_(SH_HS).getDataRange().getValues();
  for (var r = 1; r < v.length; r++) {
    if (norm_(v[r][3]) === ma) {
      if (String(v[r][4]).trim() !== pin) throw new Error('Mã PIN chưa đúng.');
      return { row: r + 1, name: String(v[r][1]).trim(), lop: String(v[r][2]).trim(), ma: String(v[r][3]).trim(), status: String(v[r][5] || '').trim() };
    }
  }
  throw new Error('Không tìm thấy Mã học sinh này.');
}
function pub_(hs) { return { name: hs.name, lop: hs.lop, ma: hs.ma, status: hs.status || 'Chưa thi', done: false }; }

/* ---------- Trang dữ liệu: tự tạo khi thiếu ---------- */
function ensure_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function schema_() {
  ensure_(SH_BT, BT_HEAD); ensure_(SH_DD, DD_HEAD);
  var dt = ensure_(SH_DT, DT_HEAD);
  if (!String(dt.getRange(1, 10).getValue()).trim()) dt.getRange(1, 10).setValue('Mã bài thi');
  migrate_();
}
/** Chuyển bài thi duy nhất của bản cũ (trang CauHinh) sang trang BaiThi, một lần. */
function migrate_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ch = ss.getSheetByName(SH_CH); if (!ch) return;
  var c = {}, v = ch.getDataRange().getValues();
  for (var r = 0; r < v.length; r++) c[norm_(v[r][0])] = String(v[r][1] === undefined ? '' : v[r][1]).trim();
  if (!c.ma_de) return;
  var bt = ensure_(SH_BT, BT_HEAD), bv = bt.getDataRange().getValues();
  setConfig_('ma_de', '');   // đã chuyển → lần sau không kiểm tra lại
  for (var i = 1; i < bv.length; i++) if (String(bv[i][0]) === c.ma_de) return;
  bt.appendRow([c.ma_de, c.tieu_de || 'Bài thi', c.che_do === 'that' ? 'that' : 'thu', Number(c.khoi) || 0, c.lop || '', c.trang_thai === 'mo' ? 'mo' : 'khoa', c.bat_dau || new Date().toISOString()]);
  var dt = ensure_(SH_DT, DT_HEAD), dv = dt.getDataRange().getValues();
  for (var j = 1; j < dv.length; j++) if (!String(dv[j][9] || '').trim() && String(dv[j][2] || '').trim()) dt.getRange(j + 1, 10).setValue(c.ma_de);
}
function cfgGet_(key) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_CH); if (!sh) return '';
  var v = sh.getDataRange().getValues();
  for (var r = 0; r < v.length; r++) if (norm_(v[r][0]) === key) return String(v[r][1] === undefined ? '' : v[r][1]).trim();
  return '';
}
function setConfig_(key, val) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH_CH) || ss.insertSheet(SH_CH);
  if (!sh.getLastRow()) sh.appendRow(['Khóa', 'Giá trị']);
  var v = sh.getDataRange().getValues();
  for (var r = 0; r < v.length; r++) if (norm_(v[r][0]) === key) { sh.getRange(r + 1, 2).setValue(val); return; }
  sh.appendRow([key, val]);
}

/* ---------- Bài thi ---------- */
/** Mọi bài thi chưa xóa. Mỗi phần tử: {row, ma_de, tieu_de, che_do, khoi, lop, trang_thai, tao_luc}. */
function exams_() {
  var v = ensure_(SH_BT, BT_HEAD).getDataRange().getValues(), out = [];
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0] || '').trim(); if (!id || String(v[r][5]).trim() === 'xoa') continue;
    out.push({ row: r + 1, ma_de: id, tieu_de: String(v[r][1] || '').trim(), che_do: String(v[r][2]).trim() === 'that' ? 'that' : 'thu', khoi: Number(v[r][3]) || 0, lop: String(v[r][4] || '').trim(), trang_thai: String(v[r][5]).trim() === 'mo' ? 'mo' : 'khoa', tao_luc: v[r][6] instanceof Date ? v[r][6].toISOString() : String(v[r][6] || '') });
  }
  return out;
}
function exam_(maDe) {
  var list = exams_();
  for (var i = 0; i < list.length; i++) if (list[i].ma_de === String(maDe)) return list[i];
  throw new Error('Không tìm thấy bài thi này (có thể thầy cô đã xóa).');
}
/** Học sinh có thuộc đối tượng của bài thi không (lớp 9A → chỉ 9A; khối 9 → mọi lớp 9). */
function allowed_(hs, ex) {
  if (ex.lop) return norm_(hs.lop) === norm_(ex.lop);
  if (ex.khoi) return khoiOf_(hs.lop) === ex.khoi;
  return true;
}
function who_(ex) { return ex.lop ? 'lớp ' + ex.lop : (ex.khoi ? 'khối ' + ex.khoi : 'mọi lớp'); }

/** Câu hỏi: thi thật lấy trang DeThi theo khối; thi thử lấy trang DeThiThu theo Mã bài thi. */
function questions_(ex, hs) {
  var khoi = ex.khoi || khoiOf_(hs.lop), that = ex.che_do === 'that';
  var v = (that ? sheet_(SH_DE) : ensure_(SH_DT, DT_HEAD)).getDataRange().getValues(), out = [];
  for (var r = 1; r < v.length; r++) {
    var row = v[r], text = String(row[2] || '').trim();
    if (!text) continue;
    if (that) { var k = khoiOf_(row[1]); if (k && khoi && k !== khoi) continue; }
    else if (String(row[9] || '').trim() !== ex.ma_de) continue;
    var options = {};
    ['A', 'B', 'C', 'D'].forEach(function (L, i) { var t = String(row[3 + i] === undefined ? '' : row[3 + i]).trim(); if (t) options[L] = t; });
    out.push({ id: 'r' + (r + 1), stt: row[0] === '' ? out.length + 1 : row[0], text: text, options: options, answer: String(row[7] || '').trim().toUpperCase(), points: Number(row[8]) || 1 });
  }
  if (!out.length) throw new Error('Bài thi này chưa có câu hỏi.');
  return out;
}
function countBank_(ex) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ex.che_do === 'that' ? SH_DE : SH_DT), n = 0;
  if (!sh) return 0;
  var v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) {
    if (!String(v[r][2] || '').trim()) continue;
    if (ex.che_do === 'that') { var k = khoiOf_(v[r][1]); if (!k || !ex.khoi || k === ex.khoi) n++; }
    else if (String(v[r][9] || '').trim() === ex.ma_de) n++;
  }
  return n;
}
function bankCount_(khoi) { return countBank_({ che_do: 'that', khoi: khoi, ma_de: '' }); }

/** Bản ghi nộp còn hiệu lực của học sinh cho bài thi (điểm lần cuối). */
/** Đọc KetQua MỘT lần: {maDe: {mã hs: {score,total,at}}} (bỏ dòng đã Hủy). */
function allResults_() {
  var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ), res = {};
  if (!kq) return res;
  var v = kq.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][10] || '') === 'Hủy') continue;
    var id = String(v[i][9]); (res[id] = res[id] || {})[norm_(v[i][1])] = { score: v[i][4], total: v[i][5], at: v[i][0] instanceof Date ? v[i][0].toISOString() : '' };
  }
  return res;
}
/** Đọc DiemDanh MỘT lần: {maDe: {mã hs: giờ vào}}. */
function allVisited_() {
  var dd = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_DD), res = {};
  if (!dd) return res;
  var v = dd.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) { var id = String(v[i][0]); (res[id] = res[id] || {})[norm_(v[i][1])] = v[i][2] instanceof Date ? v[i][2].toISOString() : String(v[i][2] || ''); }
  return res;
}
function results_(maDe) { return allResults_()[maDe] || {}; }
function visited_(maDe) { return allVisited_()[maDe] || {}; }
/** Đếm câu mọi bài trong 2 lần đọc (DeThi + DeThiThu) thay vì đọc lại cho từng bài. */
function bankCounts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = { khoi: {}, thu: {}, khoiFree: 0 };
  var de = ss.getSheetByName(SH_DE);
  if (de) { var v = de.getDataRange().getValues(); for (var r = 1; r < v.length; r++) { if (!String(v[r][2] || '').trim()) continue; var k = khoiOf_(v[r][1]); if (k) out.khoi[k] = (out.khoi[k] || 0) + 1; else out.khoiFree++; } }
  var dt = ss.getSheetByName(SH_DT);
  if (dt) { var w = dt.getDataRange().getValues(); for (var j = 1; j < w.length; j++) { if (!String(w[j][2] || '').trim()) continue; var id = String(w[j][9] || '').trim(); out.thu[id] = (out.thu[id] || 0) + 1; } }
  return out;
}
function countFrom_(bc, ex) { return ex.che_do === 'that' ? (bc.khoi[ex.khoi] || 0) + bc.khoiFree : (bc.thu[ex.ma_de] || 0); }

/* ---------- Học sinh ---------- */
/** Danh sách bài thi học sinh được thấy: thi thử chỉ khi đang mở; thi thật hiện cả khi khóa (vào phòng chờ). */
function list_(hs) {
  var out = [], allRes = allResults_();
  exams_().forEach(function (ex) {
    if (!allowed_(hs, ex)) return;
    if (ex.che_do === 'thu' && ex.trang_thai !== 'mo') return;
    var mine = (allRes[ex.ma_de] || {})[norm_(hs.ma)];
    out.push({ ma_de: ex.ma_de, tieu_de: ex.tieu_de, che_do: ex.che_do, trang_thai: ex.trang_thai, done: ex.che_do === 'that' && !!mine, score: mine ? mine.score : null, total: mine ? mine.total : null });
  });
  return { ok: true, student: pub_(hs), exams: out };
}
function enter_(hs, maDe) {
  var ex = exam_(maDe);
  if (!allowed_(hs, ex)) throw new Error('Bài thi "' + ex.tieu_de + '" chỉ dành cho ' + who_(ex) + '.');
  if (ex.che_do === 'thu' && ex.trang_thai !== 'mo') throw new Error('Bài thi thử đang khóa.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var dd = ensure_(SH_DD, DD_HEAD), v = dd.getDataRange().getValues(), found = 0;
    for (var i = 1; i < v.length; i++) if (String(v[i][0]) === maDe && norm_(v[i][1]) === norm_(hs.ma)) { found = i + 1; break; }
    if (found) dd.getRange(found, 3).setValue(new Date()); else dd.appendRow([maDe, hs.ma, new Date()]);
  } finally { lock.releaseLock(); }
  var base = { ok: true, ma_de: ex.ma_de, mode: ex.che_do, title: ex.tieu_de, student: pub_(hs) };
  if (ex.trang_thai !== 'mo') { base.waiting = true; base.questions = []; return base; }
  var done = ex.che_do === 'that' && !!results_(maDe)[norm_(hs.ma)]; base.student.done = done;
  base.questions = done ? [] : questions_(ex, hs).map(function (q) { return { id: q.id, stt: q.stt, text: q.text, options: q.options, points: q.points }; });
  return base;
}
/** Chấm, ghi KetQua. Thi thật: mỗi em một lần; thi thử: làm nhiều lần. */
function submit_(hs, maDe, answers) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ex = exam_(maDe);
    if (ex.trang_thai !== 'mo') throw new Error('Bài thi đang khóa. Báo thầy cô.');
    if (!allowed_(hs, ex)) throw new Error('Bài thi này không dành cho lớp em.');
    var thuc = ex.che_do === 'that';
    if (thuc && results_(maDe)[norm_(hs.ma)]) throw new Error('Em đã nộp bài rồi.');
    var qs = questions_(ex, hs), score = 0, total = 0, right = 0, lines = [];
    qs.forEach(function (q) {
      var mine = String(answers[q.id] || '').trim().toUpperCase(), ok = mine !== '' && mine === q.answer;
      total += q.points; if (ok) { score += q.points; right++; }
      lines.push(q.stt + ':' + (mine || '-') + (ok ? '✓' : '✗'));
    });
    score = Math.round(score * 100) / 100; total = Math.round(total * 100) / 100;
    ensure_(SH_KQ, KQ_HEAD).appendRow([new Date(), hs.ma, hs.name, hs.lop, score, total, right + '/' + qs.length, lines.join('  '), thuc ? 'Thi thật' : 'Thi thử', ex.ma_de, '']);
    return { ok: true, mode: ex.che_do, score: score, total: total, correct: right, count: qs.length };
  } finally { lock.releaseLock(); }
}

/* ---------- Giáo viên ---------- */
/**
 * Mật khẩu giáo viên = chính PIN giáo viên đăng nhập app (app tự gửi, không hỏi lại).
 * Lần đầu (ô mat_khau_gv trong CauHinh còn trống) hệ thống ghi nhớ PIN đó. Đổi PIN giáo viên: menu Bài thi → Đặt lại mật khẩu giáo viên.
 */
function teacher_(p) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('gvfail') || 0);
  if (fails >= 10) throw new Error('Nhập sai quá nhiều lần. Chờ 10 phút rồi thử lại.');
  var stored = cfgGet_('mat_khau_gv'), sent = String(p.gv === undefined ? '' : p.gv).trim();
  if (!sent) throw new Error('Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.');
  if (!stored) setConfig_('mat_khau_gv', sent);
  else if (sent !== stored) { cache.put('gvfail', String(fails + 1), 600); throw new Error('PIN giáo viên chưa khớp với Google Sheet. Mở Sheet → menu Bài thi → Đặt lại mật khẩu giáo viên.'); }
  cache.remove('gvfail');
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BT) || !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_DD) || cfgGet_('ma_de')) schema_();
  var a = p.action;
  if (a === 'gv_repin') { var np = String(p.new_gv || '').trim(); if (np.length < 6) throw new Error('PIN mới quá ngắn.'); setConfig_('mat_khau_gv', np); return { ok: true }; }
  if (a === 'gv_stats') return stats_(String(p.ma_de || ''));
  if (a === 'gv_create') create_(p);
  else if (a === 'gv_update') update_(p);
  else if (a === 'gv_set') setStatus_(String(p.ma_de || ''), p.trang_thai);
  else if (a === 'gv_delete') del_(String(p.ma_de || ''));
  else if (a === 'gv_reset') reset_(String(p.ma_de || ''), p.ma);
  else if (a !== 'gv_list' && a !== 'gv_info') throw new Error('Yêu cầu không hợp lệ.');
  return a === 'gv_reset' ? stats_(String(p.ma_de || '')) : info_();
}
function writeQuestions_(maDe, khoi, qs) {
  var d = ensure_(SH_DT, DT_HEAD), v = d.getDataRange().getValues(), keep = [];
  for (var r = 1; r < v.length; r++) if (String(v[r][9] || '').trim() !== maDe && String(v[r][2] || '').trim()) keep.push(v[r].slice(0, 10));
  qs.forEach(function (q, i) { var o = q.options || {}; keep.push([i + 1, khoi, String(q.text || ''), o.A || '', o.B || '', o.C || '', o.D || '', String(q.answer || '').toUpperCase(), Number(q.points) || 1, maDe]); });
  d.clear(); d.appendRow(DT_HEAD); d.setFrozenRows(1);
  if (keep.length) d.getRange(2, 1, keep.length, 10).setValues(keep);
}
function create_(p) {
  var che = p.che_do === 'that' ? 'that' : 'thu', khoi = Number(p.khoi) || 0, lop = String(p.lop || '').trim(), title = String(p.tieu_de || '').trim();
  if (!title) throw new Error('Nhập tiêu đề bài thi.');
  if (!khoi) throw new Error('Chọn khối.');
  var ex = { che_do: che, khoi: khoi, ma_de: String(new Date().getTime()) };
  if (che === 'that') { if (!countBank_(ex)) throw new Error('Trang DeThi trong Google Sheet chưa có câu cho khối ' + khoi + '.'); }
  else { if (!(p.questions || []).length) throw new Error('Tải file Excel đề thi thử lên trước.'); writeQuestions_(ex.ma_de, khoi, p.questions); }
  ensure_(SH_BT, BT_HEAD).appendRow([ex.ma_de, title, che, khoi, lop, 'khoa', new Date().toISOString()]);
}
function update_(p) {
  var ex = exam_(String(p.ma_de || '')), sh = sheet_(SH_BT);
  var title = String(p.tieu_de === undefined ? ex.tieu_de : p.tieu_de).trim(), khoi = p.khoi === undefined ? ex.khoi : (Number(p.khoi) || 0), lop = String(p.lop === undefined ? ex.lop : p.lop).trim();
  if (!title) throw new Error('Nhập tiêu đề bài thi.');
  if (!khoi) throw new Error('Chọn khối.');
  if (ex.che_do === 'thu' && p.questions && p.questions.length) writeQuestions_(ex.ma_de, khoi, p.questions);
  sh.getRange(ex.row, 2).setValue(title); sh.getRange(ex.row, 4).setValue(khoi); sh.getRange(ex.row, 5).setValue(lop);
}
function setStatus_(maDe, st) {
  if (st !== 'mo' && st !== 'khoa') throw new Error('Trạng thái không hợp lệ.');
  var ex = exam_(maDe); sheet_(SH_BT).getRange(ex.row, 6).setValue(st);
}
/** Xóa = ẩn khỏi danh sách (giữ nguyên điểm trong KetQua). */
function del_(maDe) { var ex = exam_(maDe); sheet_(SH_BT).getRange(ex.row, 6).setValue('xoa'); }
function reset_(maDe, ma) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    exam_(maDe);
    var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ), n = 0;
    if (kq) { var kv = kq.getDataRange().getValues(); for (var i = 1; i < kv.length; i++) if (norm_(kv[i][1]) === norm_(ma) && String(kv[i][9]) === maDe && String(kv[i][10] || '') !== 'Hủy') { kq.getRange(i + 1, 11).setValue('Hủy'); n++; } }
    if (!n) throw new Error('Học sinh này chưa nộp bài thi này.');
  } finally { lock.releaseLock(); }
}
function students_() {
  var hv = sheet_(SH_HS).getDataRange().getValues(), out = [];
  for (var r = 1; r < hv.length; r++) { var ma = String(hv[r][3] || '').trim(); if (ma) out.push({ name: String(hv[r][1]).trim(), lop: String(hv[r][2]).trim(), ma: ma }); }
  return out;
}
/** Danh sách bài thi + số liệu tóm tắt. */
function info_() {
  var st = students_(), classes = {}, list = [], allRes = allResults_(), allVis = allVisited_(), bc = bankCounts_();
  st.forEach(function (s) { classes[s.lop] = khoiOf_(s.lop); });
  exams_().forEach(function (ex) {
    var res = allRes[ex.ma_de] || {}, vis = allVis[ex.ma_de] || {}, n = 0, vao = 0, nop = 0;
    st.forEach(function (s) { if (!allowed_(s, ex)) return; n++; var k = norm_(s.ma); if (res[k]) nop++; else if (vis[k]) vao++; });
    list.push({ ma_de: ex.ma_de, tieu_de: ex.tieu_de, che_do: ex.che_do, khoi: ex.khoi, lop: ex.lop, trang_thai: ex.trang_thai, tao_luc: ex.tao_luc, questions: countFrom_(bc, ex), total: n, vao: vao, nop: nop });
  });
  list.sort(function (a, b) { return String(b.tao_luc).localeCompare(String(a.tao_luc)); });
  var bank = {}; [6, 7, 8, 9].forEach(function (k) { bank[k] = (bc.khoi[k] || 0) + bc.khoiFree; });
  return { ok: true, exams: list, bank: bank, classes: classes };
}
/** Chi tiết một bài thi: từng học sinh thuộc đối tượng với trạng thái chưa vào / đã vào / đã nộp. */
function stats_(maDe) {
  var ex = exam_(maDe), res = results_(maDe), vis = visited_(maDe), out = [];
  students_().forEach(function (s) {
    if (!allowed_(s, ex)) return;
    var k = norm_(s.ma), r = res[k];
    out.push({ name: s.name, lop: s.lop, ma: s.ma, state: r ? 'nop' : (vis[k] ? 'vao' : 'chua'), last: vis[k] || '', score: r ? r.score : null, total: r ? r.total : null });
  });
  return { ok: true, exam: { ma_de: ex.ma_de, tieu_de: ex.tieu_de, che_do: ex.che_do, khoi: ex.khoi, lop: ex.lop, trang_thai: ex.trang_thai, questions: countBank_(ex) }, students: out };
}

/* ---------- Tạo mẫu ---------- */
function taoMau() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SH_HS)) {
    var a = ss.insertSheet(SH_HS); a.appendRow(HS_HEAD);
    a.appendRow([1, 'Nguyễn Văn An', '9A', 'hs9a01', '123456', 'Chưa thi']);
    a.appendRow([2, 'Trần Thị Bình', '9A', 'hs9a02', '234567', 'Chưa thi']);
    a.getRange('E:E').setNumberFormat('@'); a.setFrozenRows(1);
  }
  if (!ss.getSheetByName(SH_DE)) {
    var d = ss.insertSheet(SH_DE); d.appendRow(DE_HEAD);
    d.appendRow([1, 9, 'Thiết bị nào là bộ xử lý trung tâm?', 'CPU', 'RAM', 'Ổ cứng', 'Màn hình', 'A', 5]);
    d.appendRow([2, 9, 'Phần mềm nào là bảng tính?', 'Word', 'Excel', 'PowerPoint', 'Paint', 'B', 5]);
    d.setFrozenRows(1);
  } else if (String(ss.getSheetByName(SH_DE).getRange(1, 2).getValue()).trim() === 'Lớp') ss.getSheetByName(SH_DE).getRange(1, 2).setValue('Khối');
  if (!ss.getSheetByName(SH_CH)) { var c = ss.insertSheet(SH_CH); c.appendRow(['Khóa', 'Giá trị']); c.getRange('B:B').setNumberFormat('@'); c.setFrozenRows(1); }
  schema_();
}
function datLaiMatKhau() { setConfig_('mat_khau_gv', ''); }
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bài thi').addItem('Tạo mẫu', 'taoMau').addItem('Đặt lại mật khẩu giáo viên', 'datLaiMatKhau').addToUi();
}
