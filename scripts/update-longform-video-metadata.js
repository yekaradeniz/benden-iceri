/**
 * Var olan bir YouTube videosunun metadata'sini long-form SEO paketiyle gunceller.
 * Video silinmez; baslik/aciklama/tag uzerine yazilir.
 *
 * Kullanim: node scripts/update-longform-video-metadata.js <videoId> <poemNo>
 * Env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, ELEVENLABS_VOICE_ID
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getAudioDuration } from '../src/generateVoice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE = join(ROOT, 'output', 'audio-cache');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID;
for (const [k, v] of Object.entries({ CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, ELEVEN_VOICE })) {
  if (!v) { console.error('Env eksik:', k); process.exit(1); }
}

const videoId = process.argv[2];
const poemNo = parseInt(process.argv[3], 10);
if (!videoId || !poemNo) { console.error('Kullanim: node scripts/update-longform-video-metadata.js <videoId> <poemNo>'); process.exit(1); }

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
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

const poem = JSON.parse(readFileSync(join(ROOT, 'content', 'poems.json'), 'utf-8')).poems.find(p => p.poemNo === poemNo);
const units = poem.units.filter(u => u.beyit && u.beyit.trim() && u.serh && u.serh.trim());

const cardFirstLine = (poem.title || units[0].beyit.split('\n')[0]).replace(/[.,;:]+$/, '').trim();
const cardText = `${gazelLabelOf(poemNo)}.\n\n${cardFirstLine}.`;
const cardVoiceDur = await getAudioDuration(cachePath(cardText, DEFAULT_SETTINGS));
const cardDur = CARD_LEAD + cardVoiceDur + CARD_TAIL;

const chapters = [{ t: 0, label: 'Açılış' }, { t: INTRO_DUR, label: `${gazelLabelOf(poemNo)} — Tanıtım` }];
let t = INTRO_DUR + cardDur + PAUSE_AFTER_CARD;
for (let i = 0; i < units.length; i++) {
  const u = units[i];
  const bd = await getAudioDuration(cachePath(u.beyit, DEFAULT_SETTINGS));
  const sd = await getAudioDuration(cachePath(u.serh, SERH_SETTINGS));
  const beyitEnd = t + BEYIT_LEAD + bd + BEYIT_TAIL;
  const serhStart = beyitEnd + UNIT_GAP;
  const beyitFirst = u.beyit.split('\n').filter(l => l.trim())[0].replace(/[.,;:]+$/, '').trim();
  chapters.push({ t, label: `${i+1}. Beyit — "${beyitFirst.slice(0, 60)}${beyitFirst.length > 60 ? '…' : ''}"` });
  chapters.push({ t: serhStart, label: `${i+1}. Beyit Mânâsı` });
  t = serhStart + SERH_LEAD + sd + SERH_TAIL;
}

const title = (() => {
  const base = `Salih Baba Dîvânı — ${gazelLabelOf(poemNo)} | "${cardFirstLine}"`;
  return base.length > 100 ? base.slice(0, 99) + '…' : base;
})();

const description = (() => {
  const parts = [];
  parts.push(`Salih Baba Dîvânı'ndan ${gazelLabelOf(poemNo)}, baştan sona okunup beyit beyit şerh edilmiştir.`);
  parts.push('');
  parts.push(`Gazelin tamamı, ${units.length} bölüm hâlinde, her bölümde önce beyit okunur ardından mânâsı verilir.`);
  parts.push('');
  parts.push('— BÖLÜMLER —');
  for (const c of chapters) parts.push(`${ts(c.t)} ${c.label}`);
  parts.push('');
  parts.push('— GAZEL —');
  for (const u of units) { parts.push(u.beyit); parts.push(''); }
  parts.push('— HAKKINDA —');
  parts.push('Bu kanal, Salih Baba Dîvânı\'nı her gün bir beyit ve haftada bir gazel formatında paylaşır. Tasavvuf, Nakşibendî geleneği, ilâhî aşk ve divan edebiyatı meraklılarına yöneliktir.');
  parts.push('');
  parts.push('Abone olarak yeni gazeller ve günlük beyitlerden haberdar olabilirsiniz.');
  parts.push('');
  parts.push('#SalihBaba #SalihBabaDîvânı #Tasavvuf #Nakşibendî #İlahiAşk #TasavvufŞiirleri #DivanEdebiyatı #Şerh');
  return parts.join('\n');
})();

const VIDEO_TAGS = [
  'salih baba', 'salih baba dîvânı', 'salih baba divanı', 'salih baba şerh',
  'erzurumlu salih baba', 'tasavvuf', 'tasavvuf şiirleri', 'tasavvuf sözleri',
  'nakşibendi', 'nakşibendî', 'sufizm', 'sufi',
  'ilahi aşk', 'aşk-ı ilahi', 'divan edebiyatı', 'osmanlı şiiri',
  'tekke şiiri', 'marifet', 'tefekkür', 'gazel şerhi', 'gazel okuma'
];

console.log('---- YENI BASLIK ----');
console.log(title);
console.log(`---- ACIKLAMA: ${description.length} char, ${chapters.length} chapter ----`);

// Token + update
const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' })
});
const tok = await tokRes.json();
if (!tok.access_token) { console.error('Token alinamadi:', JSON.stringify(tok)); process.exit(1); }

const updRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: videoId,
    snippet: {
      title,
      description,
      tags: VIDEO_TAGS,
      categoryId: '29',
      defaultLanguage: 'tr',
      defaultAudioLanguage: 'tr'
    }
  })
});
if (!updRes.ok) {
  console.error(`Update basarisiz (${updRes.status}):`, (await updRes.text()).slice(0, 400));
  process.exit(1);
}
console.log(`\n✓ Guncellendi: https://www.youtube.com/watch?v=${videoId}`);
