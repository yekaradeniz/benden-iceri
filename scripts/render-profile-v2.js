/**
 * YouTube profil fotoğrafı v2 - daha canlı, ornamental, Ottoman/Sufi temaları
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
    await page.screenshot({ path: outputPath, type: 'png', omitBackground: false, fullPage: false });
    console.log(`Kaydedildi: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// ─── VARYANT A: Ottoman Rosette + Tugra esinli SB ────────────────────────────
const profileA = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:800px; height:800px; overflow:hidden; }
body {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 45%, #2a1810 0%, #150b07 55%, #0a0604 100%);
}

/* Sicak isik halesi merkezde */
.glow {
  position: absolute;
  width: 500px; height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232,184,108,0.18) 0%, rgba(232,184,108,0.05) 40%, transparent 70%);
  filter: blur(20px);
}

/* 16 noktali yildiz (Ottoman rosette) */
.rosette {
  position: absolute;
  width: 620px; height: 620px;
}

/* Ic 8 noktali yildiz (parlak altin) */
.star-inner {
  position: absolute;
  width: 380px; height: 380px;
  top: 210px; left: 210px;
}

/* Disko cember */
.ring-outer {
  position: absolute;
  width: 720px; height: 720px;
  border-radius: 50%;
  border: 2px solid rgba(232,184,108,0.4);
}
.ring-outer-2 {
  position: absolute;
  width: 700px; height: 700px;
  border-radius: 50%;
  border: 1px solid rgba(232,184,108,0.2);
}
.ring-inner {
  position: absolute;
  width: 320px; height: 320px;
  border-radius: 50%;
  border: 1.5px solid rgba(232,184,108,0.55);
}

/* Merkez monogram */
.center {
  position: relative;
  z-index: 20;
  text-align: center;
  display: flex; flex-direction: column; align-items: center;
}

