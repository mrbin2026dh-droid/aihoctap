// Cổng 4 — đo tải thật bằng TOKEN CỦA HỌC SINH (không dùng quyền quản trị để ghi thay học sinh, nên luật RTDB được kiểm thật).
// Chạy trên máy có firebase-tools đã đăng nhập (giống test_live_pilot_3_students.mjs):
//   node tests/load_gate4.mjs --n=30 --mb=10     # 30 học sinh cùng nộp file 10 MB
//   node tests/load_gate4.mjs --n=100 --mb=0     # 100 học sinh cùng vào thi + lưu nháp + nộp bài (không nộp file)
// Kết quả in số thật (p50/p95/max, số thành công, số lần thử lại). Thoát mã 1 nếu không đạt. Dọn tài khoản/dữ liệu RTDB khi xong;
// file Drive thử nằm trong thư mục lớp "9LOAD" — xóa tay sau khi xem.
import { readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import process from 'node:process';

// Tự ghi nhật ký thô vào docs/evidence/ (kèm mã commit và mã băm của chính script) để kết quả kiểm chứng lại được.
const LOG = `docs/evidence/gate4-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
try { mkdirSync('docs/evidence', { recursive: true }); } catch { /* bỏ qua */ }
const _log = console.log.bind(console);
console.log = (...a) => { _log(...a); try { appendFileSync(LOG, a.join(' ') + '\n'); } catch { /* bỏ qua */ } };
let HEAD = '?'; try { HEAD = execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain tests/load_gate4.mjs').toString().trim() ? ' (script ĐÃ SỬA, chưa commit)' : ''); } catch { /* bỏ qua */ }
console.log(`# commit ${HEAD}; sha256(script)=${createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex').slice(0, 16)}; args=${process.argv.slice(2).join(' ')}`);

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const N = arg('n', 30), MB = arg('mb', 10), UPLOAD_WINDOW_S = arg('window', 60), CONC_PROVISION = 10;
const config = JSON.parse(readFileSync(`${process.env.USERPROFILE || process.env.HOME}/.config/configstore/firebase-tools.json`, 'utf8'));
const adminHeaders = { Authorization: `Bearer ${config.tokens?.access_token}`, 'Content-Type': 'application/json' };
const PROJ = 'day-hoc-tuong-tac-7ee69';
const DB_URL = `https://${PROJ}-default-rtdb.asia-southeast1.firebasedatabase.app`;
const API_KEY = 'AIzaSyCC2tCURXYAMpdN687kcjY537K7zUhh_Fg';
const GAS = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbz5b5dzfz9nqqk31YDflGSm8DJ6sQFpCwaiIoN33bRLQwU7VFzXCaTmvbaVkZmzFw/exec';
const EXAM = 'load_tin9_' + Date.now().toString().slice(-5);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)] : 0; };
const stat = (name, a) => console.log(`${name}: n=${a.length} p50=${pct(a, 50)}ms p95=${pct(a, 95)}ms max=${Math.max(0, ...a)}ms`);
async function pool(items, conc, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

async function admin(path, method = 'GET', body) {
  const r = await fetch(`${DB_URL}/${path}.json`, { method, headers: adminHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`admin ${method} ${path} → ${r.status}`);
  return r.json();
}
/** Gọi RTDB bằng token học sinh; trả {status, data}. */
async function asStudent(s, path, method = 'GET', body) {
  const r = await fetch(`${DB_URL}/${path}.json?auth=${encodeURIComponent(s.idToken)}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function gas(data) {
  const r = await fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
  return r.json(); // trang HTML khi quá tải → ném lỗi → coi là phải thử lại
}
async function provision(i) {
  const sid = `hs_load${String(i).padStart(3, '0')}`, email = `${sid}@hs.aihoc.test`, pin = '654321';
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJ}/accounts`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ email, password: pin, emailVerified: true }) });
  const d = await r.json(); let uid = d.localId;
  if (!uid && d.error?.message?.includes('EMAIL_EXISTS')) {
    const l = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ email: [email], targetProjectId: PROJ }) })).json();
    uid = l.users?.[0]?.localId;
  }
  if (!uid) throw new Error('không tạo được ' + sid);
  await admin(`students/${uid}`, 'PUT', { student_id: sid.toUpperCase(), name: `Học sinh tải ${i}`, class_code: '9LOAD', grade: 9, email, updated_at: { '.sv': 'timestamp' } });
  return { i, sid, uid, email, pin };
}
async function signIn(s) {
  const t0 = Date.now();
  const d = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: s.email, password: s.pin, returnSecureToken: true }) })).json();
  if (!d.idToken) throw new Error('đăng nhập lỗi ' + s.sid + ' ' + JSON.stringify(d.error?.message));
  s.idToken = d.idToken; return Date.now() - t0;
}
/** Nộp file giống exam-fb.js: thử lại giãn cách khi Apps Script bận. */
async function upload(s, b64) {
  const t0 = Date.now(); let tries = 0;
  for (;;) {
    tries++;
    try {
      const ack = await gas({ action: 'upload_practice', idToken: s.idToken, exam_id: EXAM, name: `bai_${s.sid}.xlsx`, mime: 'application/octet-stream', b64 });
      if (ack?.ok && ack.file_id && !String(ack.file_id).startsWith('pending')) return { ok: true, ms: Date.now() - t0, tries };
      if (ack?.ok === false && ack.error && !ack.retry) return { ok: false, ms: Date.now() - t0, tries, error: ack.error };
    } catch { /* trang HTML / mạng → thử lại */ }
    if (tries >= 6) return { ok: false, ms: Date.now() - t0, tries, error: 'hết 6 lần thử' };
    await sleep(Math.min(32000, 2000 * 2 ** (tries - 1)) + Math.random() * 1000);
  }
}

