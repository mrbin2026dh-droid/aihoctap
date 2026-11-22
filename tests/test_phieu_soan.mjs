// Trình soạn bài Học AI (dạng mở): 8 dạng câu, tách đáp án khỏi bài học sinh, thêm/sửa/xóa/chuyển từng câu, chấm từng dạng.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { createFirebaseCustomToken, MockDONamespace } from '../worker/index.js';
import * as S from '../worker/soan-core.js';
import { sameAnswer } from '../worker/phieu.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const lf = u => readFileSync(new URL(u, import.meta.url), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
eq(lf('../frontend/hoc/soan-core.js'), lf('../worker/soan-core.js'), 'hai bản soan-core giống nhau');

// ---------- Lõi ----------
const Q = {
  mot: { type: 'mot', prompt: 'AI viết sai năm 938, em làm gì?', options: ['Chép luôn', 'Mở sách kiểm tra', 'Hỏi lại AI'], dung: [1], giai_thich: 'GT_MOT' },
  nhieu: { type: 'nhieu', prompt: 'Việc nào máy làm tốt?', options: ['Tính nhanh', 'An ủi bạn', 'Nhớ số điện thoại'], dung: [0, 2], giai_thich: 'GT_NHIEU' },
  dung_sai: { type: 'dung_sai', prompt: 'Đúng hay sai?', items: [{ text: 'AI có thể sai', dap: 'Đúng' }, { text: 'AI luôn đúng', dap: 'Sai' }], giai_thich: 'GT_DS' },
  phan_loai: { type: 'phan_loai', prompt: 'Xếp nhóm', nhom: ['Máy', 'Người'], items: [{ text: 'Tính tiền', dap: 'Máy' }, { text: 'Tư vấn khách', dap: 'Người' }], giai_thich: 'GT_PL' },
  ghep: { type: 'ghep', prompt: 'Ghép tình huống với năng lực', items: [{ text: 'AI viết sai', dap: 'Tư duy phản biện' }, { text: 'App mới', dap: 'Học cách học' }, { text: 'Làm nhóm', dap: 'Hợp tác' }], giai_thich: 'GT_GHEP' },
  thu_tu: { type: 'thu_tu', prompt: 'Sắp xếp các bước', items: [{ text: 'Hỏi AI' }, { text: 'Đọc kết quả' }, { text: 'Kiểm tra bằng sách' }, { text: 'Ghi vào vở' }], giai_thich: 'GT_TT' },
  dien: { type: 'dien', prompt: 'Ai thắng trận Bạch Đằng năm 938?', chap_nhan: ['Ngô Quyền'], giai_thich: 'GT_DIEN' },
  tu_luan: { type: 'tu_luan', prompt: 'Năng lực em thấy cần nhất là gì, vì sao?' }
};
for (const [k, q] of Object.entries(Q)) eq(S.checkQuestion(q), null, 'câu hợp lệ: ' + k);
eq(S.checkQuestion({ ...Q.mot, prompt: ' ' }).field, 'prompt');
eq(S.checkQuestion({ ...Q.mot, options: ['A'] }).field, 'options');
eq(S.checkQuestion({ ...Q.mot, options: ['A', 'A'] }).field, 'options', 'lựa chọn trùng');
eq(S.checkQuestion({ ...Q.mot, dung: [0, 1] }).field, 'dung', 'trắc nghiệm 1 đáp án chỉ 1 đáp án đúng');
eq(S.checkQuestion({ ...Q.nhieu, dung: [] }).field, 'dung');
eq(S.checkQuestion({ ...Q.mot, dung: [] }), null, 'trắc nghiệm không đáp án = câu khảo sát');
eq(S.checkQuestion({ ...Q.dung_sai, items: [{ text: 'x', dap: 'Có' }, { text: 'y', dap: 'Sai' }] }).field, 'items');
eq(S.checkQuestion({ ...Q.phan_loai, nhom: ['Máy'] }).field, 'nhom');
eq(S.checkQuestion({ ...Q.ghep, items: [{ text: 'a', dap: 'x' }, { text: 'b', dap: 'x' }] }).field, 'items', 'vế phải trùng');
eq(S.checkQuestion({ ...Q.dien, chap_nhan: [' '] }).field, 'chap_nhan');
eq(S.checkQuestion({ type: 'la', prompt: 'x' }).field, 'type');
ok(sameAnswer(['Nhớ số điện thoại', 'Tính nhanh'], ['Tính nhanh', 'Nhớ số điện thoại']), 'nhiều đáp án: không phụ thuộc thứ tự tích');
ok(!sameAnswer(['Tính nhanh'], ['Tính nhanh', 'Nhớ số điện thoại']), 'thiếu một đáp án là chưa đúng');
ok(sameAnswer('  ngô   QUYỀN ', { chap_nhan: ['Ngô Quyền'] }), 'câu điền: bỏ khoảng trắng, chữ hoa');
ok(!sameAnswer('Ngo Quyen', { chap_nhan: ['Ngô Quyền'] }), 'câu điền: giữ dấu tiếng Việt');
ok(sameAnswer('Ngô Quyền'.normalize('NFD'), { chap_nhan: ['Ngô Quyền'] }), 'câu điền: chuẩn hoá NFC');
{ const a = S.stableShuffle([1, 2, 3, 4, 5], 'abc'), b = S.stableShuffle([1, 2, 3, 4, 5], 'abc'); eq(a, b, 'xáo ổn định'); eq([...a].sort(), [1, 2, 3, 4, 5]); }

