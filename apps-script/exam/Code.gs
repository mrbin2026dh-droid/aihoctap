/**
 * ============================================================================
 * CỔNG 3 — APPS SCRIPT ĐƯỜNG THI FIREBASE: chấm trắc nghiệm, tự nộp từ nháp, minh chứng Drive, sổ điểm Sheet,
 * phát hành đề, nhận file thực hành.
 * Dự án: AI Học Tập SGK (aihoctap). Luật RTDB: spike/step0/database.rules.v2.json
 * ============================================================================
 * Script properties (Project Settings → Script properties):
 *   FIREBASE_API_KEY   khóa API web Firebase (công khai, dùng để xác minh ID token qua accounts:lookup)
 *   DB_URL             https://<project>-default-rtdb.<region>.firebasedatabase.app
 *   DRIVE_ROOT_ID      (tùy chọn) ID thư mục Drive gốc; trống thì tự tạo "Bai thi Tin hoc"
 *   GRADEBOOK_ID       (tùy chọn) ID Google Sheet sổ điểm; trống thì tự tạo "So diem bai thi"
 * Cài đặt một lần: chạy setup() trong trình soạn thảo (tạo trigger mỗi phút + trigger sửa sổ điểm).
 * Triển khai: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 * Dán URL /exec vào FB_CONFIG.appsScriptUrl trong frontend/hoc/fb.js.
 *
 * Nguyên tắc bảo mật:
 *  - Mọi yêu cầu từ trình duyệt phải có Firebase ID token; uid lấy từ token đã xác minh, KHÔNG lấy từ body.
 *  - Trước closes_at chỉ trả điểm tổng; đáp án và đúng/sai từng câu chỉ ghi vào results SAU khi đóng đề.
 *  - Thư mục Drive và minh chứng không chia sẻ cho học sinh.
 */

var GRACE_MS = 30 * 1000;             // ân hạn nộp (khớp luật RTDB)
var FINALIZE_AFTER_MS = 2 * 60 * 1000; // chờ 2 phút sau giờ đóng rồi mới tự nộp từ nháp + chốt điểm
var UPLOAD_AFTER_CLOSE_MS = 10 * 60 * 1000; // cho nộp file thực hành tối đa 10 phút sau giờ đóng
var MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
var ALLOWED_EXT = { xlsx: 1, pptx: 1, docx: 1, pdf: 1 }; // .sb3 chờ người dùng xác nhận
var RUN_BUDGET_MS = 4.5 * 60 * 1000;   // Apps Script dừng cứng ở 6 phút

