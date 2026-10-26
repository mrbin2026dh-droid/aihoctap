// Kịch bản thi thử khép kín 3 học sinh (Cổng 3) trên môi trường Firebase thật.
// Thực hiện đầy đủ các bước trong mục 3.5 của handoff:
// - Tạo 3 học sinh thử nghiệm (lớp 9TEST)
// - Phát hành đề thử: 2 câu trắc nghiệm + 1 phần thực hành (6 điểm)
// - HS1: Làm bài, nộp bài, nộp file thực hành .xlsx -> Điểm lý thuyết hiện ngay
// - HS2: Làm nháp rồi thoát (không nộp) -> Sau giờ đóng tự nộp từ nháp (auto_from_draft: true)
// - HS3: Không vào thi -> Không có bài, không có điểm
// - Sau giờ đóng: Kiểm tra results, minh chứng Drive, điểm lý thuyết & tự nộp nháp
// - Dọn dẹp sạch sẽ 3 tài khoản thử và dữ liệu đề thi sau khi kiểm tra xong

import { readFileSync, existsSync } from 'node:fs';
import process from 'node:process';

const configPath = `${process.env.USERPROFILE}/.config/configstore/firebase-tools.json`;
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const adminToken = config.tokens?.access_token;

const PROJ = 'day-hoc-tuong-tac-7ee69';
const DB_URL = `https://${PROJ}-default-rtdb.asia-southeast1.firebasedatabase.app`;
const API_KEY = 'AIzaSyCC2tCURXYAMpdN687kcjY537K7zUhh_Fg';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIvXSXTOKDFlAoHtJ-6wdFrN0k_KupNtPQOoYatZKmaHNWD40g0UcCOV_XE8rHgKd4/exec';

const adminHeaders = {
  'Authorization': `Bearer ${adminToken}`,
  'Content-Type': 'application/json'
};

async function postJson(url, data) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function postGas(data) {
  // text/plain tránh CORS / preflight
  const r = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function rtdb(path, method = 'GET', body = undefined) {
  const opt = {
    method,
    headers: adminHeaders
  };
  if (body !== undefined) opt.body = JSON.stringify(body);
  const r = await fetch(`${DB_URL}/${path}.json`, opt);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`RTDB ${method} ${path} -> ${r.status}: ${text}`);
  }
  return r.json();
}

