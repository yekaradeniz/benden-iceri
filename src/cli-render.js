import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickPhoto } from './pickPhoto.js';
import { pickValidatedPhoto, isPhotoSpiritual } from './checkPhoto.js';
import { fetchUnsplashPhoto } from './fetchUnsplashPhoto.js';
import { fetchPexelsCandidates } from './fetchPexelsVideo.js';
import { validateVideoFrames } from './checkVideoFrames.js';
import { renderToPng, renderExplanationToPng } from './render.js';
import { renderReel, downloadVideo, pickAudioByIndex, listAudioTracks } from './renderReel.js';
import { generateVoice, getAudioDuration } from './generateVoice.js';
import { buildChunks } from './buildChunks.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
// CHUNK tabanli icerik: siir sinirlarini kesmeyen 8'erli satir gruplari
// (siir sonunda 4-7 kalan tek chunk; <4 kalan atlanir). Aciklamasiz format.
const { chunks } = buildChunks();
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);
const today = new Date().toISOString().slice(0, 10);
const launchDate = state.launchDate ?? today;

// Eski post medyasini temizle: repoda sadece BUGUNKU post kalsin.
// Instagram videoyu/gorseli o an raw GitHub URL'inden ceker; yayinlanan eski postlarin
// dosyalarina artik gerek yoktur. Her render, bugunun tarihiyle baslamayan tum mp4/png'leri siler.
// Boylece repo hicbir zaman birden fazla post'un medyasini tutmaz, sismez.
{
  const outputDir = join(ROOT, 'output');
  if (existsSync(outputDir)) {
    for (const f of readdirSync(outputDir)) {
      if (/\.(mp4|png)$/i.test(f) && !f.startsWith(today)) {
        try { rmSync(join(outputDir, f)); console.log(`Eski post medyasi silindi: ${f}`); } catch {}
      }
    }
  }
}

// LEGACY MIGRASYON: eski sistem entry-bazliydi (postedVerseIds). Chunk sistemine
// gecerken BITISIK ONEK kurali uygulanir: bastan itibaren tum satirlari eski
// paylasilmis entry'lere ait olan chunk'lar "paylasildi" sayilir; ilk kismen/tamamen
// yeni chunk'tan itibaren HER SEY sirayla gider (delik birakmaz - sira kontrolu
// monotonik kalir). Eski formatta paylasilmis birkac icerik yeni formatta tekrar
// gelebilir; kabul edilen davranis (loop zaten var). Tek seferlik, deterministik.
if (!Array.isArray(state.postedChunkIds)) {
  const legacy = new Set(state.postedVerseIds ?? []);
  let prefixEnd = 0;
  for (const c of chunks) {
    if (c.lineRefs.every(r => legacy.has(r.id))) prefixEnd++;
    else break;
  }
  state.postedChunkIds = chunks.slice(0, prefixEnd).map(c => c.id);
  console.log(`Migrasyon: legacy ${legacy.size} entry -> ilk ${prefixEnd} chunk paylasildi sayildi (bitisik onek).`);
}

// Önceki post başarısız olduysa (postId null) aynı chunk'i tekrar kullan.
// Sadece BUGÜNKÜ post için geçerli - önceki günün bekleyeni varsa yeni içeriğe geç.
const pendingRetry = state.lastPost && !state.lastPost.postId && state.lastPost.verseId
  && state.lastPost.date === today && String(state.lastPost.verseId).startsWith('ch-');
let entry;
if (pendingRetry) {
  entry = chunks.find(c => c.id === state.lastPost.verseId);
  if (!entry) throw new Error(`Retry: chunk ${state.lastPost.verseId} bulunamadi`);

  // Retry'da HER ZAMAN yeniden render edilir; eski medya tekrar KULLANILMAZ.
  console.log(`Yeniden deneniyor: ${entry.id} - yeni medya render ediliyor (eski medya kullanilmaz)`);
} else {
  const postedSet = new Set(state.postedChunkIds);
  let unposted = chunks.filter(c => !postedSet.has(c.id));

  if (unposted.length === 0) {
    // LOOP: tum chunk'lar paylasildi. Basa don, sonsuz dongu.
    const cycle = (state.cycle ?? 1) + 1;
    console.log(`Tum chunk'lar paylasildi. LOOP -> ${cycle}. tur basliyor (basa donuldu).`);
    state.postedChunkIds = [];
    // usedVideoIds SIFIRLANMAZ: rolling window zaten cesitliligi sagliyor.
    state.cycle = cycle;
    postedSet.clear();
    unposted = chunks;
  }
  entry = unposted[0];
}
console.log(`Secilen: ${entry.id} | Siir ${entry.poemNo} | ${entry.lineCount} satir | "${entry.firstLine.slice(0, 45)}..."`);

