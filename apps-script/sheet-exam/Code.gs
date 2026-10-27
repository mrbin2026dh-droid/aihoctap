/**
 * BÀI THI TỪ MỘT FILE GOOGLE SHEET — bản đơn giản.
 * File Sheet có 2 trang (tự tạo bằng menu "Bài thi → Tạo mẫu"):
 *   HocSinh: Stt | Họ tên | Lớp | Mã học sinh | Mã PIN | Trạng thái
 *   DeThi:   Stt | Lớp | Đề bài | A | B | C | D | Đáp án đúng | Điểm
 * Hệ thống tự thêm trang KetQua (mỗi lần nộp một dòng) và ghi "Đã thi" vào cột Trạng thái.
 * Ứng dụng (frontend/hoc/thi.html) gọi web app này: đăng nhập → lấy đề của lớp → nộp → nhận điểm.
 * Cài: Tiện ích mở rộng → Apps Script → dán file này → Lưu → Triển khai → Ứng dụng web
 *      (Thực thi: Tôi; Ai có quyền truy cập: Bất kỳ ai) → gửi địa chỉ /exec cho Claude.
 */
var SH_HS = 'HocSinh', SH_DE = 'DeThi', SH_KQ = 'KetQua', SH_CH = 'CauHinh';
var HS_HEAD = ['Stt', 'Họ tên', 'Lớp', 'Mã học sinh', 'Mã PIN', 'Trạng thái', 'Vào thi gần nhất'];
var DE_HEAD = ['Stt', 'Lớp', 'Đề bài', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Điểm'];
var KQ_HEAD = ['Thời gian nộp', 'Mã học sinh', 'Họ tên', 'Lớp', 'Điểm', 'Tổng điểm', 'Số câu đúng', 'Bài làm', 'Hình thức'];

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
    if (p.action === 'exam') {
      var cfg = config_();
      if (cfg.khoa) throw new Error('Bài thi đang khóa. Chờ thầy cô mở thi rồi đăng nhập lại.');
      var qs = questions_(hs.lop);
      sheet_(SH_HS).getRange(hs.row, 7).setValue(new Date());
      return out_({ ok: true, mode: cfg.che_do, student: pub_(hs), questions: qs.map(function (q) { return { id: q.id, stt: q.stt, text: q.text, options: q.options, points: q.points }; }) });
    }
    if (p.action === 'submit') return out_(submit_(hs, p.answers || {}));
    throw new Error('Yêu cầu không hợp lệ.');
  } catch (err) { return out_({ ok: false, error: err.message }); }
}

/** Cài đặt thi do giáo viên chọn (trang CauHinh): che_do = thu | that, trang_thai = mo | khoa. */
function config_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_CH), c = { che_do: 'thu', trang_thai: 'khoa', mat_khau_gv: '' };
  if (sh) { var v = sh.getDataRange().getValues(); for (var r = 0; r < v.length; r++) { var k = norm_(v[r][0]); if (k in c) c[k] = String(v[r][1] === undefined ? '' : v[r][1]).trim(); } }
  c.che_do = c.che_do === 'that' ? 'that' : 'thu'; c.trang_thai = c.trang_thai === 'mo' ? 'mo' : 'khoa';
  c.khoa = c.trang_thai !== 'mo';
  return c;
}
function setConfig_(key, val) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SH_CH) || ss.insertSheet(SH_CH), v = sh.getDataRange().getValues();
  for (var r = 0; r < v.length; r++) if (norm_(v[r][0]) === key) { sh.getRange(r + 1, 2).setValue(val); return; }
  sh.appendRow([key, val]);
}

/** Việc của giáo viên: cần mật khẩu giáo viên (ô mat_khau_gv trong trang CauHinh). */
function teacher_(p) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('gvfail') || 0);
  if (fails >= 10) throw new Error('Nhập sai mật khẩu giáo viên quá nhiều lần. Chờ 10 phút rồi thử lại.');
  var cfg = config_();
  if (!cfg.mat_khau_gv || String(p.gv === undefined ? '' : p.gv).trim() !== cfg.mat_khau_gv) {
    cache.put('gvfail', String(fails + 1), 600);
    throw new Error(cfg.mat_khau_gv ? 'Mật khẩu giáo viên chưa đúng.' : 'Chưa có mật khẩu giáo viên. Mở Sheet → menu Bài thi → Tạo mẫu.');
  }
  cache.remove('gvfail');
  if (p.action === 'gv_set') {
    if (p.che_do === 'thu' || p.che_do === 'that') setConfig_('che_do', p.che_do);
    if (p.trang_thai === 'mo' || p.trang_thai === 'khoa') setConfig_('trang_thai', p.trang_thai);
  } else if (p.action === 'gv_reset') {
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var hv = sheet_(SH_HS).getDataRange().getValues(), done = false;
      for (var r = 1; r < hv.length; r++) if (norm_(hv[r][3]) === norm_(p.ma)) { sheet_(SH_HS).getRange(r + 1, 6).setValue('Chưa thi'); done = true; }
      if (!done) throw new Error('Không tìm thấy học sinh này.');
    } finally { lock.releaseLock(); }
  } else if (p.action !== 'gv_info') throw new Error('Yêu cầu không hợp lệ.');
  return teacherInfo_();
}
function teacherInfo_() {
  var cfg = config_(), hv = sheet_(SH_HS).getDataRange().getValues(), best = {}, ss = SpreadsheetApp.getActiveSpreadsheet();
  var kq = ss.getSheetByName(SH_KQ);
  if (kq) { var kv = kq.getDataRange().getValues(); for (var i = 1; i < kv.length; i++) { var m = norm_(kv[i][1]), thuc = String(kv[i][8] || '') !== 'Thi thử'; if (!best[m] || (thuc && !best[m].thuc) || (thuc === best[m].thuc)) best[m] = { score: kv[i][4], total: kv[i][5], thuc: thuc }; } }
  var students = [], counts = {}, qv = sheet_(SH_DE).getDataRange().getValues(), nq = 0;
  for (var q = 1; q < qv.length; q++) if (String(qv[q][2] || '').trim()) { nq++; var cl = String(qv[q][1] || '').trim() || '(mọi lớp)'; counts[cl] = (counts[cl] || 0) + 1; }
  for (var r = 1; r < hv.length; r++) {
    if (!String(hv[r][3] || '').trim()) continue;
    var b = best[norm_(hv[r][3])], last = hv[r][6];
    students.push({ stt: hv[r][0], name: String(hv[r][1]).trim(), lop: String(hv[r][2]).trim(), ma: String(hv[r][3]).trim(), status: String(hv[r][5] || 'Chưa thi').trim(), last: last instanceof Date ? last.toISOString() : String(last || ''), score: b ? b.score : null, total: b ? b.total : null });
  }
  return { ok: true, che_do: cfg.che_do, trang_thai: cfg.trang_thai, questions: nq, by_class: counts, students: students };
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Chưa có trang "' + name + '". Giáo viên mở menu Bài thi → Tạo mẫu.');
  return sh;
}
function norm_(s) { return String(s === null || s === undefined ? '' : s).trim().toLowerCase(); }

