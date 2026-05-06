import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickPhoto } from './pickPhoto.js';
import { pickValidatedPhoto, isPhotoSpiritual } from './checkPhoto.js';
import { fetchUnsplashPhoto } from './fetchUnsplashPhoto.js';
import { fetchPexelsVideo } from './fetchPexelsVideo.js';
import { renderToPng, renderExplanationToPng } from './render.js';
import { renderReel } from './renderReel.js';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);
const today = new Date().toISOString().slice(0, 10);
const launchDate = state.launchDate ?? today;

// Önceki post başarısız olduysa (postId null) aynı girişi tekrar kullan
const pendingRetry = state.lastPost && !state.lastPost.postId && state.lastPost.verseId;
let entry;
if (pendingRetry) {
  entry = content.find(e => e.id === state.lastPost.verseId);
  if (!entry) throw new Error(`Retry: entry ${state.lastPost.verseId} bulunamadi`);
  console.log(`Yeniden deneniyor: ${entry.id} (önceki post başarısız)`);
} else {
  const postedSet = new Set(state.postedVerseIds);
  const unposted = content.filter(e => !postedSet.has(e.id));
  if (unposted.length === 0) {
    throw new Error(`Tüm günler paylaşıldı (${state.postedVerseIds.length} gün). salih-baba.json bitti.`);
  }
  entry = unposted[0];
}

// Tip alternasyonu: bir öncekinin tersi.
// Geri uyumluluk: lastPost.type yoksa lastPost.carousel'a göre.
const lastType = state.lastPost?.type
  ?? (state.lastPost?.carousel === true ? 'carousel'
      : state.lastPost?.carousel === false ? 'reel'
      : null);

let nextType;
if (pendingRetry) {
  // Retry'da tip değişmesin
  nextType = lastType ?? 'carousel';
} else {
  nextType = lastType === 'reel' ? 'carousel' : 'reel';
}
console.log(`Bu post tipi: ${nextType} (önceki: ${lastType ?? 'yok'})`);

const recentPhotos = state.recentPhotos ?? [];

if (nextType === 'reel') {
  // ---------- REEL ----------
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) throw new Error('PEXELS_API_KEY tanımlı değil; reel oluşturulamaz');

  const recentlyUsedVideos = new Set(recentPhotos.filter(id => id.startsWith('pexels-')));
  const video = await fetchPexelsVideo(entry.moods, pexelsKey, recentlyUsedVideos);

  const outVideo = join(ROOT, 'output', `${today}.mp4`);
  await renderReel({
    verse: entry.verse,
    explanation: entry.explanation || '',
    videoUrl: video.url,
    outPath: outVideo
  });
  console.log(`Reel hazir: ${outVideo}`);

  writeState(statePath, {
    ...state,
    launchDate,
    lastPost: {
      date: today,
      verseId: entry.id,
      photoId: video.id,
      postId: null,
      type: 'reel',
      carousel: false
    },
    recentPhotos: [...recentPhotos.filter(id => id !== video.id), video.id].slice(-14),
    postedVerseIds: [...state.postedVerseIds.filter(id => id !== entry.id), entry.id]
  });
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
    postedVerseIds: [...state.postedVerseIds.filter(id => id !== entry.id), entry.id]
  });
}

console.log(`  Gün ${entry.day} / ${content.length} - ${entry.id}`);