// Tip alternasyonu: normalde bir öncekinin tersi (carousel <-> reel).
// REELS_ENABLED=false   → sadece carousel atılır
// CAROUSEL_ENABLED=false → sadece reel atılır (carousel kodu silinmedi, geri açmak için bu satırı kaldır)
const REELS_ENABLED    = process.env.REELS_ENABLED    !== 'false';
const CAROUSEL_ENABLED = process.env.CAROUSEL_ENABLED !== 'false';

const lastType = state.lastPost?.type
  ?? (state.lastPost?.carousel === true ? 'carousel'
      : state.lastPost?.carousel === false ? 'reel'
      : null);

let nextType;
if (pendingRetry) {
  nextType = lastType ?? 'reel';
} else if (!REELS_ENABLED) {
  nextType = 'carousel';
} else if (!CAROUSEL_ENABLED) {
  nextType = 'reel';
} else {
  nextType = lastType === 'reel' ? 'carousel' : 'reel';
}
console.log(`Bu post tipi: ${nextType} (önceki: ${lastType ?? 'yok'}, reels: ${REELS_ENABLED ? 'açık' : 'kapalı'}, carousel: ${CAROUSEL_ENABLED ? 'açık' : 'kapalı'})`);

const recentPhotos = state.recentPhotos ?? [];

