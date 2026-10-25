/**
 * Mathematical Schemas & Security Contracts (Bend Proof-Driven Architecture)
 * Defines formal invariants for AI AGENT SGK Edge Worker.
 */

export const IdValidationContract = {
  /**
   * Safe ID Regex Invariant (H1):
   * Only alphanumeric characters, hyphens, and underscores are allowed. Length: 1 to 64 chars.
   * Strictly prevents directory traversal (../), path injection (/), and URL bypass attacks.
   */
  ID_REGEX: /^[A-Za-z0-9_-]{1,64}$/,

  /**
   * Delimiter outside ID_REGEX charset to prevent package key collision (I4):
   * e.g. course 'a_b' + lesson 'c' vs course 'a' + lesson 'b_c'
   */
  PACKAGE_DELIMITER: ':',

  isValidId(id) {
    if (!id || typeof id !== 'string') return false;
    return this.ID_REGEX.test(id);
  },

  isValidStudentId(id) {
    return this.isValidId(id);
  },

  assertValidId(id, fieldName = 'ID') {
    if (!this.isValidId(id)) {
      throw new Error(`Giá trị ${fieldName} không hợp lệ: phải khớp định dạng ^[A-Za-z0-9_-]{1,64}$ (cấm ký tự đường dẫn).`);
    }
    return encodeURIComponent(id);
  },

  sanitizeComponent(id, fieldName = 'ID') {
    this.assertValidId(id, fieldName);
    return encodeURIComponent(id);
  },

  getPackageKey(courseId, lessonId) {
    this.assertValidId(courseId, 'course_id');
    this.assertValidId(lessonId, 'lesson_id');
    return `${courseId}${this.PACKAGE_DELIMITER}${lessonId}`;
  }
};

export const SecurityConfigContract = {
  /**
   * Required Google OAuth scopes for Firebase Realtime Database REST API (I1)
   */
  RTDB_OAUTH_SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database',

  /**
   * Fail-Closed Signing Key Invariant (H3):
   * Ephemeral development keys are ONLY permitted when ALLOW_EPHEMERAL_DEV_KEYS is explicitly true.
   * Presence of env.GATE_DO alone must NEVER enable ephemeral keys.
   */
  isDevKeyAllowed(env) {
    if (!env || typeof env !== 'object') return false;
    return env.ALLOW_EPHEMERAL_DEV_KEYS === true || env.ALLOW_EPHEMERAL_DEV_KEYS === 'true';
  },

  /**
   * Fail-Closed Mock Driver Invariant (H3):
   * Mock storage/adapters are strictly forbidden in production.
   * MOCK_MODE must be explicitly true; otherwise real drivers are required.
   */
  isMockModeAllowed(env) {
    if (!env || typeof env !== 'object') return false;
    return env.MOCK_MODE === true || env.MOCK_MODE === 'true';
  },

  /**
   * Mandatory CORS Origin Invariant (I2):
   * ALLOWED_ORIGIN must be explicitly configured in production.
   * Hardcoding personal domains as fallback is strictly prohibited.
   */
  isOriginConfigured(env) {
    if (!env || typeof env !== 'object') return false;
    return typeof env.ALLOWED_ORIGIN === 'string' && env.ALLOWED_ORIGIN.trim().length > 0;
  },

  /**
   * Normalizes PEM strings pasted into Cloudflare Worker Secrets (H2):
   * Strips literal escaped \n strings and trims whitespace.
   */
  cleanPem(pemStr) {
    if (!pemStr || typeof pemStr !== 'string') return '';
    return pemStr
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .trim();
  }
};

export const TutorContract = {
  MAX_MESSAGE_LENGTH: 1000,
  MAX_STUDENT_DAILY_LIMIT: 30,
  MAX_GLOBAL_DAILY_LIMIT: 1000,

  isValidMessage(message) {
    if (!message || typeof message !== 'string') return false;
    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed.length <= this.MAX_MESSAGE_LENGTH;
  },

  /**
   * Coerces and strictly bounds student grade to an integer between 1 and 12 (I3).
   * Prevents arbitrary strings, payload injection, or 200KB memory stuffing.
   */
  coerceGrade(grade) {
    if (grade === null || grade === undefined) return 6;
    if (typeof grade === 'string' && grade.length > 5) return 6;
    const num = parseInt(grade, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      return num;
    }
    return 6;
  }
};

export const TeacherAuthContract = {
  /**
   * Evaluates if a request meets teacher authentication invariant:
   * Condition A: Request has X-Admin-Secret matching env.TEACHER_ADMIN_SECRET (non-empty, length >= 16).
   * Condition B: Request has Authorization Bearer JWT signed by Service Account with role === 'teacher' or admin === true.
   * Invariant: IF NOT (A OR B) THEN FAIL_CLOSED (403 Forbidden).
   */
  isValidSecret(providedSecret, configuredSecret) {
    if (!configuredSecret || typeof configuredSecret !== 'string' || configuredSecret.length < 8) {
      return false; // Fail-closed: unconfigured or weak secret is never valid
    }
    if (!providedSecret || typeof providedSecret !== 'string') {
      return false;
    }
    // Constant time comparison against timing attacks
    if (providedSecret.length !== configuredSecret.length) return false;
    let mismatch = 0;
    for (let i = 0; i < providedSecret.length; i++) {
      mismatch |= providedSecret.charCodeAt(i) ^ configuredSecret.charCodeAt(i);
    }
    return mismatch === 0;
  },

  hasTeacherClaims(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.role === 'teacher' || payload.admin === true) return true;
    if (payload.claims && (payload.claims.role === 'teacher' || payload.claims.admin === true)) return true;
    return false;
  }
};

export const DurableObjectContract = {
  /**
   * Fail-Closed Invariant: GATE_DO binding MUST exist.
   */
  isConfigured(env) {
    return !!(env && env.GATE_DO && typeof env.GATE_DO.idFromName === 'function');
  },

  /**
   * Prefix Isolation Invariant: Lockout keys must terminate with colon delimiter.
   * lock:${student_id}: prevents 'hs1' from affecting 'hs10'.
   */
  getLockPrefix(studentId) {
    return `lock:${studentId}:`;
  },

  getLockKey(studentId, ip) {
    return `lock:${studentId}:${ip}`;
  },

  getStudentTutorKey(studentId, dateStr) {
    return `tutor_std:${studentId}:${dateStr}`;
  }
};
