/**
 * Aciklamasiz (sadece beyit) Short ornegi.
 * Beyit okunur, mana yok. Kisa video (~15-20sn).
 * Kullanim: node scripts/test-verse-only.js [verseId]
 * Cikti: ~/Desktop/aciklamasiz-ornek.mp4
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fetchPexelsCandidates } from '../src/fetchPexelsVideo.js';
import { generateVoice, getAudioDuration } from '../src/generateVoice.js';
import { downloadVideo, pickAudioByIndex } from '../src/renderReel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'template');
const FFMPEG = process.env.FFMPEG_PATH || (await import('ffmpeg-static')).default;
const PEXELS = process.env.PEXELS_API_KEY;
const EK = process.env.ELEVENLABS_API_KEY;
const EV = process.env.ELEVENLABS_VOICE_ID;

const verseId = process.argv[2] || 'sb-0011';
const OUT = '/Users/yunusemrekaradeniz/Desktop/aciklamasiz-ornek.mp4';

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const entry = content.find(e => e.id === verseId);

function ffmpeg(args) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; p.stderr.on('data', d => err += d);
    p.on('close', c => c === 0 ? res() : rej(new Error(err.slice(-1200))));
  });
}
function fill(name, vars) {
  let h = readFileSync(join(TEMPLATE_DIR, name), 'utf-8');
  for (const [k, v] of Object.entries(vars)) h = h.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  return h;
}
async function png(html, out, browser) {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.setContent(html, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(700);
  writeFileSync(out, await pg.screenshot({ type: 'png', omitBackground: true }));
  await ctx.close();
}

const tmp = mkdtempSync(join(tmpdir(), 'vo-'));
try {
  console.log('1) Beyit sesi...');
  const vp = await generateVoice({ text: entry.verse, voiceId: EV, apiKey: EK, cacheDir: join(ROOT, 'output', 'audio-cache') });
  const vdur = await getAudioDuration(vp);
  console.log(`   ${vdur.toFixed(1)}sn`);

  // Timing: 0.8 lead + voice + 1.0 tail, sonra 1.2 fade
  const LEAD = 0.8, TAIL = 1.0, FADE = 1.2;
  const total = LEAD + vdur + TAIL + FADE;
  const fadeStart = LEAD + vdur + TAIL;
  console.log(`Toplam: ${total.toFixed(1)}sn`);

  console.log('2) Pexels video...');
  const cands = await fetchPexelsCandidates(entry.moods, PEXELS, new Set());
  const c = cands[0];
  const bg = join(tmp, 'bg.mp4');
  await downloadVideo(c.url, bg);

  console.log('3) Overlay PNG...');
  const browser = await chromium.launch();
  const gradPng = join(tmp, 'g.png'), versePng = join(tmp, 'v.png');
  await png(fill('reel-gradient.html', {}), gradPng, browser);
  await png(fill('reel-verse-text.html', { verse: entry.verse, verseFontSize: '51px' }), versePng, browser);
  await browser.close();

  console.log('4) Muzik...');
  const music = pickAudioByIndex(0);

  console.log('5) Compose...');
  const filter =
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[bg];` +
    `[1:v]scale=1080:1920:flags=lanczos,setpts=PTS-STARTPTS[grad];` +
    `[2:v]scale=1080:1920:flags=lanczos,format=rgba,fade=t=in:st=0:d=0.7:alpha=1,setpts=PTS-STARTPTS[vt];` +
    `[bg][grad]overlay=0:0[b2];[b2][vt]overlay=0:0,fade=t=out:st=${fadeStart.toFixed(2)}:d=${FADE}[outv];` +
    `[3:a]volume=1.0,afade=t=out:st=${(vdur-0.3).toFixed(2)}:d=0.4,adelay=800|800[voice];` +
    `[4:a]volume=0.28,afade=t=in:st=0:d=1,afade=t=out:st=${fadeStart.toFixed(2)}:d=${FADE}[mus];` +
    `[voice][mus]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[outa]`;

  await ffmpeg([
    '-y',
    '-stream_loop', '-1', '-i', bg,
    '-loop', '1', '-t', String(total), '-i', gradPng,
    '-loop', '1', '-t', String(total), '-i', versePng,
    '-i', vp,
    '-stream_loop', '-1', '-i', music,
    '-filter_complex', filter,
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'slower', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-t', String(total), OUT
  ]);
  console.log(`\n✓ HAZIR: ${OUT}`);
} finally { rmSync(tmp, { recursive: true, force: true }); }
