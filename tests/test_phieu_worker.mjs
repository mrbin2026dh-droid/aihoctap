// Học AI – route máy chủ: quyền học sinh/giáo viên, lớp chéo, khóa, nộp bất biến, nhóm, góp ý, mở học liệu, sửa gói, chống ghi chen.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { createFirebaseCustomToken, MockDONamespace } from '../worker/index.js';

const pack = JSON.parse(readFileSync(new URL('../data/phieu/ai9_bai2.json', import.meta.url), 'utf8'));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// ---------- RTDB giả có ETag ----------
const BASE = 'https://phieu-test.firebaseio.test';
let root = {};
const reads = []; let raceOnce = null;
const getAt = path => path.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), root) ?? null;
const setAt = (path, v) => { const ks = path.split('/').filter(Boolean); let o = root; for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = JSON.parse(JSON.stringify(v)); };
const tag = v => 'e' + [...JSON.stringify(v)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const realFetch = globalThis.fetch;
const SHEET = 'https://sheet.test/exec';
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), method = (init.method || 'GET').toUpperCase();
  if (u === SHEET) {
    const b = JSON.parse(init.body);
    return new Response(JSON.stringify(b.ma === 'gv2' && b.pin === '222222' ? { ok: true, teacher: { ma: 'GV2', ten: 'Cô B', lop: ['9B'] } } : { ok: false }));
  }
  if (!u.startsWith(BASE)) return realFetch(url, init);
  const [p0, q = ''] = u.slice(BASE.length + 1).split('?');
  const path = p0.replace(/\.json$/, '');
  if (method === 'GET') {
    reads.push(path);
    if (raceOnce && raceOnce.path === path) { const r = raceOnce; raceOnce = null; const v = getAt(path); const res = new Response(JSON.stringify(v), { headers: { ETag: tag(v) } }); setAt(path, r.value); return res; }
    let v = getAt(path);
    if (q.includes('shallow=true') && v && typeof v === 'object') v = Object.fromEntries(Object.keys(v).map(k => [k, true]));
    return new Response(JSON.stringify(v), { headers: { ETag: tag(v) } });
  }
  const im = init.headers?.['if-match'];
  if (im && im !== tag(getAt(path))) return new Response(JSON.stringify({ error: 'etag' }), { status: 412 });
  if (method === 'PUT') { setAt(path, JSON.parse(init.body)); return new Response(init.body); }
  if (method === 'DELETE') { setAt(path, null); return new Response('null'); }
  return new Response('{}', { status: 400 });
};

const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_DATABASE_URL: BASE, FIREBASE_AUTH_TOKEN: 'tok', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', SHEET_LOGIN_URL: SHEET, PHIEU_ENABLED: '1' };
const mk = (uid, claims) => createFirebaseCustomToken(uid, claims, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, 'k', 43200);
const ta = await mk('hsA', { name: 'Học sinh A', grade: 9, class_code: '9A' });
const tb = await mk('hsB', { name: 'Học sinh B', grade: 9, class_code: '9A' });
const tc = await mk('hsC', { name: 'Học sinh C', grade: 9, class_code: '9B' });
const td = await mk('hsD', { name: 'Học sinh D', grade: 8, class_code: '8A' });
const tbad = await mk('a/b', { name: 'X', grade: 9, class_code: '9A' });
const admin = await mk('teacher_admin', { role: 'teacher', admin: true, name: 'GV' });
const gv9a = await mk('gv1', { role: 'teacher', scope: 'class', classes: ['9A'], teacher_code: 'gv1' });

