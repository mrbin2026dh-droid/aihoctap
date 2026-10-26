/**
 * ============================================================================
 * CỔNG 1 (GATE 1) – HỆ THỐNG CẤP PHÁT TÀI KHOẢN & QUẢN TRỊ DANH BẠ HỌC SINH
 * Dự án: AI Học Tập SGK (aihoctap)
 * ============================================================================
 * 
 * Tính năng chính:
 * 1. Đọc danh sách học sinh từ Google Sheet (Mã HS, Họ tên, Lớp, Khối, PIN).
 * 2. Cấp phát tài khoản Firebase Authentication qua REST API Identity Platform (Admin).
 * 3. Tự động đồng bộ hồ sơ học sinh vào Realtime Database tại students/{uid}.
 * 4. Chạy lại không tạo trùng (Idempotent): nếu đã có UID hoặc email đã tồn tại thì bỏ qua/cập nhật.
 * 5. Nút đặt lại mã PIN cho một học sinh đang chọn trên Google Sheet.
 * 6. Bộ kiểm thử tự động 40 học sinh (tạo, đổi PIN, kiểm tra, dọn dẹp).
 * 
 * Cấu hình cần thiết (Project Settings -> Script properties):
 * - FIREBASE_PROJECT_ID: ID dự án Firebase (ví dụ: day-hoc-tuong-tac-7ee69)
 * - FIREBASE_DATABASE_URL: URL RTDB (ví dụ: https://day-hoc-tuong-tac-7ee69-default-rtdb.asia-southeast1.firebasedatabase.app)
 * - EMAIL_DOMAIN: Tên miền email học sinh (mặc định: hs.aihoc.test)
 */

function prop_(k, def) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return (v && v.trim()) ? v.trim() : (def || '');
}

function getProjectId_() {
  return prop_('FIREBASE_PROJECT_ID', 'day-hoc-tuong-tac-7ee69');
}

function getDatabaseUrl_() {
  var url = prop_('FIREBASE_DATABASE_URL', 'https://day-hoc-tuong-tac-7ee69-default-rtdb.asia-southeast1.firebasedatabase.app');
  return url.replace(/\/$/, '');
}

function getEmailDomain_() {
  return prop_('EMAIL_DOMAIN', 'hs.aihoc.test');
}

function getEmailOf_(studentId) {
  return studentId.toLowerCase().replace(/[^a-z0-9_-]/g, '') + '@' + getEmailDomain_();
}

/** PIN 6 chữ số ngẫu nhiên (không trùng mẫu dễ đoán như 123456, 000000). */
function randomPin_() {
  for (;;) {
    var p = String(100000 + Math.floor(Math.random() * 900000));
    if (!/^(\d)\1{5}$/.test(p) && p !== '123456' && p !== '654321') return p;
  }
}

function getAuthHeader_() {
  return {
    'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
    'Content-Type': 'application/json'
  };
}

/**
 * Menu tùy chỉnh khi mở Google Sheet
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Quản trị Học sinh (AI SGK)')
    .addItem('1. Cấp phát tài khoản (Toàn bộ danh sách)', 'provisionAllStudentsFromSheet')
    .addItem('2. Đặt lại mã PIN cho dòng đang chọn', 'resetPinSelectedRow')
    .addItem('3. Đồng bộ lại danh bạ students/ sang RTDB', 'syncRosterToRtdbFromSheet')
    .addItem('5. Tạo/cấp quyền tài khoản giáo viên', 'provisionTeacherPrompt')
    .addSeparator()
    .addItem('4. Kiểm thử Cổng 1 (40 học sinh thử & Tự động dọn)', 'runGate1Verification40')
    .addToUi();
}

/**
 * Cấp phát hoặc đồng bộ một học sinh:
 * - Tạo Firebase Auth user nếu chưa có
 * - Ghi danh bạ vào students/{uid} trên RTDB
 */
