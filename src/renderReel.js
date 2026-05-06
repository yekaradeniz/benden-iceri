import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', 'template');

function calcVerseFontSize(verse) {
  // Auto-scale JS HTML içinde halleder, sabit 51 başlat
  return 51;
}

function calcExplanationFontSize(explanation) {
  // Mana'da yazı verse boyutuna yakın olsun (ekrandan taşması serbest).
  const chars = explanation.length;
  if (chars > 600) return 42;
  if (chars > 480) return 46;
  if (chars > 360) return 49;
  return 51;
}

function fillTemplate(name, vars) {
  let html = readFileSync(join(TEMPLATE_DIR, name), 'utf-8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return html;
}

async function renderHtmlToPng(html, outPath, browser) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const buf = await page.screenshot({ type: 'png', omitBackground: true });
  writeFileSync(outPath, buf);
  await page.close();
}

async function downloadVideo(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Video indirilemedi: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}\n${stderr.slice(-2000)}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Reel oluşturur: 3 overlay (gradient + verse + mana) + Pexels video → MP4.
 * Toplam ~21 saniye, dikey 1080x1920.
 *
 * @param {object} opts
 * @param {string} opts.verse
 * @param {string} opts.explanation
 * @param {string} opts.videoUrl - Pexels video URL
 * @param {string} opts.outPath - çıkış MP4 yolu
 */
export async function renderReel({ verse, explanation, videoUrl, outPath }) {
  const tmp = mkdtempSync(join(tmpdir(), 'reel-'));
  const browser = await chromium.launch();
  try {
    // 1) Overlay PNG'leri render et
    const gradientHtml = fillTemplate('reel-gradient.html', {});
    const verseHtml = fillTemplate('reel-verse-text.html', {
      verse,
      verseFontSize: `${calcVerseFontSize(verse)}px`
    });
    const manaHtml = fillTemplate('reel-mana-text.html', {
      explanation,
      explanationFontSize: `${calcExplanationFontSize(explanation)}px`
    });

    const gradientPng = join(tmp, 'gradient.png');
    const versePng = join(tmp, 'verse.png');
    const manaPng = join(tmp, 'mana.png');
    await renderHtmlToPng(gradientHtml, gradientPng, browser);
    await renderHtmlToPng(verseHtml, versePng, browser);
    await renderHtmlToPng(manaHtml, manaPng, browser);
    console.log('Overlay PNGleri hazir');

    // 2) Pexels videosunu indir
    const videoPath = join(tmp, 'bg.mp4');
    await downloadVideo(videoUrl, videoPath);
    console.log('Pexels video indirildi');

    // 3) FFmpeg ile compose et
    await ffmpeg([
      '-y',
      '-stream_loop', '-1', '-i', videoPath,        // bg video (kısa olsa da loop)
      '-loop', '1', '-t', '21', '-i', gradientPng,
      '-loop', '1', '-t', '9',  '-i', versePng,
      '-loop', '1', '-t', '9',  '-i', manaPng,
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];` +
      `[1:v]setpts=PTS-STARTPTS[grad];` +
      `[2:v]format=rgba,fade=t=out:st=7.5:d=1:alpha=1,setpts=PTS-STARTPTS[vtxt];` +
      `[3:v]format=rgba,fade=t=in:st=0:d=0.7:alpha=1,fade=t=out:st=7.5:d=1:alpha=1,setpts=PTS+10/TB[mtxt];` +
      `[bg][grad]overlay=0:0[bg2];` +
      `[bg2][vtxt]overlay=0:0[tmp];` +
      `[tmp][mtxt]overlay=0:0,fade=t=out:st=20:d=1[outv]`,
      '-map', '[outv]',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-t', '21',
      outPath
    ]);
    console.log(`Reel video hazir: ${outPath}`);
  } finally {
    await browser.close();
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}
