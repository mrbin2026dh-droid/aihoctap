// Gói Học AI lớp 9 Bài 2 bản viết lại (ai9_b2): lược đồ, không lộ đáp án, Kiểm tra từng phần qua máy chủ.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import worker, { createFirebaseCustomToken, MockDONamespace } from '../worker/index.js';
import * as C from '../worker/phieu-core.js';

const pack = JSON.parse(readFileSync(new URL('../data/phieu/ai9_b2.json', import.meta.url), 'utf8'));
const dapanUrl = new URL('../data/phieu/ai9_b2.dapan.json', import.meta.url);
const dapan = existsSync(dapanUrl) ? JSON.parse(readFileSync(dapanUrl, 'utf8')) : null;   // tệp đáp án không có trên Git
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// ---------- Lược đồ, không lộ đáp án ----------
eq(C.validatePack(pack), [], 'gói hợp lệ');
const txt = JSON.stringify(pack);
for (const s of ['Ngô Quyền', 'nhiều giờ', 'dap_an', 'giai_thich', 'Đúng.']) ok(!txt.includes(s), 'gói HS không chứa: ' + s);
for (const code of ['9.A3.1', '9.A3.2', '9.A3.3', '9.A3.4']) ok([...C.fieldMap(pack).values()].some(f => f.evidence?.code === code && f.evidence.kind === 'toi_thieu' && f.required), 'có minh chứng bắt buộc cho ' + code);
ok(pack.activities.every(a => Array.isArray(a.buoc) && a.buoc.every(b => b.huong_dan?.length)), 'mọi hoạt động có hướng dẫn từng bước');
ok(!pack.activities.some(a => a.cau_hoi || a.peer_review || (a.fields || []).some(f => f.mode === 'nhom' || f.lock)), 'không còn câu hỏi GV, góp ý nhóm, chốt');
const cards = pack.activities.flatMap(a => a.buoc.flatMap(b => b.the || []));
const p2 = cards.filter(t => t.kiem?.startsWith('p2_t'));
eq(p2.length, 6, 'sáu tình huống');
if (dapan) {
  for (const t of cards.filter(t => !t.chi_ghi)) {
    const k = dapan.kiem[t.kiem];
    ok(k && k.dap_an, 'có đáp án cho ' + t.kiem);
    for (const [id, v] of Object.entries(k.dap_an)) ok(C.optionsOf(pack, C.fieldMap(pack).get(id)).includes(v), `đáp án ${id} nằm trong lựa chọn`);
    for (const id of Object.keys(k.dap_an)) ok(typeof k.giai_thich[id] === 'string' && k.giai_thich[id].length > 10, 'có giải thích cho ' + id);
  }
  const vt = p2.map(t => C.optionsOf(pack, C.fieldMap(pack).get(t.fields[0])).indexOf(dapan.kiem[t.kiem].dap_an[t.fields[0]]));
  ok(new Set(vt).size >= 3, 'đáp án đúng không cùng một vị trí A/B/C');
} else console.log('(bỏ qua kiểm tệp đáp án: không có data/phieu/ai9_b2.dapan.json trên máy này)');