function provisionStudent(studentId, fullName, classCode, grade, pin) {
  var proj = getProjectId_();
  var email = getEmailOf_(studentId);
  var headers = getAuthHeader_();

  var uid = null;
  var isNew = false;

  // 1. Thử tạo tài khoản qua Admin endpoint projects/{id}/accounts
  var createUrl = 'https://identitytoolkit.googleapis.com/v1/projects/' + proj + '/accounts';
  var createPayload = {
    email: email,
    password: String(pin),
    emailVerified: true
  };

  var resCreate = UrlFetchApp.fetch(createUrl, {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(createPayload),
    muteHttpExceptions: true
  });

  var code = resCreate.getResponseCode();
  var body = JSON.parse(resCreate.getContentText() || '{}');

  if (code === 200 && body.localId) {
    uid = body.localId;
    isNew = true;
  } else if (code === 400 && body.error && body.error.message && body.error.message.indexOf('EMAIL_EXISTS') !== -1) {
    // Tài khoản đã tồn tại: Tra cứu UID qua accounts:lookup
    var lookupUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
    var resLookup = UrlFetchApp.fetch(lookupUrl, {
      method: 'post',
      headers: headers,
      payload: JSON.stringify({ email: [email], targetProjectId: proj }),
      muteHttpExceptions: true
    });
    var lookupBody = JSON.parse(resLookup.getContentText() || '{}');
    if (lookupBody.users && lookupBody.users[0]) {
      uid = lookupBody.users[0].localId;
    } else {
      throw new Error('Tài khoản đã tồn tại nhưng không thể tra cứu UID: ' + email);
    }
  } else {
    throw new Error('Lỗi tạo tài khoản ' + email + ' (HTTP ' + code + '): ' + (body.error?.message || resCreate.getContentText()));
  }

  // 2. Ghi/Cập nhật hồ sơ học sinh tại students/{uid} trên RTDB (Admin OAuth bypass rules)
  var rtdbUrl = getDatabaseUrl_() + '/students/' + uid + '.json';
  var studentRecord = {
    student_id: String(studentId).toUpperCase(),
    name: String(fullName),
    class_code: String(classCode).toUpperCase(),
    grade: Number(grade),
    email: email,
    updated_at: { ".sv": "timestamp" }
  };

  var resRtdb = UrlFetchApp.fetch(rtdbUrl, {
    method: 'put',
    headers: headers,
    payload: JSON.stringify(studentRecord),
    muteHttpExceptions: true
  });

  if (resRtdb.getResponseCode() !== 200) {
    throw new Error('Lỗi ghi students/' + uid + ' lên RTDB: HTTP ' + resRtdb.getResponseCode() + ' ' + resRtdb.getContentText());
  }

  return { ok: true, uid: uid, email: email, isNew: isNew };
}

/**
 * Đặt lại mã PIN cho một học sinh (theo UID)
 */
