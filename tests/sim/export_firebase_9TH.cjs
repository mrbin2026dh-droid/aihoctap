// @ts-check
const fs = require('fs');
const path = require('path');

const dbUrl = 'https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app';
const workerApi = 'https://aihoctap-gate.mrbin2026dh.workers.dev/api';

(async () => {
  console.log('=== XUẤT DỮ LIỆU THẬT LỚP 9TH TỪ FIREBASE RTDB ===');

  const uids9TH = new Set();
  for (let i = 1; i <= 30; i++) {
    const num = String(9000 + i);
    uids9TH.add('th' + num);
    uids9TH.add('TH' + num);
  }

  // 1. doc_read
  console.log('1. Lấy dữ liệu doc_read...');
  const resDoc = await fetch(`${dbUrl}/doc_read.json`);
  const rawDoc = await resDoc.json() || {};
  const doc_read = {};
  for (const [lesson, students] of Object.entries(rawDoc)) {
    if (!students || typeof students !== 'object') continue;
    const filtered = {};
    for (const [uid, val] of Object.entries(students)) {
      if (uids9TH.has(uid) || (val && val.lop === '9TH')) {
        filtered[uid] = val;
      }
    }
    if (Object.keys(filtered).length > 0) {
      doc_read[lesson] = filtered;
    }
  }

  // 2. thoi_gian
  console.log('2. Lấy dữ liệu thoi_gian...');
  const resTime = await fetch(`${dbUrl}/thoi_gian.json`);
  const rawTime = await resTime.json() || {};
  const thoi_gian = {};
  for (const [day, students] of Object.entries(rawTime)) {
    if (!students || typeof students !== 'object') continue;
    const filtered = {};
    for (const [uid, val] of Object.entries(students)) {
      if (uids9TH.has(uid)) {
        filtered[uid] = val;
      }
    }
    if (Object.keys(filtered).length > 0) {
      thoi_gian[day] = filtered;
    }
  }

  // 3. presence
  console.log('3. Lấy dữ liệu presence...');
  const resPres = await fetch(`${dbUrl}/presence.json`);
  const rawPres = await resPres.json() || {};
  const presence = {};
  for (const [uid, val] of Object.entries(rawPres)) {
    if (uids9TH.has(uid) || (val && val.lop === '9TH')) {
      presence[uid] = val;
    }
  }

  // 4. attempts qua Worker API
  console.log('4. Lấy dữ liệu attempts qua Worker API...');
  let mau_attempts_hoc_sinh = {};
  try {
    const resAtt = await fetch(`${workerApi}/pwa/sim/export-attempts-9th`);
    if (resAtt.ok) {
      const dataAtt = await resAtt.json();
      mau_attempts_hoc_sinh = dataAtt.attempts || {};
      console.log(`   Đã lấy ${Object.keys(mau_attempts_hoc_sinh).length} tài khoản có attempts.`);
    } else {
      console.warn('   Không lấy được attempts từ worker:', resAtt.status);
    }
  } catch (e) {
    console.warn('   Lỗi gọi Worker export-attempts-9th:', e.message);
  }

  // 5. thi_hs (nếu có)
  console.log('5. Lấy dữ liệu thi_hs...');
  const resThi = await fetch(`${dbUrl}/thi_hs.json`).catch(() => null);
  const thi_hs = {};
  if (resThi && resThi.ok) {
    const rawThi = await resThi.json() || {};
    for (const [uid, val] of Object.entries(rawThi)) {
      if (uids9TH.has(uid)) {
        thi_hs[uid] = val;
      }
    }
  }

  const exportData = {
    nhan: "KIỂM THỬ MÔ PHỎNG – lớp 9TH, không phải học sinh thật",
    thoi_diem_xuat: new Date().toISOString(),
    tong_quan: {
      so_hoc_sinh_tao: 30,
      so_hoc_sinh_dang_nhap: Object.keys(presence).length,
      so_hoc_sinh_nhom_E_bo_qua: 4
    },
    doc_read,
    thoi_gian,
    presence,
    thi_hs,
    mau_attempts_hoc_sinh
  };

  const outPath = path.join(__dirname, 'out', 'firebase-9TH.json');
  fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`ĐÃ XUẤT THÀNH CÔNG RA: ${outPath} (${fs.statSync(outPath).size} bytes)`);
})();
