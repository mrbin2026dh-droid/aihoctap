// @ts-check
const remote = location.hostname === 'mrbin2026dh-droid.github.io';
export const API_BASE = remote ? 'https://aisgk.onrender.com/api' : `${location.origin}/api`;
export class ApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) { super(message); this.status = status; }
}
/** @template T @param {string} path @param {{method?:string,body?:object,token?:string,timeout?:number}} [options] @returns {Promise<T>} */
export async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 45000);
  /** @type {Record<string,string>} */ const headers = { Accept:'application/json' };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  try {
    const response = await fetch(`${API_BASE}${path}`, {method:options.method || 'GET', headers, body:options.body ? JSON.stringify(options.body) : undefined, cache:'no-store', signal:controller.signal, credentials:'omit'});
    const data = await response.json().catch(() => ({detail:'Phản hồi máy chủ không hợp lệ.'}));
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : 'Dữ liệu chưa hợp lệ. Kiểm tra lại nội dung.';
      throw new ApiError(response.status, detail);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Chưa kết nối được máy chủ. Bài đã lưu trên máy vẫn được giữ. Hãy thử lại khi có mạng.');
  } finally { clearTimeout(timer); }
}
/** @param {import('./contracts').Lesson} lesson */
export async function verifyPackage(lesson) {
  if (lesson.schema_version !== 1 || !Array.isArray(lesson.questions) || !/^[a-f0-9]{64}$/.test(lesson.version)) throw new Error('Phiên bản bài học chưa được hỗ trợ.');
  const { version, ...content } = lesson;
  const serialized = JSON.stringify(content, function(_key, value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    return value;
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== version) throw new Error('Bài tải chưa toàn vẹn. Bản cũ vẫn được giữ.');
  return lesson;
}