const call = async (method, path, body, token) => {
  const r = await worker.fetch(new Request('http://localhost/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://x.github.io', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const T = (body, token) => call('POST', '/pwa/teacher/phieu', body, token);
const fillRequired = () => {
  const a = {};
  for (const ac of pack.activities) for (const f of ac.fields) {
    if (!f.required || f.mode === 'nhom' || f.type === 'heading' || f.show_if) continue;
    const o = f.options || pack.options[f.options_ref] || [];
    a[f.id] = f.type === 'multi' ? o.slice(0, f.exact || 1) : (f.type === 'choice' || f.type === 'scale') ? o[0] : 'Câu trả lời thử';
  }
  return a;
};

try {
  // Chưa có dữ liệu: GV quản trị nạp gói qua trình soạn
  eq((await call('GET', '/pwa/phieu', null, ta)).body.packs, [], 'chưa có bài');
  eq((await T({ op: 'goi_luu', pack }, gv9a)).status, 403, 'GV lớp không nạp gói dùng chung');
  const bad = JSON.parse(JSON.stringify(pack)); bad.ai_tutor = true;
  eq((await T({ op: 'goi_luu', pack: bad }, admin)).status, 400, 'gói sai lược đồ bị chặn');
  const up = await T({ op: 'goi_luu', pack }, admin); eq(up.status, 200, JSON.stringify(up.body)); eq(up.body.rev, 1);
  ok(getAt('phieu_bo_goc/ai9_bai2')?.id === 'ai9_bai2', 'lưu bản gốc bất biến');
  eq((await T({ op: 'dapan_luu', goi: 'ai9_bai2', dapan: { id: 'ai9_bai2', bi_mat: 'DAP_AN_CHI_GV' } }, admin)).status, 200);

  // Quyền vào route học sinh
  eq((await call('GET', '/pwa/phieu')).status, 401, 'không token');
  eq((await call('GET', '/pwa/phieu', null, admin)).status, 401, 'token GV không dùng route HS');
  eq((await call('GET', '/pwa/phieu/ai9_bai2', null, tbad)).status, 401, 'uid lạ bị chặn');
  eq((await call('GET', '/pwa/phieu', null, ta)).body.packs.map(p => p.id), ['ai9_bai2'], 'HS khối 9 thấy bài');
  eq((await call('GET', '/pwa/phieu', null, td)).body.packs, [], 'HS khối 8 không thấy');
  eq((await call('GET', '/pwa/phieu/ai9_bai2', null, td)).status, 403, 'khác khối bị chặn');
  eq((await call('GET', '/pwa/phieu/khong_co', null, ta)).status, 404);

  // Đọc bài: không lộ đáp án, học liệu chưa mở không gửi
  reads.length = 0;
  const g0 = await call('GET', '/pwa/phieu/ai9_bai2', null, ta);
  eq(g0.status, 200); ok(!reads.some(p => p.startsWith('phieu_dapan')), 'route HS không đọc nhánh đáp án');
  const s0 = JSON.stringify(g0.body);
  for (const s of ['DAP_AN_CHI_GV', 'Ngô Quyền', 'cố gắng học tốt hơn', '92 triệu']) ok(!s0.includes(s), 'không lộ: ' + s);
  ok(!g0.body.pack.blocks.pl925 && g0.body.pack.locked_blocks.includes('pl925'), 'bảng mục tiêu mẫu chưa mở');
  eq(g0.body.bai.rev, 0);

  // Nháp
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 0, answers: { a_t1_lam: 'Đối chiếu sách' } }, ta)).body.rev, 1);
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 0, answers: { a_t1_lam: 'x' } }, ta)).status, 409, 'rev cũ');
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 1, answers: { n_c1: 'x' } }, ta)).body.error, 'FIELD_GROUP');
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 1, answers: { a_t1_em: 'bịa' } }, ta)).body.error, 'FIELD_OPTION');
  ok(getAt('phieu_bai/ai9_bai2/9a/hsA').answers.a_t1_lam === 'Đối chiếu sách', 'lưu đúng chỗ của HS');
  // Chống ghi chen: máy khác ghi giữa lúc đọc và ghi
  raceOnce = { path: 'phieu_bai/ai9_bai2/9a/hsA', value: { ...getAt('phieu_bai/ai9_bai2/9a/hsA'), answers: { a_t1_lam: 'Máy khác' } } };
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 1, answers: { a_t2_lam: 'y' } }, ta)).status, 409, 'ETag chặn ghi đè');
  eq(getAt('phieu_bai/ai9_bai2/9a/hsA').answers.a_t1_lam, 'Máy khác', 'không mất bản của máy khác');

  // Chốt lựa chọn đầu giờ
  eq((await call('POST', '/pwa/phieu/ai9_bai2/lock', { rev: 1, lock: 'chot_dau_gio' }, ta)).body.error, 'MISSING', 'chưa trả lời thì không chốt');
  const the = pack.options.the_tuyen_dung;
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 1, answers: { hd1_chon: the.slice(0, 3), hd1_vi: 'Vì cần' } }, ta)).body.rev, 2);
  const lk = await call('POST', '/pwa/phieu/ai9_bai2/lock', { rev: 2, lock: 'chot_dau_gio' }, ta); eq(lk.status, 200); ok(lk.body.locked.hd1_chon);
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 3, answers: { hd1_vi: 'đổi' } }, ta)).body.error, 'FIELD_LOCKED', 'đã chốt không sửa');

  // Nhóm
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 0 }, ta)).status, 400);
  const ja = await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 2 }, ta); eq(ja.status, 200); ok(ja.body.members.hsA);
  const jb = await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 2 }, tb); ok(jb.body.members.hsA && jb.body.members.hsB, 'hai bạn cùng nhóm');
  await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 2 }, tc); // khác lớp: nhóm 2 của lớp 9B
  ok(!getAt('phieu_nhom/ai9_bai2/9a/n2').members.hsC, 'nhóm tách theo lớp');
  const gs = await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 2, rev: jb.body.rev, answers: { n_c1: 'Trước đây…', n_pc_c1: ['hsB'] } }, ta);
  eq(gs.status, 200, JSON.stringify(gs.body)); eq(gs.body.by.n_c1, 'hsA', 'ghi nhận người viết');
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 2, rev: gs.body.rev, answers: { n_pc_c1: ['hsC'] } }, tb)).body.error, 'NOT_MEMBER', 'phân công người ngoài nhóm');
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/nhom', { so: 2, rev: 0, answers: { n_c2: 'x' } }, tb)).status, 409, 'rev nhóm cũ');

  // Góp ý của bạn: chỉ cùng nhóm, chỉ thấy trường mục tiêu
  await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: 3, answers: { b1_toi_se: 'Tôi sẽ đọc to mỗi ngày' } }, ta);
  const pv = await call('GET', '/pwa/phieu/ai9_bai2/gopy?uid=hsA', null, tb);
  eq(pv.status, 200); eq(pv.body.answers.b1_toi_se, 'Tôi sẽ đọc to mỗi ngày'); ok(!('a_t1_lam' in pv.body.answers), 'không thấy phần khác của bạn');
  eq((await call('GET', '/pwa/phieu/ai9_bai2/gopy?uid=hsC', null, tb)).status, 403, 'không xem bài người ngoài nhóm');
  eq((await call('GET', '/pwa/phieu/ai9_bai2/gopy?uid=hsB', null, tc)).status, 403, 'khác lớp');
  eq((await call('POST', '/pwa/phieu/ai9_bai2/gopy', { uid: 'hsA', goal: 1, checks: [true, false, true], text: 'Thêm hạn cụ thể' }, tb)).status, 200);
  eq((await call('GET', '/pwa/phieu/ai9_bai2', null, ta)).body.gopy.hsB.g1.text, 'Thêm hạn cụ thể', 'chủ phiếu thấy góp ý của bạn');

  // Kiểm tra thẻ tình huống: chỉ sau khi trả lời; không đọc nhánh đáp án khác; ghi lần đầu
  { const g = await call('GET', '/pwa/phieu/ai9_bai2', null, ta);
    eq((await call('POST', '/pwa/phieu/ai9_bai2/kiem', { the: 'a_t1' }, ta)).body.error, 'MISSING', 'chưa trả lời thì chưa cho kiểm tra');
    eq((await call('POST', '/pwa/phieu/ai9_bai2/kiem', { the: 'khong_co' }, ta)).status, 404);
    eq((await call('POST', '/pwa/phieu/ai9_bai2/kiem', { the: '__proto__' }, ta)).status, 404);
    const d1 = await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: g.body.bai.rev, answers: { a_t1_nl: 'Học cách học', a_t1_lam: 'Hỏi bạn', a_t1_loi: 'Năm 938' } }, ta); eq(d1.status, 200);
    reads.length = 0;
    eq((await call('POST', '/pwa/phieu/ai9_bai2/kiem', { the: 'a_t1' }, ta)).body.error, 'NO_KEY', 'chưa nạp giải thích');
    setAt('phieu_dapan/ai9_bai2/kiem', { a_t1: { nl: 'Tư duy phản biện', giai_thich: 'Đối chiếu sách', loi: 'Lý Thường Kiệt', loi_giai: 'GIAI_LOI' } });
    reads.length = 0;
    const k1 = await call('POST', '/pwa/phieu/ai9_bai2/kiem', { the: 'a_t1' }, ta);
    eq(k1.status, 200, JSON.stringify(k1.body)); eq(k1.body.dung, false); eq(k1.body.nl_chinh, 'Tư duy phản biện'); eq(k1.body.loi.dung, false);
    ok(!JSON.stringify(k1.body).includes('GIAI_LOI'), 'chọn sai chỗ lỗi thì chưa lộ lời giải chỗ lỗi');
    ok(reads.filter(p => p.startsWith('phieu_dapan')).every(p => p === 'phieu_dapan/ai9_bai2/kiem/a_t1'), 'chỉ đọc đúng mục kiểm tra của thẻ');
    eq(k1.body.rev, d1.body.rev + 1, 'trả rev mới');
    const d2 = await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: k1.body.rev, answers: { a_t1_nl: 'Tư duy phản biện', a_t1_loi: 'Lý Thường Kiệt' } }, ta); eq(d2.status, 200, 'sửa sau kiểm tra được');
    const k2 = await call('POST', '/pwa/phieu/ai9_bai2/kiem', { the: 'a_t1' }, ta);
    eq(k2.body.dung, true); eq(k2.body.loi.giai_thich, 'GIAI_LOI');
    eq(getAt('phieu_bai/ai9_bai2/9a/hsA').kiem.a_t1.a_t1_nl, 'Học cách học', 'giữ câu trả lời lần đầu'); }
  // Nộp
  const r0 = getAt('phieu_bai/ai9_bai2/9a/hsA').rev, LS1 = String(r0 + 2);
  eq((await call('POST', '/pwa/phieu/ai9_bai2/submit', { rev: r0 }, ta)).body.error, 'MISSING', 'thiếu bắt buộc');
  const full = fillRequired(); delete full.hd1_chon; delete full.hd1_vi;
  const d6 = await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: r0, answers: full }, ta); eq(d6.status, 200, JSON.stringify(d6.body));
  const sub = await call('POST', '/pwa/phieu/ai9_bai2/submit', { rev: r0 + 1 }, ta); eq(sub.status, 200, JSON.stringify(sub.body));
  ok(getAt('phieu_ls/ai9_bai2/hsA/' + LS1)?.status === 'submitted', 'có bản chụp khi nộp');
  eq((await call('POST', '/pwa/phieu/ai9_bai2/submit', { rev: r0 + 2 }, ta)).body.error, 'NOT_EDITABLE', 'nộp rồi không nộp lại');
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: r0 + 2, answers: { a_t1_lam: 'x' } }, ta)).status, 409, 'nộp rồi không sửa');

  // Giáo viên: quyền lớp
  eq((await T({ op: 'lop', goi: 'ai9_bai2', lop: '9A' })).status, 401, 'không đăng nhập');
  eq((await T({ op: 'lop', goi: 'ai9_bai2', lop: '9A' }, ta)).status, 401, 'token HS');
  const l9a = await T({ op: 'lop', goi: 'ai9_bai2', lop: '9A' }, gv9a); eq(l9a.status, 200); ok(l9a.body.bai.hsA && l9a.body.dapan?.bi_mat, 'GV lớp thấy bài và đáp án');
  eq((await T({ op: 'lop', goi: 'ai9_bai2', lop: '9B' }, gv9a)).status, 403, 'GV 9A không xem 9B');
  eq((await T({ op: 'lop', goi: 'ai9_bai2', lop: '9B', gv_ma: 'gv2', gv_pin: '222222' })).status, 200, 'GV Sheet xem lớp mình');
  eq((await T({ op: 'lop', goi: 'ai9_bai2', lop: '9A', gv_ma: 'gv2', gv_pin: '222222' })).status, 403, 'GV Sheet không xem lớp khác');
  eq((await T({ op: 'lop', goi: 'ai9_bai2', lop: '9A', gv_ma: 'gv2', gv_pin: 'sai' })).status, 401);
  eq((await T({ op: 'cac_lop', goi: 'ai9_bai2' }, gv9a)).body.classes, ['9a'], 'GV lớp chỉ thấy lớp mình');
  eq((await T({ op: 'cac_lop', goi: 'ai9_bai2' }, admin)).body.classes.sort(), ['9a', '9b']);
  eq((await T({ op: 'lich_su', goi: 'ai9_bai2', lop: '9A', uid: 'hsC' }, gv9a)).status, 403, 'lịch sử HS lớp khác');
  ok(Object.keys((await T({ op: 'lich_su', goi: 'ai9_bai2', lop: '9A', uid: 'hsA' }, gv9a)).body.ls).includes(LS1));

  // Mở học liệu cho lớp
  eq((await T({ op: 'mo', goi: 'ai9_bai2', lop: '9A', block: 'khong_co' }, gv9a)).status, 400);
  eq((await T({ op: 'mo', goi: 'ai9_bai2', lop: '9A', block: 'pl925' }, gv9a)).status, 200);
  ok((await call('GET', '/pwa/phieu/ai9_bai2', null, tb)).body.pack.blocks.pl925, 'HS 9A thấy sau khi mở');
  ok(!(await call('GET', '/pwa/phieu/ai9_bai2', null, tc)).body.pack.blocks.pl925, 'lớp 9B chưa mở');

  // C3 (phán quyết): khóa có sẵn của đối tượng không phải học liệu
  eq((await T({ op: 'mo', goi: 'ai9_bai2', lop: '9A', block: 'constructor' }, gv9a)).status, 400, 'block constructor bị chặn');
  eq((await T({ op: 'mo', goi: 'ai9_bai2', lop: '9A', block: '__proto__' }, gv9a)).status, 400, 'block __proto__ bị chặn');
  // C2 (phán quyết): nộp khi chưa chốt thì máy chủ tự khóa lựa chọn đầu giờ
  { const g = await call('GET', '/pwa/phieu/ai9_bai2', null, tb);
    const fb = fillRequired();
    const d = await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: g.body.bai.rev, answers: fb }, tb); eq(d.status, 200, JSON.stringify(d.body));
    eq((await call('POST', '/pwa/phieu/ai9_bai2/submit', { rev: d.body.rev }, tb)).status, 200);
    ok(getAt('phieu_bai/ai9_bai2/9a/hsB').locked?.hd1_chon, 'nộp thì tự khóa lựa chọn đầu giờ');
    eq((await T({ op: 'tra_bai', goi: 'ai9_bai2', lop: '9A', uid: 'hsB' }, gv9a)).status, 200);
    const rb = getAt('phieu_bai/ai9_bai2/9a/hsB').rev;
    eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: rb, answers: { hd1_vi: 'đổi' } }, tb)).body.error, 'FIELD_LOCKED', 'trả bài vẫn không sửa lựa chọn đầu giờ'); }
  // Đánh giá, trả bài
  eq((await T({ op: 'tra_bai', goi: 'ai9_bai2', lop: '9B', uid: 'hsC' }, admin)).status, 409, 'bài chưa nộp không trả');
  eq((await T({ op: 'danh_gia', goi: 'ai9_bai2', lop: '9A', uid: 'hsA', muc: { '9.A3.1': 'xuat_sac' } }, gv9a)).status, 400, 'mức lạ');
  eq((await T({ op: 'danh_gia', goi: 'ai9_bai2', lop: '9A', uid: 'hsA', muc: { '9.A9.9': 'dat' } }, gv9a)).status, 400, 'mã YCCĐ lạ');
  eq((await T({ op: 'danh_gia', goi: 'ai9_bai2', lop: '9A', uid: 'hsA', muc: { '9.A3.1': 'dat', '9.A3.2': 'kha' }, nhan_xet: 'Mục tiêu 2 cần hạn rõ hơn.' }, gv9a)).status, 200);
  eq((await T({ op: 'danh_gia', goi: 'ai9_bai2', lop: '9A', uid: 'hsC', muc: {} }, gv9a)).status, 403, 'không đánh giá HS lớp khác');
  ok(!(await call('GET', '/pwa/phieu/ai9_bai2', null, ta)).body.gv, 'chưa trả bài thì HS chưa thấy nhận xét');
  eq((await T({ op: 'tra_bai', goi: 'ai9_bai2', lop: '9A', uid: 'hsA' }, gv9a)).status, 200);
  const back = await call('GET', '/pwa/phieu/ai9_bai2', null, ta);
  eq(back.body.bai.status, 'returned'); eq(back.body.gv.nhan_xet, 'Mục tiêu 2 cần hạn rõ hơn.'); ok(!JSON.stringify(back.body).includes('"muc"'), 'HS không thấy mức');
  eq((await call('PUT', '/pwa/phieu/ai9_bai2/draft', { rev: back.body.bai.rev, answers: { b2_truoc_ngay: '15/1' } }, ta)).status, 200, 'trả bài thì sửa được');
  const sub2 = await call('POST', '/pwa/phieu/ai9_bai2/submit', { rev: back.body.bai.rev + 1 }, ta); eq(sub2.status, 200);
  ok(getAt('phieu_ls/ai9_bai2/hsA/' + LS1) && getAt(`phieu_ls/ai9_bai2/hsA/${sub2.body.rev}`), 'giữ cả bản trước và bản sau');

  // Sửa gói (giai đoạn 7)
  const ed = JSON.parse(JSON.stringify(pack)); ed.activities[0].fields[0].label = 'Lúc đầu em chọn ba thẻ';
  eq((await T({ op: 'goi_luu', pack: ed, rev: 0 }, admin)).status, 409, 'rev gói cũ');
  eq((await T({ op: 'goi_luu', pack: ed, rev: 1 }, admin)).body.rev, 2);
  ok(getAt('phieu_bai/ai9_bai2/9a/hsA').answers.a_t1_lam, 'sửa nhãn không mất bài HS');
  const del = JSON.parse(JSON.stringify(ed)); del.activities[0].fields.pop();
  eq((await T({ op: 'goi_luu', pack: del, rev: 2 }, admin)).status, 400, 'không xóa trường');
  eq((await T({ op: 'goi_luu', pack: ed, rev: 2 }, gv9a)).status, 403);
  eq((await T({ op: 'goi_khoi_phuc', goi: 'ai9_bai2' }, admin)).body.rev, 3);
  eq(getAt('phieu_bo/ai9_bai2').activities[0].fields[0].label, pack.activities[0].fields[0].label, 'khôi phục bản gốc');
  const doc = await T({ op: 'goi_doc', goi: 'ai9_bai2' }, gv9a); eq(doc.status, 200); eq(doc.body.admin, false);

  // Công tắc tắt
  env.PHIEU_ENABLED = '0';
  eq((await call('GET', '/pwa/phieu', null, ta)).status, 404, 'tắt Học AI');
  env.PHIEU_ENABLED = '1';
  // Route cũ không bị ảnh hưởng
  eq((await call('GET', '/health')).status, 200);
} finally {
  globalThis.fetch = realFetch;
}
console.log(`test_phieu_worker: ${n} PASS`);
