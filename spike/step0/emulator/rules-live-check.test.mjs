// Kiểm LUẬT THẬT của dự án Firebase sau khi thêm nhánh presence: vé của học sinh/giáo viên do Worker cấp (có claim role, không có email)
// chỉ được dùng đúng nhánh presence; MỌI nhánh khác của luật phải vẫn đóng với họ.
// Chạy: cd spike/step0/emulator && RULES_FILE=<đường dẫn file luật đã gộp> npx firebase emulators:exec --only database --project demo-aihoctap "node rules-live-check.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';
const file = process.env.RULES_FILE; if (!file) { console.error('Thiếu RULES_FILE'); process.exit(2); }
const text = readFileSync(file, 'utf8'), keys = Object.keys(JSON.parse(text).rules).filter(k => !k.startsWith('.') && k !== 'presence');
const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap', database: { host: '127.0.0.1', port: 9099, rules: text } });
await env.withSecurityRulesDisabled(async c => { await set(ref(c.database()), Object.fromEntries(keys.map(k => [k, { x: { v: 1 } }]))); });
const stu = env.authenticatedContext('HS01', { role: 'student', class_code: '9A', grade: 9 }).database();
const gv = env.authenticatedContext('teacher_admin', { role: 'teacher' }).database();
const P = { name: 'An', lop: '9A', state: 'hoc', at: Date.now() };
let fail = 0;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
await c('presence: học sinh ghi của mình', () => assertSucceeds(set(ref(stu, 'presence/HS01'), P)));
await c('presence: học sinh ghi hộ bạn → chặn', () => assertFails(set(ref(stu, 'presence/hs9a02'), P)));
await c('presence: học sinh đọc → chặn', () => assertFails(get(ref(stu, 'presence'))));
await c('presence: trạng thái lạ → chặn', () => assertFails(set(ref(stu, 'presence/HS01'), { ...P, state: 'hack' })));
await c('presence: giáo viên đọc → được', () => assertSucceeds(get(ref(gv, 'presence'))));
for (const k of keys) {
  await c(`${k}: học sinh (vé Worker) đọc → chặn`, () => assertFails(get(ref(stu, k))));
  await c(`${k}: học sinh (vé Worker) ghi → chặn`, () => assertFails(set(ref(stu, k + '/x/v'), 2)));
  await c(`${k}: giáo viên (vé Worker) ghi → chặn`, () => assertFails(set(ref(gv, k + '/x/v'), 2)));
}
await c('gốc: học sinh đọc toàn bộ → chặn', () => assertFails(get(ref(stu))));
await env.cleanup();
console.log(fail ? `${fail} CA SAI — KHÔNG ĐĂNG LUẬT NÀY` : `TẤT CẢ ${5 + keys.length * 3 + 1} CA ĐÚNG (${keys.length} nhánh khác đã kiểm)`); process.exit(fail ? 1 : 0);
