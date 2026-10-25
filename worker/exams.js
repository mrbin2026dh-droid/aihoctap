// Logic thuần của bài kiểm tra (Thử / Thật): kiểm tra đầu vào, trạng thái, trộn câu, chấm điểm. Không gọi mạng nên dễ kiểm thử.

export const EXAM_MODES = ['trial', 'real'];
export const EXAM_KINDS = ['15m', 'period', 'midterm', 'final'];
export const REVEAL_MODES = ['after-submit', 'after-close', 'never'];
export const EXAM_STATUSES = ['draft', 'open', 'closed'];
/** Ân hạn sau giờ hết hạn của phiên (tính theo đồng hồ máy chủ) để bài tự nộp lúc hết giờ vẫn được nhận. */
export const GRACE_MS = 30_000;
export const MAX_EXAM_QUESTIONS = 200;
const ID_RE = /^exam_[a-z0-9_-]{1,56}$/;
const QID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function newExamId() {
  const bytes = new Uint8Array(6); crypto.getRandomValues(bytes);
  return 'exam_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function isExamId(id) { return typeof id === 'string' && ID_RE.test(id); }

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v) => (Number.isInteger(Number(v)) && String(v).trim() !== '' ? Number(v) : NaN);

/**
 * Kiểm tra và tách đề thành phần công khai (không đáp án) và phần riêng (đáp án, điểm).
 * @returns {{error:string}|{exam:object, secret:{answers:Record<string,string>, points:Record<string,number>, kinds:Record<string,string>}}}
 */
export function validateExamInput(body, existingId = null) {
  if (!body || typeof body !== 'object') return {error: 'Thiếu dữ liệu đề.'};
  const title = str(body.title, 200);
  if (!title) return {error: 'Thiếu tiêu đề đề kiểm tra.'};
  const grade = int(body.grade);
  if (![6, 7, 8, 9].includes(grade)) return {error: 'Lớp phải từ 6 đến 9.'};
  const mode = body.mode;
  if (!EXAM_MODES.includes(mode)) return {error: 'Hình thức phải là Thử hoặc Thật.'};
  const kind = EXAM_KINDS.includes(body.kind) ? body.kind : '15m';
  const reveal = REVEAL_MODES.includes(body.reveal) ? body.reveal : 'after-submit';
  const status = EXAM_STATUSES.includes(body.status) ? body.status : 'draft';
  const classCodes = Array.isArray(body.class_codes) ? [...new Set(body.class_codes.map(c => str(c, 16)).filter(Boolean))].slice(0, 30) : [];
  let minutes = null, opensAt = null, closesAt = null, maxAttempts = null;
  if (mode === 'real') {
    minutes = int(body.minutes);
    if (!(minutes >= 1 && minutes <= 300)) return {error: 'Thời gian làm bài phải từ 1 đến 300 phút.'};
    opensAt = Number(body.opens_at); closesAt = Number(body.closes_at);
    if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt)) return {error: 'Bài thi thật cần giờ mở và giờ đóng.'};
    if (closesAt <= opensAt) return {error: 'Giờ đóng phải sau giờ mở.'};
    if (closesAt - opensAt < minutes * 60_000) return {error: 'Khoảng từ giờ mở đến giờ đóng ngắn hơn thời gian làm bài.'};
    maxAttempts = int(body.max_attempts ?? 1);
    if (!(maxAttempts >= 1 && maxAttempts <= 20)) return {error: 'Số lần làm phải từ 1 đến 20.'};
  }
  const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
  if (!rawQuestions.length) return {error: 'Đề chưa có câu hỏi nào.'};
  if (rawQuestions.length > MAX_EXAM_QUESTIONS) return {error: `Đề tối đa ${MAX_EXAM_QUESTIONS} câu.`};
  const questions = []; const answers = {}; const points = {}; const kinds = {}; const seen = new Set();
  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i] || {}; const n = i + 1;
    const id = QID_RE.test(String(q.id || '')) ? String(q.id) : `q${n}`;
    if (seen.has(id)) return {error: `Câu ${n}: mã câu bị trùng.`};
    seen.add(id);
    const qKind = q.kind === 'text' ? 'text' : q.kind === 'choice' ? 'choice' : null;
    if (!qKind) return {error: `Câu ${n}: loại câu phải là trắc nghiệm hoặc tự luận.`};
    const prompt = str(q.prompt, 2000);
    if (!prompt) return {error: `Câu ${n}: thiếu nội dung câu hỏi.`};
    const pts = Number(q.points);
    if (!(pts > 0 && pts <= 100) || Math.round(pts * 100) / 100 !== pts) return {error: `Câu ${n}: điểm phải lớn hơn 0, tối đa 100, nhiều nhất 2 chữ số thập phân.`};
    const options = {};
    if (qKind === 'choice') {
      const entries = Object.entries(q.options && typeof q.options === 'object' ? q.options : {}).filter(([k, v]) => OPTION_KEYS.includes(k) && str(v, 2000));
      if (entries.length < 2) return {error: `Câu ${n}: trắc nghiệm cần ít nhất 2 đáp án.`};
      for (const [k, v] of entries) options[k] = str(v, 2000);
      const correct = String(q.correct_answer || '').toUpperCase();
      if (!options[correct]) return {error: `Câu ${n}: đáp án đúng phải là một trong các lựa chọn.`};
      answers[id] = correct;
    }
    points[id] = pts; kinds[id] = qKind;
    questions.push({id, kind: qKind, prompt, options, hint: str(q.hint, 1000), topic: str(q.topic, 60), points: pts});
  }
  const totalPoints = Math.round(questions.reduce((s, q) => s + q.points, 0) * 100) / 100;
  const exam = {
    exam_id: existingId || (isExamId(body.exam_id) ? body.exam_id : newExamId()),
    title, grade, class_codes: classCodes, subject_id: QID_RE.test(String(body.subject_id || '')) ? String(body.subject_id) : 'tin-hoc',
    mode, kind, minutes, opens_at: opensAt, closes_at: closesAt, max_attempts: maxAttempts, shuffle: Boolean(body.shuffle), reveal, status,
    total_points: totalPoints, question_count: questions.length, questions
  };
  return {exam, secret: {answers, points, kinds}};
}

