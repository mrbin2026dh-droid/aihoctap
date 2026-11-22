// Lõi phiếu Học AI: lược đồ gói thật, kiểm nháp/nhóm/nộp, mở học liệu, sửa gói, CSV an toàn.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../worker/phieu-core.js';

const pack = JSON.parse(readFileSync(new URL('../data/phieu/ai9_bai2.json', import.meta.url), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
let n = 0; const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// Bản giao diện phải giống hệt bản Worker
eq(readFileSync(new URL('../frontend/hoc/phieu-core.js', import.meta.url), 'utf8'), readFileSync(new URL('../worker/phieu-core.js', import.meta.url), 'utf8'), 'hai bản phieu-core giống nhau');

// C1 gói thật hợp lệ
eq(C.validatePack(pack), [], 'gói thật hợp lệ');
// C2 không lộ đáp án
const txt = JSON.stringify(pack);
for (const s of ['Ngô Quyền', 'cố gắng học tốt hơn', '92 triệu', '170 triệu', 'Đáp án', 'đáp án', 'Future of Jobs']) ok(!txt.includes(s), 'gói HS không chứa: ' + s);
// Lược đồ hỏng
{ const p = clone(pack); p.activities[0].fields.push(clone(p.activities[0].fields[0])); ok(C.validatePack(p).some(e => e.includes('Trùng')), 'phát hiện trùng mã'); }
{ const p = clone(pack); p.ai_tutor = true; ok(C.validatePack(p).some(e => e.includes('Gia sư')), 'bắt tắt gia sư'); }
{ const p = clone(pack); for (const a of p.activities) for (const f of a.fields) if (f.evidence?.code === '9.A3.3' && f.evidence.kind === 'toi_thieu') f.an = true; ok(C.validatePack(p).some(e => e.includes('9.A3.3')), 'ẩn hết minh chứng tối thiểu thì báo'); }

{ const p = clone(pack); p.blocks['a/b'] = p.blocks.pl921; ok(C.validatePack(p).some(e => e.includes('Mã học liệu')), 'mã học liệu an toàn cho đường dẫn'); }
{ const p = clone(pack); p.blocks.pl921 = { ...p.blocks.pl921, text: ['x'.repeat(400001)] }; ok(C.validatePack(p).some(e => e.includes('quá lớn')), 'chặn gói quá lớn'); }

// C3 kiểm nháp
eq(C.checkDraft(pack, { a_t1_lam: 'Đối chiếu sách' }), { ok: true, clean: { a_t1_lam: 'Đối chiếu sách' } });
eq(C.checkDraft(pack, { khong_co: 'x' }).error, 'FIELD_UNKNOWN');
eq(C.checkDraft(pack, { n_c1: 'x' }).error, 'FIELD_GROUP', 'trường nhóm không vào nháp cá nhân');
eq(C.checkDraft(pack, { hd1_vi: 'x' }, { hd1_vi: 1 }).error, 'FIELD_LOCKED', 'trường đã chốt');
eq(C.checkDraft(pack, { a_t1_lam: 'x'.repeat(161) }).error, 'FIELD_TOO_LONG');
eq(C.checkDraft(pack, { a_t1_lam: 5 }).error, 'FIELD_TYPE');
eq(C.checkDraft(pack, { a_t1_em: 'bịa ra' }).error, 'FIELD_OPTION', 'thang tự chấm chỉ nhận lựa chọn có sẵn');
const the = pack.options.the_tuyen_dung;
eq(C.checkDraft(pack, { hd1_chon: [the[0], the[1], the[2], the[3]] }).error, 'EXACT_3', 'chọn quá 3 thẻ');
eq(C.checkDraft(pack, { hd1_chon: [the[0], the[0]] }).error, 'FIELD_OPTION', 'chọn trùng thẻ');
eq(C.checkDraft(pack, { hd1_chon: ['Thẻ bịa'] }).error, 'FIELD_OPTION');
ok(C.checkDraft(pack, { hd1_chon: [the[0]] }).ok, 'nháp được chọn chưa đủ 3');
eq(C.checkDraft(pack, ['x']).error, 'FIELD_TYPE');
eq(C.checkDraft(pack, { b_nhom1: 'x' }).error, 'FIELD_UNKNOWN', 'tiêu đề không nhận dữ liệu');
{ const big = {}; for (const a of pack.activities) for (const f of a.fields) if (f.type === 'textarea' && f.mode !== 'nhom') big[f.id] = 'x'.repeat(f.max); eq(C.checkDraft(pack, big).ok, true, 'đầy mọi ô vẫn dưới trần'); }

// Nhóm
eq(C.checkGroup(pack, { n_c1: 'Trước đây…' }).ok, true);
eq(C.checkGroup(pack, { a_t1_lam: 'x' }).error, 'FIELD_UNKNOWN', 'trường cá nhân không vào phiếu nhóm');
eq(C.checkGroup(pack, { n_pc_phan_bien: ['u1', 'u2'] }).error, 'FIELD_TOO_MANY');
eq(C.checkGroup(pack, { n_pc_c1: ['u1/../x'] }).error, 'FIELD_TYPE');
ok(C.checkGroup(pack, { n_nghe: 'Thợ may' }).ok, 'tên nghề tự ghi');

// Nộp: thiếu bắt buộc, show_if
const miss = C.missingForSubmit(pack, {});
ok(miss.includes('hd1_chon') && miss.includes('a_t1_lam'), 'nộp rỗng báo thiếu');
ok(!miss.includes('n_c1'), 'không bắt trường nhóm');
ok(C.missingForSubmit(pack, { hd1_chon: [the[0]] }).includes('hd1_chon'), 'phải đủ đúng 3 thẻ');
ok(C.isShown({ show_if: { tnl_nang_luc: ['Hợp tác'] } }, { tnl_nang_luc: 'Hợp tác' }) && !C.isShown({ show_if: { tnl_nang_luc: ['Hợp tác'] } }, {}), 'show_if');

// Mở học liệu
const v0 = C.studentView(pack, {}, {});
ok(!v0.blocks.pl925 && !v0.blocks.pl928_2 && v0.blocks.pl921, 'chưa mở thì không gửi nội dung');
ok(v0.locked_blocks.includes('pl925'), 'báo học liệu đang khóa');
ok(C.studentView(pack, { pl925: 1 }, {}).blocks.pl925, 'GV mở cho lớp');
ok(C.studentView(pack, {}, { d_vd2_hoi_lai: 'Em sẽ hỏi bà' }).blocks.pl928_2, 'trang 2 tự mở sau khi trả lời');
{ const p = clone(pack); p.activities[0].fields[1].an = true; ok(!C.studentView(p, {}, {}).activities[0].fields.some(f => f.id === p.activities[0].fields[1].id), 'trường ẩn không gửi HS'); }

// Sửa gói (giai đoạn 7)
{ const p = clone(pack); p.activities[0].fields[0].label = 'Nhãn mới'; eq(C.checkEdit(pack, p), [], 'đổi nhãn được'); }
{ const p = clone(pack); p.activities[0].fields.splice(1, 1); ok(C.checkEdit(pack, p).some(e => e.includes('ẩn trường')), 'không xóa trường'); }
{ const p = clone(pack); p.activities[0].fields[1].type = 'text'; ok(C.checkEdit(pack, p).some(e => e.includes('kiểu')), 'không đổi kiểu'); }
{ const p = clone(pack); p.id = 'khac_bai'; ok(C.checkEdit(pack, p).some(e => e.includes('mã gói')), 'không đổi mã gói'); }

// Khóa đường dẫn
eq(C.lopKey(' 9A10 '), '9a10'); eq(C.lopKey('9/A.1'), '9_a_1');
eq(C.safeUid('hs_01-a'), 'hs_01-a'); eq(C.safeUid('a/b'), null); eq(C.safeUid('a.b'), null); eq(C.safeUid(''), null);
eq(C.nhomKey(3), 'n3'); eq(C.nhomKey(0), null); eq(C.nhomKey('2x'), null);

// C6 CSV
eq(C.csvSafe('=1+1'), `"'=1+1"`); eq(C.csvSafe('-2'), `"'-2"`); eq(C.csvSafe('@x'), `"'@x"`);
eq(C.csvSafe('a "b"'), '"a ""b"""'); eq(C.csvSafe(['x', 'y']), '"x; y"'); eq(C.csvSafe(null), '""');

console.log(`test_phieu_core: ${n} PASS`);
