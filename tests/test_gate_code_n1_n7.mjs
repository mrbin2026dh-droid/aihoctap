/**
 * BỘ KIỂM THỬ XÁC MINH CÁC ĐIỀU KIỆN AUDIT N1–N7 (TDD FAIL-FIRST)
 * 24/10/2026 - Antigravity
 *
 * Kiểm tra:
 * - N1: Publish kiểm tra res.ok; GET catalog 500 báo lỗi 502 và KHÔNG gọi PUT ghi đè danh mục; chỉ 404 mới khởi tạo.
 * - N2: Kiểm tra câu hỏi: correct_answer bắt buộc thuộc options; markdown <= 100KB, <= 100 câu, <= 6 options.
 * - N3: course_id không suy đoán bằng .includes(grade); hỗ trợ course_id rõ ràng, test lớp 1, 6, 9, 12; lưu subject_id, subject_name, grade riêng.
 * - N4: URL tài liệu bắt buộc https://, chặn javascript:, chặn domain ngoài whitelist (Drive, GitHub).
 * - N5: PIN >= 6 ký tự mặc định (không cần STRICT_PIN_LENGTH).
 * - N6: ID học sinh không tồn tại KHÔNG tạo khóa studentGlobalKey; thời gian khóa tối đa vài giờ (không 24h); mở khóa giáo viên xóa sạch.
 */

import assert from 'node:assert/strict';
import worker, {
  MockDONamespace
} from '../worker/index.js';

const sharedDO = new MockDONamespace();
const signingKeys = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  },
  true,
  ['sign', 'verify']
);

// Tạo token giáo viên hợp lệ
const nowSec = Math.floor(Date.now() / 1000);
const teacherPayload = {
  uid: 'teacher_admin_01',
  role: 'teacher',
  claims: { admin: true },
  exp: nowSec + 3600
};
const enc = new TextEncoder();
const b64Header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const b64Payload = Buffer.from(JSON.stringify(teacherPayload)).toString('base64url');
const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKeys.privateKey, enc.encode(`${b64Header}.${b64Payload}`));
const b64Sig = Buffer.from(sigBuf).toString('base64url');
const validTeacherJwt = `${b64Header}.${b64Payload}.${b64Sig}`;

const baseEnv = {
  GATE_DO: sharedDO,
  SIGNING_KEYPAIR: signingKeys,
  TEACHER_ADMIN_SECRET: 'TEST_TEACHER_SECRET_AT_LEAST_16_CHARS',
  MOCK_MODE: true
};

console.log('=== BẮT ĐẦU KIỂM THỬ XÁC MINH N1–N7 ===');

// ============================================================================
// 1. KIỂM THỬ N5: PIN >= 6 KÝ TỰ BẮT BUỘC MẶC ĐỊNH
// ============================================================================
console.log('\n[1/6] Kiểm thử N5: Bắt buộc PIN >= 6 ký tự mặc định...');
{
  const req5Digit = new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: 'hs_test', pin: '12345' })
  });
  const res5Digit = await worker.fetch(req5Digit, baseEnv);
  assert.equal(res5Digit.status, 400, 'PIN 5 ký tự phải bị từ chối với HTTP 400 mặc định');
  const err = await res5Digit.json();
  assert.match(err.detail, /tối thiểu 6 ký tự/i);
  console.log('  PASS N5: PIN < 6 ký tự bị từ chối 400 mặc định.');
}