// ---------------------------------------------------------------------------- tiện ích
function P_(k) { var v = PropertiesService.getScriptProperties().getProperty(k); return v ? String(v).trim() : ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function db_(path, method, body) {
  // Ưu tiên OAuth chủ dự án (scope firebase.database). DB_SECRET (database secret kiểu cũ) chỉ là phương án dự phòng:
  // quyền toàn bộ CSDL — chỉ để trong Script properties, không bao giờ commit, đổi ngay nếu lộ.
  var secret = P_('DB_SECRET') || P_('FIREBASE_DB_SECRET');
  var url = P_('DB_URL').replace(/\/$/, '') + '/' + path + '.json' + (secret ? '?auth=' + encodeURIComponent(secret) : '');
  var opt = { method: method || 'get', muteHttpExceptions: true, contentType: 'application/json' };
  if (!secret) opt.headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  if (body !== undefined) opt.payload = JSON.stringify(body);
  var r = UrlFetchApp.fetch(url, opt);
  if (r.getResponseCode() >= 300) throw new Error('RTDB ' + (method || 'get') + ' ' + path + ' → ' + r.getResponseCode() + ' ' + r.getContentText());
  return JSON.parse(r.getContentText() || 'null');
}
function verifyUid_(idToken) {
  if (!idToken) throw new Error('Thiếu ID token.');
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + P_('FIREBASE_API_KEY'), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  var u = (JSON.parse(r.getContentText() || '{}').users || [])[0];
  if (r.getResponseCode() !== 200 || !u) throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  return u.localId;
}
function cached_(key, loader) {
  var c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit) return JSON.parse(hit);
  var v = loader(); try { c.put(key, JSON.stringify(v), 300); } catch (e) { /* quá 100KB thì bỏ qua cache */ }
  return v;
}
function safeName_(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'khong-ten'; }
function fmt_(ms) { return ms ? Utilities.formatDate(new Date(ms), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss') : '—'; }
function round2_(x) { return Math.round(x * 100) / 100; }

// ---------------------------------------------------------------------------- chấm
/** Câu hỏi đã sắp xếp + đáp án. */
function examPack_(examId) {
  return cached_('pack:' + examId, function () {
    var qs = db_('exam_questions/' + examId) || {}, key = db_('exam_secrets/' + examId) || {};
    var list = Object.keys(qs).map(function (id) { var q = qs[id]; q.id = id; return q; })
      .sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0) || (a.id < b.id ? -1 : 1); });
    return { questions: list, key: key };
  });
}
/** Chấm một bài: trả về điểm và chi tiết (chi tiết chỉ được ghi ra sau giờ đóng). */
function grade_(examId, answers) {
  var pack = examPack_(examId), earned = 0, total = 0, correct = 0, choice = 0, review = 0, rows = [];
  pack.questions.forEach(function (q, i) {
    var pts = Number(q.points) || 1, mine = String((answers || {})[q.id] || '').trim(), right = String(pack.key[q.id] || '');
    total += pts;
    if (q.kind === 'text') { review++; rows.push({ n: i + 1, id: q.id, kind: 'text', mine: mine, right: right, ok: null, pts: 0, max: pts }); return; }
    choice++;
    var ok = mine !== '' && mine === right; if (ok) { earned += pts; correct++; }
    rows.push({ n: i + 1, id: q.id, kind: 'choice', mine: mine, right: right, ok: ok, pts: ok ? pts : 0, max: pts });
  });
  return { earned: round2_(earned), total: round2_(total), correct: correct, choice: choice, review: review, rows: rows };
}
function scoreOf10_(earned, total) { return total ? round2_(earned / total * 10) : 0; }

/** Học sinh bấm Nộp → chấm ngay, ghi điểm lý thuyết, KHÔNG trả đúng/sai từng câu. */
function gradeMyAttempt_(uid, examId, attemptNo) {
  var n = String(attemptNo || '1'); if (n !== '1' && n !== '2') throw new Error('Lượt không hợp lệ.');
  var att = db_('attempts/' + examId + '/' + uid + '/' + n);
  if (!att) throw new Error('Chưa thấy bài nộp.');
  var g = grade_(examId, att.answers);
  var prev = db_('results/' + examId + '/' + uid) || {};
  var best = Math.max(Number(prev.theory_score) || 0, g.earned);
  db_('results/' + examId + '/' + uid, 'patch', {
    theory_score: best, theory_max: g.total, attempt: n, status: g.review ? 'needs_review' : (prev.practice_score != null ? 'graded' : 'theory_graded'),
    total_score: round2_(best + (Number(prev.practice_score) || 0)), graded_at: { '.sv': 'timestamp' }
  });
  return { ok: true, score: scoreOf10_(g.earned, g.total), earned: g.earned, total_points: g.total, correct: g.correct, total: g.choice, needs_review: g.review };
}

// ---------------------------------------------------------------------------- phát hành đề
/**
 * exam = {id,title,grade,minutes,opens_at,closes_at,max_attempts,kind,parts?,questions:[{id,kind,prompt,options,points,topic?,hint?,answer}]}
 * Ghi exam_meta (công khai), exam_questions (không có đáp án), exam_secrets (chỉ Apps Script đọc).
 */