.monogram {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 700;
  font-size: 160px;
  line-height: 1;
  background: linear-gradient(180deg, #f8e6b8 0%, #e8b86c 50%, #c89854 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: -6px;
  filter: drop-shadow(0 4px 24px rgba(232,184,108,0.4));
  margin-bottom: 12px;
}

.label {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  font-size: 15px;
  letter-spacing: 7px;
  text-transform: uppercase;
  color: #e8b86c;
  opacity: 0.9;
}

.label-line {
  width: 60px; height: 1px;
  background: linear-gradient(90deg, transparent, #e8b86c, transparent);
  margin: 8px 0 0;
}

/* Dort kose decorative cicekler */
.flower {
  position: absolute;
  width: 24px; height: 24px;
  z-index: 15;
}
.flower svg { width: 100%; height: 100%; }
</style></head>
<body>
  <div class="glow"></div>

  <!-- 16 nokta rosette (SVG) -->
  <svg class="rosette" viewBox="0 0 620 620">
    <defs>
      <radialGradient id="goldRose" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f0d28a" stop-opacity="0"/>
        <stop offset="60%" stop-color="#e8b86c" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#c89854" stop-opacity="0.75"/>
      </radialGradient>
    </defs>
    <g transform="translate(310,310)">
      <!-- 16 yaprakli rosette -->
      ${Array.from({length: 16}, (_, i) => {
        const angle = (i * 360 / 16);
        return `<path d="M 0,-280 Q 30,-150 0,-30 Q -30,-150 0,-280 Z"
                 fill="url(#goldRose)" stroke="#e8b86c" stroke-width="0.8" opacity="0.55"
                 transform="rotate(${angle})"/>`;
      }).join('')}
    </g>
  </svg>

  <!-- 8 nokta ic yildiz -->
  <svg class="star-inner" viewBox="0 0 380 380">
    <defs>
      <linearGradient id="starGold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f0d28a"/>
        <stop offset="100%" stop-color="#c89854"/>
      </linearGradient>
    </defs>
    <g transform="translate(190,190)">
      <polygon points="0,-170 49,-49 170,0 49,49 0,170 -49,49 -170,0 -49,-49"
               fill="url(#starGold)" opacity="0.18"
               stroke="#e8b86c" stroke-width="1.2" stroke-opacity="0.7"/>
      <polygon points="0,-170 49,-49 170,0 49,49 0,170 -49,49 -170,0 -49,-49"
               fill="none" stroke="#e8b86c" stroke-width="0.6" stroke-opacity="0.5"
               transform="rotate(45)"/>
    </g>
  </svg>

  <div class="ring-outer"></div>
  <div class="ring-outer-2"></div>
  <div class="ring-inner"></div>

  <div class="center">
    <div class="monogram">SB</div>
    <div class="label-line"></div>
  </div>
</body></html>`;

// ─── VARYANT B: Mihrab kemer + Arabesk ──────────────────────────────────────
const profileB = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:800px; height:800px; overflow:hidden; }
body {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, #3a1f12 0%, #1f1108 50%, #0c0604 100%);
}

.glow {
  position: absolute;
  width: 600px; height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232,184,108,0.22) 0%, transparent 60%);
  filter: blur(30px);
}

.mihrab-wrap {
  position: absolute;
  width: 700px; height: 700px;
  display: flex; align-items: center; justify-content: center;
}

.center {
  position: relative;
  z-index: 20;
  text-align: center;
  display: flex; flex-direction: column; align-items: center;
}

.crescent {
  width: 80px; height: 80px;
  margin-bottom: 8px;
  opacity: 0.85;
}

.monogram {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 700;
  font-size: 175px;
  line-height: 0.95;
  background: linear-gradient(180deg, #faecc4 0%, #e8b86c 55%, #b68545 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: -8px;
  filter: drop-shadow(0 6px 32px rgba(232,184,108,0.5));
}

.subtitle {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 500;
  font-size: 26px;
  color: #e8b86c;
  opacity: 0.85;
  letter-spacing: 4px;
  margin-top: 16px;
}
</style></head>
<body>
  <div class="glow"></div>

  <svg class="mihrab-wrap" viewBox="0 0 700 700">
    <defs>
      <linearGradient id="archGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#e8b86c" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#8a6536" stop-opacity="0.3"/>
      </linearGradient>
      <pattern id="dots" patternUnits="userSpaceOnUse" width="14" height="14">
        <circle cx="2" cy="2" r="0.9" fill="#e8b86c" opacity="0.35"/>
      </pattern>
    </defs>

    <!-- Dis cember -->
    <circle cx="350" cy="350" r="335" fill="none" stroke="#e8b86c" stroke-width="1.5" opacity="0.4"/>
    <circle cx="350" cy="350" r="325" fill="none" stroke="#e8b86c" stroke-width="0.6" opacity="0.25"/>

    <!-- Mihrab kemer formu -->
    <path d="M 200 480 L 200 280 Q 200 150 350 150 Q 500 150 500 280 L 500 480 Z"
          fill="none" stroke="url(#archGrad)" stroke-width="2.5" opacity="0.9"/>
    <path d="M 215 470 L 215 285 Q 215 165 350 165 Q 485 165 485 285 L 485 470 Z"
          fill="none" stroke="#e8b86c" stroke-width="0.8" opacity="0.5"/>

    <!-- 8 noktali yildiz - ust tepede -->
    <g transform="translate(350,350)" opacity="0.15">
      <polygon points="0,-150 43,-43 150,0 43,43 0,150 -43,43 -150,0 -43,-43"
               fill="#e8b86c"/>
      <polygon points="0,-150 43,-43 150,0 43,43 0,150 -43,43 -150,0 -43,-43"
               fill="none" stroke="#f0d28a" stroke-width="0.8"
               transform="rotate(45)"/>
    </g>

    <!-- Dekoratif noktali ic alan -->
    <circle cx="350" cy="350" r="180" fill="url(#dots)" opacity="0.5"/>

    <!-- Dort yon dekoratif diamond -->
    <g fill="#e8b86c" opacity="0.7">
      <rect x="347" y="32" width="6" height="6" transform="rotate(45 350 35)"/>
      <rect x="347" y="662" width="6" height="6" transform="rotate(45 350 665)"/>
      <rect x="32" y="347" width="6" height="6" transform="rotate(45 35 350)"/>
      <rect x="662" y="347" width="6" height="6" transform="rotate(45 665 350)"/>
    </g>
  </svg>

  <div class="center">
    <div class="monogram">SB</div>
  </div>
</body></html>`;

// ─── VARYANT C: Sade ama altin renkli (sicak) ──────────────────────────────
const profileC = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:800px; height:800px; overflow:hidden; }
body {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 30% 30%, rgba(232,184,108,0.12) 0%, transparent 50%),
    radial-gradient(circle at 70% 70%, rgba(180,90,50,0.10) 0%, transparent 50%),
    linear-gradient(135deg, #1f1108 0%, #0c0604 100%);
}

.glow-1 {
  position: absolute;
  width: 600px; height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232,184,108,0.20) 0%, transparent 65%);
  filter: blur(40px);
}

