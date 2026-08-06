# Karanlık Psikoloji - Yeni Kanal Projesi

## Vizyon

`benden-iceri` (Salih Baba) sisteminin teknik altyapısını kullanarak ikinci bir kanal: **Karanlık Psikoloji**.

Hedef: Hızlı abone büyümesi, daha geniş kitle, sponsorluk potansiyeli olan bilim-temelli içerik.

---

## Salih Baba'dan Farklılıklar

| | Salih Baba | Karanlık Psikoloji |
|---|---|---|
| Niş | Tasavvuf şiiri | Davranış psikolojisi |
| Format | Beyit + Mânâ | Soru + Cevap |
| Kitle | İslami, 30+ | Genel, 18-35 |
| Görsel | Cami, altın, sıcak | Modern, koyu, soğuk |
| Müzik | Ney, makam | Cinematic, ambient |
| Font | Cormorant (klasik serif) | Modern (sans-serif veya geometric) |
| Marka rengi | #d9c79a (altın) | Mor/cyan/koyu mavi |
| Etiket | "MÂNÂ" / "SALİH BABA" | "CEVAP" / kanal adı |

---

## Format - Kanıtlanmış Algoritma Stratejisi

Soru + Cevap **video içinde**. Cevap caption'da bırakılmaz çünkü:
- İzleyici caption'a kayar → completion rate düşer
- YouTube Shorts algoritması düşük completion'ı cezalandırır
- Self-contained içerik kazanıyor (2024 algoritma değişikliği sonrası)

### Zamanlama planı (~30sn reel)
- 0-7sn: Soru overlay (büyük, dramatik)
- 8-9sn: Geçiş (sadece arka plan)
- 10-30sn: Cevap overlay (kavram adı + mekanizma)
- 30-33sn: Outro fade

---

## İçerik Kuralları

1. **Karakter:** Soru ~40-60 char, cevap **240-300 char** (Salih Baba mana ile aynı sınır)
2. **Bilimsel kaynak gerekli:** Her cevapta GERÇEK psikoloji kavramı geçmeli (Schadenfreude, Dunning-Kruger, Halo Effect vb.)
3. **Pseudoscience yasak:** "Manipülasyon hilesi", "10 saniyede etkilemek" gibi clickbait yok
4. **APA temelli:** Kavramlar peer-reviewed araştırmalardan
5. **Format:** Kavram adı + mekanizma + insani gözlem
6. **Ton:** Yargısız, açıklayıcı, "neden böyle" sorgusu

---

## Mevcut 30 Hazır Soru-Cevap

Önceki session'da yazıldı. Listede şu kavramlar var:

**Sosyal Psikoloji:** Schadenfreude, Bystander Effect, Social Proof, Authority Bias, In-Group Bias, Just-World Hypothesis, Pluralistic Ignorance, Mirror Neurons

**Bilişsel Önyargılar:** Dunning-Kruger, Halo Effect, Confirmation Bias, Cognitive Dissonance, Anchoring, Spotlight Effect, Negativity Bias, Hedonic Adaptation

**Duygular & Davranış:** Loss Aversion, Reactance, Cocktail Party Effect, Hangry Effect, Self-Fulfilling Prophecy, Projection

**Manipülasyon Teknikleri:** Gaslighting, Door-in-the-Face, Foot-in-the-Door

**Kişilik & İlişki:** Mere Exposure Effect, Anxious Attachment, Narcissistic Supply, Sunk Cost Fallacy, Imposter Syndrome

Tam liste önceki session transcript'inde.

---

## Tech Setup Yol Haritası

Yeni session'da:

### 1. Yeni Brand Account oluştur (5 dk)
- `yekaradeniz@gmail.com` ile YouTube'a gir
- Yeni Brand Account: "Karanlık Psikoloji" veya seçilen isim
- Aynı Gmail, ayrı kanal - sorun yok (Mevcut MKBHD vs.)

### 2. Yeni OAuth refresh token al (15 dk)
- `console.cloud.google.com` mevcut "Daily Quran" projesi
- Aynı OAuth Client ID kullanılabilir veya yenisi
- Auth URL aç → Karanlık Psikoloji Brand Account seç → code al
- Token exchange → refresh_token

### 3. Yeni repo (10 dk)
- `karanlik-psikoloji` adlı yeni GitHub repo
- benden-iceri kodu fork'la veya temiz başlat
- Secrets:
  - `IG_USER_ID` (yeni Instagram, eğer Instagram da olacaksa)
  - `IG_ACCESS_TOKEN`
  - `YOUTUBE_CLIENT_ID` (mevcut)
  - `YOUTUBE_CLIENT_SECRET` (mevcut)
  - `YOUTUBE_REFRESH_TOKEN` (YENİ - yukarıdaki adımdan)
  - `PEXELS_API_KEY` (mevcut, kullanılabilir)
  - `GEMINI_API_KEY` (mevcut)

### 4. Visual template değişiklikleri
- `template/reel-verse-text.html` → soru template
- `template/reel-mana-text.html` → cevap template
- Renkler: altın → mor/cyan
- Font: Cormorant → modern (Inter, IBM Plex, Manrope, JetBrains Mono?)
- Kanal logosu/font kararlaştırılacak

### 5. Pexels query güncelleme
- `src/fetchPexelsVideo.js` MOOD_QUERIES tamamen değişir
- Cami terimleri → "dark moody", "neon city", "abstract waves", "cinematic black", "smoke art", "psychology brain" vb.

### 6. Müzik değişikliği
- `audio/` klasörü değişir
- Ney/makam → cinematic/ambient (Hans Zimmer benzeri, Pexels music veya YouTube Audio Library'den indirilir)

### 7. Content JSON formatı
```json
{
  "id": "kp-0001",
  "day": 1,
  "verse": "İnsanlar neden başkalarının acısına gizlice sevinir?",
  "explanation": "Bu duyguya \"Schadenfreude\" denir...",
  "source": "Karanlık Psikoloji",
  "moods": ["dark", "psychology"],
  "concept": "Schadenfreude"
}
```
NOT: Mevcut alanlar (verse, explanation) korunur ki kod aynı çalışsın. Sadece anlam değişir.

### 8. Caption stratejisi
- Soruyu tekrarla (1 cümle)
- Hashtag set: #psikoloji #davranis #sosyalpsikoloji #karanlikpsikoloji
- Engagement CTA: "Sen hiç fark ettin mi?"

---

## Karar Bekleyen Konular

1. **Kanal adı:** "Karanlık Psikoloji" mi başka mı?
2. **Instagram'a da atılacak mı yoksa sadece YouTube/TikTok mu?**
3. **TTS / voice-over eklenecek mi?** (text-only mu, sesli anlatım mı)
4. **İçerik sayısı:** 30 başlangıç var, kaç tane daha yazılacak (200? 500?)
5. **Yayın saati:** 19:00 (Salih Baba ile çakışıyor) yoksa farklı (mesela 21:00)?
6. **Renk paleti seçimi:** mor + cyan / koyu mavi + beyaz / siyah + neon hangisi?

---

## Bir Sonraki Session İçin İlk Adım

```
Bu MD dosyasını oku, sonra:
1. Kanal adına karar verelim
2. Görsel template'i 2-3 varyantla göster
3. İlk 30 soru-cevap'ı content JSON olarak kaydet
4. Yeni Brand Account + OAuth setup'ını rehberle birlikte yap
5. Test reel render et, kaliteyi gör, sonra ilk post
```

Salih Baba sistemi paralel çalışmaya devam eder, dokunulmaz.
