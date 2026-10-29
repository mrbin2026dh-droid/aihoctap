// Kiểm luật THI THẬT theo ca (30/10/2026): 4 trạng thái thi_tt; học sinh chỉ nộp khi Chưa thi / Thi lại, nộp và đổi trạng thái → Đã thi cùng lúc;
// đề Trắc nghiệm + Thực hành phải có thi_th (Sheet xác nhận file) mới nộp được; thi_goi_y không ai đọc; thi_tien_do chỉ khi đang được mở thi.
// Chạy: cd spike/step0/emulator && RULES_FILE=../database.rules.ai-sgk-final.json npx firebase emulators:exec --only database --project demo-aihoctap "node rules-thi-that.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update, serverTimestamp } from 'firebase/database';
const file = process.env.RULES_FILE; if (!file) { console.error('Thiếu RULES_FILE'); process.exit(2); }
const env = await initializeTestEnvironment({ projectId: 'demo-aihoctap', database: { host: '127.0.0.1', port: 9099, rules: readFileSync(file, 'utf8') } });
const seed = async extra => env.withSecurityRulesDisabled(async c => {
  await set(ref(c.database()), {
    thi_bai: { tl: { tieu_de: 'TN+TL', che_do: 'that', noi_dung: 'tn_tl', trang_thai: 'khoa' }, th: { tieu_de: 'TN+TH', che_do: 'that', noi_dung: 'tn_th', trang_thai: 'khoa' }, thu: { tieu_de: 'Thử', che_do: 'thu', trang_thai: 'mo' } },
    thi_de: { tl: [{ id: 'r1', text: 'Q', options: { A: 'a', B: 'b' }, points: 1 }] },
    thi_goi_y: { tl: { r9: 'bí mật' } },
    thi_tt: { tl: { hs01: { tt: 'chua_thi', lop: '9A', lan: 0 }, hs02: { tt: 'chua_mo', lop: '9A', lan: 0 }, hs03: { tt: 'da_thi', lop: '9A', lan: 1 }, hs04: { tt: 'thi_lai', lop: '9A', lan: 1 } }, th: { hs01: { tt: 'chua_thi', lop: '9A', lan: 0 }, hs05: { tt: 'chua_thi', lop: '9A', lan: 0 } } },
    thi_th: { th: { hs05: { ten_file: 'a.xlsx', file_id: 'F', size: 5, at: 1 } } },
    ...extra
  });
});
await seed({});
const anon = env.unauthenticatedContext().database();
const REC = (ma, lan = 1) => ({ ma, ten: 'Em', lop: '9A', lan, roi_tab: 0, so_cau: 1, tra_loi: { r1: 'A' }, thu_tu: { q: ['r1'], o: { r1: 'BA' } }, at: serverTimestamp() });
const nop = (bai, k, rec, lan = 1) => update(ref(anon), { [`thi_nop/${bai}/${k}`]: rec, [`thi_tt/${bai}/${k}/tt`]: 'da_thi', [`thi_tt/${bai}/${k}/nop_luc`]: serverTimestamp(), [`thi_tt/${bai}/${k}/lan`]: lan });
let fail = 0;
async function c(name, fn) { try { await fn(); console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } }
await c('thi_goi_y: không ai đọc được (gợi ý chấm tự luận)', () => assertFails(get(ref(anon, 'thi_goi_y'))));
await c('thi_tt: đọc công khai (học sinh biết trạng thái của mình)', () => assertSucceeds(get(ref(anon, 'thi_tt/tl/hs01'))));
await c('thi_tt: học sinh tự mở thi cho mình (chua_mo → chua_thi) → chặn', () => assertFails(set(ref(anon, 'thi_tt/tl/hs02/tt'), 'chua_thi')));
await c('thi_tt: học sinh tự đổi Đã thi → Thi lại → chặn', () => assertFails(set(ref(anon, 'thi_tt/tl/hs03/tt'), 'thi_lai')));
await c('thi_tt: đổi sang Đã thi mà không nộp bài → chặn', () => assertFails(set(ref(anon, 'thi_tt/tl/hs01/tt'), 'da_thi')));
await c('thi_nop: Chưa mở thi → chặn', () => assertFails(nop('tl', 'hs02', REC('HS02'))));
await c('thi_nop: Chưa thi, nộp + đổi Đã thi cùng lúc → được', () => assertSucceeds(nop('tl', 'hs01', REC('HS01'))));
await c('thi_nop: vừa nộp xong (Đã thi) nộp lần nữa → chặn', () => assertFails(nop('tl', 'hs01', REC('HS01'))));
await c('thi_nop: Đã thi → chặn', () => assertFails(nop('tl', 'hs03', REC('HS03'))));
await c('thi_nop: Thi lại → được (lần 2)', () => assertSucceeds(nop('tl', 'hs04', REC('HS04', 2), 2)));
await seed({});
await c('thi_nop: chỉ ghi thi_nop mà không đổi trạng thái → chặn', () => assertFails(set(ref(anon, 'thi_nop/tl/hs01'), REC('HS01'))));
await c('thi_nop: thi thật gửi kèm điểm → chặn (Sheet chấm)', () => assertFails(nop('tl', 'hs01', { ...REC('HS01'), diem: 10, tong: 10 })));
await c('thi_nop: trường lạ → chặn', () => assertFails(nop('tl', 'hs01', { ...REC('HS01'), hack: 1 })));
await c('thi_nop: Trắc nghiệm + Thực hành chưa có file thực hành → chặn', () => assertFails(nop('th', 'hs01', REC('HS01'))));
await c('thi_nop: Trắc nghiệm + Thực hành đã có file (thi_th) → được', () => assertSucceeds(nop('th', 'hs05', REC('HS05'))));
await c('thi_tien_do: đang được mở thi → được', () => assertSucceeds(set(ref(anon, 'thi_tien_do/tl/hs01'), { n: 3, tong: 10, th: false, at: serverTimestamp() })));
await c('thi_tien_do: Chưa mở thi → chặn', () => assertFails(set(ref(anon, 'thi_tien_do/tl/hs02'), { n: 1, tong: 10, at: serverTimestamp() })));
await c('thi_tien_do: số lạ → chặn', () => assertFails(set(ref(anon, 'thi_tien_do/tl/hs01'), { n: 11, tong: 10, at: serverTimestamp() })));
await c('thi_drive / thi_ip / thi_cfg: đọc được, học sinh không ghi', async () => { for (const k of ['thi_drive/tl/hs01', 'thi_ip/tl/hs01', 'thi_cfg/ip_truong']) { await assertSucceeds(get(ref(anon, k))); await assertFails(set(ref(anon, k), { x: 1 })); } });
await c('thi thử vẫn như cũ: nộp có điểm, nhiều lần → được', async () => { const t = { ma: 'HS01', diem: 1, tong: 2, lan: 1, tra_loi: { r1: 'A' }, at: serverTimestamp() }; await assertSucceeds(set(ref(anon, 'thi_nop/thu/hs01'), t)); await assertSucceeds(set(ref(anon, 'thi_nop/thu/hs01'), t)); });
await env.cleanup();
console.log(fail ? `THI THAT RULES: ${fail} FAIL` : 'THI THAT RULES OK');
process.exit(fail ? 1 : 0);