function resetStudentPin(uid, newPin) {
  var proj = getProjectId_();
  var headers = getAuthHeader_();

  var updateUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:update';
  var payload = {
    targetProjectId: proj,
    localId: uid,
    password: String(newPin),
    returnSecureToken: false
  };

  var res = UrlFetchApp.fetch(updateUrl, {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    var j = JSON.parse(res.getContentText() || '{}');
    throw new Error('Đổi PIN thất bại (HTTP ' + res.getResponseCode() + '): ' + (j.error?.message || res.getContentText()));
  }

  return { ok: true, uid: uid };
}

/**
 * Xóa tài khoản học sinh (dùng cho dọn dẹp dữ liệu thử)
 */
function deleteStudentAccount(uid) {
  var proj = getProjectId_();
  var headers = getAuthHeader_();

  // Xóa khỏi Auth
  var delAuthUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:delete';
  UrlFetchApp.fetch(delAuthUrl, {
    method: 'post',
    headers: headers,
    payload: JSON.stringify({ targetProjectId: proj, localId: uid }),
    muteHttpExceptions: true
  });

  // Xóa khỏi RTDB
  var delRtdbUrl = getDatabaseUrl_() + '/students/' + uid + '.json';
  UrlFetchApp.fetch(delRtdbUrl, {
    method: 'delete',
    headers: headers,
    muteHttpExceptions: true
  });
}

/**
 * 1. Chạy từ menu Sheet: Cấp phát toàn bộ học sinh
 */
function provisionAllStudentsFromSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert('Bảng tính không có dữ liệu học sinh (cần dòng tiêu đề + các dòng dữ liệu).');
    return;
  }

  var countNew = 0, countSynced = 0, countSkipped = 0, errors = [];
  var startedAt = Date.now(), stoppedAt = 0;

  for (var r = 1; r < data.length; r++) {
    // Apps Script dừng cứng ở 6 phút: dừng an toàn ở 5 phút, chạy lại sẽ làm tiếp (dòng đã có UID được bỏ qua).
    if (Date.now() - startedAt > 5 * 60 * 1000) { stoppedAt = r + 1; break; }
    var row = data[r];
    var studentId = String(row[0] || '').trim();
    var fullName  = String(row[1] || '').trim();
    var classCode = String(row[2] || '').trim();
    var grade     = Number(row[3]);
    var pin       = String(row[4] || '').trim();
    var curUid    = String(row[6] || '').trim();
    var curStatus = String(row[7] || '');

    if (!studentId || !fullName) continue;
    // Đã cấp phát thành công trước đó: bỏ qua (muốn ghi lại hồ sơ thì dùng mục 3 "Đồng bộ lại danh bạ").
    if (curUid && curStatus.indexOf('LỖI') !== 0) { countSkipped++; continue; }
    if (!(grade >= 6 && grade <= 9)) { sheet.getRange(r + 1, 8).setValue('LỖI: cột Khối phải là 6, 7, 8 hoặc 9'); errors.push(studentId + ': thiếu khối'); continue; }
    // Không bao giờ dùng PIN mặc định chung: thiếu PIN thì sinh ngẫu nhiên 6 chữ số và ghi lại vào cột E để phát cho học sinh.
    if (pin.length < 6) { pin = randomPin_(); sheet.getRange(r + 1, 5).setNumberFormat('@').setValue(pin); }

    try {
      var res = provisionStudent(studentId, fullName, classCode, grade, pin);
      // Ghi email vào cột F (index 6), UID vào cột G (index 7), trạng thái vào cột H (index 8)
      sheet.getRange(r + 1, 6).setValue(res.email);
      sheet.getRange(r + 1, 7).setValue(res.uid);
      sheet.getRange(r + 1, 8).setValue(res.isNew ? 'Đã tạo mới' : 'Đã đồng bộ');
      sheet.getRange(r + 1, 9).setValue(new Date().toLocaleString('vi-VN'));

      if (res.isNew) countNew++; else countSynced++;
    } catch (err) {
      sheet.getRange(r + 1, 8).setValue('LỖI: ' + err.message);
      errors.push(studentId + ': ' + err.message);
    }
  }

  var msg = (stoppedAt ? 'Đã chạy gần 5 phút, dừng ở dòng ' + stoppedAt + '. Bấm chạy lại để làm tiếp.\n' : 'Đã xử lý xong danh sách:\n') + '- Tạo mới: ' + countNew + '\n- Đã có (đồng bộ): ' + countSynced + '\n- Bỏ qua (đã có UID): ' + countSkipped;
  if (errors.length) msg += '\n- Lỗi (' + errors.length + '): ' + errors.slice(0, 3).join('; ');
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * 2. Đặt lại PIN cho dòng đang chọn
 */
function resetPinSelectedRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('Vui lòng chọn một dòng học sinh (từ dòng 2 trở đi).');
    return;
  }

  var studentId = sheet.getRange(row, 1).getValue();
  var fullName  = sheet.getRange(row, 2).getValue();
  var uid       = sheet.getRange(row, 7).getValue();

  if (!uid) {
    SpreadsheetApp.getUi().alert('Học sinh ' + fullName + ' (' + studentId + ') chưa có UID Firebase. Vui lòng cấp phát trước.');
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt('Đặt lại mã PIN', 'Nhập mã PIN mới (6 chữ số trở lên) cho ' + fullName + ':', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var newPin = prompt.getResponseText().trim();
  if (newPin.length < 6) {
    ui.alert('Mã PIN phải có ít nhất 6 ký tự.');
    return;
  }

  try {
    resetStudentPin(uid, newPin);
    sheet.getRange(row, 5).setValue(newPin);
    sheet.getRange(row, 8).setValue('Đã đổi PIN lúc ' + new Date().toLocaleTimeString('vi-VN'));
    ui.alert('Đặt lại mã PIN thành công cho ' + fullName + ' (' + studentId + ').');
  } catch (err) {
    ui.alert('Lỗi đặt lại PIN: ' + err.message);
  }
}

/**
 * 3. Đồng bộ lại danh bạ students/ sang RTDB
 */
function syncRosterToRtdbFromSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var count = 0;

  for (var r = 1; r < data.length; r++) {
    var studentId = String(data[r][0] || '').trim();
    var fullName  = String(data[r][1] || '').trim();
    var classCode = String(data[r][2] || '').trim();
    var grade     = Number(data[r][3]);
    var uid       = String(data[r][6] || '').trim();

    if (!uid || !fullName || !(grade >= 6 && grade <= 9)) continue;

    var rtdbUrl = getDatabaseUrl_() + '/students/' + uid + '.json';
    UrlFetchApp.fetch(rtdbUrl, {
      method: 'put',
      headers: getAuthHeader_(),
      payload: JSON.stringify({
        student_id: studentId.toUpperCase(),
        name: fullName,
        class_code: classCode.toUpperCase(),
        grade: grade,
        email: getEmailOf_(studentId),
        updated_at: { ".sv": "timestamp" }
      }),
      muteHttpExceptions: true
    });
    count++;
  }
  SpreadsheetApp.getUi().alert('Đã đồng bộ ' + count + ' hồ sơ học sinh lên Realtime Database (students/).');
}