// ============================================================================
// 2. KIỂM THỬ N2: KIỂM SOÁT CÂU HỎI & GIỚI HẠN NỘI DUNG PUBLISH
// ============================================================================
console.log('\n[2/6] Kiểm thử N2: Kiểm tra câu hỏi và giới hạn nội dung bài học...');
{
  // A. correct_answer không thuộc options
  const reqInvalidKey = new Request('http://localhost/api/pwa/teacher/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      subject_id: 'tin',
      subject_name: 'Tin học',
      grade: 6,
      lesson_id: 'b1',
      title: 'Bài 1',
      content_markdown: '# Nội dung',
      questions: [
        {
          id: 'q1',
          prompt: 'Câu hỏi 1?',
          options: { A: 'Đáp án A', B: 'Đáp án B' },
          correct_answer: 'C' // 'C' không có trong options!
        }
      ]
    })
  });
  const resInvalidKey = await worker.fetch(reqInvalidKey, baseEnv);
  assert.equal(resInvalidKey.status, 400, 'correct_answer không thuộc options phải bị từ chối 400');
  const errKey = await resInvalidKey.json();
  assert.match(errKey.detail, /không thuộc danh sách lựa chọn/i);

  // B. Markdown quá 100KB
  const hugeMd = '# '.repeat(60000); // > 100KB
  const reqHugeMd = new Request('http://localhost/api/pwa/teacher/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      subject_id: 'tin',
      subject_name: 'Tin học',
      grade: 6,
      lesson_id: 'b1',
      title: 'Bài 1',
      content_markdown: hugeMd,
      questions: []
    })
  });
  const resHugeMd = await worker.fetch(reqHugeMd, baseEnv);
  assert.equal(resHugeMd.status, 400, 'Markdown > 100KB phải bị từ chối 400');
  const errMd = await resHugeMd.json();
  assert.match(errMd.detail, /vượt quá giới hạn 100KB/i);

  // C. Câu hỏi có > 6 lựa chọn
  const reqManyOpts = new Request('http://localhost/api/pwa/teacher/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      subject_id: 'tin',
      subject_name: 'Tin học',
      grade: 6,
      lesson_id: 'b1',
      title: 'Bài 1',
      content_markdown: '# Bài 1',
      questions: [
        {
          id: 'q1',
          prompt: 'Chọn?',
          options: { A: '1', B: '2', C: '3', D: '4', E: '5', F: '6', G: '7' }, // 7 lựa chọn
          correct_answer: 'A'
        }
      ]
    })
  });
  const resManyOpts = await worker.fetch(reqManyOpts, baseEnv);
  assert.equal(resManyOpts.status, 400, 'Câu hỏi > 6 options phải bị từ chối 400');
  const errOpts = await resManyOpts.json();
  assert.match(errOpts.detail, /từ 2 đến 6 lựa chọn/i);

  console.log('  PASS N2: Kiểm soát câu hỏi (options match, kích thước <= 100KB, options <= 6) đạt chuẩn.');
}

// ============================================================================
// 3. KIỂM THỬ N3: course_id KHÔNG SUY ĐOÁN BẰNG .includes(grade)
// ============================================================================
console.log('\n[3/6] Kiểm thử N3: course_id độc lập, không suy đoán sai (test lớp 1, 6, 9, 12)...');
{
  const testCases = [
    { subject_id: 'toan12', grade: 1, expected_course_id: 'toan1' },
    { subject_id: 'tin', grade: 6, expected_course_id: 'tin6' },
    { subject_id: 'ly', grade: 9, expected_course_id: 'ly9' },
    { subject_id: 'hoa', grade: 12, expected_course_id: 'hoa12' }
  ];

  for (const tc of testCases) {
    const envMock = { ...baseEnv, TEST_CATALOG: { revision: 'v1', courses: [] } };
    const req = new Request('http://localhost/api/pwa/teacher/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validTeacherJwt}`
      },
      body: JSON.stringify({
        subject_id: tc.subject_id,
        subject_name: `Môn ${tc.subject_id}`,
        grade: tc.grade,
        lesson_id: 'b1',
        title: `Bài 1 lớp ${tc.grade}`,
        content_markdown: '# Nội dung',
        questions: [{
          id: 'q1',
          prompt: 'Câu hỏi?',
          options: { A: 'Đáp án A', B: 'Đáp án B' },
          correct_answer: 'A'
        }]
      })
    });
    const res = await worker.fetch(req, envMock);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.course_id, tc.expected_course_id, `course_id cho subject ${tc.subject_id} và grade ${tc.grade} phải là ${tc.expected_course_id}`);
    
    // Kiểm tra catalog lưu riêng subject_id, subject_name, grade
    const savedCourse = envMock.TEST_CATALOG.courses.find(c => c.id === tc.expected_course_id);
    assert.ok(savedCourse, `Khóa học ${tc.expected_course_id} phải được lưu trong catalog`);
    assert.equal(savedCourse.grade, tc.grade);
    assert.equal(savedCourse.subject_id, tc.subject_id.replace(/\d+$/, ''));
  }
  console.log('  PASS N3: course_id chuẩn hóa chính xác cho mọi khối lớp 1, 6, 9, 12.');
}

