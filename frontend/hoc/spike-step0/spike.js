// Bước 0: đo đăng nhập Firebase Authentication (REST), quy tắc ghi/giờ, Apps Script (CORS), độ trễ. Không dùng cho sản phẩm.
const $ = id => document.getElementById(id);
const out = $('out');
const log = (...a) => { out.textContent += '\n' + a.join(' '); };
for (const k of ['apiKey', 'dbUrl', 'gasUrl', 'sid', 'pin', 'n']) { try { const v = localStorage.getItem('spike0:' + k); if (v) $(k).value = v; } catch { /* bỏ qua */ } $(k).addEventListener('input', () => { try { localStorage.setItem('spike0:' + k, $(k).value); } catch { /* bỏ qua */ } }); }
const cfg = () => ({ key: $('apiKey').value.trim(), db: $('dbUrl').value.trim().replace(/\/$/, ''), gas: $('gasUrl').value.trim(), sid: $('sid').value.trim().toLowerCase(), pin: $('pin').value, n: Math.max(1, Math.min(100, Number($('n').value) || 1)) });
const timed = async (fn) => { const t = performance.now(); try { const v = await fn(); return { ms: Math.round(performance.now() - t), v }; } catch (e) { return { ms: Math.round(performance.now() - t), err: String(e.message || e) }; } };
const post = async (url, body) => { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; };
const emailOf = id => `${id}@hs.aihoc.test`;
async function signIn(c, id) {
  const base = 'https://identitytoolkit.googleapis.com/v1/accounts:';
  try { return await post(`${base}signInWithPassword?key=${c.key}`, { email: emailOf(id), password: c.pin, returnSecureToken: true }); }
  catch (e) { if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/.test(String(e.message))) return await post(`${base}signUp?key=${c.key}`, { email: emailOf(id), password: c.pin, returnSecureToken: true }); throw e; }
}
const rtdb = async (c, method, path, token, body) => { const r = await fetch(`${c.db}/${path}.json?auth=${token}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.text() }; };
const pct = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;

async function callGas(c, idToken, action) {
  // text/plain là "yêu cầu đơn giản": không bị chặn bởi kiểm tra CORS trước.
  const r = await fetch(c.gas, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, idToken }) });
  return r.json();
}
async function chain() {
  const c = cfg(); out.textContent = `Bắt đầu lúc ${new Date().toLocaleTimeString('vi-VN')} – ${navigator.userAgent}`;
  const rep = { when: Date.now(), sid: c.sid, ua: navigator.userAgent, steps: {} };
  const A = await timed(() => signIn(c, c.sid)); rep.steps.signin = { ms: A.ms, ok: !A.err, err: A.err }; log('Đăng nhập:', A.err ? 'LỖI ' + A.err : 'OK', A.ms + ' ms'); if (A.err) return;
  const { idToken, localId: uid } = A.v;
  const S = await timed(() => rtdb(c, 'PUT', `spike/sessions/${uid}`, idToken, { started_at: { '.sv': 'timestamp' } })); rep.steps.start = { ms: S.ms, status: S.v?.status };
  log('Ghi giờ bắt đầu:', S.v?.status, S.ms + ' ms', (S.v?.status === 200 ? '(đúng: ghi lần đầu)' : '(lần sau bị từ chối là bình thường)'));
  const drafts = []; for (let i = 0; i < 10; i++) { const d = await timed(() => rtdb(c, 'PUT', `spike/drafts/${uid}`, idToken, { n: i, answers: { q1: 'A', q2: 'B', q3: 'C' }, t: Date.now() })); drafts.push(d.ms); }
  rep.steps.drafts = { p50: pct(drafts, .5), p95: pct(drafts, .95) }; log('Lưu nháp x10: p50', rep.steps.drafts.p50, 'ms, p95', rep.steps.drafts.p95, 'ms');
  const n = 'tn' + Math.floor(Math.random() * 1e6); // thử ghi với số lần không hợp lệ → phải bị từ chối
  const bad = await rtdb(c, 'PUT', `spike/attempts/${uid}/${n}`, idToken, { answers: { q1: 'A' } }); log('Nộp với số lần không hợp lệ (phải 401):', bad.status);
  const ok = await timed(() => rtdb(c, 'PUT', `spike/attempts/${uid}/1`, idToken, { answers: { q1: 'A', q2: 'B', q3: 'C' }, submitted: { '.sv': 'timestamp' } })); log('Nộp bài lần 1:', ok.v?.status, ok.ms + ' ms (200 lần đầu, 401 nếu đã nộp trước đó)');
  const again = await rtdb(c, 'PUT', `spike/attempts/${uid}/1`, idToken, { answers: { q1: 'D' } }); log('Nộp đè (phải 401):', again.status);
  const other = await rtdb(c, 'PUT', `spike/attempts/someone_else/1`, idToken, { answers: {} }); log('Ghi vào bài người khác (phải 401):', other.status);
  const secret = await rtdb(c, 'GET', 'spike/secret', idToken); log('Đọc khóa đáp án (phải 401):', secret.status);
  const res = await rtdb(c, 'GET', `spike/results/${uid}`, idToken); log('Đọc kết quả của mình:', res.status, res.body.slice(0, 120));
  rep.steps.rules = { badAttempt: bad.status, overwrite: again.status, otherUser: other.status, secret: secret.status };
  if (c.gas) {
    const g = await timed(() => callGas(c, idToken, 'ping')); rep.steps.gas = { ms: g.ms, ok: !g.err && g.v?.ok, err: g.err, uidMatch: g.v?.uid === uid };
    log('Apps Script ping:', g.err ? 'LỖI/CORS ' + g.err : JSON.stringify(g.v), g.ms + ' ms');
    const g2 = await timed(() => callGas(c, idToken, 'grade')); log('Apps Script chấm thử:', g2.err ? 'LỖI ' + g2.err : JSON.stringify(g2.v), g2.ms + ' ms'); rep.steps.grade = { ms: g2.ms, ok: !g2.err && g2.v?.ok };
  }
  await rtdb(c, 'PUT', `spike/reports/${uid}/${Date.now()}`, idToken, rep); log('\nĐã gửi báo cáo lên spike/reports/' + uid + ' (Antigravity xem trong Firebase Console).');
}
async function many() {
  const c = cfg(); out.textContent = `Đăng nhập song song ${c.n} tài khoản từ cùng một mạng…`;
  const t0 = performance.now(); const ids = Array.from({ length: c.n }, (_, i) => c.sid.replace(/\d+$/, '') + String(i + 1).padStart(3, '0'));
  const res = await Promise.all(ids.map(id => timed(() => signIn(c, id))));
  const ok = res.filter(r => !r.err), bad = res.filter(r => r.err); const lat = ok.map(r => r.ms);
  log(`Xong sau ${Math.round(performance.now() - t0)} ms. Thành công ${ok.length}/${c.n}. Thời gian mỗi lượt: p50 ${pct(lat, .5)} ms, p95 ${pct(lat, .95)} ms, lớn nhất ${Math.max(0, ...lat)} ms.`);
  const kinds = {}; for (const r of bad) kinds[r.err] = (kinds[r.err] || 0) + 1; log('Lỗi:', Object.keys(kinds).length ? JSON.stringify(kinds) : 'không');
  log('Lần đầu chạy sẽ tạo tài khoản (signUp); chạy lại lần 2 để đo đăng nhập thuần (signInWithPassword).');
}
async function gasOnly() { const c = cfg(); out.textContent = 'Thử Apps Script…'; const A = await timed(() => signIn(c, c.sid)); if (A.err) { log('Đăng nhập lỗi', A.err); return; } const g = await timed(() => callGas(c, A.v.idToken, 'ping')); log(g.err ? 'LỖI/CORS ' + g.err : JSON.stringify(g.v), g.ms + ' ms'); }
$('one').addEventListener('click', () => { chain().catch(e => log('LỖI:', e.message)); });
$('many').addEventListener('click', () => { many().catch(e => log('LỖI:', e.message)); });
$('gas').addEventListener('click', () => { gasOnly().catch(e => log('LỖI:', e.message)); });
