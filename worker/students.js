// Kiểm tra dữ liệu tài khoản học sinh (thêm tay hoặc nhập Excel). Chạy ở máy chủ nên là bản quyết định.
export const STUDENT_ID_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;
export const MAX_IMPORT_STUDENTS = 300;

/**
 * @param {any} raw {student_id?, name, grade, class_code, pin?}
 * @returns {{error:string}|{student:{id:string|null,name:string,grade:number,class_code:string,pin:string|null}}}
 */
export function validateStudentInput(raw) {
  const body = raw && typeof raw === 'object' ? raw : {};
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (!name || name.length > 60) return {error: 'Họ và tên học sinh phải từ 1 đến 60 ký tự.'};
  const grade = Number(body.grade);
  if (!Number.isInteger(grade) || grade < 6 || grade > 12) return {error: 'Khối lớp không hợp lệ (phải từ 6 đến 12).'};
  const cls = typeof body.class_code === 'string' ? body.class_code.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,10}$/.test(cls)) return {error: 'Mã lớp không hợp lệ (1-10 ký tự chữ, số hoặc gạch nối).'};
  let id = null;
  const idRaw = body.student_id ?? body.id;
  if (idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== '') {
    id = String(idRaw).trim().toLowerCase();
    if (!STUDENT_ID_RE.test(id)) return {error: 'Mã học sinh gồm 3 đến 20 ký tự: chữ thường không dấu, số, gạch nối hoặc gạch dưới, bắt đầu bằng chữ hoặc số.'};
  }
  let pin = null;
  if (body.pin !== undefined && body.pin !== null && String(body.pin).trim() !== '') {
    pin = String(body.pin).trim();
    if (pin.length < 6) return {error: 'Mã PIN học sinh phải có độ dài tối thiểu 6 ký tự.'};
    if (pin.length > 16) return {error: 'Mã PIN học sinh tối đa 16 ký tự.'};
  }
  return {student: {id, name, grade, class_code: cls.toUpperCase(), pin}};
}
