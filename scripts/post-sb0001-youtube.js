/**
 * sb-0001'i YouTube Shorts olarak render edip yukler (tek seferlik).
 */
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchPexelsCandidates } from '../src/fetchPexelsVideo.js';
import { validateVideoFrames } from '../src/checkVideoFrames.js';
import { renderReel, downloadVideo, pickAudioByIndex, listAudioTracks } from '../src/renderReel.js';
import { uploadToYoutube } from '../src/uploadToYoutube.js';
import { buildCaption } from '../src/buildCaption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PEXELS_KEY       = process.env.PEXELS_API_KEY;
const GEMINI_KEY       = process.env.GEMINI_API_KEY;
const YT_CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YT_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
for (const [k, v] of Object.entries({ PEXELS_KEY, GEMINI_KEY, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN })) {
  if (!v) { console.error(`Env var eksik: ${k}`); process.exit(1); }
}

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const state   = JSON.parse(readFileSync(join(ROOT, 'output', 'log.json'), 'utf-8'));

const entry = content.find(e => e.id === 'sb-0001');
if (!entry) throw new Error('sb-0001 bulunamadi');

console.log(`Misra: ${entry.verse.split('\n')[0]}...`);
console.log(`Mood: ${entry.moods.join(', ')}`);

// Kullanilmis video ID'leri (sb-0001 icin temiz basla ama mevcut listeden de kacin)
const usedVideoIds = new Set(state.usedVideoIds ?? []);

// 1) Pexels'ten aday videolar
const candidates = await fetchPexelsCandidates(entry.moods, PEXELS_KEY, usedVideoIds);
console.log(`\n${candidates.length} Pexels aday bulundu, moderasyondan geciriliyor...`);

const tmpDir = mkdtempSync(join(tmpdir(), 'sb0001-'));
let chosen = null;
let chosenPath = null;

try {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const localPath = join(tmpDir, `cand-${i}.mp4`);
    console.log(`[${i + 1}/${candidates.length}] ${c.id} indiriliyor...`);
    await downloadVideo(c.url, localPath);

    const result = await validateVideoFrames(localPath, c.duration, GEMINI_KEY);
    if (result.approved) {
      console.log(`✓ ${c.id} onaylandi`);
      chosen = c;
      chosenPath = localPath;
      break;
    }
    console.log(`✗ ${c.id} reddedildi: ${result.reason}`);
  }

  if (!chosen) throw new Error('Hicbir aday moderasyondan gecemedi');

  // 2) Muzik
  const tracks = listAudioTracks();
  const audioPath = tracks.length > 0 ? pickAudioByIndex(0) : null;
  if (audioPath) console.log(`Muzik: ${audioPath.split('/').pop()}`);

  // 3) Reel render
  const today = new Date().toISOString().slice(0, 10);
  const outVideo = join(ROOT, 'output', `sb-0001-yt.mp4`);
  console.log('\nReel render ediliyor...');
  await renderReel({
    verse: entry.verse,
    explanation: entry.explanation || '',
    videoPath: chosenPath,
    audioPath,
    outPath: outVideo
  });
  console.log(`Reel hazir: ${outVideo}`);

  // 4) YouTube upload
  const caption = buildCaption(entry, today);
  console.log('\nYouTube Shorts yuklenıyor...');
  const { videoId, url } = await uploadToYoutube({
    videoPath: outVideo,
    verse: entry.verse,
    caption,
    clientId: YT_CLIENT_ID,
    clientSecret: YT_CLIENT_SECRET,
    refreshToken: YT_REFRESH_TOKEN
  });

  console.log(`\n✓ YouTube Shorts yuklendi!`);
  console.log(`  Video ID : ${videoId}`);
  console.log(`  URL      : ${url}`);

} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
