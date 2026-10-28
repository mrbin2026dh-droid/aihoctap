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
var Q_HEAD = ['Stt', 'Khối', 'Đề bài', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Điểm'];
var DE_HEAD = Q_HEAD.concat(['Chủ đề', 'Mức độ']);                 // DeThi: cột J Chủ đề, K Mức độ (Biết/Hiểu/Vận dụng)
var DT_HEAD = Q_HEAD.concat(['Mã bài thi', 'Chủ đề', 'Mức độ']);   // DeThiThu: giữ cột J Mã bài thi như cũ
var MUC_DO = ['Biết', 'Hiểu', 'Vận dụng'];
function lvl_(x) { x = String(x || '').trim(); return MUC_DO.indexOf(x) >= 0 ? x : ''; }
var KQ_HEAD = ['Thời gian nộp', 'Mã học sinh', 'Họ tên', 'Lớp', 'Điểm', 'Tổng điểm', 'Số câu đúng', 'Bài làm', 'Hình thức', 'Mã bài thi', 'Hủy', 'Mã nộp', 'Lưu Drive'];
/** Firebase dùng chung với app (học sinh đọc đề, nộp bài trực tiếp — nhanh, không qua Worker). */
var FB_URL_DEFAULT = 'https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app';
var SH_TL = 'TaiLieu', TL_HEAD = ['Mã tài liệu', 'Tiêu đề', 'Khối', 'Mô tả', 'File ID', 'Tên file', 'Kích thước', 'Cập nhật lúc', 'Người đăng'];
var SH_GV = 'GiaoVien', GV_HEAD = ['Mã giáo viên', 'Họ tên', 'Mã PIN', 'Lớp phụ trách', 'Trạng thái', 'Zalo'];
/** Lớp giáo viên đang đăng nhập được phụ trách (chữ thường); null = quản trị (thấy mọi lớp). */
var SCOPE_ = null;
var BT_HEAD = ['Mã bài thi', 'Tiêu đề', 'Loại', 'Khối', 'Lớp', 'Trạng thái', 'Tạo lúc', 'Xem điểm', 'Năm học', 'Hình thức', 'Nội dung', 'Thực hành'];
var SH_CTH = 'ChamThucHanh', CTH_HEAD = ['Mã bài thi', 'Mã học sinh', 'Họ tên', 'Lớp', 'File', 'File ID', 'Nộp lúc', 'Điểm TH', 'Chi tiết', 'Nhận xét', 'Chấm lúc', 'Người chấm'];
var KT_TYPES = ['excel_formula', 'excel_value', 'py_test', 'py_contains'];
/** Đề + tiêu chí chấm thực hành (giữ ở Sheet; chỉ đề bài được đẩy cho học sinh). */
function thucHanh_(x) {
  if (typeof x === 'string') { try { x = JSON.parse(x || 'null'); } catch (e) { x = null; } }
  if (!x || typeof x !== 'object') return null;
  var loai = ['excel', 'python', 'khac'].indexOf(String(x.loai)) >= 0 ? String(x.loai) : 'khac';
  var tc = (Array.isArray(x.tieu_chi) ? x.tieu_chi : []).slice(0, 12).map(function (t) {
    var kt = t && t.kt && KT_TYPES.indexOf(String(t.kt.type)) >= 0 ? { type: String(t.kt.type), a: String(t.kt.a || '').slice(0, 200), b: String(t.kt.b === undefined ? '' : t.kt.b).slice(0, 2000) } : null;
    return { mo_ta: String(t && t.mo_ta || '').trim().slice(0, 200), diem: Math.max(0, Math.min(100, Number(t && t.diem) || 0)), kt: kt };
  }).filter(function (t) { return t.mo_ta && t.diem > 0; });
  return { loai: loai, de: String(x.de || '').trim().slice(0, 3000), tieu_chi: tc };
}
var HINH_THUC = ['15 phút', 'Giữa kỳ I', 'Cuối kỳ I', 'Giữa kỳ II', 'Cuối kỳ II', 'Khác'];
var DD_HEAD = ['Mã bài thi', 'Mã học sinh', 'Vào lúc'];

function doGet(e) { return route_((e && e.parameter) || {}); }
function doPost(e) {
  var p = {}; try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { /* bỏ qua */ }
  return route_(p);
}
function route_(p) {
  try {
    if (p.action === 'ping') return out_({ ok: true });
    if (p.action === 'brain_save') return out_(brainSave_(p));   // Bộ não AI trên VPS gửi báo cáo (khóa BRAIN_KEY)
    if (p.action === 'gv_login') { var t = findTeacher_(p.ma, p.pin); return out_({ ok: true, teacher: { ma: t.ma, ten: t.ten, lop: t.lop } }); }
    if (/^gv_/.test(String(p.action || ''))) return out_(teacher_(p));
    if ((p.action === 'exams' || p.action === 'exam' || p.action === 'submit') && !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BT)) schema_();
    var hs = findStudent_(p.ma, p.pin);
    if (p.action === 'login') return out_({ ok: true, student: pub_(hs) });
    if (p.action === 'exams') return out_(list_(hs));
    if (p.action === 'exam') return out_(enter_(hs, p.ma_de));
    if (p.action === 'submit') return out_(submit_(hs, p.ma_de, p.answers || {}));
    if (p.action === 'nop_th') return out_(nopThucHanh_(hs, String(p.ma_de || ''), p));
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
      if (/^khóa$/i.test(String(v[r][5] || '').trim())) throw new Error('Tài khoản đang bị khóa. Báo thầy cô.');
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
  ensure_(SH_BT, BT_HEAD); ensure_(SH_DD, DD_HEAD); ensure_(SH_TL, TL_HEAD);
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
  var sh = ensure_(SH_BT, BT_HEAD), v = sh.getDataRange().getValues(), out = [];
  if (v.length) for (var c = 7; c < BT_HEAD.length; c++) if (String(v[0][c] || '').trim() !== BT_HEAD[c]) sh.getRange(1, c + 1).setValue(BT_HEAD[c]);
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0] || '').trim(); if (!id || String(v[r][5]).trim() === 'xoa') continue;
    out.push({ row: r + 1, ma_de: id, tieu_de: String(v[r][1] || '').trim(), che_do: String(v[r][2]).trim() === 'that' ? 'that' : 'thu', khoi: Number(v[r][3]) || 0, lop: String(v[r][4] || '').trim(), trang_thai: String(v[r][5]).trim() === 'mo' ? 'mo' : 'khoa', tao_luc: v[r][6] instanceof Date ? v[r][6].toISOString() : String(v[r][6] || ''), xem_diem: xemOf_(v[r][7], v[r][2]), nam_hoc: String(v[r][8] || '').trim(), hinh_thuc: String(v[r][9] || '').trim(), noi_dung: String(v[r][10] || '').trim() === 'tn_th' ? 'tn_th' : 'tn', thuc_hanh: thucHanh_(v[r][11]) });
  }
  return out;
}
/** Ô "Xem điểm": co / khong; để trống = thi thử cho xem, thi thật ẩn. */
function xemOf_(v, che) { v = String(v || '').trim(); return v === 'co' ? true : v === 'khong' ? false : String(che).trim() !== 'that'; }
/** Năm học hiện tại, ví dụ 2026-2027 (năm học mới bắt đầu tháng 8). */
function namHoc_() { var d = new Date(), y = d.getFullYear(); return d.getMonth() >= 7 ? y + '-' + (y + 1) : (y - 1) + '-' + y; }
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
    out.push({ id: 'r' + (r + 1), stt: row[0] === '' ? out.length + 1 : row[0], text: text, options: options, answer: String(row[7] || '').trim().toUpperCase(), points: Number(row[8]) || 1, topic: String((that ? row[9] : row[10]) || '').trim().slice(0, 60), level: lvl_(that ? row[10] : row[11]) });
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
  var sent = String(p.gv === undefined ? '' : p.gv).trim(), me = null;
  if (!sent) throw new Error('Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.');
  SCOPE_ = null;
  if (String(p.gv_ma || '').trim()) {                     // giáo viên lớp: Mã giáo viên + PIN trong trang GiaoVien
    try { me = findTeacher_(p.gv_ma, sent); } catch (e) { cache.put('gvfail', String(fails + 1), 600); throw e; }
    SCOPE_ = me.lop.map(norm_);
  } else {                                                // quản trị: PIN giáo viên của app (ghi nhớ lần đầu)
    var stored = cfgGet_('mat_khau_gv');
    if (!stored) setConfig_('mat_khau_gv', sent);
    else if (sent !== stored) { cache.put('gvfail', String(fails + 1), 600); throw new Error('PIN giáo viên chưa khớp với Google Sheet. Mở Sheet → menu Bài thi → Đặt lại mật khẩu giáo viên.'); }
  }
  cache.remove('gvfail');
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_BT) || !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_DD) || cfgGet_('ma_de')) schema_();
  var a = p.action;
  if (a === 'gv_repin') { var np = String(p.new_gv || '').trim(); if (np.length < 6) throw new Error('PIN mới quá ngắn.'); if (me) setTeacherPin_(me.ma, np); else setConfig_('mat_khau_gv', np); return { ok: true }; }
  if (a === 'gv_brain') return brainGet_();
  if (a === 'gv_support') return { ok: true, zalo: me ? (me.zalo || '') : cfgGet_('ho_tro_zalo'), ten: me ? me.ten : cfgGet_('ho_tro_ten') };
  if (a === 'gv_support_save') {                          // Zalo hỗ trợ: quản trị = chung cả trường; giáo viên lớp = riêng các lớp mình
    var z = normZalo_(p.zalo), tn = String(p.ten || '').trim().slice(0, 40);
    if (me) { var shg = ensure_(SH_GV, GV_HEAD); if (String(shg.getRange(1, 6).getValue()).trim() !== 'Zalo') shg.getRange(1, 6).setValue('Zalo'); shg.getRange(me.row, 6).setValue(z); }
    else { setConfig_('ho_tro_zalo', z); setConfig_('ho_tro_ten', tn); }
    var resz = { ok: true, zalo: z, ten: me ? me.ten : tn }; try { publish_(['ho_tro']); } catch (e) { resz.fb_error = e.message; } return resz;
  }
  if (a === 'gv_whoami') return { ok: true, me: me ? { ma: me.ma, ten: me.ten, lop: me.lop } : null, admin: !me };
  if (/^gv_(teachers|teacher_save|teacher_delete|students|student_save|student_delete)$/.test(a)) return accounts_(a, p, me);
  if (/^gv_doc(s|_save|_delete)$/.test(a)) return docs_(a, p, me);
  if (p.ma_de && a !== 'gv_create') ownExam_(String(p.ma_de));
  if (a === 'gv_stats') return stats_(String(p.ma_de || ''));
  if (a === 'gv_th_get' || a === 'gv_th_save') return thCham_(a, p, me);
  if (a === 'gv_questions') { var exq = exam_(String(p.ma_de || '')); return { ok: true, ma_de: exq.ma_de, che_do: exq.che_do, khoi: exq.khoi, questions: questionsFor_(exq) }; }
  if (a === 'gv_publish') { var n = publish_(); var info = info_(); info.published = n; return info; }
  if (a === 'gv_create') create_(p);
  else if (a === 'gv_update') update_(p);
  else if (a === 'gv_set') setStatus_(String(p.ma_de || ''), p.trang_thai, p.xem_diem);
  else if (a === 'gv_delete') del_(String(p.ma_de || ''));
  else if (a === 'gv_reset') reset_(String(p.ma_de || ''), p.ma);
  else if (a !== 'gv_list' && a !== 'gv_info') throw new Error('Yêu cầu không hợp lệ.');
  var fbErr = '';
  try {
    if (a === 'gv_list' || a === 'gv_info') pull_();                 // điểm học sinh nộp trên Firebase → ghi vào KetQua
    else if (a !== 'gv_reset') publish_();                            // tạo/sửa/mở/khóa/xóa → đẩy ngay lên Firebase
  } catch (e) { fbErr = e.message; }
  var res = a === 'gv_reset' ? stats_(String(p.ma_de || '')) : info_();
  res.fb = fbOn_(); if (fbErr) res.fb_error = fbErr;
  return res;
}
function writeQuestions_(maDe, khoi, qs) {
  var d = ensure_(SH_DT, DT_HEAD), v = d.getDataRange().getValues(), keep = [];
  var pad = function (row) { row = row.slice(0, 12); while (row.length < 12) row.push(''); return row; };
  for (var r = 1; r < v.length; r++) if (String(v[r][9] || '').trim() !== maDe && String(v[r][2] || '').trim()) keep.push(pad(v[r]));
  qs.forEach(function (q, i) { var o = q.options || {}; keep.push([i + 1, khoi, String(q.text || ''), o.A || '', o.B || '', o.C || '', o.D || '', String(q.answer || '').toUpperCase(), Number(q.points) || 1, maDe, String(q.topic || '').trim().slice(0, 60), lvl_(q.level)]); });
  d.clear(); d.appendRow(DT_HEAD); d.setFrozenRows(1);
  if (keep.length) d.getRange(2, 1, keep.length, 12).setValues(keep);
}
function create_(p) {
  var che = p.che_do === 'that' ? 'that' : 'thu', khoi = Number(p.khoi) || 0, lop = String(p.lop || '').trim(), title = String(p.tieu_de || '').trim();
  if (!title) throw new Error('Nhập tiêu đề bài thi.');
  if (!khoi) throw new Error('Chọn khối.');
  if (SCOPE_ && (!lop || SCOPE_.indexOf(norm_(lop)) < 0)) throw new Error('Chọn một lớp thầy cô phụ trách.');
  var used = {}; ensure_(SH_BT, BT_HEAD).getDataRange().getValues().forEach(function (r) { used[String(r[0])] = 1; });
  var id = new Date().getTime(); while (used[String(id)]) id++;   // mã bài không trùng kể cả khi tạo liên tiếp
  var ex = { che_do: che, khoi: khoi, ma_de: String(id) };
  if (che === 'that') { if (!countBank_(ex)) throw new Error('Trang DeThi trong Google Sheet chưa có câu cho khối ' + khoi + '.'); }
  else { if (!(p.questions || []).length) throw new Error('Tải file Excel đề thi thử lên trước.'); writeQuestions_(ex.ma_de, khoi, p.questions); }
  var nam = String(p.nam_hoc || '').trim() || namHoc_(), ht = HINH_THUC.indexOf(String(p.hinh_thuc || '')) >= 0 ? String(p.hinh_thuc) : (che === 'that' ? 'Khác' : '');
  var th = che === 'that' && p.noi_dung === 'tn_th' ? thucHanh_(p.thuc_hanh) : null;
  ensure_(SH_BT, BT_HEAD).appendRow([ex.ma_de, title, che, khoi, lop, 'khoa', new Date().toISOString(), che === 'thu' ? 'co' : 'khong', che === 'that' ? nam : '', ht, che === 'that' && p.noi_dung === 'tn_th' ? 'tn_th' : 'tn', th ? JSON.stringify(th) : '']);
}
function update_(p) {
  var ex = exam_(String(p.ma_de || '')), sh = sheet_(SH_BT);
  var title = String(p.tieu_de === undefined ? ex.tieu_de : p.tieu_de).trim(), khoi = p.khoi === undefined ? ex.khoi : (Number(p.khoi) || 0), lop = String(p.lop === undefined ? ex.lop : p.lop).trim();
  if (!title) throw new Error('Nhập tiêu đề bài thi.');
  if (!khoi) throw new Error('Chọn khối.');
  if (SCOPE_ && (!lop || SCOPE_.indexOf(norm_(lop)) < 0)) throw new Error('Chọn một lớp thầy cô phụ trách.');
  if (p.questions && p.questions.length) saveQuestions_(ex, khoi, p.questions);
  sh.getRange(ex.row, 2).setValue(title); sh.getRange(ex.row, 4).setValue(khoi); sh.getRange(ex.row, 5).setValue(lop);
  if (ex.che_do === 'that') {
    if (p.nam_hoc !== undefined) sh.getRange(ex.row, 9).setValue(String(p.nam_hoc || '').trim() || namHoc_());
    if (HINH_THUC.indexOf(String(p.hinh_thuc || '')) >= 0) sh.getRange(ex.row, 10).setValue(String(p.hinh_thuc));
    if (p.noi_dung === 'tn' || p.noi_dung === 'tn_th') sh.getRange(ex.row, 11).setValue(p.noi_dung);
    if (p.thuc_hanh !== undefined) { var th2 = thucHanh_(p.thuc_hanh); if (String(sh.getRange(1, 12).getValue()).trim() !== 'Thực hành') sh.getRange(1, 12).setValue('Thực hành'); sh.getRange(ex.row, 12).setValue(th2 ? JSON.stringify(th2) : ''); }
  }
}
/** Câu hỏi của bài để giáo viên sửa (kèm đáp án). Thi thật: các câu của khối trong DeThi; thi thử: các câu của bài trong DeThiThu. */
function questionsFor_(ex) {
  var qs = []; try { qs = questions_(ex, { lop: '' }); } catch (e) { qs = []; }
  return qs.map(function (q) { return { id: q.id, text: q.text, options: q.options, answer: q.answer, points: q.points, topic: q.topic, level: q.level }; });
}
/** Lưu câu hỏi giáo viên sửa: thi thử thay đề của bài; thi thật thay các câu của khối đó trong DeThi (giữ câu các khối khác). */
function saveQuestions_(ex, khoi, qs) {
  qs = (qs || []).filter(function (q) { return String(q && q.text || '').trim(); });
  if (!qs.length) throw new Error('Bài thi cần ít nhất một câu hỏi.');
  qs.forEach(function (q, i) {
    var o = q.options || {}, n = ['A', 'B', 'C', 'D'].filter(function (L) { return String(o[L] || '').trim(); });
    if (n.length < 2) throw new Error('Câu ' + (i + 1) + ': cần ít nhất 2 phương án.');
    if (n.indexOf(String(q.answer || '').toUpperCase()) < 0) throw new Error('Câu ' + (i + 1) + ': đáp án đúng phải là một phương án có nội dung.');
  });
  if (ex.che_do === 'thu') { writeQuestions_(ex.ma_de, khoi, qs); return; }
  var d = sheet_(SH_DE), v = d.getDataRange().getValues(), keep = [];
  var pad = function (row) { row = row.slice(0, 11); while (row.length < 11) row.push(''); return row; };
  for (var r = 1; r < v.length; r++) { var k = khoiOf_(v[r][1]); if (String(v[r][2] || '').trim() && k !== khoi) keep.push(pad(v[r])); }
  qs.forEach(function (q, i) { var o = q.options || {}; keep.push([i + 1, khoi, String(q.text).trim(), o.A || '', o.B || '', o.C || '', o.D || '', String(q.answer).toUpperCase(), Number(q.points) || 1, String(q.topic || '').trim().slice(0, 60), lvl_(q.level)]); });
  d.clear(); d.appendRow(DE_HEAD); d.setFrozenRows(1);
  if (keep.length) d.getRange(2, 1, keep.length, 11).setValues(keep);
}
/** Mở/khóa (trang_thai) và/hoặc cho học sinh xem điểm, xếp hạng (xem_diem: 'co' | 'khong'). */
function setStatus_(maDe, st, xem) {
  var ex = exam_(maDe), done = false;
  if (st === 'mo' || st === 'khoa') { sheet_(SH_BT).getRange(ex.row, 6).setValue(st); if (st === 'mo') unpull_(maDe); done = true; }
  if (xem === 'co' || xem === 'khong') { sheet_(SH_BT).getRange(ex.row, 8).setValue(xem); done = true; }
  if (!done) throw new Error('Trạng thái không hợp lệ.');
}
/** Xóa = ẩn khỏi danh sách (giữ nguyên điểm trong KetQua). */
function del_(maDe) { var ex = exam_(maDe); if (fbOn_()) { try { pull_(true, maDe); } catch (e) { /* vẫn xóa được */ } } sheet_(SH_BT).getRange(ex.row, 6).setValue('xoa'); }   // chép điểm về trước khi ẩn bài (bài ẩn không còn được chép)
function reset_(maDe, ma) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    exam_(maDe);
    var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ), n = 0;
    // Chép bài trên Firebase về TRƯỚC rồi mới đánh dấu Hủy (trước đây làm ngược → bài cũ chép về sau vẫn tính điểm).
    if (fbOn_()) { try { pull_(true, maDe); } catch (e) { /* vẫn xóa được */ } }
    kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
    if (kq) { var kv = kq.getDataRange().getValues(); for (var i = 1; i < kv.length; i++) if (norm_(kv[i][1]) === norm_(ma) && String(kv[i][9]) === maDe && String(kv[i][10] || '') !== 'Hủy') { kq.getRange(i + 1, 11).setValue('Hủy'); n++; } }
    if (fbOn_()) { fb_('delete', 'thi_nop/' + maDe + '/' + fbKey_(ma)); unpull_(maDe); n++; }
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
  st.forEach(function (s) { if (!SCOPE_ || SCOPE_.indexOf(norm_(s.lop)) >= 0) classes[s.lop] = khoiOf_(s.lop); });
  if (SCOPE_) SCOPE_.forEach(function (l, i) { var real = Object.keys(classes).filter(function (c) { return norm_(c) === l; })[0]; if (!real) classes[l.toUpperCase()] = khoiOf_(l); });
  exams_().filter(inScope_).forEach(function (ex) {
    var res = allRes[ex.ma_de] || {}, vis = allVis[ex.ma_de] || {}, n = 0, vao = 0, nop = 0;
    st.forEach(function (s) { if (!allowed_(s, ex)) return; n++; var k = norm_(s.ma); if (res[k]) nop++; else if (vis[k]) vao++; });
    list.push({ ma_de: ex.ma_de, tieu_de: ex.tieu_de, che_do: ex.che_do, khoi: ex.khoi, lop: ex.lop, trang_thai: ex.trang_thai, tao_luc: ex.tao_luc, xem_diem: !!ex.xem_diem, nam_hoc: ex.nam_hoc, hinh_thuc: ex.hinh_thuc, noi_dung: ex.noi_dung, thuc_hanh: ex.thuc_hanh, questions: countFrom_(bc, ex), total: n, vao: vao, nop: nop });
  });
  list.sort(function (a, b) { return String(b.tao_luc).localeCompare(String(a.tao_luc)); });
  var bank = {}; [6, 7, 8, 9].forEach(function (k) { bank[k] = (bc.khoi[k] || 0) + bc.khoiFree; });
  return { ok: true, exams: list, bank: bank, classes: classes };
}
/** Chi tiết một bài thi: từng học sinh thuộc đối tượng với trạng thái chưa vào / đã vào / đã nộp. */
function stats_(maDe) {
  var ex = exam_(maDe), res = results_(maDe), vis = visited_(maDe), out = [], lan = {};
  var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
  if (kq) { var kv = kq.getDataRange().getValues(); for (var i = 1; i < kv.length; i++) if (String(kv[i][9]) === maDe && String(kv[i][10] || '') !== 'Hủy') { var kk = norm_(kv[i][1]); lan[kk] = (lan[kk] || 0) + 1; } }
  students_().forEach(function (s) {
    if (!allowed_(s, ex)) return;
    var k = norm_(s.ma), r = res[k];
    out.push({ name: s.name, lop: s.lop, ma: s.ma, state: r ? 'nop' : (vis[k] ? 'vao' : 'chua'), last: vis[k] || '', score: r ? r.score : null, total: r ? r.total : null, lan: lan[k] || 0 });
  });
  return { ok: true, exam: { ma_de: ex.ma_de, tieu_de: ex.tieu_de, che_do: ex.che_do, khoi: ex.khoi, lop: ex.lop, trang_thai: ex.trang_thai, questions: countBank_(ex) }, students: out };
}

