// Ngân sách kết nối Firebase (thi-store.listen): trình duyệt chỉ cho 6 kết nối HTTP/1.1 tới một máy chủ, mỗi EventSource giữ 1.
// Lỗi 29/10: trang giáo viên mở 7–10 EventSource → lệnh đọc (danh sách lớp, Hiệu quả, câu trả lời luyện tập) treo, báo "Mạng đang chậm".
// Chạy: node tests/test_store_budget.mjs
import assert from 'node:assert/strict';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
const listeners = {}; let vis = 'visible';
globalThis.window = globalThis;
globalThis.document = { get visibilityState() { return vis; }, addEventListener: (t, f) => { listeners[t] = f; } };
const open = new Set();
class FakeES { constructor(url) { this.url = url; this.readyState = 1; this.h = {}; open.add(this); setTimeout(() => this.emit('put', { path: '/', data: { v: url } }), 5); }
  addEventListener(t, f) { (this.h[t] ||= []).push(f); } emit(t, d) { for (const f of this.h[t] || []) f({ data: JSON.stringify(d) }); }
  close() { this.readyState = 2; open.delete(this); } }
FakeES.CLOSED = 2; globalThis.EventSource = FakeES;
const fetched = [];
globalThis.fetch = async url => { fetched.push(String(url)); return { ok: true, status: 200, json: async () => ({ polled: String(url) }) }; };
const { listen, openStreams, SLOTS } = await import('../frontend/hoc/thi-store.js');
const { PRESENCE_CONFIG } = await import('../frontend/hoc/presence-config.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const got = {};
const stops = [];
for (const [p, prio] of [['thi_hs', 0], ['doc_read/x', 0], ['thi_nop/a', 2], ['thi_vao/a', 2], ['thi_th/a', 1], ['quiz/1/ds', 2], ['quiz/1/ans/q0', 3]]) stops.push(listen(p, d => { got[p] = d; }, undefined, { prio }));
await sleep(50);
ok(SLOTS <= 4 && openStreams() === SLOTS && open.size === SLOTS, `7 nhánh cần nghe nhưng chỉ ${SLOTS} EventSource được mở (còn chỗ cho lệnh đọc)`);
ok([...open].some(e => e.url.includes('quiz/1/ans/q0')) && ![...open].some(e => e.url.includes('thi_hs')), 'câu trả lời luyện tập (ưu tiên 3) giữ kết nối tức thì; thi_hs (ưu tiên 0) chuyển sang đọc định kỳ');
ok(got['thi_hs']?.polled?.includes('thi_hs') && got['quiz/1/ans/q0']?.v?.includes('ans'), 'mọi nhánh đều nhận dữ liệu (tức thì hoặc đọc định kỳ)');
// dùng chung một kết nối cho cùng nhánh
const before = open.size; let twice = null;
const s2 = listen('quiz/1/ans/q0', d => { twice = d; }, undefined, { prio: 3 }); await sleep(20);
ok(open.size === before && twice?.v?.includes('ans'), 'hai chỗ cùng nghe một nhánh: dùng chung một kết nối, chỗ nghe mới nhận dữ liệu ngay');
s2(); await sleep(10); ok(open.size === before, 'một chỗ thôi nghe: kết nối chung vẫn giữ cho chỗ còn lại');
// dừng nhánh ưu tiên cao → nhánh khác được nâng lên EventSource
stops[6](); await sleep(20);
ok(openStreams() === SLOTS && ![...open].some(e => e.url.includes('ans/q0')), 'thôi nghe câu trả lời: nhường kết nối cho nhánh kế tiếp');
// tab ẩn → đóng hết EventSource
vis = 'hidden'; listeners.visibilitychange(); await sleep(10);
ok(open.size === 0, 'tab bị ẩn: đóng hết EventSource, chỉ đọc thưa để nhường kết nối cho tab đang dùng');
vis = 'visible'; listeners.visibilitychange(); await sleep(20);
ok(open.size === SLOTS, 'quay lại tab: mở lại kết nối tức thì');
stops.forEach(f => f()); await sleep(10);
ok(open.size === 0 && openStreams() === 0, 'thôi nghe hết: không còn kết nối nào');
ok(fetched.every(u => u.startsWith(PRESENCE_CONFIG.dbUrl)), 'đọc định kỳ đúng máy chủ Firebase');
console.log('STORE BUDGET OK ' + n);
process.exit(0);
