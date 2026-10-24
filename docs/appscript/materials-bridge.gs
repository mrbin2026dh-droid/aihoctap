/**
 * Cầu nối tài liệu PDF (Google Apps Script) cho ứng dụng AI học tập.
 * Lưu PDF vào thư mục Drive riêng, đọc/đổi tên/xóa theo yêu cầu của Worker.
 * Mã bí mật và ID thư mục nằm ở Script Properties, KHÔNG viết vào mã này.
 */
var MAX_BYTES = 10 * 1024 * 1024; // 10MB
var FOLDER_NAME = 'SGK-TaiLieu';

/** Chạy MỘT LẦN: tạo thư mục + mã bí mật (48 ký tự) nếu chưa có, hiện trong Nhật ký thực thi. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    props.setProperty('FOLDER_ID', DriveApp.createFolder(FOLDER_NAME).getId());
  }
  var s = props.getProperty('BRIDGE_SECRET');
  if (!s) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    s = '';
    for (var i = 0; i < 48; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    props.setProperty('BRIDGE_SECRET', s);
  }
  Logger.log('Đã có thư mục "' + FOLDER_NAME + '" trong Drive.');
  Logger.log('BRIDGE_SECRET (chỉ chép vào lệnh wrangler, không gửi cho ai): ' + s);
}

/** Tải PDF: GET ?s=<bí mật>&id=<fileId> */
function doGet(e) {
  var cfg = config_();
  if (!cfg) return out_({ ok: false, error: 'NOT_CONFIGURED' });
  var p = (e && e.parameter) || {};
  if (!safeEqual_(String(p.s || ''), cfg.secret)) return out_({ ok: false, error: 'FORBIDDEN' });
  var file = fileInFolder_(String(p.id || ''), cfg.folderId);
  if (!file) return out_({ ok: false, error: 'NOT_FOUND' });
  if (file.getMimeType() !== MimeType.PDF) return out_({ ok: false, error: 'NOT_PDF' });
  if (file.getSize() > MAX_BYTES) return out_({ ok: false, error: 'TOO_LARGE' });
  return out_({ ok: true, name: file.getName(), size: file.getSize(),
    data_b64: Utilities.base64Encode(file.getBlob().getBytes()) });
}

/** Quản lý: POST JSON { s, action: 'upload'|'rename'|'delete', ... } */
function doPost(e) {
  var cfg = config_();
  if (!cfg) return out_({ ok: false, error: 'NOT_CONFIGURED' });
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return out_({ ok: false, error: 'BAD_JSON' }); }
  if (!safeEqual_(String(body.s || ''), cfg.secret)) return out_({ ok: false, error: 'FORBIDDEN' });

  try {
    if (body.action === 'upload') {
      var bytes = Utilities.base64Decode(String(body.data_b64 || ''));
      if (!bytes.length) return out_({ ok: false, error: 'EMPTY' });
      if (bytes.length > MAX_BYTES) return out_({ ok: false, error: 'TOO_LARGE' });
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        return out_({ ok: false, error: 'NOT_PDF' });
      }
      var name = cleanName_(body.name);
      var blob = Utilities.newBlob(bytes, MimeType.PDF, name);
      var f = DriveApp.getFolderById(cfg.folderId).createFile(blob);
      return out_({ ok: true, file_id: f.getId(), name: f.getName(), size: f.getSize() });
    }
    if (body.action === 'rename') {
      var fr = fileInFolder_(String(body.id || ''), cfg.folderId);
      if (!fr) return out_({ ok: false, error: 'NOT_FOUND' });
      fr.setName(cleanName_(body.name));
      return out_({ ok: true, name: fr.getName() });
    }
    if (body.action === 'delete') {
      var fd = fileInFolder_(String(body.id || ''), cfg.folderId);
      if (!fd) return out_({ ok: false, error: 'NOT_FOUND' });
      fd.setTrashed(true); // vào Thùng rác Drive, khôi phục được trong 30 ngày
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'BAD_ACTION' });
  } catch (err) {
    return out_({ ok: false, error: 'FAILED' });
  }
}

function config_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('BRIDGE_SECRET') || '';
  var folderId = props.getProperty('FOLDER_ID') || '';
  if (secret.length < 32 || !folderId) return null;
  return { secret: secret, folderId: folderId };
}

function fileInFolder_(id, folderId) {
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) return null;
  try {
    var file = DriveApp.getFileById(id);
    var parents = file.getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === folderId) return file;
    }
  } catch (err) { /* không thấy */ }
  return null;
}

function cleanName_(name) {
  var n = String(name || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  n = n.replace(/\.pdf$/i, '').slice(0, 100).trim();
  return (n || 'Tai lieu') + '.pdf';
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
