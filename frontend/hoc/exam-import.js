// @ts-check
// Đọc và kiểm tra dữ liệu câu hỏi từ file Excel mẫu. Hàm thuần, không phụ thuộc thư viện Excel, có test riêng.

/** Tên cột đúng thứ tự của file mẫu. */
export const EXAM_COLUMNS = ['STT', 'Loại (TN/TL)', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án đúng', 'Điểm', 'Chủ đề', 'Gợi ý'];
export const MAX_QUESTIONS = 200;
export const MAX_POINTS = 100;
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

/** @typedef {{row:number, kind:'choice'|'text', prompt:string, options:Record<string,string>, correct_answer:string, points:number, topic:string, hint:string}} ImportedQuestion */
/** @typedef {{row:number, ok:boolean, errors:string[]}} RowReport */

/** @param {unknown} value */
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim(); }
/** @param {string} value */
function norm(value) { return value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim(); }

/** Dữ liệu file mẫu: dòng tiêu đề, 2 dòng ví dụ (1 trắc nghiệm, 1 tự luận) và hướng dẫn. */
export function templateRows() {
  return {
    questions: [
      EXAM_COLUMNS.slice(),
      [1, 'TN', 'Bộ phận nào được ví như "bộ não" của máy tính?', 'Bộ xử lí trung tâm (CPU)', 'Màn hình', 'Chuột', 'Loa', 'A', 1, 'Phần cứng máy tính', 'Nhớ lại bộ phận xử lí thông tin.'],
      [2, 'TL', 'Nêu hai ví dụ về thiết bị số có bộ xử lí thông tin.', '', '', '', '', '', 2, 'Thiết bị số', '']
    ],
    guide: [
      ['Hướng dẫn điền file'],
      ['1. Mỗi dòng là một câu hỏi. Không đổi tên, không xóa, không đổi thứ tự các cột ở dòng đầu.'],
      ['2. Cột "Loại (TN/TL)": TN là trắc nghiệm, TL là tự luận.'],
      ['3. Trắc nghiệm: điền ít nhất đáp án A và B (tối đa A–D, điền liền nhau, không bỏ trống ở giữa). Cột "Đáp án đúng" chỉ ghi một chữ cái (A, B, C hoặc D).'],
      ['4. Tự luận: để trống các cột A–D và "Đáp án đúng".'],
      ['5. Cột "Điểm": số điểm của câu đó, lớn hơn 0 và tối đa ' + MAX_POINTS + ' (ví dụ 0,5 hoặc 1). Bắt buộc điền cho mọi câu.'],
      ['6. "Chủ đề" và "Gợi ý" không bắt buộc. Gợi ý không được ghi đáp án.'],
      ['7. Hai dòng ví dụ ở sheet "Câu hỏi" có thể xóa hoặc sửa trước khi tải lên.']
    ]
  };
}

/** @param {unknown} value @returns {number|null} */
function parsePoints(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = text(value).replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  return Number(raw);
}

/**
 * @param {unknown[][]} rows toàn bộ sheet (dòng 1 là tiêu đề)
 * @returns {{questions:ImportedQuestion[], reports:RowReport[], fatal:string, total_points:number, valid:boolean}}
 */
