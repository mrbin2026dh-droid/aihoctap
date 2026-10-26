// MÔ PHỎNG luật bằng JS tự viết — KHÔNG thay Firebase Emulator. Kiểm thật: spike/step0/emulator (npm test).
// Chạy: node tests/test_firebase_rules_step0.cjs

const assert = require('assert');

// Trình giả lập ngữ cảnh thực thi Rules của Firebase RTDB
class Snapshot {
  constructor(val) {
    this._val = val;
  }
  val() {
    return this._val;
  }
  exists() {
    return this._val !== null && this._val !== undefined;
  }
  child(path) {
    const parts = path.split('/');
    let cur = this._val;
    for (const p of parts) {
      if (cur === null || cur === undefined || typeof cur !== 'object') {
        return new Snapshot(null);
      }
      cur = cur[p];
    }
    return new Snapshot(cur !== undefined ? cur : null);
  }
  parent() {
    return new Snapshot(this._parentVal || null);
  }
  isString() {
    return typeof this._val === 'string';
  }
  isNumber() {
    return typeof this._val === 'number' && !isNaN(this._val);
  }
}

// Cây dữ liệu mô phỏng gốc (root)
function createRootState(overrides = {}) {
  const defaultState = {
    teachers: {
      'teacher_admin_01': true
    },
    students: {
      'hs_01': { grade: 9, name: 'Nguyễn Văn An', class_code: '9A' },
      'hs_02': { grade: 8, name: 'Trần Thị Bình', class_code: '8B' }
    },
    exam_meta: {
      'exam_tin9_mid': {
        title: 'Kiểm tra Giữa kỳ Tin 9',
        grade: 9,
        minutes: 45,
        opens_at: 1000000,
        closes_at: 1000000 + 45 * 60000, // 3,700,000
        max_attempts: 1
      },
      'exam_tin9_practice': {
        title: 'Luyện tập Tin 9',
        grade: 9,
        minutes: 45,
        opens_at: 1000000,
        closes_at: 5000000,
        max_attempts: 2
      }
    },
    exam_questions: {
      'exam_tin9_mid': {
        q1: { prompt: 'Bộ não của máy tính là gì?', options: { A: 'CPU', B: 'RAM' } }
      }
    },
    exam_secrets: {
      'exam_tin9_mid': { q1: 'A' }
    },
    sessions: {},
    drafts: {},
    attempts: {},
    results: {
      'exam_tin9_mid': {
        'hs_01': { total_score: 8.5 }
      }
    }
  };

  const merge = (target, src) => {
    for (const k of Object.keys(src)) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) {
        if (!target[k]) target[k] = {};
        merge(target[k], src[k]);
      } else {
        target[k] = src[k];
      }
    }
    return target;
  };

  return merge(JSON.parse(JSON.stringify(defaultState)), overrides);
}

// Hàm đánh giá quy tắc đọc exam_questions
function evaluateExamQuestionsRead(rootVal, auth, examId, now) {
  const root = new Snapshot(rootVal);
  if (!auth) return false;
  const isTeacher = root.child('teachers/' + auth.uid).exists();
  if (isTeacher) return true;

  const opensAt = root.child('exam_meta/' + examId + '/opens_at').val();
  const closesAt = root.child('exam_meta/' + examId + '/closes_at').val();
  const examGrade = root.child('exam_meta/' + examId + '/grade').val();
  const studentGrade = root.child('students/' + auth.uid + '/grade').val();

  return (now >= opensAt && now <= closesAt && studentGrade === examGrade);
}

// Hàm đánh giá quy tắc tạo session
function evaluateSessionWrite(rootVal, currentData, newDataVal, auth, examId, uid, now) {
  const root = new Snapshot(rootVal);
  const data = new Snapshot(currentData);
  const newData = new Snapshot(newDataVal);

  if (!auth || auth.uid !== uid) return false;
  if (data.exists()) return false;

  const opensAt = root.child('exam_meta/' + examId + '/opens_at').val();
  const closesAt = root.child('exam_meta/' + examId + '/closes_at').val();
  const examGrade = root.child('exam_meta/' + examId + '/grade').val();
  const studentGrade = root.child('students/' + auth.uid + '/grade').val();

  const timeAndGradeOk = (now >= opensAt && now <= closesAt && studentGrade === examGrade);
  if (!timeAndGradeOk) return false;

  // Validate session schema
  const startedAtOk = newData.child('started_at').val() === now;
  const extraMs = newData.child('extra_ms');
  const extraMsOk = extraMs.isNumber() && extraMs.val() >= 0 && extraMs.val() <= 1800000;

  return startedAtOk && extraMsOk;
}