/* ---------- Giáo viên lớp & quản lý tài khoản ---------- */
/** Bài thi nằm trong lớp giáo viên đang đăng nhập phụ trách (quản trị: mọi bài). */
function inScope_(ex) { return !SCOPE_ || (!!ex.lop && SCOPE_.indexOf(norm_(ex.lop)) >= 0); }
function ownExam_(maDe) { var ex = exam_(maDe); if (!inScope_(ex)) throw new Error('Bài thi này không thuộc lớp thầy cô phụ trách.'); return ex; }
function lopList_(s) { return String(s || '').split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
function teachers_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GV), out = [];
  if (!sh) return out;
  var v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) { var ma = String(v[r][0] || '').trim(); if (ma) out.push({ row: r + 1, ma: ma, ten: String(v[r][1] || '').trim(), pin: String(v[r][2]).trim(), lop: lopList_(v[r][3]), trang_thai: /^khóa$/i.test(String(v[r][4] || '').trim()) ? 'Khóa' : 'Hoạt động', zalo: String(v[r][5] || '').trim() }); }
  return out;
}
function findTeacher_(ma, pin) {
  ma = norm_(ma); pin = String(pin === undefined ? '' : pin).trim();
  if (!ma || !pin) throw new Error('Nhập Mã giáo viên và Mã PIN.');
  var t = teachers_().filter(function (x) { return norm_(x.ma) === ma; })[0];
  if (!t || t.pin !== pin) throw new Error('Mã giáo viên hoặc PIN chưa đúng.');
  if (t.trang_thai === 'Khóa') throw new Error('Tài khoản giáo viên đang bị khóa.');
  return t;
}
function setTeacherPin_(ma, pin) { var t = teachers_().filter(function (x) { return norm_(x.ma) === norm_(ma); })[0]; if (!t) throw new Error('Không tìm thấy giáo viên.'); sheet_(SH_GV).getRange(t.row, 3).setValue(pin); try { publish_(['gv', 'ho_tro']); } catch (e) { /* lần sau */ } }
/** Quản lý tài khoản: giáo viên (chỉ quản trị) và học sinh (quản trị: mọi lớp; giáo viên lớp: lớp mình). */
function accounts_(a, p, me) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), CODE = /^[A-Za-z0-9_-]{2,32}$/;
  var pinOk = function (x) { x = String(x || '').trim(); if (x.length < 6 || x.length > 16) throw new Error('Mã PIN từ 6 đến 16 ký tự.'); return x; };
  var done = function (res) { try { publish_(['hs', 'gv', 'ho_tro']); } catch (e) { res.fb_error = e.message; } return res; };   // chỉ đẩy tài khoản (nhanh)
  if (/^gv_teacher/.test(a) && me) throw new Error('Chỉ quản trị viên được quản lý tài khoản giáo viên.');
  if (a === 'gv_teachers') return { ok: true, teachers: teachers_().map(function (t) { return { ma: t.ma, ten: t.ten, lop: t.lop, trang_thai: t.trang_thai }; }) };
  if (a === 'gv_teacher_save') {
    var sh = ss.getSheetByName(SH_GV) || ensure_(SH_GV, GV_HEAD), ma = String(p.ma || '').trim(), ten = String(p.ten || '').trim(), lop = lopList_(p.lop);
    if (!CODE.test(ma)) throw new Error('Mã giáo viên 2–32 ký tự, chỉ gồm chữ, số, - và _.');
    if (!ten) throw new Error('Nhập họ tên giáo viên.');
    if (!lop.length) throw new Error('Nhập ít nhất một lớp phụ trách, ví dụ 9A.');
    var t = teachers_().filter(function (x) { return norm_(x.ma) === norm_(ma); })[0];
    if (p.moi && t) throw new Error('Mã giáo viên này đã có.');
    if (!t) { sh.getRange('C:C').setNumberFormat('@'); sh.appendRow([ma, ten, pinOk(p.pin), lop.join(', '), 'Hoạt động']); }
    else { sh.getRange(t.row, 2).setValue(ten); sh.getRange(t.row, 4).setValue(lop.join(', ')); if (p.pin) sh.getRange(t.row, 3).setValue(pinOk(p.pin)); if (p.trang_thai === 'Khóa' || p.trang_thai === 'Hoạt động') sh.getRange(t.row, 5).setValue(p.trang_thai); }
    return done(accounts_('gv_teachers', p, me));
  }
  if (a === 'gv_teacher_delete') { var td = teachers_().filter(function (x) { return norm_(x.ma) === norm_(p.ma); })[0]; if (!td) throw new Error('Không tìm thấy giáo viên.'); sheet_(SH_GV).deleteRow(td.row); return done(accounts_('gv_teachers', p, me)); }
  // ----- học sinh (trang HocSinh)
  var hs = sheet_(SH_HS), hv = hs.getDataRange().getValues(), list = [];
  for (var r = 1; r < hv.length; r++) { var m = String(hv[r][3] || '').trim(); if (m) list.push({ row: r + 1, ma: m, ten: String(hv[r][1] || '').trim(), lop: String(hv[r][2] || '').trim(), trang_thai: /^khóa$/i.test(String(hv[r][5] || '').trim()) ? 'Khóa' : 'Hoạt động' }); }
  var mine = function (lop) { return !SCOPE_ || SCOPE_.indexOf(norm_(lop)) >= 0; };
  var find = function (ma) { var x = list.filter(function (y) { return norm_(y.ma) === norm_(ma); })[0]; if (x && !mine(x.lop)) throw new Error('Học sinh này không thuộc lớp thầy cô phụ trách.'); return x; };
  if (a === 'gv_students') {
    var cls = {}; list.forEach(function (x) { if (mine(x.lop)) cls[x.lop] = khoiOf_(x.lop); });
    return { ok: true, admin: !me, scope: SCOPE_, students: list.filter(function (x) { return mine(x.lop); }).map(function (x) { return { ma: x.ma, ten: x.ten, lop: x.lop, trang_thai: x.trang_thai }; }), classes: cls };
  }
  if (a === 'gv_student_save') {
    var sma = String(p.ma || '').trim(), sten = String(p.ten || '').trim(), slop = String(p.lop || '').trim();
    if (!CODE.test(sma)) throw new Error('Mã học sinh 2–32 ký tự, chỉ gồm chữ, số, - và _.');
    if (!sten) throw new Error('Nhập họ tên học sinh.');
    if (!slop || !khoiOf_(slop)) throw new Error('Lớp phải bắt đầu bằng khối, ví dụ 9A.');
    if (!mine(slop)) throw new Error('Chỉ thêm học sinh vào lớp thầy cô phụ trách.');
    var x = find(sma);
    if (p.moi && x) throw new Error('Mã học sinh này đã có.');
    if (!x) { hs.getRange('E:E').setNumberFormat('@'); hs.appendRow([list.length + 1, sten, slop, sma, pinOk(p.pin), 'Hoạt động']); }
    else { hs.getRange(x.row, 2).setValue(sten); hs.getRange(x.row, 3).setValue(slop); if (p.pin) hs.getRange(x.row, 5).setValue(pinOk(p.pin)); if (p.trang_thai === 'Khóa' || p.trang_thai === 'Hoạt động') hs.getRange(x.row, 6).setValue(p.trang_thai); }
    return done(accounts_('gv_students', p, me));
  }
  if (a === 'gv_student_delete') { var xd = find(p.ma); if (!xd) throw new Error('Không tìm thấy học sinh.'); hs.deleteRow(xd.row); return done(accounts_('gv_students', p, me)); }
  throw new Error('Yêu cầu không hợp lệ.');
}

