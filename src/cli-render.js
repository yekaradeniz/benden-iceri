import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickPhoto } from './pickPhoto.js';
import { pickValidatedPhoto, isPhotoSpiritual } from './checkPhoto.js';
import { fetchUnsplashPhoto } from './fetchUnsplashPhoto.js';
import { renderToPng, renderExplanationToPng } from './render.js';
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

// Fotoğraf seçimi
const geminiKey = process.env.GEMINI_API_KEY;
const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
const recentlyUsed = new Set(state.recentPhotos);

let photo;

if (unsplashKey) {
  // Unsplash API: sonsuz taze fotoğraf havuzu
  console.log('Unsplash API ile dinamik fotoğraf çekiliyor...');
  let approved = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    photo = await fetchUnsplashPhoto(entry.moods, unsplashKey, recentlyUsed);
    if (geminiKey) {
      const result = await isPhotoSpiritual(photo.url, geminiKey);
      if (result.approved) {
        console.log(`✓ Unsplash foto onaylandı: ${photo.id}`);
        approved = true;
        break;
      } else {
        console.log(`✗ Reddedildi (${result.reason}), tekrar deneniyor...`);
        recentlyUsed.add(photo.id); // reddedileni de blacklist'e ekle
      }
    } else {
      approved = true;
      break;
    }
  }
  if (!approved) {
    // Gemini hep reddettiyse son çekileni yine de kullan
    console.warn('5 denemede onay alınamadı, son fotoğraf kullanılıyor.');
  }
} else if (geminiKey) {
  // Statik havuz + Gemini moderasyonu
  photo = await pickValidatedPhoto({
    photos,
    verseMoods: entry.moods,
    recentlyUsed,
    apiKey: geminiKey,
    maxAttempts: photos.length
  });
} else {
  // Sadece mood eşleşmesi
  photo = pickPhoto(photos, entry.moods, recentlyUsed);
}

const slide1 = join(ROOT, 'output', `${today}-1.png`);
await renderToPng({
  verse: entry.verse,
  original: null,
  source: 'Salih Baba',
  photoUrl: photo.url
}, slide1);
console.log(`✓ Slide 1: ${slide1}`);

const hasExplanation = entry.explanation && entry.explanation.trim().length > 0;
if (hasExplanation) {
  const slide2 = join(ROOT, 'output', `${today}-2.png`);
  await renderExplanationToPng({ explanation: entry.explanation, photoUrl: photo.url }, slide2);
  console.log(`✓ Slide 2: ${slide2}`);
}

writeState(statePath, {
  ...state,
  launchDate,
  lastPost: {
    date: today,
    verseId: entry.id,
    photoId: photo.id,
    postId: null,
    carousel: hasExplanation
  },
  recentPhotos: [...state.recentPhotos.filter(id => id !== photo.id), photo.id].slice(-14),
  postedVerseIds: [...state.postedVerseIds, entry.id]
});

console.log(`  Gün ${entry.day} / ${content.length} - ${entry.id}`);
