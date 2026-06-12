/**
 * Mevcut gazel-XX.mp4'un video'sunu koruyup ses kismini yeniden mix eder.
 * Fix: amix normalize=0 ekler, boylece her ses tam volume duyulur.
 *
 * Kullanim: node scripts/fix-audio-normalize.js 1
 * Cikti: output/gazel-XX-audio-fixed.mp4
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { getAudioDuration } from '../src/generateVoice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AUDIO_DIR = join(ROOT, 'audio');
const INTRO = join(ROOT, 'assets', 'intro.mp4');
const OUT_DIR = join(ROOT, 'output');
const CACHE = join(OUT_DIR, 'audio-cache');

const ffmpegPath = (await import('ffmpeg-static')).default;
const FFMPEG = process.env.FFMPEG_PATH || ffmpegPath;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID;
if (!ELEVEN_VOICE) { console.error('ELEVENLABS_VOICE_ID env gerekli (cache hash icin)'); process.exit(1); }

const poemNo = parseInt(process.argv[2], 10);
if (!poemNo) { console.error('Kullanim: node scripts/fix-audio-normalize.js <poemNo>'); process.exit(1); }

const SRC = join(OUT_DIR, `gazel-${String(poemNo).padStart(2,'0')}.mp4`);
const DST = join(OUT_DIR, `gazel-${String(poemNo).padStart(2,'0')}-audio-fixed.mp4`);
if (!existsSync(SRC)) { console.error(`Kaynak yok: ${SRC}`); process.exit(1); }

// Sabitler (render scripti ile ayni olmali)
const INTRO_DUR = 5.04;
const CARD_LEAD = 0.8;
const CARD_TAIL = 1.2;
const PAUSE_AFTER_CARD = 1;
const BEYIT_LEAD = 0.8;
const BEYIT_TAIL = 1.0;
const SERH_LEAD = 0.6;
const SERH_TAIL = 1.5;
const UNIT_GAP = 1.0;
const FINAL_HOLD = 3.0;
const FADE_OUT = 1.5;

// Cache hash hesaplama (generateVoice.js ile ayni mantik)
// DIKKAT: DEFAULT_SETTINGS'te speed YOK (generateVoice.js modul-level tanim).
// SERH icin scriptin cagirdigi tam ayar (speed dahil) kullanilir.
const DEFAULT_SETTINGS = { stability: 0.5, similarity_boost: 0.95, style: 0, use_speaker_boost: true };
const SERH_SETTINGS    = { stability: 0.5, similarity_boost: 0.95, style: 0, use_speaker_boost: true, speed: 1.1 };
function cacheKey(text, settings) {
  return createHash('sha1').update(text + '|' + ELEVEN_VOICE + '|' + JSON.stringify(settings)).digest('hex').slice(0, 16);
}
function cachePath(text, settings) {
  return join(CACHE, cacheKey(text, settings) + '.mp3');
}

function ffmpeg(args) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => err += d.toString());
    p.on('close', c => c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${err.slice(-1200)}`)));
    p.on('error', rej);
  });
}

function gazelLabelOf(n) {
  const map = ['', 'Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci', 'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu'];
  return (map[n] || `${n}.`) + ' Gazel';
}

function listNey() {
  return readdirSync(AUDIO_DIR).filter(f => /^ney-.+\.mp3$/i.test(f)).sort().map(f => join(AUDIO_DIR, f));
}

// ---- Veriyi yukle ----
const poem = JSON.parse(readFileSync(join(ROOT, 'content', 'poems.json'), 'utf-8')).poems.find(p => p.poemNo === poemNo);
const units = poem.units.filter(u => u.beyit && u.beyit.trim() && u.serh && u.serh.trim());
console.log(`Gazel ${poemNo}: ${units.length} birim`);

// ---- Kart sesi + birim sesleri (cache'den) ----
const cardFirstLine = (poem.title || units[0].beyit.split('\n')[0]).replace(/[.,;:]+$/, '').trim();
const cardText = `${gazelLabelOf(poemNo)}.\n\n${cardFirstLine}.`;
const cardVoicePath = cachePath(cardText, DEFAULT_SETTINGS);
if (!existsSync(cardVoicePath)) { console.error(`Kart sesi cache'de yok: ${cardVoicePath}`); process.exit(1); }
const cardVoiceDur = await getAudioDuration(cardVoicePath);
console.log(`Kart sesi: ${cardVoiceDur.toFixed(2)}sn`);

const unitAudios = [];
for (let i = 0; i < units.length; i++) {
  const u = units[i];
  const bp = cachePath(u.beyit, DEFAULT_SETTINGS);
  const sp = cachePath(u.serh, SERH_SETTINGS);
  if (!existsSync(bp) || !existsSync(sp)) {
    console.error(`Birim ${i+1} ses cache'de yok:`, bp, sp);
    process.exit(1);
  }
  const bd = await getAudioDuration(bp);
  const sd = await getAudioDuration(sp);
  unitAudios.push({ beyitPath: bp, beyitDur: bd, serhPath: sp, serhDur: sd });
  console.log(`Birim ${i+1}: beyit ${bd.toFixed(1)}sn / serh ${sd.toFixed(1)}sn`);
}

// ---- Timing (intro=0 saymıyoruz, body 0'dan baslar; final mux'ta intro_dur ekleyecegiz) ----
const cardDur = CARD_LEAD + cardVoiceDur + CARD_TAIL;
let t = cardDur + PAUSE_AFTER_CARD;
const schedule = [];
for (let i = 0; i < units.length; i++) {
  const beyitStart = t + BEYIT_LEAD;
  const beyitEnd = beyitStart + unitAudios[i].beyitDur + BEYIT_TAIL;
  const serhStart = beyitEnd + UNIT_GAP + SERH_LEAD;
  const serhEnd = serhStart + unitAudios[i].serhDur + SERH_TAIL;
  schedule.push({ beyitStart, beyitEnd, serhStart, serhEnd });
  t = serhEnd;
}
const finalFadeStart = t + FINAL_HOLD;
const bodyTotalLen = finalFadeStart + FADE_OUT;
console.log(`Body suresi: ${bodyTotalLen.toFixed(1)}sn (intro ile toplam ${(INTRO_DUR + bodyTotalLen).toFixed(1)}sn)`);

// ---- Tmp ----
const tmp = mkdtempSync(join(tmpdir(), 'audiofix-'));
console.log('Tmp:', tmp);
try {
  // ---- Muzik (sequential, body suresi kadar) ----
  const tracks = listNey();
  const musicList = [];
  let mDur = 0, tIdx = 0;
  while (mDur < bodyTotalLen) {
    const tr = tracks[tIdx % tracks.length];
    musicList.push(tr);
    mDur += await getAudioDuration(tr);
    tIdx++;
  }
  const musicConcat = musicList.map(m => `file '${m.replace(/'/g, "'\\''")}'`).join('\n');
  writeFileSync(join(tmp, 'music.txt'), musicConcat);
  const musicPath = join(tmp, 'music.aac');
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'music.txt'),
    '-t', String(bodyTotalLen), '-c:a', 'aac', '-b:a', '192k', musicPath]);
  console.log(`Muzik hazir (${musicList.length} parca)`);

  // ---- Body audio: amix normalize=0 ile yeniden ----
  const args = ['-y', '-i', musicPath, '-i', cardVoicePath];
  const voiceInputBase = 2;
  for (const a of unitAudios) args.push('-i', a.beyitPath, '-i', a.serhPath);

  const f = [];
  f.push(`[0:a]volume=0.30,afade=t=in:st=0:d=1,afade=t=out:st=${finalFadeStart.toFixed(2)}:d=${FADE_OUT}[mus]`);
  const cardDelayMs = Math.round(CARD_LEAD * 1000);
  const cardFadeOut = cardVoiceDur - 0.3;
  f.push(`[1:a]volume=1.0,afade=t=out:st=${cardFadeOut.toFixed(2)}:d=0.4,adelay=${cardDelayMs}|${cardDelayMs}[cv]`);
  const labels = ['[mus]', '[cv]'];
  for (let i = 0; i < units.length; i++) {
    const bi = voiceInputBase + i*2, si = bi+1;
    const bDelay = Math.round(schedule[i].beyitStart * 1000);
    const sDelay = Math.round(schedule[i].serhStart * 1000);
    const bFadeOut = unitAudios[i].beyitDur - 0.3;
    const sFadeOut = unitAudios[i].serhDur - 0.3;
    f.push(`[${bi}:a]volume=1.0,afade=t=out:st=${bFadeOut.toFixed(2)}:d=0.4,adelay=${bDelay}|${bDelay}[bv${i}]`);
    f.push(`[${si}:a]volume=1.0,afade=t=out:st=${sFadeOut.toFixed(2)}:d=0.4,adelay=${sDelay}|${sDelay}[sv${i}]`);
    labels.push(`[bv${i}]`, `[sv${i}]`);
  }
  // KRITIK FIX: normalize=0
  f.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0[outa]`);

  const fcFile = join(tmp, 'fc.txt');
  writeFileSync(fcFile, f.join(';'));
  const bodyAudio = join(tmp, 'body.aac');
  args.push('-filter_complex_script', fcFile, '-map', '[outa]',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(bodyTotalLen), bodyAudio);
  await ffmpeg(args);
  console.log('Body audio (normalize=0) hazir');

  // ---- Intro audio'su (intro.mp4'tan extract) ----
  const introAudio = join(tmp, 'intro.aac');
  await ffmpeg(['-y', '-i', INTRO, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', introAudio]);

  // ---- Tam audio: intro + body concat ----
  const audioList = `file '${introAudio.replace(/'/g, "'\\''")}'\nfile '${bodyAudio.replace(/'/g, "'\\''")}'`;
  writeFileSync(join(tmp, 'aconcat.txt'), audioList);
  const fullAudio = join(tmp, 'full.aac');
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'aconcat.txt'),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', fullAudio]);
  console.log('Tam audio (intro+body) hazir');

  // ---- Final: SRC video + yeni audio ----
  console.log('Mux ediliyor...');
  await ffmpeg(['-y', '-i', SRC, '-i', fullAudio,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', DST]);
  console.log(`\n✓ HAZIR: ${DST}`);
  console.log(`Boyut: ${(statSync(DST).size/(1024*1024)).toFixed(1)} MB`);
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
