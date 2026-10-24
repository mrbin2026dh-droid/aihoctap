const fs = require('fs');

const code = fs.readFileSync('frontend/app.js', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. Regex function declaration parser
const fnRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
let m;
const functionCounts = {};
while ((m = fnRegex.exec(code)) !== null) {
  const name = m[1];
  functionCounts[name] = (functionCounts[name] || 0) + 1;
}

const duplicateFunctions = Object.entries(functionCounts).filter(([, count]) => count > 1);
console.log(`📊 Total Top-Level/Inner Declared Functions: ${Object.keys(functionCounts).length}`);
if (duplicateFunctions.length > 0) {
  console.warn('⚠️ Duplicate Functions Detected:', duplicateFunctions);
} else {
  console.log('✅ Duplicate Functions: 0 (PASS - No function shadowing/overwriting)');
}

// 2. Inspect DOM getElementById queries against index.html
const idRegex = /document\.getElementById\(['"]([a-zA-Z0-9_-]+)['"]\)/g;
const usedIds = new Set();
while ((m = idRegex.exec(code)) !== null) {
  usedIds.add(m[1]);
}

const missingIds = [];
for (const id of usedIds) {
  const pattern1 = `id="${id}"`;
  const pattern2 = `id='${id}'`;
  if (!html.includes(pattern1) && !html.includes(pattern2)) {
    missingIds.push(id);
  }
}

console.log(`📊 Total getElementById references: ${usedIds.size}`);
console.log('🔍 IDs not statically present in index.html:', missingIds);

// 3. Check for unhandled chained property accesses like document.getElementById('x').value without null check
const unsafeChainedCalls = [];
const lines = code.split('\n');
lines.forEach((line, idx) => {
  const match = line.match(/document\.getElementById\(['"]([^'"]+)['"]\)\.([a-zA-Z0-9_$]+)/);
  if (match) {
    const id = match[1];
    const prop = match[2];
    const isStatic = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    if (!isStatic) {
      unsafeChainedCalls.push({ line: idx + 1, id, prop, code: line.trim() });
    }
  }
});

if (unsafeChainedCalls.length > 0) {
  console.warn('⚠️ Potentially Unsafe Chained DOM Access on Dynamic Elements:', unsafeChainedCalls);
} else {
  console.log('✅ Unsafe Chained DOM Access: 0 (All chained IDs are statically defined in index.html)');
}

// 4. Check HTML DOM Tag Balance in index.html
const tags = ['div', 'section', 'main', 'header', 'nav', 'form', 'footer'];
console.log('\n--- HTML DOM Tag Balance Check ---');
tags.forEach(tag => {
  const openRegex = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi');
  const closeRegex = new RegExp(`</${tag}>`, 'gi');
  const openCount = (html.match(openRegex) || []).length;
  const closeCount = (html.match(closeRegex) || []).length;
  const diff = openCount - closeCount;
  if (diff === 0) {
    console.log(`✅ <${tag}>: ${openCount} open, ${closeCount} close (Diff: 0)`);
  } else {
    console.error(`❌ <${tag}>: ${openCount} open, ${closeCount} close (Diff: ${diff})`);
  }
});
