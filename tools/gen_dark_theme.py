#!/usr/bin/env python3
"""Sinh khối giao diện tối cho frontend/hoc/styles.css từ chính các luật màu sáng.
Chạy: python3 tools/gen_dark_theme.py   (ghi lại khối giữa hai dấu DARK-THEME). Sau đó chạy tests/audit_student_ui.cjs.
Quy tắc: nền sáng -> nền tối nâng nhẹ; chữ tối -> chữ sáng; màu thương hiệu (nền) sáng lên để chữ trắng vẫn đủ tương phản."""
import re, colorsys, pathlib
P = pathlib.Path(__file__).resolve().parents[1] / 'frontend/hoc/styles.css'
BEGIN, END = '/* DARK-THEME:BEGIN */', '/* DARK-THEME:END */'
TOK_VARS = '--ink:#fafafa;--muted:#a1a1aa;--paper:#09090b;--blue:#2d7a6c;--line:#27272a;--surface:#111113;--danger:#ff9f95;--brand-text:#93d4c3;--auth-btn-bg:#fafafa;--auth-btn-fg:#09090b;--control:#71717a;--soft:#1c1c1f;color-scheme:dark'
EXTRA = ('.student-app .update-btn{border-color:#4ac0a8;color:#4ac0a8}'
         '.student-app .lesson-open,.student-app .course-card button{background:var(--surface);color:var(--ink);border-color:var(--control)}'
         '.student-app button.primary:hover{background:#e4e4e7;color:#09090b;border-color:#e4e4e7}'
         '.student-app .lesson-open:hover{background:#fafafa;color:#09090b;border-color:#fafafa}'
         '.student-app .result-title .ic{color:#4ade80}'
         '.student-app .auth-btn:hover,.student-app .btn-login:hover{background:#e4e4e7;color:#09090b;border-color:#e4e4e7}'
         '.student-app .auth-btn-alt:hover{background:#1c1c1f;color:var(--ink);border-color:var(--ink)}'
         '.student-app .connection{color:#4ade80}.student-app .connection.is-offline{color:#fbbf24}')
COLOR = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)')
def hexrgb(h):
    h = h[1:]
    if len(h) == 3: h = ''.join(c*2 for c in h)
    return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))
def tohex(r, g, b): return '#%02x%02x%02x' % tuple(round(max(0, min(1, v))*255) for v in (r, g, b))
def mapc(val, role):
    if val.startswith('rgb'):
        nums = [float(x) for x in re.findall(r'[\d.]+', val)]
        if role == 'shadow': return 'rgba(0,0,0,.55)'
        r, g, b = (n/255 for n in nums[:3]); a = nums[3] if len(nums) > 3 else 1
    else:
        r, g, b = hexrgb(val); a = 1
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if role == 'bg':
        if l < .5: nl = .28 + l*.15
        elif l > .985: return 'var(--surface)'
        else: nl = .16 + (1-l)*.2
        s *= (.12 if l > .6 else .75)
    elif role == 'border':
        nl = .28 + l*.12 if l < .5 else .45 - l*.22
        s *= .5
    else:  # fg
        if l >= .75 and s < .2: return val          # chữ trắng/nhạt trên nền thương hiệu: giữ
        nl = .92 - l*.5 if l < .75 else .8
        s *= .85
    nr, ng, nb = colorsys.hls_to_rgb(h, nl, s)
    out = tohex(nr, ng, nb)
    return out if a >= 1 else 'rgba(%d,%d,%d,%.2f)' % (nr*255, ng*255, nb*255, a)
def role_of(prop):
    p = prop.strip().lower()
    if p == 'box-shadow' or p == 'text-shadow': return 'shadow'
    if p.startswith('border') or p.startswith('outline'): return 'border'
    if p.startswith('background'): return 'bg'
    if p in ('color', 'fill', 'stroke', 'caret-color', 'text-decoration-color', 'accent-color'): return 'fg'
    return None
def parse(css, i=0, depth=0):
    rules = []
    n = len(css)
    while i < n:
        while i < n and css[i] in ' \n\t\r': i += 1
        if i >= n or css[i] == '}': return rules, i+1
        if css.startswith('/*', i):
            i = css.index('*/', i)+2; continue
        j = css.index('{', i); pre = css[i:j].strip()
        if pre.startswith('@media'):
            inner, k = parse(css, j+1, depth+1); rules.append(('media', pre, inner)); i = k
        else:
            d = 1; k = j+1
            while d:
                c = css[k]; d += (c == '{') - (c == '}'); k += 1
            body = css[j+1:k-1]
            if not pre.startswith('@'): rules.append(('rule', pre, body))
            i = k
    return rules, i
def dark_decls(body):
    out = []
    for d in re.split(r';(?![^()]*\))', body):
        if ':' not in d: continue
        prop, val = d.split(':', 1); role = role_of(prop)
        if not role: continue
        imp = ' !important' if '!important' in val else ''
        v = val.replace('!important', '').strip()
        if role == 'fg' and 'var(--blue)' in v: out.append(f'{prop.strip()}:var(--brand-text){imp}'); continue
        if 'var(--' in v and not COLOR.search(v): continue
        nv = COLOR.sub(lambda m: mapc(m.group(0), role), v)
        if nv != v: out.append(f'{prop.strip()}:{nv}{imp}')
    return ';'.join(out)
def emit(rules, wrap):
    res = []
    for r in rules:
        if r[0] == 'rule':
            dd = dark_decls(r[2])
            if dd: res.append((wrap, f'{r[1]}{{{dd}}}'))
        else:
            m = re.match(r'@media\s*(.*)', r[1]); cond = m.group(1).strip()
            if cond.startswith('(') and ',' not in cond and 'prefers-color-scheme' not in cond:
                res.extend(emit(r[2], f'{wrap} and {cond}'))
    return res
css = P.read_text(encoding='utf-8')
if BEGIN in css: css = css[:css.index(BEGIN)].rstrip()+'\n'
rules, _ = parse(css)
items = emit(rules, '')
groups = {}
for w, rule in items: groups.setdefault(w, []).append(rule)
def prefixed(rule, pre):
    sel, body = rule.split('{', 1)
    sels = [s.strip() for s in sel.split(',')]
    return ','.join(f'{pre} {s}' for s in sels) + '{' + body
def render(pre, wrapmedia):
    out = []
    for w, rs in groups.items():
        out.append('@media (prefers-color-scheme:dark)%s{\n%s\n}' % (w, '\n'.join(rs))) if False else None
    return out
auto_pre = ':where(:root:not([data-theme=light]))'
expl_pre = ':where(:root[data-theme=dark])'
def block(pre, tok_sel):
    parts = [tok_sel + '{' + TOK_VARS + '}']
    for w, rs in groups.items():
        inner = '\n'.join(prefixed(r, pre) for r in rs)
        parts.append(('@media (max-width:0)' if False else '') + (('@media ' + w[5:] + '{\n' + inner + '\n}') if w else inner))
    parts.append(prefixed(EXTRA.replace('}.', '}\n.'), pre) if False else '\n'.join(prefixed(r + '}', pre) for r in EXTRA.split('}') if r))
    return '\n'.join(parts)
auto = '@media (prefers-color-scheme:dark){\n' + block(auto_pre, ':root:not([data-theme=light]),:root:not([data-theme=light]) .student-app') + '\n}'
expl = block(expl_pre, ':root[data-theme=dark],:root[data-theme=dark] .student-app')
P.write_text(css + '\n' + BEGIN + '\n' + auto + '\n' + expl + '\n' + END + '\n', encoding='utf-8', newline='')
print('rules:', len(items), 'groups:', len(groups))
