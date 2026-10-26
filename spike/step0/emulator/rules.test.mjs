// Kiểm luật RTDB v2 trên Firebase Emulator THẬT (không mô phỏng). Chạy: cd spike/step0/emulator && npm i && npm test
// Cần Java 11+. In ra từng ca; thoát mã 1 nếu có ca sai.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update, serverTimestamp } from 'firebase/database';

const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap',
  database: { host: '127.0.0.1', port: 9099, rules: readFileSync(new URL('../database.rules.v2.json', import.meta.url), 'utf8') } });
const T = 'gv01', A = 'hs01', B = 'hs02', C8 = 'hs8';
const now = Date.now(), MIN = 60000;
async function seed(meta) {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async c => { await set(ref(c.database()), {
    teachers: { [T]: true },
    students: { [A]: { grade: 9, name: 'An', class_code: '9A' }, [B]: { grade: 9, name: 'Bình', class_code: '9A' }, [C8]: { grade: 8, name: 'Chi', class_code: '8A' } },
    exam_meta: { e1: { title: 'GK', grade: 9, minutes: 45, max_attempts: 1, ...meta.e1 }, e2: { title: 'LT', grade: 9, minutes: 45, max_attempts: 2, opens_at: now - MIN, closes_at: now + 60 * MIN } },
    exam_questions: { e1: { q1: { prompt: 'CPU?', options: { A: 'CPU', B: 'RAM' } } }, e2: { q1: { prompt: 'x', options: { A: 'a' } } } },
    exam_secrets: { e1: { q1: 'A' } } }); });
}
const db = uid => env.authenticatedContext(uid).database();
const sess = { started_at: serverTimestamp(), extra_ms: 0 };
const ans = (a = { q1: 'A' }) => ({ submitted_at: serverTimestamp(), answers: a });
let fail = 0; const cases = [];
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } cases.push(name); }
const open = { opens_at: now - MIN, closes_at: now + 60 * MIN };