function publishExam_(exam) {
  var id = String(exam.id || '').trim();
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(id)) throw new Error('Mã đề chỉ gồm chữ không dấu, số, _ hoặc -, 2–64 ký tự.');
  var grade = Number(exam.grade), minutes = Number(exam.minutes), opens = Number(exam.opens_at), closes = Number(exam.closes_at);
  if (!(grade >= 6 && grade <= 9)) throw new Error('Khối phải là 6–9.');
  if (!(minutes >= 5 && minutes <= 180)) throw new Error('Số phút phải từ 5 đến 180.');
  if (!(closes > opens)) throw new Error('Giờ đóng phải sau giờ mở.');
  var qs = exam.questions || []; if (!qs.length) throw new Error('Đề chưa có câu hỏi.');
  var outQ = {}, key = {}, total = 0;
  qs.forEach(function (q, i) {
    var qid = String(q.id || ('q' + (i + 1))).replace(/[^A-Za-z0-9_-]/g, '');
    if (outQ[qid]) throw new Error('Trùng mã câu ' + qid);
    var kind = q.kind === 'text' ? 'text' : 'choice', pts = Number(q.points) || 1;
    if (kind === 'choice') {
      var opts = q.options || {}; var ans = String(q.answer || '').trim().toUpperCase();
      if (!opts[ans]) throw new Error('Câu ' + (i + 1) + ': đáp án "' + ans + '" không có trong các phương án.');
      key[qid] = ans;
    } else if (q.answer) key[qid] = String(q.answer);
    outQ[qid] = { order: i + 1, kind: kind, prompt: String(q.prompt || ''), points: pts };
    if (kind === 'choice') outQ[qid].options = q.options;
    if (q.topic) outQ[qid].topic = String(q.topic);
    if (q.hint) outQ[qid].hint = String(q.hint);
    total += pts;
  });
  var parts = Array.isArray(exam.parts) && exam.parts.length ? exam.parts : [{ key: 'theory', label: 'Trắc nghiệm', max: total, grader: 'auto' }];
  db_('exam_questions/' + id, 'put', outQ);
  db_('exam_secrets/' + id, 'put', key);
  db_('exam_meta/' + id, 'put', {
    title: String(exam.title || id), grade: grade, minutes: minutes, opens_at: opens, closes_at: closes,
    max_attempts: Math.max(1, Math.min(2, Number(exam.max_attempts) || 1)), kind: String(exam.kind || 'period'),
    question_count: qs.length, total_points: round2_(total), parts: parts, backend: 'firebase', published_at: { '.sv': 'timestamp' }
  });
  CacheService.getScriptCache().remove('pack:' + id);
  return { ok: true, exam_id: id, question_count: qs.length, total_points: round2_(total) };
}

/**
 * Phát hành từ tab Sheet đang mở. Mẫu tab (tên tùy ý):
 *  Hàng 1–8 (cột A nhãn, cột B giá trị): Mã đề | Tiêu đề | Khối | Số phút | Mở lúc (ngày giờ) | Đóng lúc | Số lượt (1/2) | Điểm thực hành tối đa (0 nếu không có)
 *  Hàng 10: tiêu đề cột câu hỏi: Mã câu | Loại (choice/text) | Câu hỏi | A | B | C | D | Đáp án | Điểm | Chủ đề
 *  Hàng 11+: mỗi hàng một câu.
 */
function publishExamFromSheet() {
  var sh = SpreadsheetApp.getActiveSheet(), v = sh.getDataRange().getValues(), ui = SpreadsheetApp.getUi();
  var cell = function (r) { return v[r] ? v[r][1] : ''; };
  var toMs = function (x) { return x instanceof Date ? x.getTime() : new Date(x).getTime(); };
  var practiceMax = Number(cell(7)) || 0;
  var qs = [];
  for (var r = 10; r < v.length; r++) {
    var row = v[r]; if (!String(row[2] || '').trim()) continue;
    var opts = {}; ['A', 'B', 'C', 'D'].forEach(function (k, i) { var t = String(row[3 + i] || '').trim(); if (t) opts[k] = t; });
    qs.push({ id: String(row[0] || '').trim() || ('q' + (qs.length + 1)), kind: String(row[1]).trim() === 'text' ? 'text' : 'choice', prompt: String(row[2]), options: opts, answer: String(row[7] || ''), points: Number(row[8]) || 1, topic: String(row[9] || '') });
  }
  var theoryMax = qs.reduce(function (s, q) { return s + (Number(q.points) || 1); }, 0);
  var parts = [{ key: 'theory', label: 'Trắc nghiệm', max: theoryMax, grader: 'auto' }];
  if (practiceMax > 0) parts.push({ key: 'practice', label: 'Thực hành', max: practiceMax, grader: 'teacher' });
  try {
    var res = publishExam_({ id: cell(0), title: cell(1), grade: cell(2), minutes: cell(3), opens_at: toMs(cell(4)), closes_at: toMs(cell(5)), max_attempts: cell(6), parts: parts, questions: qs });
    ui.alert('Đã phát hành đề ' + res.exam_id + ': ' + res.question_count + ' câu, ' + res.total_points + ' điểm trắc nghiệm' + (practiceMax ? ' + ' + practiceMax + ' điểm thực hành.' : '.'));
  } catch (err) { ui.alert('Chưa phát hành được: ' + err.message); }
}

