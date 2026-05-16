// Mood → Unsplash arama terimi havuzu (her seferinde rastgele birini seçer)
const MOOD_KEYWORDS = {
  'mihrap': [
    'mosque interior mihrab', 'mosque arch', 'masjid mihrab',
    'sultan ahmed mosque interior', 'hagia sophia interior',
    'mosque niche arch', 'islamic mihrab ornament',
    'mosque golden dome interior', 'masjid ceiling dome',
    'mosque pillar arch', 'ottoman mosque interior detail'
  ],
  'tefekkür': [
    'mosque prayer', 'mosque silence', 'mosque morning light',
    'medina mosque', 'masjid nabawi', 'mosque sunlight',
    'prayer beads tesbih', 'mosque candle',
    'mosque empty hall light', 'mosque window light rays',
    'islamic prayer atmosphere', 'mosque peaceful interior',
    'mosque dawn light', 'mosque soft light columns'
  ],
  'ic-dunya': [
    'islamic architecture', 'mosque dome', 'mosque interior',
    'samarkand registan', 'bukhara mosque',
    'blue mosque istanbul', 'hagia sophia', 'suleymaniye',
    'sheikh zayed mosque', 'iznik tile', 'persian mosque',
    'turkish mosque interior', 'cordoba mosque',
    'mosque geometric pattern', 'islamic tilework',
    'mosque muqarnas ceiling', 'ottoman mosque tile',
    'mosque arabesque detail', 'masjid dome ceiling',
    'istanbul mosque interior', 'mosque courtyard fountain',
    'umayyad mosque damascus', 'masjid al aqsa interior',
    'mosque stalactite ceiling', 'kairouan mosque',
    'mosque gold calligraphy', 'mosque blue tile wall'
  ],
  'halvet': [
    'mosque empty quiet', 'mosque solitude', 'islamic monastery',
    'sufi spiritual', 'mosque meditation', 'dervish cell',
    'mosque corridor empty', 'mosque silent hall',
    'tekke dervish lodge', 'mosque stone archway',
    'mosque dim light corner', 'masjid empty prayer hall'
  ],
  'divan': [
    'islamic calligraphy', 'arabic manuscript', 'quran writing',
    'ottoman calligraphy', 'arabic art', 'islamic illumination tezhip',
    'ottoman manuscript illumination', 'arabic calligraphy gold',
    'quran pages detail', 'islamic geometric art',
    'mosque inscription calligraphy', 'arabic script wall'
  ],
  'ask-yangini': [
    'whirling dervish', 'mevlevi sema',
    'mosque candle light', 'mosque chandelier',
    'mosque lantern light', 'mosque oil lamp',
    'mosque chandelier gold', 'islamic lantern glow',
    'sufi shrine lamp', 'mosque torch flame',
    'islamic devotion prayer', 'mosque spiritual light'
  ],
  'seyran': [
    'mecca kaaba', 'medina mosque', 'masjid al haram',
    'mosque pilgrimage', 'islamic holy place',
    'kaaba aerial view', 'masjid nabawi dome green',
    'mosque grand courtyard', 'islamic shrine architecture',
    'mosque entrance gate', 'masjid al haram night'
  ],
  'gece': [
    'night desert stars', 'mosque night', 'minaret moonlight',
    'mosque illuminated night', 'starry sky mosque',
    'mosque night lights reflection', 'minaret night sky',
    'mosque blue hour', 'islamic architecture night',
    'mosque lit up dark', 'masjid night illumination'
  ]
};

const FALLBACK_KEYWORDS = [
  'mosque interior',
  'islamic architecture',
  'samarkand mosque',
  'persian mosque',
  'turkish mosque',
  'islamic calligraphy',
  'mosque dome ceiling',
  'ottoman mosque',
  'mosque minaret',
  'masjid interior light'
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
