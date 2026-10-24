/**
 * Test Suite: Google Drive Materials Proxy & Offline Preparation (D1 / A6)
 * Tests:
 * 1. Teacher publishes material with Drive URL -> extracts & stores ONLY file_id (no arbitrary URL)
 * 2. Strict validation: rejects non-Drive domains and non-teacher tokens (403/400)
 * 3. Student lists materials by course (GET /api/pwa/materials/{course_id})
 * 4. Student downloads PDF via Worker Drive proxy with CORS headers & Content-Type: application/pdf
 * 5. Size limit gatekeeper: strictly rejects files > 10MB (HTTP 413)
 */

import assert from 'node:assert/strict';
import worker, {
  getOrCreateSigningKeys,
  createFirebaseCustomToken,
  MockDONamespace
} from '../worker/index.js';

console.log('=== RUNNING GOOGLE DRIVE MATERIALS VERIFICATION (D1 / A6) ===\n');

const signingKeys = await getOrCreateSigningKeys();
const sharedDONamespace = new MockDONamespace();

const teacherToken = await createFirebaseCustomToken(
  'teacher_mat_admin',
  { role: 'teacher', admin: true, name: 'Thầy Giáo Viên' },
  signingKeys.privateKey,
  'firebase-adminsdk-eval@aihoctap.iam.gserviceaccount.com'
);

const studentToken = await createFirebaseCustomToken(
  'student_mat_user',
  { role: 'student', grade: 6, class_code: '6A', name: 'Em Học Sinh' },
  signingKeys.privateKey,
  'firebase-adminsdk-eval@aihoctap.iam.gserviceaccount.com'
);

const testEnv = {
  GATE_DO: sharedDONamespace,
  SIGNING_KEYPAIR: signingKeys,
  ALLOWED_ORIGIN: 'https://mrbin2026dh-droid.github.io',
  MOCK_MODE: true,
  TEST_MATERIALS: {}
};

// -------------------------------------------------------------
// [1/4] TEST TEACHER PUBLISH MATERIAL WITH DRIVE URL (ONLY FILE_ID STORED)
// -------------------------------------------------------------
console.log('[1/4] Testing teacher material publishing with Google Drive URL (D1)...');

const driveShareUrl = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';

const pubReq = new Request('http://localhost/api/pwa/teacher/materials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify({
    id: 'mat_tin6_b1',
    course_id: 'tin6',
    title: 'Tài liệu tóm tắt Mục 1 SGK Tin học 6',
    drive_url: driveShareUrl,
    description: 'Bản PDF tóm tắt bài học'
  })
});

const pubRes = await worker.fetch(pubReq, testEnv);
assert.equal(pubRes.status, 200, 'Teacher publish material must succeed with 200');
const pubData = await pubRes.json();
assert.equal(pubData.success, true);
assert.equal(pubData.material.id, 'mat_tin6_b1');
assert.equal(pubData.material.file_id, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'Must extract and store file_id cleanly');
assert.equal(pubData.material.url, undefined, 'Must NOT store arbitrary url property (D1)');

console.log('  PASS: Teacher material publishing extracts and stores strictly file_id.');

// -------------------------------------------------------------
// [1b/4] TEST O2: RTDB WRITE FAILURE (502 BAD GATEWAY)
// -------------------------------------------------------------
console.log('\n[1b/4] Testing O2: RTDB write error handling (502)...');
const rtdbFailEnv = {
  ...testEnv,
  FIREBASE_DATABASE_URL: 'https://mock-rtdb.firebaseio.com',
  FIREBASE_CLIENT_EMAIL: 'mock@sa.iam.gserviceaccount.com'
};
const origFetchO2 = globalThis.fetch;
try {
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('googleapis.com/oauth2') || urlStr.includes('accounts.google.com')) {
      return new Response(JSON.stringify({ access_token: 'mock_oauth_tok', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (urlStr.includes('mock-rtdb.firebaseio.com')) {
      return new Response(JSON.stringify({ error: 'RTDB internal server error' }), { status: 500 });
    }
    return origFetchO2(url, init);
  };
  const rtdbFailReq = new Request('http://localhost/api/pwa/teacher/materials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherToken}`
    },
    body: JSON.stringify({
      id: 'mat_tin6_b1',
      course_id: 'tin6',
      title: 'Tài liệu tóm tắt Mục 1 SGK Tin học 6',
      drive_url: driveShareUrl,
      description: 'Bản PDF tóm tắt bài học'
    })
  });
  const rtdbFailRes = await worker.fetch(rtdbFailReq, rtdbFailEnv);
  assert.equal(rtdbFailRes.status, 502, 'RTDB write failure must return 502 Bad Gateway (O2)');
} finally {
  globalThis.fetch = origFetchO2;
}
console.log('  PASS O2: RTDB write failure strictly returns 502.');

// -------------------------------------------------------------
// [2/4] TEST AUTHENTICATION & DOMAIN VALIDATION GATES
// -------------------------------------------------------------
console.log('\n[2/4] Testing domain rejection & auth gates...');

