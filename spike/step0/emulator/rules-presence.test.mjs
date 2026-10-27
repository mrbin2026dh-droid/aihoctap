// Luật của dự án Firebase RIÊNG cho trạng thái trực tuyến (database.rules.presence.json): chỉ có nhánh presence, mọi thứ khác đóng.
// Chạy: cd spike/step0/emulator && npx firebase emulators:exec --only database --project demo-aihoctap "node rules-presence.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';
const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap', database: { host: '127.0.0.1', port: 9099, rules: readFileSync(new URL('../database.rules.presence.json', import.meta.url), 'utf8') } });
const s1 = env.authenticatedContext('HS01', { role: 'student', class_code: '9A' }).database();
const s2 = env.authenticatedContext('hs9a02', { role: 'student', class_code: '9A' }).database();
const gv = env.authenticatedContext('teacher_admin', { role: 'teacher' }).database();
const other = env.authenticatedContext('x', { email: 'a@b.c' }).database();
const guest = env.unauthenticatedContext().database();
const P = { name: 'Nguyễn Văn An', lop: '9A', state: 'hoc', at: Date.now() };
let fail = 0;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
await c('học sinh ghi trạng thái của mình', () => assertSucceeds(set(ref(s1, 'presence/HS01'), P)));
await c('học sinh ghi hộ bạn → chặn', () => assertFails(set(ref(s1, 'presence/hs9a02'), P)));
await c('học sinh đọc danh sách → chặn', () => assertFails(get(ref(s1, 'presence'))));
await c('học sinh đọc của chính mình → chặn', () => assertFails(get(ref(s1, 'presence/HS01'))));
await c('trạng thái lạ → chặn', () => assertFails(set(ref(s1, 'presence/HS01'), { ...P, state: 'hack' })));
await c('thêm trường lạ → chặn', () => assertFails(set(ref(s1, 'presence/HS01'), { ...P, score: 10 })));
await c('giờ tương lai xa → chặn', () => assertFails(set(ref(s1, 'presence/HS01'), { ...P, at: Date.now() + 3600e3 })));
await c('đủ 5 trạng thái hợp lệ', async () => { for (const st of ['hoc', 'phong_cho', 'dang_thi', 'da_nop', 'offline']) await assertSucceeds(set(ref(s2, 'presence/hs9a02'), { ...P, state: st })); });
await c('giáo viên đọc toàn bộ', () => assertSucceeds(get(ref(gv, 'presence'))));
await c('giáo viên xóa toàn bộ', () => assertSucceeds(set(ref(gv, 'presence'), null)));
await c('tài khoản không có vai trò → chặn đọc/ghi', async () => { await assertFails(get(ref(other, 'presence'))); await assertFails(set(ref(other, 'presence/x'), P)); });
await c('chưa đăng nhập → chặn', async () => { await assertFails(get(ref(guest, 'presence'))); await assertFails(set(ref(guest, 'presence/HS01'), P)); });
await c('nhánh khác presence đều đóng (học sinh, giáo viên)', async () => { for (const db of [s1, gv]) { await assertFails(get(ref(db, 'students'))); await assertFails(set(ref(db, 'results/x'), { a: 1 })); await assertFails(set(ref(db, 'questionBank/x'), { a: 1 })); } });
await env.cleanup();
console.log(fail ? `${fail} CA SAI` : 'TẤT CẢ 13 CA ĐÚNG'); process.exit(fail ? 1 : 0);
