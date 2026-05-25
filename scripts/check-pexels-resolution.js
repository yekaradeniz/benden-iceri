/**
 * Bizim mood query'leri ile Pexels'te kac tane yuksek cozunurluklu portrait video var?
 */
const API_KEY = 'FfYvsftVEt3tjnLIf1SLrMykrrTBkOJSUGW5sYPWC25dfpNKyVHEyv9o';

const QUERIES = [
  'mosque interior',
  'islamic architecture',
  'mosque dome',
  'sufi spiritual',
  'mosque arch',
  'medina mosque',
  'turkish mosque',
  'ottoman mosque',
  'mihrab',
  'mosque calligraphy'
];

async function search(query) {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '80');
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.videos ?? [];
}

const allFound = new Set();
const stats = {
  '4K (2160+)': 0,
  '1440-2159': 0,
  '1080-1439': 0,
  'altı': 0
};

for (const q of QUERIES) {
  const videos = await search(q);
  for (const v of videos) {
    if (allFound.has(v.id)) continue;
    allFound.add(v.id);
    // En yuksek portrait file'i bul
    const portraitFiles = (v.video_files || []).filter(f => f.height > f.width);
    if (portraitFiles.length === 0) continue;
    const maxH = Math.max(...portraitFiles.map(f => f.height));
    if (maxH >= 2160) stats['4K (2160+)']++;
    else if (maxH >= 1440) stats['1440-2159']++;
    else if (maxH >= 1080) stats['1080-1439']++;
    else stats['altı']++;
  }
  await new Promise(r => setTimeout(r, 200));
}

console.log('Toplam essiz portrait video:', allFound.size);
console.log('Cozunurluk dagilimi:');
for (const [k, v] of Object.entries(stats)) {
  console.log('  ' + k + ': ' + v);
}
