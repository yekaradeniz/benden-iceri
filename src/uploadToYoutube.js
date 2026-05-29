import { readFileSync, statSync } from 'node:fs';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

/**
 * Refresh token kullanarak yeni bir access token alir.
 */
async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`YouTube token yenileme basarisiz: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * Baslik: ilk misra + marka. Aranabilir ama vakarli (clickbait yok).
 * Ornek: "Bed' olunsun besmeleyle hamdeleyle evsatı | Salih Baba Dîvânı"
 * YouTube baslik limiti 100 karakter - asarsa misra kisaltilir, marka korunur.
 */
function buildTitle(verse) {
  const firstLine = (String(verse).split('\n').find(l => l.trim().length > 0) ?? '').trim();
  // Misra sonundaki noktalama baslikta hos durmaz, temizle
  const clean = firstLine.replace(/[.,;:]+$/, '').trim();
  const suffix = ' | Salih Baba Dîvânı';
  const maxMisra = 100 - suffix.length;
  const base = clean.length > maxMisra ? clean.slice(0, maxMisra - 1).trim() + '…' : clean;
  return `${base}${suffix}`;
}

/**
 * Aciklama: tam beyit + manasi + kunye + aranabilir terimler + hashtag.
 * Bu kitle (tasavvuf okuyucusu) icin kunye/kaynak guven verir; arama terimleri
 * dogal cumle icinde gecer (spam degil).
 */
function buildDescription({ verse, explanation }) {
  const parts = [];

  // 1) Tam beyit
  parts.push(verse.trim());

  // 2) Manasi (varsa)
  if (explanation && explanation.trim()) {
    parts.push(`\nMânâsı:\n${explanation.trim()}`);
  }

  // 3) Kunye / kaynak - guven ve ciddiyet
  parts.push('\nSalih Baba Dîvânı\'ndan. Her gün bir beyit, mânâsıyla birlikte paylaşılmaktadır.');

  // 4) Aranabilir terimler - dogal cumle icinde
  parts.push('Tasavvuf şiirleri, Nakşibendî geleneği ve ilâhî aşk yolunun beyitleri için kanalımıza abone olabilirsiniz.');

  // 5) Hashtagler (en sonda, az ve oz). #Shorts gereksiz: YouTube dikey/sure ile otomatik anlar.
  parts.push('\n#SalihBaba #SalihBabaDîvânı #Tasavvuf #Nakşibendî #İlahiAşk #TasavvufŞiirleri #Sufizm');

  return parts.join('\n');
}

// Aranabilir, alakali tag'ler (YouTube tag alani)
const VIDEO_TAGS = [
  'salih baba', 'salih baba dîvânı', 'salih baba divanı', 'erzurumlu salih baba',
  'tasavvuf', 'tasavvuf şiirleri', 'tasavvuf sözleri',
  'nakşibendi', 'nakşibendî', 'sufizm', 'sufi',
  'ilahi aşk', 'aşk-ı ilahi', 'divan edebiyatı', 'osmanlı şiiri',
  'tekke şiiri', 'marifet', 'tefekkür'
];

/**
 * Resumable upload ile YouTube'a video yukler.
 * @param {object} opts
 * @param {string} opts.videoPath    - lokal MP4 dosyasi
 * @param {string} opts.verse        - misra metni (baslik + aciklama icin)
 * @param {string} [opts.explanation] - manasi (aciklama icin, varsa)
 * @param {string} [opts.caption]    - (geriye donuk uyumluluk; artik kullanilmiyor)
 * @param {string} opts.clientId
 * @param {string} opts.clientSecret
 * @param {string} opts.refreshToken
 * @returns {Promise<{videoId: string, url: string}>}
 */
export async function uploadToYoutube({ videoPath, verse, explanation, caption, clientId, clientSecret, refreshToken }) {
  const accessToken = await getAccessToken({ clientId, clientSecret, refreshToken });

  const title = buildTitle(verse);
  const description = buildDescription({ verse, explanation });

  const metadata = {
    snippet: {
      title,
      description,
      tags: VIDEO_TAGS,
      categoryId: '29'   // Nonprofits & Activism
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false
    }
  };

  const fileSize = statSync(videoPath).size;
  const videoBuffer = readFileSync(videoPath);

  // 1) Resumable upload oturumu ac
  const initRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(fileSize)
    },
    body: JSON.stringify(metadata)
  });

  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`YouTube upload init basarisiz (${initRes.status}): ${body}`);
  }

  const uploadUri = initRes.headers.get('location');
  if (!uploadUri) {
    throw new Error('YouTube upload URI alinamadi (Location header yok)');
  }

  // 2) Videoyu yukle
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize)
    },
    body: videoBuffer
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`YouTube video upload basarisiz (${uploadRes.status}): ${body}`);
  }

  const result = await uploadRes.json();
  const videoId = result.id;
  if (!videoId) {
    throw new Error(`YouTube upload sonucu beklenmedi: ${JSON.stringify(result)}`);
  }

  return {
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`
  };
}
