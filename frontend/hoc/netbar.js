// @ts-check
// Thanh tiến trình mỏng ở mép trên trang: hiện khi có yêu cầu tới máy chủ (Worker, Google Sheet, danh mục bài) chạy quá 0,4 giây,
// để học sinh và giáo viên biết hệ thống đang xử lý. Bỏ qua Firebase (đồng bộ ngầm liên tục) để thanh không nhấp nháy.
const SKIP = /firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|googleapis\.com\/v1\/token|\/__/;
let active = 0;
/** @type {ReturnType<typeof setTimeout>|undefined} */ let timer;
function bar() {
  let el = document.getElementById('net-bar');
  if (!el) { el = document.createElement('div'); el.id = 'net-bar'; el.className = 'net-bar'; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', 'Đang xử lý'); el.hidden = true; el.append(document.createElement('i')); document.body.append(el); }
  return el;
}
function update() {
  clearTimeout(timer);
  if (active > 0) timer = setTimeout(() => { if (active > 0) { const b = bar(); b.hidden = false; document.body.classList.add('is-net-busy'); } }, 400);
  else { const b = document.getElementById('net-bar'); if (b) b.hidden = true; document.body.classList.remove('is-net-busy'); }
}
const orig = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const track = !SKIP.test(url);
  if (track) { active++; update(); }
  try { return await orig(input, init); }
  finally { if (track) { active = Math.max(0, active - 1); update(); } }
};
export const busyCount = () => active;
