/**
 * Test: sb-0001 reel'i ElevenLabs sesi + ney muzigi ile uretir.
 *  - Verse: 16sn (12 yerine)
 *  - Verse periyodu boyunca insan sesi (voice MP3) baskin
 *  - Tum video boyunca ney muzigi arka planda (kisik)
 *  - Mana: 18sn (degismedi)
 *
 * Output: ~/Desktop/test-sb-0001-voice.mp4
 * Hicbir yere POST EDILMEZ - sadece lokal test.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fetchPexelsCandidates } from '../src/fetchPexelsVideo.js';
import { downloadVideo } from '../src/renderReel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'template');

const PEXELS_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_KEY) { console.error('PEXELS_API_KEY env var gerekli'); process.exit(1); }
const VOICE_MP3 = '/Users/yunusemrekaradeniz/Downloads/ElevenLabs_2026-05-27T19_17_29_Emin - Epic Historical Narrative_pvc_sp90_s50_sb91_se0_b_m2.mp3';
const BG_MUSIC = join(ROOT, 'audio', 'ney-acem-aniran-penrev.mp3');
const OUT_PATH = '/Users/yunusemrekaradeniz/Desktop/test-sb-0001-voice.mp4';

const FFMPEG_PATH = await import('ffmpeg-static').then(m => m.default);

function fillTemplate(name, vars) {
  let html = readFileSync(join(TEMPLATE_DIR, name), 'utf-8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return html;
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}\n${stderr.slice(-2000)}`));
    });
    proc.on('error', reject);
  });
}

async function renderHtmlToPng(html, outPath, browser) {
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const buf = await page.screenshot({ type: 'png', omitBackground: true });
  writeFileSync(outPath, buf);
  await page.close();
  await context.close();
}

// === Main ===
const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const entry = content.find(e => e.id === 'sb-0001');
if (!entry) throw new Error('sb-0001 bulunamadi');

console.log('1) Pexels videosu seciliyor...');
const candidates = await fetchPexelsCandidates(entry.moods, PEXELS_KEY, new Set());
const c = candidates[0];
console.log(`   Secildi: ${c.id} (${c.duration}sn, ${c.width}x${c.height})`);

const tmp = mkdtempSync(join(tmpdir(), 'voice-test-'));
const bgVideo = join(tmp, 'bg.mp4');
console.log('2) Video indiriliyor...');
await downloadVideo(c.url, bgVideo);

console.log('3) Overlay PNGleri render ediliyor...');
const browser = await chromium.launch();
try {
  const gradientPng = join(tmp, 'gradient.png');
  const versePng = join(tmp, 'verse.png');
  const manaPng = join(tmp, 'mana.png');

  await renderHtmlToPng(fillTemplate('reel-gradient.html', {}), gradientPng, browser);
  await renderHtmlToPng(fillTemplate('reel-verse-text.html', { verse: entry.verse, verseFontSize: '51px' }), versePng, browser);
  await renderHtmlToPng(fillTemplate('reel-mana-text.html', { explanation: entry.explanation, explanationFontSize: '51px' }), manaPng, browser);
  console.log('   PNG\'ler hazir');

  console.log('4) FFmpeg ile birlestiriliyor...');
  // Sure plani (16sn verse, 18sn mana, 35sn toplam):
  //  0-16    verse on screen (fade in 0-0.7, fade out 14.5-15.5)
  //  16-17   gecis
  //  17-35   mana (fade in 17-17.7, fade out 33.5-34.5)
  //  35-36   kapanis
  //
  // Audio:
  //  - Voice MP3: 0-16.5sn, full volume
  //  - Ney music: tum video boyunca, dusuk volume (0.25)
  //  - Mix edilir
  const filter =
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];` +
    `[1:v]scale=1080:1920:flags=lanczos,setpts=PTS-STARTPTS[grad];` +
    `[2:v]scale=1080:1920:flags=lanczos,format=rgba,fade=t=in:st=0:d=0.7:alpha=1,fade=t=out:st=14.5:d=1:alpha=1,setpts=PTS-STARTPTS[vtxt];` +
    `[3:v]scale=1080:1920:flags=lanczos,format=rgba,fade=t=in:st=0:d=0.7:alpha=1,fade=t=out:st=16.5:d=1:alpha=1,setpts=PTS+17/TB[mtxt];` +
    `[bg][grad]overlay=0:0[bg2];` +
    `[bg2][vtxt]overlay=0:0[tmp];` +
    `[tmp][mtxt]overlay=0:0,fade=t=out:st=35:d=1[outv];` +
    // Audio: voice 0-16.5s + ney background full duration, ney volume 0.25
    `[4:a]volume=1.0,afade=t=in:st=0:d=0.5,afade=t=out:st=15.5:d=1[voice];` +
    `[5:a]volume=0.25,afade=t=in:st=0:d=1,afade=t=out:st=35:d=1[bgmus];` +
    `[voice][bgmus]amix=inputs=2:duration=longest:dropout_transition=0[outa]`;

  const args = [
    '-y',
    '-stream_loop', '-1', '-i', bgVideo,
    '-loop', '1', '-t', '36', '-i', gradientPng,
    '-loop', '1', '-t', '16', '-i', versePng,
    '-loop', '1', '-t', '18', '-i', manaPng,
    '-i', VOICE_MP3,
    '-stream_loop', '-1', '-i', BG_MUSIC,
    '-filter_complex', filter,
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'slower',
    '-crf', '14',
    '-profile:v', 'high', '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-maxrate', '20M', '-bufsize', '40M',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    '-t', '36',
    OUT_PATH
  ];

  await ffmpeg(args);
  console.log(`\nHazir: ${OUT_PATH}`);
  console.log(`Boyut: 36 saniye, 1080x1920`);
  console.log(`Ses: Voice MP3 (0-16sn) + ney background (full duration)`);
} finally {
  await browser.close();
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
