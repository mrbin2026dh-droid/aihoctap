// Kiểm luật GỘP (đang/sẽ publish) trên Emulator: nhánh ứng dụng cũ chặn tài khoản hệ thống thi mới, vẫn mở cho tài khoản cũ.
// Chạy: cd spike/step0/emulator && npm run test:merged
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';
const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap',
  database: { host: '127.0.0.1', port: 9099, rules: readFileSync(new URL('../database.rules.merged.json', import.meta.url), 'utf8') } });
const LEGACY = ['rooms', 'remoteCommand', 'activeSession', 'lessons', 'sessionHistory', 'lessonPlans', 'questionBank'];
await env.withSecurityRulesDisabled(async c => { await set(ref(c.database()), Object.fromEntries(LEGACY.map(k => [k, { x: { v: 1 } }]))); });
const student = env.authenticatedContext('hs01', { email: 'hs01@hs.aihoc.test' }).database();
const examTeacher = env.authenticatedContext('gv01', { email: 'gv_gv01@hs.aihoc.test' }).database();
const legacyUser = env.authenticatedContext('old1', { email: 'giaovien@gmail.com' }).database();
const anon = env.authenticatedContext('anon1', {}).database();
const guest = env.unauthenticatedContext().database();
// Vé do Worker cấp (custom token có claim role, không có email) — app mới: học sinh đăng nhập bằng Google Sheet, giáo viên bằng PIN.
const wStudent = env.authenticatedContext('HS01', { role: 'student', class_code: '9A', grade: 9 }).database();
const wStudent2 = env.authenticatedContext('hs9a02', { role: 'student', class_code: '9A', grade: 9 }).database();
const wTeacher = env.authenticatedContext('teacher_admin', { role: 'teacher' }).database();
let fail = 0;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
for (const k of LEGACY) {
  await c(`${k}: học sinh hệ thống thi đọc → chặn`, () => assertFails(get(ref(student, k))));
  await c(`${k}: học sinh hệ thống thi ghi → chặn`, () => assertFails(set(ref(student, k + '/x/v'), 2)));
  await c(`${k}: giáo viên hệ thống thi (gv_) đọc → chặn`, () => assertFails(get(ref(examTeacher, k))));
  await c(`${k}: tài khoản ứng dụng cũ đọc/ghi → được`, async () => { await assertSucceeds(get(ref(legacyUser, k))); await assertSucceeds(set(ref(legacyUser, k + '/x/v'), 3)); });
  await c(`${k}: tài khoản ẩn danh (ứng dụng cũ) đọc → được`, () => assertSucceeds(get(ref(anon, k))));
  await c(`${k}: chưa đăng nhập → chặn`, () => assertFails(get(ref(guest, k))));
  await c(`${k}: học sinh vé Worker đọc/ghi → chặn`, async () => { await assertFails(get(ref(wStudent, k))); await assertFails(set(ref(wStudent, k + '/x/v'), 4)); });
  await c(`${k}: giáo viên vé Worker đọc → chặn`, () => assertFails(get(ref(wTeacher, k))));
}
// presence: trạng thái trực tuyến
const P = { name: 'Nguyễn Văn An', lop: '9A', state: 'hoc', at: Date.now() };
await c('presence: học sinh ghi trạng thái của mình → được', () => assertSucceeds(set(ref(wStudent, 'presence/HS01'), P)));
await c('presence: học sinh ghi hộ bạn → chặn', () => assertFails(set(ref(wStudent, 'presence/hs9a02'), P)));
await c('presence: học sinh đọc danh sách → chặn', () => assertFails(get(ref(wStudent, 'presence'))));
await c('presence: học sinh đọc của chính mình → chặn (chỉ giáo viên đọc)', () => assertFails(get(ref(wStudent, 'presence/HS01'))));
await c('presence: trạng thái lạ → chặn', () => assertFails(set(ref(wStudent, 'presence/HS01'), { ...P, state: 'hack' })));
await c('presence: thêm trường lạ → chặn', () => assertFails(set(ref(wStudent, 'presence/HS01'), { ...P, score: 10 })));
await c('presence: thời điểm tương lai xa → chặn', () => assertFails(set(ref(wStudent, 'presence/HS01'), { ...P, at: Date.now() + 3600e3 })));
await c('presence: các trạng thái hợp lệ → được', async () => { for (const st of ['phong_cho', 'dang_thi', 'da_nop', 'offline']) await assertSucceeds(set(ref(wStudent2, 'presence/hs9a02'), { ...P, state: st })); });
await c('presence: giáo viên vé Worker đọc → được', () => assertSucceeds(get(ref(wTeacher, 'presence'))));
await c('presence: giáo viên xóa danh sách → được', () => assertSucceeds(set(ref(wTeacher, 'presence'), null)));
await c('presence: tài khoản ứng dụng cũ đọc/ghi → chặn', async () => { await assertFails(get(ref(legacyUser, 'presence'))); await assertFails(set(ref(legacyUser, 'presence/old1'), P)); });
await c('presence: học sinh hệ thống thi cũ (@hs.aihoc.test) → chặn', () => assertFails(set(ref(student, 'presence/hs01'), P)));
await c('presence: chưa đăng nhập → chặn', () => assertFails(get(ref(guest, 'presence'))));
await env.cleanup();
console.log(fail ? `${fail} CA SAI` : `TẤT CẢ ${LEGACY.length * 8 + 13} CA ĐÚNG`);
process.exit(fail ? 1 : 0);
