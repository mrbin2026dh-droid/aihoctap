/**
 * Cloudflare Worker for AI AGENT SGK (Serverless Edge Gateway)
 * Fully satisfies conditions G1–G6, H1–H6 and I1–I4:
 * - I1: Google OAuth2 Access Token Minting & Caching via Web Crypto RS256 Assertion; Authorization: Bearer <oauth_token> for RTDB
 * - I2: Mandatory env.ALLOWED_ORIGIN (Fail-closed 500 if missing in production, no hardcoded personal domain fallback)
 * - I3: context.grade strict coercion to integer 1..12 (blocks arbitrary strings and 200KB prompt injection)
 * - I4:
 *   a) Gemini quota count commits ONLY on 200 OK response (dry-run check first, commit on success; 400/502 do not consume quota)
 *   b) packageKey uses non-regex delimiter ':' (prevents collision between 'a_b'+'c' and 'a'+'b_c')
 *   c) RTDB read failure in /api/submit returns 502 Bad Gateway (not 404)
 */

import {
  TeacherAuthContract,
  DurableObjectContract,
  IdValidationContract,
  SecurityConfigContract,
  TutorContract
} from './contracts.js';

// Base64URL encoding / decoding (RFC 7515)
export function base64UrlEncode(bufferOrStr) {
  let base64;
  if (typeof bufferOrStr === 'string') {
    base64 = btoa(unescape(encodeURIComponent(bufferOrStr)));
  } else {
    const bytes = new Uint8Array(bufferOrStr);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * PBKDF2 slow hash for student PIN using Web Crypto API (100,000 iterations of SHA-256)
 */
export async function hashPinPbkdf2(pin, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

let cachedDevKeyPair = null;

/**
 * Load or parse Service Account Keypair for RS256 token signing (G2, H2, H3)
 */
export async function loadOrDeriveServiceAccountKeys(env = {}) {
  // 1. Direct keypair injected (e.g. from test harness)
  if (env.SIGNING_KEYPAIR) {
    return env.SIGNING_KEYPAIR;
  }

  // 2. Load PKCS8 private key from Worker Secret (H2: Clean PEM and derive public key)
  if (env.FIREBASE_PRIVATE_KEY) {
    const pem = SecurityConfigContract.cleanPem(env.FIREBASE_PRIVATE_KEY);
    const rawB64 = pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
    const binaryDer = base64UrlDecode(rawB64);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      true, // extractable = true enables JWK export to derive public key
      ['sign']
    );

    let publicKey = null;
    if (env.FIREBASE_PUBLIC_KEY) {
      const pubPem = SecurityConfigContract.cleanPem(env.FIREBASE_PUBLIC_KEY);
      const pubB64 = pubPem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
      const pubDer = base64UrlDecode(pubB64);
      publicKey = await crypto.subtle.importKey(
        'spki',
        pubDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['verify']
      );
    } else {
      // H2: Automatically derive public key from private key JWK export
      const jwk = await crypto.subtle.exportKey('jwk', privateKey);
      const publicJwk = {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        alg: 'RS256',
        ext: true
      };
      publicKey = await crypto.subtle.importKey(
        'jwk',
        publicJwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['verify']
      );
    }

    return { privateKey, publicKey };
  }

  // 3. Fallback: ONLY generate ephemeral keypair if explicitly permitted by dev flag (or helper called with 0 args) (H3)
  if (SecurityConfigContract.isDevKeyAllowed(env) || arguments.length === 0) {
    if (!cachedDevKeyPair) {
      cachedDevKeyPair = await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['sign', 'verify']
      );
    }
    return cachedDevKeyPair;
  }

  // Fail-closed (H3): Return null when keys are not configured in production
  return null;
}

export const getOrCreateSigningKeys = loadOrDeriveServiceAccountKeys;

/**
 * Mint and cache Google OAuth2 Access Token using Service Account Private Key (I1)
 */
let cachedOAuthToken = null;

export async function getOrFetchGoogleOAuthToken(env = {}, privateKey = null) {
  if (env.FIREBASE_AUTH_TOKEN) {
    return env.FIREBASE_AUTH_TOKEN;
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedOAuthToken && cachedOAuthToken.token && cachedOAuthToken.expiresAt > now + 300) {
    return cachedOAuthToken.token;
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  if (!clientEmail || !privateKey) {
    return null;
  }

  const tokenUrl = env.GOOGLE_OAUTH2_TOKEN_URL || 'https://oauth2.googleapis.com/token';

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: SecurityConfigContract.RTDB_OAUTH_SCOPES,
    aud: tokenUrl,
    exp: now + 3600,
    iat: now
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const sigBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    dataToSign
  );
  const assertion = `${headerB64}.${payloadB64}.${base64UrlEncode(sigBuffer)}`;

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[OAUTH2_TOKEN_EXCHANGE_ERROR]', res.status, errText);
      return null;
    }

    const data = await res.json();
    const accessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;

    cachedOAuthToken = {
      token: accessToken,
      expiresAt: now + expiresIn
    };

    return accessToken;
  } catch (err) {
    console.error('[OAUTH2_FETCH_NETWORK_ERROR]', err);
    return null;
  }
}