const fails = []; const must = (c, m) => { if (!c) fails.push(m); };
let students = [];
async function main() {
  console.log(`=== CỔNG 4: ${N} học sinh, file ${MB} MB, đề ${EXAM} ===`);
  students = await pool(Array.from({ length: N }, (_, k) => k + 1), CONC_PROVISION, provision);
  console.log(`Đã tạo ${students.length} tài khoản.`);

  const t = Date.now();
  await admin(`exam_meta/${EXAM}`, 'PUT', { title: 'Đo tải', grade: 9, minutes: 20, opens_at: t - 60000, closes_at: t + 30 * 60000, max_attempts: 1, backend: 'firebase', question_count: 2, total_points: 4,
    parts: [{ key: 'theory', label: 'Trắc nghiệm', max: 4 }, { key: 'practice', label: 'Thực hành', max: 6 }] });
  await admin(`exam_questions/${EXAM}`, 'PUT', { q1: { order: 1, kind: 'choice', prompt: 'CPU là gì?', options: { A: 'Bộ xử lý', B: 'Bộ nhớ' }, points: 2 }, q2: { order: 2, kind: 'choice', prompt: 'RAM là gì?', options: { A: 'Bộ xử lý', B: 'Bộ nhớ' }, points: 2 } });
  await admin(`exam_secrets/${EXAM}`, 'PUT', { q1: 'A', q2: 'B' });

  // 1) Đăng nhập đồng loạt
  const signMs = await pool(students, N, signIn); stat('Đăng nhập đồng loạt', signMs);
  must(pct(signMs, 95) < 3000, 'đăng nhập p95 phải < 3000 ms');

  // 2) Kiểm luật bằng token học sinh thật
  console.log('Kiểm luật bằng token học sinh…');
  const a = students[0], b = students[1];
  const neg = async (label, p) => { const r = await p; const blocked = r.status === 401 || r.status === 403; console.log(`${blocked ? '✔' : '✘'} luật: ${label} → HTTP ${r.status}${blocked ? ' (bị chặn)' : ' (KHÔNG bị chặn!)'}`); must(blocked, `luật: ${label} phải bị chặn (nhận ${r.status})`); };
  await neg('HS đọc exam_secrets', asStudent(a, `exam_secrets/${EXAM}`));
  await neg('HS ghi results', asStudent(a, `results/${EXAM}/${a.uid}`, 'PUT', { total_score: 10 }));
  await neg('HS ghi nháp của bạn khác', asStudent(a, `drafts/${EXAM}/${b.uid}`, 'PUT', { updated_at: { '.sv': 'timestamp' }, answers: { q1: 'A' }, leaves: 0 }));
  await neg('HS tự kéo dài giờ (extra_ms)', asStudent(a, `sessions/${EXAM}/${a.uid}`, 'PUT', { started_at: { '.sv': 'timestamp' }, extra_ms: 600000 }));
  await neg('HS sửa exam_meta', asStudent(a, `exam_meta/${EXAM}/closes_at`, 'PUT', 9999999999999));

  // 3) Vào thi + nháp + nộp, tất cả dùng token học sinh, đồng loạt
  const enter = []; const draft = []; const submit = [];
  const failsEnter = await pool(students, N, async s => {
    let t0 = Date.now();
    const c = await asStudent(s, `clock/${s.uid}`, 'PUT', { '.sv': 'timestamp' });
    const se = await asStudent(s, `sessions/${EXAM}/${s.uid}`, 'PUT', { started_at: { '.sv': 'timestamp' }, extra_ms: 0 });
    const q = await asStudent(s, `exam_questions/${EXAM}`);
    enter.push(Date.now() - t0); t0 = Date.now();
    const dr = await asStudent(s, `drafts/${EXAM}/${s.uid}`, 'PUT', { updated_at: { '.sv': 'timestamp' }, answers: { q1: 'A', q2: s.i % 2 ? 'B' : 'A' }, leaves: 0 });
    draft.push(Date.now() - t0); t0 = Date.now();
    const at = await asStudent(s, `attempts/${EXAM}/${s.uid}/1`, 'PUT', { submitted_at: { '.sv': 'timestamp' }, answers: { q1: 'A', q2: s.i % 2 ? 'B' : 'A' } });
    submit.push(Date.now() - t0);
    return [c, se, q, dr, at].some(x => x.status !== 200 || x.data === null) ? s.sid : null;
  });
  stat('Vào thi (đồng hồ + phiên + tải đề)', enter); stat('Lưu nháp', draft); stat('Nộp bài (ghi attempts)', submit);
  const bad = failsEnter.filter(Boolean); must(bad.length === 0, `${bad.length} học sinh lỗi ở bước vào/nháp/nộp: ${bad.slice(0, 5).join(', ')}`);
  const again = await asStudent(a, `attempts/${EXAM}/${a.uid}/1`, 'PUT', { submitted_at: { '.sv': 'timestamp' }, answers: { q1: 'B' } });
  console.log(`${again.status === 401 || again.status === 403 ? '✔' : '✘'} luật: nộp đè attempts/1 → HTTP ${again.status}`); must(again.status === 401 || again.status === 403, 'nộp đè lượt 1 phải bị chặn');

  // 4) Chấm ngay đồng loạt (grade_my_attempt) — đo độ bận của Apps Script
  const gradeMs = []; let gradeOk = 0;
  await pool(students, N, async s => { const t0 = Date.now(); try { const r = await gas({ action: 'grade_my_attempt', idToken: s.idToken, exam_id: EXAM, attempt: '1' }); if (r?.ok) gradeOk++; } catch { /* bận */ } gradeMs.push(Date.now() - t0); });
  console.log(`Chấm ngay đồng loạt: ${gradeOk}/${N} trả điểm ngay (phần còn lại sẽ được trigger tick() chấm bù)`);
  stat('grade_my_attempt', gradeMs);

  // 5) Nộp file thực hành đồng loạt
  if (MB > 0) {
    const b64 = randomBytes(Math.round(MB * 1024 * 1024 * 0.999)).toString('base64');
    console.log(`Nộp file ${MB} MB (base64 ${(b64.length / 1048576).toFixed(1)} MB) × ${N} đồng thời…`);
    const t0 = Date.now();
    const ups = await pool(students, N, s => upload(s, b64));
    const total = Date.now() - t0, okN = ups.filter(u => u.ok).length;
    stat('Nộp file (mỗi em, gồm thử lại)', ups.map(u => u.ms));
    console.log(`Nộp file: ${okN}/${N} thành công; tổng ${Math.round(total / 1000)} s; số lần thử TB ${(ups.reduce((x, u) => x + u.tries, 0) / N).toFixed(1)}; lỗi: ${[...new Set(ups.filter(u => !u.ok).map(u => u.error))].join(' | ') || 'không'}`);
    must(okN === N, `chỉ ${okN}/${N} file nộp được (không được mất file)`);
    console.log(total <= UPLOAD_WINDOW_S * 1000 ? `✔ Xong trong ${UPLOAD_WINDOW_S} s` : `⚠ Mất ${Math.round(total / 1000)} s (> ${UPLOAD_WINDOW_S} s mục tiêu) — ghi số này vào kế hoạch, hướng dẫn giáo viên cho nộp theo từng nhóm`);
  }
  // Kiểm kết quả ghi nhận
  const res = await admin(`results/${EXAM}`) || {};
  const withFile = Object.values(res).filter(r => r?.practice_file?.url).length;
  if (MB > 0) must(withFile === N, `results.practice_file.url chỉ có ở ${withFile}/${N} học sinh`);
}
main().catch(e => { fails.push('LỖI KỊCH BẢN: ' + e.message); }).finally(async () => {
  try {
    await pool(students, 10, async s => { await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ targetProjectId: PROJ, localId: s.uid }) }); await admin(`students/${s.uid}`, 'DELETE'); });
    for (const p of ['exam_meta', 'exam_questions', 'exam_secrets', 'sessions', 'drafts', 'attempts', 'results', 'clock']) { if (p === 'clock') await pool(students, 10, s => admin(`clock/${s.uid}`, 'DELETE')); else await admin(`${p}/${EXAM}`, 'DELETE'); }
    console.log('Đã dọn tài khoản và dữ liệu RTDB. File Drive thử: thư mục lớp "9LOAD" — xóa tay.');
  } catch (e) { console.log('Lỗi dọn dẹp:', e.message); }
  if (fails.length) { console.log('\n=== CỔNG 4 CHƯA ĐẠT ===\n- ' + fails.join('\n- ')); process.exit(1); }
  console.log('\n=== CỔNG 4 ĐẠT ==='); 
});
