// Mood → Pexels arama terimi (Sufi/Islamic temalı)
const MOOD_QUERIES = {
  'divan': [
    'islamic calligraphy', 'arabic manuscript', 'quran writing',
    'mosque interior', 'ottoman calligraphy', 'arabic art'
  ],
  'ic-dunya': [
    'mosque interior dome', 'mosque arch', 'mosque architecture',
    'samarkand mosque', 'bukhara mosque', 'registan',
    'blue mosque istanbul', 'hagia sophia', 'suleymaniye',
    'sheikh zayed mosque', 'sultan ahmed mosque', 'islamic architecture',
    'mosque tiles', 'iznik tile', 'persian mosque'
  ],
  'tefekkür': [
    'mosque prayer', 'mosque interior peaceful', 'mosque candle',
    'mosque sunlight rays', 'mosque silence', 'prayer beads tesbih',
    'mosque morning light', 'medina mosque', 'masjid nabawi'
  ]
};

const FALLBACK_QUERIES = [
  'mosque interior', 'mosque dome', 'islamic architecture',
  'samarkand', 'bukhara', 'persian mosque', 'turkish mosque',
  'islamic calligraphy', 'arabic manuscript'
];

// Süre aralıkları sıralı olarak denenecek - sıkıdan gevşeğe.
// Video render'ımız 33 saniye, en az 34 saniyelik kaynak ideal (loop atlama olmasın).
const DURATION_RANGES = [
  { min: 34, max: 60 },
  { min: 34, max: 90 },
  { min: 28, max: 90 },
  { min: 22, max: 120 }
];

async function searchPage(apiKey, query) {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '15');

  const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
  if (!res.ok) {
    console.warn(`Pexels arama "${query}" başarısız: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.videos ?? [];
}

function pickBestFile(video) {
  const files = (video.video_files ?? [])
    .filter(f => f.height >= 1080 && f.width <= 1080)
    .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920));
  return files[0];
}

/**
 * Pexels API'den mood'a uygun aday video listesi getirir (sıkı süreden gevşeğe).
 * Caller bu adayları sırayla deneyip hangisi moderasyondan geçerse onu kullanır.
 *
 * @param {string[]} moods
 * @param {string} apiKey
 * @param {Set<string>} usedVideoIds
 * @returns {Promise<Array<{id, url, duration, query}>>}
 */
export async function fetchPexelsCandidates(moods, apiKey, usedVideoIds = new Set()) {
  if (!apiKey) throw new Error('PEXELS_API_KEY tanımlı değil');

  const moodQueries = moods.flatMap(m => MOOD_QUERIES[m] ?? []);
  const queries = [...new Set([...moodQueries, ...FALLBACK_QUERIES])];

  const cache = new Map();
  const candidates = [];
  const seenIds = new Set();

  for (const range of DURATION_RANGES) {
    for (const query of queries) {
      let videos = cache.get(query);
      if (!videos) {
        videos = await searchPage(apiKey, query);
        cache.set(query, videos);
      }

      for (const video of videos) {
        if (video.duration < range.min || video.duration > range.max) continue;
        const fullId = `pexels-${video.id}`;
        if (usedVideoIds.has(fullId)) continue;
        if (seenIds.has(fullId)) continue;
        const best = pickBestFile(video);
        if (!best) continue;
        seenIds.add(fullId);
        candidates.push({
          id: fullId,
          url: best.link,
          duration: video.duration,
          query,
          width: best.width,
          height: best.height,
          range: `${range.min}-${range.max}`
        });
      }
    }
    if (candidates.length >= 5) break; // 5 aday yeterli; reddedilirse bir sonraki çekime geçer
    console.log(`Süre aralığı ${range.min}-${range.max}sn ile ${candidates.length} aday, gerekirse genişletiliyor...`);
  }

  if (candidates.length === 0) {
    throw new Error(`Pexels'te uygun yeni video bulunamadı (mood: ${moods.join(', ')}, kullanılmış: ${usedVideoIds.size})`);
  }
  return candidates;
}

/**
 * Geri uyumluluk için: ilk adayı dön (eski kullanım).
 */
export async function fetchPexelsVideo(moods, apiKey, usedVideoIds = new Set()) {
  const list = await fetchPexelsCandidates(moods, apiKey, usedVideoIds);
  return list[0];
}
