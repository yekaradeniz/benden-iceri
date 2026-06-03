/**
 * Beyitlerdeki TTS'i bozan artiklari temizler:
 *  1. Numarali dipnotlar (1)-(88): tamamen silinir (onundeki bosluk dahil)
 *  2. Tire ekli parantez "zuhur (-ı)": bitisik yapilir -> "zuhur-ı"
 *  3. Harf/kelime parantezleri (ü),(ol),(oldu),(o),(bî),arz(ı): parantez kalkar, icerik kalir
 *  4. Cift bosluklar tek yapilir, satir sonu bosluklari temizlenir
 *
 * Noktalama (1.misra virgul / 2.nokta / 3.virgul / 4.nokta) korunur.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(__dirname, '..', 'content', 'salih-baba.json');

function cleanVerse(verse) {
  return verse
    .replace(/\s*\(\d+\)/g, '')          // 1) numarali dipnot sil
    .replace(/\s*\((-[^)]+)\)/g, '$1')   // 2) "(-ı)" -> "-ı" (bitisik)
    .replace(/\(([^)]+)\)/g, '$1')       // 3) kalan harf parantezlerini ac
    .replace(/[ \t]{2,}/g, ' ')          // 4) cift bosluk -> tek
    .split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n');
}

const content = JSON.parse(readFileSync(CONTENT, 'utf-8'));
let changed = 0;
const examples = [];

for (const e of content) {
  const before = e.verse;
  const after = cleanVerse(before);
  if (before !== after) {
    if (examples.length < 8) examples.push({ id: e.id, before, after });
    e.verse = after;
    changed++;
  }
}

writeFileSync(CONTENT, JSON.stringify(content, null, 2), 'utf-8');

console.log(`Temizlendi: ${changed} beyit\n`);
console.log('=== ORNEKLER (before -> after) ===');
for (const ex of examples) {
  console.log(`\n[${ex.id}]`);
  console.log('ONCE:', JSON.stringify(ex.before.split('\n')));
  console.log('SONRA:', JSON.stringify(ex.after.split('\n')));
}

// Kontrol: hala parantez kaldi mi?
const remaining = content.filter(e => /\(/.test(e.verse));
console.log(`\nKalan parantezli beyit: ${remaining.length}`);
if (remaining.length) remaining.slice(0,5).forEach(e => console.log('  ' + e.id + ': ' + e.verse.replace(/\n/g,' / ')));
