/**
 * Beyin Oyunlari - 3 gorsel varyant render
 * Output: output/bo-var-{A|B|C}-{soru|cevap}.png
 *
 * Salih Baba template'ini koyu lacivert + beyaz + Inter font'a adapte eder.
 * Pexels video YOK, gradient arka plan kullanir (varyant onayi icin yeterli).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'output');
mkdirSync(OUT, { recursive: true });

const SORU = 'İnsanlar neden başkalarının acısına gizlice sevinir?';
const CEVAP = 'Bu duyguya "Schadenfreude" denir. Beyin, başkalarının başarısızlığını gördüğünde kendini daha güvende hisseder; özellikle düşük özgüvenli insanlarda ödül merkezi aktive olur. Hissetmek insanidir, beslemek tehlikelidir.';

const VARIANTS = {
  A: {
    name: 'Klasik Lacivert',
    bg: 'linear-gradient(160deg, #0a1633 0%, #142850 55%, #0a1633 100%)',
    accent: '#7ab8ff',
    text: '#ffffff',
    accentSoft: 'rgba(122,184,255,0.55)',
  },
  B: {
    name: 'Midnight Deep',
    bg: 'radial-gradient(ellipse at 30% 20%, #0d1a2e 0%, #050a1a 70%)',
    accent: '#a8c4e8',
    text: '#f5f9ff',
    accentSoft: 'rgba(168,196,232,0.45)',
  },
  C: {
    name: 'Lacivert-Mor Gradient',
    bg: 'linear-gradient(155deg, #0a1633 0%, #1a1942 50%, #2d1b4e 100%)',
    accent: '#b8a4ff',
    text: '#ffffff',
    accentSoft: 'rgba(184,164,255,0.55)',
  },
};

function html({ kind, theme, text, label, brand }) {
  const isSoru = kind === 'soru';
  const fontSize = isSoru ? '78px' : '56px';
  const align = isSoru ? 'center' : 'left';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1080px; height: 1920px; overflow: hidden;
    background: ${theme.bg};
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    font-family: 'Inter', sans-serif;
  }
  body::before {
    content: '';
    position: absolute; inset: 0;
    background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.03) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(255,255,255,0.02) 0%, transparent 50%);
    pointer-events: none;
  }
  .content {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: 0 90px 380px 90px;
    text-align: ${align};
    color: ${theme.text};
  }
  .header {
    font-weight: 600;
    font-size: 26px;
    letter-spacing: 12px;
    text-transform: uppercase;
    color: ${theme.accent};
    margin-bottom: 30px;
    text-align: center;
  }
  .divider {
    width: 100px; height: 2px;
    background: ${theme.accentSoft};
    margin: 0 auto 44px;
  }
  .body-text {
    font-weight: ${isSoru ? 600 : 500};
    font-size: ${fontSize};
    line-height: 1.42;
    color: ${theme.text};
    letter-spacing: -0.3px;
    margin-bottom: 56px;
  }
  .footer-divider {
    width: 100px; height: 2px;
    background: ${theme.accentSoft};
    margin: 0 auto 28px;
  }
  .footer {
    font-weight: 700;
    font-size: 30px;
    letter-spacing: 11px;
    text-transform: uppercase;
    color: ${theme.accent};
    text-align: center;
  }
</style>
</head>
<body>
  <div class="content">
    <div class="header">${label}</div>
    <div class="divider"></div>
    <div class="body-text">${text}</div>
    <div class="footer-divider"></div>
    <div class="footer">${brand}</div>
  </div>
</body>
</html>`;
}

const BRAND = 'BEYİN OYUNLARI';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

for (const [key, theme] of Object.entries(VARIANTS)) {
  for (const kind of ['soru', 'cevap']) {
    const label = kind === 'soru' ? 'Soru' : 'Cevap';
    const text = kind === 'soru' ? SORU : CEVAP;
    const content = html({ kind, theme, text, label, brand: BRAND });
    await page.setContent(content, { waitUntil: 'networkidle' });
    const file = resolve(OUT, `bo-var-${key}-${kind}.png`);
    await page.screenshot({ path: file, fullPage: false, omitBackground: false });
    console.log(`  ✓ ${key} (${theme.name}) ${kind} → ${file}`);
  }
}

await browser.close();
console.log('\nDone. 6 varyant png hazir.');
