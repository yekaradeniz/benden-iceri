import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  postToInstagram,
  postCarouselToInstagram,
  postReelToInstagram,
  checkTokenHealth,
  fetchLatestMedia,
  ActionBlockError
} from './postToInstagram.js';
import { readState, writeState } from './state.js';
import { buildCaption } from './buildCaption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

if (!state.lastPost?.date) {
  throw new Error('Bekleyen post yok. Önce npm run render çalıştırın.');
}

// 1) Cooldown kontrolu: onceki run action block aldiysa belirli sure post atilmaz
if (state.cooldownUntil) {
  const cooldownDate = new Date(state.cooldownUntil);
  if (cooldownDate > new Date()) {
    const remainMin = Math.ceil((cooldownDate.getTime() - Date.now()) / 60000);
    console.log(`Cooldown aktif: ${state.cooldownUntil} kadar bekleniyor (~${remainMin} dk). Post atlaniyor.`);
    process.exit(0);
  }
  console.log('Cooldown suresi doldu, devam ediliyor.');
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
if (!igUserId || !accessToken) {
  throw new Error('IG_USER_ID veya IG_ACCESS_TOKEN env var eksik');
}

// 2) Pre-flight token health check
try {
  const me = await checkTokenHealth({ igUserId, accessToken });
  console.log(`Token saglikli: ${me.username || me.id}`);
} catch (err) {
  console.error(`Token health check basarisiz: ${err.message}`);
  throw new Error(`Token gecersiz veya erisim yok: ${err.message}`);
}

// 3) Senkron kontrolu: Instagram'in son postId'si state.lastSuccessfulPostId ile esit mi?
{
  const igLatest = await fetchLatestMedia({ igUserId, accessToken });
  const previousPostId = state.lastSuccessfulPostId;

  if (igLatest && previousPostId && igLatest.id !== previousPostId) {
    const ageMs = Date.now() - new Date(igLatest.timestamp).getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    if (ageMs < twentyFourHoursMs) {
      console.log(`Senkron uyusmazligi: Instagram son post ${igLatest.id} state'de bilinmiyor, ${Math.round(ageMs/60000)} dk once atildi. State guncelleniyor, atlaniyor.`);
      writeState(statePath, {
        ...state,
        lastPost: { ...state.lastPost, postId: igLatest.id },
        lastSuccessfulPostId: igLatest.id
      });
      process.exit(0);
    }
    console.log(`Instagram son post ${igLatest.id} state'de bilinmiyor ama ${Math.round(ageMs/60000)} dk once atilmis (>24 saat). Devam ediyor.`);
  } else if (igLatest && previousPostId && igLatest.id === previousPostId) {
    console.log(`Senkron OK: Instagram son post (${igLatest.id}) state ile esit. Post devam ediyor.`);
  } else {
    console.log(`State'de lastSuccessfulPostId yok veya IG bos. Post devam ediyor.`);
  }
}

// 4) Caption'i runtime'da uret (verse ilk satiri + hashtag rotation)
const caption = buildCaption(entry, date);
console.log(`Caption (${caption.length} char): ${caption.split('\n')[0]}...`);

const type = state.lastPost.type
  ?? (state.lastPost.carousel === true ? 'carousel' : 'photo');

async function publishPost() {
  if (type === 'reel') {
    const videoUrl = `${base}/${date}.mp4`;
    console.log(`Reel paylaşılıyor: ${videoUrl}`);
    return postReelToInstagram({ igUserId, accessToken, videoUrl, caption });
  } else if (state.lastPost.carousel) {
    return postCarouselToInstagram({
      igUserId, accessToken,
      imageUrls: [`${base}/${date}-1.png`, `${base}/${date}-2.png`],
      caption
    });
  } else {
    return postToInstagram({
      igUserId, accessToken,
      imageUrl: `${base}/${date}-1.png`,
      caption
    });
  }
}

let result;
try {
  result = await publishPost();
  console.log(`Paylasildi (${type}): ${result.postId}`);
} catch (err) {
  if (err instanceof ActionBlockError) {
    // 6 saat cooldown set, workflow basarili bitsin
    const cooldownHours = 6;
    const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString();
    console.log(`Action block tespit edildi: ${err.message}`);
    console.log(`Cooldown ${cooldownHours} saat olarak ayarlandi: ${cooldownUntil}`);
    writeState(statePath, { ...state, cooldownUntil });
    process.exit(0);
  }
  throw err;
}

writeState(statePath, {
  ...state,
  lastPost: { ...state.lastPost, postId: result.postId },
  lastSuccessfulPostId: result.postId,
  cooldownUntil: null
});
