// Thi thật: nhận biết máy vào thi từ ngoài mạng trường (chỉ để giáo viên kiểm tra, không chặn) + /api/thi/my-ip.
import assert from 'node:assert/strict';
import worker, { ipPrefix, ipPrefixShort, ipNgoaiTruong, MockDONamespace } from '../worker/index.js';
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const ENV = { GATE_DO: new MockDONamespace(), SIGNING_KEYPAIR: kp, MOCK_MODE: true, ALLOWED_ORIGIN: 'https://aihoctap.online', FIREBASE_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID: 'k', TEACHER_ADMIN_SECRET: 'TEST_SECRET_KEY_AT_LEAST_16_CHARS' };
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok  ', m); };
ok(ipPrefix('203.0.113.45') === '203.0.113' && ipPrefix('2001:DB8:aa:bb:1:2:3:4') === '2001:db8:aa:bb' && ipPrefix('abc') === '', 'tiền tố mạng: IPv4 3 số, IPv6 4 nhóm, chuỗi lạ → rỗng');
ok(ipPrefixShort('203.0.113.45') === '203.0' && ipPrefixShort('2001:db8:aa:bb::1') === '2001:db8', 'chỉ lưu 2 số đầu (không lưu đủ IP)');
ok(ipNgoaiTruong('203.0.113.9', '203.0.113') === false, 'cùng mạng trường → trong trường');
ok(ipNgoaiTruong('198.51.100.7', '203.0.113') === true, 'mạng khác → ngoài mạng trường');
ok(ipNgoaiTruong('198.51.100.7', '203.0.113, 198.51.100') === false, 'trường có 2 đường mạng → cả hai đều tính trong trường');
ok(ipNgoaiTruong('2001:db8:aa:bb::5', '2001:db8:aa:bb') === false && ipNgoaiTruong('2001:db8:cc:dd::5', '2001:db8:aa:bb') === true, 'IPv6 theo /64');
ok(ipNgoaiTruong('198.51.100.7', '') === null && ipNgoaiTruong('', '203.0.113') === null, 'chưa cài IP trường hoặc không đọc được IP → không gắn nhãn');
const r = await worker.fetch(new Request('https://x.workers.dev/api/thi/my-ip', { headers: { 'CF-Connecting-IP': '203.0.113.45', Origin: 'https://aihoctap.online' } }), ENV, { waitUntil() {} });
const j = await r.json(); ok(r.status === 200 && j.ip === '203.0.113.45' && r.headers.get('cache-control') === 'no-store', '/api/thi/my-ip trả IP máy đang dùng, không lưu đệm');
const bad = await worker.fetch(new Request('https://x.workers.dev/api/thi/ip', { method: 'POST', body: JSON.stringify({ ma_de: '../x', ma: 'HS01' }), headers: { 'Content-Type': 'application/json', Origin: 'https://aihoctap.online' } }), ENV, { waitUntil() {} });
ok(bad.status === 400, '/api/thi/ip: mã bài lạ → từ chối');
console.log('WORKER THI IP OK ' + n);