/** Trạng thái hiển thị cho học sinh: draft | upcoming | open | closed. */
export function examState(exam, now) {
  if (exam.status === 'draft') return 'draft';
  if (exam.status === 'closed') return 'closed';
  if (exam.mode === 'trial') return 'open';
  if (now < exam.opens_at) return 'upcoming';
  if (now > exam.closes_at) return 'closed';
  return 'open';
}

/** Học sinh có thuộc đối tượng của đề không (lớp khối và, nếu có, lớp học). */
export function examTargetsStudent(exam, grade, classCode) {
  if (Number(exam.grade) !== Number(grade)) return false;
  return !exam.class_codes?.length || exam.class_codes.includes(String(classCode || ''));
}

/** Bản đề gửi cho học sinh: không đáp án, không phần riêng. */
export function studentExamView(exam, order = null) {
  const byId = new Map(exam.questions.map(q => [q.id, q]));
  const ids = order && order.length === exam.questions.length && order.every(id => byId.has(id)) ? order : exam.questions.map(q => q.id);
  return {
    exam_id: exam.exam_id, title: exam.title, mode: exam.mode, minutes: exam.minutes, total_points: exam.total_points,
    questions: ids.map(id => { const q = byId.get(id); return {id: q.id, kind: q.kind, prompt: q.prompt, options: q.options, hint: q.hint, topic: q.topic, points: q.points}; })
  };
}

function hash(seedText) { let h = 1779033703 ^ seedText.length; for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Thứ tự câu: cố định theo đề, hoặc trộn riêng cho mỗi học sinh và mỗi lượt (ổn định theo seed). */
export function questionOrder(exam, seedText) {
  const ids = exam.questions.map(q => q.id);
  if (!exam.shuffle) return ids;
  const rand = rng(hash(seedText)); const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Hạn của phiên thi thật: không quá giờ đóng. */
export function sessionDeadline(exam, startedAt) {
  return Math.min(startedAt + exam.minutes * 60_000, exam.closes_at);
}

/** Lọc đáp án gửi lên: chỉ câu có trong đề, trắc nghiệm chỉ nhận chữ cái đang có, tự luận nhận văn bản <= 4000 ký tự. */
export function cleanAnswers(exam, answers) {
  const out = {};
  if (!answers || typeof answers !== 'object') return out;
  for (const q of exam.questions) {
    const v = answers[q.id];
    if (v === undefined || v === null) continue;
    if (q.kind === 'choice') { const k = String(v).toUpperCase(); if (q.options[k]) out[q.id] = k; }
    else { const t = String(v).slice(0, 4000); if (t.trim()) out[q.id] = t; }
  }
  return out;
}

/**
 * Chấm bài. Điểm từng câu theo `points`; điểm cuối quy về thang 10.
 * Câu tự luận chưa chấm (0 điểm tạm), đánh dấu needs_review.
 */
export function gradeExam(exam, secret, answers) {
  const perQuestion = {}; let earned = 0; let correct = 0; let choiceTotal = 0; let hasText = false;
  for (const q of exam.questions) {
    const a = answers[q.id];
    if (q.kind === 'choice') {
      choiceTotal += 1;
      const ok = Boolean(a && a === secret.answers[q.id]);
      if (ok) { correct += 1; earned += secret.points[q.id]; }
      perQuestion[q.id] = {ok, a: a ? String(a).slice(0, 8) : ''};
    } else if (a) hasText = true;
  }
  const total = exam.total_points;
  earned = Math.round(earned * 100) / 100;
  const score = total > 0 ? Math.round((earned / total) * 1000) / 100 : 0;
  return {perQuestion, earned, total_points: total, correct, total: choiceTotal, score, needs_review: exam.questions.some(q => q.kind === 'text'), has_text_answers: hasText};
}

/** Có được xem đáp án đúng không theo cấu hình `reveal`. */
export function canRevealAnswers(exam, now, hasSubmitted) {
  if (!hasSubmitted) return false;
  if (exam.reveal === 'after-submit') return true;
  if (exam.reveal === 'after-close') return exam.mode === 'real' ? now > exam.closes_at : exam.status === 'closed';
  return false;
}