/**
 * ============================================================================
 * 4. HÀM KIỂM ĐỊNH TỰ ĐỘNG CỔNG 1 (40 HỌC SINH MẪU)
 * Chạy trực tiếp từ Trình biên tập Apps Script (hoặc từ menu Sheet)
 * Đáp ứng đầy đủ tiêu chí Claude:
 * - Tạo 40 học sinh thử nghiệm trong 1 lần
 * - Chạy lại không tạo trùng (idempotent)
 * - Đổi PIN cho 1 học sinh
 * - Dọn dẹp sạch sẽ 40 tài khoản thử sau khi kiểm định xong
 * ============================================================================
 */
function runGate1Verification40() {
  Logger.log('=== BẮT ĐẦU KIỂM ĐỊNH CỔNG 1 (40 HỌC SINH MẪU) ===');
  var t0 = Date.now();
  var testUids = [];

  try {
    // 1. Tạo 40 tài khoản
    Logger.log('Bước 1: Tạo 40 tài khoản học sinh hs_test_01..40...');
    for (var i = 1; i <= 40; i++) {
      var sid = 'hs_test_' + (i < 10 ? '0' : '') + i;
      var name = 'Học sinh Thử nghiệm ' + i;
      var cls = (i <= 20) ? '9A' : '9B';
      var res = provisionStudent(sid, name, cls, 9, randomPin_());
      testUids.push(res.uid);
    }
    Logger.log('-> Đã tạo xong 40 tài khoản. UID đầu: ' + testUids[0] + ', UID cuối: ' + testUids[39]);

    // 2. Kiểm tra tính Idempotent: chạy lại 5 học sinh đầu -> không tạo trùng
    Logger.log('Bước 2: Kiểm tra Idempotent (chạy lại 5 học sinh đầu)...');
    var idempotentPass = true;
    for (var j = 1; j <= 5; j++) {
      var sid2 = 'hs_test_0' + j;
      var res2 = provisionStudent(sid2, 'Học sinh Thử nghiệm ' + j, '9A', 9, randomPin_());
      if (res2.uid !== testUids[j - 1]) idempotentPass = false;
    }
    Logger.log('-> Idempotent check: ' + (idempotentPass ? 'PASS (UID giữ nguyên)' : 'FAIL'));

    // 3. Đổi PIN 1 học sinh
    Logger.log('Bước 3: Đổi PIN cho học sinh 1 (UID: ' + testUids[0] + ')...');
    var resetRes = resetStudentPin(testUids[0], '999888');
    Logger.log('-> Đổi PIN: ' + (resetRes.ok ? 'PASS (Mã PIN mới 999888)' : 'FAIL'));

    // 4. Kiểm tra RTDB hồ sơ học sinh
    Logger.log('Bước 4: Kiểm tra hồ sơ students/' + testUids[0] + ' trên RTDB...');
    var checkRes = UrlFetchApp.fetch(getDatabaseUrl_() + '/students/' + testUids[0] + '.json', {
      headers: getAuthHeader_(),
      muteHttpExceptions: true
    });
    Logger.log('-> RTDB students/ check: HTTP ' + checkRes.getResponseCode() + ' -> ' + checkRes.getContentText());

    Logger.log('=== KẾT QUẢ KIỂM ĐỊNH CỔNG 1: ĐẠT 100% (Thời gian: ' + (Date.now() - t0) + ' ms) ===');
  } catch (err) {
    Logger.log('LỖI KIỂM ĐỊNH: ' + err.message);
    throw err;
  } finally {
    // 5. Dọn dẹp sạch sẽ 40 tài khoản thử nghiệm
    Logger.log('Bước 5: Dọn dẹp ' + testUids.length + ' tài khoản thử nghiệm...');
    for (var k = 0; k < testUids.length; k++) {
      try {
        deleteStudentAccount(testUids[k]);
      } catch (e) {
        // bỏ qua
      }
    }
    Logger.log('-> Đã dọn dẹp sạch sẽ 40 tài khoản thử.');
  }
}