// ---------- Máy chủ: Kiểm tra từng phần ----------
const BASE = 'https://b2-test.firebaseio.test';
let root = {};
const getAt = path => path.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), root) ?? null;
const setAt = (path, v) => { const ks = path.split('/').filter(Boolean); let o = root; for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = JSON.parse(JSON.stringify(v)); };
const tag = v => 'e' + [...JSON.stringify(v)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const reads = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), method = (init.method || 'GET').toUpperCase();
  if (!u.startsWith(BASE)) return realFetch(url, init);
  const path = u.slice(BASE.length + 1).split('?')[0].replace(/\.json$/, '');
  if (method === 'GET') { reads.push(path); const v = getAt(path); return new Response(JSON.stringify(v), { headers: { ETag: tag(v) } }); }
  const im = init.headers?.['if-match'];
  if (im && im !== tag(getAt(path))) return new Response('{}', { status: 412 });
  setAt(path, method === 'DELETE' ? null : JSON.parse(init.body)); return new Response(init.body || 'null');
};
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_DATABASE_URL: BASE, FIREBASE_AUTH_TOKEN: 'tok', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', PHIEU_ENABLED: '1' };
const mk = (uid, claims) => createFirebaseCustomToken(uid, claims, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, 'k', 43200);
const ta = await mk('hsA', { name: 'Học sinh A', grade: 9, class_code: '9A' });
const admin = await mk('teacher_admin', { role: 'teacher', admin: true, name: 'GV' });
const call = async (method, path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://x.github.io', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined }), env); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const T = b => call('POST', '/pwa/teacher/phieu', b, admin);
const P1 = { dap_an: { p1_v1: 'Máy, AI làm tốt', p1_v5: 'Người vẫn phải làm' }, giai_thich: { p1_v1: 'GT1', p1_v5: 'GT5' }, chot: 'CHOT_P1' };
try {
  eq((await T({ op: 'goi_luu', pack })).status, 200, 'GV nạp gói mới');
  eq((await T({ op: 'dapan_luu', goi: 'ai9_b2', dapan: { id: 'ai9_b2', kiem: { p1: P1, p4: { dap_an: { p4_ban_hang_1: 'Máy, AI làm được', p4_trong_trot_1: 'Máy, AI làm được' }, giai_thich: { p4_ban_hang_1: 'GTB', p4_trong_trot_1: 'GTT' } } } } })).status, 200);
  const g = await call('GET', '/pwa/phieu/ai9_b2', null, ta); eq(g.status, 200);
  ok(!JSON.stringify(g.body).includes('CHOT_P1'), 'GET không lộ đáp án');
  // Phần 1: phải trả lời đủ 8 việc mới kiểm tra
  const all = Object.fromEntries(cards.find(t => t.kiem === 'p1').fields.map(id => [id, 'Máy, AI làm tốt']));
  const d1 = await call('PUT', '/pwa/phieu/ai9_b2/draft', { rev: 0, answers: { p1_v1: 'Máy, AI làm tốt' } }, ta); eq(d1.status, 200);
  eq((await call('POST', '/pwa/phieu/ai9_b2/kiem', { the: 'p1' }, ta)).body.error, 'MISSING', 'chưa đủ 8 việc');
  const d2 = await call('PUT', '/pwa/phieu/ai9_b2/draft', { rev: d1.body.rev, answers: all }, ta); eq(d2.status, 200);
  reads.length = 0;
  const k = await call('POST', '/pwa/phieu/ai9_b2/kiem', { the: 'p1' }, ta); eq(k.status, 200, JSON.stringify(k.body));
  eq(k.body.ket_qua.map(x => [x.field, x.dung, x.giai_thich]), [['p1_v1', true, 'GT1'], ['p1_v5', false, 'GT5']], 'đúng/sai từng câu kèm giải thích');
  eq(k.body.chot, '', 'chưa đúng hết thì chưa hiện câu chốt');
  ok(reads.filter(p => p.startsWith('phieu_dapan')).every(p => p === 'phieu_dapan/ai9_b2/kiem/p1'), 'chỉ đọc đúng mục kiểm tra');
  const d3 = await call('PUT', '/pwa/phieu/ai9_b2/draft', { rev: k.body.rev, answers: { p1_v5: 'Người vẫn phải làm' } }, ta); eq(d3.status, 200);
  eq((await call('POST', '/pwa/phieu/ai9_b2/kiem', { the: 'p1' }, ta)).body.chot, 'CHOT_P1', 'đúng hết thì hiện câu chốt');
  eq(getAt('phieu_bai/ai9_b2/9a/hsA').kiem.p1.p1_v5, 'Máy, AI làm tốt', 'giữ câu trả lời lần đầu');
  // Phần 4: chỉ kiểm việc của nghề đã chọn (ô ẩn không bắt trả lời)
  const r4 = getAt('phieu_bai/ai9_b2/9a/hsA').rev;
  const d4 = await call('PUT', '/pwa/phieu/ai9_b2/draft', { rev: r4, answers: { p4_nghe: 'Bán hàng', p4_ban_hang_1: 'Người vẫn phải làm', p4_ban_hang_2: 'Máy, AI làm được', p4_ban_hang_3: 'Người vẫn phải làm', p4_ban_hang_4: 'Người vẫn phải làm' } }, ta); eq(d4.status, 200);
  const k4 = await call('POST', '/pwa/phieu/ai9_b2/kiem', { the: 'p4' }, ta); eq(k4.status, 200, JSON.stringify(k4.body));
  eq(k4.body.ket_qua.map(x => x.field), ['p4_ban_hang_1'], 'không chấm việc của nghề khác');
  // Phần 3: lưu bản đầu (không cần đáp án), giữ bản đầu khi sửa
  const r3 = getAt('phieu_bai/ai9_b2/9a/hsA').rev;
  eq((await call('POST', '/pwa/phieu/ai9_b2/kiem', { the: 'p3_ban_dau' }, ta)).body.error, 'MISSING', 'chưa viết mục tiêu');
  const d5 = await call('PUT', '/pwa/phieu/ai9_b2/draft', { rev: r3, answers: { p3_lam: 'Đọc sách', p3_cach: 'Mỗi ngày', p3_ngay: '2027-01-15', p3_dat: '8 cuốn' } }, ta); eq(d5.status, 200);
  const kb = await call('POST', '/pwa/phieu/ai9_b2/kiem', { the: 'p3_ban_dau' }, ta); eq(kb.body.chi_ghi, true, 'lưu bản đầu, không cần p3_khong_ai');
  const d6 = await call('PUT', '/pwa/phieu/ai9_b2/draft', { rev: kb.body.rev, answers: { p3_dat: 'Đọc xong 8 cuốn, ghi tóm tắt mỗi cuốn' } }, ta); eq(d6.status, 200);
  eq(getAt('phieu_bai/ai9_b2/9a/hsA').kiem.p3_ban_dau.p3_dat, '8 cuốn', 'giữ bản đầu để GV so sánh');
  // Ẩn bài với học sinh
  eq((await T({ op: 'goi_an', goi: 'ai9_b2', an: true })).status, 200);
  eq((await call('GET', '/pwa/phieu', null, ta)).body.packs, [], 'ẩn rồi thì HS không thấy');
  eq((await call('GET', '/pwa/phieu/ai9_b2', null, ta)).status, 404);
  eq((await T({ op: 'goi_an', goi: 'ai9_b2', an: false })).status, 200);
  eq((await call('GET', '/pwa/phieu', null, ta)).body.packs.map(p => p.id), ['ai9_b2'], 'hiện lại');
} finally { globalThis.fetch = realFetch; }
console.log(`test_phieu_b2: ${n} PASS`);