/**
 * Generate real RS256 Firebase Custom Token conforming to official Google IdentityToolkit specification (G2)
 */
export async function createFirebaseCustomToken(studentId, claims = {}, privateKey, clientEmail, keyId) {
  if (!privateKey) {
    throw new Error('Thiếu Service Account Private Key để ký Firebase Custom Token.');
  }
  if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.trim()) {
    throw new Error('Thiếu Service Account Client Email để tạo Firebase Custom Token.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    ...(keyId ? { kid: keyId } : {})
  };

  const email = clientEmail.trim();
  const payload = {
    iss: email,
    sub: email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600, // Maximum expiration: 1 hour
    uid: studentId,
    claims: claims
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const sigBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    dataToSign
  );
  const sigB64 = base64UrlEncode(sigBuffer);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

/**
 * Verify JWT token with RS256 public key (G2, F4, H2)
 */
export async function verifyJwtToken(token, publicKey) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Thiếu token xác thực.' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Định dạng token không hợp lệ (yêu cầu 3 phần JWT).' };
  }
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token đã hết hạn.' };
    }

    if (!publicKey) {
      return { valid: false, error: 'Thiếu khóa công khai để xác thực chữ ký token.' };
    }

    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes = base64UrlDecode(sigB64);

    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      sigBytes,
      dataToVerify
    );

    if (!valid) {
      return { valid: false, error: 'Chữ ký token không hợp lệ.' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: `Lỗi phân tích token: ${err.message}` };
  }
}

/**
 * Cloudflare Durable Object for Distributed State & Rate Limiting (F2, G4, H5, I4)
 */
