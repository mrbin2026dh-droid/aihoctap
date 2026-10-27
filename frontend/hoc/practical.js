// @ts-check
// Chấm bài thực hành Tin học trên trình duyệt GIÁO VIÊN (máy kiểm tra chính xác trước, AI chỉ gợi ý sau):
//  - Excel (.xlsx): tự đọc file (giải nén ZIP bằng DecompressionStream + đọc XML), lấy giá trị và công thức từng ô,
//    kiểm tra "ô có công thức chứa…", "ô có giá trị…". Không dùng thư viện ngoài.
//  - Python (.py/.txt): chạy mã của học sinh trong Pyodide (Python chạy trong trình duyệt) ở luồng riêng, có giới hạn thời gian,
//    so kết quả in ra với kết quả mong đợi do giáo viên nhập; kiểm tra "mã có từ khóa…".
// Kết quả mong đợi chỉ nằm ở Google Sheet của giáo viên, không bao giờ gửi cho học sinh.

export const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
export const KT_LABELS = {
  excel_formula: { label: 'Excel: ô/vùng có công thức chứa', a: 'Ô hoặc vùng (ví dụ D11 hoặc D2:D10)', b: 'Chứa (ví dụ SUM)' },
  excel_value: { label: 'Excel: ô có giá trị bằng', a: 'Ô (ví dụ D11)', b: 'Giá trị mong đợi (ví dụ 120)' },
  py_test: { label: 'Python: chạy với dữ liệu vào → kết quả in ra', a: 'Dữ liệu vào (mỗi dòng một lần nhập)', b: 'Kết quả mong đợi' },
  py_contains: { label: 'Python: mã có dùng', a: 'Từ khóa (ví dụ for)', b: '' }
};

