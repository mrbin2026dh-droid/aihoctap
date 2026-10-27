// Chạy apps-script/exam/Code.gs trong Node với bản giả lập Apps Script (RTDB trong bộ nhớ, Sheet, Drive) để kiểm
// thuSoDiem(), onGradebookEdit (dán nhiều hàng, đề đã xóa) và finalizeExam_ trước khi người dùng chạy trên Google thật.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/exam/Code.gs'), 'utf8');
let failures = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failures++; };

function makeEnv(opts = {}) {
  const db = {}; const logs = []; const calls = [];
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), db);
  const fill = v => (Array.isArray(v) ? v.map(x => fill(x)) : v && typeof v === 'object' ? (v['.sv'] === 'timestamp' ? Date.now() : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]))) : v);
  const set = (p, v) => { const ks = p.split('/').filter(Boolean); let o = db; ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }); if (v === null || v === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = v; };
  const UrlFetchApp = { fetch(url, opt) {
    if (url.includes('identitytoolkit') && opt.payload && JSON.parse(opt.payload).idToken?.startsWith('tok:')) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ users: [{ localId: JSON.parse(opt.payload).idToken.slice(4) }] }) };
    if (url.includes('identitytoolkit')) return { getResponseCode: () => 400, getContentText: () => JSON.stringify({ error: { message: url.includes('key=AIzaSyCC2') ? 'INVALID_ID_TOKEN' : 'API key not valid' } }) };
    const viaSecret = url.includes('auth='); calls.push(viaSecret ? 'secret' : 'oauth');
    if (!viaSecret && opts.oauthRejected) return { getResponseCode: () => 401, getContentText: () => '{"error":"Permission denied"}' };
    const p = decodeURIComponent(new URL(url).pathname.replace(/\.json$/, '').replace(/^\//, ''));
    const m = (opt.method || 'get').toLowerCase(); const body = opt.payload ? fill(JSON.parse(opt.payload)) : undefined;
    let out = null;
    if (m === 'get') out = get(p) ?? null;
    else if (m === 'put') { set(p, body); out = body; }
    else if (m === 'patch') { for (const [k, v] of Object.entries(body)) set(p + '/' + k, v); out = body; }
    else if (m === 'delete') set(p, null);
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(out) };
  } };
  // Sheet giả
  class Range { constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
    getRow() { return this.r; } getColumn() { return this.c; } getLastRow() { return this.r + this.nr - 1; } getLastColumn() { return this.c + this.nc - 1; } getSheet() { return this.sh; }
    getValues() { return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sh.cell(this.r + i, this.c + j))); }
    getValue() { return this.sh.cell(this.r, this.c); }
    setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
    setValue(x) { this.sh.put(this.r, this.c, x); return this; }
    setNote(n) { for (let i = 0; i < this.nr; i++) this.sh.notes[`${this.r + i},${this.c}`] = n; return this; } getNote() { return this.sh.notes[`${this.r},${this.c}`] || ''; }
    setBackground() { return this; } setFontWeight() { return this; } setNumberFormat() { return this; } insertCheckboxes() { this.setValue(false); return this; } }
  class Sheet { constructor(name) { this.name = name; this.rows = []; this.notes = {}; }
    cell(r, c) { return (this.rows[r - 1] || [])[c - 1] ?? ''; } put(r, c, x) { (this.rows[r - 1] ||= [])[c - 1] = x; }
    getName() { return this.name; } getLastRow() { return this.rows.length; } appendRow(v) { this.rows.push([...v]); }
    getRange(a, c, nr, nc) { return typeof a === 'string' ? new Range(this, 1, 6) : new Range(this, a, c, nr, nc); }
    getDataRange() { const nc = Math.max(1, ...this.rows.map(r => (r || []).length)); return new Range(this, 1, 1, this.rows.length, nc); }
    setFrozenRows() {} hideColumns() {} }
  const ss = { setSpreadsheetTimeZone() {}, sheets: [], getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }, deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }, getId: () => 'ss1', getUrl: () => 'https://sheet' };
  // Drive giả
  const files = {}; let fid = 0;
  class Folder { constructor(name) { this.name = name; this.kids = []; this.files = []; this.trashed = false; this.id = 'd' + (++fid); }
    getFoldersByName(n) { const l = this.kids.filter(k => k.name === n && !k.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    createFolder(n) { const f = new Folder(n); this.kids.push(f); return f; }
    getFilesByName(n) { const l = this.files.filter(k => k.name === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    createFile(n, text) { if (n && typeof n === 'object') { if (opts.driveFails) throw new Error('Drive lỗi'); text = n.data; n = n.name; } const id = 'f' + (++fid); const f = { name: n, text, getId: () => id, getUrl: () => 'https://drive/' + id, setContent(t) { this.text = t; }, setTrashed() {}, getBlob() { return { getDataAsString: () => f.text }; } }; files[id] = f; this.files.push(f); return f; }
    getId() { return this.id; } getUrl() { return 'https://drive/' + this.id; } setTrashed(t) { this.trashed = t; } }
  const root = new Folder('Bai thi Tin hoc');
  const props = Object.assign({ GRADEBOOK_ID: 'ss1', DRIVE_ROOT_ID: root.id }, opts.props || {});
  const cache = {};
  const ctx = {
    UrlFetchApp, Logger: { log: m => logs.push(String(m)) }, console: { error: () => {}, log: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    ScriptApp: { getOAuthToken: () => 't', getProjectTriggers: () => [{ getHandlerFunction: () => 'tick' }, { getHandlerFunction: () => 'onGradebookEdit' }] }, CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    SpreadsheetApp: { openById: () => ss, create: () => ss }, DriveApp: { getFolderById: () => root, getFileById: id => files[id], createFolder: n => root.createFolder(n) },
    Utilities: { formatDate: (d, tz, f) => { const x = new Date(d.getTime() + 7 * 3600000), z = n => String(n).padStart(2, '0'); return f.replace('dd', z(x.getUTCDate())).replace('MM', z(x.getUTCMonth() + 1)).replace('yyyy', x.getUTCFullYear()).replace('HH', z(x.getUTCHours())).replace('mm', z(x.getUTCMinutes())).replace('ss', z(x.getUTCSeconds())); }, base64Decode: b => [...Buffer.from(b, 'base64')], newBlob: (data, mime, name) => ({ data, mime, name }) }, MimeType: { PLAIN_TEXT: 'text/plain' }, ContentService: { createTextOutput: t => ({ setMimeType() { return JSON.parse(t); } }), MimeType: { JSON: 'json' } }, HtmlService: {}
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { ctx, db, logs, ss, root, calls };
}

// 1) thuSoDiem() chạy trọn trên giả lập
{
  const { ctx, db, logs, ss, root } = makeEnv();
  ctx.thuSoDiem();
  logs.forEach(l => console.log('   │ ' + l));
  ok(logs.at(-1) === '=== SỔ ĐIỂM + MINH CHỨNG: ĐẠT TOÀN BỘ ===', 'thuSoDiem() in ĐẠT TOÀN BỘ');
  ok(!logs.some(l => l.startsWith('LỖI')), 'không có dòng LỖI');
  ok(logs.some(l => l.includes('Dán 2 điểm cùng lúc')), 'đã chạy ca dán 2 hàng');
  ok(Object.keys(db.exam_meta || {}).length === 0 && Object.keys(db.students || {}).length === 0, 'dọn sạch RTDB');
  ok(ss.sheets.length === 0, 'xóa tab sổ điểm thử');
  ok(root.kids.every(k => k.name !== '9SELFTEST' || k.trashed), 'đưa thư mục 9SELFTEST vào thùng rác');
}
// 2) Sửa điểm khi đề đã bị xóa khỏi Firebase → ghi chú rõ, không im lặng
{
  const { ctx, ss } = makeEnv();
  const sh = ss.insertSheet('de_da_xoa'); sh.appendRow(['UID']); sh.appendRow(['u1', 'HS1', 'A', '9A', 2, 5]);
  ctx.onGradebookEdit({ range: sh.getRange(2, 6) });
  ok(/không còn trên hệ thống/.test(sh.notes['2,6'] || ''), 'đề đã xóa → ô điểm có ghi chú "không còn trên hệ thống"');
}
// 3) Sửa cột khác (Họ tên) → bỏ qua
{
  const { ctx, ss, db } = makeEnv();
  const sh = ss.insertSheet('x'); sh.appendRow(['UID']); sh.appendRow(['u1']);
  ctx.onGradebookEdit({ range: sh.getRange(2, 3) });
  ok(!db.results, 'sửa cột Họ tên không ghi gì vào results');
}
// 4) Lỡ xóa FIREBASE_API_KEY / DB_URL trong Script properties → dùng mặc định, kiemTraHeThong vẫn ĐẠT, báo OAuth
{
  const { ctx, logs } = makeEnv({ props: { DB_SECRET: 'bi-mat' } });
  ctx.kiemTraHeThong(); logs.forEach(l => console.log('   │ ' + l));
  ok(logs.at(-1).includes('ĐẠT TOÀN BỘ'), 'thiếu cấu hình công khai → vẫn ĐẠT nhờ mặc định');
  ok(logs.some(l => l.includes('OAuth chủ dự án') && l.includes('nên xóa')), 'OAuth chạy được thì dùng OAuth và nhắc xóa DB_SECRET');
}
// 5) OAuth bị từ chối + có DB_SECRET → tự chuyển sang DB_SECRET
{
  const { ctx, logs, calls } = makeEnv({ props: { DB_SECRET: 'bi-mat' }, oauthRejected: true });
  ctx.kiemTraHeThong();
  ok(logs.some(l => l.includes('DB_SECRET dự phòng')) && calls.includes('secret'), 'OAuth bị từ chối → dùng DB_SECRET dự phòng');
}
// 6) Khóa API sai trong Script properties → báo LỖI rõ ràng
{
  const { ctx, logs } = makeEnv({ props: { FIREBASE_API_KEY: 'sai' } });
  ctx.kiemTraHeThong();
  ok(logs.some(l => l.startsWith('LỖI') && l.includes('khóa API sai')), 'khóa API sai → LỖI kèm cách sửa');
}
// 7) Học sinh nộp file, nộp lại khi Drive lỗi (không mất bản cũ), nộp muộn sau khi chốt (sổ điểm + minh chứng cập nhật)
{
  const env = makeEnv(); const { ctx, db } = env; const t = Date.now();
  const put = (p, v) => ctx.db_(p, 'put', v);
  put('students/u1', { student_id: 'HS1', name: 'An', class_code: '9A', grade: 9 });
  put('exam_meta/e1', { title: 'Đề', grade: 9, minutes: 10, opens_at: t - 30 * 60000, closes_at: t - 5 * 60000, max_attempts: 1, backend: 'firebase', parts: [{ key: 'theory', max: 4 }, { key: 'practice', max: 6 }] });
  put('exam_questions/e1', { q1: { order: 1, kind: 'choice', prompt: 'p', options: { A: 'a', B: 'b' }, points: 4 } });
  put('exam_secrets/e1', { q1: 'A' });
  put('sessions/e1/u1', { started_at: t - 20 * 60000, extra_ms: 0 });
  put('attempts/e1/u1/1', { submitted_at: t - 15 * 60000, answers: { q1: 'A' } });
  const post = b => ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ idToken: 'tok:u1' }, b)) } });
  ok(post({ action: 'grade_my_attempt', exam_id: 'e1', attempt: '1' }).earned === 4, 'grade_my_attempt trả 4 điểm');
  ctx.finalizeExam_('e1', db.exam_meta.e1, Date.now());
  ok(db.results.e1.u1.finalized === true, 'đề đã chốt (sau đóng + 2 phút)');
  const b64 = Buffer.from('PK-noi-dung').toString('base64');
  const up1 = post({ action: 'upload_practice', exam_id: 'e1', name: 'bai.xlsx', b64 });
  ok(up1.ok && up1.file_id, 'nộp file muộn (trong 10 phút) được nhận');
  const sh = env.ss.getSheetByName('e1');
  ok(sh && sh.cell(2, 10) === db.results.e1.u1.practice_file.url, 'nộp muộn → cột "File thực hành" trong sổ điểm có link');
  const ev = env.ctx.DriveApp.getFileById(db.results.e1.u1.evidence_id).getBlob().getDataAsString();
  ok(ev.includes('bai.xlsx'), 'nộp muộn → phiếu minh chứng ghi tên file');
  ok(post({ action: 'grade_my_attempt', exam_id: 'e1', attempt: '1' }).ok && db.results.e1.u1.status === 'needs_review', 'chấm lại sau khi chốt không ghi đè trạng thái');
  ok(post({ action: 'upload_practice', exam_id: 'e1', name: 'bai.exe', b64 }).retry === false, 'sai loại file → lỗi nghiệp vụ, không thử lại');
}
{
  const env = makeEnv({ driveFails: true }); const { ctx, db } = env; const t = Date.now();
  ctx.db_('students/u1', 'put', { student_id: 'HS1', name: 'An', class_code: '9A', grade: 9 });
  ctx.db_('exam_meta/e1', 'put', { title: 'Đề', closes_at: t + 60000, parts: [{ key: 'practice', max: 6 }] });
  ctx.db_('sessions/e1/u1', 'put', { started_at: t });
  const folder = ctx.studentFolder_('u1'); const oldFile = folder.createFile('thuc-hanh_e1.xlsx', 'BAN-CU'); let trashed = false; oldFile.setTrashed = () => { trashed = true; };
  const r = ctx.doPost({ postData: { contents: JSON.stringify({ idToken: 'tok:u1', action: 'upload_practice', exam_id: 'e1', name: 'moi.xlsx', b64: Buffer.from('x').toString('base64') }) } });
  ok(r.ok === false && r.retry === true, 'Drive lỗi → ok:false, retry:true');
  ok(!trashed, 'Drive lỗi khi nộp lại → bản đã nộp trước KHÔNG bị bỏ vào thùng rác');
}
// 8) Soạn đề trong tab DE_ của sổ điểm, tích ô B9 → phát hành
{
  const env = makeEnv(); const { ctx, db, ss } = env;
  const sh = ss.insertSheet('DE_thu');
  [['Mã đề', 'thu-01'], ['Tiêu đề', 'Thử'], ['Khối', 9], ['Số phút', 15], ['Mở lúc', '28/10/2030 07:30'], ['Đóng lúc', '28/10/2030 08:00'], ['Số lượt', 1], ['Điểm TH', 6], ['Phát hành', true],
   ['Mã câu', 'Loại', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án', 'Điểm', 'Chủ đề'],
   ['q1', 'choice', 'CPU?', 'CPU', 'RAM', '', '', 'A', 2, ''], ['q2', 'choice', 'Excel?', 'Word', 'Excel', '', '', 'b', 2, '']].forEach(r => sh.appendRow(r));
  ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  const m = db.exam_meta?.['thu-01'];
  ok(m && m.backend === 'firebase' && m.question_count === 2 && m.parts.length === 2 && m.parts[1].max === 6, 'tích B9 → đề lên Firebase (2 câu, thực hành 6)');
  ok(m && m.opens_at === Date.UTC(2030, 9, 28, 0, 30), '"28/10/2030 07:30" hiểu đúng giờ Việt Nam');
  ok(db.exam_secrets['thu-01'].q2 === 'B' && !JSON.stringify(db.exam_questions['thu-01']).includes('"answer"'), 'đáp án vào exam_secrets (chữ thường → hoa), không lộ trong exam_questions');
  ok(String(sh.cell(9, 3)).startsWith('✔') && sh.cell(9, 2) === false, 'C9 ghi kết quả ✔, ô tích tự bỏ');
  // Sửa ô F (phương án C) trong tab đề → không bị coi là sổ điểm
  ctx.onGradebookEdit({ range: sh.getRange(11, 6) });
  ok(!sh.notes['11,6'], 'sửa phương án trong tab đề không gắn ghi chú sổ điểm');
  // Đáp án không có trong phương án → báo ✘
  sh.put(12, 8, 'D'); sh.put(9, 2, true); ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  ok(String(sh.cell(9, 3)).startsWith('✘') && /đáp án "D"/.test(sh.cell(9, 3)), 'đáp án sai → C9 báo ✘ rõ câu nào');
  // Đề đã mở và có học sinh vào → không cho phát hành đè
  sh.put(12, 8, 'B'); ctx.db_('exam_meta/thu-01/opens_at', 'put', Date.now() - 60000); ctx.db_('sessions/thu-01/u1', 'put', { started_at: Date.now() });
  sh.put(9, 2, true); ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  ok(/Đã cập nhật thu-01 \(đề đang thi\)/.test(sh.cell(9, 3)), 'đề đang thi, câu hỏi giữ nguyên → cho cập nhật giờ (C9: ' + sh.cell(9, 3) + ')');
  // Gia hạn: đổi Số phút và Đóng lúc khi đang thi
  sh.put(4, 2, 25); sh.put(6, 2, '28/10/2030 09:00'); sh.put(9, 2, true); ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  ok(db.exam_meta['thu-01'].minutes === 25 && db.exam_meta['thu-01'].closes_at === Date.UTC(2030, 9, 28, 2, 0) && db.exam_meta['thu-01'].opens_at < Date.now(), 'gia hạn khi đang thi: Số phút 25, Đóng 09:00, giữ giờ mở');
  // Đổi câu hỏi khi đang thi → chặn
  sh.put(11, 3, 'CPU (sửa)?'); sh.put(9, 2, true); ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  ok(/không đổi được câu hỏi/.test(sh.cell(9, 3)) && db.exam_questions['thu-01'].q1.prompt === 'CPU?', 'đổi câu hỏi khi đang thi → chặn, đề trên Firebase giữ nguyên');
  // Đề đã chốt → chặn mọi sửa
  sh.put(11, 3, 'CPU?'); ctx.db_('exam_meta/thu-01/finalized_at', 'put', Date.now()); sh.put(9, 2, true); ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  ok(/đã đóng và chốt điểm/.test(sh.cell(9, 3)), 'đề đã chốt → không sửa được');
  // Ngày giờ sai định dạng
  const sh2 = ss.insertSheet('DE_sai'); [['Mã đề', 'x-02'], ['Tiêu đề', 'x'], ['Khối', 9], ['Số phút', 15], ['Mở lúc', 'sáng mai'], ['Đóng lúc', ''], ['', 1], ['', 0], ['', true], [], ['q1', 'choice', 'p', 'a', 'b', '', '', 'A', 1]].forEach(r => sh2.appendRow(r));
  ctx.onGradebookEdit({ range: sh2.getRange(9, 2) });
  ok(/ngày giờ/.test(sh2.cell(9, 3)), 'ngày giờ sai → hướng dẫn định dạng 28/10/2026 07:30');
}
// 9) Tab mẫu do taoMauDe() tạo phát hành được ngay
{
  const { ctx, db, ss } = makeEnv(); const sh = ctx.taoMauDe();
  ok(ss.getSheetByName('DE_mau') === sh, 'taoMauDe() tạo tab DE_mau');
  sh.put(9, 2, true); ctx.onGradebookEdit({ range: sh.getRange(9, 2) });
  ok(String(sh.cell(9, 3)).startsWith('✔') && db.exam_meta['thu-tin9-01']?.question_count === 2, 'tab mẫu phát hành được ngay (2 câu)');
  ok(ctx.taoMauDe() === sh, 'chạy lại taoMauDe() không tạo trùng');
}
console.log(failures ? `APPS SCRIPT GRADEBOOK: ${failures} lỗi` : 'APPS SCRIPT GRADEBOOK OK');
process.exit(failures ? 1 : 0);