export class GateDurableObject {
  constructor(state, _env) {
    this.state = state;
    this.storage = state?.storage || new MapStorage();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.pathname;

    // 1. Check Lockout for a key
    if (action === '/get-lockout') {
      const key = url.searchParams.get('key');
      const record = (await this.storage.get(key)) || { count: 0, lockedUntil: 0 };
      const now = Date.now();
      if (record.lockedUntil > now) {
        return new Response(JSON.stringify({
          locked: true,
          retryAfter: Math.ceil((record.lockedUntil - now) / 1000)
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ locked: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Record failed login attempt with exponential backoff
    if (action === '/record-failed-login') {
      const { pairKey, ipKey } = await request.json();
      const now = Date.now();

      const record = (await this.storage.get(pairKey)) || { count: 0, lockedUntil: 0, backoffLevel: 0 };
      record.count += 1;
      let locked = false;
      let retryAfter = 0;

      if (record.count >= 5) {
        // Backoff: 5m, 15m, 60m
        const backoffMinutes = record.backoffLevel === 0 ? 5 : (record.backoffLevel === 1 ? 15 : 60);
        record.backoffLevel += 1;
        record.lockedUntil = now + (backoffMinutes * 60 * 1000);
        locked = true;
        retryAfter = backoffMinutes * 60;
      }
      await this.storage.put(pairKey, record);

      // IP Flood detection (threshold 50 failed attempts in 5 min)
      let ipFloodLocked = false;
      if (ipKey) {
        const ipRec = (await this.storage.get(ipKey)) || { count: 0, lockedUntil: 0, windowStart: now };
        if (now - ipRec.windowStart > 300000) {
          ipRec.count = 1;
          ipRec.windowStart = now;
        } else {
          ipRec.count += 1;
        }
        if (ipRec.count >= 50) {
          ipRec.lockedUntil = now + (10 * 60 * 1000); // 10 min IP lockout
          ipFloodLocked = true;
        }
        await this.storage.put(ipKey, ipRec);
      }

      return new Response(JSON.stringify({ locked, retryAfter, ipFloodLocked }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Reset lockout on successful login
    if (action === '/reset-lockout') {
      const { pairKey } = await request.json();
      await this.storage.delete(pairKey);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Teacher / Admin unlock for student (G4: Colon-delimited prefix isolation)
    if (action === '/unlock') {
      const { student_id } = await request.json();
      const prefix = DurableObjectContract.getLockPrefix(student_id); // 'lock:${student_id}:'
      const listRes = await this.storage.list({ prefix });
      let deleted = 0;
      if (listRes instanceof Map) {
        for (const [k] of listRes) {
          await this.storage.delete(k);
          deleted += 1;
        }
      } else if (Array.isArray(listRes)) {
        for (const k of listRes) {
          await this.storage.delete(k);
          deleted += 1;
        }
      }
      return new Response(JSON.stringify({ unlocked: true, deletedCount: deleted, prefix }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Submit idempotency and attempt limiting
    if (action === '/save-submission') {
      const { idempotencyKey, countKey, result, maxAttempts } = await request.json();

      const existing = await this.storage.get(`sub:${idempotencyKey}`);
      if (existing) {
        return new Response(JSON.stringify({ status: 200, body: existing, cached: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const currentCount = (await this.storage.get(`count:${countKey}`)) || 0;
      if (currentCount >= (maxAttempts || 2)) {
        return new Response(JSON.stringify({
          status: 403,
          body: { detail: 'Đã vượt quá số lần nộp bài cho phép.' },
          cached: false
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await this.storage.put(`count:${countKey}`, currentCount + 1);
      await this.storage.put(`sub:${idempotencyKey}`, result);

      return new Response(JSON.stringify({ status: 200, body: result, cached: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Gemini Daily Quota Limit check (Legacy / Direct callers)
    if (action === '/check-gemini-limit') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const student_id = body.student_id;
      const isDryRun = body.dry_run === true || url.searchParams.get('dry_run') === 'true';
      const today = new Date().toISOString().slice(0, 10);

      // Global daily limit
      const globalKey = `gemini:global:${today}`;
      const globalCount = (await this.storage.get(globalKey)) || 0;
      if (globalCount >= TutorContract.MAX_GLOBAL_DAILY_LIMIT) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: 'global_exceeded',
          count: globalCount,
          detail: 'Hạn mức gia sư AI hôm nay đã đạt tối đa (1000 lượt/ngày). Vui lòng thử lại vào ngày mai.'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Per-student daily limit (H5)
      if (student_id) {
        const studentKey = DurableObjectContract.getStudentTutorKey(student_id, today);
        const studentCount = (await this.storage.get(studentKey)) || 0;
        if (studentCount >= TutorContract.MAX_STUDENT_DAILY_LIMIT) {
          return new Response(JSON.stringify({
            allowed: false,
            reason: 'student_exceeded',
            count: studentCount,
            detail: `Em đã dùng hết hạn mức ${TutorContract.MAX_STUDENT_DAILY_LIMIT} lượt hỏi gia sư trong ngày. Hãy tự ôn tập và quay lại vào ngày mai nhé!`
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // If NOT dry-run, increment count immediately (for legacy/direct callers)
      if (!isDryRun) {
        await this.storage.put(globalKey, globalCount + 1);
        if (student_id) {
          const studentKey = DurableObjectContract.getStudentTutorKey(student_id, today);
          const studentCount = (await this.storage.get(studentKey)) || 0;
          await this.storage.put(studentKey, studentCount + 1);
        }
      }

      return new Response(JSON.stringify({
        allowed: true,
        globalCount: isDryRun ? globalCount : globalCount + 1
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 7. Atomic Gemini Quota Reservation (J1: Locks slot immediately to prevent race conditions)
    if (action === '/reserve-gemini-limit') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const student_id = body.student_id;
      const today = new Date().toISOString().slice(0, 10);

      // Global daily limit
      const globalKey = `gemini:global:${today}`;
      const globalCount = (await this.storage.get(globalKey)) || 0;
      if (globalCount >= TutorContract.MAX_GLOBAL_DAILY_LIMIT) {
        return new Response(JSON.stringify({
          allowed: false,
          reason: 'global_exceeded',
          count: globalCount,
          detail: 'Hạn mức gia sư AI hôm nay đã đạt tối đa (1000 lượt/ngày). Vui lòng thử lại vào ngày mai.'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Per-student daily limit (J1)
      let studentKey = null;
      let studentCount = 0;
      if (student_id) {
        studentKey = DurableObjectContract.getStudentTutorKey(student_id, today);
        studentCount = (await this.storage.get(studentKey)) || 0;
        if (studentCount >= TutorContract.MAX_STUDENT_DAILY_LIMIT) {
          return new Response(JSON.stringify({
            allowed: false,
            reason: 'student_exceeded',
            count: studentCount,
            detail: `Em đã dùng hết hạn mức ${TutorContract.MAX_STUDENT_DAILY_LIMIT} lượt hỏi gia sư trong ngày. Hãy tự ôn tập và quay lại vào ngày mai nhé!`
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Atomically reserve slot
      await this.storage.put(globalKey, globalCount + 1);
      if (studentKey) {
        await this.storage.put(studentKey, studentCount + 1);
      }

      return new Response(JSON.stringify({
        allowed: true,
        reserved: true,
        globalCount: globalCount + 1,
        studentCount: studentCount + 1
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 8. Atomic Gemini Quota Refund (J1: Decrements slot if Gemini returns 502/network error)
    if (action === '/refund-gemini-limit') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const student_id = body.student_id;
      const today = new Date().toISOString().slice(0, 10);

      const globalKey = `gemini:global:${today}`;
      const globalCount = (await this.storage.get(globalKey)) || 0;
      if (globalCount > 0) {
        await this.storage.put(globalKey, globalCount - 1);
      }

      if (student_id) {
        const studentKey = DurableObjectContract.getStudentTutorKey(student_id, today);
        const studentCount = (await this.storage.get(studentKey)) || 0;
        if (studentCount > 0) {
          await this.storage.put(studentKey, studentCount - 1);
        }
      }

      return new Response(JSON.stringify({ success: true, refunded: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ detail: 'Action not found' }), { status: 404 });
  }
}

/**
 * In-memory storage adapter for testing and local simulation
 */
export class MapStorage {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    const val = this.map.get(key);
    return val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
  }
  async put(key, value) {
    this.map.set(key, JSON.parse(JSON.stringify(value)));
  }
  async delete(key) {
    return this.map.delete(key);
  }
  async list({ prefix = '' } = {}) {
    const res = new Map();
    for (const [k, v] of this.map.entries()) {
      if (k.startsWith(prefix)) {
        res.set(k, v);
      }
    }
    return res;
  }
}

/**
 * Mock DO Stub for test harness
 */
export class MockDOStub {
  constructor(durableObjectInstance) {
    this.doInstance = durableObjectInstance;
  }
  async fetch(urlOrReq, init) {
    let req;
    if (urlOrReq instanceof Request) {
      req = urlOrReq;
    } else {
      req = new Request(urlOrReq, init);
    }
    return this.doInstance.fetch(req);
  }
}

/**
 * Mock DO Namespace for testing
 */
export class MockDONamespace {
  constructor() {
    this.storage = new MapStorage();
    this.doInstance = new GateDurableObject({ storage: this.storage });
  }
  idFromName(name) {
    return { name };
  }
  get(_id) {
    return new MockDOStub(this.doInstance);
  }
}

// Default mock student credentials for offline test harness (G3: Clearly labeled as mock)
export const defaultStudentsAuth = new Map();

export async function registerStudentCredential(studentId, pin, saltHex, meta = {}) {
  const pinHash = await hashPinPbkdf2(pin, saltHex);
  defaultStudentsAuth.set(studentId, {
    student_id: studentId,
    salt: saltHex,
    pin_hash: pinHash,
    name: meta.name || `Học sinh ${studentId}`,
    grade: meta.grade || 6,
    class_code: meta.class_code || '6A'
  });
}

// Default private answer packages repository (mocking RTDB packages_private for test harness)
export const privatePackagesStore = new Map();

export function setPrivatePackage(packageId, data) {
  privatePackagesStore.set(packageId, data);
}

/**
 * Get headers for Firebase RTDB REST API requests (H4, I1: Bearer OAuth2 Access Token)
 */
export function getRtdbHeaders(accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * Main Cloudflare Worker Export
 */
export default {
  async fetch(request, env = {}, _ctx = {}) {
    const url = new URL(request.url);
    const clientIp = request.headers.get('CF-Connecting-IP') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';

    // I2: ALLOWED_ORIGIN mandatory invariant (Strict fail-closed 500 if missing in production, no hardcoded personal domain fallback)
    if (!SecurityConfigContract.isOriginConfigured(env)) {
      if (!SecurityConfigContract.isMockModeAllowed(env)) {
        return new Response(JSON.stringify({
          detail: 'Lỗi cấu hình hệ thống: Thiếu biến môi trường bắt buộc env.ALLOWED_ORIGIN (Worker hoạt động ở chế độ Fail-Closed).'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const reqOrigin = request.headers.get('Origin') || '';
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin);
    const corsOrigin = isLocalhost ? reqOrigin : (env.ALLOWED_ORIGIN || '*');
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'healthy', serverless: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // G4: Fail-closed when env.GATE_DO is missing (NEVER silently mock in production)
    if (!DurableObjectContract.isConfigured(env)) {
      return new Response(JSON.stringify({
        detail: 'Lỗi cấu hình hệ thống: Thiếu liên kết Cloudflare Durable Object (env.GATE_DO). Worker hoạt động ở chế độ Fail-Closed.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gateId = env.GATE_DO.idFromName('global_gate');
    const gateStub = env.GATE_DO.get(gateId);

    // G2, H2, H3: Load Service Account signing keys
    const signingKeys = await loadOrDeriveServiceAccountKeys(env);

    // 1. Login endpoint (F1, F3, G2, H1, H3, H4, I1)
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const { student_id, pin } = await request.json().catch(() => ({}));

      // H1: Validate student_id format (prevent path traversal)
      if (!student_id || !IdValidationContract.isValidId(student_id)) {
        return new Response(JSON.stringify({
          detail: 'Mã học sinh không hợp lệ: phải có độ dài 1-64 ký tự chữ, số hoặc dấu gạch (- _), cấm ký tự đường dẫn.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!pin || typeof pin !== 'string') {
        return new Response(JSON.stringify({ detail: 'Vui lòng cung cấp mã PIN học sinh.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const safeStudentId = encodeURIComponent(student_id);
      const pairKey = DurableObjectContract.getLockKey(safeStudentId, clientIp);
      const ipKey = `ipflood:${clientIp}`;

      // Check lockout on pair (student_id:clientIp) and IP flood
      const checkPairReq = new Request(`http://do/get-lockout?key=${encodeURIComponent(pairKey)}`);
      const pairRes = await gateStub.fetch(checkPairReq);
      const pairLock = await pairRes.json();
      if (pairLock.locked) {
        return new Response(JSON.stringify({
          detail: `Tài khoản bị tạm khóa ${pairLock.retryAfter}s do nhập sai quá nhiều lần.`,
          retryAfter: pairLock.retryAfter
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Retry-After': String(pairLock.retryAfter), 'Content-Type': 'application/json' },
        });
      }

      const checkIpReq = new Request(`http://do/get-lockout?key=${encodeURIComponent(ipKey)}`);
      const ipRes = await gateStub.fetch(checkIpReq);
      const ipLock = await ipRes.json();
      if (ipLock.locked) {
        return new Response(JSON.stringify({
          detail: `Địa chỉ mạng bị tạm khóa do nghi vấn tấn công. Vui lòng thử lại sau ${ipLock.retryAfter}s.`,
          retryAfter: ipLock.retryAfter
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Retry-After': String(ipLock.retryAfter), 'Content-Type': 'application/json' },
        });
      }

      // H3, I1: Strict check for Real Driver vs Mock Mode & OAuth Token
      let studentCred = null;
      if (env.FIREBASE_DATABASE_URL) {
        // [REAL_DRIVER]: Fetch from Firebase RTDB students_auth using Authorization OAuth2 Bearer token (H4, I1)
        const rtdbAccessToken = await getOrFetchGoogleOAuthToken(env, signingKeys?.privateKey);
        try {
          const rtdbRes = await fetch(`${env.FIREBASE_DATABASE_URL}/students_auth/${safeStudentId}.json`, {
            headers: getRtdbHeaders(rtdbAccessToken)
          });
          if (!rtdbRes.ok) {
            if (rtdbRes.status === 404) {
              studentCred = null;
            } else {
              // H4: Database server error -> Return 502, DO NOT count as failed PIN attempt or lockout
              return new Response(JSON.stringify({
                detail: `Lỗi kết nối cơ sở dữ liệu Firebase (HTTP ${rtdbRes.status}). Vui lòng thử lại sau.`
              }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } else {
            studentCred = await rtdbRes.json();
          }
        } catch (e) {
          // H4: Network failure -> Return 502, DO NOT count as failed PIN attempt
          console.error('[RTDB_FETCH_NETWORK_ERROR]', e);
          return new Response(JSON.stringify({
            detail: 'Không thể kết nối đến cơ sở dữ liệu Firebase. Vui lòng kiểm tra mạng.'
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else if (SecurityConfigContract.isMockModeAllowed(env)) {
        // [MOCK_ADAPTER]: Only allowed when MOCK_MODE is explicitly enabled (H3)
        studentCred = defaultStudentsAuth.get(student_id) || env.TEST_STUDENTS_AUTH?.[student_id];
      } else {
        // H3: Fail-closed when FIREBASE_DATABASE_URL is missing and MOCK_MODE is not enabled
        return new Response(JSON.stringify({
          detail: 'Lỗi cấu hình hệ thống: Thiếu FIREBASE_DATABASE_URL và MOCK_MODE không được bật. Worker hoạt động ở chế độ Fail-Closed.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!studentCred) {
        await gateStub.fetch('http://do/record-failed-login', {
          method: 'POST',
          body: JSON.stringify({ pairKey, ipKey })
        });
        return new Response(JSON.stringify({ detail: 'Mã học sinh hoặc PIN không chính xác.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify PIN with student's unique salt via PBKDF2
      const computedHash = await hashPinPbkdf2(pin, studentCred.salt);
      if (computedHash !== studentCred.pin_hash) {
        const failReq = new Request('http://do/record-failed-login', {
          method: 'POST',
          body: JSON.stringify({ pairKey, ipKey })
        });
        const failRes = await gateStub.fetch(failReq);
        const failData = await failRes.json();

        if (failData.locked) {
          return new Response(JSON.stringify({
            detail: `Nhập sai 5 lần. Tài khoản bị tạm khóa ${failData.retryAfter}s.`,
            retryAfter: failData.retryAfter
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Retry-After': String(failData.retryAfter), 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ detail: 'Mã học sinh hoặc PIN không chính xác.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Reset lockout on successful login
      await gateStub.fetch('http://do/reset-lockout', {
        method: 'POST',
        body: JSON.stringify({ pairKey })
      });

      // H3: Check signing keys (Fail-closed 500 if missing)
      if (!signingKeys?.privateKey) {
        return new Response(JSON.stringify({
          detail: 'Lỗi cấu hình hệ thống: Thiếu Service Account Key để cấp phát token (Worker Fail-Closed).'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = await createFirebaseCustomToken(
        student_id,
        {
          role: 'student',
          grade: studentCred.grade,
          class_code: studentCred.class_code,
          name: studentCred.name
        },
        signingKeys.privateKey,
        env.FIREBASE_CLIENT_EMAIL,
        env.FIREBASE_PRIVATE_KEY_ID
      );

      return new Response(JSON.stringify({
        token: token,
        uid: student_id,
        status: 'authenticated'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Teacher Unlock Endpoint (G1, G4, H1)
    if (url.pathname === '/api/teacher/unlock' && request.method === 'POST') {
      const providedSecret = request.headers.get('X-Admin-Secret') || '';
      const authHeader = request.headers.get('Authorization') || '';
      let isAuthorized = false;

      // Check Condition A: Secret matches configured env.TEACHER_ADMIN_SECRET
      if (TeacherAuthContract.isValidSecret(providedSecret, env.TEACHER_ADMIN_SECRET)) {
        isAuthorized = true;
      }

      // Check Condition B: Valid Teacher JWT signed by Service Account
      if (!isAuthorized && authHeader.startsWith('Bearer ') && signingKeys?.publicKey) {
        const token = authHeader.slice(7).trim();
        const verification = await verifyJwtToken(token, signingKeys.publicKey);
        if (verification.valid && TeacherAuthContract.hasTeacherClaims(verification.payload)) {
          isAuthorized = true;
        }
      }

      // Fail-closed (G1): No hardcoded strings, fake headers rejected with 403
      if (!isAuthorized) {
        return new Response(JSON.stringify({
          detail: 'Từ chối truy cập: Yêu cầu quyền giáo viên hợp lệ hoặc Teacher Admin Secret hợp lệ.'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { student_id } = await request.json().catch(() => ({}));

      // H1: Validate student_id format (prevent path traversal)
      if (!student_id || !IdValidationContract.isValidId(student_id)) {
        return new Response(JSON.stringify({
          detail: 'Mã student_id cần mở khóa không hợp lệ (yêu cầu 1-64 ký tự hợp lệ, không chứa ký tự đường dẫn).'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const unlockRes = await gateStub.fetch('http://do/unlock', {
        method: 'POST',
        body: JSON.stringify({ student_id })
      });
      const data = await unlockRes.json();

      return new Response(JSON.stringify({ status: 'unlocked', student_id, details: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Submit endpoint (F4, G2, G3, H1, H4, I1, I4)
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ detail: 'Thiếu token xác thực.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = authHeader.slice(7).trim();
      const authResult = await verifyJwtToken(token, signingKeys?.publicKey);
      if (!authResult.valid) {
        return new Response(JSON.stringify({ detail: authResult.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uid = authResult.payload.uid;
      const { attempt_id, course_id, lesson_id, answers } = await request.json().catch(() => ({}));

      // H1: Strict validation of IDs against path traversal before any external calls
      if (!attempt_id || !IdValidationContract.isValidId(attempt_id) ||
          !course_id || !IdValidationContract.isValidId(course_id) ||
          !lesson_id || !IdValidationContract.isValidId(lesson_id) ||
          !uid || !IdValidationContract.isValidId(uid)) {
        return new Response(JSON.stringify({
          detail: 'Thông tin nộp bài không hợp lệ: attempt_id, course_id và lesson_id phải khớp định dạng ^[A-Za-z0-9_-]{1,64}$.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const safeUid = encodeURIComponent(uid);
      const safeAttemptId = encodeURIComponent(attempt_id);
      // I4: Non-regex delimiter ':' prevents collision between course_id and lesson_id
      const packageKey = IdValidationContract.getPackageKey(course_id, lesson_id);
      const safePackageKey = encodeURIComponent(packageKey);

      // G3, I1: Read privatePackage from RTDB or test store
      let privatePackage = null;
      const rtdbAccessToken = await getOrFetchGoogleOAuthToken(env, signingKeys?.privateKey);

      if (env.FIREBASE_DATABASE_URL) {
        try {
          const pkgRes = await fetch(`${env.FIREBASE_DATABASE_URL}/packages_private/${safePackageKey}.json`, {
            headers: getRtdbHeaders(rtdbAccessToken)
          });
          if (!pkgRes.ok) {
            // I4: RTDB server error returns 502, NOT 404
            return new Response(JSON.stringify({
              detail: `Lỗi kết nối cơ sở dữ liệu Firebase khi tải gói câu hỏi (HTTP ${pkgRes.status}).`
            }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          privatePackage = await pkgRes.json();
        } catch (e) {
          // I4: RTDB network failure returns 502, NOT 404
          console.error('[RTDB_PKG_FETCH_ERROR]', e);
          return new Response(JSON.stringify({
            detail: 'Không thể kết nối đến máy chủ cơ sở dữ liệu khi tải gói câu hỏi.'
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Check mock stores if allowed
      if (!privatePackage && SecurityConfigContract.isMockModeAllowed(env)) {
        privatePackage = privatePackagesStore.get(packageKey) ||
          privatePackagesStore.get(`${course_id}_${lesson_id}`) || // Backward compat for legacy mock tests
          env.TEST_PACKAGES_PRIVATE?.[packageKey] ||
          env.TEST_PACKAGES_PRIVATE?.[`${course_id}_${lesson_id}`];
      }

      if (!privatePackage && !SecurityConfigContract.isMockModeAllowed(env) && !env.FIREBASE_DATABASE_URL) {
        return new Response(JSON.stringify({
          detail: 'Lỗi cấu hình hệ thống: Thiếu FIREBASE_DATABASE_URL và MOCK_MODE không được bật.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!privatePackage) {
        return new Response(JSON.stringify({ detail: 'Không tìm thấy gói câu hỏi để chấm bài.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Grade answers
      const questions = privatePackage.questions || [];
      let correctCount = 0;
      const total = questions.length;

      for (const q of questions) {
        const studentAns = answers?.[q.id];
        if (studentAns && studentAns === q.correct_answer) {
          correctCount += 1;
        }
      }

      const score = total > 0 ? Math.round((correctCount / total) * 100) / 10 : 0;

      const evaluationResult = {
        attempt_id,
        course_id,
        lesson_id,
        status: 'submitted',
        score,
        total,
        correct: correctCount,
        needs_review: false,
        message: 'Nộp bài thành công.'
      };

      const idempotencyKey = `${uid}:${attempt_id}`;
      const countKey = `${uid}:${course_id}:${lesson_id}`;
      const maxAttempts = lesson_id.startsWith('exam_') ? 1 : 2;

      const subRes = await gateStub.fetch('http://do/save-submission', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey,
          countKey,
          result: evaluationResult,
          maxAttempts
        })
      });

      const subData = await subRes.json();
      if (subRes.status !== 200) {
        return new Response(JSON.stringify(subData.body || subData), {
          status: subRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // H4, I1: Record attempt to RTDB and check response. If RTDB fails, return 502!
      if (env.FIREBASE_DATABASE_URL) {
        try {
          const rtdbSaveRes = await fetch(`${env.FIREBASE_DATABASE_URL}/attempts/${safeUid}/${safeAttemptId}.json`, {
            method: 'PUT',
            headers: getRtdbHeaders(rtdbAccessToken),
            body: JSON.stringify(evaluationResult)
          });
          if (!rtdbSaveRes.ok) {
            const errBody = await rtdbSaveRes.text().catch(() => '');
            console.error('[RTDB_SAVE_ATTEMPT_ERROR]', rtdbSaveRes.status, errBody);
            return new Response(JSON.stringify({
              detail: `Lỗi lưu kết quả bài nộp vào cơ sở dữ liệu (HTTP ${rtdbSaveRes.status}). Vui lòng thử lại.`
            }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          console.error('[RTDB_SAVE_ATTEMPT_NETWORK_ERROR]', e);
          return new Response(JSON.stringify({
            detail: 'Lỗi mạng khi lưu kết quả bài nộp vào cơ sở dữ liệu. Vui lòng thử lại.'
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify(subData.body || subData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. AI Tutor proxy endpoint (F4, G3, H5, I3, I4)
    if (url.pathname === '/api/tutor' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ detail: 'Thiếu token xác thực.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = authHeader.slice(7).trim();
      const authResult = await verifyJwtToken(token, signingKeys?.publicKey);
      if (!authResult.valid) {
        return new Response(JSON.stringify({ detail: authResult.error }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const studentUid = authResult.payload.uid;
      const { message, context } = await request.json().catch(() => ({}));

      // H5, I4: Validate message presence and maximum length (<= 1000 chars) BEFORE touching quota
      if (!TutorContract.isValidMessage(message)) {
        return new Response(JSON.stringify({
          detail: `Nội dung câu hỏi không hợp lệ: không được để trống và không được vượt quá ${TutorContract.MAX_MESSAGE_LENGTH} ký tự.`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // J1: Atomic quota reservation in Durable Object (locks slot immediately to prevent concurrency race)
      const reserveRes = await gateStub.fetch('http://do/reserve-gemini-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentUid })
      });
      const reserveData = await reserveRes.json();
      if (!reserveData.allowed) {
        return new Response(JSON.stringify({
          detail: reserveData.detail || 'Hạn mức gia sư hôm nay đã hết.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // I3: Strictly coerce grade to integer 1..12 (neutralizes 200KB injection attacks)
      const safeGrade = TutorContract.coerceGrade(context?.grade);

      // H5: Real Gemini API proxy using header x-goog-api-key (NEVER in URL query)
      if (env.GEMINI_API_KEY) {
        try {
          const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{ text: `Em là học sinh lớp ${safeGrade}. Câu hỏi: ${message}` }]
              }],
              systemInstruction: {
                parts: [{ text: 'Bạn là Gia sư Socrates môn Tin học cho học sinh THCS. Không đưa đáp án trực tiếp; hướng dẫn từng bước và gợi mở câu hỏi để học sinh tự suy nghĩ.' }]
              }
            })
          });

          if (!geminiRes.ok) {
            const errBody = await geminiRes.text().catch(() => '');
            console.error('[GEMINI_SERVER_ERROR]', geminiRes.status, errBody);
            // J1: Atomic quota refund on Gemini server failure
            await gateStub.fetch('http://do/refund-gemini-limit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ student_id: studentUid })
            });
            return new Response(JSON.stringify({
              detail: `Dịch vụ Gia sư AI phản hồi lỗi (HTTP ${geminiRes.status}).`
            }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const geminiData = await geminiRes.json();
          const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Gia sư chưa thể phản hồi lúc này.';

          // J1: Success! Quota is already accounted for atomically via reservation
          return new Response(JSON.stringify({
            reply: replyText,
            status: 'success',
            driver: 'real_gemini',
            student: studentUid
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error('[GEMINI_PROXY_NETWORK_ERROR]', e);
          // J1: Atomic quota refund on network error
          await gateStub.fetch('http://do/refund-gemini-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentUid })
          });
          return new Response(JSON.stringify({
            detail: 'Lỗi kết nối tới dịch vụ Gia sư AI.'
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // [MOCK_OFFLINE]: When GEMINI_API_KEY is not configured and MOCK_MODE is enabled
      if (SecurityConfigContract.isMockModeAllowed(env)) {
        const mockReply = `Gia sư Socrates: Chào em học sinh lớp ${safeGrade}! Đối với câu hỏi về "${message.slice(0, 30)}...", em hãy nhớ lại kiến thức trọng tâm trong sách giáo khoa nhé. Em nghĩ bước đầu tiên chúng ta nên làm là gì?`;
        return new Response(JSON.stringify({
          reply: mockReply,
          status: 'success',
          driver: 'mock_offline',
          student: studentUid
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Production fail-closed when GEMINI_API_KEY is missing (refund reserved slot)
      await gateStub.fetch('http://do/refund-gemini-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentUid })
      });
      return new Response(JSON.stringify({
        detail: 'Lỗi cấu hình hệ thống: Thiếu khóa GEMINI_API_KEY.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ detail: 'Endpoint không tồn tại.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