/* ---------- Tài liệu PDF (giáo viên tải lên → Google Drive; học sinh đúng khối xem/tải) ---------- */
function docList_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TL), out = [];
  if (!sh) return out;
  var v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) { var id = String(v[r][0] || '').trim(); if (id) out.push({ row: r + 1, id: id, tieu_de: String(v[r][1] || '').trim(), khoi: Number(v[r][2]) || 0, mo_ta: String(v[r][3] || '').trim(), file_id: String(v[r][4] || '').trim(), ten_file: String(v[r][5] || '').trim(), size: Number(v[r][6]) || 0, at: v[r][7] instanceof Date ? v[r][7].toISOString() : String(v[r][7] || ''), nguoi: String(v[r][8] || '').trim() }); }
  return out;
}
/** Khối giáo viên lớp được quản lý (từ lớp phụ trách); null = quản trị. */
function scopeKhoi_() { if (!SCOPE_) return null; var k = {}; SCOPE_.forEach(function (l) { var n = khoiOf_(l); if (n) k[n] = 1; }); return Object.keys(k).map(Number); }
function docFolder_(khoi) {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('DRIVE_TL'), root = null;
  if (id) { try { root = DriveApp.getFolderById(id); } catch (e) { root = null; } }
  if (!root) { root = child_(DriveApp.getRootFolder(), 'Tài liệu - Góc học tập'); pr.setProperty('DRIVE_TL', root.getId()); }
  return child_(root, 'Khối ' + khoi);
}
function docs_(a, p, me) {
  var ks = scopeKhoi_(), mineK = function (k) { return !ks || ks.indexOf(Number(k)) >= 0; };
  var list = function () { return { ok: true, admin: !me, khoi: ks, docs: docList_().filter(function (d) { return mineK(d.khoi); }).map(function (d) { return { id: d.id, tieu_de: d.tieu_de, khoi: d.khoi, mo_ta: d.mo_ta, file_id: d.file_id, ten_file: d.ten_file, size: d.size, at: d.at, nguoi: d.nguoi }; }) }; };
  var done = function () { var res = list(); try { publish_(['tl']); } catch (e) { res.fb_error = e.message; } return res; };   // chỉ đẩy tài liệu (nhanh)
  if (a === 'gv_docs') return list();
  var sh = ensure_(SH_TL, TL_HEAD);
  if (a === 'gv_doc_delete') {
    var dd = docList_().filter(function (d) { return d.id === String(p.id || ''); })[0];
    if (!dd) throw new Error('Không tìm thấy tài liệu.');
    if (!mineK(dd.khoi)) throw new Error('Tài liệu này không thuộc khối thầy cô phụ trách.');
    if (dd.file_id) { try { DriveApp.getFileById(dd.file_id).setTrashed(true); } catch (e) { /* file đã xóa tay */ } }
    sh.deleteRow(dd.row); return done();
  }
  // gv_doc_save: thêm mới (bắt buộc file PDF) hoặc sửa (đổi tiêu đề/khối/mô tả, có thể thay file)
  var title = String(p.tieu_de || '').trim(), khoi = Number(p.khoi) || 0, moTa = String(p.mo_ta || '').trim().slice(0, 300);
  if (!title) throw new Error('Nhập tiêu đề tài liệu.');
  if ([6, 7, 8, 9].indexOf(khoi) < 0) throw new Error('Chọn khối 6, 7, 8 hoặc 9.');
  if (!mineK(khoi)) throw new Error('Chỉ đăng tài liệu cho khối thầy cô phụ trách.');
  var old = p.id ? docList_().filter(function (d) { return d.id === String(p.id); })[0] : null;
  if (p.id && !old) throw new Error('Không tìm thấy tài liệu.');
  if (old && !mineK(old.khoi)) throw new Error('Tài liệu này không thuộc khối thầy cô phụ trách.');
  var fileId = old ? old.file_id : '', name = old ? old.ten_file : '', size = old ? old.size : 0;
  if (p.data) {
    var bytes = Utilities.base64Decode(String(p.data));
    if (bytes.length > 10 * 1024 * 1024) throw new Error('File quá lớn (tối đa 10 MB).');
    if (String(p.mime || '') !== 'application/pdf' && !/\.pdf$/i.test(String(p.ten_file || ''))) throw new Error('Chỉ nhận file PDF.');
    name = safeName_(p.ten_file || (title + '.pdf')).slice(0, 120); if (!/\.pdf$/i.test(name)) name += '.pdf';
    var f = docFolder_(khoi).createFile(Utilities.newBlob(bytes, 'application/pdf', name));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);   // học sinh mở được bằng đường dẫn
    if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* bỏ qua */ } }
    fileId = f.getId(); size = bytes.length;
  } else if (!old) throw new Error('Chọn file PDF để tải lên.');
  else if (old.khoi !== khoi && fileId) { try { DriveApp.getFileById(fileId).moveTo(docFolder_(khoi)); } catch (e) { /* vẫn dùng được */ } }
  var row = [old ? old.id : 'tl' + new Date().getTime(), title, khoi, moTa, fileId, name, size, new Date(), me ? me.ten : 'Quản trị'];
  if (old) sh.getRange(old.row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return done();
}