async function provisionStudent(sid, name, cls, grade, pin) {
  const email = `${sid.toLowerCase()}@hs.aihoc.test`;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJ}/accounts`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password: String(pin), emailVerified: true })
  });
  const data = await res.json();
  let uid = data.localId;
  if (!uid && data.error?.message?.includes('EMAIL_EXISTS')) {
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email: [email], targetProjectId: PROJ })
    });
    const lData = await lookup.json();
    uid = lData.users?.[0]?.localId;
  }
  if (!uid) throw new Error(`Không lấy được UID: ${JSON.stringify(data)}`);

  await rtdb(`students/${uid}`, 'PUT', {
    student_id: sid.toUpperCase(),
    name,
    class_code: cls.toUpperCase(),
    grade: Number(grade),
    email,
    updated_at: { '.sv': 'timestamp' }
  });

  return { sid, uid, email, pin, name };
}

async function studentSignIn(email, password) {
  const data = await postJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    email,
    password,
    returnSecureToken: true
  });
  if (!data.idToken) throw new Error(`Đăng nhập thất bại cho ${email}: ${JSON.stringify(data)}`);
  return { idToken: data.idToken, uid: data.localId };
}

async function main() {
  console.log('=== BẮT ĐẦU KỊCH BẢN THI THỬ KHÉP KÍN 3 HỌC SINH (CỔNG 3) ===');
  console.log('Apps Script URL:', APPS_SCRIPT_URL);
  const EXAM_ID = 'pilot_tin9_' + Date.now().toString().slice(-4);
  console.log('Mã đề thi thử:', EXAM_ID);

  let s1, s2, s3;
  try {
    // 1. Tạo 3 tài khoản học sinh
    console.log('\n--- 1. Cấp phát 3 tài khoản học sinh lớp 9TEST ---');
    s1 = await provisionStudent('hs_pilot01', 'Nguyễn Văn An', '9TEST', 9, '123456');
    console.log(`HS1: ${s1.name} (${s1.sid}) -> UID: ${s1.uid}`);
    s2 = await provisionStudent('hs_pilot02', 'Trần Thị Bình', '9TEST', 9, '123456');
    console.log(`HS2: ${s2.name} (${s2.sid}) -> UID: ${s2.uid}`);
    s3 = await provisionStudent('hs_pilot03', 'Lê Văn Cường', '9TEST', 9, '123456');
    console.log(`HS3: ${s3.name} (${s3.sid}) -> UID: ${s3.uid}`);

    // 2. Phát hành đề thi thử nghiệm
    console.log('\n--- 2. Phát hành đề thi 2 câu + thực hành 6 điểm ---');
    const now = Date.now();
    const opensAt = now - 60 * 1000;          // Mở 1 phút trước
    const closesAt = now + 4 * 60 * 1000;      // Đóng sau 4 phút

    await rtdb(`exam_meta/${EXAM_ID}`, 'PUT', {
      title: 'Kiểm tra Thử nghiệm Tin 9',
      grade: 9,
      minutes: 10,
      opens_at: opensAt,
      closes_at: closesAt,
      max_attempts: 1,
      backend: 'firebase',
      parts: [
        { key: 'theory', label: 'Trắc nghiệm', max: 4 },
        { key: 'practice', label: 'Thực hành', max: 6 }
      ]
    });

    await rtdb(`exam_questions/${EXAM_ID}`, 'PUT', {
      q1: { n: 1, kind: 'choice', prompt: 'Thiết bị nào sau đây là bộ xử lý trung tâm?', options: { A: 'CPU', B: 'RAM', C: 'ROM', D: 'HDD' }, points: 2 },
      q2: { n: 2, kind: 'choice', prompt: 'Hệ điều hành phổ biến nhất trên máy tính cá nhân?', options: { A: 'Windows', B: 'Android', C: 'iOS', D: 'watchOS' }, points: 2 }
    });

    await rtdb(`exam_secrets/${EXAM_ID}`, 'PUT', {
      q1: 'A',
      q2: 'A'
    });
    console.log('-> Đã phát hành đề thi thành công trên RTDB.');

    // 3. Học sinh 1 (HS1): Làm bài, nộp bài, nộp file thực hành
    console.log('\n--- 3. HS1: Đăng nhập, làm bài, nộp bài, nộp file thực hành ---');
    const auth1 = await studentSignIn(s1.email, s1.pin);
    console.log('HS1 đã đăng nhập thành công.');

    // Ghi session
    await rtdb(`sessions/${EXAM_ID}/${s1.uid}`, 'PUT', {
      started_at: { '.sv': 'timestamp' },
      extra_ms: 0
    });
    console.log('HS1 đã tạo phiên làm bài.');

    // Lưu nháp
    await rtdb(`drafts/${EXAM_ID}/${s1.uid}`, 'PUT', {
      updated_at: { '.sv': 'timestamp' },
      answers: { q1: 'A', q2: 'A' },
      leaves: 0
    });
    console.log('HS1 đã lưu bài nháp.');

    // Nộp bài chính thức
    await rtdb(`attempts/${EXAM_ID}/${s1.uid}/1`, 'PUT', {
      submitted_at: { '.sv': 'timestamp' },
      answers: { q1: 'A', q2: 'A' }
    });
    console.log('HS1 đã nộp bài trắc nghiệm lần 1.');

    // Gọi Apps Script chấm ngay (grade_my_attempt)
    console.log('HS1 gọi Apps Script chấm bài ngay (grade_my_attempt)...');
    const gradeRes1 = await postGas({
      action: 'grade_my_attempt',
      idToken: auth1.idToken,
      exam_id: EXAM_ID,
      attempt: '1'
    });
    console.log('-> Kết quả chấm ngay của HS1:', JSON.stringify(gradeRes1));
    if (gradeRes1.earned === 4 || gradeRes1.theory_score === 4) {
      console.log('✔ HS1: Điểm trắc nghiệm hiện ngay: 4/4 điểm (ĐÚNG TUYỆT ĐỐI)');
    } else {
      console.log('⚠ HS1 điểm trả về:', gradeRes1);
    }

    // Nộp file thực hành .xlsx
    console.log('HS1 nộp file thực hành baitap_excel.xlsx qua Apps Script...');
    const mockExcelBase64 = Buffer.from('MOCK_EXCEL_PRACTICE_FILE_CONTENT_12345').toString('base64');
    const uploadRes1 = await postGas({
      action: 'upload_practice',
      idToken: auth1.idToken,
      exam_id: EXAM_ID,
      name: 'baitap_excel.xlsx',
      b64: mockExcelBase64,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    console.log('-> Kết quả nộp file thực hành của HS1:', JSON.stringify(uploadRes1));
    if (uploadRes1.ok && uploadRes1.file_id) {
      console.log(`✔ HS1: Nộp file thực hành thành công. Drive File ID: ${uploadRes1.file_id}`);
    }

    // 4. Học sinh 2 (HS2): Chỉ làm nháp rồi đóng trình duyệt
    console.log('\n--- 4. HS2: Đăng nhập, tạo phiên, lưu nháp rồi đóng trình duyệt ---');
    const auth2 = await studentSignIn(s2.email, s2.pin);
    console.log('HS2 đã đăng nhập thành công.');

    await rtdb(`sessions/${EXAM_ID}/${s2.uid}`, 'PUT', {
      started_at: { '.sv': 'timestamp' },
      extra_ms: 0
    });
    console.log('HS2 đã tạo phiên làm bài.');

    // HS2 trả lời q1 đúng, q2 sai (B), có 1 lần chuyển tab (leaves: 1)
    await rtdb(`drafts/${EXAM_ID}/${s2.uid}`, 'PUT', {
      updated_at: { '.sv': 'timestamp' },
      answers: { q1: 'A', q2: 'B' },
      leaves: 1
    });
    console.log('HS2 đã lưu nháp (q1: A, q2: B). HS2 đóng trình duyệt, KHÔNG bấm nộp bài.');

    // 5. Học sinh 3 (HS3): Không vào thi
    console.log('\n--- 5. HS3: Không vào thi (không tạo phiên, không có nháp) ---');

    // 6. Chuyển đề thi sang trạng thái hết giờ đóng đề
    console.log('\n--- 6. Chuyển đề sang trạng thái đã hết giờ đóng (now >= closes_at + 2 phút) ---');
    const pastClosesAt = Date.now() - 3 * 60 * 1000; // Đã đóng 3 phút trước
    await rtdb(`exam_meta/${EXAM_ID}/closes_at`, 'PUT', pastClosesAt);
    console.log('-> Đã cập nhật closes_at về quá khứ (đủ điều kiện kích hoạt finalizeExam_).');

    // Đợi trigger tick() của Apps Script chạy (hoặc chờ tối đa 90 giây)
    console.log('\n--- 7. Đang chờ Apps Script trigger tick() tự động xử lý sau khi đóng đề... ---');
    console.log('(Trigger tick() chạy định kỳ mỗi 1 phút trên Google Apps Script)');

    let finalized = false;
    for (let wait = 0; wait < 24; wait++) {
      process.stdout.write(`Đang kiểm tra kết quả (lần ${wait + 1}/24, đã chờ ${wait * 5}s)... `);
      const resMeta = await rtdb(`exam_meta/${EXAM_ID}`);
      const resResults = await rtdb(`results/${EXAM_ID}`);
      
      const hs2Result = resResults?.[s2.uid];
      const hs1Result = resResults?.[s1.uid];
      if (resMeta?.finalized_at || (hs1Result?.finalized && hs2Result?.finalized)) {
        console.log('\n✔ ĐÃ PHÁT HIỆN KẾT QUẢ TỰ ĐỘNG CHỐT TỪ APPS SCRIPT!');
        finalized = true;
        break;
      }
      console.log('Chưa có, chờ tiếp 5s...');
      await new Promise(r => setTimeout(r, 5000));
    }

    if (!finalized) {
      console.log('\n⚠ Trigger định kỳ chưa kịp chạy trong 2 phút. Kiểm tra dữ liệu hiện tại...');
    }

    // 8. Đọc và kiểm tra kết quả chi tiết
    console.log('\n--- 8. KIỂM TRA ĐỐI CHIẾU KẾT QUẢ THI ---');
    const allResults = await rtdb(`results/${EXAM_ID}`) || {};
    const hs1Res = allResults[s1.uid];
    const hs2Res = allResults[s2.uid];
    const hs3Res = allResults[s3.uid];

    console.log('Kết quả HS1:', JSON.stringify(hs1Res, null, 2));
    console.log('Kết quả HS2:', JSON.stringify(hs2Res, null, 2));
    console.log('Kết quả HS3:', hs3Res ? JSON.stringify(hs3Res) : 'KHÔNG CÓ (Đúng: HS3 không vào thi)');

    if (hs1Res) {
      console.log('\n✔ ĐÁNH GIÁ HS1:');
      console.log(`- Điểm lý thuyết: ${hs1Res.theory_score} / ${hs1Res.theory_max}`);
      console.log(`- File thực hành: ${hs1Res.practice_file?.name || 'Chưa nhận'} (${hs1Res.practice_file?.url || ''})`);
      console.log(`- Phiếu minh chứng Drive: ${hs1Res.evidence_url || 'Đang cập nhật'}`);
    }

    if (hs2Res) {
      console.log('\n✔ ĐÁNH GIÁ HS2:');
      console.log(`- Tự động nộp từ nháp: ${hs2Res.auto_from_draft} (ĐẠT CHUẨN CỔNG 3)`);
      console.log(`- Điểm lý thuyết: ${hs2Res.theory_score} / ${hs2Res.theory_max} (1 câu đúng = 2 điểm)`);
      console.log(`- Phiếu minh chứng Drive: ${hs2Res.evidence_url || 'Đang cập nhật'}`);
    }

    // Kiểm định cứng (Claude): thiếu bất kỳ mục nào → thất bại, KHÔNG in "thành công".
    const fails = [];
    const must = (c, m) => { if (!c) fails.push(m); };
    must(uploadRes1?.ok && uploadRes1.file_id && !String(uploadRes1.file_id).startsWith('pending'), 'HS1: file thực hành phải có Drive file_id thật');
    must(hs1Res?.practice_file?.url, 'HS1: results.practice_file.url (link Drive) phải có');
    must(hs1Res?.finalized === true && hs1Res?.evidence_url, 'HS1: đã chốt và có phiếu minh chứng Drive');
    must(hs2Res?.auto_from_draft === true && Number(hs2Res?.theory_score) === 2, 'HS2: tự nộp từ nháp, 2 điểm');
    must(hs2Res?.finalized === true && hs2Res?.evidence_url, 'HS2: đã chốt và có phiếu minh chứng Drive');
    must(!hs3Res, 'HS3: không có kết quả');
    must(Boolean((await rtdb(`exam_meta/${EXAM_ID}`))?.finalized_at), 'Đề phải có finalized_at (mọi học sinh đã chốt)');
    if (fails.length) { console.log('\n=== THI THỬ CHƯA ĐẠT ===\n- ' + fails.join('\n- ')); process.exitCode = 1; }
    else console.log('\n=== KỊCH BẢN THI THỬ KHÉP KÍN ĐẠT TOÀN BỘ ===\nKiểm tay thêm: mở 2 file minh chứng + tab sổ điểm (2 hàng), gõ điểm thực hành HS1 → Tổng và phiếu minh chứng đổi.');
  } finally {
    // Dọn dẹp dữ liệu thử
    console.log('\n--- 9. Dọn dẹp dữ liệu thi thử và tài khoản thử ---');
    try {
      if (s1?.uid) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ targetProjectId: PROJ, localId: s1.uid })
        });
        await rtdb(`students/${s1.uid}`, 'DELETE');
      }
      if (s2?.uid) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ targetProjectId: PROJ, localId: s2.uid })
        });
        await rtdb(`students/${s2.uid}`, 'DELETE');
      }
      if (s3?.uid) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ targetProjectId: PROJ, localId: s3.uid })
        });
        await rtdb(`students/${s3.uid}`, 'DELETE');
      }
      // Xóa đề thử
      await rtdb(`exam_meta/${EXAM_ID}`, 'DELETE');
      await rtdb(`exam_questions/${EXAM_ID}`, 'DELETE');
      await rtdb(`exam_secrets/${EXAM_ID}`, 'DELETE');
      await rtdb(`sessions/${EXAM_ID}`, 'DELETE');
      await rtdb(`drafts/${EXAM_ID}`, 'DELETE');
      await rtdb(`attempts/${EXAM_ID}`, 'DELETE');
      await rtdb(`results/${EXAM_ID}`, 'DELETE');
      console.log('✔ Đã xóa sạch 3 tài khoản thử và toàn bộ dữ liệu đề thi thử khỏi Firebase.');
    } catch (e) {
      console.error('Lỗi khi dọn dẹp:', e.message);
    }
  }
}

main().catch(err => {
  console.error('LỖI KỊCH BẢN THI THỬ:', err);
  process.exit(1);
});
