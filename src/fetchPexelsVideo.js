// Mood → Pexels arama terimi (Sufi/Islamic temalı)
const MOOD_QUERIES = {
  'divan':    ['islamic calligraphy', 'mosque interior', 'arabic manuscript'],
  'ic-dunya': ['mosque arch', 'mosque dome', 'sufi spiritual'],
  'tefekkür': ['mosque prayer', 'mosque interior', 'mosque candle']
};

const FALLBACK_QUERIES = ['mosque', 'sufi', 'islamic architecture'];

// Süre aralıkları sıralı olarak denenecek - sıkıdan gevşeğe.
const DURATION_RANGES = [
  { min: 22, max: 45 },
  { min: 22, max: 60 },
  { min: 18, max: 60 },
  { min: 15, max: 90 }
];

async function searchPage(apiKey, query) {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '40');

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
 * Pexels API'den şiirin mood'larına göre uygun bir portrait video bulur.
 * Hiç kullanılmamış videoları tercih eder. Süre filtresi boş sonuç verirse
 * genişleterek tekrar dener.
 *
 * @param {string[]} moods
 * @param {string} apiKey
 * @param {Set<string>} usedVideoIds - daha önce paylaşılmış TÜM video ID'leri (kalıcı)
 * @returns {Promise<{id: string, url: string, duration: number, query: string}>}
 */
export async function fetchPexelsVideo(moods, apiKey, usedVideoIds = new Set()) {
  if (!apiKey) throw new Error('PEXELS_API_KEY tanımlı değil');

  const moodQueries = moods.flatMap(m => MOOD_QUERIES[m] ?? []);
  const queries = [...new Set([...moodQueries, ...FALLBACK_QUERIES])];

  // Tüm sorgu sonuçlarını cache'le ki süre aralığını gevşetince yeniden istemeye gerek kalmasın.
  const cache = new Map(); // query -> videos[]

  for (const range of DURATION_RANGES) {
    for (const query of queries) {
      let videos = cache.get(query);
      if (!videos) {
        videos = await searchPage(apiKey, query);
        cache.set(query, videos);
      }

      const candidates = videos
        .filter(v => v.duration >= range.min && v.duration <= range.max)
        .filter(v => !usedVideoIds.has(`pexels-${v.id}`));

      for (const video of candidates) {
        const best = pickBestFile(video);
        if (!best) continue;
        console.log(`Pexels foto bulundu: ${video.id} "${query}" ${best.width}x${best.height} ${video.duration}sn (range ${range.min}-${range.max})`);
        return {
          id: `pexels-${video.id}`,
          url: best.link,
          duration: video.duration,
          query
        };
      }
    }
    console.log(`Süre aralığı ${range.min}-${range.max}sn ile uygun yeni video yok, genişletiliyor...`);
  }

  throw new Error(`Pexels'te uygun yeni video bulunamadı (mood: ${moods.join(', ')}, kullanılmış: ${usedVideoIds.size})`);
}