/** Tìm học sinh theo Mã học sinh + Mã PIN (không phân biệt hoa thường ở mã). */
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

/** Câu hỏi của lớp: dòng có cột Lớp trùng lớp của em (để trống cột Lớp = dùng cho mọi lớp). */
function questions_(lop) {
  var v = sheet_(SH_DE).getDataRange().getValues(), out = [];
  for (var r = 1; r < v.length; r++) {
    var row = v[r], text = String(row[2] || '').trim();
    if (!text) continue;
    var l = norm_(row[1]); if (l && l !== norm_(lop)) continue;
    var options = {};
    ['A', 'B', 'C', 'D'].forEach(function (k, i) { var t = String(row[3 + i] === undefined ? '' : row[3 + i]).trim(); if (t) options[k] = t; });
    out.push({ id: 'r' + (r + 1), stt: row[0] === '' ? out.length + 1 : row[0], text: text, options: options, answer: String(row[7] || '').trim().toUpperCase(), points: Number(row[8]) || 1 });
  }
  if (!out.length) throw new Error('Chưa có đề cho lớp ' + lop + '.');
  return out;
}

/** Chấm, ghi trang KetQua, đánh dấu "Đã thi". Mỗi em nộp một lần (giáo viên xóa chữ "Đã thi" để cho làm lại). */
function submit_(hs, answers) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var cfg = config_();
    if (cfg.khoa) throw new Error('Bài thi đang khóa. Báo thầy cô.');
    var thuc = cfg.che_do === 'that';
    var cur = String(sheet_(SH_HS).getRange(hs.row, 6).getValue() || '');
    if (thuc && /đã thi/i.test(cur)) throw new Error('Em đã nộp bài rồi.');
    var qs = questions_(hs.lop), score = 0, total = 0, right = 0, lines = [];
    qs.forEach(function (q) {
      var mine = String(answers[q.id] || '').trim().toUpperCase(), ok = mine !== '' && mine === q.answer;
      total += q.points; if (ok) { score += q.points; right++; }
      lines.push(q.stt + ':' + (mine || '-') + (ok ? '✓' : '✗'));
    });
    score = Math.round(score * 100) / 100; total = Math.round(total * 100) / 100;
    var kq = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KQ);
    if (!kq) { kq = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SH_KQ); kq.appendRow(KQ_HEAD); kq.setFrozenRows(1); }
    kq.appendRow([new Date(), hs.ma, hs.name, hs.lop, score, total, right + '/' + qs.length, lines.join('  '), thuc ? 'Thi thật' : 'Thi thử']);
    if (thuc) sheet_(SH_HS).getRange(hs.row, 6).setValue('Đã thi');
    return { ok: true, mode: cfg.che_do, score: score, total: total, correct: right, count: qs.length };
  } finally { lock.releaseLock(); }
}

/** Tạo 2 trang mẫu nếu chưa có (không ghi đè dữ liệu đã có). */
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
    d.appendRow([1, '9A', 'Thiết bị nào là bộ xử lý trung tâm?', 'CPU', 'RAM', 'Ổ cứng', 'Màn hình', 'A', 5]);
    d.appendRow([2, '9A', 'Phần mềm nào là bảng tính?', 'Word', 'Excel', 'PowerPoint', 'Paint', 'B', 5]);
    d.setFrozenRows(1);
  }
  taoCauHinh_();
}
function taoCauHinh_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SH_CH)) {
    var c = ss.insertSheet(SH_CH); c.appendRow(['Khóa', 'Giá trị', 'Ghi chú']);
    c.appendRow(['che_do', 'thu', 'thu = thi thử (làm nhiều lần) | that = thi thật (mỗi em một lần)']);
    c.appendRow(['trang_thai', 'khoa', 'mo = học sinh vào thi được | khoa = đang khóa']);
    c.appendRow(['mat_khau_gv', String(Math.floor(100000 + Math.random() * 900000)), 'Mật khẩu giáo viên nhập ở menu Thi của app. Đổi tùy ý.']);
    c.getRange('B:B').setNumberFormat('@'); c.setFrozenRows(1);
  }
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bài thi').addItem('Tạo mẫu', 'taoMau').addToUi();
}
