// @ts-check
// Học AI: route phiếu học tập. Học sinh chỉ đọc/ghi bài của mình (và phiếu nhóm mình); giáo viên chỉ lớp mình.
// Nhánh RTDB (luật gốc .read/.write:false, chỉ Worker ghi bằng tài khoản dịch vụ):
//   phieu_ds/{goi}            mục lục (tên, khối, thứ tự, ẩn)
//   phieu_bo/{goi}            gói HS đang dùng       phieu_bo_goc/{goi}  bản gốc bất biến
//   phieu_dapan/{goi}         chỉ giáo viên          phieu_mo/{goi}/{lop}/{block}  học liệu GV đã mở
//   phieu_bai/{goi}/{lop}/{uid}   bài cá nhân        phieu_ls/{goi}/{uid}/{rev}   bản chụp khi nộp (không ghi đè)
//   phieu_nhom/{goi}/{lop}/{nX}   phiếu nhóm         phieu_gopy/{goi}/{lop}/{uid nhận}/{uid góp}  góp ý của bạn
//   phieu_gv/{goi}/{lop}/{uid}    đánh giá của GV
import { checkDraft, checkGroup, checkEdit, missingForSubmit, studentView, cardOf, isShown, validatePack, fieldMap, activeFieldMap, lopKey, safeUid, nhomKey, MUC_GV } from './phieu-core.js';

const GOI_RE = /^[a-z0-9_]{3,40}$/;

/** @param {any} env @param {any} keys @param {(env:any, pk:any)=>Promise<string|null>} getToken */
function makeDb(env, keys, getToken) {
  const base = env.FIREBASE_DATABASE_URL;
  const req = async (method, path, body, headers = {}, query = '') => {
    const tok = await getToken(env, keys?.privateKey);
    const h = { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...headers };
    return fetch(`${base}/${path}.json${query}`, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  };
  return {
    on: !!base,
    /** @returns {Promise<any>} */
    async get(path, query = '') {
      const r = await req('GET', path, undefined, {}, query);
      if (!r.ok) throw new Error('RTDB_GET ' + r.status);
      return r.json();
    },
    /** Đọc kèm ETag để ghi có điều kiện. */
    async getE(path) {
      const r = await req('GET', path, undefined, { 'X-Firebase-ETag': 'true' });
      if (!r.ok) throw new Error('RTDB_GET ' + r.status);
      return { val: await r.json(), etag: r.headers.get('ETag') || '' };
    },
    /** Ghi; có etag thì chỉ ghi khi chưa ai ghi chen (412 = xung đột). @returns {Promise<boolean>} */
    async put(path, body, etag) {
      const r = await req('PUT', path, body, etag ? { 'if-match': etag } : {});
      if (r.status === 412) return false;
      if (!r.ok) throw new Error('RTDB_PUT ' + r.status);
      return true;
    },
    async del(path) { const r = await req('DELETE', path); if (!r.ok) throw new Error('RTDB_DEL ' + r.status); }
  };
}

const MSG = {
  FIELD_UNKNOWN: 'Có mục không thuộc phiếu này.', FIELD_GROUP: 'Mục này thuộc phiếu nhóm.', FIELD_LOCKED: 'Mục này đã chốt, không sửa được.',
  FIELD_TOO_LONG: 'Câu trả lời quá dài.', FIELD_TYPE: 'Dữ liệu chưa đúng dạng.', FIELD_OPTION: 'Lựa chọn không có trong danh sách.',
  FIELD_TOO_MANY: 'Chọn quá số người cho phép.', DRAFT_TOO_BIG: 'Bài quá dài.', EXACT_3: 'Chỉ được chọn đúng 3.'
};

/**
 * @param {Request} request @param {any} env @param {any} keys @param {Record<string,string>} cors
 * @param {{verifyJwtToken:Function, hasTeacherClaims:Function, requireTeacher:Function, getToken:Function}} deps
 * @returns {Promise<Response|null>} null nếu không phải route phiếu
 */
export async function handlePhieu(request, env, keys, cors, deps) {
  const url = new URL(request.url);
  const p = url.pathname;
  const isTeacher = p === '/api/pwa/teacher/phieu';
  const sm = p.match(/^\/api\/pwa\/phieu(?:\/([a-z0-9_]{3,40})(?:\/(draft|lock|submit|nhom|gopy|kiem))?)?\/?$/);
  if (!isTeacher && !sm) return null;
  const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (env.PHIEU_ENABLED === '0') return J({ error: 'PHIEU_OFF', detail: 'Chức năng Học AI đang tắt.' }, 404);
  const db = makeDb(env, keys, deps.getToken);
  if (!db.on) return J({ error: 'PHIEU_OFF', detail: 'Chức năng Học AI chưa được cấu hình.' }, 404);
  try {
    return isTeacher ? await teacherRoute(request, env, keys, db, J, deps) : await studentRoute(request, keys, db, J, deps, sm?.[1], sm?.[2]);
  } catch (err) {
    return J({ error: 'SERVER', detail: 'Máy chủ đang bận. Thử lại sau.' }, 502);
  }
}

/* ---------------- Học sinh ---------------- */

async function studentFromToken(request, keys, deps) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ') || !keys?.publicKey) return null;
  const v = await deps.verifyJwtToken(h.slice(7).trim(), keys.publicKey);
  if (!v?.valid || deps.hasTeacherClaims(v.payload)) return null;
  const c = v.payload.claims || {};
  const uid = safeUid(v.payload.uid || v.payload.sub);
  if (!uid || !c.class_code) return null;
  return { uid, name: String(c.name || '').slice(0, 80), lop: String(c.class_code).slice(0, 40), lk: lopKey(c.class_code), grade: Number(c.grade) };
}