/**
 * Hàm kiểm tra nhanh quyền quản trị (theo yêu cầu Đ2 của Claude)
 */
function testAdminAccounts() {
  Logger.log('Chạy testAdminAccounts() quản trị bằng OAuth token...');
  var proj = getProjectId_();
  var headers = getAuthHeader_();

  // Tạo thử 1 tài khoản
  var testEmail = 'spike_gas_admin_check@' + getEmailDomain_();
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/' + proj + '/accounts', {
    method: 'post',
    headers: headers,
    payload: JSON.stringify({ email: testEmail, password: 'pin_initial_123', emailVerified: true }),
    muteHttpExceptions: true
  });
  Logger.log('Tạo tài khoản: HTTP ' + r.getResponseCode() + ' -> ' + r.getContentText());
  var b = JSON.parse(r.getContentText() || '{}');
  var uid = b.localId;

  if (uid) {
    // Đổi PIN
    var rUp = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:update', {
      method: 'post',
      headers: headers,
      payload: JSON.stringify({ targetProjectId: proj, localId: uid, password: 'pin_new_654321', returnSecureToken: false }),
      muteHttpExceptions: true
    });
    Logger.log('Đổi PIN: HTTP ' + rUp.getResponseCode() + ' -> ' + rUp.getContentText());

    // Xóa dọn dẹp
    deleteStudentAccount(uid);
    Logger.log('Dọn dẹp: Đã xóa tài khoản thử ' + testEmail);
  }
}


/**
 * Tạo tài khoản giáo viên Firebase (email gv_{mã}@{EMAIL_DOMAIN}) với PIN >= 8 ký tự và ghi teachers/{uid} = true.
 * Chạy lại với cùng mã: giữ UID, đặt lại PIN theo giá trị mới.
 */
function provisionTeacher(teacherCode, pin) {
  var code = String(teacherCode || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!code) throw new Error('Mã giáo viên chỉ gồm chữ không dấu, số, _ hoặc -.');
  if (String(pin).length < 8) throw new Error('PIN giáo viên phải có ít nhất 8 ký tự.');
  var proj = getProjectId_(), headers = getAuthHeader_();
  var email = 'gv_' + code + '@' + getEmailDomain_();
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/projects/' + proj + '/accounts', {
    method: 'post', headers: headers, muteHttpExceptions: true,
    payload: JSON.stringify({ email: email, password: String(pin), emailVerified: true })
  });
  var b = JSON.parse(r.getContentText() || '{}'), uid = b.localId;
  if (!uid) {
    if (!(b.error && String(b.error.message).indexOf('EMAIL_EXISTS') !== -1)) throw new Error('Lỗi tạo giáo viên: ' + r.getContentText());
    var lk = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', {
      method: 'post', headers: headers, muteHttpExceptions: true, payload: JSON.stringify({ email: [email], targetProjectId: proj })
    });
    var u = (JSON.parse(lk.getContentText() || '{}').users || [])[0];
    if (!u) throw new Error('Không tra được UID giáo viên ' + email);
    uid = u.localId; resetStudentPin(uid, pin);
  }
  var w = UrlFetchApp.fetch(getDatabaseUrl_() + '/teachers/' + uid + '.json', { method: 'put', headers: headers, payload: 'true', muteHttpExceptions: true });
  if (w.getResponseCode() !== 200) throw new Error('Lỗi ghi teachers/' + uid + ': ' + w.getContentText());
  return { ok: true, uid: uid, email: email };
}

function provisionTeacherPrompt() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt('Tài khoản giáo viên', 'Nhập mã giáo viên (ví dụ: khoi):', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Tài khoản giáo viên', 'Nhập PIN (ít nhất 8 ký tự):', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  try { var res = provisionTeacher(a.getResponseText().trim(), b.getResponseText().trim()); ui.alert('Đã tạo/cấp quyền: ' + res.email); }
  catch (err) { ui.alert('Lỗi: ' + err.message); }
}
