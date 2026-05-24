/**
 * Verse ve mana overlay PNG'lerini render edip dosyaya kaydeder.
 * Hangi font boyutunda render ettigini de raporlar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'template');

function fillTemplate(name, vars) {
  let html = readFileSync(join(TEMPLATE_DIR, name), 'utf-8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return html;
}

const id = process.argv[2] || 'sb-0027';
const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const entry = content.find(e => e.id === id);
if (!entry) { console.error(`${id} bulunamadi`); process.exit(1); }

const browser = await chromium.launch();
try {
  for (const tpl of ['reel-verse-text.html', 'reel-mana-text.html']) {
    const isVerse = tpl.includes('verse');
    const html = fillTemplate(tpl, isVerse ? {
      verse: entry.verse,
      verseFontSize: '51px'
    } : {
      explanation: entry.explanation,
      explanationFontSize: '51px'
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Final font size'i ogren
    const selector = isVerse ? '#verse' : '.explanation';
    const finalSize = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(window.getComputedStyle(el).fontSize) : null;
    }, selector);

    const outPath = join(ROOT, 'output', `test-${id}-${isVerse ? 'verse' : 'mana'}.png`);
    const buf = await page.screenshot({ type: 'png', omitBackground: false });
    writeFileSync(outPath, buf);
    console.log(`${tpl}: font ${finalSize}px → ${outPath}`);
    await page.close();
  }
} finally {
  await browser.close();
}
