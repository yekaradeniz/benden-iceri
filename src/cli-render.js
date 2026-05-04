import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickPhoto } from './pickPhoto.js';
import { pickValidatedPhoto } from './checkPhoto.js';
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

// Onceki post basarisiz olduysa (postId null) ayni girisi tekrar kullan
const pendingRetry = state.lastPost && !state.lastPost.postId && state.lastPost.verseId;
let entry;
if (pendingRetry) {
  entry = content.find(e => e.id === state.lastPost.verseId);
  if (!entry) throw new Error(`Retry: entry ${state.lastPost.verseId} bulunamadi`);
  console.log(`Yeniden deneniyor: ${entry.id} (onceki post basarisiz)`);
} else {
  const postedSet = new Set(state.postedVerseIds);
  const unposted = content.filter(e => !postedSet.has(e.id));
  if (unposted.length === 0) {
    throw new Error(`Tum gunler paylasildi (${state.postedVerseIds.length} gun). salih-baba.json bitti.`);
  }
  entry = unposted[0];
}

// Fotoğraf seçimi: Gemini API varsa AI kontrolü, yoksa mood bazlı
const apiKey = process.env.GEMINI_API_KEY;
const photo = apiKey
  ? await pickValidatedPhoto({
      photos,
      verseMoods: entry.moods,
      recentlyUsed: new Set(state.recentPhotos),
      apiKey,
      maxAttempts: photos.length
    })
  : pickPhoto(photos, entry.moods, new Set(state.recentPhotos));

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
