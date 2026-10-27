/**
 * BÀI THI TỪ MỘT FILE GOOGLE SHEET — bản đơn giản, không cần Worker/Firebase.
 * Các trang (tự tạo bằng menu "Bài thi → Tạo mẫu"):
 *   HocSinh : Stt | Họ tên | Lớp | Mã học sinh | Mã PIN | Trạng thái | Vào thi gần nhất
 *   DeThi   : Stt | Khối | Đề bài | A | B | C | D | Đáp án đúng | Điểm      (đề THI THẬT; Khối: 9 hoặc 9A đều hiểu là khối 9; để trống = mọi khối)
 *   DeThiThu: như DeThi — giáo viên tải từ file Excel trong app (đề THI THỬ)
 *   CauHinh : bài thi đang dùng (giáo viên tạo/mở/khóa trong app, không cần sửa tay)
 *   KetQua  : mỗi lần nộp một dòng
 * Trạng thái học sinh: Chưa vào / Đã vào (đã đăng nhập vào phòng thi) / Đã nộp — tính từ cột "Vào thi gần nhất" và trang KetQua.
 * Cài: Apps Script → dán file này → Lưu → Triển khai → Ứng dụng web (Thực thi: Tôi; Truy cập: Bất kỳ ai).
 */
var SH_HS = 'HocSinh', SH_DE = 'DeThi', SH_DT = 'DeThiThu', SH_KQ = 'KetQua', SH_CH = 'CauHinh';
var HS_HEAD = ['Stt', 'Họ tên', 'Lớp', 'Mã học sinh', 'Mã PIN', 'Trạng thái', 'Vào thi gần nhất'];
var DE_HEAD = ['Stt', 'Khối', 'Đề bài', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Điểm'];
var KQ_HEAD = ['Thời gian nộp', 'Mã học sinh', 'Họ tên', 'Lớp', 'Điểm', 'Tổng điểm', 'Số câu đúng', 'Bài làm', 'Hình thức', 'Mã bài thi', 'Hủy'];
var CH_KEYS = ['ma_de', 'tieu_de', 'che_do', 'khoi', 'lop', 'trang_thai', 'bat_dau', 'mat_khau_gv'];

function doGet(e) { return route_((e && e.parameter) || {}); }
function doPost(e) {
  var p = {}; try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { /* bỏ qua */ }
  return route_(p);
}
function route_(p) {
  try {
    if (p.action === 'ping') return out_({ ok: true });
    if (/^gv_/.test(String(p.action || ''))) return out_(teacher_(p));
    var hs = findStudent_(p.ma, p.pin);
    if (p.action === 'login') return out_({ ok: true, student: pub_(hs) });
    if (p.action === 'exam') return out_(enter_(hs));
    if (p.action === 'submit') return out_(submit_(hs, p.answers || {}));
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
function pub_(hs) { return { name: hs.name, lop: hs.lop, ma: hs.ma, status: hs.status || 'Chưa thi', done: /đã thi/i.test(hs.status) }; }

/* ---------- Cài đặt bài thi đang dùng ---------- */
function config_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_CH), c = {};
  CH_KEYS.forEach(function (k) { c[k] = ''; });
  if (sh) { var v = sh.getDataRange().getValues(); for (var r = 0; r < v.length; r++) { var k = norm_(v[r][0]); if (k in c) c[k] = String(v[r][1] === undefined ? '' : v[r][1]).trim(); } }
  c.che_do = c.che_do === 'that' ? 'that' : 'thu'; c.trang_thai = c.trang_thai === 'mo' ? 'mo' : 'khoa'; c.khoi = Number(c.khoi) || 0;
  return c;
}
function setConfig_(key, val) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH_CH) || ss.insertSheet(SH_CH);
  if (!sh.getLastRow()) sh.appendRow(['Khóa', 'Giá trị']);
  var v = sh.getDataRange().getValues();
  for (var r = 0; r < v.length; r++) if (norm_(v[r][0]) === key) { sh.getRange(r + 1, 2).setValue(val); return; }
  sh.appendRow([key, val]);
}
/** Học sinh có thuộc đối tượng của bài thi không (chọn lớp 9A → chỉ 9A; chọn khối 9 → mọi lớp 9). */
function allowed_(hs, cfg) {
  if (cfg.lop) return norm_(hs.lop) === norm_(cfg.lop);
  if (cfg.khoi) return khoiOf_(hs.lop) === cfg.khoi;
  return true;
}
function who_(cfg) { return cfg.lop ? 'lớp ' + cfg.lop : (cfg.khoi ? 'khối ' + cfg.khoi : 'mọi lớp'); }

