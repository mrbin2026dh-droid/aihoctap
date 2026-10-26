// @ts-check
// Đường thi qua Firebase (Cổng 2). Cùng hình dạng dữ liệu với đường Worker để exam.js chỉ việc chọn backend theo đề.
// Dữ liệu RTDB (luật: spike/step0/database.rules.v2.json):
//   exam_meta/{e}      {title, grade, minutes, opens_at, closes_at, max_attempts, kind, question_count, total_points, backend:'firebase'}
//   exam_questions/{e} {qid:{order, kind:'choice'|'text', prompt, options?, points, topic?, hint?}} — chỉ đọc được trong giờ thi
//   sessions/{e}/{uid} {started_at(server), extra_ms}    drafts/{e}/{uid} {updated_at, answers, leaves}
//   attempts/{e}/{uid}/{n} {submitted_at, answers}      results/{e}/{uid} (Apps Script ghi)
import { ApiError } from './api.js';
import * as fb from './fb.js';

const GRACE_MS = 30000;
const UPLOAD_AFTER_CLOSE_MS = 10 * 60 * 1000; // khớp apps-script/exam/Code.gs
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXT = ['xlsx', 'pptx', 'docx', 'pdf'];
/** @param {any} m */ const hasPractice = m => Array.isArray(m?.parts) && m.parts.some(/** @param {any} p */ p => p && p.key === 'practice');

/** @param {any} v */ const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Danh sách đề Firebase của khối học sinh. @returns {Promise<any[]>} */
export async function list() {
  await fb.ready();
  if (!fb.hasSession()) return [];
  const uid = fb.uid();
  const [metas, me] = await Promise.all([fb.rtdb('exam_meta'), fb.rtdb(`students/${uid}`)]);
  if (!metas || !me) return [];
  const t = await fb.serverNow().catch(() => fb.now());
  const mine = Object.entries(/** @type {Record<string,any>} */ (metas)).filter(([, m]) => m && m.backend === 'firebase' && Number(m.grade) === Number(/** @type {any} */ (me).grade));
  return Promise.all(mine.map(async ([id, m]) => {
    const max = Math.max(1, Math.min(2, Number(m.max_attempts) || 1));
    const reads = [fb.rtdb(`sessions/${id}/${uid}`), fb.rtdb(`results/${id}/${uid}`), fb.rtdb(`attempts/${id}/${uid}/1`)];
    if (max >= 2) reads.push(fb.rtdb(`attempts/${id}/${uid}/2`));
    const [sess, result, a1, a2] = /** @type {any[]} */ (await Promise.all(reads));
    const used = (a1 ? 1 : 0) + (a2 ? 1 : 0);
    const opens = num(m.opens_at), closes = num(m.closes_at);
    const state = opens !== null && t < opens ? 'upcoming' : closes !== null && t > closes ? 'closed' : 'open';
    const deadline = sess ? Number(sess.started_at) + Number(m.minutes) * 60000 + Number(sess.extra_ms || 0) : null;
    const inProgress = Boolean(sess) && used === 0 && deadline !== null && t < deadline;
    const best = result ? num(result.total_score) ?? num(result.theory_score) : null;
    return {
      exam_id: id, title: String(m.title || 'Bài kiểm tra'), mode: 'real', kind: String(m.kind || 'period'), minutes: num(m.minutes),
      opens_at: opens, closes_at: closes, state, question_count: Number(m.question_count) || 0, total_points: Number(m.total_points) || 10,
      attempts_used: used, attempts_left: Math.max(0, max - used), best_score: best, in_progress: inProgress, backend: 'firebase',
      has_practice: hasPractice(m), practice_file: result && result.practice_file ? String(result.practice_file.name || 'đã nộp') : null,
      upload_open: hasPractice(m) && Boolean(sess) && closes !== null && t <= closes + UPLOAD_AFTER_CLOSE_MS
    };
  }));
}

