// Độ chính xác Gia sư AI: (1) bộ lọc lộ đáp án không thay câu giải thích khái niệm bằng câu từ chối,
// (2) bài dài: chọn đúng đoạn liên quan thay vì cắt 8000 ký tự đầu.
import assert from 'node:assert/strict';
import { sanitizeWorkerOutput, pickLessonContext, findLetterLeak, LEAK_DETECTION_PATTERNS } from '../worker/index.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const concept = [
  'Dữ liệu số là dữ liệu được biểu diễn bằng dãy bit. Em có thể chọn cách lưu trên máy tính.',
  'Hãy đọc câu dưới đây rồi trả lời.', 'Ví dụ: câu dễ nhất là gì?', 'Máy tính chọn bộ nhớ phù hợp.',
  'Xử lý thông tin gồm 4 bước: thu nhận, lưu trữ, xử lý và truyền.',
];
for (const t of concept) ok(!sanitizeWorkerOutput(t, 'Giải thích giúp em', {}).modified, 'không chặn nhầm: ' + t);
for (const t of ['Đáp án là B.', 'đáp án là b nhé', 'Em nên chọn C.', 'Câu B là đáp án đúng.', 'Chọn phương án (A) nhé'])
  ok(sanitizeWorkerOutput(t, 'em hỏi', {}).modified, 'vẫn chặn lộ: ' + t);
ok(sanitizeWorkerOutput('Xử lý thông tin gồm: thu nhận, lưu trữ, xử lý, truyền.', 'Cho em đáp án', {}).modified, 'đòi đáp án → vẫn áp luật ngữ nghĩa');
ok(!findLetterLeak('chọn cách khác', LEAK_DETECTION_PATTERNS[2]), 'chọn cách ≠ chọn C');

const short = '# Bài\nNội dung ngắn.';
ok(pickLessonContext(short, 'x') === short, 'bài ngắn giữ nguyên');
const filler = i => `## Mục ${i}\n` + 'Văn bản phụ về chủ đề chung của bài học. '.repeat(40);
const long = '# Bài 5 Thế giới kĩ thuật số\nMở đầu bài học.\n\n' + Array.from({ length: 20 }, (_, i) => filler(i)).join('\n') + '\n## Mã nhị phân\nBit là đơn vị nhỏ nhất, byte gồm 8 bit. Mã nhị phân dùng hai kí hiệu 0 và 1.\n';
ok(long.length > 9000, 'bài thử đủ dài');
const ctx = pickLessonContext(long, 'Byte gồm bao nhiêu bit?', 9000);
ok(ctx.length <= 9300, 'không vượt giới hạn');
ok(ctx.includes('byte gồm 8 bit'), 'giữ đoạn cuối bài liên quan (trước đây bị cắt mất)');
ok(ctx.startsWith('# Bài 5'), 'luôn giữ mở đầu bài');
console.log(`test_tutor_accuracy: ${n} PASS`);
