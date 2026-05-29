/**
 * Var olan TUM YouTube videolarinin baslik + aciklama + tag'lerini
 * yeni SEO formatina gunceller.
 *
 * Akis:
 *  1. Kanalin "uploads" playlist'inden tum videolari cek
 *  2. Her videonun mevcut basligindan beyti bul (content/salih-baba.json ile esle)
 *  3. Yeni format baslik/aciklama/tag uret, videos.update ile guncelle
 *
 * Env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
for (const [k, v] of Object.entries({ CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN })) {
  if (!v) { console.error(`Env eksik: YOUTUBE_${k}`); process.exit(1); }
}

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));

// ---- SEO format fonksiyonlari (uploadToYoutube.js ile ayni) ----
function buildTitle(verse) {
  const firstLine = (String(verse).split('\n').find(l => l.trim().length > 0) ?? '').trim();
  const clean = firstLine.replace(/[.,;:]+$/, '').trim();
  const suffix = ' | Salih Baba Dîvânı';
  const maxMisra = 100 - suffix.length;
  const base = clean.length > maxMisra ? clean.slice(0, maxMisra - 1).trim() + '…' : clean;
  return `${base}${suffix}`;
}

function buildDescription({ verse, explanation }) {
  const parts = [];
  parts.push(verse.trim());
  if (explanation && explanation.trim()) parts.push(`\nMânâsı:\n${explanation.trim()}`);
  parts.push('\nSalih Baba Dîvânı\'ndan. Her gün bir beyit, mânâsıyla birlikte paylaşılmaktadır.');
  parts.push('Tasavvuf şiirleri, Nakşibendî geleneği ve ilâhî aşk yolunun beyitleri için kanalımıza abone olabilirsiniz.');
  parts.push('\n#SalihBaba #SalihBabaDîvânı #Tasavvuf #Nakşibendî #İlahiAşk #TasavvufŞiirleri #Sufizm #Shorts');
  return parts.join('\n');
}

const VIDEO_TAGS = [
  'salih baba', 'salih baba dîvânı', 'salih baba divanı', 'erzurumlu salih baba',
  'tasavvuf', 'tasavvuf şiirleri', 'tasavvuf sözleri',
  'nakşibendi', 'nakşibendî', 'sufizm', 'sufi',
  'ilahi aşk', 'aşk-ı ilahi', 'divan edebiyatı', 'osmanlı şiiri',
  'tekke şiiri', 'marifet', 'tefekkür', 'shorts'
];

// ---- Beyit eslestirme ----
// Bir IG/YT basligindan veya video aciklamasindan hangi beyit oldugunu bul.
function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
}
function verseFirstLine(verse) {
  return (String(verse).split('\n').find(l => l.trim().length > 0) ?? '').trim();
}
function findVerseByText(text) {
  const n = normalize(text);
  for (const e of content) {
    const fl = verseFirstLine(e.verse);
    // Noktalama temizle ile karsilastir
    const flClean = fl.replace(/[.,;:]+$/, '').trim();
    if (n.includes(normalize(flClean))) return e;
  }
  return null;
}

// ---- OAuth ----
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token alinamadi: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ---- Kanal uploads playlist ID ----
async function getUploadsPlaylistId(token) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const id = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error(`Uploads playlist bulunamadi: ${JSON.stringify(data)}`);
  return id;
}

// ---- Tum videolari cek (sayfali) ----
async function getAllUploads(token, playlistId) {
  const videos = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    for (const item of data.items ?? []) {
      videos.push({
        videoId: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return videos;
}

// ---- Video guncelle ----
async function updateVideo(token, videoId, title, description) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title,
        description,
        tags: VIDEO_TAGS,
        categoryId: '29'
      }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`update ${videoId} basarisiz (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ==== Main ====
const token = await getAccessToken();
console.log('Token alindi.');

const playlistId = await getUploadsPlaylistId(token);
console.log(`Uploads playlist: ${playlistId}`);

const videos = await getAllUploads(token, playlistId);
console.log(`Toplam ${videos.length} video bulundu.\n`);

let updated = 0, skipped = 0, failed = 0;
for (const v of videos) {
  // Once mevcut basliktan, olmazsa aciklamadan beyti bul
  let entry = findVerseByText(v.title);
  if (!entry) entry = findVerseByText(v.description);

  if (!entry) {
    console.log(`⊘ ATLA: "${v.title?.slice(0, 50)}" - beyit eslestirilemedi`);
    skipped++;
    continue;
  }

  const newTitle = buildTitle(entry.verse);
  const newDesc = buildDescription({ verse: entry.verse, explanation: entry.explanation });

  try {
    await updateVideo(token, v.videoId, newTitle, newDesc);
    console.log(`✓ ${entry.id} (${v.videoId}): ${newTitle}`);
    updated++;
  } catch (e) {
    console.error(`✗ ${v.videoId}: ${e.message}`);
    failed++;
  }
  // Rate limit nezaket
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nTamamlandi: ${updated} guncellendi, ${skipped} atlandi, ${failed} hata.`);
