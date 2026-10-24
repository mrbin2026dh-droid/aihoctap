// @ts-check
/** @type {Promise<IDBDatabase>|null} */
let connection = null;
const STORES = ['meta', 'packages', 'drafts', 'outbox'];
/** @returns {Promise<IDBDatabase>} */
function open() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('aisgk-student-pwa', 1);
      request.onupgradeneeded = () => {
        for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); connection = null; };
        resolve(request.result);
      };
      request.onerror = () => { connection = null; reject(request.error || new Error('Không mở được bộ nhớ trên máy.')); };
      request.onblocked = () => { connection = null; reject(new Error('Đóng các cửa sổ SGK khác rồi thử lại.')); };
    });
  }
  return connection;
}
/** @template T @param {string} store @param {IDBTransactionMode} mode @param {(s:IDBObjectStore)=>IDBRequest<T>} action @returns {Promise<T>} */
async function transact(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || new Error('Không lưu được trên máy. Có thể bộ nhớ đã đầy.'));
    tx.onerror = () => reject(tx.error || new Error('Không đọc được bộ nhớ trên máy.'));
  });
}
/** @template T @param {string} store @param {IDBValidKey} key @returns {Promise<T|undefined>} */
export function get(store, key) { return transact(store, 'readonly', s => s.get(key)); }
/** @param {string} store @param {IDBValidKey} key @param {object|string|number} value */
export async function put(store, key, value) { await transact(store, 'readwrite', s => s.put(value, key)); }
/** @param {string} store @param {IDBValidKey} key */
export async function remove(store, key) { await transact(store, 'readwrite', s => s.delete(key)); }
/** @template T @param {string} store @returns {Promise<T[]>} */
export function all(store) { return transact(store, 'readonly', s => s.getAll()); }
/** @param {import('./contracts').Lesson} lesson */
export function packageKey(lesson) { return `${lesson.course_id}/${lesson.lesson_id}/${lesson.version}`; }
/** @param {string} uid @param {import('./contracts').Lesson} lesson */
export function draftKey(uid, lesson) { return `${uid}/${packageKey(lesson)}`; }
