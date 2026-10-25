'use strict';
// Prototype only: no fetch, storage, authentication, real PIN or API key.
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const teacher = document.body.dataset.role === 'teacher';
const wide = matchMedia('(min-width:960px)');
const validViews = [...document.querySelectorAll('[data-view]')].map(x => x.dataset.view);
let screen = params.has('view') ? 'settings' : 'work';
let view = validViews.includes(params.get('view')) ? params.get('view') : null;
let dirty = false, pending = null, busy = false, restore = null, workScroll = 0;
const dialog = $('#confirm-dialog');
const cancel = $('#dialog-cancel');
const confirmButton = $('#dialog-confirm');
window.prototypeMetrics = { commits: [] };

function focusBack() {
  const target = restore && restore.isConnected && restore.getClientRects().length ? restore : $('#workspace-title');
  if (target && target.getClientRects().length) target.focus();
  else (screen === 'settings' ? ($('#heading-' + (view || 'account')) || $('#settings-title')) : $('#workspace-title')).focus();
}
function closeDialog() {
  if (busy) return;
  dialog.close(); pending = null; focusBack();
}
function setDialog(title, text, label, fn, danger = false) {
  $('#dialog-title').textContent = title; $('#dialog-body').textContent = text;
  $('#dialog-error').textContent = '';
  cancel.textContent = label ? 'Hủy' : 'Đóng';
  confirmButton.hidden = !label; confirmButton.textContent = label || '';
  confirmButton.classList.toggle('danger', danger);
  pending = fn; cancel.disabled = false; confirmButton.disabled = false;
  if (!dialog.open) dialog.showModal();
  cancel.focus();
}
function ask(title, text, label, fn, source, danger = false) {
  if (dialog.open || busy) return;
  restore = source || document.activeElement;
  setDialog(title, text, label, fn, danger);
}
function announce(title, text) { setDialog(title, text, '', null); }
cancel.addEventListener('click', closeDialog);
dialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
dialog.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled)')].filter(x => !x.hidden);
  if (!controls.length) { e.preventDefault(); return; }
  const first = controls[0], last = controls[controls.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
confirmButton.addEventListener('click', async () => {
  if (!pending || busy) return;
  const action = pending; pending = null; busy = true;
  confirmButton.disabled = true; cancel.disabled = true;
  confirmButton.setAttribute('aria-busy', 'true');
  confirmButton.textContent = 'Đang xử lý…';
  try { await action(); }
  finally {
    busy = false; confirmButton.removeAttribute('aria-busy');
    confirmButton.disabled = false; cancel.disabled = false;
    if (dialog.open && confirmButton.hidden) cancel.focus();
  }
});

function render(focus = true) {
  const settings = screen === 'settings';
  $('#workspace').hidden = settings; $('#settings').hidden = !settings;
  $('#settings').classList.toggle('detail-active', !!view);
  $('#open-settings').setAttribute('aria-expanded', String(settings));
  const active = settings ? (view || (wide.matches ? 'account' : null)) : null;
  $('#settings-layout').classList.toggle('has-detail', !!view);
  document.querySelectorAll('.settings-panel').forEach(p => p.hidden = p.id !== 'panel-' + active);
  document.querySelectorAll('[data-view]').forEach(b => {
    if (b.dataset.view === active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  history.replaceState(null, '', '#' + (settings ? 'settings' + (view ? '-' + view : '') : 'work'));
  if (focus) (settings ? (active ? $('#heading-' + active) : $('#settings-title')) : $('#workspace-title')).focus();
}
function move(fn, source) {
  if (!dirty) { fn(); return; }
  ask('Bỏ thay đổi chưa lưu?', 'Hạn mức đang chỉnh sửa chưa được lưu.', 'Bỏ thay đổi', async () => {
    dirty = false; $('#quota-form').reset(); $('#quota-error').textContent = '';
    $('#daily-quota').removeAttribute('aria-invalid');
    busy = false; dialog.close(); fn();
  }, source, true);
}
$('#open-settings').addEventListener('click', e => {
  if (screen === 'settings') { move(() => { view = null; render(); }, e.currentTarget); return; }
  workScroll = scrollY; screen = 'settings'; view = null; render(); scrollTo(0,0);
});
function leaveSettings(source) {
  move(() => { screen = 'work'; view = null; render(false); scrollTo(0, workScroll); $('#open-settings').focus({preventScroll:true}); }, source);
}
$('#close-settings').addEventListener('click', e => leaveSettings(e.currentTarget));
document.querySelectorAll('[data-work]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); leaveSettings(b); }));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => move(() => { view = b.dataset.view; render(); scrollTo(0,0); }, b)));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => move(() => { const old = view; view = null; render(false); const item = $('[data-view="' + old + '"]'); if (item && item.getClientRects().length) item.focus(); else $('#settings-title').focus(); }, b)));
wide.addEventListener('change', () => {
  const previous = document.activeElement; render(false);
  if (previous && !previous.getClientRects().length) (view ? $('#heading-' + view) : $('#settings-title')).focus();
});

function eventTarget(button) {
  const record = button.closest('[data-record]');
  if (record) return { record, id: record.dataset.record, label: record.dataset.label + (record.matches('.student-row') ? ' · ' + $('#class-filter').value : '') };
  if (button.dataset.action === 'remove-download') return { record: button.closest('article'), id:'download-1', label:'Thông tin và dữ liệu [THỬ]' };
  return { record:null, id:'class-ai', label:$('#quota-class').value + ' · 2 học sinh mẫu' };
}
async function simulate(action, target, change, success) {
  await new Promise(r => setTimeout(r, 350));
  if (params.get('simulate') === 'error') { announce('Chưa thực hiện được', 'Không có thay đổi. Hãy thử lại.'); return; }
  change(); window.prototypeMetrics.commits.push({action, target});
  announce('Đã hoàn tất', success);
}
document.addEventListener('click', e => {
  const button = e.target.closest('[data-action]');
  if (!button || busy || dialog.open) return;
  const action = button.dataset.action, target = eventTarget(button);
  const disclosure = button.closest('details');
  const source = disclosure ? disclosure.querySelector('summary') : button;
  if (disclosure) disclosure.open = false;
  const names = {
    lock:['Khóa tài khoản?', 'Học sinh sẽ không thể đăng nhập.', 'Khóa tài khoản', true],
    unlock:['Mở khóa tài khoản?', 'Học sinh sẽ có thể đăng nhập lại.', 'Mở khóa tài khoản', false],
    reset:['Đặt lại mã PIN?', 'Mã PIN cũ sẽ không còn sử dụng được.', 'Đặt lại mã PIN', true],
    delete:['Xóa học sinh?', 'Tài khoản sẽ bị xóa. Thao tác không thể hoàn tác.', 'Xóa học sinh', true],
    'delete-key':['Xóa khóa API?', 'Khóa này sẽ không còn dùng cho kết nối AI.', 'Xóa khóa', true],
    'lock-ai':['Khóa AI của lớp?', 'Học sinh trong lớp sẽ tạm dừng sử dụng gia sư AI.', 'Khóa AI', true],
    'unlock-ai':['Mở AI của lớp?', 'Học sinh trong lớp có thể sử dụng gia sư AI theo hạn mức.', 'Mở AI', false],
    'remove-download':['Xóa bản tải?', 'Em cần mạng để tải lại bài trên thiết bị này.', 'Xóa bản tải', true]
  };
  const [title,text,label,danger] = names[action];
  ask(title, target.label + '. ' + text, label, () => simulate(action,target.id,() => {
    if (action === 'lock' || action === 'unlock') {
      target.record.querySelector('[data-record-status]').textContent = action === 'lock' ? 'Đã khóa' : 'Đang hoạt động';
      button.dataset.action = action === 'lock' ? 'unlock' : 'lock'; button.textContent = action === 'lock' ? 'Mở khóa tài khoản' : 'Khóa tài khoản';
    } else if (action === 'delete' || action === 'delete-key' || action === 'remove-download') {
      target.record.remove();
      const list = action === 'delete' ? $('#student-list') : action === 'delete-key' ? $('#key-list') : $('#offline-list');
      if (!list.children.length) { const p=document.createElement('p');p.className='muted';p.textContent=action==='delete'?'Lớp chưa có học sinh.':action==='delete-key'?'Chưa có khóa API.':'Chưa có bài tải ngoại tuyến.';list.append(p); }
    } else if (action === 'lock-ai' || action === 'unlock-ai') {
      button.dataset.action = action === 'lock-ai' ? 'unlock-ai' : 'lock-ai';button.textContent = action === 'lock-ai' ? 'Mở AI của lớp' : 'Khóa AI của lớp';
    }
  }, label + ' đã hoàn tất.'), source, danger);
});
document.addEventListener('toggle', e => {
  if (e.target.matches('.row-actions[open]')) document.querySelectorAll('.row-actions[open]').forEach(d => { if (d !== e.target) d.open = false; });
},true);

if (teacher) {
  const form = $('#quota-form'), input = $('#daily-quota');
  form.addEventListener('input', () => { dirty = true; $('#quota-error').textContent='';input.removeAttribute('aria-invalid'); });
  form.addEventListener('change', () => dirty=true);
  form.addEventListener('submit', e => {
    e.preventDefault(); const n=Number(input.value);
    if(input.value.trim()==='' || !Number.isInteger(n) || n<0) { input.setAttribute('aria-invalid','true');$('#quota-error').textContent='Nhập số nguyên từ 0 trở lên.';input.focus();return; }
    const target=$('#quota-class').value;
    ask('Lưu hạn mức AI?', target + ': ' + n + ' lượt mỗi học sinh/ngày.', 'Lưu hạn mức', () => simulate('save-quota',target,() => {
      dirty=false;input.defaultValue=input.value;[...$('#quota-class').options].forEach(o=>o.defaultSelected=o.selected);
    },'Đã lưu hạn mức AI.'),form.querySelector('[type=submit]'));
  });
}

function applyPreviewState() {
  const state=params.get('state');if(!['loading','empty','error'].includes(state))return;
  const list=teacher?(view==='keys'?$('#key-list'):$('#student-list')):$('#offline-list');
  if(!list)return;
  const box=document.createElement('div');box.className='status-panel';box.dataset.previewState=state;
  const h=document.createElement('h3'),p=document.createElement('p');
  h.textContent=state==='loading'?'Đang tải…':state==='empty'?'Chưa có dữ liệu':'Chưa tải được danh sách';
  p.textContent=state==='loading'?'Vui lòng chờ.':state==='empty'?(teacher?'Dữ liệu sẽ hiện tại đây khi được thêm.':'Bài đã tải sẽ xuất hiện tại đây.'):'Kiểm tra kết nối rồi thử lại.';
  box.append(h,p);list.hidden=true;list.after(box);
  if(state==='loading'){box.setAttribute('role','status');box.setAttribute('aria-busy','true');}
  if(state==='error'){const b=document.createElement('button');b.textContent='Thử lại';b.addEventListener('click',()=>{box.remove();list.hidden=false;(list.querySelector('summary,button')||$('#workspace-title')).focus()});box.append(b);}
}
render(false);applyPreviewState();
