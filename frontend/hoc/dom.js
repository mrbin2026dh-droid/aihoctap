// @ts-check
/** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} [text] @param {string} [className] */
export function el(tag, text = '', className = '') { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; }
/** @param {string} text @param {()=>void|Promise<void>} action @param {string} [className] */
export function button(text, action, className = '') {
  const node = el('button', text, className); node.type = 'button';
  node.addEventListener('click', () => { Promise.resolve(action()).catch(error => notify(error.message, true)); });
  return node;
}
/** @param {string} text @param {boolean} [error] */
export function notify(text, error = false) { const node = document.getElementById('status'); if (node) {node.textContent = text; node.classList.toggle('error', error);} }
/** Safe restricted markdown: never parses raw HTML, links, embeds or event handlers.
 * @param {HTMLElement} container @param {string} markdown */
export function renderMarkdown(container, markdown) {
  container.replaceChildren();
  let code = false;
  /** @type {string[]} */
  let codeLines = [];
  const flushCode = () => {container.append(el('pre', codeLines.join('\n'))); codeLines = [];};
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {if (code) flushCode(); code = !code; continue;}
    if (code) {codeLines.push(line); continue;}
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {container.append(el(heading[1].length <= 2 ? 'h2' : 'h3', heading[2].replace(/\*\*/g,''))); continue;}
    if (/^---+$/.test(line.trim())) {container.append(el('hr')); continue;}
    if (line.startsWith('>')) {container.append(el('blockquote', line.slice(1).replace(/\*\*/g,'').trim())); continue;}
    const paragraph = el('p');
    const chunks = line.split(/(\*\*[^*]+\*\*)/g);
    for (const chunk of chunks) paragraph.append(chunk.startsWith('**') && chunk.endsWith('**') ? el('strong', chunk.slice(2,-2)) : document.createTextNode(chunk));
    container.append(paragraph);
  }
  if (codeLines.length) flushCode();
}