/** Câu hỏi của bài thi hiện tại: thi thật lấy trang DeThi, thi thử lấy trang DeThiThu; lọc theo khối. */
function questions_(cfg, hs) {
  var khoi = cfg.khoi || khoiOf_(hs.lop);
  var v = sheet_(cfg.che_do === 'that' ? SH_DE : SH_DT).getDataRange().getValues(), out = [];
  for (var r = 1; r < v.length; r++) {
    var row = v[r], text = String(row[2] || '').trim();
    if (!text) continue;
    var k = khoiOf_(row[1]); if (k && khoi && k !== khoi) continue;
    var options = {};
    ['A', 'B', 'C', 'D'].forEach(function (L, i) { var t = String(row[3 + i] === undefined ? '' : row[3 + i]).trim(); if (t) options[L] = t; });
    out.push({ id: 'r' + (r + 1), stt: row[0] === '' ? out.length + 1 : row[0], text: text, options: options, answer: String(row[7] || '').trim().toUpperCase(), points: Number(row[8]) || 1 });
  }
  if (!out.length) throw new Error('Chưa có câu hỏi cho khối ' + khoi + '.');
  return out;
}
function countBank_(sheetName, khoi) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName), n = 0;
  if (!sh) return 0;
  var v = sh.getDataRange().getValues();
  for (var r = 1; r < v.length; r++) { if (!String(v[r][2] || '').trim()) continue; var k = khoiOf_(v[r][1]); if (!k || !khoi || k === khoi) n++; }
  return n;
}

/* ---------- Học sinh vào phòng thi ---------- */
function submittedRow_(ma, maDe) {
  var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
  if (!kq || !maDe) return null;
  var v = kq.getDataRange().getValues(), found = null;
  for (var i = 1; i < v.length; i++) if (norm_(v[i][1]) === norm_(ma) && String(v[i][9]) === maDe && String(v[i][10] || '') !== 'Hủy') found = v[i];
  return found;
}
function enter_(hs) {
  var cfg = config_();
  if (!cfg.ma_de) throw new Error('Chưa có bài thi. Chờ thầy cô tạo bài thi.');
  if (!allowed_(hs, cfg)) throw new Error('Bài thi "' + cfg.tieu_de + '" chỉ dành cho ' + who_(cfg) + '.');
  sheet_(SH_HS).getRange(hs.row, 7).setValue(new Date());           // ghi nhận học sinh đã vào phòng thi
  var base = { ok: true, mode: cfg.che_do, title: cfg.tieu_de, student: pub_(hs) };
  if (cfg.trang_thai !== 'mo') { base.waiting = true; base.questions = []; return base; }
  var done = cfg.che_do === 'that' && !!submittedRow_(hs.ma, cfg.ma_de); base.student.done = done;
  base.questions = done ? [] : questions_(cfg, hs).map(function (q) { return { id: q.id, stt: q.stt, text: q.text, options: q.options, points: q.points }; });
  return base;
}
/** Chấm, ghi KetQua. Thi thật: mỗi em một lần; thi thử: làm nhiều lần. */
function submit_(hs, answers) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var cfg = config_();
    if (!cfg.ma_de || cfg.trang_thai !== 'mo') throw new Error('Bài thi đang khóa. Báo thầy cô.');
    if (!allowed_(hs, cfg)) throw new Error('Bài thi này không dành cho lớp em.');
    var thuc = cfg.che_do === 'that';
    if (thuc && submittedRow_(hs.ma, cfg.ma_de)) throw new Error('Em đã nộp bài rồi.');
    var qs = questions_(cfg, hs), score = 0, total = 0, right = 0, lines = [];
    qs.forEach(function (q) {
      var mine = String(answers[q.id] || '').trim().toUpperCase(), ok = mine !== '' && mine === q.answer;
      total += q.points; if (ok) { score += q.points; right++; }
      lines.push(q.stt + ':' + (mine || '-') + (ok ? '✓' : '✗'));
    });
    score = Math.round(score * 100) / 100; total = Math.round(total * 100) / 100;
    var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
    if (!kq) { kq = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SH_KQ); kq.appendRow(KQ_HEAD); kq.setFrozenRows(1); }
    kq.appendRow([new Date(), hs.ma, hs.name, hs.lop, score, total, right + '/' + qs.length, lines.join('  '), thuc ? 'Thi thật' : 'Thi thử', cfg.ma_de, '']);
    if (thuc) sheet_(SH_HS).getRange(hs.row, 6).setValue('Đã thi');
    return { ok: true, mode: cfg.che_do, score: score, total: total, correct: right, count: qs.length };
  } finally { lock.releaseLock(); }
}