const emptyBai = () => ({ answers: {}, locked: {}, status: 'draft', rev: 0 });

async function studentRoute(request, keys, db, J, deps, goi, act) {
  const me = await studentFromToken(request, keys, deps);
  if (!me) return J({ error: 'UNAUTHORIZED', detail: 'Hãy đăng nhập lại.' }, 401);
  const m = request.method;

  if (!goi) {
    if (m !== 'GET') return J({ error: 'METHOD', detail: 'Phương thức không được hỗ trợ.' }, 405);
    const ds = (await db.get('phieu_ds')) || {};
    const packs = Object.entries(ds).filter(([, d]) => d && !d.an && Number(d.grade) === me.grade)
      .map(([id, d]) => ({ id, title: String(d.title || ''), grade: d.grade, thu_tu: d.thu_tu || 0, so_tiet: d.so_tiet || 0 }))
      .sort((a, b) => a.thu_tu - b.thu_tu);
    return J({ packs });
  }

  const pack = await db.get(`phieu_bo/${goi}`);
  if (!pack || pack.an) return J({ error: 'PACK_NOT_FOUND', detail: 'Không tìm thấy bài.' }, 404);
  if (Number(pack.grade) !== me.grade) return J({ error: 'GRADE_MISMATCH', detail: 'Bài này không dành cho khối của em.' }, 403);
  const path = `phieu_bai/${goi}/${me.lk}/${me.uid}`;
  const { val: cur, etag } = await db.getE(path);
  const bai = cur || emptyBai();

  if (m === 'GET' && !act) {
    const [opened, gv, gopy] = await Promise.all([db.get(`phieu_mo/${goi}/${me.lk}`), db.get(`phieu_gv/${goi}/${me.lk}/${me.uid}`), db.get(`phieu_gopy/${goi}/${me.lk}/${me.uid}`)]);
    const nk = bai.nhom || null;
    const nhom = nk ? await db.get(`phieu_nhom/${goi}/${me.lk}/${nk}`) : null;
    const tra = bai.status === 'returned' && gv ? { nhan_xet: String(gv.nhan_xet || '') } : null; // chỉ trả nhận xét khi GV trả bài
    return J({ pack: studentView(pack, opened || {}, bai.answers || {}), bai: { ...bai, uid: me.uid }, nhom: nhom ? { so: Number(String(nk).slice(1)), ...nhom } : null, gopy: gopy || {}, gv: tra });
  }

  const body = await request.json().catch(() => ({}));

  if (act === 'nhom' && m === 'PUT') return saveGroup(db, J, pack, goi, me, bai, path, etag, body);
  if (act === 'gopy') return peerReview(db, J, pack, goi, me, bai, m, body, new URL(request.url));
  if (act === 'kiem' && m === 'POST') return checkCard(db, J, pack, goi, me, bai, path, etag, body);

  if (Number(body.rev) !== Number(bai.rev)) return J({ error: 'REV_CONFLICT', detail: 'Bài đã được lưu từ máy khác. Tải lại để xem bản mới.', rev: bai.rev }, 409);
  if (!['draft', 'returned'].includes(bai.status)) return J({ error: 'NOT_EDITABLE', detail: 'Bài đã nộp. Chờ thầy cô trả bài để sửa.' }, 409);
  const meta = { name: me.name, class_code: me.lop, updated_at: Date.now(), pack_rev: pack.rev || 1 };
  const write = async next => (await db.put(path, next, etag || undefined)) ? null : J({ error: 'REV_CONFLICT', detail: 'Bài vừa được lưu từ máy khác. Tải lại để xem bản mới.' }, 409);

  if (act === 'draft' && m === 'PUT') {
    const r = checkDraft(pack, body.answers, bai.locked || {});
    if (!r.ok) return J({ error: r.error, field: r.field, detail: MSG[r.error] || 'Dữ liệu chưa hợp lệ.' }, r.error === 'FIELD_LOCKED' ? 409 : 400);
    const next = { ...bai, ...meta, answers: { ...(bai.answers || {}), ...r.clean }, rev: bai.rev + 1 };
    return (await write(next)) || J({ rev: next.rev });
  }
  if (act === 'lock' && m === 'POST') {
    const ids = [...activeFieldMap(pack).values()].filter(f => f.lock && f.lock === body.lock).map(f => f.id);
    if (!ids.length) return J({ error: 'LOCK_UNKNOWN', detail: 'Không có mục cần chốt.' }, 400);
    const miss = missingForSubmit(pack, bai.answers || {}).filter(id => ids.includes(id));
    if (miss.length) return J({ error: 'MISSING', fields: miss, detail: 'Hãy trả lời đủ trước khi chốt.' }, 400);
    const locked = { ...(bai.locked || {}) }; for (const id of ids) locked[id] = locked[id] || Date.now();
    const next = { ...bai, ...meta, locked, rev: bai.rev + 1 };
    return (await write(next)) || J({ rev: next.rev, locked });
  }
  if (act === 'submit' && m === 'POST') {
    const miss = missingForSubmit(pack, bai.answers || {});
    if (miss.length) return J({ error: 'MISSING', fields: miss, detail: 'Còn mục bắt buộc chưa trả lời.' }, 400);
    const rev = bai.rev + 1, lsPath = `phieu_ls/${goi}/${me.uid}/${rev}`;
    const ex = await db.getE(lsPath);
    if (ex.val !== null) return J({ error: 'REV_CONFLICT', detail: 'Thử lại.' }, 409);
    if (!(await db.put(lsPath, { answers: bai.answers || {}, pack_rev: pack.rev || 1, status: 'submitted', at: Date.now(), by: 'hs' }, ex.etag || undefined))) return J({ error: 'REV_CONFLICT', detail: 'Thử lại.' }, 409);
    const locked = { ...(bai.locked || {}) };   // nộp thì khóa luôn mọi mục cần chốt (giữ bằng chứng trước/sau)
    for (const f of fieldMap(pack).values()) if (f.lock && !locked[f.id]) locked[f.id] = Date.now();
    const next = { ...bai, ...meta, locked, status: 'submitted', submitted_at: Date.now(), rev };
    return (await write(next)) || J({ rev, status: 'submitted' });
  }
  return J({ error: 'METHOD', detail: 'Phương thức không được hỗ trợ.' }, 405);
}

