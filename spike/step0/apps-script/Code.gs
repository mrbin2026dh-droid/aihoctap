/**
 * Bước 0 – thử Apps Script: xác thực ID token Firebase, đọc/ghi Realtime Database bằng OAuth,
 * tạo thư mục + file minh chứng trên Drive, trigger chấm mỗi phút, trigger "khi sửa" tính tổng điểm.
 * Thiết lập: Project Settings → Script properties: FIREBASE_API_KEY, DB_URL (không có dấu / cuối).
 * Chỉ để đo kiểm; chưa phải mã sản phẩm.
 */
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function dbUrl_(path) { return prop_('DB_URL') + '/' + path + '.json'; }
function oauthHeaders_() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Xác thực ID token của học sinh bằng Identity Toolkit (một lần gọi). */
function verifyIdToken_(idToken) {
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + prop_('FIREBASE_API_KEY'), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var u = (JSON.parse(r.getContentText()).users || [])[0];
  return u ? { uid: u.localId, email: u.email } : null;
}

function doGet() { return json_({ ok: true, hello: 'apps-script', t: Date.now() }); }

function doPost(e) {
  var t0 = Date.now();
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    var who = verifyIdToken_(body.idToken);
    if (!who) return json_({ ok: false, error: 'idToken không hợp lệ' });
    if (body.action === 'ping') return json_({ ok: true, uid: who.uid, email: who.email, ms: Date.now() - t0 });
    if (body.action === 'grade') { var n = gradeSpike_(who.uid); return json_({ ok: true, graded: n, ms: Date.now() - t0 }); }
    return json_({ ok: false, error: 'action không hỗ trợ' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}

/** Chấm thử: đọc spike/attempts/{uid}/1, chấm theo khóa giả, ghi spike/results/{uid}. */
function gradeSpike_(onlyUid) {
  var KEY = { q1: 'A', q2: 'B', q3: 'C' };
  var r = UrlFetchApp.fetch(dbUrl_('spike/attempts'), { headers: oauthHeaders_(), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Đọc RTDB lỗi ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  var all = JSON.parse(r.getContentText()) || {}; var done = 0;
  Object.keys(all).forEach(function (uid) {
    if (onlyUid && uid !== onlyUid) return;
    var a = all[uid]['1']; if (!a) return;
    var score = 0; Object.keys(KEY).forEach(function (q) { if (a.answers && a.answers[q] === KEY[q]) score++; });
    var w = UrlFetchApp.fetch(dbUrl_('spike/results/' + uid), { method: 'put', headers: oauthHeaders_(), contentType: 'application/json',
      payload: JSON.stringify({ theory: score, of: 3, graded_at: Date.now(), status: 'cho_cham_thuc_hanh' }), muteHttpExceptions: true });
    if (w.getResponseCode() !== 200) throw new Error('Ghi RTDB lỗi ' + w.getResponseCode());
    done++;
  });
  return done;
}
/** Chạy bằng trigger mỗi phút. */
function gradeSpike() { return gradeSpike_(null); }

/** Chạy tay: kiểm tra đọc/ghi RTDB bằng OAuth của chủ script. */
function testRtdb() {
  var w = UrlFetchApp.fetch(dbUrl_('spike/results/_apps_script_test'), { method: 'put', headers: oauthHeaders_(), contentType: 'application/json', payload: JSON.stringify({ ok: true, t: Date.now() }), muteHttpExceptions: true });
  Logger.log('Ghi: ' + w.getResponseCode() + ' ' + w.getContentText().slice(0, 100));
  var r = UrlFetchApp.fetch(dbUrl_('spike/results/_apps_script_test'), { headers: oauthHeaders_(), muteHttpExceptions: true });
  Logger.log('Đọc: ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 100));
}

/** Chạy tay: tạo Bai thi/9A/Nguyen Van A - hs01/minh-chung.txt rồi ghi đè; đo thời gian. */
function testDrive() {
  var t0 = Date.now();
  function sub_(parent, name) { var it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
  var folder = sub_(sub_(sub_(DriveApp.getRootFolder(), 'Bai thi (thu)'), '9A'), 'Nguyen Van A - hs01');
  var files = folder.getFilesByName('minh-chung.txt');
  var text = 'MINH CHỨNG BÀI THI (THỬ)\nCâu 1: ...\nHọc sinh chọn: A\nĐáp án đúng: A\nĐúng\n';
  var f = files.hasNext() ? files.next().setContent(text) : folder.createFile('minh-chung.txt', text, MimeType.PLAIN_TEXT);
  f.setContent(text + '\nĐiểm thực hành: 5\nTổng: 8\n');
  Logger.log('Drive OK sau ' + (Date.now() - t0) + ' ms: ' + f.getUrl());
}

/** Chạy tay một lần: tạo sổ điểm thử và hai trigger. */
function installTriggers() {
  var ss = SpreadsheetApp.create('So diem thu - Buoc 0');
  ss.getActiveSheet().setName('So diem').appendRow(['uid', 'Họ tên', 'Điểm lý thuyết', 'Điểm thực hành (GV nhập)', 'Tổng']);
  ss.getActiveSheet().appendRow(['hs01', 'Nguyễn Văn A', 3, '', '']);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('gradeSpike').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('onGradebookEdit').forSpreadsheet(ss).onEdit().create();
  Logger.log('Sổ điểm thử: ' + ss.getUrl());
}
/** Trigger "khi sửa" (cài đặt sẵn): khi GV nhập điểm thực hành (cột D) thì tính tổng (cột E). */
function onGradebookEdit(e) {
  var s = e.range.getSheet(); if (e.range.getColumn() !== 4 || e.range.getRow() < 2) return;
  var row = e.range.getRow(); var v = s.getRange(row, 3, 1, 2).getValues()[0];
  var total = Number(v[0]) + Number(v[1]); s.getRange(row, 5).setValue(total);
  PropertiesService.getScriptProperties().setProperty('LAST_EDIT_AT', String(Date.now()));
}
/** Chạy tay sau khi sửa ô D2 trong Sheet: xem độ trễ trigger. */
function showLastEdit() { Logger.log('Lần sửa gần nhất: ' + new Date(Number(prop_('LAST_EDIT_AT') || 0))); }
