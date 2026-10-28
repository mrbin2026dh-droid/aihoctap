// Bộ não AI → Gia sư: Bộ não (VPS, khóa BRAIN_KEY) gửi hiểu lầm riêng từng em; Gia sư hỏi gợi mở đúng chỗ em hay nhầm.
// Không gửi đáp án đúng, tra theo tài khoản trong token (máy học sinh không chèn được), gửi lại thì thay toàn bộ bản cũ.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential, misconceptionLine, cleanHieuLam, brainKeyOf} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
await registerStudentCredential('9A10005', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f92', {name:'Vũ Bảo', grade:9, class_code:'9A10'});
await registerStudentCredential('hs_khac', '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f93', {name:'Lê Chi', grade:9, class_code:'9A10'});
const KEY = 'brain-key-0123456789abcdefXYZ';
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, GEMINI_API_KEY:'k', ALLOWED_ORIGIN:'https://x.github.io', BRAIN_KEY:KEY,
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS',
  TEST_LESSONS:{'tin9:bai1':{course_id:'tin9', lesson_id:'bai1', title:'Bài 1', content_markdown:'1 byte gồm 8 bit.', questions:[]}}};
const req = async (path, o = {}) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:o.method || 'GET', headers:{'Content-Type':'application/json', ...(o.headers || {})}, body:o.body !== undefined ? JSON.stringify(o.body) : undefined}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
const push = (items, key = KEY) => req('/brain/hieu-lam', {method:'POST', headers:{'X-Brain-Key':key}, body:{items}});
const realFetch = globalThis.fetch; let sys = '';
globalThis.fetch = async (u, o) => { if (String(u).includes('generativelanguage')) { sys = JSON.parse(o.body).systemInstruction.parts[0].text; return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Em thử nhớ lại 1 byte gồm mấy bit nhé?'}]}}]}), {status:200}); } return realFetch(u, o); };
try {
  // Hàm thuần
  ok(brainKeyOf(' 9A10.005 ') === '9a10_005' && brainKeyOf('HS[1]/x') === 'hs_1__x', 'mã học sinh chuẩn hóa giống Firebase/Bộ não (chữ thường, thay . # $ [ ] /)');
  const c = cleanHieuLam([{cau:'Câu "A"\n`lệnh`', chon:'4', chu_de:'Đơn vị'}, {cau:'', chon:'x'}, {cau:'b', chon:'c'}, {cau:'d', chon:'e'}, {cau:'f', chon:'g'}]);
  ok(c.length === 3 && c[0].cau === 'Câu A lệnh', 'lọc: bỏ mục thiếu câu/lựa chọn, bỏ ngoặc kép/xuống dòng, tối đa 3 mục');
  const ml = misconceptionLine([{cau:'1 byte bằng bao nhiêu bit?', chon:'4', chu_de:'Đơn vị thông tin'}]);
  ok(ml.includes('em đã chọn "4"') && ml.includes('không nói hay ám chỉ đáp án đúng') && ml.includes('Nếu không liên quan thì bỏ qua') && misconceptionLine([]) === '', 'dòng nhắc Gia sư: lựa chọn sai của em, cấm lộ đáp án, không liên quan thì bỏ qua');
  // Quyền
  ok((await push({})).status === 200, 'đúng khóa → nhận (danh sách rỗng)');
  ok((await req('/brain/hieu-lam', {method:'POST', body:{items:{}}})).status === 403, 'không có khóa → từ chối');
  ok((await push({}, 'sai-khoa-0123456789abcdefgh')).status === 403, 'sai khóa → từ chối');
  ok((await push([])).status === 400 && (await req('/brain/hieu-lam', {method:'POST', headers:{'X-Brain-Key':KEY}, body:'x'})).status === 400, 'dữ liệu không phải object → báo lỗi');
  { const b = await push({'9A10_005':[{cau:'a', chon:'b'}], 'a/b':[{cau:'a', chon:'b'}], 'ok_1':[{cau:'a', chon:'b'}]}); ok(b.status === 200 && b.body.skipped === 2 && b.body.saved === 1, 'mã chưa chuẩn hóa (chữ hoa, dấu /) → bỏ riêng mã đó, các em khác vẫn lưu'); }
  // Gửi hiểu lầm
  const r = await push({'9a10005':[{cau:'1 byte bằng bao nhiêu bit?', chon:'4', chu_de:'Đơn vị thông tin'}], 'khong_co_ai':[{cau:'x', chon:'y'}], 'rong':[]});
  ok(r.status === 200 && r.body.saved === 2 && r.body.cleared === 1, 'lưu hiểu lầm của từng em (bỏ em danh sách rỗng; em cũ không còn → xóa)');
  const t = (await req('/login', {method:'POST', body:{student_id:'9A10005', pin:'123456'}})).body.token;
  const t2 = (await req('/login', {method:'POST', body:{student_id:'hs_khac', pin:'123456'}})).body.token;
  ok(!!t && !!t2, 'học sinh đăng nhập');
  sys = ''; await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t}, body:{course_id:'tin9', lesson_id:'bai1', message:'Byte là gì ạ?'}});
  ok(sys.includes('HIỂU LẦM GẦN ĐÂY CỦA EM NÀY') && sys.includes('em đã chọn "4"'), 'Gia sư của em 9A10005 biết em từng chọn nhầm "4" (mã chữ hoa vẫn khớp khóa chữ thường của Bộ não)');
  sys = ''; await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t2}, body:{course_id:'tin9', lesson_id:'bai1', message:'Byte là gì ạ?', context:{hieu_lam:[{cau:'giả', chon:'giả'}]}}});
  ok(sys && !sys.includes('HIỂU LẦM GẦN ĐÂY'), 'em khác không thấy hiểu lầm của bạn; dữ liệu giả gửi từ máy học sinh bị bỏ qua');
  sys = ''; await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t}, body:{mode:'exam_review', message:'Nhận xét', review:{title:'T', items:[]}}});
  ok(!sys.includes('HIỂU LẦM GẦN ĐÂY'), 'chế độ nhận xét bài thi không chèn dòng hiểu lầm');
  // Gửi lại: em đã hết nhầm → xóa
  const r2 = await push({'hs_khac':[{cau:'Thiết bị vào?', chon:'Loa'}]});
  ok(r2.body.saved === 1 && r2.body.cleared === 2, 'gửi lại thay toàn bộ: em không còn trong danh sách bị xóa');
  sys = ''; await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t}, body:{course_id:'tin9', lesson_id:'bai1', message:'Byte là gì ạ?'}});
  ok(sys && !sys.includes('HIỂU LẦM GẦN ĐÂY'), 'em đã hết nhầm → Gia sư không nhắc nữa');
  sys = ''; await req('/pwa/tutor', {method:'POST', headers:{Authorization:'Bearer ' + t2}, body:{course_id:'tin9', lesson_id:'bai1', message:'Thiết bị vào là gì?'}});
  ok(sys.includes('em đã chọn "Loa"'), 'em mới được thêm có dòng hiểu lầm');
} finally { globalThis.fetch = realFetch; }
console.log('BRAIN HIEU LAM OK', n);
