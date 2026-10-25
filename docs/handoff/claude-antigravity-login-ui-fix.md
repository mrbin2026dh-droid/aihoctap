# Claude → Antigravity: sửa UI đăng nhập/tài khoản (U1–U6)
Đọc AGENTS.md (mục F, G, I). Không deploy trước khi Claude ACCEPT.

## 1. Hộp thoại dùng chung — `frontend/hoc/dom.js` (thêm), dùng cho app.js và teacher.js
Thêm vào `index.html` và `teacher.html` (cuối `<body>`):
```html
<dialog id="msg-dialog" class="msg-dialog" aria-labelledby="msg-title" aria-describedby="msg-body">
  <form method="dialog" id="msg-form">
    <h2 id="msg-title"></h2><p id="msg-body"></p>
    <label id="msg-field" hidden><span id="msg-field-label"></span><input id="msg-input" type="text" autocomplete="off"></label>
    <p id="msg-error" class="field-error" role="alert" hidden></p>
    <div class="msg-actions"><button id="msg-cancel" type="button">Hủy</button><button id="msg-ok" class="primary" type="submit">Đồng ý</button></div>
  </form>
</dialog>
```
```js
// dom.js — trả Promise<boolean|string|null>
export function dialogBox({title, body, kind='notice', okText='Đồng ý', cancelText='Hủy', danger=false, field=null, validate=null}) {
  const d = document.getElementById('msg-dialog'), $ = id => document.getElementById(id);
  $('msg-title').textContent = title; $('msg-body').textContent = body;
  $('msg-ok').textContent = okText; $('msg-cancel').textContent = cancelText;
  $('msg-cancel').hidden = kind === 'notice';
  $('msg-ok').classList.toggle('danger-btn', danger);
  $('msg-field').hidden = !field; $('msg-error').hidden = true;
  if (field) { $('msg-field-label').textContent = field.label; $('msg-input').value = field.value || ''; }
  const opener = document.activeElement;
  return new Promise(resolve => {
    const done = v => { d.close(); cleanup(); opener?.focus?.(); resolve(v); };
    const onSubmit = e => { e.preventDefault();
      if (field) { const v = $('msg-input').value.trim(); const err = validate ? validate(v) : '';
        if (err) { $('msg-error').textContent = err; $('msg-error').hidden = false; $('msg-input').setAttribute('aria-invalid','true'); return; }
        return done(v); }
      done(true); };
    const onCancel = () => done(kind === 'notice' ? true : (field ? null : false));
    const cleanup = () => { $('msg-form').removeEventListener('submit', onSubmit); $('msg-cancel').removeEventListener('click', onCancel); d.removeEventListener('cancel', onCancel); $('msg-input').removeAttribute('aria-invalid'); };
    $('msg-form').addEventListener('submit', onSubmit); $('msg-cancel').addEventListener('click', onCancel); d.addEventListener('cancel', onCancel);
    d.showModal(); ($('msg-field').hidden ? $('msg-cancel').hidden ? $('msg-ok') : $('msg-cancel') : $('msg-input')).focus();
  });
}
export const confirmBox = o => dialogBox({kind:'confirm', ...o});
export const noticeBox = o => dialogBox({kind:'notice', ...o});
```
Thay trong `teacher.js` (hàm cha thêm `async`):
- ~174: `if (!await confirmBox({title:'Xóa khóa API', body:`Xóa khóa …${key.key_suffix}? Không thể hoàn tác.`, okText:'Xóa', danger:true})) return;`
- ~425/427: `const newName = await dialogBox({kind:'prompt', title:'Sửa học sinh', body:'Nhập họ và tên mới.', field:{label:'Họ và tên', value:s.name}, validate:v=>v.length<2?'Họ và tên tối thiểu 2 ký tự.':''}); if (newName===null) return;` tương tự `newClass` với `validate: v=>/^[A-Za-z0-9._-]{1,16}$/.test(v)?'':'Mã lớp gồm chữ, số, tối đa 16 ký tự.'`.
- ~443 đặt lại PIN, ~460 khóa/mở khóa, ~475 xóa học sinh: `confirmBox` với tiêu đề ngắn ("Đặt lại mã PIN", "Khóa tài khoản", "Xóa học sinh"), nội dung: `Học sinh: ${s.name} (${s.id}).` + "Thao tác xóa không thể hoàn tác." Chỉ dòng xóa dùng `danger:true`.
- Kết quả thành công/lỗi từ API: `await noticeBox({title:'Hoàn tất', body:'Đã đổi mã PIN.'})` / `title:'Chưa thực hiện được'`, body = thông điệp tiếng Việt từ bảng ánh xạ (mục 4).