// ---------------------------------------------------------------------------- Drive
function rootFolder_() {
  var id = P_('DRIVE_ROOT_ID');
  if (id) return DriveApp.getFolderById(id);
  var f = DriveApp.createFolder('Bai thi Tin hoc'); PropertiesService.getScriptProperties().setProperty('DRIVE_ROOT_ID', f.getId()); return f;
}
function sub_(parent, name) { var it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
/** Thư mục học sinh: Bai thi Tin hoc / {Lớp} / {Họ tên} - {Mã} — tên lấy từ students/{uid}, không tin dữ liệu client. */
function studentFolder_(uid) {
  var s = db_('students/' + uid) || {};
  return sub_(sub_(rootFolder_(), safeName_(s.class_code || 'Chua-xep-lop')), safeName_((s.name || 'Hoc sinh') + ' - ' + (s.student_id || uid)));
}
function upsertText_(folder, name, text) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) { var f = it.next(); f.setContent(text); return f; } // giữ ID, Drive tự lưu lịch sử phiên bản
  return folder.createFile(name, text, MimeType.PLAIN_TEXT);
}

/** Nhận file thực hành (base64) — chỉ học sinh có phiên của đề, trong giờ thi + 10 phút. */
function uploadPractice_(uid, body) {
  var examId = String(body.exam_id || ''), meta = db_('exam_meta/' + examId);
  if (!meta) throw new Error('Không tìm thấy đề.');
  if (!db_('sessions/' + examId + '/' + uid)) throw new Error('Em chưa vào bài thi này.');
  if (Date.now() > Number(meta.closes_at) + UPLOAD_AFTER_CLOSE_MS) throw new Error('Đã hết giờ nộp file.');
  var name = safeName_(body.name), ext = (name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT[ext]) throw new Error('Chỉ nhận file .xlsx, .pptx, .docx, .pdf.');
  var bytes = Utilities.base64Decode(String(body.b64 || ''));
  if (!bytes.length) throw new Error('File rỗng.');
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error('File lớn hơn 10 MB.');
  // KHÔNG BAO GIỜ báo "đã nộp" khi chưa lưu được file: lỗi Drive → trả ok:false để học sinh giữ file và thử lại.
  var folder, file, finalName = safeName_('thuc-hanh_' + examId + '.' + ext);
  try {
    folder = studentFolder_(uid);
    var old = folder.getFilesByName(finalName); while (old.hasNext()) old.next().setTrashed(true); // nộp lại: bản cũ vào thùng rác (khôi phục được 30 ngày)
    file = folder.createFile(Utilities.newBlob(bytes, body.mime || 'application/octet-stream', finalName));
  } catch (errDrive) {
    console.error('uploadPractice Drive', uid, examId, errDrive);
    var e2 = new Error('Chưa lưu được file lên Drive (hệ thống bận hoặc chưa cấp quyền Drive). File vẫn ở máy em — hãy bấm nộp lại hoặc báo thầy cô.'); e2.retry = true; throw e2;
  }
  db_('results/' + examId + '/' + uid + '/practice_file', 'put', { file_id: file.getId(), url: file.getUrl(), name: name, bytes: bytes.length, at: { '.sv': 'timestamp' } });
  return { ok: true, file_id: file.getId(), bytes: bytes.length };
}

