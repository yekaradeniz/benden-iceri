/**
 * YouTube profil fotoğrafı - klasik Osmanlı madalyon stili
 * Lacivert oval merkez + altın hat + krema parşömen arka plan + gül desenli kenar
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function renderHtmlToPng(html, outputPath, width, height) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: outputPath, type: 'png', omitBackground: false, fullPage: false });
    console.log(`Kaydedildi: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// Renkler
const NAVY = '#1f3a6e';
const NAVY_DEEP = '#152a52';
const GOLD = '#c79c4a';
const GOLD_LIGHT = '#e8c97a';
const GOLD_DEEP = '#9a7530';
const CREAM = '#f3e6c8';
const CREAM_DARK = '#e0cfa4';

const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Amiri:wght@400;700&family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:800px; height:800px; overflow:hidden; }
body {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 30% 30%, ${CREAM} 0%, ${CREAM_DARK} 100%);
}

.frame { position: absolute; inset: 0; }
.center {
  position: relative;
  z-index: 10;
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
  width: 100%;
}

/* Lacivert oval icindeki Arapca hat */
.arabic-top {
  font-family: 'Aref Ruqaa', serif;
  font-weight: 700;
  font-size: 56px;
  color: ${GOLD_LIGHT};
  line-height: 1;
  margin-bottom: 6px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

.arabic-main {
  font-family: 'Aref Ruqaa', serif;
  font-weight: 700;
  font-size: 76px;
  color: ${GOLD_LIGHT};
  line-height: 1.1;
  letter-spacing: 2px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  direction: rtl;
  unicode-bidi: bidi-override;
}

/* Alt latin yazi - Cinzel = roman serif, klasik gorunum */
.latin-name {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 52px;
  letter-spacing: 14px;
  color: ${GOLD_DEEP};
  text-shadow:
    1px 1px 0 ${GOLD_LIGHT},
    -1px 1px 0 ${GOLD_LIGHT},
    0 2px 4px rgba(0,0,0,0.25);
  margin-top: 18px;
  white-space: nowrap;
}

.bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
</style></head>
<body>

<svg class="bg-svg" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Lacivert oval gradient -->
    <radialGradient id="navyGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${NAVY}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${NAVY_DEEP}" stop-opacity="1"/>
    </radialGradient>

    <!-- Altin gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="50%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="${GOLD_DEEP}"/>
    </linearGradient>

    <!-- Parsomen texture -->
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
      <feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.5  0 0 0 0 0.3  0 0 0 0.08 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>

    <!-- Tek gul motif -->
    <g id="rose">
      <circle cx="0" cy="0" r="10" fill="${GOLD}" opacity="0.85"/>
      <circle cx="0" cy="0" r="6" fill="${GOLD_DEEP}" opacity="0.95"/>
      <circle cx="0" cy="0" r="3" fill="${GOLD_LIGHT}"/>
      <!-- 5 yaprak -->
      <g fill="${GOLD}" opacity="0.7">
        <ellipse cx="0" cy="-12" rx="4" ry="6"/>
        <ellipse cx="11" cy="-4" rx="4" ry="6" transform="rotate(72 11 -4)"/>
        <ellipse cx="7" cy="10" rx="4" ry="6" transform="rotate(144 7 10)"/>
        <ellipse cx="-7" cy="10" rx="4" ry="6" transform="rotate(216 -7 10)"/>
        <ellipse cx="-11" cy="-4" rx="4" ry="6" transform="rotate(288 -11 -4)"/>
      </g>
    </g>

    <!-- Yaprak/kivrim motif (guller arasi) -->
    <g id="vine">
      <path d="M -16 0 Q -8 -8, 0 0 Q 8 8, 16 0"
            fill="none" stroke="${GOLD}" stroke-width="1.5" opacity="0.7"/>
      <circle cx="0" cy="0" r="1.5" fill="${GOLD_LIGHT}"/>
    </g>
  </defs>

  <!-- Parsomen arka plan -->
  <rect width="800" height="800" fill="${CREAM}"/>
  <rect width="800" height="800" fill="${CREAM}" filter="url(#grain)"/>

  <!-- Dis incili cember (pearls) -->
  ${(() => {
    const beads = [];
    const r = 388;
    for (let i = 0; i < 90; i++) {
      const angle = (i / 90) * 2 * Math.PI;
      const x = 400 + r * Math.cos(angle);
      const y = 400 + r * Math.sin(angle);
      beads.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${GOLD}" opacity="0.85"/>`);
      beads.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${GOLD_LIGHT}"/>`);
    }
    return beads.join('');
  })()}

  <!-- Dis lacivert band -->
  <circle cx="400" cy="400" r="378" fill="${NAVY}" stroke="${GOLD}" stroke-width="2"/>
  <circle cx="400" cy="400" r="378" fill="url(#navyGrad)" opacity="0.4"/>

  <!-- Lacivert band uzerinde guller ve sarmasik (16 gul cember etrafinda) -->
  ${(() => {
    const items = [];
    const r = 362;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const x = 400 + r * Math.cos(angle);
      const y = 400 + r * Math.sin(angle);
      const rotDeg = (i / count) * 360;
      items.push(`<use href="#rose" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotDeg})"/>`);
    }
    // Aralara vine
    for (let i = 0; i < count; i++) {
      const angle = ((i + 0.5) / count) * 2 * Math.PI - Math.PI / 2;
      const x = 400 + r * Math.cos(angle);
      const y = 400 + r * Math.sin(angle);
      const rotDeg = ((i + 0.5) / count) * 360 + 90;
      items.push(`<use href="#vine" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotDeg})"/>`);
    }
    return items.join('');
  })()}

  <!-- Ic altin cember (krema icine gecis) -->
  <circle cx="400" cy="400" r="338" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <circle cx="400" cy="400" r="332" fill="none" stroke="${GOLD_DEEP}" stroke-width="0.8" opacity="0.7"/>

  <!-- Krema ic alan -->
  <circle cx="400" cy="400" r="328" fill="${CREAM}"/>
  <circle cx="400" cy="400" r="328" fill="${CREAM}" filter="url(#grain)" opacity="0.6"/>

  <!-- Lacivert oval merkez -->
  <ellipse cx="400" cy="380" rx="195" ry="225" fill="url(#navyGrad)" stroke="${GOLD}" stroke-width="2.5"/>
  <ellipse cx="400" cy="380" rx="188" ry="218" fill="none" stroke="${GOLD_DEEP}" stroke-width="0.6" opacity="0.7"/>

  <!-- Ust kose, sol, sag madalyonlar -->
  ${[
    [400, 70, 'top'],
    [124, 400, 'left'],
    [676, 400, 'right']
  ].map(([cx, cy]) => `
    <g>
      <circle cx="${cx}" cy="${cy}" r="22" fill="${CREAM}" stroke="${GOLD_DEEP}" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="17" fill="${NAVY}" opacity="0.85"/>
      <text x="${cx}" y="${cy + 5}" font-family="Aref Ruqaa, serif" font-size="18" font-weight="700"
            fill="${GOLD_LIGHT}" text-anchor="middle">ﷲ</text>
    </g>
  `).join('')}
</svg>

<!-- Merkez metin overlay (oval icinde + altinda) -->
<div class="center" style="position:absolute; top:200px; left:0; right:0;">
  <div class="arabic-top">هُوَ</div>
  <div class="arabic-main">صالح بابا</div>
</div>

<div class="center" style="position:absolute; top:558px; left:0; right:0;">
  <div class="latin-name">SALİH BABA</div>
</div>

</body></html>`;

await renderHtmlToPng(html, join(ROOT, 'output', 'yt-profile-classical.png'), 800, 800);
console.log('\nHazir: output/yt-profile-classical.png');