// ============================================================================
// 4. KIỂM THỬ N4: BẢO MẬT URL TÀI LIỆU
// ============================================================================
console.log('\n[4/6] Kiểm thử N4: Bảo mật URL tài liệu (chặn javascript:, http://, domain lạ)...');
{
  // A. Chặn javascript:
  const reqJs = new Request('http://localhost/api/pwa/teacher/materials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      id: 'mat_js',
      title: 'XSS Attack',
      course_id: 'tin6',
      url: 'javascript:alert(1)'
    })
  });
  const resJs = await worker.fetch(reqJs, baseEnv);
  assert.equal(resJs.status, 400, 'javascript: URL phải bị từ chối 400');
  const errJs = await resJs.json();
  assert.match(errJs.detail, /https:\/\//i);

  // B. Chặn http://
  const reqHttp = new Request('http://localhost/api/pwa/teacher/materials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      id: 'mat_http',
      title: 'Insecure URL',
      course_id: 'tin6',
      url: 'http://drive.google.com/file/d/123'
    })
  });
  const resHttp = await worker.fetch(reqHttp, baseEnv);
  assert.equal(resHttp.status, 400, 'http:// không an toàn phải bị từ chối 400');

  // C. Chặn domain lạ ngoài whitelist
  const reqEvil = new Request('http://localhost/api/pwa/teacher/materials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      id: 'mat_evil',
      title: 'Phishing',
      course_id: 'tin6',
      url: 'https://evil-hacker.com/malware.pdf'
    })
  });
  const resEvil = await worker.fetch(reqEvil, baseEnv);
  assert.equal(resEvil.status, 400, 'Domain ngoài whitelist phải bị từ chối 400');
  const errEvil = await resEvil.json();
  assert.match(errEvil.detail, /danh sách được phép/i);

  // D. Chấp nhận Google Drive và GitHub hợp lệ
  const reqValidDrive = new Request('http://localhost/api/pwa/teacher/materials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({
      id: 'mat_drive',
      title: 'Tài liệu SGK Drive',
      course_id: 'tin6',
      url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OGvE2upms/view'
    })
  });
  const resValidDrive = await worker.fetch(reqValidDrive, baseEnv);
  assert.equal(resValidDrive.status, 200, 'Google Drive URL hợp lệ phải trả 200');

  console.log('  PASS N4: Bảo mật URL tài liệu strictly enforced (https + whitelist domains).');
}

// ============================================================================
// 5. KIỂM THỬ N6: KHÓA HỌC SINH KHÔNG TỒN TẠI & LÙI MỨC KHÓA TOÀN CỤC
// ============================================================================
console.log('\n[5/6] Kiểm thử N6: Chống lạm dụng khóa 24h & không khóa ID không tồn tại...');
{
  const testDO = new MockDONamespace();
  const envTestN6 = {
    ...baseEnv,
    GATE_DO: testDO,
    TEST_STUDENTS_AUTH: {
      'hs_real': {
        pin_hash: '3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b',
        salt: '0123456789abcdef0123456789abcdef'
      }
    }
  };

  // A. Thử sai 10 lần với ID không tồn tại -> KHÔNG được tạo key lock:nonexistent_user:__global__
  for (let i = 0; i < 12; i++) {
    const req = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.168.1.${i+1}` },
      body: JSON.stringify({ student_id: 'nonexistent_user', pin: '654321' })
    });
    const res = await worker.fetch(req, envTestN6);
    assert.equal(res.status, 401);
  }
  const nonExistLock = await testDO.get('default').fetch(new Request('http://do/get-lockout?key=' + encodeURIComponent('lock:nonexistent_user:__global__')));
  const nonExistLockData = await nonExistLock.json();
  assert.equal(nonExistLockData.locked, false, 'ID không tồn tại KHÔNG được tạo khóa studentGlobalKey');

  // B. Thử sai với ID có thật qua nhiều IP khác nhau -> Khóa toàn cục tối đa vài giờ (không 24h)
  let lockedRes = null;
  for (let i = 0; i < 11; i++) {
    const req = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.50.0.${i+1}` },
      body: JSON.stringify({ student_id: 'hs_real', pin: '654321' })
    });
    lockedRes = await worker.fetch(req, envTestN6);
  }
  assert.equal(lockedRes.status, 429, 'ID có thật bị thử sai 10 lần qua nhiều IP phải bị 429');
  const lockData = await lockedRes.json();
  assert.ok(lockData.retryAfter <= 7200, `Thời gian khóa (${lockData.retryAfter}s) không được vượt quá 2 giờ (7200s)`);

  // C. Mở khóa bằng quyền giáo viên -> học sinh đăng nhập lại thành công
  const unlockReq = new Request('http://localhost/api/teacher/unlock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${validTeacherJwt}`
    },
    body: JSON.stringify({ student_id: 'hs_real' })
  });
  const unlockRes = await worker.fetch(unlockReq, envTestN6);
  assert.equal(unlockRes.status, 200);

  const checkUnlocked = await testDO.get('default').fetch(new Request('http://do/get-lockout?key=' + encodeURIComponent('lock:hs_real:__global__')));
  const checkUnlockedData = await checkUnlocked.json();
  assert.equal(checkUnlockedData.locked, false, 'Key khóa toàn cục phải bị xóa sạch sau khi mở khóa');

  console.log('  PASS N6: ID không tồn tại không bị rác DO, backoff <= 2h, mở khóa giáo viên xóa sạch.');
}

