import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, '..', 'template');
const AUDIO_DIR = join(__dirname, '..', 'audio');

/**
 * audio/ klasöründeki MP3'leri sıralı olarak listeler.
 * Index'e göre rotation yapılır - aynı sıra her zaman aynı parçayı seçer.
 */
export function listAudioTracks() {
  if (!existsSync(AUDIO_DIR)) return [];
  return readdirSync(AUDIO_DIR)
    .filter(f => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f))
    .sort()
    .map(f => join(AUDIO_DIR, f));
}

export function pickAudioByIndex(index) {
  const tracks = listAudioTracks();
  if (tracks.length === 0) return null;
  return tracks[index % tracks.length];
}

function calcVerseFontSize(verse) {
  // Auto-scale JS HTML içinde halleder, sabit 51 başlat
  return 51;
}

function calcExplanationFontSize(_explanation) {
  // Sabit 51 başlat, HTML icindeki JS sigmazsa kuculur.
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

export async function downloadVideo(url, outPath) {
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
 * @param {string} [opts.videoUrl] - Pexels video URL (videoPath verilmediyse indirilir)
 * @param {string} [opts.videoPath] - lokal MP4 yolu (zaten indirilmiş)
 * @param {string} [opts.audioPath] - opsiyonel arka plan müziği (mp3/m4a/wav). Verilmezse sessiz.
 * @param {string} opts.outPath - çıkış MP4 yolu
 */
export async function renderReel({ verse, explanation, videoUrl, videoPath, audioPath, outPath }) {
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

    // 2) Pexels videosunu indir (gerekirse)
    let actualVideoPath = videoPath;
    if (!actualVideoPath) {
      actualVideoPath = join(tmp, 'bg.mp4');
      await downloadVideo(videoUrl, actualVideoPath);
      console.log('Pexels video indirildi');
    }

    // 3) FFmpeg ile compose et
    // Süre planı:
    //  0-9   verse (fade in 0-0.7, fade out 7.5-8.5)
    //  9-10  geçiş (sade arka plan)
    //  10-23 mana (fade in 10-10.7, fade out 21.5-22.5) - 13 saniye toplam
    //  23-25 kapanış (final fade 24-25)
    const filterComplex =
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];` +
      `[1:v]setpts=PTS-STARTPTS[grad];` +
      `[2:v]format=rgba,fade=t=out:st=7.5:d=1:alpha=1,setpts=PTS-STARTPTS[vtxt];` +
      `[3:v]format=rgba,fade=t=in:st=0:d=0.7:alpha=1,fade=t=out:st=11.5:d=1:alpha=1,setpts=PTS+10/TB[mtxt];` +
      `[bg][grad]overlay=0:0[bg2];` +
      `[bg2][vtxt]overlay=0:0[tmp];` +
      `[tmp][mtxt]overlay=0:0,fade=t=out:st=24:d=1[outv]`;

    const args = [
      '-y',
      '-stream_loop', '-1', '-i', actualVideoPath,
      '-loop', '1', '-t', '25', '-i', gradientPng,
      '-loop', '1', '-t', '9',  '-i', versePng,
      '-loop', '1', '-t', '13', '-i', manaPng
    ];

    if (audioPath && existsSync(audioPath)) {
      // Müzik var: video stream'i ile birlikte ses de eklenir
      console.log(`Müzik ekleniyor: ${audioPath}`);
      args.push(
        '-stream_loop', '-1', '-i', audioPath,
        '-filter_complex', filterComplex + `;[4:a]afade=t=in:st=0:d=1,afade=t=out:st=24:d=1,volume=0.85[outa]`,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'
      );
    } else {
      args.push(
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-an'
      );
    }

    args.push(
      '-c:v', 'libx264',
      '-preset', 'slower',
      '-crf', '14',
      '-profile:v', 'high', '-level', '4.2',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-maxrate', '20M', '-bufsize', '40M',
      '-movflags', '+faststart',
      '-t', '25',
      outPath
    );

    await ffmpeg(args);
    console.log(`Reel video hazir: ${outPath}`);
  } finally {
    await browser.close();
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}
