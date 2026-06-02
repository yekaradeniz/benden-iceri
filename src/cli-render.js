import { readFileSync } from 'node:fs';
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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);
const today = new Date().toISOString().slice(0, 10);
const launchDate = state.launchDate ?? today;

// Önceki post başarısız olduysa (postId null) aynı girişi tekrar kullan.
// Sadece BUGÜNKÜ post için geçerli - önceki günün bekleyeni varsa yeni içeriğe geç.
const pendingRetry = state.lastPost && !state.lastPost.postId && state.lastPost.verseId
  && state.lastPost.date === today;
let entry;
if (pendingRetry) {
  entry = content.find(e => e.id === state.lastPost.verseId);
  if (!entry) throw new Error(`Retry: entry ${state.lastPost.verseId} bulunamadi`);

  // Retry'da HER ZAMAN yeniden render edilir; eski medya tekrar KULLANILMAZ.
  // Boylece icerik nedeniyle (or. kadin goruntusu) elle silinen bir post
  // asla ayni medyayla geri gelmez. Birkac ekstra API cagrisi onemsiz.
  console.log(`Yeniden deneniyor: ${entry.id} - yeni medya render ediliyor (eski medya kullanilmaz)`);
} else {
  const postedSet = new Set(state.postedVerseIds);
  // SKIP: 45+ karakterli misralı beyitleri atla (gorsellestirilince font cok kuculur).
  // Bu beyitler postedVerseIds'e EKLENMEZ, yalnizca iterasyondan disarda birakilir.
  // Threshold degisirse veya tema buyuyebilirse bunlar tekrar yakalanir.
  const MAX_LINE_CHARS = 45;
  const tooLong = (e) => e.verse.split('\n').some(l => l.length >= MAX_LINE_CHARS);
  let unposted = content.filter(e => !postedSet.has(e.id) && !tooLong(e));

  if (unposted.length === 0) {
    // LOOP: tum uygun beyitler paylasildi. Basa don, sonsuz dongu.
    const cycle = (state.cycle ?? 1) + 1;
    console.log(`Tum uygun beyitler paylasildi. LOOP -> ${cycle}. tur basliyor (basa donuldu).`);
    state.postedVerseIds = [];
    // usedVideoIds SIFIRLANMAZ: rolling window zaten cesitliligi sagliyor; sifirlamak
    // tur basinda son videolarin hemen tekrarina yol acardi.
    state.cycle = cycle;
    postedSet.clear();
    unposted = content.filter(e => !tooLong(e));
  }
  entry = unposted[0];

  // SAFETY: Sira basindaki misranin verse VE explanation alanlari dolu olmali.
  // Boş icerikle paylasim yapilmasin - workflow durur, kullanici manuel doldursun.
  const hasVerse = entry.verse && entry.verse.trim().length > 0;
  const hasExplanation = entry.explanation && entry.explanation.trim().length > 0;
  if (!hasVerse || !hasExplanation) {
    const missing = [];
    if (!hasVerse) missing.push('verse');
    if (!hasExplanation) missing.push('explanation (mânâ)');
    throw new Error(
      `${entry.id} icin eksik alan(lar): ${missing.join(', ')}. ` +
      `content/salih-baba.json'a doldurun, sonra workflow'u tekrar tetikleyin. ` +
      `Post atilmadi (sira korunuyor).`
    );
  }
}

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

    // ElevenLabs ile verse + mana sesi uret (env varlarsa). Cache: output/audio-cache/
    // Cache .gitignore'da, GitHub'da kalici depolanmaz - her run sifirdan uretir.
    let voicePath = null;
    let voiceDuration = 0;
    let manaVoicePath = null;
    let manaVoiceDuration = 0;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const elevenVoiceId = process.env.ELEVENLABS_VOICE_ID;
    if (elevenKey && elevenVoiceId) {
      const voiceCacheDir = join(ROOT, 'output', 'audio-cache');
      try {
        console.log('Beyit sesi (ElevenLabs)...');
        voicePath = await generateVoice({
          text: entry.verse,
          voiceId: elevenVoiceId,
          apiKey: elevenKey,
          cacheDir: voiceCacheDir
        });
        voiceDuration = await getAudioDuration(voicePath);
        console.log(`  Verse voice: ${voiceDuration.toFixed(1)}sn`);

        if (entry.explanation && entry.explanation.trim()) {
          console.log('Mana sesi (ElevenLabs)...');
          manaVoicePath = await generateVoice({
            text: entry.explanation,
            voiceId: elevenVoiceId,
            apiKey: elevenKey,
            cacheDir: voiceCacheDir
          });
          manaVoiceDuration = await getAudioDuration(manaVoicePath);
          console.log(`  Mana voice: ${manaVoiceDuration.toFixed(1)}sn`);
        }
      } catch (e) {
        console.warn(`ElevenLabs basarisiz, sesli devre disi: ${e.message}`);
        voicePath = null;
        manaVoicePath = null;
      }
    } else {
      console.log('ElevenLabs env yok, reel sessiz gidecek.');
    }

    const outVideo = join(ROOT, 'output', `${today}.mp4`);
    await renderReel({
      verse: entry.verse,
      explanation: entry.explanation || '',
      videoPath: chosenPath,
      audioPath,
      voicePath,
      voiceDuration,
      manaVoicePath,
      manaVoiceDuration,
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
      postedVerseIds: [...state.postedVerseIds.filter(id => id !== entry.id), entry.id]
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
    verse: entry.verse,
    original: null,
    source: 'Salih Baba',
    photoUrl: photo.url
  }, slide1);
  console.log(`Slide 1: ${slide1}`);

  const hasExplanation = entry.explanation && entry.explanation.trim().length > 0;
  if (hasExplanation) {
    const slide2 = join(ROOT, 'output', `${today}-2.png`);
    await renderExplanationToPng({ explanation: entry.explanation, photoUrl: photo.url }, slide2);
    console.log(`Slide 2: ${slide2}`);
  }

  writeState(statePath, {
    ...state,
    launchDate,
    lastPost: {
      date: today,
      verseId: entry.id,
      photoId: photo.id,
      postId: null,
      type: 'carousel',
      carousel: hasExplanation
    },
    recentPhotos: [...recentPhotos.filter(id => id !== photo.id), photo.id].slice(-14),
    usedVideoIds: state.usedVideoIds ?? [],
    postedVerseIds: [...state.postedVerseIds.filter(id => id !== entry.id), entry.id]
  });
}

console.log(`  Gün ${entry.day} / ${content.length} - ${entry.id}`);