// ---------- Máy chủ ----------
const BASE = 'https://soan-test.firebaseio.test';
let root = {};
const getAt = path => path.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), root) ?? null;
const setAt = (path, v) => { const ks = path.split('/').filter(Boolean); let o = root; for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = JSON.parse(JSON.stringify(v)); };
const tag = v => 'e' + [...JSON.stringify(v)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), method = (init.method || 'GET').toUpperCase();
  if (!u.startsWith(BASE)) return realFetch(url, init);
  const path = u.slice(BASE.length + 1).split('?')[0].replace(/\.json$/, '');
  if (method === 'GET') { const v = getAt(path); return new Response(JSON.stringify(v), { headers: { ETag: tag(v) } }); }
  const im = init.headers?.['if-match'];
  if (im && im !== tag(getAt(path))) return new Response('{}', { status: 412 });
  setAt(path, method === 'DELETE' ? null : JSON.parse(init.body)); return new Response(init.body || 'null');
};
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const env = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_DATABASE_URL: BASE, FIREBASE_AUTH_TOKEN: 'tok', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', PHIEU_ENABLED: '1' };
const mk = (uid, claims) => createFirebaseCustomToken(uid, claims, kp.privateKey, env.FIREBASE_CLIENT_EMAIL, 'k', 43200);
const ta = await mk('hsA', { name: 'Học sinh A', grade: 9, class_code: '9A' });
const admin = await mk('teacher_admin', { role: 'teacher', admin: true, name: 'GV' });
const gv9a = await mk('gv1', { role: 'teacher', scope: 'class', classes: ['9A'], teacher_code: 'gv1' });
const call = async (method, path, body, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://x.github.io', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined }), env); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const T = (b, tok = admin) => call('POST', '/pwa/teacher/phieu', b, tok);
try {
  // Tạo bài, hoạt động
  eq((await T({ op: 'soan', viec: 'tao_bai', title: 'Bài thử', grade: 9 }, gv9a)).status, 403, 'GV lớp không soạn bài dùng chung');
  eq((await T({ op: 'soan', viec: 'tao_bai', title: '', grade: 9 })).body.field, 'title', 'lỗi gắn với ô tên bài');
  const b = await T({ op: 'soan', viec: 'tao_bai', title: 'Bài thử', grade: 9 }); eq(b.status, 200, JSON.stringify(b.body));
  const goi = b.body.goi; ok(/^b[0-9a-f]{10}$/.test(goi), 'mã bài tự sinh');
  ok((await call('GET', '/pwa/phieu', null, ta)).body.packs.some(p => p.id === goi), 'HS thấy bài mới (chưa có câu)');
  const h = await T({ op: 'soan', viec: 'them_hd', goi, title: 'Hoạt động 1', huong_dan: 'Làm từng câu rồi bấm Kiểm tra.' }); eq(h.status, 200);
  const hd = h.body.soan.activities[0].id;
  // Thêm 8 dạng câu
  const ids = {};
  for (const [k, q] of Object.entries(Q)) {
    const r = await T({ op: 'soan', viec: 'luu_cau', goi, hd, cau: q }); eq(r.status, 200, k + ' ' + JSON.stringify(r.body));
    ids[k] = r.body.soan.activities[0].questions.at(-1).id;
  }
  eq((await T({ op: 'soan', viec: 'luu_cau', goi, hd, cau: { ...Q.mot, options: ['x'] } })).body.field, 'options', 'máy chủ cũng kiểm câu');
  eq((await T({ op: 'soan', viec: 'luu_cau', goi, hd, cau: { ...Q.nhieu, id: ids.mot } })).body.field, 'type', 'không đổi dạng câu đã có');
  eq((await T({ op: 'soan_doc', goi }, gv9a)).status, 200, 'GV lớp xem được bài soạn');
  // Học sinh: bài không lộ đáp án, giải thích, câu chấp nhận
  const g = await call('GET', '/pwa/phieu/' + goi, null, ta); eq(g.status, 200);
  const s = JSON.stringify(g.body);
  for (const leak of ['GT_MOT', 'GT_NHIEU', 'GT_DS', 'GT_PL', 'GT_GHEP', 'GT_TT', 'GT_DIEN', 'Ngô Quyền', '"dung"', 'chap_nhan', '"dap"']) ok(!s.includes(leak), 'HS không thấy: ' + leak);
  const fm = new Map(g.body.pack.activities.flatMap(a => a.fields).map(f => [f.id, f]));
  eq(fm.get(ids.mot).type, 'choice'); eq(fm.get(ids.nhieu).type, 'multi'); eq(fm.get(ids.dien).type, 'text'); eq(fm.get(ids.tu_luan).type, 'textarea');
  eq(fm.get(ids.dung_sai + '_1').options, ['Đúng', 'Sai']); eq(fm.get(ids.ghep + '_1').kieu, 'chon');
  eq(fm.get(ids.thu_tu + '_1').options, ['1', '2', '3', '4'], 'thứ tự: chọn số');
  ok(g.body.pack.activities[0].buoc[0].the.length === 8 && !g.body.pack.activities[0].buoc[0].the.find(t => t.fields[0] === ids.tu_luan).kiem, 'tự luận không có nút Kiểm tra');
  // Học sinh làm và kiểm tra từng dạng
  let rev = g.body.bai.rev;
  const put = async a => { const r = await call('PUT', '/pwa/phieu/' + goi + '/draft', { rev, answers: a }, ta); eq(r.status, 200, JSON.stringify(r.body)); rev = r.body.rev; };
  const kiem = async id => { const r = await call('POST', '/pwa/phieu/' + goi + '/kiem', { the: id }, ta); eq(r.status, 200, JSON.stringify(r.body)); if (r.body.rev) rev = r.body.rev; return r.body; };
  await put({ [ids.mot]: 'Mở sách kiểm tra', [ids.nhieu]: ['Nhớ số điện thoại', 'Tính nhanh'], [ids.dien]: ' ngô quyền ',
    [ids.dung_sai + '_1']: 'Đúng', [ids.dung_sai + '_2']: 'Đúng', [ids.phan_loai + '_1']: 'Máy', [ids.phan_loai + '_2']: 'Người',
    [ids.ghep + '_1']: 'Tư duy phản biện', [ids.ghep + '_2']: 'Hợp tác', [ids.ghep + '_3']: 'Học cách học',
    [ids.thu_tu + '_1']: '1', [ids.thu_tu + '_2']: '2', [ids.thu_tu + '_3']: '3', [ids.thu_tu + '_4']: '4' });
  let r = await kiem(ids.mot); ok(r.ket_qua[0].dung && r.chot === 'GT_MOT', 'trắc nghiệm đúng + giải thích');
  r = await kiem(ids.nhieu); ok(r.ket_qua[0].dung, 'nhiều đáp án đúng dù tích khác thứ tự');
  r = await kiem(ids.dien); ok(r.ket_qua[0].dung, 'câu điền chấp nhận chữ thường');
  r = await kiem(ids.dung_sai); eq(r.ket_qua.map(x => x.dung), [true, false], 'đúng/sai từng ý');
  r = await kiem(ids.phan_loai); ok(r.ket_qua.every(x => x.dung));
  r = await kiem(ids.ghep); eq(r.ket_qua.map(x => x.dung).filter(Boolean).length, 1, 'ghép: 1 đúng, 2 sai');
  r = await kiem(ids.thu_tu); ok(r.ket_qua.every(x => x.dung), 'thứ tự đúng theo thứ tự giáo viên nhập');
  eq((await call('POST', '/pwa/phieu/' + goi + '/kiem', { the: ids.tu_luan }, ta)).status, 404, 'tự luận không chấm');
  // Sửa câu: giữ mã, đổi nội dung
  const sua = await T({ op: 'soan', viec: 'luu_cau', goi, cau: { ...Q.mot, id: ids.mot, prompt: 'Câu đã sửa' } }); eq(sua.status, 200);
  eq((await call('GET', '/pwa/phieu/' + goi, null, ta)).body.pack.activities[0].buoc[0].the[0].noi_dung, 'Câu đã sửa');
  // Chuyển câu, đếm bài đã làm, xóa câu đã có bài làm → ẩn, bài HS còn
  eq((await T({ op: 'soan', viec: 'chuyen_cau', goi, cau_id: ids.nhieu, huong: -1 })).body.soan.activities[0].questions[0].id, ids.nhieu, 'chuyển câu lên');
  eq((await T({ op: 'soan', viec: 'chuyen_cau', goi, cau_id: ids.nhieu, huong: -1 })).status, 400, 'câu đầu không lên được nữa');
  eq((await T({ op: 'soan', viec: 'dem', goi, cau_id: ids.ghep })).body.so, 1, 'đếm học sinh đã làm câu');
  eq((await T({ op: 'soan', viec: 'xoa_cau', goi, cau_id: ids.ghep })).status, 200);
  const g2 = await call('GET', '/pwa/phieu/' + goi, null, ta);
  ok(!JSON.stringify(g2.body.pack).includes('Ghép tình huống'), 'câu đã xóa không hiện cho HS');
  eq(g2.body.bai.answers[ids.ghep + '_1'], 'Tư duy phản biện', 'bài HS đã làm vẫn còn');
  ok(getAt('phieu_bo/' + goi).activities.find(a => a.id === 'da_xoa').fields.some(f => f.id === ids.ghep + '_1'), 'ô của câu đã xóa được giữ (ẩn)');
  // Thêm lại câu sau khi xóa, sửa/xóa hoạt động
  eq((await T({ op: 'soan', viec: 'luu_cau', goi, hd, cau: Q.ghep })).status, 200, 'thêm lại câu sau khi đã xóa');
  eq((await T({ op: 'soan', viec: 'sua_hd', goi, hd, title: 'Hoạt động mở đầu', huong_dan: '' })).body.soan.activities[0].title, 'Hoạt động mở đầu');
  const h2 = await T({ op: 'soan', viec: 'them_hd', goi, title: 'Hoạt động 2' }); eq(h2.body.soan.activities.length, 2);
  eq((await T({ op: 'soan', viec: 'chuyen_hd', goi, hd: h2.body.soan.activities[1].id, huong: -1 })).body.soan.activities[0].title, 'Hoạt động 2');
  eq((await T({ op: 'soan', viec: 'xoa_hd', goi, hd })).status, 200, 'xóa hoạt động');
  eq((await call('GET', '/pwa/phieu/' + goi, null, ta)).body.bai.answers[ids.mot], 'Mở sách kiểm tra', 'xóa hoạt động vẫn giữ bài HS');
  eq((await T({ op: 'soan', viec: 'sua_bai', goi, title: 'Bài thử (sửa)', grade: 9 })).body.soan.title, 'Bài thử (sửa)');
  eq((await T({ op: 'soan', viec: 'la', goi })).status, 400);
  // Xóa bài: GV lớp không được; đếm HS; xóa thì biến khỏi danh sách GV và HS, bài HS vẫn còn trên máy chủ
  eq((await T({ op: 'soan', viec: 'xoa_bai', goi }, gv9a)).status, 403, 'GV lớp không xóa bài dùng chung');
  eq((await T({ op: 'soan', viec: 'dem_bai', goi })).body.so, 1, 'đếm học sinh đã làm bài');
  eq((await T({ op: 'soan', viec: 'xoa_bai', goi: 'khong_co' })).status, 404);
  eq((await T({ op: 'soan', viec: 'xoa_bai', goi })).status, 200);
  ok(!(await T({ op: 'ds' })).body.packs.some(p => p.id === goi), 'bài đã xóa không còn trong danh sách GV');
  ok(!(await call('GET', '/pwa/phieu', null, ta)).body.packs.some(p => p.id === goi), 'HS không thấy bài đã xóa');
  eq((await call('GET', '/pwa/phieu/' + goi, null, ta)).status, 404);
  ok(getAt('phieu_bai/' + goi + '/9a/hsA').answers[ids.mot], 'bài học sinh vẫn còn trên máy chủ');
  ok(getAt('phieu_soan/' + goi), 'bài soạn vẫn còn để khôi phục khi cần');
  // Nhập bài từ tệp (bài mẫu): thay bài cũ cùng mã, ô cũ được ẩn
  setAt('phieu_bo/ai9_b2', JSON.parse(readFileSync(new URL('../data/phieu/ai9_b2.json', import.meta.url), 'utf8')));
  const mau = { id: 'ai9_b2', title: 'Bài 2 mẫu', grade: 9, activities: [{ id: 'hmau', title: 'Khởi động', questions: [{ ...Q.mot, id: 'cmau1' }] }] };
  const nh = await T({ op: 'soan', viec: 'nhap', soan: mau }); eq(nh.status, 200, JSON.stringify(nh.body));
  const gm = await call('GET', '/pwa/phieu/ai9_b2', null, ta);
  eq(gm.body.pack.activities.filter(a => !a.an).length, 1, 'bài mẫu thay bài cũ'); ok(getAt('phieu_bo/ai9_b2').activities.some(a => a.id === 'da_xoa'), 'ô bài cũ được ẩn, không xóa');
} finally { globalThis.fetch = realFetch; }
console.log(`test_phieu_soan: ${n} PASS`);