// ---------------------------------------------------------------------------- web app
function doGet(e) {
  var auth = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  var authUrl = auth.getAuthorizationUrl();
  if (authUrl) {
    var html = '<div style="font-family:sans-serif;text-align:center;padding:50px;">'
      + '<h2>Cần cấp quyền kết nối mạng cho Hệ thống chấm thi</h2>'
      + '<p>Vui lòng bấm nút bên dưới để cấp quyền kết nối Firebase cho Google Apps Script:</p>'
      + '<a href="' + authUrl + '" target="_blank" style="display:inline-block;padding:14px 28px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;margin-top:20px;">CẤP QUYỀN NGAY</a>'
      + '</div>';
    return HtmlService.createHtmlOutput(html);
  }
  return json_({ ok: true, service: 'aihoctap-exam', authorized: true, t: Date.now() });
}

function inLinkCapQuyen() {
  var auth = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  var url = auth.getAuthorizationUrl();
  Logger.log('--------------------------------------------------');
  if (url) {
    Logger.log('LINK CẤP QUYỀN TRỰC TIẾP:');
    Logger.log(url);
  } else {
    Logger.log('Tất cả các quyền (bao gồm UrlFetchApp) đã được cấp thành công 100%!');
  }
  Logger.log('--------------------------------------------------');
}
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var uid = verifyUid_(body.idToken);
    if (body.action === 'grade_my_attempt') return json_(gradeMyAttempt_(uid, String(body.exam_id || ''), body.attempt));
    if (body.action === 'upload_practice') return json_(uploadPractice_(uid, body));
    if (body.action === 'publish_exam') {
      if (db_('teachers/' + uid) !== true) throw new Error('Chỉ giáo viên được phát hành đề.');
      return json_(publishExam_(body.exam || {}));
    }
    return json_({ ok: false, error: 'Hành động không hợp lệ.' });
  } catch (err) { return json_({ ok: false, error: err.message, retry: Boolean(err.retry) }); }
}

// ---------------------------------------------------------------------------- trigger mỗi phút
/**
 * Chỉ làm việc khi có đề đang mở hoặc vừa đóng: chấm bù bài chưa có điểm; sau giờ đóng + 2 phút thì
 * tự nộp từ nháp cho ai chưa nộp, ghi chi tiết đúng/sai + đáp án vào results, tạo minh chứng Drive, ghi sổ điểm.
 * Có thể dừng giữa chừng (giới hạn thời gian) và lần sau làm tiếp (bỏ qua học sinh đã xong).
 */