// Non-teacher attempt
const nonTeacherReq = new Request('http://localhost/api/pwa/teacher/materials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`
  },
  body: JSON.stringify({
    id: 'mat_hack',
    course_id: 'tin6',
    title: 'Hack',
    drive_url: driveShareUrl
  })
});
const nonTeacherRes = await worker.fetch(nonTeacherReq, testEnv);
assert.equal(nonTeacherRes.status, 403, 'Non-teacher must be forbidden (403)');

// Arbitrary untrusted domain attempt
const evilDomainReq = new Request('http://localhost/api/pwa/teacher/materials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`
  },
  body: JSON.stringify({
    id: 'mat_evil',
    course_id: 'tin6',
    title: 'Phishing',
    drive_url: 'https://evil-phishing-site.com/exploit.pdf'
  })
});
const evilDomainRes = await worker.fetch(evilDomainReq, testEnv);
assert.equal(evilDomainRes.status, 400, 'Non-Drive URL must be rejected with 400');

console.log('  PASS: Auth and domain gates strictly enforced.');

// -------------------------------------------------------------
// [3/4] TEST STUDENT LIST MATERIALS
// -------------------------------------------------------------
console.log('\n[3/4] Testing student list materials by course...');

const listReq = new Request('http://localhost/api/pwa/materials/tin6', {
  method: 'GET'
});
const listRes = await worker.fetch(listReq, testEnv);
assert.equal(listRes.status, 200);
const listData = await listRes.json();
assert(Array.isArray(listData.materials), 'Must return materials array');
assert.equal(listData.materials.length, 1);
assert.equal(listData.materials[0].file_id, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

console.log('  PASS: Materials list successfully returned to student.');

// -------------------------------------------------------------
// [4/4] TEST STUDENT DOWNLOAD PROXY & 10MB CEILING
// -------------------------------------------------------------
console.log('\n[4/4] Testing student PDF proxy download and size check...');

// Mock global fetch for drive.google.com during test
const originalFetch = globalThis.fetch;
try {
  // Test valid PDF download
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('drive.google.com')) {
      const mockPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      return new Response(mockPdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(mockPdfBytes.length)
        }
      });
    }
    return originalFetch(url, init);
  };

  // O3: Test missing token rejection (401)
  const noTokenReq = new Request('http://localhost/api/pwa/materials/tin6/mat_tin6_b1/file', {
    method: 'GET'
  });
  const noTokenRes = await worker.fetch(noTokenReq, testEnv);
  assert.equal(noTokenRes.status, 401, 'Proxy download without JWT token must return 401');

  // O3: Test Drive returning HTML instead of PDF (415)
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('drive.google.com')) {
      return new Response('<!DOCTYPE html><html><body>Login Google Drive</body></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }
    return originalFetch(url, init);
  };
  const htmlFileReq = new Request('http://localhost/api/pwa/materials/tin6/mat_tin6_b1/file', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const htmlFileRes = await worker.fetch(htmlFileReq, testEnv);
  assert.equal(htmlFileRes.status, 415, 'Drive returning HTML must be rejected with 415');

  // Restore valid PDF mock for successful download test
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('drive.google.com')) {
      const mockPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      return new Response(mockPdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(mockPdfBytes.length)
        }
      });
    }
    return originalFetch(url, init);
  };

  const fileReq = new Request('http://localhost/api/pwa/materials/tin6/mat_tin6_b1/file', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${studentToken}`
    }
  });

  const fileRes = await worker.fetch(fileReq, testEnv);
  assert.equal(fileRes.status, 200, 'Proxy download must return 200');
  assert.equal(fileRes.headers.get('Content-Type'), 'application/pdf', 'Must return PDF content type');
  assert.equal(fileRes.headers.get('X-Content-Type-Options'), 'nosniff', 'Must include X-Content-Type-Options: nosniff (O3)');
  assert.equal(fileRes.headers.get('Cache-Control'), 'private, max-age=3600', 'Must include Cache-Control: private, max-age=3600 (O3)');
  assert(fileRes.headers.get('Access-Control-Allow-Origin'), 'Must have CORS header for PWA offline caching');
  const buffer = await fileRes.arrayBuffer();
  assert(buffer.byteLength > 0, 'Buffer must not be empty');

  // Test oversize rejection (> 10MB)
  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('drive.google.com')) {
      return new Response('Mock huge content', {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(15 * 1024 * 1024) // 15MB
        }
      });
    }
    return originalFetch(url, init);
  };

  const hugeFileRes = await worker.fetch(fileReq, testEnv);
  assert.equal(hugeFileRes.status, 413, 'Files over 10MB must be rejected with 413 Payload Too Large');

} finally {
  globalThis.fetch = originalFetch;
}

console.log('  PASS: Drive PDF proxy download and 10MB limit gate verified.');
console.log('\n======================================================');
console.log('ALL GOOGLE DRIVE MATERIALS TESTS PASSED 100%!');
console.log('======================================================');
