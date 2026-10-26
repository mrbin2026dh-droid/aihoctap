// Đo đạc thực tế 100% với Firebase Authentication thật (dự án Spark day-hoc-tuong-tac-7ee69)
// Không mô phỏng, đo trực tiếp qua HTTPS mạng thật tới Google Identity Toolkit REST API.

const API_KEY = 'AIzaSyCC2tCURXYAMpdN687kcjY537K7zUhh_Fg';
const BASE_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const PIN_CORRECT = 'pin_bench_123456';
const PIN_WRONG = 'pin_wrong_000000';

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

async function signIn(email, password) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const ms = Math.round(performance.now() - t0);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, ms, status: res.status };
    } else {
      return { ok: false, ms, status: res.status, error: json.error?.message || `HTTP ${res.status}` };
    }
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    return { ok: false, ms, error: err.message || String(err) };
  }
}

async function runBatch(n) {
  console.log(`\n--- BẮT ĐẦU ĐO SONG SONG ${n} TÀI KHOẢN (MẠNG THẬT) ---`);
  const emails = Array.from({ length: n }, (_, i) => `hs_bench_${String(i + 1).padStart(3, '0')}@hs.aihoc.test`);
  const tStart = performance.now();
  const results = await Promise.all(emails.map(email => signIn(email, PIN_CORRECT)));
  const totalMs = Math.round(performance.now() - tStart);

  const successes = results.filter(r => r.ok);
  const failures = results.filter(r => !r.ok);
  const latencies = successes.map(r => r.ms);

  const p50 = pct(latencies, 0.5);
  const p95 = pct(latencies, 0.95);
  const max = latencies.length ? Math.max(...latencies) : 0;
  const min = latencies.length ? Math.min(...latencies) : 0;

  const errorCounts = {};
  for (const f of failures) {
    errorCounts[f.error] = (errorCounts[f.error] || 0) + 1;
  }

  console.log(`Kết quả: ${successes.length}/${n} thành công (${((successes.length / n) * 100).toFixed(1)}%)`);
  console.log(`Tổng thời gian hoàn thành batch: ${totalMs} ms`);
  console.log(`Độ trễ (mỗi request): min = ${min} ms, p50 = ${p50} ms, p95 = ${p95} ms, max = ${max} ms`);
  if (failures.length > 0) {
    console.log(`Lỗi ghi nhận:`, JSON.stringify(errorCounts, null, 2));
  } else {
    console.log(`Lỗi: 0 (Không gặp bất kỳ lỗi TOO_MANY_ATTEMPTS_TRY_LATER hay HTTP 429 nào)`);
  }

  return { n, totalMs, okCount: successes.length, p50, p95, max, min, errors: errorCounts };
}

async function runChaosIpLock() {
  console.log(`\n--- THỬ NGHIỆM TÁC ĐỘNG KHÓA IP: 10 TÀI KHOẢN CỐ TÌNH SAI PIN 5 LẦN ---`);
  const badEmails = Array.from({ length: 10 }, (_, i) => `hs_bench_${String(i + 80).padStart(3, '0')}@hs.aihoc.test`);
  
  let failedCalls = 0;
  const badResults = [];
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await Promise.all(badEmails.map(email => signIn(email, PIN_WRONG)));
    badResults.push(...res);
    failedCalls += res.filter(r => !r.ok).length;
    process.stdout.write(`Đợt sai ${attempt}/5 xong (${failedCalls} lỗi)... `);
  }
  console.log(`\nĐã thực hiện 50 lần đăng nhập sai mật khẩu liên tiếp từ cùng 1 địa chỉ IP.`);
  const badErrors = {};
  for (const r of badResults) {
    badErrors[r.error] = (badErrors[r.error] || 0) + 1;
  }
  console.log(`Mã lỗi trả về khi sai PIN:`, JSON.stringify(badErrors));

  console.log(`\nNgay lập tức thực hiện đăng nhập đúng cho 30 tài khoản khác (hs_bench_001..030) từ cùng IP này:`);
  const checkBatch = await runBatch(30);
  console.log(`Kết luận khóa IP: Sau 50 lần sai, 30 tài khoản khác đạt ${checkBatch.okCount}/30 thành công.`);
  if (checkBatch.okCount === 30) {
    console.log(`-> Firebase Authentication KHÔNG khóa toàn bộ địa chỉ IP sau 50 lỗi mật khẩu từ IP này!`);
  } else {
    console.log(`-> Có lỗi ảnh hưởng tới các tài khoản khác:`, checkBatch.errors);
  }
}

async function main() {
  console.log('KHỞI ĐỘNG PHÉP ĐO MẠNG THẬT GOOGLE FIREBASE SPARK');
  console.log('Môi trường: Máy Antigravity / IP mạng hiện tại');
  console.log('Thời gian:', new Date().toISOString());

  const b30 = await runBatch(30);
  // Nghỉ 1s giữa các batch
  await new Promise(r => setTimeout(r, 1000));

  const b50 = await runBatch(50);
  await new Promise(r => setTimeout(r, 1000));

  const b100 = await runBatch(100);
  await new Promise(r => setTimeout(r, 1000));

  await runChaosIpLock();

  console.log('\n=== TỔNG HỢP SỐ LIỆU ĐO THẬT ===');
  console.table([
    { N: 30, 'Thành công': `${b30.okCount}/30`, 'Tổng ms': b30.totalMs, 'p50 ms': b30.p50, 'p95 ms': b30.p95, 'Max ms': b30.max },
    { N: 50, 'Thành công': `${b50.okCount}/50`, 'Tổng ms': b50.totalMs, 'p50 ms': b50.p50, 'p95 ms': b50.p95, 'Max ms': b50.max },
    { N: 100, 'Thành công': `${b100.okCount}/100`, 'Tổng ms': b100.totalMs, 'p50 ms': b100.p50, 'p95 ms': b100.p95, 'Max ms': b100.max },
  ]);
}

main();
