import https from 'https';
import fs from 'fs';
import path from 'path';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== SMOKE TEST S1: GET LIVE ENDPOINTS ===');
  const sw = await get('https://mrbin2026dh-droid.github.io/aihoctap/sw.js');
  const index = await get('https://mrbin2026dh-droid.github.io/aihoctap/index.html');
  
  const m = sw.data.match(/const CACHE = '([^']+)';/);
  const liveCache = m ? m[1] : 'NOT FOUND';
  console.log('SW status:', sw.status);
  console.log('SW CACHE:', liveCache);

  const localSw = fs.readFileSync('frontend/hoc/sw.js', 'utf8');
  const localM = localSw.match(/const CACHE = '([^']+)';/);
  const localCache = localM ? localM[1] : '';
  console.log('Repo SW CACHE:', localCache);
  console.log('Cache match:', liveCache === localCache);

  console.log('Index status:', index.status);
  console.log('Has id="open-settings":', index.data.includes('id="open-settings"'));
  console.log('Has id="update-text":', index.data.includes('id="update-text"'));

  if (liveCache !== localCache) {
    console.error('FAIL: live CACHE does not match repo CACHE!');
    process.exit(1);
  }
  if (!index.data.includes('id="open-settings"') || !index.data.includes('id="update-text"')) {
    console.error('FAIL: index.html missing required elements!');
    process.exit(1);
  }
  console.log('>>> S1 PASS 100% <<<');
}

run().catch(e => { console.error(e); process.exit(1); });
