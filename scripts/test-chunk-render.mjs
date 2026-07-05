// Belirli bir chunk'i verse-only reel olarak render eder (test).
// Kullanim: node scripts/test-chunk-render.mjs ch-0394
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildChunks } from '../src/buildChunks.js';
import { fetchPexelsCandidates } from '../src/fetchPexelsVideo.js';
import { generateVoice, getAudioDuration } from '../src/generateVoice.js';
import { renderReel, downloadVideo, pickAudioByIndex } from '../src/renderReel.js';

const ROOT = new URL('..', import.meta.url).pathname;
const chunkId = process.argv[2] || 'ch-0394';
const OUT = `/Users/yunusemrekaradeniz/Desktop/ornek-${chunkId}.mp4`;

const { chunks } = buildChunks();
const chunk = chunks.find(c => c.id === chunkId);
if (!chunk) { console.error('chunk yok:', chunkId); process.exit(1); }
console.log(`${chunk.id} | Siir ${chunk.poemNo} | ${chunk.lineCount} satir`);
console.log('En uzun satir:', Math.max(...chunk.text.split('\n').map(l=>l.length)), 'char');

const tmp = mkdtempSync(join(tmpdir(), 'ct-'));
try {
  console.log('1) Ses...');
  const voicePath = await generateVoice({
    text: chunk.text,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    apiKey: process.env.ELEVENLABS_API_KEY,
    cacheDir: join(ROOT, 'output', 'audio-cache')
  });
  const voiceDuration = await getAudioDuration(voicePath);
  console.log(`   ${voiceDuration.toFixed(1)}sn`);

  console.log('2) Pexels...');
  const cands = await fetchPexelsCandidates(chunk.moods, process.env.PEXELS_API_KEY, new Set());
  const bg = join(tmp, 'bg.mp4');
  await downloadVideo(cands[0].url, bg);

  console.log('3) renderReel (verse-only)...');
  await renderReel({
    verse: chunk.text,
    explanation: '',
    videoPath: bg,
    audioPath: pickAudioByIndex(4),
    voicePath,
    voiceDuration,
    outPath: OUT
  });
  console.log('HAZIR:', OUT);
} finally { rmSync(tmp, { recursive: true, force: true }); }