/* ---------- Giáo viên ---------- */
/**
 * Mật khẩu giáo viên = chính PIN giáo viên đăng nhập app (app tự gửi, không hỏi lại).
 * Lần đầu (ô mat_khau_gv trong CauHinh còn trống) hệ thống ghi nhớ PIN đó. Đổi PIN giáo viên: xóa ô này (menu Bài thi → Đặt lại mật khẩu giáo viên).
 */
function teacher_(p) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('gvfail') || 0);
  if (fails >= 10) throw new Error('Nhập sai quá nhiều lần. Chờ 10 phút rồi thử lại.');
  var cfg = config_(), sent = String(p.gv === undefined ? '' : p.gv).trim();
  if (!sent) throw new Error('Đăng xuất rồi đăng nhập lại tài khoản giáo viên để dùng menu Thi.');
  if (!cfg.mat_khau_gv) setConfig_('mat_khau_gv', sent);
  else if (sent !== cfg.mat_khau_gv) { cache.put('gvfail', String(fails + 1), 600); throw new Error('PIN giáo viên chưa khớp với Google Sheet. Mở Sheet → menu Bài thi → Đặt lại mật khẩu giáo viên.'); }
  cache.remove('gvfail');
  if (p.action === 'gv_create') create_(p);
  else if (p.action === 'gv_set') { if (p.trang_thai === 'mo' || p.trang_thai === 'khoa') setConfig_('trang_thai', p.trang_thai); }
  else if (p.action === 'gv_reset') reset_(p.ma);
  else if (p.action === 'gv_repin') { var np = String(p.new_gv || '').trim(); if (np.length < 6) throw new Error('PIN mới quá ngắn.'); setConfig_('mat_khau_gv', np); return { ok: true }; }
  else if (p.action !== 'gv_info') throw new Error('Yêu cầu không hợp lệ.');
  return info_();
}
function create_(p) {
  var che = p.che_do === 'that' ? 'that' : 'thu', khoi = Number(p.khoi) || 0, lop = String(p.lop || '').trim(), title = String(p.tieu_de || '').trim();
  if (!title) throw new Error('Nhập tiêu đề bài thi.');
  if (!khoi) throw new Error('Chọn khối.');
  if (che === 'that') {
    if (!countBank_(SH_DE, khoi)) throw new Error('Trang DeThi trong Google Sheet chưa có câu cho khối ' + khoi + '.');
  } else {
    var qs = p.questions || [];
    if (!qs.length) throw new Error('Tải file Excel đề thi thử lên trước.');
    var ss = SpreadsheetApp.getActiveSpreadsheet(), d = ss.getSheetByName(SH_DT) || ss.insertSheet(SH_DT);
    d.clear(); d.appendRow(DE_HEAD);
    qs.forEach(function (q, i) { var o = q.options || {}; d.appendRow([i + 1, khoi, String(q.text || ''), o.A || '', o.B || '', o.C || '', o.D || '', String(q.answer || '').toUpperCase(), Number(q.points) || 1]); });
    d.setFrozenRows(1);
  }
  setConfig_('ma_de', String(new Date().getTime())); setConfig_('tieu_de', title); setConfig_('che_do', che);
  setConfig_('khoi', khoi); setConfig_('lop', lop); setConfig_('trang_thai', 'khoa'); setConfig_('bat_dau', new Date().toISOString());
}
function reset_(ma) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var cfg = config_(), hv = sheet_(SH_HS).getDataRange().getValues(), done = false;
    for (var r = 1; r < hv.length; r++) if (norm_(hv[r][3]) === norm_(ma)) { sheet_(SH_HS).getRange(r + 1, 6).setValue('Chưa thi'); done = true; }
    if (!done) throw new Error('Không tìm thấy học sinh này.');
    var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
    if (kq) { var kv = kq.getDataRange().getValues(); for (var i = 1; i < kv.length; i++) if (norm_(kv[i][1]) === norm_(ma) && String(kv[i][9]) === cfg.ma_de) kq.getRange(i + 1, 11).setValue('Hủy'); }
  } finally { lock.releaseLock(); }
}
function info_() {
  var cfg = config_(), hv = sheet_(SH_HS).getDataRange().getValues(), kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
  var sub = {};
  if (kq && cfg.ma_de) { var kv = kq.getDataRange().getValues(); for (var i = 1; i < kv.length; i++) if (String(kv[i][9]) === cfg.ma_de && String(kv[i][10] || '') !== 'Hủy') sub[norm_(kv[i][1])] = { score: kv[i][4], total: kv[i][5] }; }
  var start = cfg.bat_dau ? new Date(cfg.bat_dau).getTime() : 0, students = [], classes = {};
  for (var r = 1; r < hv.length; r++) {
    var ma = String(hv[r][3] || '').trim(); if (!ma) continue;
    var hs = { lop: String(hv[r][2]).trim() }; classes[hs.lop] = khoiOf_(hs.lop);
    var inScope = cfg.ma_de ? allowed_(hs, cfg) : false, last = hv[r][6], lastMs = last instanceof Date ? last.getTime() : (last ? new Date(last).getTime() : 0), s = sub[norm_(ma)];
    students.push({ name: String(hv[r][1]).trim(), lop: hs.lop, ma: ma, in_scope: inScope, state: s ? 'nop' : (lastMs && lastMs >= start ? 'vao' : 'chua'), last: lastMs ? new Date(lastMs).toISOString() : '', score: s ? s.score : null, total: s ? s.total : null });
  }
  var bank = {}; [6, 7, 8, 9].forEach(function (k) { bank[k] = countBank_(SH_DE, k); });
  var nq = 0; if (cfg.ma_de) nq = countBank_(cfg.che_do === 'that' ? SH_DE : SH_DT, cfg.khoi);
  return { ok: true, exam: cfg.ma_de ? { ma_de: cfg.ma_de, tieu_de: cfg.tieu_de, che_do: cfg.che_do, khoi: cfg.khoi, lop: cfg.lop, trang_thai: cfg.trang_thai, questions: nq } : null, bank: bank, classes: classes, students: students };
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
  if (!ss.getSheetByName(SH_DT)) { var t = ss.insertSheet(SH_DT); t.appendRow(DE_HEAD); t.setFrozenRows(1); }
  if (!ss.getSheetByName(SH_CH)) { var c = ss.insertSheet(SH_CH); c.appendRow(['Khóa', 'Giá trị']); c.getRange('B:B').setNumberFormat('@'); c.setFrozenRows(1); }
  CH_KEYS.forEach(function (k) { var sh = ss.getSheetByName(SH_CH), v = sh.getDataRange().getValues(), has = false; for (var r = 0; r < v.length; r++) if (norm_(v[r][0]) === k) has = true; if (!has) sh.appendRow([k, '']); });
  var hs = ss.getSheetByName(SH_HS); if (!String(hs.getRange(1, 7).getValue()).trim()) hs.getRange(1, 7).setValue('Vào thi gần nhất');
}
function datLaiMatKhau() { setConfig_('mat_khau_gv', ''); }
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bài thi').addItem('Tạo mẫu', 'taoMau').addItem('Đặt lại mật khẩu giáo viên', 'datLaiMatKhau').addToUi();
}
