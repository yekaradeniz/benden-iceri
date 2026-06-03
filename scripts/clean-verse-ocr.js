/**
 * OCR kaynakli rakam/karakter hatalarini temizler (TTS dogru okusun):
 *  - Satir sonu dipnot numaralari: "...dilber 1." -> "...dilber."
 *  - Standalone "0" (sifir) -> "O" (harf): "0 kim" -> "O kim"
 *  - "1" eki: "ıyd-1"->"ıyd-ı", "zayi1"->"zayi'", "şirâ1"->"şirâ'"
 *  - sb-0252: "Sâmî*de"->"Sâmî'de", "Sâmîgibi"->"Sâmî gibi"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(__dirname, '..', 'content', 'salih-baba.json');

// Spesifik string duzeltmeleri (once bunlar)
const SPECIFIC = [
  ['ıyd-1', 'ıyd-ı'],
  ['zayi1', "zayi'"],
  ['şirâ1', "şirâ'"],
  ['Sâmî*de', "Sâmî'de"],
  ['Sâmîgibi', 'Sâmî gibi']
];

function cleanLine(line) {
  let s = line;
  for (const [from, to] of SPECIFIC) s = s.split(from).join(to);
  // Satir sonu dipnot numarasi: " 12." veya " 3," -> noktalama korunur
  s = s.replace(/\s+\d+(\s*[.,;:!?"]*)$/, '$1');
  // Standalone 0 (sifir) -> O (harf): satir basi veya bosluktan sonra, sonrasi bosluk/son
  s = s.replace(/(^|\s)0(?=\s|$)/g, '$1O');
  return s;
}

const content = JSON.parse(readFileSync(CONTENT, 'utf-8'));
let changed = 0;
const examples = [];

for (const e of content) {
  const before = e.verse;
  const after = before.split('\n').map(cleanLine).join('\n');
  if (before !== after) {
    if (examples.length < 12) examples.push({ id: e.id, before, after });
    e.verse = after;
    changed++;
  }
}

writeFileSync(CONTENT, JSON.stringify(content, null, 2), 'utf-8');
console.log(`Temizlendi: ${changed} beyit\n`);
for (const ex of examples) {
  console.log(`[${ex.id}]`);
  ex.before.split('\n').forEach((l, i) => {
    const a = ex.after.split('\n')[i];
    if (l !== a) console.log(`  ONCE : ${l}\n  SONRA: ${a}`);
  });
}

// Kontrol
const c2 = JSON.parse(readFileSync(CONTENT, 'utf-8'));
const digits = c2.filter(e => /\d/.test(e.verse));
const stars = c2.filter(e => /[*\[\]{}]/.test(e.verse));
console.log(`\nKalan rakamli beyit: ${digits.length}`);
digits.forEach(e => e.verse.split('\n').forEach(l => { if (/\d/.test(l)) console.log('  '+e.id+': '+l.trim()); }));
console.log(`Kalan yildiz/koseli: ${stars.length}`);
