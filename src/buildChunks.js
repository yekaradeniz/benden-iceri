import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Paylasim birimlerini (chunk) uretir: siir sinirlarini KESMEDEN 8'erli satir gruplari.
 *
 * Kurallar (kullanici karari):
 *  - Varsayilan chunk = ayni siirden 8 satir (4+4)
 *  - Siir sonunda kalan 4-7 satir ise: kalan tek chunk olarak paylasilir
 *  - Kalan 4'ten AZ ise (1-3 satir): o satirlar ATLANIR (paylasilmaz)
 *  - 45-karakter uzunluk filtresi YOK (iptal edildi)
 *
 * Chunk yapisi:
 *  { id: 'ch-0001', poemNo, poemTitle, text, firstLine, moods, lineRefs: [{id, li}] }
 *  text: satirlar 2'serli (beyit) gruplanir, beyitler arasi bos satir.
 *
 * Deterministiktir: ayni content + poem-map her zaman ayni chunk listesini verir.
 */
export function buildChunks() {
  const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
  const poemMap = JSON.parse(readFileSync(join(ROOT, 'content', 'poem-map.json'), 'utf-8')).poems;
  const byId = Object.fromEntries(content.map(e => [e.id, e]));

  const chunks = [];
  let skippedLines = 0;
  let seq = 0;

  for (const poem of poemMap) {
    // Siirin tum satirlarini (metin + kaynak referansi) topla
    const lines = [];
    for (const ent of poem.entries) {
      const vlines = byId[ent.id].verse.split('\n').map(l => l.trim()).filter(Boolean);
      for (const li of ent.lines) {
        lines.push({ id: ent.id, li, text: vlines[li] });
      }
    }

    // 8'erli grupla; son kalan <4 ise atla
    for (let i = 0; i < lines.length; i += 8) {
      const grp = lines.slice(i, i + 8);
      if (grp.length < 4) { skippedLines += grp.length; continue; }
      seq++;
      // Beyit yapisi: 2 satirda bir bos satir
      const parts = [];
      for (let j = 0; j < grp.length; j += 2) {
        parts.push(grp.slice(j, j + 2).map(g => g.text).join('\n'));
      }
      const text = parts.join('\n\n');
      const firstEntry = byId[grp[0].id];
      chunks.push({
        id: `ch-${String(seq).padStart(4, '0')}`,
        poemNo: poem.poemNo,
        poemTitle: poem.title,
        text,
        firstLine: grp[0].text,
        lineCount: grp.length,
        moods: firstEntry.moods ?? ['ic-dunya', 'tefekkür'],
        lineRefs: grp.map(g => ({ id: g.id, li: g.li }))
      });
    }
  }

  return { chunks, skippedLines };
}