function tick() {
  var t0 = Date.now(), now = Date.now();
  var metas = db_('exam_meta') || {};
  Object.keys(metas).forEach(function (id) {
    var m = metas[id];
    if (!m || m.backend !== 'firebase' || m.finalized_at) return;
    if (now < Number(m.opens_at)) return;
    if (Date.now() - t0 > RUN_BUDGET_MS) return;
    if (now < Number(m.closes_at) + FINALIZE_AFTER_MS) catchUpGrades_(id, t0); else finalizeExam_(id, m, t0);
  });
}
function catchUpGrades_(id, t0) {
  var atts = db_('attempts/' + id) || {}, res = db_('results/' + id) || {};
  Object.keys(atts).forEach(function (uid) {
    if (Date.now() - t0 > RUN_BUDGET_MS) return;
    var nums = Object.keys(atts[uid] || {}); var last = nums.sort().pop();
    if (last && (!res[uid] || String(res[uid].attempt) !== last)) { try { gradeMyAttempt_(uid, id, last); } catch (e) { console.error(id, uid, e); } }
  });
}
function finalizeExam_(id, m, t0) {
  var sessions = db_('sessions/' + id) || {}, atts = db_('attempts/' + id) || {}, drafts = db_('drafts/' + id) || {}, res = db_('results/' + id) || {};
  var done = true;
  Object.keys(sessions).forEach(function (uid) {
    if (Date.now() - t0 > RUN_BUDGET_MS) { done = false; return; }
    if (res[uid] && res[uid].finalized) return;
    try {
      // 1) Không nộp kịp → tự nộp nháp cuối (OAuth chủ dự án bỏ qua luật RTDB)
      if (!atts[uid]) {
        var d = drafts[uid] || {};
        var auto = { submitted_at: { '.sv': 'timestamp' }, answers: d.answers || {}, auto_from_draft: true };
        db_('attempts/' + id + '/' + uid + '/1', 'put', auto);
        atts[uid] = { '1': { answers: d.answers || {}, auto_from_draft: true, submitted_at: Date.now() } };
      }
      // 2) Chấm lượt tốt nhất, ghi chi tiết + đáp án (đã qua giờ đóng nên công bố được)
      var best = null, bestNo = '1';
      Object.keys(atts[uid]).forEach(function (n) { if (!atts[uid][n] || !atts[uid][n].answers) return; var g = grade_(id, atts[uid][n].answers); if (!best || g.earned > best.earned) { best = g; bestNo = n; } });
      var prev = res[uid] || {}, practice = prev.practice_score != null ? Number(prev.practice_score) : null;
      var detail = {}; best.rows.forEach(function (r) { detail[r.id] = { mine: r.mine, right: r.right, ok: r.ok, pts: r.pts, max: r.max }; });
      var a = (atts[uid] && atts[uid][bestNo]) || {};
      var record = {
        theory_score: best.earned, theory_max: best.total, attempt: bestNo, auto_from_draft: Boolean(a.auto_from_draft),
        total_score: round2_(best.earned + (practice || 0)), details: detail,
        status: best.review || hasPractice_(m) && practice == null ? 'needs_review' : 'graded', finalized: true, graded_at: { '.sv': 'timestamp' }
      };
      // 3) Minh chứng .txt trong thư mục học sinh (Drive an toàn)
      // Minh chứng là bắt buộc: lỗi Drive → ghi điểm nhưng KHÔNG đánh dấu finalized, lần chạy sau tạo lại; đề chưa được chốt.
      try {
        var ev = upsertText_(studentFolder_(uid), safeName_('minh-chung_' + id + '.txt'), evidenceText_(id, m, uid, a, best, practice, prev));
        record.evidence_id = ev.getId(); record.evidence_url = ev.getUrl(); record.evidence_error = null;
      } catch (errDrive) {
        record.finalized = false; record.evidence_error = String(errDrive.message || errDrive).slice(0, 200); done = false;
        console.error('Minh chứng Drive lỗi', id, uid, errDrive);
      }
      db_('results/' + id + '/' + uid, 'patch', record);
      // 4) Sổ điểm
      writeGradebookRow_(id, m, uid, record, prev);
    } catch (e) { done = false; console.error('finalize', id, uid, e); }
  });
  if (done) db_('exam_meta/' + id + '/finalized_at', 'put', { '.sv': 'timestamp' });
}
function hasPractice_(m) { return (m.parts || []).some(function (p) { return p.key === 'practice'; }); }
function practiceMax_(m) { var p = (m.parts || []).filter(function (x) { return x.key === 'practice'; })[0]; return p ? Number(p.max) || 0 : 0; }

