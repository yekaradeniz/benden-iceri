import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { postToInstagram, postCarouselToInstagram } from './postToInstagram.js';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

if (!state.lastPost?.date) {
  throw new Error('Bekleyen post yok. Önce npm run render çalıştırın.');
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

let result;
if (state.lastPost.carousel) {
  result = await postCarouselToInstagram({
    igUserId,
    accessToken,
    imageUrls: [`${base}/${date}-1.png`, `${base}/${date}-2.png`],
    caption: entry.caption
  });
  console.log(`✓ Carousel paylaşıldı: ${result.postId}`);
} else {
  result = await postToInstagram({
    igUserId,
    accessToken,
    imageUrl: `${base}/${date}-1.png`,
    caption: entry.caption
  });
  console.log(`✓ Tekli gönderi paylaşıldı: ${result.postId}`);
}

writeState(statePath, {
  ...state,
  lastPost: { ...state.lastPost, postId: result.postId }
});
