/**
 * Verilen {id: mana} mapping'i ile content/salih-baba.json'a mânâları yazar.
 * Kullanim: node scripts/apply-mana.js mana-batch.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_PATH = join(ROOT, 'content', 'salih-baba.json');

const batchPath = process.argv[2];
if (!batchPath) { console.error('Kullanim: node scripts/apply-mana.js <batch.json>'); process.exit(1); }

const batch = JSON.parse(readFileSync(batchPath, 'utf-8'));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

let updated = 0;
let skipped = 0;
for (const [id, mana] of Object.entries(batch)) {
  const idx = content.findIndex(e => e.id === id);
  if (idx === -1) { console.warn(`✗ ${id} bulunamadi`); skipped++; continue; }
  if (!mana || mana.trim().length < 30) { console.warn(`✗ ${id} mana cok kisa`); skipped++; continue; }
  content[idx].explanation = mana;
  updated++;
  console.log(`✓ ${id} (${mana.length} char)`);
}

writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf-8');
console.log(`\nTamamlandi: ${updated} guncellendi, ${skipped} atlandı`);
