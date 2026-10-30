// Kiểm luật BẢNG THI ĐUA (30/10/2026): quiz_kq_lop chỉ giáo viên có khóa phòng (quiz_key + quiz_proof) ghi được, ghi một lần,
// dữ liệu hợp lệ (số câu đúng ≤ số câu); quiz_ls là nhánh riêng của giáo viên (đường dẫn bí mật 64 ký tự).
// Chạy: cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thidua.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update } from 'firebase/database';
const file = process.env.RULES_FILE; if (!file) { console.error('Thiếu RULES_FILE'); process.exit(2); }
const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap', database: { host: '127.0.0.1', port: 9099, rules: readFileSync(file, 'utf8') } });
const KEY = 'a'.repeat(48);
await env.withSecurityRulesDisabled(async c => { await set(ref(c.database()), { quiz_key: { '123456': KEY }, quiz_proof: { '123456': KEY + '|0' } }); });
const db = env.unauthenticatedContext().database();
const REC = { at: Date.now(), bo: 'Ôn nhanh', so_cau: 5, kq: { hs01: { c: 4, ten: 'Em A' }, hs02: { c: 5, ten: 'Em B' } } };
let fail = 0, p = 1;
const proof = (k = KEY) => `${k}|${(p++).toString(36)}`;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
await c('đọc công khai (học sinh xem bảng của lớp)', () => assertSucceeds(get(ref(db, 'quiz_kq_lop/9a/2026-11'))));
await c('ghi kèm khóa phòng đúng → được', () => assertSucceeds(update(ref(db), { 'quiz_kq_lop/9a/2026-11/123456': REC, 'quiz_proof/123456': proof() })));
await c('ghi đè buổi đã lưu → chặn (kết quả không sửa được)', () => assertFails(update(ref(db), { 'quiz_kq_lop/9a/2026-11/123456': { ...REC, kq: { hs01: { c: 5, ten: 'Em A' } } }, 'quiz_proof/123456': proof() })));
await c('không có khóa phòng → chặn', () => assertFails(set(ref(db, 'quiz_kq_lop/9b/2026-11/123456'), REC)));
await c('khóa sai → chặn', () => assertFails(update(ref(db), { 'quiz_kq_lop/9b/2026-11/123456': REC, 'quiz_proof/123456': proof('b'.repeat(48)) })));
await c('phòng không tồn tại → chặn', () => assertFails(update(ref(db), { 'quiz_kq_lop/9b/2026-11/654321': REC, 'quiz_proof/654321': proof() })));
await c('số câu đúng > số câu → chặn', () => assertFails(update(ref(db), { 'quiz_kq_lop/9c/2026-11/123456': { ...REC, kq: { hs01: { c: 6, ten: 'X' } } }, 'quiz_proof/123456': proof() })));
await c('tháng sai dạng → chặn', () => assertFails(update(ref(db), { 'quiz_kq_lop/9c/2026-13/123456': REC, 'quiz_proof/123456': proof() })));
await c('trường lạ → chặn', () => assertFails(update(ref(db), { 'quiz_kq_lop/9c/2026-11/123456': { ...REC, hack: 1 }, 'quiz_proof/123456': proof() })));
await c('giáo viên bỏ buổi khỏi thi đua (có khóa) → được', () => assertSucceeds(update(ref(db), { 'quiz_kq_lop/9a/2026-11/123456': null, 'quiz_proof/123456': proof() })));
await c('học sinh tự xóa buổi (không khóa) → chặn', async () => { await update(ref(db), { 'quiz_kq_lop/9a/2026-11/123456': REC, 'quiz_proof/123456': proof() }); await assertFails(set(ref(db, 'quiz_kq_lop/9a/2026-11/123456'), null)); });
const OW = 'f'.repeat(64);
await c('quiz_ls: không liệt kê được', () => assertFails(get(ref(db, 'quiz_ls'))));
await c('quiz_ls: đường dẫn bí mật 64 ký tự đọc/ghi được', async () => { await assertSucceeds(set(ref(db, `quiz_ls/${OW}/123456`), { at: 1, key: KEY })); await assertSucceeds(get(ref(db, `quiz_ls/${OW}`))); });
await c('quiz_ls: đường dẫn ngắn → chặn', () => assertFails(set(ref(db, 'quiz_ls/abc/1'), { at: 1 })));
await env.cleanup();
console.log(fail ? `THI DUA RULES: ${fail} FAIL` : 'THI DUA RULES OK');
process.exit(fail ? 1 : 0);