/** Vào thi: tạo phiên (giờ máy chủ) nếu chưa có, tải đề và nháp. @param {{exam_id:string}} e */
export async function start(e) {
  const uid = fb.uid(); const id = e.exam_id;
  const t = await fb.serverNow();
  const m = /** @type {any} */ (await fb.rtdb(`exam_meta/${id}`));
  if (!m) throw new ApiError(404, 'Không tìm thấy bài kiểm tra.');
  if (t < Number(m.opens_at)) throw new ApiError(403, 'Chưa đến giờ mở bài.');
  const max = Math.max(1, Math.min(2, Number(m.max_attempts) || 1));
  const [a1, a2] = /** @type {any[]} */ (await Promise.all([fb.rtdb(`attempts/${id}/${uid}/1`), max >= 2 ? fb.rtdb(`attempts/${id}/${uid}/2`) : Promise.resolve(null)]));
  const used = (a1 ? 1 : 0) + (a2 ? 1 : 0);
  if (used >= max) throw new ApiError(403, 'Em đã dùng hết lượt làm bài này.');
  let sess = /** @type {any} */ (await fb.rtdb(`sessions/${id}/${uid}`));
  if (!sess) {
    if (t > Number(m.closes_at)) throw new ApiError(403, 'Bài kiểm tra đã đóng.');
    try { await fb.rtdb(`sessions/${id}/${uid}`, { method: 'PUT', body: { started_at: { '.sv': 'timestamp' }, extra_ms: 0 } }); }
    catch (err) { if (!(err instanceof ApiError && err.status === 403)) throw err; } // bấm hai lần: phiên đã có thì đọc lại
    sess = await fb.rtdb(`sessions/${id}/${uid}`);
    if (!sess) throw new ApiError(403, 'Chưa vào được bài (ngoài giờ thi hoặc không đúng khối lớp).');
  }
  const deadline = Number(sess.started_at) + Number(m.minutes) * 60000 + Number(sess.extra_ms || 0);
  if (fb.now() > deadline + GRACE_MS) throw new ApiError(403, 'Đã hết giờ làm bài. Bài nháp đã lưu sẽ được hệ thống tự nộp khi đóng đề.');
  const [qs, draft] = /** @type {any[]} */ (await Promise.all([fb.rtdb(`exam_questions/${id}`), fb.rtdb(`drafts/${id}/${uid}`)]));
  const questions = Object.entries(qs || {}).map(([qid, q]) => ({ id: qid, kind: q.kind === 'text' ? 'text' : 'choice', prompt: String(q.prompt || ''), options: q.options || undefined, hint: q.hint || undefined, topic: q.topic || undefined, points: Number(q.points) || 1, order: Number(q.order) || 0 }))
    .sort((x, y) => x.order - y.order || x.id.localeCompare(y.id));
  const n = used + 1;
  return {
    exam_id: id, title: String(m.title || 'Bài kiểm tra'), mode: 'real', minutes: Number(m.minutes), total_points: Number(m.total_points) || questions.reduce((s, q) => s + q.points, 0),
    questions, attempt_id: String(n), attempt_no: n, deadline, answers: (draft && draft.answers) || {}, server_now: fb.now(), backend: 'firebase', has_practice: hasPractice(m)
  };
}

/** @param {Record<string,string>} answers */
function clean(answers) {
  /** @type {Record<string,string>} */ const out = {};
  for (const [k, v] of Object.entries(answers)) if (/^[A-Za-z0-9_-]{1,64}$/.test(k) && typeof v === 'string' && v.trim()) out[k] = v.slice(0, 2000);
  return out;
}

/** Lưu nháp (Apps Script dùng nháp cuối để tự nộp nếu học sinh không nộp kịp). @param {{exam_id:string}} data @param {Record<string,string>} answers @param {number} leaves */
export async function save(data, answers, leaves) {
  await fb.rtdb(`drafts/${data.exam_id}/${fb.uid()}`, { method: 'PUT', body: { updated_at: { '.sv': 'timestamp' }, answers: clean(answers), leaves: Math.max(0, Math.min(10000, leaves | 0)) } });
}

