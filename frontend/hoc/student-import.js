// @ts-check
// Đọc file Excel tài khoản học sinh: đúng mẫu, kiểm tra từng dòng. Máy chủ vẫn kiểm tra lại lần cuối.
export const STUDENT_COLUMNS = ['Mã học sinh', 'Họ và tên', 'Khối', 'Lớp', 'Mã PIN'];
export const MAX_STUDENTS = 300;
const ID_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;
/** @param {unknown} v */
const text = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
/** @param {string} s */
const norm = s => s.toLowerCase().normalize('NFC');

/** @typedef {{row:number, student_id:string, name:string, grade:number, class_code:string, pin:string, errors:string[]}} StudentRow */

/** Dữ liệu file mẫu: sheet "Học sinh" và sheet "Hướng dẫn". */
export function templateRows() {
  return {
    students: [STUDENT_COLUMNS, ['hs9a01', 'Nguyễn Văn An', 9, '9A1', '246810'], ['', 'Trần Thị Bình', 9, '9A1', '']],
    guide: [['Hướng dẫn điền file'],
      ['1. Giữ nguyên dòng tiêu đề (dòng 1), mỗi học sinh một dòng.'],
      ['2. Mã học sinh: tùy chọn. Gồm 3 đến 20 ký tự chữ thường không dấu, số, gạch nối hoặc gạch dưới. Để trống thì hệ thống tự sinh. Mã không được trùng với tài khoản đã có.'],
      ['3. Họ và tên: bắt buộc, tối đa 60 ký tự.'],
      ['4. Khối: số từ 6 đến 12.'],
      ['5. Lớp: bắt buộc, 1 đến 10 ký tự chữ, số hoặc gạch nối (ví dụ 9A1).'],
      ['6. Mã PIN: tùy chọn, từ 6 đến 16 ký tự. Để trống thì hệ thống tự sinh 6 chữ số. Nên để định dạng ô là văn bản để không mất số 0 ở đầu.'],
      [`7. Mỗi lần nhập tối đa ${MAX_STUDENTS} học sinh. Học sinh được yêu cầu đổi PIN ở lần đăng nhập đầu tiên.`]]
  };
}

/**
 * @param {unknown[][]} rows toàn bộ sheet (dòng 1 là tiêu đề)
 * @returns {{rows:StudentRow[], fatal:string, ok:number}}
 */
export function parseStudentRows(rows) {
  /** @type {StudentRow[]} */ const out = [];
  const fail = (/** @type {string} */ fatal) => ({rows: out, fatal, ok: 0});
  if (!Array.isArray(rows) || !rows.length) return fail('File trống. Hãy tải mẫu Excel và điền danh sách học sinh.');
  const header = (rows[0] || []).map(text);
  for (let i = 0; i < STUDENT_COLUMNS.length; i++) {
    if (norm(header[i] || '') !== norm(STUDENT_COLUMNS[i])) return fail(`File không đúng mẫu: cột ${i + 1} phải là "${STUDENT_COLUMNS[i]}". Hãy tải mẫu Excel mới và điền vào mẫu.`);
  }
  /** @type {Map<string, number>} */ const seen = new Map();
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r] || [];
    if (!line.some(cell => text(cell))) continue;
    /** @type {string[]} */ const errors = [];
    const id = text(line[0]).toLowerCase(); const name = text(line[1]); const gradeRaw = text(line[2]); const cls = text(line[3]); const pin = text(line[4]);
    if (id && !ID_RE.test(id)) errors.push('Mã học sinh gồm 3-20 ký tự: chữ thường không dấu, số, - hoặc _');
    if (id && ID_RE.test(id)) { if (seen.has(id)) errors.push(`Mã trùng với dòng ${seen.get(id)}`); else seen.set(id, r + 1); }
    if (!name) errors.push('Thiếu họ và tên'); else if (name.length > 60) errors.push('Họ và tên dài quá 60 ký tự');
    const grade = Number(gradeRaw.replace(/^lớp\s*/i, ''));
    if (!Number.isInteger(grade) || grade < 6 || grade > 12) errors.push('Khối phải là số từ 6 đến 12');
    if (!/^[A-Za-z0-9_-]{1,10}$/.test(cls)) errors.push('Lớp gồm 1-10 ký tự chữ, số hoặc gạch nối');
    if (pin && (pin.length < 6 || pin.length > 16)) errors.push('PIN phải từ 6 đến 16 ký tự');
    out.push({row: r + 1, student_id: id, name, grade, class_code: cls, pin, errors});
  }
  if (!out.length) return fail('File chưa có học sinh nào. Hãy điền từ dòng 2.');
  if (out.length > MAX_STUDENTS) return {rows: out, fatal: `File có ${out.length} học sinh, nhiều hơn mức ${MAX_STUDENTS} mỗi lần. Hãy tách file.`, ok: 0};
  return {rows: out, fatal: '', ok: out.filter(x => !x.errors.length).length};
}
