// Kiểm luật "thi nhanh" (học sinh đọc/ghi Firebase KHÔNG cần vé): thi_hs/thi_bai/thi_de chỉ đọc; thi_vao/thi_nop ghi có điều kiện;
// presence ghi không cần vé nhưng đúng khuôn; mọi nhánh dữ liệu cũ của Worker vẫn ĐÓNG với người không có vé.
// Chạy: cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-fast.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, remove, update, serverTimestamp } from 'firebase/database';
const file = process.env.RULES_FILE; if (!file) { console.error('Thiếu RULES_FILE'); process.exit(2); }
const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap', database: { host: '127.0.0.1', port: 9099, rules: readFileSync(file, 'utf8') } });
await env.withSecurityRulesDisabled(async c => {
  await set(ref(c.database()), {
    thi_hs: { hs01: { ma: 'HS01', ten: 'An', lop: '9A', khoi: 9, h: 'x' } },
    thi_bai: { mo: { tieu_de: 'A', che_do: 'that', trang_thai: 'mo' }, khoa: { tieu_de: 'B', che_do: 'that', trang_thai: 'khoa' }, thu: { tieu_de: 'C', che_do: 'thu', trang_thai: 'mo' } },
    thi_de: { mo: [{ id: 'r1', text: 'Q', answer: 'A' }] },
    students_auth: { hs01: { pin: 'secret' } }, attempts: { x: 1 }, catalog: { v: 1 }
  });
});
const anon = env.unauthenticatedContext().database();
const NOP = { ma: 'HS01', ten: 'An', lop: '9A', diem: 5, tong: 10, dung: 1, so_cau: 2, lan: 1, cao_nhat: 5, tra_loi: { r1: 'A' }, at: serverTimestamp() };
let fail = 0;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
for (const k of ['thi_hs', 'thi_bai', 'thi_de']) {
  await c(`${k}: đọc không cần vé → được`, () => assertSucceeds(get(ref(anon, k))));
  await c(`${k}: ghi → chặn`, () => assertFails(set(ref(anon, k + '/zz'), { a: 1 })));
}
await c('thi_vao: điểm danh bài có thật → được', () => assertSucceeds(set(ref(anon, 'thi_vao/khoa/hs01'), serverTimestamp())));
await c('thi_vao: bài không tồn tại → chặn', () => assertFails(set(ref(anon, 'thi_vao/khong/hs01'), serverTimestamp())));
await c('thi_vao: dữ liệu lạ → chặn', () => assertFails(set(ref(anon, 'thi_vao/khoa/hs01'), 'hack')));
await c('thi_nop: nộp bài đang mở → được', () => assertSucceeds(set(ref(anon, 'thi_nop/mo/hs01'), NOP)));
await c('thi_nop: thi thật nộp lần 2 → chặn', () => assertFails(set(ref(anon, 'thi_nop/mo/hs01'), NOP)));
await c('thi_nop: bài đang khóa → chặn', () => assertFails(set(ref(anon, 'thi_nop/khoa/hs01'), NOP)));
await c('thi_nop: thi thử nộp nhiều lần → được', async () => { await assertSucceeds(set(ref(anon, 'thi_nop/thu/hs01'), NOP)); await assertSucceeds(set(ref(anon, 'thi_nop/thu/hs01'), NOP)); });
await c('thi_nop: xóa bài nộp → chặn', () => assertFails(remove(ref(anon, 'thi_nop/thu/hs01'))));
await c('thi_nop: thiếu điểm → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs02'), { ma: 'hs02', at: serverTimestamp() })));
await c('thi_nop: trường lạ → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs03'), { ...NOP, ma: 'hs03', hack: 1 })));
await c('presence: ghi không cần vé, đúng khuôn → được', () => assertSucceeds(set(ref(anon, 'presence/HS01'), { name: 'An', lop: '9A', state: 'hoc', at: serverTimestamp() })));
await c('presence: trạng thái lạ → chặn', () => assertFails(set(ref(anon, 'presence/HS01'), { state: 'hack', at: serverTimestamp() })));
await c('presence: đọc → được (giáo viên xem)', () => assertSucceeds(get(ref(anon, 'presence'))));
await c('presence: ghi đè cả nhánh → chặn', () => assertFails(set(ref(anon, 'presence'), null)));
await c('catalog: đọc công khai, không ghi', async () => { await assertSucceeds(get(ref(anon, 'catalog'))); await assertFails(set(ref(anon, 'catalog/v'), 2)); });
await c('dữ liệu Worker (students_auth, attempts, gốc) → đóng', async () => { await assertFails(get(ref(anon, 'students_auth'))); await assertFails(get(ref(anon, 'attempts'))); await assertFails(get(ref(anon))); await assertFails(set(ref(anon, 'students_auth/x'), 1)); });
// 28/10: Bản đồ năng lực, rời màn hình, chủ đề trong bài nộp, Zalo hỗ trợ, đọc bài
await c('thi_nop: kèm chủ đề, điểm lần đầu, số lần rời màn hình → được', () => assertSucceeds(set(ref(anon, 'thi_nop/thu/hs04'), { ...NOP, ma: 'hs04', dau: 5, roi_tab: 2, chu_de: { ma_nhi_phan: { ten: 'Mã nhị phân', d: 1, n: 2 } } })));
await c('thi_nop: chủ đề sai khuôn → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs05'), { ...NOP, ma: 'hs05', chu_de: { x: { ten: 1 } } })));
// 28/10: thi thử Trắc nghiệm + Tự luận — bài làm tự luận + điểm AI chấm
await c('thi_nop: kèm tự luận (bài làm, điểm, nhận xét) → được', () => assertSucceeds(set(ref(anon, 'thi_nop/thu/hs06'), { ...NOP, ma: 'hs06', diem_tn: 1, cho_cham: false, tu_luan: { r5: { tl: 'Điện thoại, máy tính', d: 1.5, max: 2, nx: 'Đúng hai ví dụ' } } })));
await c('thi_nop: tự luận điểm vượt tối đa → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs07'), { ...NOP, ma: 'hs07', tu_luan: { r5: { tl: 'x', d: 3, max: 2 } } })));
await c('thi_nop: tự luận bài làm quá 3000 ký tự → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs08'), { ...NOP, ma: 'hs08', tu_luan: { r5: { tl: 'x'.repeat(3001), d: 0, max: 2 } } })));
await c('thi_nop: tự luận trường lạ → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs09'), { ...NOP, ma: 'hs09', tu_luan: { r5: { tl: 'x', d: 0, max: 2, hack: 1 } } })));
await c('thi_nop: rời màn hình âm → chặn', () => assertFails(set(ref(anon, 'thi_nop/thu/hs06'), { ...NOP, ma: 'hs06', roi_tab: -1 })));
await c('nang_luc: học sinh ghi tóm tắt đúng khuôn → được', () => assertSucceeds(set(ref(anon, 'nang_luc/hs01'), { at: serverTimestamp(), ten: 'An', lop: '9A', topics: { ma_nhi_phan: { ten: 'Mã nhị phân', d: 3, n: 10 } } })));
await c('nang_luc: thiếu topics / trường lạ → chặn', async () => { await assertFails(set(ref(anon, 'nang_luc/hs02'), { at: serverTimestamp() })); await assertFails(set(ref(anon, 'nang_luc/hs02'), { at: serverTimestamp(), topics: {}, hack: 1 })); });
await c('nang_luc: đọc → được (giáo viên xem Hiệu quả)', () => assertSucceeds(get(ref(anon, 'nang_luc'))));
await c('ho_tro: đọc → được, ghi → chặn', async () => { await assertSucceeds(get(ref(anon, 'ho_tro'))); await assertFails(set(ref(anon, 'ho_tro/zalo'), 'https://evil')); });
await c('thi_th: học sinh không tự ghi điểm thực hành', () => assertFails(set(ref(anon, 'thi_th/mo/hs01/diem_th'), 10)));
// 28/10: Trò chơi câu hỏi — chỉ chủ phòng (biết khóa bí mật, không ai đọc được) điều khiển: mỗi lần ghi phải kèm bằng chứng MỚI "khóa|số đếm".
const KEY = 'k'.repeat(40); let pn = 0; const P = () => `${KEY}|${++pn}`;
await c('quiz_key: tạo khóa phòng → được; tạo lại → chặn; đọc → chặn', async () => { await assertSucceeds(set(ref(anon, 'quiz_key/123456'), KEY)); await assertFails(set(ref(anon, 'quiz_key/123456'), 'x'.repeat(40))); await assertFails(get(ref(anon, 'quiz_key/123456'))); });
await c('quiz_key: mã phòng không phải 6 chữ số → chặn', () => assertFails(set(ref(anon, 'quiz_key/12ab56'), KEY)));
await c('quiz chẩn đoán 1: ghi riêng bằng chứng đúng khóa → được', () => assertSucceeds(set(ref(anon, 'quiz_proof/123456'), P())));
await c('quiz chẩn đoán 2: bằng chứng sai khóa → chặn', () => assertFails(set(ref(anon, 'quiz_proof/123456'), 'z'.repeat(40) + '|9')));
await c('quiz chẩn đoán 3: ghi lại đúng bằng chứng cũ → chặn', async () => { const p = P(); await assertSucceeds(set(ref(anon, 'quiz_proof/123456'), p)); await assertFails(set(ref(anon, 'quiz_proof/123456'), p)); });
await c('quiz chẩn đoán 4: pub + bằng chứng mới trong cùng một lần cập nhật → được', () => assertSucceeds(update(ref(anon), { 'quiz/123456/pub': { phase: 'lobby', n: 1 }, 'quiz_proof/123456': P() })));
await c('quiz: ghi trạng thái KHÔNG kèm bằng chứng (dù chủ phòng đã ghi trước đó) → chặn', async () => { await assertFails(update(ref(anon), { 'quiz/123456/pub/phase': 'end' })); await assertFails(set(ref(anon, 'quiz/123456/pub/phase'), 'end')); });
await c('quiz: ghi trạng thái với bằng chứng khóa SAI → chặn', () => assertFails(update(ref(anon), { 'quiz/123456/pub/phase': 'end', 'quiz_proof/123456': 'z'.repeat(40) + '|1' })));
await c('quiz: chủ phòng gắn lớp → được', () => assertSucceeds(update(ref(anon), { 'quiz_lop/9a': '123456', 'quiz_proof/123456': P() })));
await c('quiz_lop: gắn lớp không kèm bằng chứng → chặn', () => assertFails(set(ref(anon, 'quiz_lop/9b'), '123456')));
await c('quiz_proof: không đọc được', () => assertFails(get(ref(anon, 'quiz_proof/123456'))));
await c('quiz: học sinh vào phòng → được; vào lại → chặn', async () => { await assertSucceeds(set(ref(anon, 'quiz/123456/ds/hs01'), { ten: 'An', at: serverTimestamp() })); await assertFails(set(ref(anon, 'quiz/123456/ds/hs01'), { ten: 'An', at: serverTimestamp() })); });
await c('quiz: trả lời khi chưa hỏi → chặn', () => assertFails(set(ref(anon, 'quiz/123456/ans/q0/hs01'), { a: 'A', t: serverTimestamp() })));
await c('quiz: chủ phòng bắt đầu câu 1 → được', () => assertSucceeds(update(ref(anon), { 'quiz/123456/pub/phase': 'q', 'quiz/123456/pub/q': { k: 'q0', i: 0, text: 'Q', lim: 20, at: serverTimestamp() }, 'quiz_proof/123456': P() })));
await c('quiz: trả lời đúng câu đang hỏi → được; lần 2 → chặn', async () => { await assertSucceeds(set(ref(anon, 'quiz/123456/ans/q0/hs01'), { a: 'B', t: serverTimestamp() })); await assertFails(set(ref(anon, 'quiz/123456/ans/q0/hs01'), { a: 'A', t: serverTimestamp() })); });
await c('quiz: trả lời câu khác / đáp án lạ → chặn', async () => { await assertFails(set(ref(anon, 'quiz/123456/ans/q1/hs02'), { a: 'A', t: serverTimestamp() })); await assertFails(set(ref(anon, 'quiz/123456/ans/q0/hs02'), { a: 'E', t: serverTimestamp() })); });
await c('quiz: học sinh tự ghi điểm (kq) → chặn', () => assertFails(set(ref(anon, 'quiz/123456/kq/hs01'), { p: 9999 })));
await c('quiz: chủ phòng ghi điểm + kết thúc + gỡ lớp → được', () => assertSucceeds(update(ref(anon), { 'quiz/123456/kq/hs01': { p: 900, c: 1, r: 1, n: 1 }, 'quiz/123456/pub/phase': 'end', 'quiz_lop/9a': null, 'quiz_proof/123456': P() })));
await env.cleanup();
console.log(fail ? `${fail} CA SAI — KHÔNG ĐĂNG LUẬT NÀY` : 'TẤT CẢ CA ĐÚNG'); process.exit(fail ? 1 : 0);