// Hàm đánh giá quy tắc ghi attempts
function evaluateAttemptWrite(rootVal, currentData, parentData, newDataVal, auth, examId, uid, attemptNum, now) {
  const root = new Snapshot(rootVal);
  const data = new Snapshot(currentData);
  const parent = new Snapshot(parentData);
  const newData = new Snapshot(newDataVal);

  if (!auth || auth.uid !== uid) return false;
  if (data.exists()) return false;

  const maxAttempts = root.child('exam_meta/' + examId + '/max_attempts').val() || 1;
  const attemptNumOk = (attemptNum === '1') || (attemptNum === '2' && maxAttempts >= 2 && parent.child('1').exists());
  if (!attemptNumOk) return false;

  const startedAt = root.child('sessions/' + examId + '/' + uid + '/started_at').val();
  const minutes = root.child('exam_meta/' + examId + '/minutes').val();
  const extraMs = root.child('sessions/' + examId + '/' + uid + '/extra_ms').val() || 0;

  if (startedAt === null || minutes === null) return false;
  const deadline = startedAt + minutes * 60000 + extraMs + 30000;
  if (now > deadline) return false;

  // Validate attempt schema
  const submittedAtOk = newData.child('submitted_at').val() === now;
  if (!submittedAtOk) return false;

  // Validate answer strings
  const answers = newDataVal.answers || {};
  for (const q of Object.keys(answers)) {
    const val = answers[q];
    if (typeof val !== 'string' || val.length > 2000) {
      return false;
    }
  }

  return true;
}

console.log('=== CHẠY BỘ ĐO KIỂM THỬ QUY TẮC FIREBASE RTDB V2 ===\n');

// NHÓM 1: Chống lộ đề trước giờ thi (B3)
console.log('1. Kiểm định chống lộ đề trước giờ (exam_questions):');
const root1 = createRootState();
const examId = 'exam_tin9_mid';
const opensAt = root1.exam_meta[examId].opens_at; // 1,000,000
const closesAt = root1.exam_meta[examId].closes_at; // 3,700,000

// 1.1 Học sinh lớp 9 đọc trước giờ mở đề (now = 900,000)
const c1_1 = evaluateExamQuestionsRead(root1, { uid: 'hs_01' }, examId, 900000);
assert.strictEqual(c1_1, false, 'Ca 1.1: Phải từ chối đọc đề trước giờ opens_at');
console.log('  [PASS] Ca 1.1: Đọc đề trước opens_at -> BỊ CHẶN (403)');

// 1.2 Học sinh lớp 9 đọc trong giờ mở đề (now = 1,500,000)
const c1_2 = evaluateExamQuestionsRead(root1, { uid: 'hs_01' }, examId, 1500000);
assert.strictEqual(c1_2, true, 'Ca 1.2: Phải cho phép đọc đề đúng giờ và đúng khối lớp');
console.log('  [PASS] Ca 1.2: Đọc đề đúng khung giờ thi & đúng khối 9 -> HỢP LỆ (200)');

// 1.3 Học sinh lớp 8 đọc đề thi khối 9 trong giờ mở đề
const c1_3 = evaluateExamQuestionsRead(root1, { uid: 'hs_02' }, examId, 1500000);
assert.strictEqual(c1_3, false, 'Ca 1.3: Phải từ chối học sinh khối khác');
console.log('  [PASS] Ca 1.3: Học sinh khối 8 đọc đề khối 9 -> BỊ CHẶN (403)');