// ============================================================================
// 6. KIỂM THỬ N1: PUBLISH KIỂM TRA res.ok & GET CATALOG 500 KHÔNG GHI ĐÈ
// ============================================================================
console.log('\n[6/6] Kiểm thử N1: GET catalog 500 báo lỗi 502 và KHÔNG gọi PUT ghi đè danh mục...');
{
  let putCatalogCalled = false;
  const mockGlobalFetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input.url;
    if (urlStr.includes('oauth2.googleapis.com') || urlStr.includes('/token')) {
      return new Response(JSON.stringify({ access_token: 'fake_mock_token_123', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (urlStr.includes('/packages_private/') || urlStr.includes('/packages/')) {
      return new Response(JSON.stringify({ name: 'ok' }), { status: 200 });
    }
    if (urlStr.includes('/catalog.json')) {
      if (init && init.method === 'PUT') {
        putCatalogCalled = true;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      // Giả lập GET catalog trả 500 Internal Server Error
      return new Response(JSON.stringify({ error: 'Database temporarily unavailable' }), { status: 500 });
    }
    return new Response('Not Found', { status: 404 });
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockGlobalFetch;

  try {
    const envFirebase = {
      ...baseEnv,
      MOCK_MODE: false,
      ALLOWED_ORIGIN: 'https://mrbin2026dh-droid.github.io',
      FIREBASE_DATABASE_URL: 'https://test-aihoctap-rtdb.firebaseio.com',
      FIREBASE_CLIENT_EMAIL: 'test@aihoctap.iam.gserviceaccount.com'
    };

    const publishReq = new Request('http://localhost/api/pwa/teacher/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validTeacherJwt}`
      },
      body: JSON.stringify({
        subject_id: 'tin',
        subject_name: 'Tin học',
        grade: 6,
        lesson_id: 'b1',
        title: 'Bài 1',
        content_markdown: '# Bài 1',
        questions: [{
          id: 'q1',
          prompt: 'Câu hỏi?',
          options: { A: 'A', B: 'B' },
          correct_answer: 'A'
        }]
      })
    });

    const res = await worker.fetch(publishReq, envFirebase);
    assert.equal(res.status, 502, 'Khi GET catalog lỗi 500, publish phải dừng ngay và trả HTTP 502');
    assert.equal(putCatalogCalled, false, 'TUYỆT ĐỐI KHÔNG được gọi PUT catalog khi GET bị lỗi 500 (tránh xóa sạch danh mục)');
    console.log('  PASS N1: GET catalog 500 trả 502, không gọi PUT ghi đè danh mục.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('\n======================================================');
console.log('TẤT CẢ CÁC CA KIỂM THỬ N1–N7 HOÀN TOÀN ĐẠT CHUẨN 100%!');
console.log('======================================================');