/** Nộp bài rồi xin điểm tổng từ Apps Script (trước giờ đóng đề không trả đúng/sai từng câu). @param {{exam_id:string,attempt_id:string,total_points:number}} data @param {Record<string,string>} answers */
export async function submit(data, answers) {
  const path = `attempts/${data.exam_id}/${fb.uid()}/${data.attempt_id}`;
  try { await fb.rtdb(path, { method: 'PUT', body: { submitted_at: { '.sv': 'timestamp' }, answers: clean(answers) } }); }
  catch (err) {
    // Lần trước đã ghi được nhưng mất phản hồi → bài đã nộp, coi như thành công (không nộp đè được).
    if (!(err instanceof ApiError && err.status === 403)) throw err;
    const existing = await fb.rtdb(path).catch(() => null);
    if (!existing) throw new ApiError(403, 'Đã quá giờ nộp. Bài nháp đã lưu sẽ được hệ thống tự nộp khi đóng đề.');
  }
  const pending = { pending: true, total_points: data.total_points, message: 'Đã nhận bài. Điểm sẽ có sau khi hệ thống chấm.' };
  if (!FB_URL()) return pending;
  try {
    const res = await fetch(FB_URL(), { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'grade_my_attempt', idToken: await fb.token(), exam_id: data.exam_id, attempt: data.attempt_id }) });
    const ack = await res.json(); // Apps Script quá tải có thể trả trang HTML → lỗi JSON → coi là chưa chấm
    return ack && ack.ok ? ack : pending;
  } catch { return pending; }
}
const FB_URL = () => fb.FB_CONFIG.appsScriptUrl;

/**
 * Nộp file thực hành lên Apps Script → Drive (thư mục học sinh). Thử lại có giãn cách khi Apps Script bận (giới hạn 30 lượt chạy đồng thời).
 * Chỉ coi là thành công khi nhận JSON {ok:true, file_id}. @param {string} examId @param {File} file @param {(msg:string)=>void} [onStatus]
 */
export async function uploadPractice(examId, file, onStatus = () => {}) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw new ApiError(400, 'Chỉ nộp file .xlsx, .pptx, .docx hoặc .pdf.');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(400, 'File lớn hơn 10 MB. Hãy xóa bớt ảnh hoặc lưu gọn lại.');
  if (!file.size) throw new ApiError(400, 'File rỗng.');
  if (!FB_URL()) throw new ApiError(503, 'Hệ thống nhận file chưa được bật. Hãy báo thầy cô.');
  const b64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = () => reject(new ApiError(400, 'Không đọc được file.')); r.readAsDataURL(file); });
  for (let attempt = 0; ; attempt++) {
    onStatus(attempt ? `Hệ thống đang bận, thử lại lần ${attempt + 1}…` : 'Đang nộp file…');
    try {
      const res = await fetch(FB_URL(), { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'upload_practice', idToken: await fb.token(), exam_id: examId, name: file.name, mime: file.type, b64 }) });
      const ack = await res.json().catch(() => null);
      if (ack && ack.ok && ack.file_id) return ack;
      if (ack && ack.ok === false && ack.error) throw new ApiError(400, ack.error); // lỗi nghiệp vụ (quá giờ, sai loại file…): không thử lại
    } catch (err) { if (err instanceof ApiError && err.status === 400) throw err; }
    if (attempt >= 5) throw new ApiError(0, 'Chưa nộp được file sau nhiều lần thử. File vẫn ở máy em — hãy bấm nộp lại hoặc báo thầy cô.');
    await new Promise(r => setTimeout(r, Math.min(32000, 2000 * 2 ** attempt) + Math.random() * 1000));
  }
}