/* ---------- Đọc ZIP + XLSX ---------- */
/** @param {Uint8Array} u8 @returns {Promise<Map<string, Uint8Array>>} */
export async function unzip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = new Map();
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('File không phải định dạng Excel .xlsx.');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count && n < 2000; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
    if (!/^(xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml))$/.test(name)) continue;
    const lstart = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u8.subarray(lstart, lstart + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
  }
  return out;
}
/** @typedef {{sheet:string, cells:Record<string,{v:string,f:string}>}} Sheet */
/** @param {ArrayBuffer|Uint8Array} buf @returns {Promise<Sheet[]>} */
export async function readXlsx(buf) {
  const files = await unzip(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const xml = (/** @type {string} */ n) => { const b = files.get(n); return b ? new DOMParser().parseFromString(new TextDecoder().decode(b), 'application/xml') : null; };
  const shared = [...(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') || [])].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent || '').join(''));
  const wb = xml('xl/workbook.xml'), rels = xml('xl/_rels/workbook.xml.rels');
  const relMap = new Map([...(rels?.getElementsByTagName('Relationship') || [])].map(r => [r.getAttribute('Id'), String(r.getAttribute('Target') || '').replace(/^\/?(xl\/)?/, '')]));
  const sheets = [...(wb?.getElementsByTagName('sheet') || [])].map((s, i) => ({ name: s.getAttribute('name') || `Sheet${i + 1}`, path: 'xl/' + (relMap.get(s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')) || `worksheets/sheet${i + 1}.xml`) }));
  if (!sheets.length) for (const k of files.keys()) { const m = k.match(/worksheets\/sheet(\d+)\.xml$/); if (m) sheets.push({ name: 'Sheet' + m[1], path: k }); }
  return sheets.map(sh => {
    /** @type {Record<string,{v:string,f:string}>} */ const cells = {};
    for (const c of [...(xml(sh.path)?.getElementsByTagName('c') || [])].slice(0, 20000)) {
      const r = String(c.getAttribute('r') || '').toUpperCase(); if (!r) continue;
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? '', f = c.getElementsByTagName('f')[0]?.textContent ?? '';
      const val = t === 's' ? (shared[Number(v)] ?? '') : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map(x => x.textContent || '').join('') : v;
      if (val === '' && !f) continue;
      cells[r] = { v: String(val), f: String(f) };
    }
    return { sheet: sh.name, cells };
  });
}
/** "D2:D10" → ["D2",…,"D10"]; "D11" → ["D11"]. @param {string} ref */
export function expandRange(ref) {
  const m = String(ref || '').toUpperCase().replace(/\$/g, '').trim().match(/^([A-Z]{1,3})(\d{1,6})(?::([A-Z]{1,3})(\d{1,6}))?$/);
  if (!m) return [];
  const col = (/** @type {string} */ s) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0), name = (/** @type {number} */ n) => { let s = ''; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const c1 = col(m[1]), r1 = Number(m[2]), c2 = m[3] ? col(m[3]) : c1, r2 = m[4] ? Number(m[4]) : r1, out = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) { out.push(name(c) + r); if (out.length > 500) return out; }
  return out;
}
/** Tìm ô trên mọi trang (ưu tiên trang đầu có ô đó). Cho phép "Sheet2!D5". @param {Sheet[]} sheets @param {string} ref */
function cellOf(sheets, ref) {
  const [sn, r] = String(ref).includes('!') ? String(ref).split('!') : ['', String(ref)];
  const list = sn ? sheets.filter(s => s.sheet.toLowerCase() === sn.replace(/'/g, '').toLowerCase()) : sheets;
  for (const s of list) { const c = s.cells[r.toUpperCase().replace(/\$/g, '')]; if (c) return c; }
  return null;
}
const sameValue = (/** @type {string} */ got, /** @type {string} */ want) => {
  const a = Number(String(got).replace(',', '.')), b = Number(String(want).replace(',', '.'));
  if (String(want).trim() !== '' && Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 1e-6);
  return String(got).trim().toLowerCase() === String(want).trim().toLowerCase();
};
/** Kiểm tra Excel. @param {Sheet[]} sheets @param {{type:string,a:string,b:string}} kt @returns {{ok:boolean, detail:string}} */
export function checkExcel(sheets, kt) {
  if (kt.type === 'excel_formula') {
    const [sn, rg] = String(kt.a).includes('!') ? String(kt.a).split('!') : ['', String(kt.a)];
    const refs = expandRange(rg); if (!refs.length) return { ok: false, detail: `Ô/vùng "${kt.a}" không hợp lệ` };
    const need = String(kt.b || '').toUpperCase().trim();
    const bad = refs.filter(r => { const c = cellOf(sheets, sn ? `${sn}!${r}` : r); return !c || !c.f || (need && !c.f.toUpperCase().includes(need)); });
    return bad.length ? { ok: false, detail: `Chưa đạt ở ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}` } : { ok: true, detail: `${refs.length} ô có công thức${need ? ' chứa ' + need : ''}` };
  }
  if (kt.type === 'excel_value') {
    const c = cellOf(sheets, kt.a);
    if (!c) return { ok: false, detail: `Ô ${kt.a} trống` };
    return sameValue(c.v, kt.b) ? { ok: true, detail: `${kt.a} = ${c.v}` } : { ok: false, detail: `${kt.a} = ${c.v} (mong đợi ${kt.b})` };
  }
  return { ok: false, detail: 'Không áp dụng cho file Excel' };
}
/** Bằng chứng gửi AI: các ô có dữ liệu (kèm công thức), tối đa ~300 ô. @param {Sheet[]} sheets */
export function excelEvidence(sheets) {
  const lines = []; let n = 0;
  for (const s of sheets) {
    lines.push(`[Trang ${s.sheet}]`);
    for (const [r, c] of Object.entries(s.cells)) { if (n++ > 300) { lines.push('…'); return lines.join('\n'); } lines.push(`${r}: ${c.f ? '=' + c.f + ' → ' : ''}${c.v.slice(0, 80)}`); }
  }
  return lines.join('\n');
}

/* ---------- Python (Pyodide trong luồng riêng, có giới hạn thời gian) ---------- */
const WORKER_SRC = (/** @type {string} */ base) => `
importScripts(${JSON.stringify(base + 'pyodide.js')});
let py = null;
self.onmessage = async e => {
  const { code, input } = e.data;
  try {
    if (!py) py = await loadPyodide({ indexURL: ${JSON.stringify(base)} });
    const lines = String(input || '').split(/\\r?\\n/); let out = '';
    py.setStdin({ stdin: () => lines.length ? lines.shift() : undefined });
    py.setStdout({ batched: s => { out += s + '\\n'; } }); py.setStderr({ batched: s => { out += s + '\\n'; } });
    await py.runPythonAsync(code);
    self.postMessage({ ok: true, out });
  } catch (err) { self.postMessage({ ok: false, out: String(err && err.message || err).split('\\n').slice(-3).join('\\n') }); }
};`;
/**
 * Chạy mã Python với dữ liệu vào; quá thời gian (vòng lặp vô hạn) thì dừng.
 * @param {string} code @param {string} input @param {number} [ms]
 * @returns {Promise<{ok:boolean,out:string,timeout?:boolean}>}
 */
export function runPython(code, input, ms = 15000) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC(PYODIDE_URL)], { type: 'text/javascript' }));
    const w = new Worker(url); let done = false;
    const end = (/** @type {any} */ r) => { if (done) return; done = true; clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve(r); };
    const t = setTimeout(() => end({ ok: false, out: 'Chạy quá lâu (có thể vòng lặp vô hạn).', timeout: true }), ms);
    w.onmessage = e => end(e.data); w.onerror = e => end({ ok: false, out: 'Không chạy được Python trên trình duyệt: ' + (e.message || 'lỗi tải Pyodide') });
    w.postMessage({ code, input });
  });
}
const norm = (/** @type {string} */ s) => String(s || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n').trim();
/** Kiểm tra Python. @param {string} code @param {{type:string,a:string,b:string}} kt */
export async function checkPython(code, kt) {
  if (kt.type === 'py_contains') { const k = String(kt.a || '').trim(); const ok = !!k && new RegExp(`(^|[^A-Za-z0-9_])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`).test(code); return { ok, detail: ok ? `Có dùng "${k}"` : `Chưa dùng "${k}"` }; }
  if (kt.type === 'py_test') {
    const r = await runPython(code, kt.a);
    if (!r.ok) return { ok: false, detail: (r.timeout ? '' : 'Lỗi: ') + r.out.slice(0, 200), out: r.out };
    const ok = norm(r.out) === norm(kt.b);
    return { ok, detail: ok ? 'Kết quả đúng' : `In ra "${norm(r.out).slice(0, 80)}" (mong đợi "${norm(kt.b).slice(0, 80)}")`, out: r.out };
  }
  return { ok: false, detail: 'Không áp dụng cho bài Python' };
}

/**
 * Chấm tự động một bài: trả kết quả từng tiêu chí + bằng chứng (gửi AI) + bản xem trước.
 * @param {{loai:string,tieu_chi:{mo_ta:string,diem:number,kt:{type:string,a:string,b:string}|null}[]}} th
 * @param {{ten:string,data:string}} file base64
 */
export async function autoGrade(th, file) {
  const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
  const isX = /\.xlsx$/i.test(file.ten), isPy = /\.(py|txt)$/i.test(file.ten);
  /** @type {{ok:boolean|null, detail:string}[]} */ const results = []; let evidence = '', preview = '', kind = 'khac';
  if (isX) {
    kind = 'excel';
    let sheets = []; try { sheets = await readXlsx(bytes); } catch (e) { return { kind, results: th.tieu_chi.map(() => ({ ok: null, detail: 'Không đọc được file Excel' })), evidence: '', preview: e instanceof Error ? e.message : '' }; }
    evidence = excelEvidence(sheets); preview = evidence.split('\n').slice(0, 40).join('\n');
    for (const t of th.tieu_chi) results.push(t.kt && t.kt.type.startsWith('excel_') ? checkExcel(sheets, t.kt) : { ok: null, detail: 'Chấm tay / AI gợi ý' });
  } else if (isPy) {
    kind = 'python';
    const code = new TextDecoder().decode(bytes).slice(0, 20000); preview = code.split('\n').slice(0, 60).join('\n');
    const runs = [];
    for (const t of th.tieu_chi) {
      if (t.kt && t.kt.type.startsWith('py_')) { const r = await checkPython(code, t.kt); results.push(r); if (t.kt.type === 'py_test') runs.push(`Chạy với dữ liệu vào "${t.kt.a.slice(0, 60)}": ${r.ok ? 'đúng' : r.detail}`); }
      else results.push({ ok: null, detail: 'Chấm tay / AI gợi ý' });
    }
    evidence = `MÃ NGUỒN:\n${code.slice(0, 6000)}${runs.length ? '\n\nKẾT QUẢ CHẠY:\n' + runs.join('\n') : ''}`;
  } else {
    for (const _ of th.tieu_chi) results.push({ ok: null, detail: 'Loại file này chấm tay' });
    preview = 'Loại file này máy chưa đọc tự động được. Thầy cô mở file trong thư mục Drive để chấm.';
  }
  return { kind, results, evidence, preview };
}
