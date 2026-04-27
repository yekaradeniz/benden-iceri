import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pickContent } from './pickContent.js';
import { pickPhoto } from './pickPhoto.js';
import { renderToPng } from './render.js';
import { readState, writeState, daysSinceLaunch } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const verses = JSON.parse(readFileSync(join(ROOT, 'content', 'verses.json'), 'utf-8'));
const photos = JSON.parse(readFileSync(join(ROOT, 'content', 'photos.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);
const today = new Date().toISOString().slice(0, 10);
const launchDate = state.launchDate ?? today;
const dayIndex = daysSinceLaunch(launchDate, today);

const verse = pickContent(verses, dayIndex);
const photo = pickPhoto(photos, verse.moods, new Set(state.recentPhotos));
const outputPath = join(ROOT, 'output', `${today}.png`);

await renderToPng({
  verse: verse.verse,
  original: verse.original,
  source: verse.source,
  photoUrl: photo.url
}, outputPath);

// Update state with selection (post step finalizes with postId)
writeState(statePath, {
  launchDate,
  lastPost: { date: today, verseId: verse.id, photoId: photo.id, postId: null },
  recentPhotos: [...state.recentPhotos.filter(id => id !== photo.id), photo.id].slice(-14)
});

console.log(`✓ Rendered ${outputPath} (verse ${verse.id}, photo ${photo.id})`);
