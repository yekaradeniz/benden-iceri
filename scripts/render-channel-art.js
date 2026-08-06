/**
 * YouTube kanal sanatını render eder:
 *  - output/yt-profile.png  (800x800 - profil fotoğrafı)
 *  - output/yt-banner.png   (2560x1440 - kanal kapak görseli)
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
      deviceScaleFactor: 2   // retina kalitesi
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

// ─── PROFIL FOTOGRAFI (800x800) ───────────────────────────────────────────────
const profileHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:800px; height:800px; overflow:hidden; }
body {
  background: #111010;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Dis cember */
.outer-ring {
  position: absolute;
  width: 680px; height: 680px;
  border-radius: 50%;
  border: 1.5px solid rgba(217,199,154,0.25);
}

/* Geometrik sekiz kollu yildiz */
.star-wrap {
  position: absolute;
  width: 520px; height: 520px;
  display: flex; align-items: center; justify-content: center;
}
.star {
  width: 260px; height: 260px;
  position: relative;
  opacity: 0.13;
}
.star::before, .star::after {
  content: '';
  position: absolute; inset: 0;
  background: #d9c79a;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}
.star::after { transform: rotate(36deg); }

/* ince ic cember */
.inner-ring {
  position: absolute;
  width: 480px; height: 480px;
  border-radius: 50%;
  border: 1px solid rgba(217,199,154,0.35);
}

/* ince ic-ic cember */
.inner-ring2 {
  position: absolute;
  width: 420px; height: 420px;
  border-radius: 50%;
  border: 1px solid rgba(217,199,154,0.18);
}

/* Merkez icerik */
.center {
  position: relative;
  z-index: 10;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.ornament-top {
  font-size: 26px;
  color: #d9c79a;
  opacity: 0.7;
  letter-spacing: 8px;
  margin-bottom: 22px;
}

.monogram {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 600;
  font-size: 148px;
  line-height: 1;
  color: #f5efe1;
  letter-spacing: -4px;
  text-shadow: 0 4px 40px rgba(217,199,154,0.25);
}

.divider {
  width: 80px; height: 1.5px;
  background: linear-gradient(90deg, transparent, #d9c79a, transparent);
  margin: 18px 0;
}

.label {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 6px;
  text-transform: uppercase;
  color: #d9c79a;
  opacity: 0.85;
}

/* koseli suset noktalar */
.dots {
  position: absolute;
  width: 580px; height: 580px;
  border-radius: 50%;
}
.dot {
  position: absolute;
  width: 3px; height: 3px;
  background: #d9c79a;
  border-radius: 50%;
  opacity: 0.45;
}
</style>
</head>
<body>
  <div class="outer-ring"></div>
  <div class="inner-ring"></div>
  <div class="inner-ring2"></div>

  <!-- 8 nokta cember etrafinda -->
  <div class="dots" id="dots"></div>

  <div class="center">
    <div class="ornament-top">✦ ✦ ✦</div>
    <div class="monogram">SB</div>
    <div class="divider"></div>
    <div class="label">Divanı</div>
  </div>

  <script>
    // 8 noktayi dairesel diziliyor
    const dots = document.getElementById('dots');
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
      const r = 285;
      const x = 290 + r * Math.cos(angle) - 1.5;
      const y = 290 + r * Math.sin(angle) - 1.5;
      const d = document.createElement('div');
      d.className = 'dot';
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      dots.appendChild(d);
    }
  </script>
</body>
</html>`;

// ─── BANNER (2560x1440) ───────────────────────────────────────────────────────
// YouTube'un "safe zone" (tum cihazlarda gorunen alan): 1546x423 merkez
const bannerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:2560px; height:1440px; overflow:hidden; }
body {
  background: #0e0d0d;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Arka plan geometrik desen - ince grid */
.bg-pattern {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(217,199,154,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(217,199,154,0.04) 1px, transparent 1px);
  background-size: 80px 80px;
}

/* Sol ve sag fade */
.fade-left {
  position: absolute; left:0; top:0; bottom:0; width:600px;
  background: linear-gradient(90deg, #0e0d0d 0%, transparent 100%);
  z-index:2;
}
.fade-right {
  position: absolute; right:0; top:0; bottom:0; width:600px;
  background: linear-gradient(270deg, #0e0d0d 0%, transparent 100%);
  z-index:2;
}
.fade-top {
  position: absolute; top:0; left:0; right:0; height:300px;
  background: linear-gradient(180deg, #0e0d0d 0%, transparent 100%);
  z-index:2;
}
.fade-bottom {
  position: absolute; bottom:0; left:0; right:0; height:300px;
  background: linear-gradient(0deg, #0e0d0d 0%, transparent 100%);
  z-index:2;
}

/* Safe zone cerceve - rehber (gizli) */
/* 1546x423 merkez = x: 507, y: 508 */

/* Merkez icerik - safe zone icinde tasarlandı */
.center {
  position: relative;
  z-index: 10;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 1400px;
}

.ornament {
  font-size: 28px;
  color: #d9c79a;
  opacity: 0.6;
  letter-spacing: 18px;
  margin-bottom: 36px;
}

.title {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 600;
  font-size: 148px;
  line-height: 1.05;
  color: #f5efe1;
  letter-spacing: 3px;
  text-shadow: 0 4px 60px rgba(0,0,0,0.8), 0 0 120px rgba(217,199,154,0.1);
}

.divider-wrap {
  display: flex;
  align-items: center;
  gap: 28px;
  margin: 32px 0 28px;
  width: 700px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(217,199,154,0.7), transparent);
}
.divider-diamond {
  width: 7px; height: 7px;
  background: #d9c79a;
  transform: rotate(45deg);
  opacity: 0.8;
}

.subtitle {
  font-family: 'Inter', sans-serif;
  font-weight: 300;
  font-size: 34px;
  letter-spacing: 12px;
  text-transform: uppercase;
  color: #d9c79a;
  opacity: 0.75;
}

/* sol ve sag dekoratif monogram */
.side-mono {
  position: absolute;
  z-index: 5;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 600;
  font-size: 320px;
  color: rgba(217,199,154,0.04);
  line-height: 1;
  top: 50%;
  transform: translateY(-50%);
  user-select: none;
}
.side-left  { left: 60px; }
.side-right { right: 60px; }
</style>
</head>
<body>
  <div class="bg-pattern"></div>
  <div class="fade-left"></div>
  <div class="fade-right"></div>
  <div class="fade-top"></div>
  <div class="fade-bottom"></div>

  <div class="side-mono side-left">S</div>
  <div class="side-mono side-right">B</div>

  <div class="center">
    <div class="ornament">✦ &nbsp; ✦ &nbsp; ✦</div>
    <div class="title">Salih Baba Divanı</div>
    <div class="divider-wrap">
      <div class="divider-line"></div>
      <div class="divider-diamond"></div>
      <div class="divider-line"></div>
    </div>
    <div class="subtitle">Her gün bir beyit &nbsp;·&nbsp; Tasavvuf Şiirleri</div>
  </div>
</body>
</html>`;

// Render et
await renderHtmlToPng(profileHtml, join(ROOT, 'output', 'yt-profile.png'), 800, 800);
await renderHtmlToPng(bannerHtml,  join(ROOT, 'output', 'yt-banner.png'),  2560, 1440);

console.log('\nTamamlandi:');
console.log('  Profil : output/yt-profile.png');
console.log('  Banner : output/yt-banner.png');