// 1.4 Học sinh đọc sau khi đề đã đóng (now = 4,000,000)
const c1_4 = evaluateExamQuestionsRead(root1, { uid: 'hs_01' }, examId, 4000000);
assert.strictEqual(c1_4, false, 'Ca 1.4: Phải từ chối học sinh đọc sau closes_at');
console.log('  [PASS] Ca 1.4: Đọc đề sau closes_at -> BỊ CHẶN (403)');

// 1.5 Giáo viên đọc đề ở bất kỳ thời điểm nào
const c1_5 = evaluateExamQuestionsRead(root1, { uid: 'teacher_admin_01' }, examId, 500000);
assert.strictEqual(c1_5, true, 'Ca 1.5: Giáo viên luôn có quyền đọc đề');
console.log('  [PASS] Ca 1.5: Giáo viên đọc đề trước giờ -> HỢP LỆ (200)');

// NHÓM 2: Khởi tạo phiên làm bài (sessions)
console.log('\n2. Kiểm định khởi tạo phiên thi (sessions):');
const root2 = createRootState();

// 2.1 Học sinh tạo session trước giờ mở đề
const c2_1 = evaluateSessionWrite(root2, null, { started_at: 900000, extra_ms: 0 }, { uid: 'hs_01' }, examId, 'hs_01', 900000);
assert.strictEqual(c2_1, false, 'Ca 2.1: Không được tạo session trước opens_at');
console.log('  [PASS] Ca 2.1: Tạo session trước opens_at -> BỊ CHẶN (403)');

// 2.2 Tạo session hợp lệ đúng giờ thi với extra_ms = 0
const c2_2 = evaluateSessionWrite(root2, null, { started_at: 1050000, extra_ms: 0 }, { uid: 'hs_01' }, examId, 'hs_01', 1050000);
assert.strictEqual(c2_2, true, 'Ca 2.2: Tạo session hợp lệ');
console.log('  [PASS] Ca 2.2: Tạo session hợp lệ đúng giờ (started_at = now, extra_ms = 0) -> HỢP LỆ (200)');

// 2.3 Tạo session trùng lặp khi session đã tồn tại
const c2_3 = evaluateSessionWrite(root2, { started_at: 1050000, extra_ms: 0 }, { started_at: 1100000, extra_ms: 0 }, { uid: 'hs_01' }, examId, 'hs_01', 1100000);
assert.strictEqual(c2_3, false, 'Ca 2.3: Không được tạo session lặp');
console.log('  [PASS] Ca 2.3: Tạo đè session đã có -> BỊ CHẶN (403)');

// 2.4 Tạo session cho học sinh khác (mạo danh uid)
const c2_4 = evaluateSessionWrite(root2, null, { started_at: 1050000, extra_ms: 0 }, { uid: 'hs_01' }, examId, 'hs_02', 1050000);
assert.strictEqual(c2_4, false, 'Ca 2.4: Mạo danh uid');
console.log('  [PASS] Ca 2.4: Mạo danh uid học sinh khác -> BỊ CHẶN (403)');

// NHÓM 3: Nộp bài trắc nghiệm (attempts) và gia hạn thời gian
console.log('\n3. Kiểm định nộp bài và thời gian gia hạn (attempts):');
const startedAt = 1050000;
const root3 = createRootState({
  sessions: {
    [examId]: {
      'hs_01': { started_at: startedAt, extra_ms: 0 }
    }
  }
});
const normalDeadline = startedAt + 45 * 60000 + 30000; // 3,780,000

// 3.1 Nộp bài lần 1 hợp lệ trong thời gian thi
const c3_1 = evaluateAttemptWrite(root3, null, {}, { submitted_at: 3000000, answers: { q1: 'A' } }, { uid: 'hs_01' }, examId, 'hs_01', '1', 3000000);
assert.strictEqual(c3_1, true, 'Ca 3.1: Nộp bài trong hạn phải thành công');
console.log('  [PASS] Ca 3.1: Nộp bài lần 1 trong khung giờ thi -> HỢP LỆ (200)');