/* ---------- Firebase: đẩy đề lên, lấy điểm về ---------- */
function fbOn_() { return !!PropertiesService.getScriptProperties().getProperty('FB_SECRET'); }
function fbKey_(ma) { return norm_(ma).replace(/[.#$\[\]\/]/g, '_'); }
function sha256_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8).map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}
/** Gọi Firebase REST bằng khóa bí mật của cơ sở dữ liệu (Script Properties: FB_SECRET, FB_URL). */
function fb_(method, path, body) {
  var pr = PropertiesService.getScriptProperties(), secret = pr.getProperty('FB_SECRET');
  if (!secret) throw new Error('Chưa cài khóa Firebase. Mở Sheet → menu Bài thi → Cài khóa Firebase.');
  var url = (pr.getProperty('FB_URL') || FB_URL_DEFAULT).replace(/\/$/, '') + '/' + path + '.json?auth=' + encodeURIComponent(secret);
  var opt = { method: method, muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined) opt.payload = JSON.stringify(body);
  var r = UrlFetchApp.fetch(url, opt), code = r.getResponseCode(), txt = r.getContentText();
  if (code >= 300) throw new Error('Firebase từ chối (' + code + '): ' + txt.slice(0, 120));
  return txt ? JSON.parse(txt) : null;
}
/**
 * Đẩy danh sách học sinh (PIN đã băm), các bài thi và đề lên Firebase trong MỘT lần gọi. Trả số bài.
 * only: chỉ đẩy một phần cho nhanh — ['hs','gv'] khi sửa tài khoản, ['tl'] khi sửa tài liệu (không tính lại đề mọi bài).
 */
function publish_(only) {
  if (!fbOn_()) return 0;
  var want = function (k) { return !only || only.indexOf(k) >= 0; }, body = {}, n = 0;
  if (want('hs')) {
    var hv = sheet_(SH_HS).getDataRange().getValues(), hs = {};
    for (var r = 1; r < hv.length; r++) {
      var ma = String(hv[r][3] || '').trim(); if (!ma || /^khóa$/i.test(String(hv[r][5] || '').trim())) continue;   // tài khoản khóa: không đẩy lên → không đăng nhập được
      var lop = String(hv[r][2] || '').trim();
      hs[fbKey_(ma)] = { ma: ma, ten: String(hv[r][1] || '').trim(), lop: lop, khoi: khoiOf_(lop), h: sha256_(norm_(ma) + ':' + String(hv[r][4]).trim()) };
    }
    body.thi_hs = hs;
  }
  if (want('bai')) {
    var bai = {}, de = {}, list = exams_();
    list.forEach(function (ex) {
      var qs = []; try { qs = questions_(ex, { lop: '' }); } catch (e) { qs = []; }
      bai[ex.ma_de] = { tieu_de: ex.tieu_de, che_do: ex.che_do, khoi: ex.khoi, lop: ex.lop, trang_thai: ex.trang_thai, so_cau: qs.length, tao_luc: ex.tao_luc, xem_diem: !!ex.xem_diem, nam_hoc: ex.nam_hoc, hinh_thuc: ex.hinh_thuc, noi_dung: ex.noi_dung };
      if (ex.noi_dung === 'tn_th' && ex.thuc_hanh) { bai[ex.ma_de].loai_th = ex.thuc_hanh.loai; bai[ex.ma_de].de_th = ex.thuc_hanh.de; bai[ex.ma_de].diem_th = ex.thuc_hanh.tieu_chi.reduce(function (a, t) { return a + t.diem; }, 0); }   // chỉ đề bài, không đẩy tiêu chí/kết quả mong đợi
      de[ex.ma_de] = qs.map(function (q) { return { id: q.id, stt: q.stt, text: q.text, options: q.options, answer: q.answer, points: q.points, topic: q.topic || '' }; });
    });
    body.thi_bai = bai; body.thi_de = de; n = list.length;
  }
  if (want('gv')) { var gvs = {}; teachers_().forEach(function (t) { if (t.trang_thai !== 'Khóa') gvs[fbKey_(t.ma)] = { ma: t.ma, ten: t.ten, lop: t.lop, h: sha256_(norm_(t.ma) + ':' + t.pin) }; }); body.thi_gv = gvs; }
  if (want('ho_tro')) {
    var ht = { zalo: cfgGet_('ho_tro_zalo'), ten: cfgGet_('ho_tro_ten'), lop: {} };
    teachers_().forEach(function (t) { if (t.trang_thai !== 'Khóa' && t.zalo) t.lop.forEach(function (l) { ht.lop[fbKey_(l)] = { zalo: t.zalo, ten: t.ten }; }); });
    body.ho_tro = ht;
  }
  if (want('tl')) { var tl = {}; docList_().forEach(function (d) { tl[d.id] = { tieu_de: d.tieu_de, khoi: d.khoi, mo_ta: d.mo_ta, file_id: d.file_id, ten_file: d.ten_file, size: d.size, at: d.at }; }); body.tai_lieu = tl; }
  fb_('patch', '', body);
  return n;
}
/** Số điện thoại Zalo (0912345678, +84 912…) hoặc đường dẫn https://zalo.me/… → đường dẫn zalo.me; rỗng = gỡ. */
function normZalo_(x) {
  x = String(x || '').trim(); if (!x) return '';
  if (/^https:\/\/zalo\.me\/[A-Za-z0-9\/_-]{3,80}$/.test(x)) return x;
  var d = x.replace(/[\s.\-()]/g, '');
  if (/^\+?84\d{9,10}$/.test(d)) d = '0' + d.replace(/^\+?84/, '');
  if (/^0\d{9,10}$/.test(d)) return 'https://zalo.me/' + d;
  throw new Error('Nhập số điện thoại Zalo (ví dụ 0912345678) hoặc đường dẫn https://zalo.me/…');
}
/** Bài đã khóa và đã chép xong (không tải lại từ Firebase mỗi lần mở menu Thi). */
function pullDone_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('PULL_DONE') || '{}'); } catch (e) { return {}; } }
function unpull_(maDe) { var d = pullDone_(); if (d[maDe]) { delete d[maDe]; PropertiesService.getScriptProperties().setProperty('PULL_DONE', JSON.stringify(d)); } }
/**
 * Chép bài nộp trên Firebase (thi_nop) về trang KetQua, mỗi lần nộp một dòng, không chép trùng.
 * Nhanh khi nhiều học sinh: chỉ tải từng bài còn mở / vừa khóa (bài đã khóa và chép xong thì bỏ qua),
 * tối đa 2 phút một lần khi mở menu Thi (force = luôn chép), có khóa chống hai người chép trùng,
 * lưu file Drive tối đa 15 bài mỗi lần (phần còn lại lần sau).
 */
