// Mood → Unsplash arama terimi
const MOOD_KEYWORDS = {
  'mihrap':      'mosque interior mihrab',
  'tefekkür':    'mosque prayer spiritual',
  'ic-dunya':    'islamic architecture',
  'halvet':      'sufi mosque meditation',
  'divan':       'islamic calligraphy manuscript',
  'ask-yangini': 'whirling dervish sufi',
  'yalnizlik':   'desert silence dunes',
  'seyran':      'mecca medina holy mosque',
  'gece':        'night desert stars mosque'
};

const FALLBACK_KEYWORD = 'mosque islamic spiritual';

/**
 * Unsplash API'den şiirin mood'larına göre rastgele bir portre fotoğrafı çeker.
 * @param {string[]} moods - şiirin mood etiketleri
 * @param {string} accessKey - Unsplash API access key
 * @param {Set<string>} recentlyUsed - son kullanılan Unsplash foto ID'leri (tekrar önleme)
 * @param {number} maxAttempts
 * @returns {Promise<{id, url, moods}>}
 */
export async function fetchUnsplashPhoto(moods, accessKey, recentlyUsed = new Set(), maxAttempts = 5) {
  // Mood'lardan anahtar kelime belirle
  const keyword = moods
    .map(m => MOOD_KEYWORDS[m])
    .filter(Boolean)[0] ?? FALLBACK_KEYWORD;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = new URL('https://api.unsplash.com/photos/random');
    url.searchParams.set('query', keyword);
    url.searchParams.set('orientation', 'portrait');
    url.searchParams.set('client_id', accessKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Unsplash API hatası ${res.status}: ${err.errors?.[0] ?? res.statusText}`);
    }

    const data = await res.json();
    const photoId = `unsplash-${data.id}`;
    const photoUrl = `${data.urls.raw}&w=1200&q=85&fit=crop&crop=entropy`;

    if (recentlyUsed.has(photoId)) {
      console.log(`  Unsplash ${data.id} son kullanılanlarda, tekrar deneniyor...`);
      continue;
    }

    console.log(`  Unsplash foto: ${data.id} (${data.description ?? data.alt_description ?? 'açıklama yok'})`);
    return { id: photoId, url: photoUrl, moods };
  }

  // Tüm denemeler recently-used ile çakıştı, son çekileni kullan (nadir durum)
  const url = new URL('https://api.unsplash.com/photos/random');
  url.searchParams.set('query', keyword);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('client_id', accessKey);
  const res = await fetch(url.toString());
  const data = await res.json();
  return { id: `unsplash-${data.id}`, url: `${data.urls.raw}&w=1200&q=85&fit=crop&crop=entropy`, moods };
}
