// Mood → Pexels arama terimi (Sufi/Islamic temalı)
const MOOD_QUERIES = {
  'divan':    ['islamic calligraphy', 'mosque interior', 'arabic manuscript'],
  'ic-dunya': ['mosque arch', 'mosque dome', 'sufi spiritual'],
  'tefekkür': ['mosque prayer', 'mosque interior', 'mosque candle']
};

const FALLBACK_QUERIES = ['mosque', 'sufi', 'islamic architecture'];

/**
 * Pexels API'den şiirin mood'larına göre uygun bir portrait video bulur ve URL'ini döner.
 * Filtreler: dikey, 22-45 sn, HD (en az 1080 yüksekliği).
 *
 * @param {string[]} moods
 * @param {string} apiKey - Pexels API key
 * @param {Set<string>} recentlyUsed - daha önce kullanılmış video ID'leri
 * @returns {Promise<{id: string, url: string, duration: number}>}
 */
export async function fetchPexelsVideo(moods, apiKey, recentlyUsed = new Set()) {
  if (!apiKey) throw new Error('PEXELS_API_KEY tanımlı değil');

  // Mood'a göre kelime havuzu, sonra fallback
  const moodQueries = moods.flatMap(m => MOOD_QUERIES[m] ?? []);
  const queries = [...new Set([...moodQueries, ...FALLBACK_QUERIES])];

  for (const query of queries) {
    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.set('query', query);
    url.searchParams.set('orientation', 'portrait');
    url.searchParams.set('per_page', '20');

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey }
    });
    if (!res.ok) {
      console.warn(`Pexels arama "${query}" başarısız: ${res.status}`);
      continue;
    }
    const data = await res.json();

    // Süre 22-45 sn arası, en az 1080 yükseklik, daha önce kullanılmamış
    const candidates = (data.videos ?? [])
      .filter(v => v.duration >= 22 && v.duration <= 45)
      .filter(v => !recentlyUsed.has(`pexels-${v.id}`));

    for (const video of candidates) {
      // En uygun video dosyasını seç: 1080x1920 ideal, en azından 1080 yüksekliği
      const files = (video.video_files ?? [])
        .filter(f => f.height >= 1080 && f.width <= 1080)
        .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920));

      if (files.length === 0) continue;

      const best = files[0];
      console.log(`Pexels foto bulundu: ${video.id} "${query}" ${best.width}x${best.height} ${video.duration}sn`);
      return {
        id: `pexels-${video.id}`,
        url: best.link,
        duration: video.duration,
        query
      };
    }
  }

  throw new Error(`Pexels'te uygun video bulunamadı (mood: ${moods.join(', ')})`);
}
