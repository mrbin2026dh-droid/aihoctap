// Đăng nhập cả hệ thống bằng Google Sheet (SHEET_LOGIN_URL), Sheet giả bằng fetch giả.
import assert from 'node:assert/strict';
import worker, {MockDONamespace} from '../worker/index.js';
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
const URL_SHEET = 'https://script.google.com/macros/s/TEST/exec';
const rows = {hs01:{pin:'123456', name:'Nguyễn Văn An', lop:'9A', ma:'HS01'}, hs9a02:{pin:'234567', name:'Trần Thị Bình', lop:'9A', ma:'hs9a02'}};
let mode = 'ok'; const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (String(u).startsWith(URL_SHEET)) {
    calls.push(JSON.parse(o.body));
    if (mode === 'down') throw new Error('network');
    if (mode === 'html') return new Response('<html>busy</html>', {status:200});
    const b = JSON.parse(o.body), r = rows[String(b.ma).toLowerCase()];
    const j = !r ? {ok:false, error:'Không tìm thấy Mã học sinh này.'} : (r.pin !== b.pin ? {ok:false, error:'Mã PIN chưa đúng.'} : {ok:true, student:{name:r.name, lop:r.lop, ma:r.ma, status:'Chưa thi', done:false}});
    return new Response(JSON.stringify(j), {status:200});
  }
  return realFetch(u, o);
};
const env = {GATE_DO:new MockDONamespace(), SIGNING_KEYPAIR:kp, MOCK_MODE:true, SHEET_LOGIN_URL:URL_SHEET, ALLOWED_ORIGIN:'https://mrbin2026dh-droid.github.io',
  FIREBASE_CLIENT_EMAIL:'x@y.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY_ID:'k', TEACHER_ADMIN_SECRET:'TEST_SECRET_KEY_AT_LEAST_16_CHARS'};
const call = async (path, o = {}, token) => { const r = await worker.fetch(new Request('http://localhost/api' + path, {method:o.method || 'GET', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})}, body:o.body ? JSON.stringify(o.body) : undefined}), env); return {status:r.status, body:await r.json().catch(() => ({}))}; };

let r = await call('/login', {method:'POST', body:{student_id:'HS01', pin:'123456'}});
assert.equal(r.status, 200, JSON.stringify(r.body)); assert.ok(r.body.token);
assert.equal(r.body.name, 'Nguyễn Văn An'); assert.equal(r.body.class_code, '9A'); assert.equal(r.body.grade, 9); assert.equal(r.body.must_change_pin, false); assert.equal(r.body.uid, 'HS01');
const me = await call('/pwa/me', {}, r.body.token); assert.equal(me.status, 200, JSON.stringify(me.body)); assert.equal(me.body.grade, 9); assert.equal(me.body.class_code, '9A');
// viết hoa/thường: gõ hs01 vẫn vào, uid chuẩn theo Sheet
r = await call('/login', {method:'POST', body:{student_id:'hs01', pin:'123456'}}); assert.equal(r.status, 200); assert.equal(r.body.uid, 'HS01');
r = await call('/login', {method:'POST', body:{student_id:'hs9a02', pin:'234567'}}); assert.equal(r.status, 200); assert.equal(r.body.name, 'Trần Thị Bình');
// sai PIN / sai mã
r = await call('/login', {method:'POST', body:{student_id:'HS01', pin:'999999'}}); assert.equal(r.status, 401);
r = await call('/login', {method:'POST', body:{student_id:'khongco', pin:'123456'}}); assert.equal(r.status, 401);
// Sheet lỗi: 502, không tính là nhập sai
mode = 'html'; r = await call('/login', {method:'POST', body:{student_id:'HS01', pin:'123456'}}); assert.equal(r.status, 502);
mode = 'down'; r = await call('/login', {method:'POST', body:{student_id:'HS01', pin:'123456'}}); assert.equal(r.status, 502);
mode = 'ok'; r = await call('/login', {method:'POST', body:{student_id:'HS01', pin:'123456'}}); assert.equal(r.status, 200, 'sau lỗi mạng vẫn vào được (không bị khóa oan)');
// đổi PIN trong app bị chặn, PIN do Sheet quản lý
const cp = await call('/pwa/change-pin', {method:'POST', body:{old_pin:'123456', new_pin:'654321'}}, r.body.token); assert.equal(cp.status, 403);
// Khóa khi dò PIN
for (let i = 0; i < 12; i++) await call('/login', {method:'POST', body:{student_id:'hs9a02', pin:'000000'}});
r = await call('/login', {method:'POST', body:{student_id:'hs9a02', pin:'234567'}}); assert.equal(r.status, 429, 'dò PIN nhiều lần phải bị khóa');
assert.ok(calls.every(c => c.action === 'login'));
console.log('WORKER SHEET LOGIN OK');
