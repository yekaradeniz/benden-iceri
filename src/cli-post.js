import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  postToInstagram,
  postCarouselToInstagram,
  postReelToInstagram,
  checkTokenHealth,
  fetchRecentMedia,
  ActionBlockError
} from './postToInstagram.js';
import { readState, writeState } from './state.js';
import { buildCaption } from './buildCaption.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const statePath = join(ROOT, 'output', 'log.json');
const state = readState(statePath);

// Caption'in ayirt edici ilk satiri (misra'nin ilk satiri her misrada essizdir).
function captionFirstLineOf(caption) {
  return (caption.split('\n').find(l => l.trim().length > 0) ?? '').trim();
}

function captionMatches(igCaption, ourFirstLine) {
  if (!igCaption || !ourFirstLine) return false;
  const norm = s => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
  return norm(igCaption).includes(norm(ourFirstLine));
}

/**
 * Instagram'da bu misra (caption ilk satiri) ile eslesn yakin zamanli bir post
 * var mi? Propagation gecikmesi icin birkac kez poll'lar.
 * @returns eslesn post {id,timestamp,caption} veya null
 */
async function findPostedByCaption({ igUserId, accessToken, firstLine, maxAgeMs, attempts, delayMs }) {
  for (let i = 0; i < attempts; i++) {
    let recent = [];
    try {
      recent = await fetchRecentMedia({ igUserId, accessToken });
    } catch (e) {
      console.warn(`  IG son gonderiler cekilemedi (deneme ${i + 1}/${attempts}): ${e.message}`);
    }
    const now = Date.now();
    const hit = recent.find(m =>
      captionMatches(m.caption, firstLine) &&
      (now - new Date(m.timestamp).getTime()) <= maxAgeMs
    );
    if (hit) return hit;
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

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

// 3) Caption'i runtime'da uret (verse ilk satiri + hashtag rotation)
const caption = buildCaption(entry, date);
const captionFirstLine = captionFirstLineOf(caption);
console.log(`Caption (${caption.length} char): ${caption.split('\n')[0]}...`);

// 4) Cift-post korumasi: bu misra Instagram'da yakin zamanda zaten atildiysa
//    tekrar atma. id yerine caption ile eslestiririz (propagation gecikmesine
//    dayanikli, birkac kez poll'lar). Bulunursa state senkronlanip cikilir.
{
  const dupe = await findPostedByCaption({
    igUserId, accessToken,
    firstLine: captionFirstLine,
    maxAgeMs: 20 * 60 * 60 * 1000, // 20 saat: gunde tek post hesabi
    attempts: 2,
    delayMs: 8000
  });
  if (dupe) {
    const dkOnce = Math.round((Date.now() - new Date(dupe.timestamp).getTime()) / 60000);
    console.log(`Bu misra Instagram'da zaten var (post ${dupe.id}, ${dkOnce} dk once). Tekrar atilmiyor, state senkronlaniyor.`);
    writeState(statePath, {
      ...state,
      lastPost: { ...state.lastPost, postId: dupe.id },
      lastSuccessfulPostId: dupe.id,
      cooldownUntil: null
    });
    process.exit(0);
  }
}

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
  console.error(`Publish hata: ${err.name}: ${err.message}`);

  // KRITIK: Instagram media_publish'i sunucu tarafinda gerceklestirip yine de
  // rate-limit/action-block hatasi donebilir. Hatayi "atilamadi" saymadan once
  // caption ile gercekten yayinlanmis mi diye dogrula (propagation gecikmesi
  // icin ~1 dk poll'la). Yayinlanmissa basarili olarak kaydet -> bir sonraki
  // run farkli misra atip cift-post / sira bozulmasi olmaz.
  const reconciled = await findPostedByCaption({
    igUserId, accessToken,
    firstLine: captionFirstLine,
    maxAgeMs: 15 * 60 * 1000,
    attempts: 5,
    delayMs: 12000
  });
  if (reconciled) {
    console.log(`Hataya ragmen YAYINLANMIS: post ${reconciled.id}. State basarili olarak kaydediliyor (cift-post engellendi).`);
    writeState(statePath, {
      ...state,
      lastPost: { ...state.lastPost, postId: reconciled.id },
      lastSuccessfulPostId: reconciled.id,
      cooldownUntil: null
    });
    process.exit(0);
  }

  if (err instanceof ActionBlockError) {
    // Gercekten yayinlanmamis + action block: 6 saat cooldown, workflow basarili bitsin
    const cooldownHours = 6;
    const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString();
    console.log(`Action block (dogrulandi: yayinlanmamis): ${err.message}`);
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
