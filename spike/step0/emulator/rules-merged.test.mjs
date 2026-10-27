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
let fail = 0;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
for (const k of LEGACY) {
  await c(`${k}: học sinh hệ thống thi đọc → chặn`, () => assertFails(get(ref(student, k))));
  await c(`${k}: học sinh hệ thống thi ghi → chặn`, () => assertFails(set(ref(student, k + '/x/v'), 2)));
  await c(`${k}: giáo viên hệ thống thi (gv_) đọc → chặn`, () => assertFails(get(ref(examTeacher, k))));
  await c(`${k}: tài khoản ứng dụng cũ đọc/ghi → được`, async () => { await assertSucceeds(get(ref(legacyUser, k))); await assertSucceeds(set(ref(legacyUser, k + '/x/v'), 3)); });
  await c(`${k}: tài khoản ẩn danh (ứng dụng cũ) đọc → được`, () => assertSucceeds(get(ref(anon, k))));
  await c(`${k}: chưa đăng nhập → chặn`, () => assertFails(get(ref(guest, k))));
}
await env.cleanup();
console.log(fail ? `${fail} CA SAI` : `TẤT CẢ ${LEGACY.length * 6} CA ĐÚNG`);
process.exit(fail ? 1 : 0);