function pull_(force, onlyExam) {
  if (!fbOn_()) return 0;
  var pr = PropertiesService.getScriptProperties(), now = new Date().getTime();
  if (!force && now - Number(pr.getProperty('LAST_PULL') || 0) < 120000) return 0;
  var lock = LockService.getScriptLock(), own = false;
  if (!lock.hasLock()) { if (!lock.tryLock(20000)) return 0; own = true; }
  try {
    pr.setProperty('LAST_PULL', String(now));
    var kq = ensure_(SH_KQ, KQ_HEAD), v = kq.getDataRange().getValues(), seen = {}, rows = [], done = pullDone_();
    if (String(kq.getRange(1, 12).getValue()).trim() !== 'Mã nộp') kq.getRange(1, 12).setValue('Mã nộp');
    if (String(kq.getRange(1, 13).getValue()).trim() !== 'Lưu Drive') kq.getRange(1, 13).setValue('Lưu Drive');
    for (var i = 1; i < v.length; i++) if (v[i][11]) seen[String(v[i][11])] = 1;
    var ex = {}; exams_().forEach(function (e) { ex[e.ma_de] = e; });
    Object.keys(ex).filter(function (id) { return onlyExam ? id === onlyExam : !done[id]; }).forEach(function (maDe) {
      var byHs = fb_('get', 'thi_nop/' + maDe) || {}, that = ex[maDe].che_do === 'that';
      Object.keys(byHs).forEach(function (k) {
        var n = byHs[k] || {}, id = maDe + '|' + k + '|' + (n.at || '');
        if (seen[id]) return; seen[id] = 1;
        var ans = n.tra_loi || {}, line = Object.keys(ans).map(function (q) { return q + ':' + ans[q]; }).join('  ');
        rows.push([n.at ? new Date(Number(n.at)) : new Date(), n.ma || k, n.ten || '', n.lop || '', Number(n.diem) || 0, Number(n.tong) || 0, (n.dung || 0) + '/' + (n.so_cau || 0), line, that ? 'Thi thật' : 'Thi thử', maDe, '', id, '']);
      });
      if (ex[maDe].trang_thai !== 'mo') done[maDe] = 1;   // đã khóa: học sinh không nộp thêm được (luật Firebase) → lần sau bỏ qua
    });
    if (rows.length) kq.getRange(kq.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
    pr.setProperty('PULL_DONE', JSON.stringify(done));
    archivePending_(kq, ex, 15);
    return rows.length;
  } finally { if (own) lock.releaseLock(); }
}
/** Lưu file chữ bài thi thật lên Drive cho các dòng KetQua chưa lưu (cột "Lưu Drive" trống), tối đa limit dòng. */
function archivePending_(kq, ex, limit) {
  var v = kq.getDataRange().getValues(), n = 0;
  for (var i = 1; i < v.length && n < limit; i++) {
    var r = v[i]; if (r[8] !== 'Thi thật' || r[12] || String(r[10] || '') === 'Hủy' || !ex[String(r[9])]) continue;
    var ans = {}; String(r[7] || '').split(/\s+/).forEach(function (pq) { var c = pq.lastIndexOf(':'); if (c > 0) ans[pq.slice(0, c)] = pq.slice(c + 1); });
    var dung = String(r[6] || '0/0').split('/');
    try { saveTxt_(ex[String(r[9])], { ma: r[1], ten: r[2], lop: r[3], diem: r[4], tong: r[5], dung: Number(dung[0]) || 0, so_cau: Number(dung[1]) || 0, tra_loi: ans, at: r[0] instanceof Date ? r[0].getTime() : r[0] }); kq.getRange(i + 1, 13).setValue('x'); }
    catch (e) { console.error('[DRIVE]', e.message); kq.getRange(i + 1, 13).setValue('lỗi'); }
    n++;
  }
}
/* ---------- Lưu bài thi thật trên Google Drive theo lớp ---------- */
function child_(parent, name) { var it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function safeName_(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, ' ').trim(); }
/** Thư mục của một bài thi cho một lớp: Bài thi - Góc học tập / Năm học / Lớp … / Hình thức - Tiêu đề. */
function folderFor_(ex, lop) {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('DRIVE_ROOT'), root = null;
  if (id) { try { root = DriveApp.getFolderById(id); } catch (e) { root = null; } }
  if (!root) { root = child_(DriveApp.getRootFolder(), 'Bài thi - Góc học tập'); pr.setProperty('DRIVE_ROOT', root.getId()); }
  return child_(child_(child_(root, ex.nam_hoc || namHoc_()), 'Lớp ' + (lop || 'chưa rõ')), safeName_((ex.hinh_thuc || 'Khác') + ' - ' + ex.tieu_de));
}
/** File chữ một bài làm: từng câu, các phương án, đáp án đúng, em chọn, đúng/sai, điểm. */
function saveTxt_(ex, n) {
  var qs = []; try { qs = questions_(ex, { lop: n.lop || '' }); } catch (e) { qs = []; }
  var ans = n.tra_loi || {}, lines = [
    'BÀI THI: ' + ex.tieu_de, 'Năm học: ' + (ex.nam_hoc || '') + ' · Hình thức: ' + (ex.hinh_thuc || '') + ' · Nội dung: ' + (ex.noi_dung === 'tn_th' ? 'Trắc nghiệm + Thực hành' : 'Trắc nghiệm'),
    'Học sinh: ' + (n.ten || '') + ' (' + (n.ma || '') + ') · Lớp ' + (n.lop || ''), 'Nộp lúc: ' + (n.at ? new Date(Number(n.at)).toLocaleString('vi-VN') : ''),
    'ĐIỂM: ' + n.diem + '/' + n.tong + ' · Đúng ' + (n.dung || 0) + '/' + (n.so_cau || qs.length) + ' câu', ''];
  qs.forEach(function (q, i) {
    var mine = String(ans[q.id] || '').toUpperCase(), ok = mine && mine === q.answer;
    lines.push('Câu ' + (i + 1) + ' (' + q.points + ' điểm): ' + q.text);
    Object.keys(q.options).forEach(function (L) { lines.push('   ' + L + '. ' + q.options[L]); });
    lines.push('   Đáp án đúng: ' + q.answer + ' · Em chọn: ' + (mine || '(bỏ trống)') + ' · ' + (ok ? 'ĐÚNG' : 'SAI'), '');
  });
  var f = folderFor_(ex, n.lop), name = safeName_((n.ma || '') + ' - ' + (n.ten || '')) + '.txt', it = f.getFilesByName(name);
  while (it.hasNext()) it.next().setTrashed(true);   // nộp lại sau khi giáo viên cho thi lại: giữ bản mới nhất
  f.createFile(name, lines.join('\n'), MimeType.PLAIN_TEXT);
}
/** Học sinh nộp bài thực hành (bài thi thật "Trắc nghiệm + Thực hành"): lưu file vào thư mục lớp trên Drive. */
function nopThucHanh_(hs, maDe, p) {
  var ex = exam_(maDe);
  if (!allowed_(hs, ex)) throw new Error('Bài thi này không dành cho lớp em.');
  if (ex.noi_dung !== 'tn_th') throw new Error('Bài thi này không có phần thực hành.');
  if (ex.trang_thai !== 'mo') throw new Error('Bài thi đang khóa. Báo thầy cô.');
  var name = safeName_(p.ten_file || 'thuc-hanh').slice(0, 120), data = String(p.data || '');
  if (!data) throw new Error('Chưa chọn file.');
  var bytes = Utilities.base64Decode(data);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('File quá lớn (tối đa 10 MB).');
  var f = folderFor_(ex, hs.lop), file = f.createFile(Utilities.newBlob(bytes, String(p.mime || 'application/octet-stream'), safeName_(hs.ma + ' - ' + hs.name) + ' - Thực hành - ' + name));
  // Sổ chấm thực hành: mỗi em một dòng / bài; nộp lại thì thay file và xóa điểm cũ (chấm lại).
  var sh = ensure_(SH_CTH, CTH_HEAD), v = sh.getDataRange().getValues(), row = 0;
  for (var r = 1; r < v.length; r++) if (String(v[r][0]) === maDe && norm_(v[r][1]) === norm_(hs.ma)) { row = r + 1; break; }
  var line = [maDe, hs.ma, hs.name, hs.lop, name, file.getId(), new Date(), '', '', '', '', ''];
  if (row) sh.getRange(row, 1, 1, line.length).setValues([line]); else sh.appendRow(line);
  if (fbOn_()) { try { fb_('put', 'thi_th/' + maDe + '/' + fbKey_(hs.ma), { ten_file: name, at: { '.sv': 'timestamp' } }); } catch (e) { /* đã lưu Drive */ } }
  return { ok: true, ten_file: name, id: file.getId() };
}

/** Chấm thực hành: lấy file bài làm + tiêu chí (gv_th_get), lưu điểm giáo viên đã duyệt (gv_th_save). */
function thCham_(a, p, me) {
  var ex = exam_(String(p.ma_de || '')), ma = String(p.ma || '').trim();
  var sh = ensure_(SH_CTH, CTH_HEAD), v = sh.getDataRange().getValues(), row = 0;
  for (var r = 1; r < v.length; r++) if (String(v[r][0]) === ex.ma_de && norm_(v[r][1]) === norm_(ma)) { row = r; break; }
  if (!row) throw new Error('Học sinh này chưa nộp bài thực hành.');
  var rec = v[row], th = ex.thuc_hanh || { loai: 'khac', de: '', tieu_chi: [] };
  if (a === 'gv_th_get') {
    var f = DriveApp.getFileById(String(rec[5])), blob = f.getBlob();
    if (blob.getBytes().length > 10 * 1024 * 1024) throw new Error('File quá lớn để chấm trên trình duyệt.');
    var chi = []; try { chi = JSON.parse(String(rec[8] || '[]')); } catch (e) { chi = []; }
    return { ok: true, hs: { ma: rec[1], ten: rec[2], lop: rec[3] }, file: { ten: String(rec[4]), mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) }, thuc_hanh: th,
      cham: rec[7] === '' ? null : { diem: Number(rec[7]) || 0, chi_tiet: chi, nhan_xet: String(rec[9] || '') } };
  }
  var max = th.tieu_chi.reduce(function (s, t) { return s + t.diem; }, 0);
  var items = (Array.isArray(p.chi_tiet) ? p.chi_tiet : []).slice(0, th.tieu_chi.length).map(function (it, i) { var m = th.tieu_chi[i] ? th.tieu_chi[i].diem : 0; return { diem: Math.max(0, Math.min(m, Math.round((Number(it && it.diem) || 0) * 4) / 4)), nhan_xet: String(it && it.nhan_xet || '').slice(0, 300) }; });
  var diem = items.length ? items.reduce(function (s, it) { return s + it.diem; }, 0) : Math.max(0, Math.min(max || 100, Number(p.diem) || 0));
  diem = Math.round(diem * 100) / 100;
  sh.getRange(row + 1, 8, 1, 5).setValues([[diem, JSON.stringify(items), String(p.nhan_xet || '').slice(0, 1500), new Date(), me ? me.ten : 'Quản trị']]);
  if (fbOn_()) { try { fb_('patch', 'thi_th/' + ex.ma_de + '/' + fbKey_(ma), { diem_th: diem, tong_th: max }); } catch (e) { /* đã lưu Sheet */ } }
  return { ok: true, diem: diem, tong: max };
}

