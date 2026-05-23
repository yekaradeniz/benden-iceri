# Mânâ Yazım Durumu

## Mevcut Durum (2026-05-24)

**Tamamlanan:** sb-0001 → sb-0410 (410 mânâ, 410 günlük buffer)
**Kalan:** sb-0411 → sb-1222 (812 mânâ)

## Kurallar

1. **Karakter sayısı:** 220-300 char arası (orijinal son 5'i 237-307 char)
2. **Format:** 2 paragraf, `\n\n` ile ayrılmış
3. **Üslup:** Salih Baba'nın söylediğini değil, kastettiğini yorumla. Eski Türkçe kelimeleri açıklamadan kullanma. "Salih Baba burada..." veya "Şâir der ki..." kullanılabilir. Didaktik değil, tefekküre davet eden ton.
4. **ASLA:** Dini emir/yasak çıkarma, sadece beytin manevi katmanını aç.

## Sistem Durumu

- **Cron:** Her gün 19:00 TR (16:00 UTC)
- **Mod:** Sadece reel (CAROUSEL_ENABLED=false)
- **Platformlar:** Instagram (reel) + YouTube Shorts otomatik
- **Safety rule aktif:** mânâ veya verse eksikse workflow durur (`src/cli-render.js`)

## Yeni Session'da Devam İçin

```bash
# Eksik manaları gör:
node -e "const c = JSON.parse(require('fs').readFileSync('content/salih-baba.json','utf-8')); const t = c.filter(e => !e.explanation || e.explanation.trim() === '').slice(0, 20); for (const e of t) { console.log('=== ' + e.id + ' ==='); console.log(e.verse); console.log(); }"

# Yeni batch dosyası:
# scripts/mana-batch-3.json oluştur, format: {"sb-XXXX": "mana metni"}

# Uygula:
node scripts/apply-mana.js scripts/mana-batch-3.json

# Push:
git add content/salih-baba.json scripts/mana-batch-3.json
git commit -m "feat: N mana daha (sb-XXXX..sb-XXXX)"
git push origin main
```

## Stil Referansı (Onaylanmış Örnekler)

**sb-0024 (263 char) - kısa, doğrudan:**
> Seni Allah olarak bilmeyenler - yani mürşidin değerini anlamayanlar - olgunlaşamazlar. Hakk'ın sözünü dinlemeyenler pîrin himmetinden nasipsiz kalır.
>
> Salih Baba burada kapıyı kapatmaz; açıktır diyor. Ama içeri girebilmek için kulak gerekir. Duymak isteyen duyar.

**sb-0042 (264 char) - "Aslımdan bir haber" ilahisinin başlangıcı:**
> Salih Baba ünlü ilahisine bu beyitle başlar: bu fânî dünyâyı bütün gezdim, aslımı, hakikatimi söyleyen olmadı.
>
> Erenlerin meclislerine ulaştım, sohbetlerde bulundum - ama orada bile özüme dair bir cevap çıkmadı. Her şeyi anlatırlar, "sen kimsin" sorusu açık kalır.

## Yapılmaması Gerekenler

- Gemini/AI'ya yazdırma (kullanıcı kalite öncelikli istiyor)
- 300+ char yazma (font küçülür, posta sığmaz)
- Beyti birebir tercüme etme - YORUMLA
- Genel/banal söylemler kullanma (her beyit kendi bağlamında özgün olmalı)
- Sürekli "Salih Baba burada..." ile başlama (varyasyon yap)