if (nextType === 'reel') {
  // ---------- REEL ----------
  const pexelsKey = process.env.PEXELS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!pexelsKey) throw new Error('PEXELS_API_KEY tanımlı değil; reel oluşturulamaz');

  // Iki blacklist:
  //  - rejectedVideoIds: KALICI (moderasyon basarisiz, or. karede kadin) - asla tekrar denenmez
  //  - usedVideoIds: ROLLING window (son N kullanilan, sadece cesitlilik icin) - eskiler tekrar kullanilabilir
  // fetchPexelsCandidates ikisinin birlesimini disarda birakir.
  const rejectedVideoIds = state.rejectedVideoIds ?? [];
  const usedRolling = state.usedVideoIds ?? [];
  const excludeSet = new Set([...rejectedVideoIds, ...usedRolling]);
  const candidates = await fetchPexelsCandidates(entry.moods, pexelsKey, excludeSet);
  console.log(`${candidates.length} Pexels aday bulundu (excl. ${excludeSet.size} blacklist), moderasyondan geçecek...`);

  // Adayları sırayla dene: indir, 5 kareyi Gemini'den geçir, ilk onaylananı kullan
  const tmpDir = mkdtempSync(join(tmpdir(), 'pexels-'));
  let chosen = null;
  let chosenPath = null;
  const rejectedIds = [];

  try {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const localPath = join(tmpDir, `cand-${i}.mp4`);
      console.log(`[${i + 1}/${candidates.length}] ${c.id} indiriliyor...`);
      await downloadVideo(c.url, localPath);

      const result = await validateVideoFrames(localPath, c.duration, geminiKey);
      if (result.approved) {
        console.log(`✓ ${c.id} onaylandi`);
        chosen = c;
        chosenPath = localPath;
        break;
      }
      console.log(`✗ ${c.id} reddedildi: ${result.reason}`);
      rejectedIds.push(c.id);
    }

    if (!chosen) {
      throw new Error(`${candidates.length} adayın hiçbiri moderasyondan geçemedi`);
    }

    // Müzik rotation: state.audioIndex'i kullan, audio/ klasörü doluysa sırayla seç
    const tracks = listAudioTracks();
    const audioIdx = state.audioIndex ?? 0;
    const audioPath = tracks.length > 0 ? pickAudioByIndex(audioIdx) : null;
    if (audioPath) console.log(`Müzik #${(audioIdx % tracks.length) + 1}/${tracks.length}: ${audioPath.split('/').pop()}`);

    // ElevenLabs ile beyit sesi uret (env varlarsa). ACIKLAMASIZ format:
    // sadece chunk metni okunur, mana sesi/ekrani yoktur.
    let voicePath = null;
    let voiceDuration = 0;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const elevenVoiceId = process.env.ELEVENLABS_VOICE_ID;
    if (elevenKey && elevenVoiceId) {
      const voiceCacheDir = join(ROOT, 'output', 'audio-cache');
      try {
        console.log('Beyit sesi (ElevenLabs)...');
        voicePath = await generateVoice({
          text: entry.text,
          voiceId: elevenVoiceId,
          apiKey: elevenKey,
          cacheDir: voiceCacheDir
        });
        voiceDuration = await getAudioDuration(voicePath);
        console.log(`  Verse voice: ${voiceDuration.toFixed(1)}sn`);
      } catch (e) {
        console.warn(`ElevenLabs basarisiz, sesli devre disi: ${e.message}`);
        voicePath = null;
      }
    } else {
      console.log('ElevenLabs env yok, reel sessiz gidecek.');
    }

    const outVideo = join(ROOT, 'output', `${today}.mp4`);
    await renderReel({
      verse: entry.text,
      explanation: '',            // verse-only mod: mana bolumu yok
      videoPath: chosenPath,
      audioPath,
      voicePath,
      voiceDuration,
      outPath: outVideo
    });
    console.log(`Reel hazir: ${outVideo}`);

    // ROLLING window: kullanilan video ID'lerinin son N tanesini tut.
    // Pexels cami havuzu ~500 video; window 150 ile her zaman ~350 taze kalir,
    // bir video en az ~150 gun (5 ay) tekrar gelmez. Boylece havuz asla tukenmez.
    const VIDEO_WINDOW = 150;
    const newUsedRolling = [...usedRolling.filter(id => id !== chosen.id), chosen.id].slice(-VIDEO_WINDOW);

    // Reddedilenler (moderasyon basarisiz) KALICI blacklist'e gider, tekrar denenmez/indirilmez.
    const newRejected = [
      ...rejectedVideoIds,
      ...rejectedIds.filter(id => !rejectedVideoIds.includes(id))
    ];

    writeState(statePath, {
      ...state,
      launchDate,
      lastPost: {
        date: today,
        verseId: entry.id,
        photoId: chosen.id,
        postId: null,
        type: 'reel',
        carousel: false
      },
      recentPhotos: [...recentPhotos.filter(id => id !== chosen.id), chosen.id].slice(-14),
      usedVideoIds: newUsedRolling,
      rejectedVideoIds: newRejected,
      audioIndex: tracks.length > 0 ? (audioIdx + 1) % tracks.length : (state.audioIndex ?? 0),
      postedChunkIds: [...state.postedChunkIds.filter(id => id !== entry.id), entry.id]
    });
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
} else {
  // ---------- CAROUSEL (mevcut akış) ----------
  const geminiKey = process.env.GEMINI_API_KEY;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const recentlyUsed = new Set(recentPhotos);

  let photo;
  if (unsplashKey) {
    console.log('Unsplash API ile dinamik fotoğraf çekiliyor...');
    let approved = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      photo = await fetchUnsplashPhoto(entry.moods, unsplashKey, recentlyUsed);
      if (geminiKey) {
        const result = await isPhotoSpiritual(photo.url, geminiKey);
        if (result.approved) {
          console.log(`Unsplash foto onaylandı: ${photo.id}`);
          approved = true;
          break;
        } else {
          console.log(`Reddedildi (${result.reason}), tekrar deneniyor...`);
          recentlyUsed.add(photo.id);
        }
      } else {
        approved = true;
        break;
      }
    }
    if (!approved) console.warn('5 denemede onay alınamadı, son fotoğraf kullanılıyor.');
  } else if (geminiKey) {
    photo = await pickValidatedPhoto({
      photos,
      verseMoods: entry.moods,
      recentlyUsed,
      apiKey: geminiKey,
      maxAttempts: photos.length
    });
  } else {
    photo = pickPhoto(photos, entry.moods, recentlyUsed);
  }

  const slide1 = join(ROOT, 'output', `${today}-1.png`);
  await renderToPng({
    verse: entry.text,
    original: null,
    source: 'Salih Baba',
    photoUrl: photo.url
  }, slide1);
  console.log(`Slide 1: ${slide1}`);

  writeState(statePath, {
    ...state,
    launchDate,
    lastPost: {
      date: today,
      verseId: entry.id,
      photoId: photo.id,
      postId: null,
      type: 'carousel',
      carousel: false
    },
    recentPhotos: [...recentPhotos.filter(id => id !== photo.id), photo.id].slice(-14),
    usedVideoIds: state.usedVideoIds ?? [],
    postedChunkIds: [...state.postedChunkIds.filter(id => id !== entry.id), entry.id]
  });
}

console.log(`  Chunk ${entry.id} / ${chunks.length} chunk | Siir ${entry.poemNo}`);
