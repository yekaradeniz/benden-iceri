import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { postToInstagram } from './postToInstagram.js';
import { readState, writeState } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const verses = JSON.parse(readFileSync(join(ROOT, 'content', 'verses.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

if (!state.lastPost || !state.lastPost.date) {
  throw new Error('No pending post in state. Run npm run render first.');
}

const verse = verses.find(v => v.id === state.lastPost.verseId);
if (!verse) throw new Error(`Verse ${state.lastPost.verseId} not found`);

const repo = process.env.GITHUB_REPOSITORY;
const branch = process.env.GITHUB_REF_NAME ?? 'main';
if (!repo) throw new Error('GITHUB_REPOSITORY env var required');

const imageUrl = `https://raw.githubusercontent.com/${repo}/${branch}/output/${state.lastPost.date}.png`;

const result = await postToInstagram({
  igUserId: process.env.IG_USER_ID,
  accessToken: process.env.IG_ACCESS_TOKEN,
  imageUrl,
  caption: verse.caption
});

writeState(statePath, {
  ...state,
  lastPost: { ...state.lastPost, postId: result.postId }
});

console.log(`✓ Posted ${result.postId}: ${imageUrl}`);