export function parseExamRows(rows) {
  /** @type {ImportedQuestion[]} */ const questions = [];
  /** @type {RowReport[]} */ const reports = [];
  const empty = (/** @type {string} */ fatal) => ({questions, reports, fatal, total_points: 0, valid: false});
  if (!Array.isArray(rows) || !rows.length) return empty('File trống. Hãy tải mẫu Excel và điền câu hỏi.');
  const header = (rows[0] || []).map(text);
  for (let i = 0; i < EXAM_COLUMNS.length; i++) {
    if (norm(header[i] || '') !== norm(EXAM_COLUMNS[i])) return empty(`File không đúng mẫu: cột ${i + 1} phải là "${EXAM_COLUMNS[i]}". Hãy tải mẫu Excel mới và điền vào mẫu.`);
  }
  const seen = new Map();
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r] || [];
    if (!line.some(cell => text(cell))) continue;
    const row = r + 1;
    /** @type {string[]} */ const errors = [];
    const kindRaw = norm(text(line[1]));
    const kind = ['tn', 'trắc nghiệm'].includes(kindRaw) ? 'choice' : ['tl', 'tự luận'].includes(kindRaw) ? 'text' : null;
    if (!kind) errors.push('Cột "Loại" chỉ nhận TN hoặc TL');
    const prompt = text(line[2]);
    if (!prompt) errors.push('Thiếu nội dung câu hỏi');
    else if (prompt.length > 2000) errors.push('Câu hỏi dài quá 2000 ký tự');
    /** @type {Record<string,string>} */ const options = {};
    let gap = false; let gapReported = false;
    OPTION_KEYS.forEach((key, index) => {
      const value = text(line[3 + index]);
      if (value) {
        if (kind === 'choice') {
          if (gap && !gapReported) { errors.push('Các đáp án phải điền liền nhau từ A, không bỏ trống ở giữa'); gapReported = true; }
          if (value.length > 2000) errors.push(`Đáp án ${key} dài quá 2000 ký tự`);
          options[key] = value;
        } else if (kind === 'text') errors.push(`Câu tự luận không điền đáp án ${key}`);
      } else if (kind === 'choice') gap = true;
    });
    const correct = text(line[7]).toUpperCase();
    if (kind === 'choice') {
      const keys = Object.keys(options);
      if (keys.length < 2) errors.push('Trắc nghiệm cần ít nhất đáp án A và B');
      if (!correct) errors.push('Thiếu đáp án đúng');
      else if (!/^[A-D]$/.test(correct)) errors.push('Đáp án đúng chỉ ghi một chữ cái A, B, C hoặc D');
      else if (!options[correct]) errors.push(`Đáp án đúng ${correct} đang để trống`);
      const unique = new Set(keys.map(key => norm(options[key])));
      if (unique.size < keys.length) errors.push('Có hai đáp án giống nhau');
    } else if (kind === 'text' && correct) errors.push('Câu tự luận không điền "Đáp án đúng"');
    const points = parsePoints(line[8]);
    if (!text(line[8])) errors.push('Thiếu điểm của câu');
    else if (points === null) errors.push('Điểm phải là số (ví dụ 0,5 hoặc 1)');
    else if (points <= 0) errors.push('Điểm phải lớn hơn 0');
    else if (points > MAX_POINTS) errors.push(`Điểm tối đa ${MAX_POINTS}`);
    else if (Math.round(points * 100) / 100 !== points) errors.push('Điểm tối đa 2 chữ số thập phân');
    const topic = text(line[9]); const hint = text(line[10]);
    if (topic.length > 60) errors.push('Chủ đề dài quá 60 ký tự');
    if (hint.length > 1000) errors.push('Gợi ý dài quá 1000 ký tự');
    if (prompt) {
      const key = norm(prompt);
      if (seen.has(key)) errors.push(`Trùng với câu ở dòng ${seen.get(key)}`); else seen.set(key, row);
    }
    reports.push({row, ok: !errors.length, errors});
    if (!errors.length && kind && points !== null) questions.push({row, kind, prompt, options, correct_answer: kind === 'choice' ? correct : '', points, topic, hint});
  }
  if (!reports.length) return empty('File chưa có câu hỏi nào. Hãy điền từ dòng 2 trở đi.');
  let fatal = '';
  if (reports.length > MAX_QUESTIONS) fatal = `File có ${reports.length} câu, tối đa ${MAX_QUESTIONS} câu mỗi đề.`;
  const total = Math.round(questions.reduce((sum, q) => sum + q.points, 0) * 100) / 100;
  return {questions, reports, fatal, total_points: total, valid: !fatal && reports.every(item => item.ok)};
}
