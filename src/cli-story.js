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

const igUserId = process.env.IG_USER_ID;
const accessToken = process.env.IG_ACCESS_TOKEN;
const postId = state.lastPost.postId;

// Instagram'daki gerçek media URL'ini al
const API_BASE = 'https://graph.facebook.com/v21.0';

async function getMediaUrl(mediaId) {
  // Önce tipi öğren
  const res = await fetch(
    `${API_BASE}/${mediaId}?fields=media_type,media_url,children{media_url}&access_token=${accessToken}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || res.statusText);

  if (data.media_type === 'CAROUSEL_ALBUM') {
    // Carousel: ilk child'ın URL'ini al
    const firstChild = data.children?.data?.[0];
    if (!firstChild) throw new Error('Carousel child bulunamadi');
    const childRes = await fetch(
      `${API_BASE}/${firstChild.id}?fields=media_url&access_token=${accessToken}`
    );
    const childData = await childRes.json();
    if (!childRes.ok) throw new Error(childData.error?.message || childRes.statusText);
    return childData.media_url;
  }

  return data.media_url;
}

console.log(`Son post media URL'i aliniyor (postId: ${postId})...`);
const imageUrl = await getMediaUrl(postId);
console.log(`Story paylasilıyor: ${imageUrl}`);

const { storyId } = await postStoryToInstagram({ igUserId, accessToken, imageUrl });
console.log(`Story paylasildi: ${storyId}`);
