import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { postStoryToInstagram } from './postToInstagram.js';
import { readState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

// Son post henüz paylaşılmamışsa atla
if (!state.lastPost?.postId) {
  console.log('Son post henüz paylaşılmamış (postId yok). Story atlanıyor.');
  process.exit(0);
}

const repo = process.env.GITHUB_REPOSITORY;
const branch = process.env.GITHUB_REF_NAME ?? 'main';
if (!repo) throw new Error('GITHUB_REPOSITORY env var gerekli');

const base = `https://raw.githubusercontent.com/${repo}/${branch}/output`;
const date = state.lastPost.date;
const imageUrl = `${base}/${date}-1.png`;

const igUserId = process.env.IG_USER_ID;
const accessToken = process.env.IG_ACCESS_TOKEN;

console.log(`Story paylaşılıyor: ${imageUrl}`);
const { storyId } = await postStoryToInstagram({ igUserId, accessToken, imageUrl });
console.log(`Story paylasildi: ${storyId}`);
