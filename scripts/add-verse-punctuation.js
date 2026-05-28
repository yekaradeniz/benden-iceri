/**
 * Tum verselerde:
 *   1. misra sonuna virgul
 *   2. misra sonuna nokta
 *   3. misra sonuna virgul
 *   4. misra sonuna nokta
 *
 * Bos satirlar (beyit arasi) korunur. Var olan terminal noktalama varsa silinip yenisi konur.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_PATH = join(ROOT, 'content', 'salih-baba.json');

const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

function punctuateVerse(verse) {
  const lines = verse.split('\n');
  let misraIndex = 0; // 1-based for non-empty lines
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed === '') return ''; // bos satir korunur
    misraIndex++;
    // Var olan terminal noktalamayi temizle (virgul, nokta, noktali virgul, iki nokta, unlem, soru)
    const clean = trimmed.replace(/[.,;:!?]+$/, '').trimEnd();
    const punct = (misraIndex % 2 === 1) ? ',' : '.';
    return clean + punct;
  });
  return newLines.join('\n');
}

let changed = 0;
for (const entry of content) {
  const original = entry.verse;
  const punctuated = punctuateVerse(original);
  if (original !== punctuated) {
    entry.verse = punctuated;
    changed++;
  }
}

writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf-8');
console.log(`Tamamlandi: ${changed} / ${content.length} verse guncellendi.`);

// Ornek goster
console.log('\n=== Ornek (sb-0001) ===');
console.log(content.find(e => e.id === 'sb-0001').verse);
console.log('\n=== Ornek (sb-0050) ===');
console.log(content.find(e => e.id === 'sb-0050').verse);