/* ---------- Bộ não AI (Python chạy trên VPS của thầy cô) ---------- */
var SH_NAO = 'NaoAI', NAO_HEAD = ['Lớp', 'Cập nhật', 'Báo cáo', 'Dữ liệu'];
/** VPS gửi báo cáo từng lớp: {key, reports:[{lop, md, facts}]}. Khóa nằm trong Script Properties (menu Cài khóa Bộ não AI). */
function brainSave_(p) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('naofail') || 0);
  if (fails >= 10) throw new Error('Sai khóa quá nhiều lần. Chờ 10 phút.');
  var key = PropertiesService.getScriptProperties().getProperty('BRAIN_KEY') || '';
  if (key.length < 24 || String(p.key || '') !== key) { cache.put('naofail', String(fails + 1), 600); throw new Error('Khóa Bộ não AI chưa đúng.'); }
  var sh = ensure_(SH_NAO, NAO_HEAD), v = sh.getDataRange().getValues(), rows = {}, n = 0;
  for (var r = 1; r < v.length; r++) rows[norm_(v[r][0])] = r + 1;
  (Array.isArray(p.reports) ? p.reports : []).slice(0, 80).forEach(function (x) {
    var lop = String(x && x.lop || '').trim().slice(0, 20); if (!lop) return;
    var line = [lop, new Date(), String(x.md || '').slice(0, 20000), JSON.stringify(x.facts || {}).slice(0, 45000)];
    if (rows[norm_(lop)]) sh.getRange(rows[norm_(lop)], 1, 1, 4).setValues([line]); else { sh.appendRow(line); rows[norm_(lop)] = sh.getLastRow(); }
    n++;
  });
  cache.remove('naofail');
  return { ok: true, saved: n };
}
/** Giáo viên xem báo cáo Bộ não AI (giáo viên lớp: chỉ lớp mình). */
function brainGet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_NAO), out = [];
  if (sh) sh.getDataRange().getValues().slice(1).forEach(function (r) {
    var lop = String(r[0] || '').trim(); if (!lop || (SCOPE_ && SCOPE_.indexOf(norm_(lop)) < 0)) return;
    var facts = {}; try { facts = JSON.parse(String(r[3] || '{}')); } catch (e) { facts = {}; }
    out.push({ lop: lop, at: r[1] instanceof Date ? r[1].toISOString() : String(r[1] || ''), md: String(r[2] || ''), facts: facts });
  });
  return { ok: true, reports: out };
}
function caiKhoaNaoAI() {
  var ui = SpreadsheetApp.getUi(), key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  if (ui.alert('Cài khóa Bộ não AI', 'Tạo khóa mới cho máy chủ VPS? (Khóa cũ sẽ hết hiệu lực.)', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty('BRAIN_KEY', key);
  ui.alert('Khóa Bộ não AI', 'Chép khóa này vào tệp .env trên VPS (dòng SHEET_BRAIN_KEY=...). Không gửi khóa qua chat hay đăng lên mạng:\n\n' + key, ui.ButtonSet.OK);
}

function caiKhoaFirebase() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Cài khóa Firebase', 'Dán "Database secret" (Firebase Console → Cài đặt dự án → Service accounts → Database secrets):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var v = String(r.getResponseText() || '').trim(); if (!v) return;
  PropertiesService.getScriptProperties().setProperty('FB_SECRET', v);
  try { var n = publish_(); ui.alert('Đã kết nối Firebase và đẩy ' + n + ' bài thi + danh sách học sinh lên.'); }
  catch (e) { PropertiesService.getScriptProperties().deleteProperty('FB_SECRET'); ui.alert('Khóa chưa đúng: ' + e.message); }
}
function capNhatFirebase() { var n = publish_(); SpreadsheetApp.getUi().alert(fbOn_() ? 'Đã đẩy ' + n + ' bài thi + danh sách học sinh lên Firebase.' : 'Chưa cài khóa Firebase.'); }
function layDiemVeSheet() { var n = pull_(true); SpreadsheetApp.getUi().alert('Đã chép ' + n + ' bài nộp mới về trang KetQua.'); }

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
  ensure_(SH_GV, GV_HEAD).getRange('C:C').setNumberFormat('@');
  ensure_(SH_TL, TL_HEAD);
  schema_();
}
function datLaiMatKhau() { setConfig_('mat_khau_gv', ''); }
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bài thi').addItem('Tạo mẫu', 'taoMau').addItem('Cài khóa Firebase', 'caiKhoaFirebase').addItem('Cập nhật lên Firebase', 'capNhatFirebase').addItem('Lấy điểm về Sheet', 'layDiemVeSheet').addItem('Đặt lại mật khẩu giáo viên', 'datLaiMatKhau').addItem('Cài khóa Bộ não AI', 'caiKhoaNaoAI').addToUi();
}
