/**
 * VOICEOVER TEST: sb-0041'i verse + mana iki sesli olarak render eder.
 *
 * Akis:
 *  1. ElevenLabs ile verse sesi uret + sure olc
 *  2. ElevenLabs ile mana sesi uret + sure olc
 *  3. Pexels'ten video sec
 *  4. renderReel ile birlestir: verse periyodunda verse voice, mana periyodunda mana voice
 *  5. Output: ~/Desktop/test-voiceover-sb-0041.mp4
 *
 * Hicbir yere POST EDILMEZ. Orijinal sistem dokunulmaz.
 */
import { readFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateVoice, getAudioDuration } from '../src/generateVoice.js';
import { fetchPexelsCandidates } from '../src/fetchPexelsVideo.js';
import { renderReel, downloadVideo, pickAudioByIndex, listAudioTracks } from '../src/renderReel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PEXELS_KEY = 'FfYvsftVEt3tjnLIf1SLrMykrrTBkOJSUGW5sYPWC25dfpNKyVHEyv9o';
const ELEVEN_API_KEY = 'sk_1dcb9d8049477a8fe76ac530cbbcba1fbea1029bcb549d72';
const ELEVEN_VOICE_ID = 'j9K9HnBcmgA6xNWqjlX0';
const VERSE_ID = process.argv[2] || 'sb-0041';
const OUT_PATH = `/Users/yunusemrekaradeniz/Desktop/test-voiceover-${VERSE_ID}.mp4`;

// FFmpeg path for local
const { default: ffmpegPath } = await import('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const entry = content.find(e => e.id === VERSE_ID);
if (!entry) throw new Error(`${VERSE_ID} bulunamadi`);

console.log(`Beyit: ${VERSE_ID}`);
console.log(`Verse (${entry.verse.length} char), Mana (${entry.explanation.length} char)`);
console.log();

// 1) Verse voice
const audioCacheDir = join(ROOT, 'output', 'audio-cache');
mkdirSync(audioCacheDir, { recursive: true });

console.log('1) Verse voice uretiliyor...');
const versePath = await generateVoice({
  text: entry.verse,
  voiceId: ELEVEN_VOICE_ID,
  apiKey: ELEVEN_API_KEY,
  cacheDir: audioCacheDir
});
const verseDur = await getAudioDuration(versePath);
console.log(`   Sure: ${verseDur.toFixed(2)}sn`);
console.log();

// 2) Mana voice
console.log('2) Mana voice uretiliyor...');
const manaPath = await generateVoice({
  text: entry.explanation,
  voiceId: ELEVEN_VOICE_ID,
  apiKey: ELEVEN_API_KEY,
  cacheDir: audioCacheDir
});
const manaDur = await getAudioDuration(manaPath);
console.log(`   Sure: ${manaDur.toFixed(2)}sn`);
console.log();

// 3) Pexels video
console.log('3) Pexels video seciliyor (moderasyon atlandi)...');
const candidates = await fetchPexelsCandidates(entry.moods, PEXELS_KEY, new Set());
const c = candidates[0];
console.log(`   Secildi: ${c.id} (${c.width}x${c.height}, ${c.duration}sn)`);
const tmp = mkdtempSync(join(tmpdir(), 'voiceover-'));
const bgVideo = join(tmp, 'bg.mp4');
await downloadVideo(c.url, bgVideo);
console.log(`   Indirildi`);
console.log();

// 4) Background music
const tracks = listAudioTracks();
const bgMusic = tracks.length > 0 ? pickAudioByIndex(0) : null;
if (bgMusic) console.log(`Müzik: ${bgMusic.split('/').pop()}`);

// 5) Render
console.log('4) Reel birlestiriliyor...');
console.log(`   Toplam sure: ~${Math.round(verseDur + 2 + 1 + manaDur + 2 + 2)}sn`);
await renderReel({
  verse: entry.verse,
  explanation: entry.explanation,
  videoPath: bgVideo,
  audioPath: bgMusic,
  voicePath: versePath,
  voiceDuration: verseDur,
  manaVoicePath: manaPath,
  manaVoiceDuration: manaDur,
  outPath: OUT_PATH
});

console.log(`\n✓ Hazir: ${OUT_PATH}`);
try { rmSync(tmp, { recursive: true, force: true }); } catch {}
