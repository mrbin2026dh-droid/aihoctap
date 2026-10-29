// Đối chiếu số liệu mô phỏng: đọc tests/sim/out/log.jsonl (+ firebase-9TH.json nếu có) và in ra những số màn giáo viên PHẢI hiện.
// Dùng sau khi chạy run_simulation.cjs: chụp màn giáo viên THẬT rồi so từng dòng. Không có số nào được gõ tay.
// Chạy: node tests/sim/doi_chieu.cjs
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'out');
const rows = fs.readFileSync(path.join(OUT, 'log.jsonl'), 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x));
const runStart = rows.filter(r => r.buoc === 'mo_trang' || r.buoc.startsWith('do_dap_an')).map(r => r.at).sort()[0];
const R = rows.filter(r => r.at >= runStart);   // chỉ lần chạy gần nhất nếu log có nhiều lần (log ghi nối tiếp)
const nop = R.filter(r => /^(luyen_tap_bai_\d+_lan_\d+|do_dap_an_bai_\d+)$/.test(r.buoc) && r.ok && /\d+\/\d+ câu đúng|lần \d+: \d+ đúng/.test(r.ghi_chu || ''));
const lt = R.filter(r => /^luyen_tap_bai_\d+_lan_\d+$/.test(r.buoc) && r.ok);
const dangNhap = new Set(R.filter(r => r.buoc === 'dang_nhap' && r.ok).map(r => r.ma));
const out = [];
out.push(['Số em đăng nhập (Đã làm bài trên Tổng quan nếu em nào cũng nộp ít nhất 1 lần)', dangNhap.size]);
out.push(['Lượt nộp Luyện tập trong kịch bản (không tính dò đáp án)', lt.length]);
out.push(['Lượt nộp dò đáp án (TH9001, cộng vào Lượt nộp của Tổng quan)', R.filter(r => /^do_dap_an_bai_\d+$/.test(r.buoc) && /^lần/.test(r.ghi_chu || '')).length + R.filter(r => /^do_dap_an_bai_\d+$/.test(r.buoc) && /sau (\d+) lần/.test(r.ghi_chu || '')).reduce((s, r) => s + Number(/sau (\d+) lần/.exec(r.ghi_chu)[1]) - 1, 0)]);
for (const b of [...new Set(lt.map(r => r.buoc.match(/bai_(\d+)/)[1]))].sort()) {
  const x = lt.filter(r => r.buoc.startsWith(`luyen_tap_bai_${b}_`));
  const em = new Set(x.map(r => r.ma));
  const last = {}; for (const r of x) last[r.ma] = r;   // lần nộp gần nhất mỗi em
  const pct = Object.values(last).map(r => { const m = /(\d+)\/(\d+)/.exec(r.ghi_chu); return m ? 100 * m[1] / m[2] : 0; });
  out.push([`Bài thứ ${b} trong danh mục: số em / lượt nộp / % đúng TB lần gần nhất`, `${em.size} em / ${x.length} lượt / ${Math.round(pct.reduce((s, v) => s + v, 0) / (pct.length || 1))}%`]);
}
for (const n of ['A', 'B', 'C', 'D']) {
  const last = {}; for (const r of lt.filter(r => r.nhom === n)) last[r.ma + r.buoc.match(/bai_\d+/)[0]] = r;
  const pct = Object.values(last).map(r => { const m = /(\d+)\/(\d+)/.exec(r.ghi_chu); return m ? 100 * m[1] / m[2] : 0; });
  if (pct.length) out.push([`Nhóm ${n}: % đúng TB lần gần nhất mỗi bài`, `${Math.round(pct.reduce((s, v) => s + v, 0) / pct.length)}%`]);
}
const fb = path.join(OUT, 'firebase-9TH.json');
if (fs.existsSync(fb)) {
  const d = JSON.parse(fs.readFileSync(fb, 'utf8'));
  for (const [k, v] of Object.entries(d.doc_read || {})) { const a = Object.values(v); out.push([`Đọc bài ${k}: số em có dữ liệu / đọc hết (100%)`, `${a.length} / ${a.filter(x => Number(x.pct) >= 100).length}`]); }
  for (const [day, v] of Object.entries(d.thoi_gian || {})) out.push([`Thời gian học ngày ${day}: số em / tổng phút`, `${Object.keys(v).length} / ${Object.values(v).reduce((s, x) => s + Number(x || 0), 0)}`]);
}
const gs = R.filter(r => r.buoc === 'gia_su' && typeof r.ms === 'number').map(r => r.ms).sort((a, b) => a - b);
if (gs.length) out.push(['Gia sư: số câu / trung vị / p95 (ms)', `${gs.length} / ${gs[Math.floor(gs.length / 2)]} / ${gs[Math.min(gs.length - 1, Math.floor(gs.length * 0.95))]}`]);
console.log('KIỂM THỬ MÔ PHỎNG – lớp 9TH, không phải học sinh thật. Lần chạy từ ' + runStart);
for (const [k, v] of out) console.log(`- ${k}: ${v}`);
