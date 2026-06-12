/**
 * Long-form yatay gazel videosunu YouTube'a yukler. Zengin SEO + chapters.
 * Kullanim: node scripts/upload-longform-poem.js <poemNo> [--file <path>]
 *
 * Env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, ELEVENLABS_VOICE_ID
 */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { getAudioDuration } from '../src/generateVoice.js';

// Buyuk dosya upload (1GB+): curl kullaniyoruz, node fetch'in default 5dk
// headers timeout yetmiyor. curl native progress, no timeout.
function curlUpload(uploadUri, filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sS',                                // silent ama error goster
      '-X', 'PUT',
      '-H', 'Content-Type: video/mp4',
      '-H', `Content-Length: ${statSync(filePath).size}`,
      '--upload-file', filePath,
      '--max-time', '7200',                 // 2 saat
      uploadUri
    ];
    const proc = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`curl exit ${code}: ${err.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'output');
const CACHE = join(OUT_DIR, 'audio-cache');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID;
for (const [k, v] of Object.entries({ CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, ELEVEN_VOICE })) {
  if (!v) { console.error('Env eksik:', k); process.exit(1); }
}

const args = process.argv.slice(2);
const poemNo = parseInt(args[0], 10);
if (!poemNo) { console.error('Kullanim: node scripts/upload-longform-poem.js <poemNo> [--file <path>]'); process.exit(1); }
const fIdx = args.indexOf('--file');
const customFile = fIdx >= 0 ? args[fIdx + 1] : null;

// ---- Zamanlama sabitleri (render scripti ile bire bir) ----
const INTRO_DUR = 5.04;
const CARD_LEAD = 0.8;
const CARD_TAIL = 1.2;
const PAUSE_AFTER_CARD = 1;
const BEYIT_LEAD = 0.8;
const BEYIT_TAIL = 1.0;
const SERH_LEAD = 0.6;
const SERH_TAIL = 1.5;
const UNIT_GAP = 1.0;
const DEFAULT_SETTINGS = { stability: 0.5, similarity_boost: 0.95, style: 0, use_speaker_boost: true };
const SERH_SETTINGS    = { stability: 0.5, similarity_boost: 0.95, style: 0, use_speaker_boost: true, speed: 1.1 };

function cacheKey(text, settings) {
  return createHash('sha1').update(text + '|' + ELEVEN_VOICE + '|' + JSON.stringify(settings)).digest('hex').slice(0, 16);
}
function cachePath(text, settings) { return join(CACHE, cacheKey(text, settings) + '.mp3'); }

function gazelLabelOf(n) {
  const map = ['', 'Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci', 'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu'];
  return (map[n] || `${n}.`) + ' Gazel';
}
function ts(sec) {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

// ---- Veri + zamanlama ----
const poem = JSON.parse(readFileSync(join(ROOT, 'content', 'poems.json'), 'utf-8')).poems.find(p => p.poemNo === poemNo);
if (!poem) { console.error(`Poem ${poemNo} yok`); process.exit(1); }
const units = poem.units.filter(u => u.beyit && u.beyit.trim() && u.serh && u.serh.trim());

const cardFirstLine = (poem.title || units[0].beyit.split('\n')[0]).replace(/[.,;:]+$/, '').trim();
const cardText = `${gazelLabelOf(poemNo)}.\n\n${cardFirstLine}.`;
const cardVoicePath = cachePath(cardText, DEFAULT_SETTINGS);
if (!existsSync(cardVoicePath)) { console.error('Kart sesi cache yok'); process.exit(1); }
const cardVoiceDur = await getAudioDuration(cardVoicePath);
const cardDur = CARD_LEAD + cardVoiceDur + CARD_TAIL;

// Chapter zamanlari (final video timeline'inda - intro hesaba katilir)
const chapters = [];
chapters.push({ t: 0, label: 'Açılış' });
chapters.push({ t: INTRO_DUR, label: `${gazelLabelOf(poemNo)} — Tanıtım` });

let t = INTRO_DUR + cardDur + PAUSE_AFTER_CARD;
for (let i = 0; i < units.length; i++) {
  const u = units[i];
  const bp = cachePath(u.beyit, DEFAULT_SETTINGS);
  const sp = cachePath(u.serh, SERH_SETTINGS);
  if (!existsSync(bp) || !existsSync(sp)) { console.error(`Birim ${i+1} ses cache yok`); process.exit(1); }
  const bd = await getAudioDuration(bp);
  const sd = await getAudioDuration(sp);

  const beyitOverlayStart = t;
  const beyitEnd = t + BEYIT_LEAD + bd + BEYIT_TAIL;
  const serhOverlayStart = beyitEnd + UNIT_GAP;
  const serhEnd = serhOverlayStart + SERH_LEAD + sd + SERH_TAIL;

  // Tek tek beyit + serh chapter
  const beyitFirst = u.beyit.split('\n').filter(l => l.trim())[0].replace(/[.,;:]+$/, '').trim();
  chapters.push({ t: beyitOverlayStart, label: `${i+1}. Beyit — "${beyitFirst.slice(0, 60)}${beyitFirst.length > 60 ? '…' : ''}"` });
  chapters.push({ t: serhOverlayStart, label: `${i+1}. Beyit Mânâsı` });

  t = serhEnd;
}

// ---- SEO: baslik ve aciklama ----
function buildTitle() {
  // Format: "Salih Baba Dîvânı — Birinci Gazel | [ilk misra]"
  const base = `Salih Baba Dîvânı — ${gazelLabelOf(poemNo)} | "${cardFirstLine}"`;
  return base.length > 100 ? base.slice(0, 99) + '…' : base;
}

function buildDescription() {
  const parts = [];

  parts.push(`Salih Baba Dîvânı'ndan ${gazelLabelOf(poemNo)}, baştan sona okunup beyit beyit şerh edilmiştir.`);
  parts.push('');
  parts.push(`Gazelin tamamı, ${units.length} bölüm hâlinde, her bölümde önce beyit okunur ardından mânâsı verilir.`);
  parts.push('');
  parts.push('— BÖLÜMLER —');
  for (const c of chapters) parts.push(`${ts(c.t)} ${c.label}`);
  parts.push('');
  parts.push('— GAZEL —');
  // Tüm beyitler tek metin olarak
  for (const u of units) {
    parts.push(u.beyit);
    parts.push('');
  }
  parts.push('— HAKKINDA —');
  parts.push('Bu kanal, Salih Baba Dîvânı\'nı her gün bir beyit ve haftada bir gazel formatında paylaşır. Tasavvuf, Nakşibendî geleneği, ilâhî aşk ve divan edebiyatı meraklılarına yöneliktir.');
  parts.push('');
  parts.push('Abone olarak yeni gazeller ve günlük beyitlerden haberdar olabilirsiniz.');
  parts.push('');
  parts.push('#SalihBaba #SalihBabaDîvânı #Tasavvuf #Nakşibendî #İlahiAşk #TasavvufŞiirleri #DivanEdebiyatı #Şerh');

  return parts.join('\n');
}