## 2. Loading (U2) — helper trong `dom.js`
```js
export async function withBusy(btn, busyText, fn) {
  const old = btn.textContent; btn.disabled = true; btn.setAttribute('aria-busy','true'); btn.textContent = busyText;
  try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = old; }
}
```
Áp dụng nhãn: "Đang đăng nhập…", "Đang đổi mã PIN…", "Đang tạo học sinh…", "Đang lưu…", "Đang xóa…", "Đang tải danh sách…" (danh sách học sinh/khóa: đặt `aria-busy` cho vùng chứa + dòng chữ trong lúc tải).

## 3. Validate từng trường (U3)
```js
export function setFieldError(input, msg) {
  let e = document.getElementById(input.id + '-err');
  if (!e) { e = document.createElement('p'); e.id = input.id + '-err'; e.className = 'field-error'; e.setAttribute('role','alert'); input.closest('.field, label')?.append(e); }
  e.textContent = msg; e.hidden = !msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false'); input.setAttribute('aria-describedby', e.id);
  return !msg;
}
```
Luật: mã học sinh `/^[A-Za-z0-9_-]{1,64}$/` ("Mã học sinh chỉ gồm chữ, số, - và _."); PIN học sinh ≥6 ký tự ("Mã PIN tối thiểu 6 ký tự."), PIN giáo viên ≥8, khác PIN cũ, nhập lại khớp. Xóa lỗi khi người dùng nhập (`input` event). Focus vào trường lỗi đầu tiên. Bỏ `style.color`; dùng lớp `.field-error{color:var(--danger);font-size:14px;margin:4px 0 0}`, thêm biến `--danger` vào `:root`.

## 4. Văn bản (U5)
Bảng ánh xạ mã lỗi → tiếng Việt, không in thô `error.message`: `INVALID_CREDENTIALS` "Mã học sinh hoặc mã PIN chưa đúng."; `ACCOUNT_DISABLED` "Tài khoản đang bị khóa. Liên hệ giáo viên."; `TEACHER_PIN_CHANGE_REQUIRED` "Cần đổi mã PIN trước khi tiếp tục."; mặc định "Chưa thực hiện được. Thử lại sau."; mất mạng "Không có kết nối mạng." Sửa: "ít nhất 6 chữ số" → "tối thiểu 6 ký tự"; `aria-label` → "Hiện hoặc ẩn mã PIN"; `inputmode="numeric"` bỏ khỏi ô PIN nếu cho phép chữ. Dùng thuật ngữ: "mã PIN", "học sinh", "giáo viên", "lớp".

## 5. Sạch giao diện (U4, U6)
Xóa `💡` (app.js, index.html), thay `✕` bằng chữ "Đóng" (`aria-label` giữ). Chuyển mọi `style="…"` ở khối đăng nhập/tài khoản sang lớp CSS. CSS `.msg-dialog` rộng `min(420px,calc(100% - 32px))`, nút ≥48px, `.msg-actions{display:flex;gap:12px;justify-content:flex-end}`, nút xóa dùng `.danger-btn`.

## 6. Test (FAIL-first, chạy DOM bằng jsdom hoặc Playwright có sẵn)
`tests/test_login_ui.mjs` bổ sung hành vi:
- T-a: mã HS `a b` → `#student-code-err` hiện, `aria-invalid=true`, không gọi API.
- T-b: bấm "Vào học" khi API treo → nút "Đang đăng nhập…", `disabled`, `aria-busy=true`; xong trả nhãn cũ.
- T-c: bấm xóa học sinh → mở `#msg-dialog`, `window.confirm` không bị gọi (stub ném lỗi); Hủy → không gọi API; Đồng ý → gọi DELETE đúng 1 lần.
- T-d: `grep` toàn `frontend/hoc/*.{html,js}` không còn `confirm(`, `prompt(` (trừ `installPrompt`), `alert(`, `💡`, `✕`.
- T-e: PIN mới < 6 / không khớp / trùng cũ → lỗi đúng chữ ở trường, không gọi API.
- Sửa `test_frontend_outbox_regression.mjs` đọc `frontend/hoc/app.js`.
Xong khi: toàn bộ suite PASS (kèm test mới), oxlint 0/0, quét bí mật rỗng, log aisgk.md + handoff, KHÔNG deploy.
