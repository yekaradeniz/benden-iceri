/**
 * Salih Baba beyitleri için eksik mânâ (açıklama) alanlarını Gemini ile doldurur.
 * Mevcut 25 mânâ örneğini few-shot olarak kullanır.
 *
 * Kullanim:
 *   node scripts/generate-mana.js                    # tum eksik manalari uretir
 *   node scripts/generate-mana.js sb-0027 sb-0028    # sadece belirli ID'ler
 *   node scripts/generate-mana.js --limit 5          # ilk 5 eksik
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_PATH = join(ROOT, 'content', 'salih-baba.json');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error('GEMINI_API_KEY env var gerekli'); process.exit(1); }

const SYSTEM_PROMPT = `Sen Salih Baba Dîvânı'nı (Naqşibendî tasavvuf şairi, 19. yy) yorumlayan bir tasavvuf âlimisin. Her beyit için Türkçe, samimi, derin ama anlaşılır bir mânâ (açıklama) yazıyorsun.

ÖZELLİKLER:
- 2 paragraf, paragraflar arası \\n\\n
- Toplam 80-130 kelime
- Tasavvuf kavramlarını (mürşid, fenâ, vahdet, himmet, feyz, kalb, gönül, vuslat, mâsiva vb.) anlatırken sadece terim kullanmak yerine ANLAMINI ver
- Şâirin SÖYLEDIĞINI değil, KASTETTIĞINI yorumla
- "Salih Baba burada..." veya "Şâir der ki..." gibi başlangıçlar kullanabilirsin
- Eski Türkçe/Osmanlıca kelimeleri açıklamadan kullanma - örneğin "himmet" diyorsan "manevi destek/yardım" anlamını da işaret et
- Didaktik değil, tefekküre davet eden bir ton
- ASLA dini emir/yasak çıkarma, sadece beytin manevi katmanını aç`;

const FEW_SHOT_EXAMPLES = `
ÖRNEK 1:
Beyit:
"Bed' olunsun besmeleyle hamdeleyle evsatı
Salavatullah hatm olunsun bula cânlar izzeti

Çok salât ile selâm olsun Resûlü Ahmed'e
Bu kadar isyân ile bizlere demiş ümmetî"

Mânâ:
Salih Baba şiirine 'başlayalım' diyerek girer - besmele ve hamdele ile, yani Allah'ın adı ve şükrüyle. Şiirin tam ortasında bu söze yer vermesi anlamlıdır: her işin kalbi O'nu anmaktır. 'Salavatullah hatm olunsun' derken Hz. Peygamber'e salavat getirmenin bu duayı tamamladığını söyler.

İkinci beyitte derin bir itiraf var: bu kadar isyana, bu kadar hataya rağmen Hz. Muhammed bizleri ümmeti saydı, vazgeçmedi. Salat ve selam bu büyük şefkatin şükrüdür.

ÖRNEK 2:
Beyit:
"Seni Hak bilmeyen ol geçrevîler
Bulûğa ermez anların imânı

Kelâm-ı Hakk'a gûş olmayanlar
Alamaz himmeti feyz-i pirânı"

Mânâ:
Seni Allah olarak bilmeyenler - yani mürşidin değerini anlamayanlar - olgunlaşamazlar. Hakk'ın sözünü dinlemeyenler pîrin himmetinden nasipsiz kalır.

Salih Baba burada kapıyı kapatmaz; açıktır diyor. Ama içeri girebilmek için kulak gerekir. Duymak isteyen duyar.
`;

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

async function generateManaFor(verse) {
  const prompt = `${FEW_SHOT_EXAMPLES}

ŞIMDI ŞU BEYTİ AYNI USLUPLA YORUMLA:

Beyit:
"${verse}"

Mânâ:`;

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 600,
      temperature: 0.85
    }
  });

  const text = (result.text || '').trim();
  // Eger model "Mânâ:" gibi prefix dondururse temizle
  return text.replace(/^(Mânâ|Mana|Aciklama)[:：]\s*/i, '').trim();
}

// CLI argumanlari
const args = process.argv.slice(2);
const limitArg = args.findIndex(a => a === '--limit');
const limit = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : null;
const idFilter = args.filter(a => /^sb-\d+$/.test(a));

const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

let targets;
if (idFilter.length > 0) {
  targets = content.filter(e => idFilter.includes(e.id));
} else {
  targets = content.filter(e => !e.explanation || e.explanation.trim() === '');
  if (limit) targets = targets.slice(0, limit);
}

console.log(`Hedef: ${targets.length} beyit\n`);

let done = 0;
let errors = 0;
const RATE_LIMIT_MS = 6500; // Gemini Flash free: ~10 RPM, guvenli olsun

for (const entry of targets) {
  const idx = content.findIndex(e => e.id === entry.id);
  console.log(`[${done + 1}/${targets.length}] ${entry.id} (${entry.verse.split('\n')[0].slice(0, 50)}...)`);

  try {
    const mana = await generateManaFor(entry.verse);
    if (!mana || mana.length < 30) {
      console.warn(`  ⚠ Cok kisa veya bos (${mana.length} char), atlandı`);
      errors++;
    } else {
      content[idx].explanation = mana;
      // Her 5'te bir veya hepsi bittiginde diske yaz - kayip onlemek icin
      writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf-8');
      console.log(`  ✓ Kaydedildi (${mana.length} char)`);
    }
  } catch (e) {
    console.error(`  ✗ Hata: ${e.message}`);
    errors++;
    // 429 rate limit'te biraz daha bekle
    if (String(e.message).includes('429') || String(e.message).includes('quota')) {
      console.log('  Quota dolu, 60s bekleniyor...');
      await new Promise(r => setTimeout(r, 60_000));
    }
  }
  done++;

  // Rate limit
  if (done < targets.length) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }
}

console.log(`\nTamamlandi: ${done} islem, ${errors} hata`);
