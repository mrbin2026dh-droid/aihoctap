// Cả lớp dùng chung một địa chỉ mạng của trường: nhiều học sinh gõ sai PIN không được khóa cả lớp, nhưng từng tài khoản vẫn bị khóa riêng khi đoán PIN.
import assert from 'node:assert/strict';
import worker, {MockDONamespace, registerStudentCredential} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
for (let i = 0; i < 100; i++) await registerStudentCredential('hs' + i, '123456', 'a1b2c3d4e5f60718293a4b5c6d7e8f90', {name: 'HS' + i, grade: 9, class_code: '9A'});
const env = {GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, ALLOWED_ORIGIN: 'https://x.github.io', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS'};
const login = async (i, pin) => (await worker.fetch(new Request('http://x/api/login', {method: 'POST', headers: {'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9'}, body: JSON.stringify({student_id: 'hs' + i, pin})}), env)).status;
for (let i = 0; i < 80; i++) assert.equal(await login(i, '000000'), 401, 'HS ' + i + ' gõ sai một lần: chỉ báo sai PIN, không khóa mạng');
assert.equal(await login(99, '123456'), 200, 'học sinh khác cùng địa chỉ vẫn đăng nhập được');
assert.equal(await login(0, '123456'), 200, 'học sinh đã gõ sai một lần vẫn vào được khi gõ đúng');
for (let k = 0; k < 4; k++) await login(50, '111111'); // HS50: đã sai 1 lần ở trên + 4 = 5
assert.equal(await login(50, '123456'), 429, 'một tài khoản bị đoán PIN vẫn bị khóa riêng');
assert.equal(await login(51, '123456'), 200, 'khóa một tài khoản không ảnh hưởng bạn khác');
console.log('CLASS SHARED IP OK');