const VIDEO_TAGS = [
  'salih baba', 'salih baba dîvânı', 'salih baba divanı', 'salih baba şerh',
  'erzurumlu salih baba', 'tasavvuf', 'tasavvuf şiirleri', 'tasavvuf sözleri',
  'nakşibendi', 'nakşibendî', 'sufizm', 'sufi',
  'ilahi aşk', 'aşk-ı ilahi', 'divan edebiyatı', 'osmanlı şiiri',
  'tekke şiiri', 'marifet', 'tefekkür', 'gazel şerhi', 'gazel okuma'
];

// ---- OAuth + Upload ----
async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' })
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(`Token alinamadi: ${JSON.stringify(d)}`);
  return d.access_token;
}

const videoPath = customFile || join(OUT_DIR, `gazel-${String(poemNo).padStart(2,'0')}-audio-fixed.mp4`);
if (!existsSync(videoPath)) { console.error(`Video yok: ${videoPath}`); process.exit(1); }

const title = buildTitle();
const description = buildDescription();
console.log('---- BASLIK ----');
console.log(title);
console.log('---- ACIKLAMA (ilk 30 satir) ----');
console.log(description.split('\n').slice(0, 30).join('\n'));
console.log('...');
console.log(`---- ACIKLAMA toplam: ${description.length} char ----`);
console.log();

const metadata = {
  snippet: {
    title,
    description,
    tags: VIDEO_TAGS,
    categoryId: '29',
    defaultLanguage: 'tr',
    defaultAudioLanguage: 'tr'
  },
  status: {
    privacyStatus: 'public',
    selfDeclaredMadeForKids: false,
    embeddable: true
  }
};

console.log('YouTube access token aliniyor...');
const accessToken = await getAccessToken();

console.log('Resumable upload baslatiliyor...');
const fileSize = statSync(videoPath).size;
console.log(`Dosya: ${videoPath} (${(fileSize/(1024*1024)).toFixed(0)} MB)`);

const initRes = await fetch(UPLOAD_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Upload-Content-Type': 'video/mp4',
    'X-Upload-Content-Length': String(fileSize)
  },
  body: JSON.stringify(metadata)
});
if (!initRes.ok) {
  const body = await initRes.text();
  console.error(`Init basarisiz (${initRes.status}): ${body}`);
  process.exit(1);
}
const uploadUri = initRes.headers.get('location');
if (!uploadUri) { console.error('Upload URI yok'); process.exit(1); }
console.log('Upload URI alindi, video yukleniyor...');

// curl ile upload (timeout sorunu yok, 1GB+ dosyalar icin)
const uploadOut = await curlUpload(uploadUri, videoPath);
let result;
try { result = JSON.parse(uploadOut); }
catch (e) { console.error('Upload response parse hatasi:', uploadOut.slice(0, 500)); process.exit(1); }
if (!result.id) { console.error('Upload basarisiz:', JSON.stringify(result).slice(0, 500)); process.exit(1); }
console.log(`\n✓ YouTube'a yuklendi: https://www.youtube.com/watch?v=${result.id}`);
console.log(`Video ID: ${result.id}`);
