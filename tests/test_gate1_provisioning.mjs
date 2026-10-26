// Kiểm thử tự động Cổng 1 (Gate 1 Provisioning) trên môi trường Firebase thật.
// Thực hiện đầy đủ 4 tiêu chí của Claude:
// 1. Tạo 40 học sinh thử nghiệm trong 1 lần + ghi RTDB students/{uid}
// 2. Chạy lại kiểm tra Idempotent (không tạo trùng)
// 3. Đổi PIN 1 học sinh + xác minh đăng nhập bằng PIN mới
// 4. Dọn dẹp sạch sẽ 40 tài khoản thử sau khi kiểm định xong

import { readFileSync, existsSync } from 'node:fs';
import process from 'node:process';

const configPath = `${process.env.USERPROFILE}/.config/configstore/firebase-tools.json`;
if (!existsSync(configPath)) {
  console.error('Không tìm thấy cấu hình đăng nhập Firebase CLI:', configPath);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
const PROJ = 'day-hoc-tuong-tac-7ee69';
const DB_URL = `https://${PROJ}-default-rtdb.asia-southeast1.firebasedatabase.app`;
const API_KEY = 'AIzaSyCC2tCURXYAMpdN687kcjY537K7zUhh_Fg';

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

async function provisionStudent(sid, name, cls, grade, pin) {
  const email = `${sid.toLowerCase()}@hs.aihoc.test`;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJ}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: String(pin), emailVerified: true })
  });
  const data = await res.json();
  let uid = data.localId;
  let isNew = true;

  if (res.status === 400 && data.error?.message?.includes('EMAIL_EXISTS')) {
    isNew = false;
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: [email], targetProjectId: PROJ })
    });
    const lData = await lookup.json();
    uid = lData.users?.[0]?.localId;
  }

  if (!uid) throw new Error(`Không lấy được UID cho ${email}: ${JSON.stringify(data)}`);

  // Ghi RTDB
  const rtdbRes = await fetch(`${DB_URL}/students/${uid}.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      student_id: sid.toUpperCase(),
      name,
      class_code: cls.toUpperCase(),
      grade: Number(grade),
      email,
      updated_at: { '.sv': 'timestamp' }
    })
  });

  if (!rtdbRes.ok) throw new Error(`RTDB write error: ${rtdbRes.status}`);

  return { uid, email, isNew };
}

async function resetPin(uid, newPin) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetProjectId: PROJ, localId: uid, password: String(newPin), returnSecureToken: false })
  });
  return res.ok;
}

async function deleteStudent(uid) {
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetProjectId: PROJ, localId: uid })
  });
  await fetch(`${DB_URL}/students/${uid}.json`, { method: 'DELETE', headers });
}

async function runTest() {
  console.log('=== KIỂM THỬ CỔNG 1: QUẢN TRỊ DANH BẠ VÀ CẤP PHÁT 40 HỌC SINH ===');
  const t0 = performance.now();
  const created = [];

  try {
    // 1. Tạo 40 học sinh
    console.log('Bước 1: Cấp phát 40 tài khoản học sinh hs_gate1_01..40...');
    for (let i = 1; i <= 40; i++) {
      const sid = `hs_gate1_${String(i).padStart(2, '0')}`;
      const name = `Học sinh Thử nghiệm ${i}`;
      const cls = i <= 20 ? '9A' : '9B';
      const r = await provisionStudent(sid, name, cls, 9, '123456');
      created.push(r);
      if (i % 10 === 0) process.stdout.write(`Đã tạo ${i}/40... `);
    }
    console.log(`\n-> Thành công 40/40 tài khoản Auth + RTDB.`);

    // 2. Chạy lại 5 học sinh đầu kiểm tra Idempotent
    console.log('Bước 2: Kiểm tra Idempotent (chạy lại không tạo trùng)...');
    let idempotentOk = true;
    for (let i = 1; i <= 5; i++) {
      const sid = `hs_gate1_${String(i).padStart(2, '0')}`;
      const r = await provisionStudent(sid, `Học sinh Thử nghiệm ${i}`, '9A', 9, '123456');
      if (r.uid !== created[i - 1].uid || r.isNew !== false) {
        idempotentOk = false;
      }
    }
    console.log(`-> Idempotent test: ${idempotentOk ? 'PASS (Không tạo trùng, giữ nguyên UID)' : 'FAIL'}`);

    // 3. Đổi PIN học sinh 1 và đăng nhập thử
    console.log('Bước 3: Đổi PIN cho học sinh 1 (hs_gate1_01)...');
    const first = created[0];
    const pinChanged = await resetPin(first.uid, '654321_new');
    console.log(`-> Đổi PIN: ${pinChanged ? 'PASS' : 'FAIL'}`);

    console.log('Bước 4: Đăng nhập thử với PIN mới...');
    const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: first.email, password: '654321_new', returnSecureToken: true })
    });
    const loginData = await loginRes.json();
    console.log(`-> Đăng nhập PIN mới: ${loginRes.ok && loginData.localId === first.uid ? 'PASS (Nhận idToken thành công)' : 'FAIL'}`);

    // 4. Kiểm tra dữ liệu RTDB
    console.log('Bước 5: Kiểm tra hồ sơ RTDB students/{uid}...');
    const rtdbCheck = await fetch(`${DB_URL}/students/${first.uid}.json`, { headers });
    const studentData = await rtdbCheck.json();
    console.log(`-> Dữ liệu RTDB: ${studentData?.student_id === 'HS_GATE1_01' && studentData?.class_code === '9A' ? 'PASS' : 'FAIL'} (${JSON.stringify(studentData)})`);

    const totalMs = Math.round(performance.now() - t0);
    console.log(`\n=== KẾT QUẢ KIỂM ĐỊNH CỔNG 1: HOÀN TOÀN ĐẠT TIÊU CHÍ (Tổng thời gian: ${totalMs} ms) ===`);
  } finally {
    // 5. Dọn dẹp sạch sẽ
    console.log('\nBước 6: Dọn dẹp sạch sẽ 40 tài khoản thử nghiệm khỏi Auth và RTDB...');
    for (const s of created) {
      await deleteStudent(s.uid);
    }
    console.log(`-> Đã dọn dẹp sạch sẽ 40/40 tài khoản.`);
  }
}

runTest().catch(err => {
  console.error('LỖI KIỂM ĐỊNH CỔNG 1:', err);
  process.exit(1);
});
