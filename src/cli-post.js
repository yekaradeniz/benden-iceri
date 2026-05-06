import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  postToInstagram,
  postCarouselToInstagram,
  postReelToInstagram
} from './postToInstagram.js';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

if (!state.lastPost?.date) {
  throw new Error('Bekleyen post yok. Önce npm run render çalıştırın.');
}

if (state.lastPost.postId) {
  console.log(`Bu post zaten paylaşıldı (postId: ${state.lastPost.postId}). Atlanıyor.`);
  process.exit(0);
}

const entry = content.find(e => e.id === state.lastPost.verseId);
if (!entry) throw new Error(`Entry ${state.lastPost.verseId} bulunamadı`);

const repo = process.env.GITHUB_REPOSITORY;
const branch = process.env.GITHUB_REF_NAME ?? 'main';
if (!repo) throw new Error('GITHUB_REPOSITORY env var gerekli');

const base = `https://raw.githubusercontent.com/${repo}/${branch}/output`;
const date = state.lastPost.date;

const igUserId = process.env.IG_USER_ID;
const accessToken = process.env.IG_ACCESS_TOKEN;

// Tip belirleme: yeni alan, geri uyumlu
const type = state.lastPost.type
  ?? (state.lastPost.carousel === true ? 'carousel' : 'carousel'); // legacy default

let result;
if (type === 'reel') {
  const videoUrl = `${base}/${date}.mp4`;
  console.log(`Reel paylaşılıyor: ${videoUrl}`);
  result = await postReelToInstagram({
    igUserId,
    accessToken,
    videoUrl,
    caption: entry.caption
  });
  console.log(`Reel paylasildi: ${result.postId}`);
} else if (state.lastPost.carousel) {
  result = await postCarouselToInstagram({
    igUserId,
    accessToken,
    imageUrls: [`${base}/${date}-1.png`, `${base}/${date}-2.png`],
    caption: entry.caption
  });
  console.log(`Carousel paylasildi: ${result.postId}`);
} else {
  result = await postToInstagram({
    igUserId,
    accessToken,
    imageUrl: `${base}/${date}-1.png`,
    caption: entry.caption
  });
  console.log(`Tekli gonderi paylasildi: ${result.postId}`);
}

writeState(statePath, {
  ...state,
  lastPost: { ...state.lastPost, postId: result.postId }
});
