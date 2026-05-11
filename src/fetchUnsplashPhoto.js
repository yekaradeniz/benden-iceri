// Mood → Unsplash arama terimi havuzu (her seferinde rastgele birini seçer)
const MOOD_KEYWORDS = {
  'mihrap': [
    'mosque interior mihrab', 'mosque arch', 'masjid mihrab',
    'sultan ahmed mosque interior', 'hagia sophia interior'
  ],
  'tefekkür': [
    'mosque prayer', 'mosque silence', 'mosque morning light',
    'medina mosque', 'masjid nabawi', 'mosque sunlight',
    'prayer beads tesbih', 'mosque candle'
  ],
  'ic-dunya': [
    'islamic architecture', 'mosque dome', 'mosque interior',
    'samarkand registan', 'bukhara mosque',
    'blue mosque istanbul', 'hagia sophia', 'suleymaniye',
    'sheikh zayed mosque', 'iznik tile', 'persian mosque',
    'turkish mosque interior', 'cordoba mosque'
  ],
  'halvet': [
    'mosque empty quiet', 'mosque solitude', 'islamic monastery',
    'sufi spiritual', 'mosque meditation', 'dervish cell'
  ],
  'divan': [
    'islamic calligraphy', 'arabic manuscript', 'quran writing',
    'ottoman calligraphy', 'arabic art', 'islamic illumination tezhip'
  ],
  'ask-yangini': [
    'whirling dervish', 'mevlevi sema', 'sufi dance',
    'mosque candle light', 'mosque chandelier'
  ],
  'yalnizlik': [
    'desert silence dunes', 'desert solitude', 'mosque desert',
    'minaret silhouette', 'mountain mist solitude'
  ],
  'seyran': [
    'mecca kaaba', 'medina mosque', 'masjid al haram',
    'mosque pilgrimage', 'islamic holy place'
  ],
  'gece': [
    'night desert stars', 'mosque night', 'minaret moonlight',
    'mosque illuminated night', 'starry sky mosque'
  ]
};

const FALLBACK_KEYWORDS = [
  'mosque interior',
  'islamic architecture',
  'samarkand mosque',
  'persian mosque',
  'turkish mosque',
  'islamic calligraphy'
];

/**
 * Unsplash API'den şiirin mood'larına göre rastgele bir portre fotoğrafı çeker.
 * @param {string[]} moods - şiirin mood etiketleri
 * @param {string} accessKey - Unsplash API access key
 * @param {Set<string>} recentlyUsed - son kullanılan Unsplash foto ID'leri (tekrar önleme)
 * @param {number} maxAttempts
 * @returns {Promise<{id, url, moods}>}
 */
export async function fetchUnsplashPhoto(moods, accessKey, recentlyUsed = new Set(), maxAttempts = 5) {
  // Mood'lardan keyword havuzu çıkar (her mood için birden fazla aday var)
  const moodPool = moods.flatMap(m => MOOD_KEYWORDS[m] ?? []);
  const pool = moodPool.length > 0 ? moodPool : FALLBACK_KEYWORDS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Her denemede havuzdan rastgele bir keyword seç (çeşitlilik)
    const keyword = pool[Math.floor(Math.random() * pool.length)];
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