/** Vào nhóm (body.so) và/hoặc lưu phần nhóm (body.answers, body.rev của phiếu nhóm). */
async function saveGroup(db, J, pack, goi, me, bai, path, etag, body) {
  const nk = nhomKey(body.so);
  if (!nk) return J({ error: 'NHOM_SAI', detail: 'Số nhóm từ 1 đến 20.' }, 400);
  if (bai.nhom && bai.nhom !== nk && bai.status !== 'draft' && bai.status !== 'returned') return J({ error: 'NOT_EDITABLE', detail: 'Bài đã nộp.' }, 409);
  const gpath = `phieu_nhom/${goi}/${me.lk}/${nk}`;
  const { val, etag: getag } = await db.getE(gpath);
  const g = val || { answers: {}, members: {}, by: {}, rev: 0 };
  const members = { ...(g.members || {}), [me.uid]: me.name };
  let answers = g.answers || {}, by = g.by || {}, rev = g.rev || 0;
  if (body.answers !== undefined) {
    if (Number(body.rev) !== Number(rev)) return J({ error: 'REV_CONFLICT', detail: 'Bạn trong nhóm vừa lưu. Tải lại để xem bản mới.', rev }, 409);
    const r = checkGroup(pack, body.answers);
    if (!r.ok) return J({ error: r.error, field: r.field, detail: MSG[r.error] || 'Dữ liệu chưa hợp lệ.' }, 400);
    const fm = activeFieldMap(pack);
    for (const [id, v] of Object.entries(r.clean)) if (fm.get(id).type === 'members' && v.some(u => !members[u])) return J({ error: 'NOT_MEMBER', field: id, detail: 'Chỉ chọn bạn trong nhóm.' }, 400);
    answers = { ...answers, ...r.clean };
    by = { ...by }; for (const id of Object.keys(r.clean)) by[id] = me.uid;
    rev += 1;
  } else if (g.members?.[me.uid]) {
    rev = g.rev || 0;
  } else rev += 1;
  if (!(await db.put(gpath, { answers, members, by, rev, updated_at: Date.now() }, getag || undefined))) return J({ error: 'REV_CONFLICT', detail: 'Bạn trong nhóm vừa lưu. Thử lại.' }, 409);
  if (bai.nhom !== nk) {
    if (bai.nhom) { // rời nhóm cũ
      const old = `phieu_nhom/${goi}/${me.lk}/${bai.nhom}`;
      const o = await db.get(old);
      if (o?.members?.[me.uid]) { const mem = { ...o.members }; delete mem[me.uid]; await db.put(old, { ...o, members: mem }); }
    }
    await db.put(path, { ...bai, nhom: nk, name: me.name, class_code: me.lop }, etag || undefined);
  }
  return J({ so: Number(nk.slice(1)), rev, members, answers, by });
}

