// @ts-check
// Hiệu ứng "đang gõ" cho câu trả lời của Gia sư AI: hiện dần từng chữ (có con trỏ), xong thì định dạng Markdown.
// Tôn trọng prefers-reduced-motion: hiện ngay toàn bộ.
import { renderMarkdown } from './dom.js';

/**
 * @param {HTMLElement} target ô tin nhắn của AI
 * @param {string} text câu trả lời (Markdown)
 * @param {() => void} [onTick] gọi mỗi nhịp (ví dụ cuộn khung chat xuống cuối)
 * @returns {Promise<void>}
 */
export function typeOut(target, text, onTick = () => {}) {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !text) { renderMarkdown(target, text); onTick(); return Promise.resolve(); }
  target.replaceChildren();
  const p = document.createElement('p'); p.className = 'typing'; target.append(p);
  target.setAttribute('aria-busy', 'true');
  const plain = text.replace(/\*\*|__|`/g, '');
  const steps = Math.min(plain.length, 60), per = Math.max(1, Math.ceil(plain.length / steps));   // tối đa ~1 giây (trước 2,5 giây làm em tưởng Gia sư chậm)
  let i = 0;
  return new Promise(resolve => {
    const tick = () => {
      i = Math.min(plain.length, i + per);
      p.textContent = plain.slice(0, i); onTick();
      if (i < plain.length) setTimeout(tick, 16);
      else { renderMarkdown(target, text); target.removeAttribute('aria-busy'); onTick(); resolve(); }
    };
    tick();
  });
}
