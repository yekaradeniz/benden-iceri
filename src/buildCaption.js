// Instagram spam koruma algoritmasi ayni caption'i tekrarlayan hesaplari
// flag eder. Bu yuzden her gun verse'in ilk satiri + rotating hashtag seti
// uretiyoruz. Tum captionlar farkli ama brand kimligi (#tasavvuf, #salihbaba
// gibi core taglar) korunuyor.

const CORE_TAGS = ['#tasavvuf', '#salihbaba', '#salihhbabadivani'];

const ROTATION_POOL = [
  '#divân', '#tekke', '#tasavvufyolu', '#sufizm', '#osmanlışiiri',
  '#gönül', '#marifet', '#ilahiaşk', '#manevi', '#ruhani',
  '#hikmet', '#aşkıilahi', '#tefekkür', '#mevlana', '#yunusemre',
  '#nakşibendi', '#irfan', '#zikir', '#fenafillah', '#vahdet',
  '#dervish', '#aşk', '#sufi', '#kalp', '#beytullah'
];

const ROTATION_COUNT = 4;

const INTRO_VARIANTS = [
  v => `"${v}"`,
  v => `"${v}"\n— Salih Baba`,
  v => `Salih Baba Dîvânı'ndan:\n\n"${v}"`,
  v => `Dîvân-ı Salih Baba:\n\n"${v}"`,
  v => `"${v}"\n\nSalih Baba`,
  v => `Bugünün beyiti:\n\n"${v}"`
];

function dateSeed(dateStr) {
  return dateStr.split('-').reduce((acc, n) => acc * 31 + parseInt(n, 10), 0);
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickIntro(verse, seed) {
  const firstLine = verse.split('\n')[0].trim();
  const idx = seed % INTRO_VARIANTS.length;
  return INTRO_VARIANTS[idx](firstLine);
}

export function buildCaption(entry, dateStr) {
  if (!entry || typeof entry.verse !== 'string' || entry.verse.trim() === '') {
    throw new Error(`buildCaption: entry.verse eksik veya gecersiz (id: ${entry?.id ?? 'unknown'})`);
  }
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`buildCaption: dateStr gecersiz format (beklenen YYYY-MM-DD, alindi: ${dateStr})`);
  }

  const seed = dateSeed(dateStr);
  const intro = pickIntro(entry.verse, seed);

  const rotated = seededShuffle(ROTATION_POOL, seed).slice(0, ROTATION_COUNT);
  const tags = [...CORE_TAGS, ...rotated];

  return `${intro}\n\n${tags.join(' ')}`;
}

// test edilebilirlik icin
export const _internal = { dateSeed, seededShuffle, pickIntro, CORE_TAGS, ROTATION_POOL, INTRO_VARIANTS };
