// Đi tới một mục của trang giáo viên theo đúng cách người dùng làm: nút còn hiện thì bấm (máy tính);
// trên điện thoại, mục đã gộp đi qua biểu tượng Tài khoản cạnh bánh răng hoặc mục cha + thanh con.
async function goNav(pg, id) {
  if (await pg.isVisible(id)) return pg.click(id);
  const v = id.replace('#nav-', '');
  if (v === 'accounts' && await pg.isVisible('#hdr-accounts')) return pg.click('#hdr-accounts');
  const tab = `.t-subtab[data-goto="nav-${v}"]`;
  if (await pg.isVisible(tab)) return pg.click(tab);
  const leader = { materials: '#nav-lessons', exams: '#nav-sheetexam' }[v];
  if (leader && await pg.isVisible(leader)) { await pg.click(leader); await pg.waitForSelector(tab); return pg.click(tab); }
  return pg.click(id);
}
module.exports = { goNav };