function evidenceText_(id, m, uid, att, g, practice, prev) {
  var s = db_('students/' + uid) || {}, sess = db_('sessions/' + id + '/' + uid) || {}, pack = examPack_(id), L = [], line = '='.repeat(70);
  L.push(line, 'PHIẾU MINH CHỨNG KẾT QUẢ BÀI KIỂM TRA', line);
  L.push('Đề kiểm tra: ' + (m.title || id) + '   (mã ' + id + ')');
  L.push('Học sinh: ' + (s.name || '') + '   Mã số: ' + (s.student_id || '') + '   Lớp: ' + (s.class_code || ''));
  L.push('Bắt đầu: ' + fmt_(sess.started_at) + '   Nộp: ' + fmt_(att.submitted_at) + (att.auto_from_draft ? '   (HỆ THỐNG TỰ NỘP TỪ BÀI NHÁP CUỐI)' : ''));
  L.push('-'.repeat(70), 'PHẦN I: TRẮC NGHIỆM / TỰ LUẬN (' + g.total + ' điểm)');
  g.rows.forEach(function (r) {
    var q = pack.questions[r.n - 1] || {}, opt = function (k) { return k && q.options && q.options[k] ? k + '. ' + q.options[k] : (k || '(bỏ trống)'); };
    L.push('- Câu ' + r.n + ': ' + String(q.prompt || '').replace(/\s+/g, ' '));
    if (r.kind === 'choice') { L.push('  + Học sinh chọn: ' + opt(r.mine)); L.push('  + Đáp án đúng:   ' + opt(r.right)); L.push('  + Kết quả: ' + (r.ok ? 'ĐÚNG (+' + r.max + ')' : 'SAI (0)')); }
    else { L.push('  + Bài làm: ' + (r.mine || '(bỏ trống)')); if (r.right) L.push('  + Gợi ý đáp án: ' + r.right); L.push('  + Kết quả: CHỜ GIÁO VIÊN CHẤM'); }
  });
  L.push('Điểm phần I: ' + g.earned + ' / ' + g.total);
  if (hasPractice_(m)) {
    L.push('-'.repeat(70), 'PHẦN II: THỰC HÀNH (' + practiceMax_(m) + ' điểm)');
    L.push('- File bài nộp: ' + (prev.practice_file ? prev.practice_file.name + ' (' + prev.practice_file.url + ')' : 'CHƯA NỘP'));
    L.push('- Điểm giáo viên chấm: ' + (practice == null ? 'CHƯA CHẤM' : practice + ' / ' + practiceMax_(m)));
    if (prev.practice_comment) L.push('- Nhận xét: ' + prev.practice_comment);
  }
  L.push('-'.repeat(70), 'TỔNG ĐIỂM: ' + round2_(g.earned + (practice || 0)) + ' / ' + round2_(g.total + practiceMax_(m)));
  L.push('Cập nhật lúc: ' + fmt_(Date.now()), line);
  return L.join('\n');
}

// ---------------------------------------------------------------------------- sổ điểm
var GB_HEAD = ['UID', 'Mã HS', 'Họ và tên', 'Lớp', 'Trắc nghiệm', 'Thực hành (GV nhập)', 'Nhận xét', 'Tổng', 'Trạng thái', 'File thực hành', 'Minh chứng'];
function gradebook_() {
  var id = P_('GRADEBOOK_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('So diem bai thi'); PropertiesService.getScriptProperties().setProperty('GRADEBOOK_ID', ss.getId()); return ss;
}
function gbSheet_(examId, m) {
  var ss = gradebook_(), name = safeName_(examId).slice(0, 90), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(GB_HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, GB_HEAD.length).setFontWeight('bold'); sh.hideColumns(1); sh.getRange('F1').setNote('Gõ điểm thực hành (tối đa ' + practiceMax_(m) + '). Tổng và minh chứng tự cập nhật.'); }
  return sh;
}
function writeGradebookRow_(examId, m, uid, record, prev) {
  var sh = gbSheet_(examId, m), s = db_('students/' + uid) || {};
  var uids = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(function (r) { return r[0]; });
  var row = uids.indexOf(uid) + 1;
  var vals = [uid, s.student_id || '', s.name || '', s.class_code || '', record.theory_score, prev.practice_score != null ? prev.practice_score : '', prev.practice_comment || '', record.total_score, record.status === 'graded' ? 'Đã chấm' : 'Chờ chấm thực hành/tự luận', prev.practice_file ? prev.practice_file.url : '', record.evidence_url || ''];
  if (row > 0) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
}
/** Trigger "khi sửa" sổ điểm: GV gõ điểm thực hành (cột F) hoặc nhận xét (cột G) → cập nhật results + tổng + minh chứng. */
function onGradebookEdit(e) {
  var r = e.range; if (!r || r.getRow() < 2 || (r.getColumn() !== 6 && r.getColumn() !== 7)) return;
  var sh = r.getSheet(), examId = sh.getName(), uid = sh.getRange(r.getRow(), 1).getValue(); if (!uid) return;
  var m = db_('exam_meta/' + examId); if (!m) return;
  var raw = sh.getRange(r.getRow(), 6).getValue(), comment = String(sh.getRange(r.getRow(), 7).getValue() || '');
  var practice = raw === '' ? null : Number(raw), max = practiceMax_(m);
  if (practice != null && (!(practice >= 0) || practice > max)) { sh.getRange(r.getRow(), 6).setNote('Điểm phải từ 0 đến ' + max).setBackground('#fde2e1'); return; }
  sh.getRange(r.getRow(), 6).setNote('').setBackground(null);
  var prev = db_('results/' + examId + '/' + uid) || {}, theory = Number(prev.theory_score) || 0;
  var total = round2_(theory + (practice || 0));
  db_('results/' + examId + '/' + uid, 'patch', { practice_score: practice, practice_comment: comment, total_score: total, status: practice == null ? 'needs_review' : 'graded', graded_at: { '.sv': 'timestamp' } });
  sh.getRange(r.getRow(), 8, 1, 2).setValues([[total, practice == null ? 'Chờ chấm thực hành/tự luận' : 'Đã chấm']]);
  if (prev.finalized) { // cập nhật phiếu minh chứng
    var atts = db_('attempts/' + examId + '/' + uid) || {}, a = atts[prev.attempt || '1'] || {};
    prev.practice_score = practice; prev.practice_comment = comment;
    upsertText_(studentFolder_(uid), safeName_('minh-chung_' + examId + '.txt'), evidenceText_(examId, m, uid, a, grade_(examId, a.answers), practice, prev));
  }
}