/**
 * Kiểm tra một thẻ (ví dụ tình huống 1–6): chỉ trả giải thích SAU khi học sinh đã lưu câu trả lời của thẻ đó.
 * Ghi lại câu trả lời lần đầu (không ghi đè) để giáo viên thấy học sinh nghĩ gì trước khi xem giải thích.
 */
async function checkCard(db, J, pack, goi, me, bai, path, etag, body) {
  const key = String(body.the || '');
  if (!/^[a-z0-9_]{2,40}$/.test(key)) return J({ error: 'THE_SAI', detail: 'Không có phần kiểm tra này.' }, 400);
  const card = cardOf(pack, key);
  if (!card) return J({ error: 'THE_SAI', detail: 'Không có phần kiểm tra này.' }, 404);
  const ans = bai.answers || {};
  const fm = fieldMap(pack);
  // Ô cần trả lời trước khi kiểm tra: ô đang hiện của thẻ, trừ ô hiện sau kiểm tra và ô không bắt buộc kiểm tra
  const shown = (card.fields || []).filter(id => fm.has(id) && isShown(fm.get(id), ans));
  const need = shown.filter(id => !(card.sau_kiem || []).includes(id) && !(card.tu_chon || []).includes(id) && !id.endsWith('_loi'));
  const miss = need.filter(id => { const v = ans[id]; return Array.isArray(v) ? !v.length : !String(v ?? '').trim(); });
  if (miss.length) return J({ error: 'MISSING', fields: miss, detail: 'Em hãy trả lời trước rồi mới kiểm tra.' }, 400);
  let k = null;
  if (!card.chi_ghi) {
    k = await db.get(`phieu_dapan/${goi}/kiem/${key}`);
    if (!k || typeof k !== 'object' || !k.dap_an) return J({ error: 'NO_KEY', detail: 'Thầy cô chưa nạp phần giải thích.' }, 404);
  }
  let rev = bai.rev;
  if (!bai.kiem?.[key] && ['draft', 'returned'].includes(bai.status)) {
    const first = { at: Date.now() };
    for (const id of card.fields || []) if (ans[id] !== undefined) first[id] = ans[id];
    if (await db.put(path, { ...bai, kiem: { ...(bai.kiem || {}), [key]: first }, rev: bai.rev + 1 }, etag || undefined)) rev = bai.rev + 1;
  }
  if (card.chi_ghi) return J({ the: key, rev, chi_ghi: true, ket_qua: [] });
  const ket_qua = [];
  for (const id of shown) {
    if (!Object.hasOwn(k.dap_an, id) || ans[id] === undefined || ans[id] === '') continue;
    const dung = JSON.stringify(ans[id]) === JSON.stringify(k.dap_an[id]);
    const gt = k.giai_thich && Object.hasOwn(k.giai_thich, id) ? k.giai_thich[id] : '';
    const sai = k.goi_y_sai && Object.hasOwn(k.goi_y_sai, id) ? k.goi_y_sai[id] : '';
    ket_qua.push({ field: id, dung, giai_thich: String(dung || !sai ? gt : sai) });
  }
  const tatCa = ket_qua.length > 0 && ket_qua.every(x => x.dung);
  return J({ the: key, rev, ket_qua, ten: String(k.ten || ''), chot: tatCa || k.chot_luon ? String(k.chot || '') : '' });
}

