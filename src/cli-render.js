import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickPhoto } from './pickPhoto.js';
import { renderToPng } from './render.js';
import { pickValidatedPhoto } from './checkPhoto.js';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const verses = JSON.parse(readFileSync(join(ROOT, 'content', 'verses.json'), 'utf-8'));
const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);
const today = new Date().toISOString().slice(0, 10);
const launchDate = state.launchDate ?? today;

// No-repeat: pick the next un-posted verse in JSON order. Throw if all consumed.
const postedSet = new Set(state.postedVerseIds);
const unposted = verses.filter(v => !postedSet.has(v.id));
if (unposted.length === 0) {
  throw new Error(
    `Tüm mısralar paylaşıldı (${state.postedVerseIds.length} mısra). content/verses.json'a yenisini ekleyin.`
  );
}
const verse = unposted[0];

// Photo selection: AI moderation if GEMINI_API_KEY is set, else fallback to pure pickPhoto.
const apiKey = process.env.GEMINI_API_KEY;
const photo = apiKey
  ? await pickValidatedPhoto({
      photos,
      verseMoods: verse.moods,
      recentlyUsed: new Set(state.recentPhotos),
      apiKey,
      maxAttempts: photos.length
    })
  : pickPhoto(photos, verse.moods, new Set(state.recentPhotos));

const outputPath = join(ROOT, 'output', `${today}.png`);

await renderToPng({
  verse: verse.verse,
  original: verse.original,
  source: verse.source,
  photoUrl: photo.url
}, outputPath);

// Update state. Mark verse as posted now (before IG call) so a post failure doesn't
// cause the same verse to retry forever; manual intervention can re-add to verses.json.
writeState(statePath, {
  ...state,
  launchDate,
  lastPost: { date: today, verseId: verse.id, photoId: photo.id, postId: null },
  recentPhotos: [...state.recentPhotos.filter(id => id !== photo.id), photo.id].slice(-14),
  postedVerseIds: [...state.postedVerseIds, verse.id]
});

console.log(`✓ Rendered ${outputPath} (verse ${verse.id}, photo ${photo.id})`);
console.log(`  Posted verses: ${state.postedVerseIds.length + 1} / ${verses.length}`);