await seed({ e1: { opens_at: now + 60 * MIN, closes_at: now + 120 * MIN } });
await c('1.1 đọc đề trước giờ mở → chặn', () => assertFails(get(ref(db(A), 'exam_questions/e1'))));
await c('1.5 giáo viên đọc đề mọi lúc → được', () => assertSucceeds(get(ref(db(T), 'exam_questions/e1'))));
await c('2.1 tạo phiên trước giờ mở → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + A), sess)));
await c('0.1 đọc đáp án exam_secrets → chặn', () => assertFails(get(ref(db(A), 'exam_secrets/e1'))));
await c('0.2 giáo viên đọc exam_secrets từ client → chặn (chỉ Apps Script)', () => assertFails(get(ref(db(T), 'exam_secrets/e1'))));
await c('0.3 đọc cả cây exam_questions → chặn', () => assertFails(get(ref(db(A), 'exam_questions'))));
await c('0.5 giáo viên đọc danh sách học sinh → được', () => assertSucceeds(get(ref(db(T), 'students'))));
await c('0.6 học sinh đọc danh sách học sinh → chặn', () => assertFails(get(ref(db(A), 'students'))));
await c('0.7 giáo viên tự kiểm quyền teachers/{uid} → được', () => assertSucceeds(get(ref(db(T), 'teachers/' + T))));
await c('0.8 học sinh đọc cả nút teachers → chặn', () => assertFails(get(ref(db(A), 'teachers'))));
await c('0.4 học sinh tự sửa students/ của mình → chặn', () => assertFails(update(ref(db(A), 'students/' + A), { grade: 8 })));

await seed({ e1: open });
await c('1.2 đọc đề đúng giờ đúng khối → được', () => assertSucceeds(get(ref(db(A), 'exam_questions/e1'))));
await c('1.3 khối 8 đọc đề khối 9 → chặn', () => assertFails(get(ref(db(C8), 'exam_questions/e1'))));
await c('2.4 tạo phiên cho uid người khác → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + B), sess)));
await c('2.5 tạo phiên với started_at do client tự đặt → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + A), { started_at: now - 40 * MIN, extra_ms: 0 })));
await c('2.6 tạo phiên tự cộng extra_ms → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + A), { started_at: serverTimestamp(), extra_ms: 600000 })));
await c('2.7 tạo phiên thiếu extra_ms → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + A), { started_at: serverTimestamp() })));
await c('2.2 tạo phiên đúng giờ → được', () => assertSucceeds(set(ref(db(A), 'sessions/e1/' + A), sess)));
await c('2.3 tạo phiên lần 2 → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + A), sess)));
await c('4.1 lưu nháp → được', () => assertSucceeds(set(ref(db(A), 'drafts/e1/' + A), { updated_at: serverTimestamp(), answers: { q1: 'B' } })));
await c('4.4 nháp có leaves (số lần rời tab) → được', () => assertSucceeds(set(ref(db(A), 'drafts/e1/' + A), { updated_at: serverTimestamp(), answers: { q1: 'B' }, leaves: 2 })));
await c('7.1 ghi đồng hồ clock/{uid} bằng giờ máy chủ → được', () => assertSucceeds(set(ref(db(A), 'clock/' + A), serverTimestamp())));
await c('7.2 ghi clock/{uid} bằng giờ tự đặt → chặn', () => assertFails(set(ref(db(A), 'clock/' + A), now - 999999)));
await c('7.3 ghi clock của người khác → chặn', () => assertFails(set(ref(db(A), 'clock/' + B), serverTimestamp())));
await c('4.2 nháp có trường lạ → chặn', () => assertFails(set(ref(db(A), 'drafts/e1/' + A), { updated_at: serverTimestamp(), answers: { q1: 'B' }, score: 10 })));
await c('3.13 nộp bài khi chưa tạo phiên → chặn', () => assertFails(set(ref(db(B), 'attempts/e1/' + B + '/1'), ans())));
await c('3.4 câu trả lời 2500 ký tự → chặn', () => assertFails(set(ref(db(A), 'attempts/e1/' + A + '/1'), ans({ q1: 'x'.repeat(2500) }))));
await c('3.8 bài nộp có trường lạ (score) → chặn', () => assertFails(set(ref(db(A), 'attempts/e1/' + A + '/1'), { ...ans(), score: 10 })));
await c('3.1 nộp lần 1 trong giờ → được', () => assertSucceeds(set(ref(db(A), 'attempts/e1/' + A + '/1'), ans())));
await c('3.5 nộp đè lần 1 → chặn', () => assertFails(set(ref(db(A), 'attempts/e1/' + A + '/1'), ans({ q1: 'B' }))));
await c('3.6 nộp lần 2 khi max_attempts=1 → chặn', () => assertFails(set(ref(db(A), 'attempts/e1/' + A + '/2'), ans())));
await c('3.9 học sinh đọc bài nộp của bạn → chặn', () => assertFails(get(ref(db(B), 'attempts/e1/' + A + '/1'))));
await c('5.1 học sinh tự ghi results → chặn', () => assertFails(set(ref(db(A), 'results/e1/' + A), { total_score: 10 })));
await c('5.2 giáo viên ghi results từ client → chặn', () => assertFails(set(ref(db(T), 'results/e1/' + A), { total_score: 10 })));
await c('6.1 giáo viên đọc phiên cả đề → được', () => assertSucceeds(get(ref(db(T), 'sessions/e1'))));
await c('6.2 học sinh đọc phiên cả đề → chặn', () => assertFails(get(ref(db(A), 'sessions/e1'))));

// Hết giờ: phiên bắt đầu 50 phút trước (đề 45 phút + 30 s ân hạn)
await seed({ e1: { opens_at: now - 120 * MIN, closes_at: now + 60 * MIN } });
await env.withSecurityRulesDisabled(c2 => set(ref(c2.database(), 'sessions/e1/' + A), { started_at: now - 50 * MIN, extra_ms: 0 }));
await c('3.2 nộp quá hạn → chặn', () => assertFails(set(ref(db(A), 'attempts/e1/' + A + '/1'), ans())));
await c('4.3 lưu nháp quá hạn → chặn', () => assertFails(set(ref(db(A), 'drafts/e1/' + A), { updated_at: serverTimestamp(), answers: { q1: 'B' } })));
await c('3.10 học sinh tự gia hạn extra_ms → chặn', () => assertFails(set(ref(db(A), 'sessions/e1/' + A + '/extra_ms'), 600000)));
await c('3.3a giáo viên gia hạn 10 phút → được', () => assertSucceeds(set(ref(db(T), 'sessions/e1/' + A + '/extra_ms'), 600000)));
await c('3.3b sau gia hạn học sinh nộp được', () => assertSucceeds(set(ref(db(A), 'attempts/e1/' + A + '/1'), ans())));
await c('6.3 giáo viên xóa phiên (đặt lại lượt) → được', () => assertSucceeds(set(ref(db(T), 'sessions/e1/' + B), null)));

// max_attempts = 2
await seed({ e1: open });
await assertSucceeds(set(ref(db(A), 'sessions/e2/' + A), sess));
await c('3.11 nộp lần 2 khi chưa có lần 1 → chặn', () => assertFails(set(ref(db(A), 'attempts/e2/' + A + '/2'), ans())));
await assertSucceeds(set(ref(db(A), 'attempts/e2/' + A + '/1'), ans()));
await c('3.7 nộp lần 2 khi max=2 và đã có lần 1 → được', () => assertSucceeds(set(ref(db(A), 'attempts/e2/' + A + '/2'), ans())));
await c('3.12 nộp lần 3 → chặn', () => assertFails(set(ref(db(A), 'attempts/e2/' + A + '/3'), ans())));

await env.cleanup();
console.log(`\n${cases.length - fail}/${cases.length} ca đúng trên Firebase Emulator thật`);
process.exit(fail ? 1 : 0);