/** Góp ý của bạn cùng nhóm cho mục tiêu (phần B). GET ?uid= xem mục tiêu của bạn; POST lưu góp ý. */
async function peerReview(db, J, pack, goi, me, bai, m, body, url) {
  const pr = (pack.activities || []).map(a => a.peer_review).find(Boolean);
  if (!pr) return J({ error: 'NO_PEER', detail: 'Bài này không có phần góp ý.' }, 404);
  const target = safeUid(m === 'GET' ? url.searchParams.get('uid') : body.uid);
  if (!target || target === me.uid) return J({ error: 'PEER_SAI', detail: 'Chọn một bạn trong nhóm.' }, 400);
  if (!bai.nhom) return J({ error: 'NO_GROUP', detail: 'Em cần vào nhóm trước.' }, 409);
  const g = await db.get(`phieu_nhom/${goi}/${me.lk}/${bai.nhom}`);
  if (!g?.members?.[target]) return J({ error: 'NOT_MEMBER', detail: 'Chỉ góp ý cho bạn cùng nhóm.' }, 403);
  if (m === 'GET') {
    const tb = (await db.get(`phieu_bai/${goi}/${me.lk}/${target}`)) || {};
    const ans = {};
    for (const t of pr.targets) for (const id of t.fields) if (tb.answers?.[id] !== undefined) ans[id] = tb.answers[id];
    return J({ uid: target, name: g.members[target], answers: ans }); // chỉ các trường được góp ý
  }
  if (m !== 'POST') return J({ error: 'METHOD', detail: 'Phương thức không được hỗ trợ.' }, 405);
  const t = pr.targets.find(x => x.goal === Number(body.goal));
  if (!t) return J({ error: 'PEER_SAI', detail: 'Mục tiêu không có.' }, 400);
  const checks = Array.isArray(body.checks) ? body.checks.slice(0, t.kiem.length).map(Boolean) : [];
  const text = String(body.text || '').slice(0, 600);
  const p2 = `phieu_gopy/${goi}/${me.lk}/${target}/${me.uid}`;
  const cur = (await db.get(p2)) || {};
  await db.put(p2, { ...cur, name: me.name, ['g' + t.goal]: { checks, text, at: Date.now() } });
  return J({ ok: true });
}

