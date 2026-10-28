// Tên miền riêng aihoctap.online + github.io cùng gọi được Worker (CORS khớp CHÍNH XÁC từng tên miền trong danh sách).
import assert from 'node:assert/strict';
import worker, {MockDONamespace, allowedOriginList} from '../worker/index.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok  ', m); };
ok(JSON.stringify(allowedOriginList(' https://aihoctap.online/ , https://mrbin2026dh-droid.github.io,,abc ')) === JSON.stringify(['https://aihoctap.online', 'https://mrbin2026dh-droid.github.io']), 'đọc danh sách tên miền: bỏ khoảng trắng, dấu / cuối, mục rỗng, mục sai');
const env = {GATE_DO:new MockDONamespace(), ALLOWED_ORIGIN:'https://aihoctap.online,https://mrbin2026dh-droid.github.io'};
const pre = async origin => (await worker.fetch(new Request('https://w.dev/api/health', {method:'OPTIONS', headers:{Origin:origin}}), env)).headers.get('Access-Control-Allow-Origin');
ok(await pre('https://aihoctap.online') === 'https://aihoctap.online', 'tên miền riêng được phép');
ok(await pre('https://mrbin2026dh-droid.github.io') === 'https://mrbin2026dh-droid.github.io', 'github.io vẫn được phép (giai đoạn chuyển đổi)');
ok(await pre('https://aihoctap.online.evil.com') === 'https://aihoctap.online' && await pre('https://evil.com') === 'https://aihoctap.online', 'tên miền lạ / giả mạo đuôi → không được phản hồi lại chính nó');
ok(await pre('http://localhost:8080') === 'https://aihoctap.online', 'máy thật (không phải chế độ thử): localhost không được phép');
const one = {GATE_DO:new MockDONamespace(), ALLOWED_ORIGIN:'https://mrbin2026dh-droid.github.io'};
ok((await worker.fetch(new Request('https://w.dev/api/health', {method:'OPTIONS', headers:{Origin:'https://mrbin2026dh-droid.github.io'}}), one)).headers.get('Access-Control-Allow-Origin') === 'https://mrbin2026dh-droid.github.io', 'cấu hình cũ một tên miền vẫn chạy như trước');
ok((await worker.fetch(new Request('https://w.dev/api/health'), {GATE_DO:new MockDONamespace()})).status === 500, 'thiếu ALLOWED_ORIGIN → vẫn chặn (fail-closed) như cũ');
ok((await worker.fetch(new Request('https://w.dev/api/health', {method:'OPTIONS', headers:{Origin:'https://aihoctap.online'}}), env)).headers.get('Vary') === 'Origin', 'có Vary: Origin để bộ nhớ đệm không trộn tên miền');
console.log('MULTI ORIGIN OK', n);
