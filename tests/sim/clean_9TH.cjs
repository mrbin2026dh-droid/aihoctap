// @ts-check
const fs = require('fs');
const path = require('path');

const dbUrl = 'https://ai-sgk-tinhoc-default-rtdb.asia-southeast1.firebasedatabase.app';
const workerApi = 'https://aihoctap-gate.mrbin2026dh.workers.dev/api';

(async () => {
  console.log('=== DỌN DỮ LIỆU LẦN 1 CỦA LỚP 9TH ===');
  const deletedPaths = [];

  // 1. Gọi Worker xóa attempts và attempt_details của th9001..th9030
  console.log('1. Xóa attempts và attempt_details trên Worker...');
  try {
    const res = await fetch(workerApi + '/pwa/sim/cleanup-9th', { method: 'POST' });
    const data = await res.json();
    console.log('   Worker cleanup response:', data);
    for (let i = 1; i <= 30; i++) {
      const num = String(9000 + i);
      deletedPaths.push(`attempts/th${num}`, `attempts/TH${num}`);
      deletedPaths.push(`attempt_details/th${num}`, `attempt_details/TH${num}`);
    }
  } catch (e) {
    console.error('   Lỗi gọi Worker cleanup:', e.message);
  }

  // 2. Xóa presence
  console.log('2. Xóa presence...');
  for (let i = 1; i <= 30; i++) {
    const num = String(9000 + i);
    for (const prefix of ['th', 'TH']) {
      const uid = prefix + num;
      await fetch(`${dbUrl}/presence/${uid}.json`, { method: 'DELETE' }).catch(() => null);
      deletedPaths.push(`presence/${uid}`);
    }
  }

  // 3. Xóa thoi_gian
  console.log('3. Xóa thoi_gian...');
  const days = ['2026-10-28', '2026-10-29', '2026-10-30'];
  for (const day of days) {
    for (let i = 1; i <= 30; i++) {
      const num = String(9000 + i);
      for (const prefix of ['th', 'TH']) {
        const uid = prefix + num;
        await fetch(`${dbUrl}/thoi_gian/${day}/${uid}.json`, { method: 'DELETE' }).catch(() => null);
        deletedPaths.push(`thoi_gian/${day}/${uid}`);
      }
    }
  }

  // 4. Xóa doc_read
  console.log('4. Xóa doc_read...');
  const lessons = ['tin-hoc-9~bai-1', 'tin-hoc-9~bai-2', 'tin-hoc-9~bai-10'];
  for (const l of lessons) {
    for (let i = 1; i <= 30; i++) {
      const num = String(9000 + i);
      for (const prefix of ['th', 'TH']) {
        const uid = prefix + num;
        await fetch(`${dbUrl}/doc_read/${l}/${uid}.json`, { method: 'DELETE' }).catch(() => null);
        deletedPaths.push(`doc_read/${l}/${uid}`);
      }
    }
  }

  // 5. Xóa nang_luc
  console.log('5. Xóa nang_luc...');
  for (let i = 1; i <= 30; i++) {
    const num = String(9000 + i);
    for (const prefix of ['th', 'TH']) {
      const uid = prefix + num;
      await fetch(`${dbUrl}/nang_luc/${uid}.json`, { method: 'DELETE' }).catch(() => null);
      deletedPaths.push(`nang_luc/${uid}`);
    }
  }

  // 6. Sao lưu log cũ và làm sạch log.jsonl cho lần 2
  const outDir = path.join(process.cwd(), 'tests', 'sim', 'out');
  const logFile = path.join(outDir, 'log.jsonl');
  if (fs.existsSync(logFile)) {
    fs.copyFileSync(logFile, path.join(outDir, 'log_lan1_29_10.jsonl'));
    fs.writeFileSync(logFile, '');
    console.log('6. Đã sao lưu log_lan1_29_10.jsonl và làm mới log.jsonl.');
  }

  console.log(`HOÀN TẤT DỌN DẸP ${deletedPaths.length} ĐƯỜNG DẪN CỦA LỚP 9TH!`);
  fs.writeFileSync(path.join(outDir, 'danh_sach_da_xoa.txt'), deletedPaths.join('\n'), 'utf8');
})();