/* ---------------- Giáo viên ---------------- */

/** @returns {Promise<{ok:true, admin:boolean, classes:string[]|null, who:string}|{ok:false, res?:Response}>} */
async function teacherAuth(request, env, keys, body, deps) {
  const a = await deps.requireTeacher(request, env, keys, {});
  if (a.authorized) {
    const admin = !!a.user?.admin;
    return { ok: true, admin, classes: admin ? null : (a.user?.classes || []).map(lopKey), who: admin ? 'admin' : 'gv:' + String(a.user?.teacher_code || '') };
  }
  const ma = String(body?.gv_ma || '').trim(), pin = String(body?.gv_pin || '').trim();
  if (ma && pin && env.SHEET_LOGIN_URL) {
    try {
      const r = await fetch(env.SHEET_LOGIN_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'gv_login', ma, pin }) });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.teacher) {
        const lop = Array.isArray(d.teacher.lop) ? d.teacher.lop : String(d.teacher.lop || '').split(/[,;]/);
        return { ok: true, admin: false, classes: lop.map(lopKey).filter(Boolean), who: 'gv:' + String(d.teacher.ma || ma).toLowerCase() };
      }
    } catch { /* từ chối */ }
  }
  return { ok: false };
}

async function teacherRoute(request, env, keys, db, J, deps) {
  if (request.method !== 'POST') return J({ error: 'METHOD', detail: 'Phương thức không được hỗ trợ.' }, 405);
  const body = await request.json().catch(() => ({}));
  const t = await teacherAuth(request, env, keys, body, deps);
  if (!t.ok) return J({ error: 'UNAUTHORIZED', detail: 'Cần đăng nhập giáo viên.' }, 401);
  const op = String(body.op || '');
  const goi = String(body.goi || '');
  const needGoi = () => (GOI_RE.test(goi) ? null : J({ error: 'GOI_SAI', detail: 'Mã bài không hợp lệ.' }, 400));
  const lk = lopKey(body.lop);
  const lopOk = () => (lk && (t.classes === null || t.classes.includes(lk)) ? null : J({ error: 'FORBIDDEN', detail: 'Thầy cô không phụ trách lớp này.' }, 403));
  const adminOnly = () => (t.admin ? null : J({ error: 'FORBIDDEN', detail: 'Chỉ giáo viên quản trị được sửa bài dùng chung.' }, 403));

  if (op === 'ds') {
    const ds = (await db.get('phieu_ds')) || {};
    return J({ packs: Object.entries(ds).map(([id, d]) => ({ id, ...d })).sort((a, b) => (a.grade - b.grade) || ((a.thu_tu || 0) - (b.thu_tu || 0))), classes: t.classes, admin: t.admin });
  }
  if (op === 'cac_lop') {
    const e = needGoi(); if (e) return e;
    const keysObj = (await db.get(`phieu_bai/${goi}`, '?shallow=true')) || {};
    const all = Object.keys(keysObj);
    return J({ classes: t.classes === null ? all : all.filter(k => t.classes.includes(k)), mine: t.classes });
  }
  if (op === 'lop') {
    const e = needGoi() || lopOk(); if (e) return e;
    const [pack, bai, nhom, gv, mo, gopy, dapan] = await Promise.all(['phieu_bo/' + goi, `phieu_bai/${goi}/${lk}`, `phieu_nhom/${goi}/${lk}`, `phieu_gv/${goi}/${lk}`, `phieu_mo/${goi}/${lk}`, `phieu_gopy/${goi}/${lk}`, 'phieu_dapan/' + goi].map(x => db.get(x)));
    if (!pack) return J({ error: 'PACK_NOT_FOUND', detail: 'Không tìm thấy bài.' }, 404);
    return J({ pack, bai: bai || {}, nhom: nhom || {}, gv: gv || {}, mo: mo || {}, gopy: gopy || {}, dapan: dapan || null });
  }
  if (op === 'lich_su') {
    const e = needGoi() || lopOk(); if (e) return e;
    const uid = safeUid(body.uid); if (!uid) return J({ error: 'UID_SAI', detail: 'Mã học sinh không hợp lệ.' }, 400);
    if (!(await db.get(`phieu_bai/${goi}/${lk}/${uid}`))) return J({ error: 'FORBIDDEN', detail: 'Học sinh không thuộc lớp này.' }, 403);
    return J({ ls: (await db.get(`phieu_ls/${goi}/${uid}`)) || {} });
  }
  if (op === 'mo') {
    const e = needGoi() || lopOk(); if (e) return e;
    const pack = await db.get('phieu_bo/' + goi);
    if (typeof body.block !== 'string' || !/^[a-z0-9_]{2,40}$/.test(body.block) || !Object.hasOwn(pack?.blocks || {}, body.block)) return J({ error: 'BLOCK_SAI', detail: 'Không có học liệu này.' }, 400);
    const pth = `phieu_mo/${goi}/${lk}/${body.block}`;
    if (body.open === false) await db.del(pth); else await db.put(pth, Date.now());
    return J({ ok: true });
  }
  if (op === 'danh_gia') {
    const e = needGoi() || lopOk(); if (e) return e;
    const uid = safeUid(body.uid); if (!uid) return J({ error: 'UID_SAI', detail: 'Mã học sinh không hợp lệ.' }, 400);
    const pack = await db.get('phieu_bo/' + goi);
    if (!pack || !(await db.get(`phieu_bai/${goi}/${lk}/${uid}`))) return J({ error: 'FORBIDDEN', detail: 'Học sinh không thuộc lớp này.' }, 403);
    const codes = (pack.yccd || []).map(y => y.code);
    const muc = {};
    for (const [k, v] of Object.entries(body.muc || {})) {
      if (!codes.includes(k) || !(v === '' || MUC_GV.includes(v))) return J({ error: 'MUC_SAI', detail: 'Mức đánh giá không hợp lệ.' }, 400);
      if (v) muc[k] = v;
    }
    const nx = String(body.nhan_xet || '').slice(0, 2000), ghi = String(body.trinh_bay || '').slice(0, 1000);
    await db.put(`phieu_gv/${goi}/${lk}/${uid}`, { muc, nhan_xet: nx, trinh_bay: ghi, by: t.who, at: Date.now() });
    return J({ ok: true });
  }
  if (op === 'tra_bai') {
    const e = needGoi() || lopOk(); if (e) return e;
    const uid = safeUid(body.uid); if (!uid) return J({ error: 'UID_SAI', detail: 'Mã học sinh không hợp lệ.' }, 400);
    const pth = `phieu_bai/${goi}/${lk}/${uid}`;
    const { val, etag } = await db.getE(pth);
    if (!val) return J({ error: 'FORBIDDEN', detail: 'Học sinh không thuộc lớp này.' }, 403);
    if (val.status !== 'submitted') return J({ error: 'NOT_SUBMITTED', detail: 'Bài chưa nộp.' }, 409);
    if (!(await db.put(pth, { ...val, status: 'returned', returned_at: Date.now(), rev: (val.rev || 0) + 1 }, etag || undefined))) return J({ error: 'REV_CONFLICT', detail: 'Thử lại.' }, 409);
    return J({ ok: true });
  }

  /* Trình soạn gói: đọc cho mọi GV; ghi chỉ GV quản trị (gói dùng chung nhiều lớp). */
  if (op === 'goi_doc') {
    const e = needGoi(); if (e) return e;
    const [pack, goc, dapan] = await Promise.all(['phieu_bo/' + goi, 'phieu_bo_goc/' + goi, 'phieu_dapan/' + goi].map(x => db.get(x)));
    return J({ pack, goc, dapan, admin: t.admin });
  }
  if (op === 'goi_luu') {
    const e = adminOnly(); if (e) return e;
    const next = body.pack;
    if (!next || !GOI_RE.test(String(next.id || ''))) return J({ error: 'GOI_SAI', detail: 'Mã bài không hợp lệ.' }, 400);
    const { val: old, etag } = await db.getE('phieu_bo/' + next.id);
    const errs = old ? checkEdit(old, next) : validatePack(next);
    if (errs.length) return J({ error: 'PACK_INVALID', errors: errs.slice(0, 20), detail: errs[0] }, 400);
    if (old && Number(body.rev) !== Number(old.rev)) return J({ error: 'REV_CONFLICT', detail: 'Bài vừa được sửa ở máy khác. Tải lại.', rev: old.rev }, 409);
    const saved = { ...next, rev: (old?.rev || 0) + 1, ban_goc: false, sua_luc: Date.now() };
    if (!old) saved.ban_goc = true;
    if (!(await db.put('phieu_bo/' + next.id, saved, old ? etag : undefined))) return J({ error: 'REV_CONFLICT', detail: 'Thử lại.' }, 409);
    if (!old && !(await db.get('phieu_bo_goc/' + next.id))) await db.put('phieu_bo_goc/' + next.id, { ...next, rev: 1, ban_goc: true });
    await db.put('phieu_ds/' + next.id, { title: saved.title, grade: saved.grade, thu_tu: saved.thu_tu || 0, so_tiet: saved.so_tiet || 0, an: !!saved.an, rev: saved.rev });
    return J({ ok: true, rev: saved.rev });
  }
  if (op === 'goi_khoi_phuc') {
    const e = adminOnly() || needGoi(); if (e) return e;
    const [goc, cur] = await Promise.all([db.get('phieu_bo_goc/' + goi), db.get('phieu_bo/' + goi)]);
    if (!goc) return J({ error: 'NO_GOC', detail: 'Không có bản gốc.' }, 404);
    const errs = cur ? checkEdit(cur, goc) : [];
    if (errs.length) return J({ error: 'PACK_INVALID', errors: errs, detail: 'Bản đang dùng có trường mới không có trong bản gốc; hãy ẩn thay vì khôi phục.' }, 409);
    const saved = { ...goc, rev: (cur?.rev || 0) + 1, ban_goc: true, sua_luc: Date.now() };
    await db.put('phieu_bo/' + goi, saved);
    await db.put('phieu_ds/' + goi, { title: saved.title, grade: saved.grade, thu_tu: saved.thu_tu || 0, so_tiet: saved.so_tiet || 0, an: !!saved.an, rev: saved.rev });
    return J({ ok: true, rev: saved.rev });
  }
  if (op === 'goi_an') {
    const e = adminOnly() || needGoi(); if (e) return e;
    const { val: cur, etag } = await db.getE('phieu_bo/' + goi);
    if (!cur) return J({ error: 'PACK_NOT_FOUND', detail: 'Không tìm thấy bài.' }, 404);
    const an = body.an === true;
    if (!(await db.put('phieu_bo/' + goi, { ...cur, an, rev: (cur.rev || 0) + 1 }, etag || undefined))) return J({ error: 'REV_CONFLICT', detail: 'Thử lại.' }, 409);
    await db.put('phieu_ds/' + goi, { title: cur.title, grade: cur.grade, thu_tu: cur.thu_tu || 0, so_tiet: cur.so_tiet || 0, an, rev: (cur.rev || 0) + 1 });
    return J({ ok: true, an });
  }
  if (op === 'dapan_luu') {
    const e = adminOnly() || needGoi(); if (e) return e;
    const d = body.dapan;
    if (!d || typeof d !== 'object' || d.id !== goi || JSON.stringify(d).length > 400000) return J({ error: 'DAPAN_SAI', detail: 'Tệp đáp án không đúng bài.' }, 400);
    await db.put('phieu_dapan/' + goi, { ...d, chi_gv: true, sua_luc: Date.now() });
    return J({ ok: true });
  }
  return J({ error: 'OP_SAI', detail: 'Thao tác không hợp lệ.' }, 400);
}