.ornament-svg { position: absolute; width: 760px; height: 760px; }

.center {
  position: relative; z-index: 30;
  text-align: center;
  display: flex; flex-direction: column; align-items: center;
}

.monogram {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 700;
  font-size: 200px;
  line-height: 0.9;
  background: linear-gradient(180deg, #faecc4 0%, #f0c878 35%, #e8b86c 65%, #b68545 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: -10px;
  filter: drop-shadow(0 8px 40px rgba(232,184,108,0.55));
}

.flourish {
  width: 240px; height: 30px;
  margin-top: 20px;
  opacity: 0.85;
}

.label {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  font-size: 18px;
  letter-spacing: 14px;
  text-transform: uppercase;
  color: #e8b86c;
  opacity: 0.9;
  margin-top: 16px;
}
</style></head>
<body>
  <div class="glow-1"></div>

  <svg class="ornament-svg" viewBox="0 0 760 760">
    <defs>
      <radialGradient id="goldRad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#e8b86c" stop-opacity="0"/>
        <stop offset="80%" stop-color="#e8b86c" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#e8b86c" stop-opacity="0.7"/>
      </radialGradient>
    </defs>

    <!-- 12 yaprakli rosette dis -->
    <g transform="translate(380,380)">
      ${Array.from({length: 12}, (_, i) => {
        const angle = (i * 360 / 12);
        return `<ellipse cx="0" cy="-310" rx="22" ry="55"
                 fill="url(#goldRad)" opacity="0.45"
                 stroke="#e8b86c" stroke-width="0.6" stroke-opacity="0.5"
                 transform="rotate(${angle})"/>`;
      }).join('')}
    </g>

    <!-- Dis cember -->
    <circle cx="380" cy="380" r="360" fill="none" stroke="#e8b86c" stroke-width="2" opacity="0.55"/>
    <circle cx="380" cy="380" r="350" fill="none" stroke="#e8b86c" stroke-width="0.5" opacity="0.3"/>

    <!-- Ic cember -->
    <circle cx="380" cy="380" r="240" fill="none" stroke="#e8b86c" stroke-width="1.2" opacity="0.45"/>
    <circle cx="380" cy="380" r="230" fill="none" stroke="#e8b86c" stroke-width="0.5" opacity="0.25"/>

    <!-- 8 nokta yildiz iz dusumu -->
    <g transform="translate(380,380)" opacity="0.12">
      <polygon points="0,-200 58,-58 200,0 58,58 0,200 -58,58 -200,0 -58,-58"
               fill="#e8b86c"/>
      <polygon points="0,-200 58,-58 200,0 58,58 0,200 -58,58 -200,0 -58,-58"
               fill="none" stroke="#f0d28a" stroke-width="0.8" opacity="0.7"
               transform="rotate(45)"/>
    </g>

    <!-- 4 kose elmas -->
    <g fill="#e8b86c" opacity="0.85">
      <rect x="377" y="14" width="6" height="6" transform="rotate(45 380 17)"/>
      <rect x="377" y="740" width="6" height="6" transform="rotate(45 380 743)"/>
      <rect x="14" y="377" width="6" height="6" transform="rotate(45 17 380)"/>
      <rect x="740" y="377" width="6" height="6" transform="rotate(45 743 380)"/>
    </g>
  </svg>

  <div class="center">
    <div class="monogram">SB</div>
    <svg class="flourish" viewBox="0 0 240 30">
      <path d="M 10 15 L 95 15 M 145 15 L 230 15"
            stroke="#e8b86c" stroke-width="1" opacity="0.75" fill="none"/>
      <circle cx="120" cy="15" r="3" fill="#e8b86c" opacity="0.9"/>
      <circle cx="105" cy="15" r="1.2" fill="#e8b86c" opacity="0.6"/>
      <circle cx="135" cy="15" r="1.2" fill="#e8b86c" opacity="0.6"/>
    </svg>
    <div class="label">Divanı</div>
  </div>
</body></html>`;

await renderHtmlToPng(profileA, join(ROOT, 'output', 'yt-profile-A.png'), 800, 800);
await renderHtmlToPng(profileB, join(ROOT, 'output', 'yt-profile-B.png'), 800, 800);
await renderHtmlToPng(profileC, join(ROOT, 'output', 'yt-profile-C.png'), 800, 800);

console.log('\n3 varyant hazır:');
console.log('  A: Ottoman rosette + 8 nokta yildiz');
console.log('  B: Mihrab kemer formu');
console.log('  C: 12 yaprakli rosette + flourish');
