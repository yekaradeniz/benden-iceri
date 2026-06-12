/**
 * Long-form yatay video (1920x1080) - bir gazel + serh + intro + outro.
 *
 * Akis:
 *   1. assets/intro.mp4 (5sn, ney sting'li, hazir)
 *   2. Sahne 1: Cami videosu uzerinde sair karti (gazel + ilk misra), 7sn
 *   3. 1sn bekleme (sade gradient)
 *   4. Her birim icin: beyit (oku) -> serh (oku) -> 1sn gecis
 *   5. Son birimden sonra 3sn net devam, 1.5sn fade out (video + ses)
 *
 * Arka plan video: yeteri kadar landscape klip alinir, uc uca eklenir (LOOP YOK).
 * Muzik: ney parcalari sirayla uc uca eklenir (LOOP YOK).
 *
 * Kullanim:
 *   node scripts/render-longform-poem.js 1            # tum birimleri renderler
 *   node scripts/render-longform-poem.js 1 --units 2  # sadece ilk 2 birim (test)
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fetchPexelsCandidates } from '../src/fetchPexelsVideo.js';
import { generateVoice, getAudioDuration } from '../src/generateVoice.js';
import { downloadVideo } from '../src/renderReel.js';
import { validateVideoFrames } from '../src/checkVideoFrames.js';

// ---------- Path & env ----------
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'template');
const AUDIO_DIR = join(ROOT, 'audio');
const INTRO = join(ROOT, 'assets', 'intro.mp4');
const OUT_DIR = join(ROOT, 'output');

const ffmpegPath = (await import('ffmpeg-static')).default;
const FFMPEG = process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg';

const PEXELS_KEY  = process.env.PEXELS_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const ELEVEN_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID;
for (const [n, v] of Object.entries({ PEXELS_KEY, ELEVEN_KEY, ELEVEN_VOICE })) {
  if (!v) { console.error('Env eksik:', n); process.exit(1); }
}

// ---------- CLI ----------
const args = process.argv.slice(2);
const poemNo = parseInt(args[0], 10);
if (!poemNo) { console.error('Kullanim: node scripts/render-longform-poem.js <poemNo> [--units N]'); process.exit(1); }
const limitIdx = args.indexOf('--units');
const unitsLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

// ---------- Data ----------
const poems = JSON.parse(readFileSync(join(ROOT, 'content', 'poems.json'), 'utf-8')).poems;
const poem = poems.find(p => p.poemNo === poemNo);
if (!poem) { console.error(`Poem ${poemNo} bulunamadi`); process.exit(1); }

let units = poem.units.filter(u => u.beyit && u.beyit.trim() && u.serh && u.serh.trim());
if (unitsLimit) units = units.slice(0, unitsLimit);
if (units.length === 0) { console.error('Doldurulmus birim yok'); process.exit(1); }
console.log(`Gazel ${poemNo}: "${poem.title}" - ${units.length} birim render edilecek.`);

// ---------- Helpers ----------
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-1500)}`)));
    proc.on('error', reject);
  });
}

function fillTemplate(name, vars) {
  let html = readFileSync(join(TEMPLATE_DIR, name), 'utf-8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return html;
}

async function renderHtmlToPng(html, outPath, browser) {
  // 2x retina render -> ffmpeg lanczos ile 1920x1080'e dusururuz (text keskinligi)
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));
  const buf = await page.screenshot({ type: 'png', omitBackground: true });
  writeFileSync(outPath, buf);
  await page.close();
  await ctx.close();
}

function gazelLabelOf(n) {
  const map = ['', 'Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci', 'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu'];
  return (map[n] || `${n}.`) + ' Gazel';
}

function listNeyTracks() {
  return readdirSync(AUDIO_DIR)
    .filter(f => /^ney-.+\.mp3$/i.test(f))
    .sort()
    .map(f => join(AUDIO_DIR, f));
}

// ---------- Plan: timing ----------
// Sahne sureleri:
//   intro: 5.04s
//   poem-card: card_voice_dur + 2s buffer (0.8 lead + voice + 1.2 trail)
//   pause-1: 1s
//   unit: beyit_voice + 1s tail + 1s gap + serh_voice + 1.5s tail
//   final-hold: 3s
//   fade-out: 1.5s
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

// ---------- Main ----------
const tmp = mkdtempSync(join(tmpdir(), 'lf-'));
console.log('Tmp:', tmp);

try {
  // 1) ElevenLabs ile her birim icin ses uret + siir karti icin tek sesli giris
  const cacheDir = join(OUT_DIR, 'audio-cache');
  console.log('\n=== Sesler uretiliyor (ElevenLabs) ===');

  // Siir karti sesi: "Birinci Gazel. [ilk misra]." - gazel adi + ilk misra
  const cardFirstLine = (poem.title || units[0].beyit.split('\n')[0]).replace(/[.,;:]+$/, '').trim();
  const cardText = `${gazelLabelOf(poemNo)}.\n\n${cardFirstLine}.`;
  console.log('Siir karti sesi (ElevenLabs)...');
  const cardVoicePath = await generateVoice({
    text: cardText, voiceId: ELEVEN_VOICE, apiKey: ELEVEN_KEY, cacheDir
  });
  const cardVoiceDur = await getAudioDuration(cardVoicePath);
  console.log(`  Kart sesi: ${cardVoiceDur.toFixed(1)}sn`);

  const unitAudios = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    console.log(`Birim ${i+1}/${units.length}: beyit + serh sesi`);
    const beyitPath = await generateVoice({
      text: u.beyit, voiceId: ELEVEN_VOICE, apiKey: ELEVEN_KEY, cacheDir
    });
    const beyitDur = await getAudioDuration(beyitPath);
    // Serh icin biraz hizli okuma (1.1x) - long-form ama yine de surukleyici olsun
    const serhPath = await generateVoice({
      text: u.serh, voiceId: ELEVEN_VOICE, apiKey: ELEVEN_KEY, cacheDir,
      settings: { stability: 0.5, similarity_boost: 0.95, style: 0, use_speaker_boost: true, speed: 1.1 }
    });
    const serhDur = await getAudioDuration(serhPath);
    unitAudios.push({ beyitPath, beyitDur, serhPath, serhDur });
    console.log(`  beyit ${beyitDur.toFixed(1)}sn, serh ${serhDur.toFixed(1)}sn`);
  }

  // 2) Toplam sure hesabi
  const cardDur = CARD_LEAD + cardVoiceDur + CARD_TAIL;  // dinamik kart suresi
  let bodyDur = cardDur + PAUSE_AFTER_CARD;
  for (const a of unitAudios) {
    bodyDur += BEYIT_LEAD + a.beyitDur + BEYIT_TAIL + UNIT_GAP + SERH_LEAD + a.serhDur + SERH_TAIL;
  }
  bodyDur += FINAL_HOLD;
  const bodyDurWithFade = bodyDur + FADE_OUT;
  console.log(`\nKart suresi: ${cardDur.toFixed(1)}sn | Govde: ${bodyDur.toFixed(1)}sn (+ ${FADE_OUT}sn fade)`);
  console.log(`Toplam video (intro dahil): ${(INTRO_DUR + bodyDurWithFade).toFixed(1)}sn`);

  // 3) Pexels landscape videolari topla (loop yapmadan kapsamak icin)
  console.log('\n=== Pexels landscape klipleri (cami) ===');
  const moods = ['ic-dunya', 'mihrap', 'tefekkür'];  // mevcut mood query setimiz
  const pexels = await fetchPexelsCandidates(moods, PEXELS_KEY, new Set(), {
    orientation: 'landscape',
    minCandidates: 30,                 // 30 aday cek
    durationRanges: [
      { min: 10, max: 60 },
      { min: 8, max: 90 }
    ]
  });
  console.log(`${pexels.length} aday bulundu.`);

  // 4) Moderasyon ve indirme - hedef sureye kadar
  const chosen = [];
  let coveredDur = 0;
  const targetVideoDur = bodyDurWithFade + 2; // biraz fazla, son fade icin
  const vidDir = join(tmp, 'pex');
  mkdirSync(vidDir, { recursive: true });
  let idx = 0;
  for (const c of pexels) {
    if (coveredDur >= targetVideoDur) break;
    const localPath = join(vidDir, `c${idx}.mp4`);
    console.log(`[${idx+1}] ${c.id} (${c.duration}sn) indiriliyor...`);
    try { await downloadVideo(c.url, localPath); } catch (e) { console.log(`  indir hatasi: ${e.message}`); continue; }
    // Moderasyon (Gemini varsa)
    if (GEMINI_KEY) {
      const r = await validateVideoFrames(localPath, c.duration, GEMINI_KEY);
      if (!r.approved) { console.log(`  ✗ moderasyon: ${r.reason}`); continue; }
    }
    chosen.push({ path: localPath, duration: c.duration });
    coveredDur += c.duration;
    idx++;
    console.log(`  ✓ kabul (toplam kapsama: ${coveredDur.toFixed(0)}sn / hedef ${targetVideoDur.toFixed(0)}sn)`);
  }
  if (coveredDur < targetVideoDur) {
    console.warn(`UYARI: kapsama yetersiz (${coveredDur} < ${targetVideoDur}), son video uzatilacak (loop yerine).`);
  }
  console.log(`Toplam ${chosen.length} klip secildi.`);

  // 5) Klipleri concat filter ile birlestir (donma fix: her klibi ayni codec/fps/sar'a normalize et)
  // Concat demuxer farkli codec/fps'lerde stream sync sorunu yaratiyor ve hedef sureye
  // ulasilamiyor -> son frame donmus gibi kaliyor. Concat filter input'lari tek tek
  // transcode edip sorunsuz birlestirir.
  console.log('\n=== Arka plan videosu birlestiriliyor (concat filter) ===');
  const bgPath = join(tmp, 'bg.mp4');
  const concatArgs = ['-y'];
  for (const c of chosen) concatArgs.push('-i', c.path);
  const fcParts = chosen.map((_, i) =>
    `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30,format=yuv420p[v${i}]`
  );
  const concatInputs = chosen.map((_, i) => `[v${i}]`).join('');
  const fcStr = fcParts.join(';') + `;${concatInputs}concat=n=${chosen.length}:v=1:a=0[outv]`;
  concatArgs.push(
    '-filter_complex', fcStr,
    '-map', '[outv]',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', '30',
    '-t', String(bodyDurWithFade),
    bgPath
  );
  await ffmpeg(concatArgs);
  // Gercek bg.mp4 suresini olc - eger hedeften kisaysa son frame'i tpad ile uzat
  const realBgDur = await getAudioDuration(bgPath);  // ffprobe video icin de calisir
  console.log(`bg.mp4 hazir (gercek: ${realBgDur.toFixed(1)}sn, hedef: ${bodyDurWithFade.toFixed(1)}sn)`);
  // Filter zincirinde ayrica tpad ekleyecegiz (compose sirasinda)

  // 6) Sequential ney muzigi (loop yok)
  console.log('\n=== Muzik kurgusu (ney, sequential) ===');
  const tracks = listNeyTracks();
  if (tracks.length === 0) throw new Error('Ney muzigi bulunamadi');
  // Ses sureleri olc, hedefi kapsayana kadar sira ile ekle
  const musicList = [];
  let musicDur = 0;
  let tIdx = 0;
  while (musicDur < bodyDurWithFade) {
    const t = tracks[tIdx % tracks.length];
    const d = await getAudioDuration(t);
    musicList.push({ path: t, duration: d });
    musicDur += d;
    tIdx++;
  }
  console.log(`${musicList.length} ney parcasi, toplam ${musicDur.toFixed(0)}sn`);
  const musicConcat = musicList.map(m => `file '${m.path.replace(/'/g, "'\\''")}'`).join('\n');
  writeFileSync(join(tmp, 'music.txt'), musicConcat);
  const musicPath = join(tmp, 'music.aac');
  await ffmpeg([
    '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'music.txt'),
    '-t', String(bodyDurWithFade),
    '-c:a', 'aac', '-b:a', '192k',
    musicPath
  ]);

  // 7) Overlay PNG'lerini render et
  console.log('\n=== Overlay PNGleri ===');
  const browser = await chromium.launch();
  const gradientPng = join(tmp, 'gradient.png');
  const poemCardPng = join(tmp, 'poem-card.png');
  const unitPngs = []; // [{beyitPng, serhPng}, ...]
  try {
    await renderHtmlToPng(fillTemplate('lf-gradient.html', {}), gradientPng, browser);

    // Poem card
    const firstLine = (poem.title || units[0].beyit.split('\n')[0]).replace(/[.,;:]+$/, '').trim();
    await renderHtmlToPng(
      fillTemplate('lf-poem-card.html', { gazelLabel: gazelLabelOf(poemNo), firstLine: `"${firstLine}"` }),
      poemCardPng, browser
    );

    for (let i = 0; i < units.length; i++) {
      const beyitPng = join(tmp, `beyit-${i}.png`);
      const serhPng = join(tmp, `serh-${i}.png`);
      await renderHtmlToPng(
        fillTemplate('lf-beyit.html', { beyit: units[i].beyit, beyitFontSize: '64px' }),
        beyitPng, browser
      );
      await renderHtmlToPng(
        fillTemplate('lf-serh.html', { serh: units[i].serh, serhFontSize: '40px' }),
        serhPng, browser
      );
      unitPngs.push({ beyitPng, serhPng });
      console.log(`  birim ${i+1} PNG'leri hazir`);
    }
  } finally {
    await browser.close();
  }

  // 8) Govde videoyu olustur: bg + gradient + overlay'ler (zamanli) + muzik + sesler + kart sesi
  console.log('\n=== Govde compose ediliyor (uzun ffmpeg filter) ===');
  // Overlay schedule: her sahne (start, end) PTS offset'iyle
  let t = 0;
  // Sahne 1: poem-card  t=[0, cardDur]; ses CARD_LEAD sn sonra baslar
  const cardStart = 0;
  const cardEnd = cardDur;
  const cardAudioStart = CARD_LEAD;
  t = cardEnd + PAUSE_AFTER_CARD;
  // Her birim
  const unitSchedule = [];
  for (let i = 0; i < units.length; i++) {
    const beyitStart = t + BEYIT_LEAD;
    const beyitEnd = beyitStart + unitAudios[i].beyitDur + BEYIT_TAIL;
    const serhStart = beyitEnd + UNIT_GAP + SERH_LEAD;
    const serhEnd = serhStart + unitAudios[i].serhDur + SERH_TAIL;
    unitSchedule.push({
      beyitOverlayStart: t,
      beyitOverlayEnd: beyitEnd,
      beyitAudioStart: beyitStart,
      serhOverlayStart: beyitEnd + UNIT_GAP,
      serhOverlayEnd: serhEnd,
      serhAudioStart: serhStart,
    });
    t = serhEnd;
  }
  const finalFadeStart = t + FINAL_HOLD;
  const bodyTotalLen = finalFadeStart + FADE_OUT;

  // Inputlar: 0=bg, 1=gradient, 2=poemCard, 3=music, 4=cardVoice, 5+=birim sesleri, sonra PNG'ler
  const args2 = [
    '-y',
    '-i', bgPath,
    '-loop', '1', '-t', String(bodyTotalLen), '-i', gradientPng,
    '-loop', '1', '-t', String(cardEnd + 1), '-i', poemCardPng,
    '-i', musicPath,
    '-i', cardVoicePath
  ];
  // Sesler (birim basina beyit + serh)
  const voiceInputBase = 5;  // 0..3 + cardVoice (4)
  for (let i = 0; i < units.length; i++) {
    args2.push('-i', unitAudios[i].beyitPath, '-i', unitAudios[i].serhPath);
  }
  // PNG overlay'leri: birim basina beyit + serh
  const overlayPngBase = voiceInputBase + units.length * 2;
  for (let i = 0; i < units.length; i++) {
    const beyitLen = unitSchedule[i].beyitOverlayEnd - unitSchedule[i].beyitOverlayStart + 1;
    const serhLen = unitSchedule[i].serhOverlayEnd - unitSchedule[i].serhOverlayStart + 1;
    args2.push('-loop', '1', '-t', String(beyitLen), '-i', unitPngs[i].beyitPng);
    args2.push('-loop', '1', '-t', String(serhLen), '-i', unitPngs[i].serhPng);
  }

  // Filter complex
  const FADE_IN_OVERLAY = 0.6;
  const FADE_OUT_OVERLAY = 0.8;

  const f = [];
  // bg: zaten 1920x1080 30fps, sadece tpad ile son frame'i hedef sureye kadar uzat (donmus gibi degil, ama emin olalim)
  f.push(`[0:v]tpad=stop_mode=clone:stop_duration=${(bodyTotalLen + 2).toFixed(2)},trim=duration=${bodyTotalLen.toFixed(2)},setpts=PTS-STARTPTS[bg]`);
  // gradient
  f.push(`[1:v]scale=1920:1080:flags=lanczos,setpts=PTS-STARTPTS[grad]`);
  // poem card (dinamik kart suresi)
  f.push(`[2:v]scale=1920:1080:flags=lanczos,format=rgba,fade=t=in:st=0:d=${FADE_IN_OVERLAY}:alpha=1,fade=t=out:st=${(cardEnd - FADE_OUT_OVERLAY).toFixed(2)}:d=${FADE_OUT_OVERLAY}:alpha=1,setpts=PTS-STARTPTS[pcard]`);

  // Birim overlay'leri
  const overlayLabels = [];
  for (let i = 0; i < units.length; i++) {
    const beyitIdx = overlayPngBase + i * 2;
    const serhIdx = beyitIdx + 1;
    const beyitOverlayLen = unitSchedule[i].beyitOverlayEnd - unitSchedule[i].beyitOverlayStart;
    const serhOverlayLen = unitSchedule[i].serhOverlayEnd - unitSchedule[i].serhOverlayStart;
    f.push(`[${beyitIdx}:v]scale=1920:1080:flags=lanczos,format=rgba,fade=t=in:st=0:d=${FADE_IN_OVERLAY}:alpha=1,fade=t=out:st=${(beyitOverlayLen - FADE_OUT_OVERLAY).toFixed(2)}:d=${FADE_OUT_OVERLAY}:alpha=1,setpts=PTS+${unitSchedule[i].beyitOverlayStart.toFixed(2)}/TB[bt${i}]`);
    f.push(`[${serhIdx}:v]scale=1920:1080:flags=lanczos,format=rgba,fade=t=in:st=0:d=${FADE_IN_OVERLAY}:alpha=1,fade=t=out:st=${(serhOverlayLen - FADE_OUT_OVERLAY).toFixed(2)}:d=${FADE_OUT_OVERLAY}:alpha=1,setpts=PTS+${unitSchedule[i].serhOverlayStart.toFixed(2)}/TB[st${i}]`);
    overlayLabels.push(`[bt${i}]`, `[st${i}]`);
  }

  // Compose: bg + grad + pcard + (beyit/serh overlay'leri)
  // Sıra: bg <- grad <- pcard <- bt0, st0, bt1, st1, ...
  f.push(`[bg][grad]overlay=0:0[v1]`);
  f.push(`[v1][pcard]overlay=0:0[v2]`);
  let last = '[v2]';
  let idx2 = 3;
  for (const lab of overlayLabels) {
    f.push(`${last}${lab}overlay=0:0[v${idx2}]`);
    last = `[v${idx2}]`;
    idx2++;
  }
  // Son fade out
  f.push(`${last.replace(/\[|\]/g, '')}fade=t=out:st=${finalFadeStart.toFixed(2)}:d=${FADE_OUT}[outv]`.replace('vfade', '[vfade]'));
  // Oops, basitlestir:
  f.pop();
  f.push(`${last}fade=t=out:st=${finalFadeStart.toFixed(2)}:d=${FADE_OUT}[outv]`);

  // Audio: music + kart sesi + her birimin beyit & serh sesi (zamanli)
  const audioLabels = [];
  // music index 3
  f.push(`[3:a]volume=0.30,afade=t=in:st=0:d=1,afade=t=out:st=${finalFadeStart.toFixed(2)}:d=${FADE_OUT}[mus]`);
  audioLabels.push('[mus]');
  // card voice index 4
  const cardDelayMs = Math.round(cardAudioStart * 1000);
  const cardFadeOut = cardVoiceDur - 0.3;
  f.push(`[4:a]volume=1.0,afade=t=out:st=${cardFadeOut.toFixed(2)}:d=0.4,adelay=${cardDelayMs}|${cardDelayMs}[cv]`);
  audioLabels.push('[cv]');
  for (let i = 0; i < units.length; i++) {
    const beyitIdx = voiceInputBase + i * 2;
    const serhIdx = beyitIdx + 1;
    const beyitDelayMs = Math.round(unitSchedule[i].beyitAudioStart * 1000);
    const serhDelayMs = Math.round(unitSchedule[i].serhAudioStart * 1000);
    const beyitFadeOut = unitAudios[i].beyitDur - 0.3;
    const serhFadeOut = unitAudios[i].serhDur - 0.3;
    f.push(`[${beyitIdx}:a]volume=1.0,afade=t=out:st=${beyitFadeOut.toFixed(2)}:d=0.4,adelay=${beyitDelayMs}|${beyitDelayMs}[bv${i}]`);
    f.push(`[${serhIdx}:a]volume=1.0,afade=t=out:st=${serhFadeOut.toFixed(2)}:d=0.4,adelay=${serhDelayMs}|${serhDelayMs}[sv${i}]`);
    audioLabels.push(`[bv${i}]`, `[sv${i}]`);
  }
  f.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0[outa]`);

  const filterStr = f.join(';');
  // Filter cok uzun olabilir, dosyaya yaz
  const fcFile = join(tmp, 'fc.txt');
  writeFileSync(fcFile, filterStr);

  const bodyOut = join(tmp, 'body.mp4');
  args2.push(
    '-filter_complex_script', fcFile,
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', '30',
    '-maxrate', '15M', '-bufsize', '30M',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    '-t', String(bodyTotalLen),
    bodyOut
  );
  await ffmpeg(args2);
  console.log('body.mp4 hazir');

  // 9) Intro + body concat
  console.log('\n=== Intro + body birlestiriliyor ===');
  const finalOut = join(OUT_DIR, `gazel-${String(poemNo).padStart(2,'0')}.mp4`);
  // Concat demuxer hizli, ayni codec/resolution gerek. Intro 24fps, body 30fps - guvende kalmak icin filter concat
  await ffmpeg([
    '-y',
    '-i', INTRO,
    '-i', bodyOut,
    '-filter_complex',
    '[0:v]scale=1920:1080,setsar=1,fps=30,setpts=PTS-STARTPTS[v0];' +
    '[1:v]scale=1920:1080,setsar=1,fps=30,setpts=PTS-STARTPTS[v1];' +
    '[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0];' +
    '[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];' +
    '[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]',
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', '30',
    '-maxrate', '15M', '-bufsize', '30M',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    finalOut
  ]);

  console.log(`\n✓ HAZIR: ${finalOut}`);
  const sz = (statSync(finalOut).size / (1024*1024)).toFixed(1);
  console.log(`Boyut: ${sz} MB, sure: ${(INTRO_DUR + bodyTotalLen).toFixed(1)}sn`);

} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
