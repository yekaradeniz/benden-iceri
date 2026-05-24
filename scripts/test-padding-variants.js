/**
 * Farklı padding kombinasyonlarini test eder.
 * No wrap + width-based shrink.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const VARIANTS = [
  { name: 'A-20L-100R', left: 20, right: 100, minFont: 28 },
  { name: 'B-30L-110R', left: 30, right: 110, minFont: 30 },
  { name: 'C-40L-120R', left: 40, right: 120, minFont: 32 },
  { name: 'D-60L-140R', left: 60, right: 140, minFont: 34 }
];

const TEST_VERSES = ['sb-0027', 'sb-0258', 'sb-0770', 'sb-0050'];

function buildHtml({ verse, left, right, minFont }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Inter:wght@500&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1920px; overflow:hidden; background: #1a1a1a; }
  .content {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: 0 ${right}px 380px ${left}px;
    text-align: center;
    color: #faf6ec;
  }
  .verse {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 600;
    font-size: 51px;
    line-height: 1.38;
    color: #faf6ec;
    margin-bottom: 56px;
    white-space: pre;
    letter-spacing: 0.6px;
    text-shadow: 0 2px 14px rgba(0,0,0,0.85);
  }
  .divider { width: 108px; height: 3px; background: rgba(217,199,154,0.6); margin: 0 auto 30px; }
  .source { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 31px;
            letter-spacing: 13.5px; text-transform: uppercase; color: #d9c79a; }
  .info { position: absolute; top: 20px; left: 20px; color: #d9c79a; font-family: Inter; font-size: 24px; }
</style></head>
<body>
<div class="info" id="info">loading</div>
<div class="content">
  <div class="verse" id="verse">${verse}</div>
  <div class="divider"></div>
  <div class="source">Salih Baba</div>
</div>
<script>
  const verse = document.querySelector('#verse');
  let size = parseFloat(window.getComputedStyle(verse).fontSize);
  while (verse.scrollWidth > verse.clientWidth && size > ${minFont}) {
    size -= 1;
    verse.style.fontSize = size + 'px';
  }
  document.getElementById('info').textContent = 'final font: ' + size + 'px';
</script>
</body></html>`;
}

const content = JSON.parse(readFileSync(join(ROOT, 'content', 'salih-baba.json'), 'utf-8'));
const browser = await chromium.launch();
try {
  for (const verseId of TEST_VERSES) {
    const entry = content.find(e => e.id === verseId);
    if (!entry) continue;
    const maxLineLen = Math.max(...entry.verse.split('\n').map(l => l.length));
    console.log(`\n=== ${verseId} (max line ${maxLineLen} char) ===`);
    for (const v of VARIANTS) {
      const html = buildHtml({ verse: entry.verse, ...v });
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1080, height: 1920 });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const finalSize = await page.evaluate(() => {
        const el = document.querySelector('#verse');
        return parseFloat(window.getComputedStyle(el).fontSize);
      });
      const out = join(ROOT, 'output', `var-${verseId}-${v.name}.png`);
      const buf = await page.screenshot({ type: 'png' });
      writeFileSync(out, buf);
      console.log(`  ${v.name} (${v.left}L+${v.right}R): font ${finalSize}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