// 3.2 Nộp bài quá hạn 30s không có extra_ms
const c3_2 = evaluateAttemptWrite(root3, null, {}, { submitted_at: normalDeadline + 5000, answers: { q1: 'A' } }, { uid: 'hs_01' }, examId, 'hs_01', '1', normalDeadline + 5000);
assert.strictEqual(c3_2, false, 'Ca 3.2: Quá hạn nộp phải bị từ chối');
console.log('  [PASS] Ca 3.2: Nộp bài quá hạn 30s ân hạn -> BỊ CHẶN (403)');

// 3.3 Giáo viên gia hạn 10 phút (extra_ms = 600,000) -> Học sinh nộp thành công
const root3_extended = createRootState({
  sessions: {
    [examId]: {
      'hs_01': { started_at: startedAt, extra_ms: 600000 }
    }
  }
});
const c3_3 = evaluateAttemptWrite(root3_extended, null, {}, { submitted_at: normalDeadline + 500000, answers: { q1: 'A' } }, { uid: 'hs_01' }, examId, 'hs_01', '1', normalDeadline + 500000);
assert.strictEqual(c3_3, true, 'Ca 3.3: Nộp thành công sau khi giáo viên gia hạn');
console.log('  [PASS] Ca 3.3: Giáo viên gia hạn 10 phút -> Nộp thành công trong giờ gia hạn -> HỢP LỆ (200)');

// 3.4 Câu trả lời vượt quá 2000 ký tự (chống spam payload)
const longAnswer = 'x'.repeat(2500);
const c3_4 = evaluateAttemptWrite(root3, null, {}, { submitted_at: 3000000, answers: { q1: longAnswer } }, { uid: 'hs_01' }, examId, 'hs_01', '1', 3000000);
assert.strictEqual(c3_4, false, 'Ca 3.4: Câu trả lời > 2000 ký tự phải bị từ chối');
console.log('  [PASS] Ca 3.4: Câu trả lời chứa chuỗi 2500 ký tự -> BỊ TỪ CHỐI VALIDATE (403)');

// 3.5 Nộp đè lần 1 (data.exists() = true)
const c3_5 = evaluateAttemptWrite(root3, { submitted_at: 2000000 }, {}, { submitted_at: 3000000, answers: { q1: 'B' } }, { uid: 'hs_01' }, examId, 'hs_01', '1', 3000000);
assert.strictEqual(c3_5, false, 'Ca 3.5: Không được nộp đè lần 1');
console.log('  [PASS] Ca 3.5: Nộp đè lên bài đã nộp lần 1 -> BỊ CHẶN (403)');

// 3.6 Nộp lần 2 khi đề chỉ cho phép max_attempts = 1
const c3_6 = evaluateAttemptWrite(root3, null, { '1': { submitted_at: 2000000 } }, { submitted_at: 3000000, answers: { q1: 'A' } }, { uid: 'hs_01' }, examId, 'hs_01', '2', 3000000);
assert.strictEqual(c3_6, false, 'Ca 3.6: max_attempts = 1 không được nộp lần 2');
console.log('  [PASS] Ca 3.6: Nộp lần 2 khi đề max_attempts = 1 -> BỊ CHẶN (403)');

// 3.7 Nộp lần 2 khi đề cho phép max_attempts = 2 và đã có lần 1
const rootPractice = createRootState({
  sessions: {
    'exam_tin9_practice': {
      'hs_01': { started_at: startedAt, extra_ms: 0 }
    }
  }
});
const c3_7 = evaluateAttemptWrite(rootPractice, null, { '1': { submitted_at: 2000000 } }, { submitted_at: 3000000, answers: { q1: 'A' } }, { uid: 'hs_01' }, 'exam_tin9_practice', 'hs_01', '2', 3000000);
assert.strictEqual(c3_7, true, 'Ca 3.7: max_attempts = 2 được nộp lần 2');
console.log('  [PASS] Ca 3.7: Nộp lần 2 khi đề max_attempts = 2 và đã có lần 1 -> HỢP LỆ (200)');

console.log('\n======================================================');
console.log('TẤT CẢ 12 CA KIỂM ĐỊNH QUY TẮC BẢO MẬT ĐỀU ĐẠT 100% PASS');
console.log('======================================================');