// ---------------------------------------------------------------------------- cài đặt
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['tick', 'onGradebookEdit'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('onGradebookEdit').forSpreadsheet(gradebook_()).onEdit().create();
  // Gọi UrlFetch để xác thực quyền kết nối ngoài
  try {
    UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/', { muteHttpExceptions: true });
  } catch (eUrl) {
    Logger.log('UrlFetch: ' + eUrl.message);
  }
  var driveInfo = rootFolder_().getUrl(); // lỗi quyền Drive thì dừng ngay, không báo "thành công" giả
  Logger.log('Đã cài trigger thành công. Sổ điểm: ' + gradebook_().getUrl() + ' — Thư mục Drive: ' + driveInfo);
  Logger.log('Bước tiếp: chạy hàm kiemTraHeThong() và dán toàn bộ nhật ký cho Antigravity.');
}

/** Tự kiểm tra một lần: cấu hình, RTDB, Drive (ghi + xóa thử), sổ điểm, trigger. Chạy sau khi dán mã và cấp quyền. */
function kiemTraHeThong() {
  var ok = true;
  function step(name, fn) {
    try { var r = fn(); Logger.log('ĐẠT  ' + name + (r ? ' — ' + r : '')); }
    catch (e) { ok = false; Logger.log('LỖI  ' + name + ' — ' + e.message); }
  }
  step('Cấu hình DB_URL / FIREBASE_API_KEY', function () {
    if (!P_('DB_URL')) throw new Error('thiếu DB_URL trong Script properties');
    if (!P_('FIREBASE_API_KEY')) throw new Error('thiếu FIREBASE_API_KEY trong Script properties');
    return P_('DB_SECRET') || P_('FIREBASE_DB_SECRET') ? 'đang dùng DB_SECRET dự phòng (nên chuyển sang OAuth rồi xóa)' : 'dùng OAuth chủ dự án';
  });
  step('Đọc Firebase RTDB', function () { var m = db_('exam_meta') || {}; return Object.keys(m).length + ' đề trong exam_meta'; });
  step('Drive: tạo thư mục gốc, ghi và xóa file thử', function () {
    var root = rootFolder_(), f = root.createFile('kiem-tra-quyen.txt', 'ok ' + new Date().toISOString());
    f.setTrashed(true);
    return root.getUrl();
  });
  step('Sổ điểm (Google Sheet)', function () { return gradebook_().getUrl(); });
  step('Trigger tick + onGradebookEdit', function () {
    var h = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
    if (h.indexOf('tick') < 0 || h.indexOf('onGradebookEdit') < 0) throw new Error('thiếu trigger — hãy chạy setup()');
    return h.join(', ');
  });
  Logger.log(ok ? '=== KẾT QUẢ: ĐẠT TOÀN BỘ — có thể triển khai New version và chạy thi thử ===' : '=== KẾT QUẢ: CHƯA ĐẠT — sửa các dòng LỖI rồi chạy lại ===');
}
function testDrive() { Logger.log(rootFolder_().getUrl()); }
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📝 Bài thi (Firebase)').addItem('Phát hành đề từ tab này', 'publishExamFromSheet').addToUi();
}
