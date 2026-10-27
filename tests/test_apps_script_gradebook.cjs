// Chạy apps-script/exam/Code.gs trong Node với bản giả lập Apps Script (RTDB trong bộ nhớ, Sheet, Drive) để kiểm
// thuSoDiem(), onGradebookEdit (dán nhiều hàng, đề đã xóa) và finalizeExam_ trước khi người dùng chạy trên Google thật.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/exam/Code.gs'), 'utf8');
let failures = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failures++; };

function makeEnv() {
  const db = {}; const logs = [];
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), db);
  const fill = v => (Array.isArray(v) ? v.map(x => fill(x)) : v && typeof v === 'object' ? (v['.sv'] === 'timestamp' ? Date.now() : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]))) : v);
  const set = (p, v) => { const ks = p.split('/').filter(Boolean); let o = db; ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }); if (v === null || v === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = v; };
  const UrlFetchApp = { fetch(url, opt) {
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
    setBackground() { return this; } setFontWeight() { return this; } }
  class Sheet { constructor(name) { this.name = name; this.rows = []; this.notes = {}; }
    cell(r, c) { return (this.rows[r - 1] || [])[c - 1] ?? ''; } put(r, c, x) { (this.rows[r - 1] ||= [])[c - 1] = x; }
    getName() { return this.name; } getLastRow() { return this.rows.length; } appendRow(v) { this.rows.push([...v]); }
    getRange(a, c, nr, nc) { return typeof a === 'string' ? new Range(this, 1, 6) : new Range(this, a, c, nr, nc); }
    setFrozenRows() {} hideColumns() {} }
  const ss = { sheets: [], getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }, deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }, getId: () => 'ss1', getUrl: () => 'https://sheet' };
  // Drive giả
  const files = {}; let fid = 0;
  class Folder { constructor(name) { this.name = name; this.kids = []; this.files = []; this.trashed = false; this.id = 'd' + (++fid); }
    getFoldersByName(n) { const l = this.kids.filter(k => k.name === n && !k.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    createFolder(n) { const f = new Folder(n); this.kids.push(f); return f; }
    getFilesByName(n) { const l = this.files.filter(k => k.name === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; }
    createFile(n, text) { const id = 'f' + (++fid); const f = { name: n, text, getId: () => id, getUrl: () => 'https://drive/' + id, setContent(t) { this.text = t; }, setTrashed() {}, getBlob() { return { getDataAsString: () => f.text }; } }; files[id] = f; this.files.push(f); return f; }
    getId() { return this.id; } getUrl() { return 'https://drive/' + this.id; } setTrashed(t) { this.trashed = t; } }
  const root = new Folder('Bai thi Tin hoc');
  const props = { DB_URL: 'https://db.test', FIREBASE_API_KEY: 'k', GRADEBOOK_ID: 'ss1', DRIVE_ROOT_ID: root.id };
  const cache = {};
  const ctx = {
    UrlFetchApp, Logger: { log: m => logs.push(String(m)) }, console: { error: () => {}, log: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    ScriptApp: { getOAuthToken: () => 't' }, CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    SpreadsheetApp: { openById: () => ss, create: () => ss }, DriveApp: { getFolderById: () => root, getFileById: id => files[id], createFolder: n => root.createFolder(n) },
    Utilities: { formatDate: d => d.toISOString() }, MimeType: { PLAIN_TEXT: 'text/plain' }, ContentService: {}, HtmlService: {}
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { ctx, db, logs, ss, root };
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
console.log(failures ? `APPS SCRIPT GRADEBOOK: ${failures} lỗi` : 'APPS SCRIPT GRADEBOOK OK');
process.exit(failures ? 1 : 0);
