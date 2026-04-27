# benden içeri — Tasarım Dokümanı

**Tarih:** 2026-04-27
**Hesap:** @benden.iceri (Instagram)
**Tema:** Aşk yolculuğu — Niyazî-i Mısrî, Salih Baba Dîvânı, Nakşî silsile büyükleri

---

## 1. Hesap Kimliği

### 1.1 İsim

- **Birincil:** `@benden.iceri`
- **Yedek (alındıysa):** `@bendeniceri`, `@benden.iceri.`, `@benden_iceri`
- **Kaynak:** Yûnus Emre — *"Bir ben vardır bende benden içeri"*

### 1.2 Kitle ve Konumlandırma

- **Hedef kitle:** Karışık — hem tasavvuf/divan edebiyatına aşinası olan, hem de "iç dünya / anlam arayışı" kapısından girebilecek modern okuyucu.
- **"Tasavvuf" / "tarikat" / "Nakşî" kelimeleri postlarda KULLANILMAZ** — şiir ve aşk yolculuğu çerçevesi içinden konuşur.
- **Pozisyonlama:** Tasavvufgah'ın "kuzeni" değil, kopyası değil — dar çekirdekli, içsel, halvet hissi öne çıkan. (Bkz. §6 Karşılaştırma.)

### 1.3 Ses Tonu

- **Sessiz ve âdâblı.** Az konuşan, gerektiğinde tek cümle yorum, çoğu zaman şiiri kendi haline bırakan.
- Hocaefendi/dervîş edâsı — açıklayıcı/öğretici değil, hissettirici.

### 1.4 Bio (önerilen)

```
bir mısra, bir kapı
her gün bir dem

🌙 Niyazî · Salih Baba · silsile
```

---

## 2. İçerik Stratejisi

### 2.1 Kaynak Havuzu (başlangıç çekirdeği)

1. **Niyazî-i Mısrî** Dîvânı — primary
2. **Salih Baba Dîvânı** — primary
3. **Nakşî silsile büyükleri** — Bahâeddin Nakşbend, İmam Rabbânî, Mevlânâ Hâlid-i Bağdâdî vb.

**Kapı 2 (sonra eklenebilir):** Yunus Emre, Mevlânâ, Hacı Bayrâm-ı Velî, ayet/hadis-i kudsî, modern mutasavvıflar (Ken'an Rifâî, Sâmiha Ayverdi).

### 2.2 İçerik Formatları (ritim)

Postlar dört format arasında dönüşümlü gider:

| Format | Açıklama | Örnek |
|---|---|---|
| **A — Tek mısra** | Sade, açıklamasız. Şiir kendi başına. | "Derman arardım derdime, derdim bana derman imiş." |
| **B — Mısra + modern altyazı** | 1-2 cümle yumuşakça açan yorum. | Yukarıdaki + "Aradığımız zaten içimizde miydi?" |
| **C — İki katmanlı** | Üstte küçük orijinal mısra (Arapça/Farsça/eski Türkçe), altta büyük modern Türkçe. | "Dil ber yâr u dest ber kâr" / "Gönül Yâr ile, el iş ile olsun." |
| **D — Carousel** | Çok kareli post — ilk kare mısra, sonraki kareler açılım. (V2'de detaylanacak.) | — |

### 2.3 Yazım Stili Kuralı

- **Şair/divandan alıntı orijinal yazımıyla kalır.** ("dilber" değil "dil ber" gibi)
- **Modern Türkçe altyazı/yorum** olduğunda ayrı katmanda, küçük puntoyla.
- "Tasavvuf", "tarikat", "Nakşî" kelimeleri görünmez. Kaynak yazılırken sadece şair adı: "Bahâeddin Nakşbend" → kabul; "Nakşbendiyye tarikatı" → değil.

---

## 3. Görsel Kimlik

### 3.1 Format

- **En boy:** 4:5 dikey (Instagram feed için optimal, story olarak da çalışır)
- **Çözünürlük:** 1080 × 1350 px (Instagram standart)

### 3.2 Renk Paleti — "Mürekkep & Fildişi" + foto overlay

Metin renkleri (overlay üzerinde):
- **Krem ana:** `#faf6ec` (mısra)
- **Açık altın:** `#d9c79a` (orijinal alıntı, kaynak, çizgi)
- **Karanlık tabaka:** Linear gradient `rgba(0,0,0,0.18) → rgba(0,0,0,0.85)` — fotoğraf üzerine

### 3.3 Tipografi

- **Mısra:** Cormorant Garamond — italic, 500, 34px, line-height 1.32, letter-spacing 0.2px
- **Orijinal alıntı (varsa):** Cormorant Garamond — italic, 400, 16px, line-height 1.5, krem-altın
- **Kaynak:** Inter — 500, 10.5px, letter-spacing 4.5px, UPPERCASE, açık altın
- **Çizgi:** 36px genişlik, 1px yükseklik, `rgba(217, 199, 154, 0.6)` (orta-altın yarı saydam)
- **Watermark/marka adı:** YOK (kasıtlı olarak)

### 3.4 Kompozisyon

- Metin alt yarıya yerleşir (justify-content: flex-end), üstte fotoğraf nefes alır.
- Padding: `0 36px 48px` (sağ-sol simetrik, alt boşluk).
- Metin **ortalı** (text-align: center).
- Sıralama (yukarıdan aşağıya): orijinal alıntı (varsa) → mısra → çizgi → kaynak.

### 3.5 Fotoğraf Yönü

- **Atmosferik, içsel, halvet hissi.** Tasavvufgah'tan farklı olarak epik/azametli değil.
- Tematik mood'lar: mum/kandil ışığı, mihrap pencere huzmesi, çöl tek ağaç, eski yazma kitap, gece/yıldız, su/yansı, pencere ışığı, tek silüet, yağmur sonrası toprak, dağ patikası.
- **Renk tonları:** sıcak ışık + koyu zemin tercih edilir; kontrast yüksek.

---

## 4. Otomasyon Mimarisi

### 4.1 Yığın

```
GitHub Repo (kod + içerik)
    ├── verses.json          (90+ günlük mısra batch)
    ├── photos.json          (mood-tagged Unsplash library)
    ├── photos/              (yerel cache veya CDN URL)
    ├── template/            (HTML şablon — v5)
    ├── render.js            (Playwright PNG renderer)
    ├── post.js              (IG Graph API client)
    └── .github/workflows/
        └── daily.yml        (cron — her gün 09:00 GMT+3)
```

### 4.2 Akış

1. **GitHub Actions cron (`daily.yml`)** her gün 09:00'da çalışır
2. Action: `verses.json`'dan sıradaki mısrayı belirler (index = launch'tan beri geçen gün)
3. Action: Mısranın mood etiketine göre `photos.json`'dan uygun fotoğraf seçer
4. Action: HTML şablonu doldurur, **Playwright headless Chromium** ile screenshot alır → 1080×1350 PNG
5. Action: **Instagram Graph API**'sine `POST /{ig-user-id}/media` (caption + image URL) → container ID
6. Action: `POST /{ig-user-id}/media_publish` → yayınla
7. Action logu commit edilir (idempotency için son post tarihi tutulur)

### 4.3 Maliyet

- **GitHub Actions:** Public repo'da sınırsız ücretsiz; private repo'da 2000 dk/ay (kullanım ~30 dk/ay), free tier yetiyor
- **Instagram Graph API:** $0
- **Unsplash CDN:** $0 (URL'ler doğrudan kullanılır, fotoğraflar repo'ya commit edilmez)
- **Toplam:** **$0/ay forever**

### 4.4 Önkoşullar (bir kerelik kurulum)

- Instagram **Business veya Creator** hesabı (ücretsiz upgrade)
- Bağlı **Facebook Page** (ücretsiz)
- **Meta Developer App** + Instagram Graph API izinleri (`instagram_content_publish`, `pages_show_list`)
- Long-lived access token (60 gün, sonra refresh)
- GitHub Secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN`, `UNSPLASH_ACCESS_KEY` (opsiyonel)

### 4.5 İçerik Onayı (insan-in-the-loop)

- Yeni mısralar **PR olarak** eklenir → kullanıcı merge ederse canlıya çıkar
- `verses.json` PR'lerinde içerik review yapılır (mısra doğruluğu, mood eşleşmesi)
- Buggy bir post yayınlanırsa: **revert + re-commit + Action manuel re-trigger** ile düzeltilir

---

## 5. Fotoğraf Stratejisi

### 5.1 Kütüphane

- **Kaynak:** Unsplash (öncelikli) + Pexels (yedek)
- **Lisans:** Unsplash + Pexels lisansı atribüsyon zorunlu değil, ticari kullanıma açık
- **Boyut:** 100-150 fotoğraf (başlangıçta 30-50 ile MVP)

### 5.2 Mood Etiketleme

`photos.json` örneği:

```json
[
  {
    "id": "candle-warm-01",
    "url": "https://images.unsplash.com/photo-1518895949257-7621c3c786d7",
    "moods": ["halvet", "ic-dunya", "yalnizlik", "ask-yangini"],
    "credit": "@photographer-handle"
  }
]
```

### 5.3 Mood Listesi (başlangıç)

| Mood | Açıklama |
|---|---|
| `halvet` | Tek mum, sıcak yakın çekim, içe çekilme |
| `ic-dunya` | Pencere ışığı, kapalı mekân, sessizlik |
| `seyran` | Ufuk, çöl, yol, patika |
| `ask-yangini` | Mum alev, ışık, yanma |
| `yalnizlik` | Tek silüet, tek ağaç, boş mekân |
| `mihrap` | Cami iç, ışık huzmesi, mihrap |
| `divan` | Eski yazma kitap, mürekkep, kalem |
| `gece` | Yıldız, ay, karanlık |
| `tefekkür` | Su, yansı, durgun manzara |

### 5.4 Eşleştirme

Her `verses.json` girdisinde `moods: [...]` listesi olur (hangi mood'larla uyumlu). Render zamanı:
1. Mısranın mood listesinden rastgele biri seçilir
2. `photos.json`'dan o mood'a sahip fotoğraflar arasında **son 30 günde kullanılmamış** olan rastgele biri seçilir
3. Tekrar oranı düşük tutulur

---

## 6. Tasavvufgah'tan Farklılaşma

| Boyut | Tasavvufgah | benden içeri |
|---|---|---|
| Kaynak havuzu | Geniş — ayet, hadis, her mutasavvıf | Dar çekirdek — Niyazî Mısrî, Salih Baba, Nakşî silsile |
| Görsel ölçek | Epik — Ayasofya, çöl panoraması, dağ | İçsel — mum, pencere ışığı, kitap, kandil, gölge |
| Tema çerçevesi | Genel tasavvuf, hatırlatma | Aşk yolculuğu — gönülden gönüle |
| Watermark | "TASAVVUFGAH" — büyük, agresif | YOK — sade, mütevazı |
| Mısra rengi | Altın sarısı (#f6e1ad) | Krem (#faf6ec) |
| Çizgi | Yok | Var (ince altın) |
| "Tasavvuf" sözü | Var (hesap adı) | Yasak |

---

## 7. Modüller ve Sorumluluklar

### 7.1 İçerik Veritabanı (`verses.json`)

```json
[
  {
    "id": "001",
    "verse": "Derman arardım derdime,\nderdim bana derman imiş.",
    "original": null,
    "source": "Niyazî-i Mısrî",
    "moods": ["halvet", "ic-dunya", "tefekkür"],
    "format": "A",
    "caption": "bir mısra, bir kapı 🌙",
    "scheduled": null,
    "posted_at": null
  }
]
```

### 7.2 Fotoğraf Manifestosu (`photos.json`)

`§5.2` formatında.

### 7.3 HTML Şablon (`template/post.html`)

V5 mockup yapısında, değişkenler `{{verse}}`, `{{original}}`, `{{source}}`, `{{photo_url}}`. Cormorant Garamond + Inter Google Fonts'tan yüklenir.

### 7.4 Render Script (`render.js`)

- Node.js + Playwright
- HTML şablonu doldur, headless Chromium başlat, 1080×1350 viewport, screenshot al
- Çıktı: `output/YYYY-MM-DD.png`

### 7.5 Post Script (`post.js`)

- Node.js
- Instagram Graph API client (axios veya `node-fetch`)
- Akış: PNG'yi public URL'e yükle (GitHub artifact veya Cloudinary) → media container yarat → publish
- **Alternatif (basitleştirme):** PNG'yi GitHub raw URL ile sun (repo public) — extra hosting gerekmez

### 7.6 GitHub Actions (`.github/workflows/daily.yml`)

- Cron: `0 6 * * *` (UTC = 09:00 GMT+3)
- Steps: checkout → install Node → install Playwright → run render → run post
- Manual `workflow_dispatch` ile test edilebilir

### 7.7 README (`README.md`)

Setup, secrets, content workflow, troubleshooting.

---

## 8. Faz Planı

### Faz 1 — MVP (Hafta 1-2)

- [ ] Repo iskeleti
- [ ] HTML şablon (v5)
- [ ] 30 günlük seed `verses.json`
- [ ] 30 fotoğraf seed `photos.json`
- [ ] `render.js` çalışır PNG çıktısı verir
- [ ] Manuel test: 1 PNG üret, gözle onayla
- [ ] Meta Developer App + Instagram Business hesap kurulumu
- [ ] `post.js` çalışır, IG'ye 1 test post atar
- [ ] GitHub Actions `daily.yml` schedule kurulu
- [ ] İlk 7 gün manuel kontrol (`workflow_dispatch` + post log review)

### Faz 2 — Stabilizasyon (Hafta 3-4)

- [ ] 90 günlük `verses.json`
- [ ] 100 fotoğraf `photos.json`
- [ ] Carousel formatı (Format D)
- [ ] Caption şablonları (mood'a göre değişen)
- [ ] Hata yakalama: post fail durumunda issue açan handler
- [ ] Token refresh otomasyonu (60 günlük IG tokenını yenileme)

### Faz 3 — Genişleme (sonra)

- [ ] Yunus, Mevlânâ, ayet/hadis kapısı (kaynak havuzu büyütme)
- [ ] Hikâye (Stories) otomasyonu
- [ ] Reels (kısa video) — eğer talep gelirse
- [ ] Hashtag stratejisi optimizasyonu

---

## 9. Riskler ve Önlemler

| Risk | Önlem |
|---|---|
| IG Graph API politika değişikliği | Modüler post katmanı; gerekirse Later/Buffer fallback |
| Token süresi dolması | Token refresh GitHub Action (her 50 günde bir) |
| Yanlış mısra/kaynak hatası | PR review zorunlu, Faz 1'de günlük gözden geçirme |
| Fotoğraf telif sorunu | Sadece Unsplash/Pexels — açık lisans |
| Fotoğraf-mısra uyumsuzluğu | Mood etiketleme + ilk 7 gün manuel kontrol |
| Hesap askıya alma | Kâr amaçlı reklam yok; tasavvuf içeriği IG'de güvenli kategori |

---

## 10. Açık Sorular (sonradan kararlaştırılır)

- Caption pattern'i: her postta aynı mı (örn. "bir mısra, bir kapı 🌙"), yoksa varyasyon mu?
- Hashtag listesi (#niyazimisri, #salihbaba, #askyolculugu, #tasavvuf? — son ikisi tartışmalı)
- Story arşivleme: feed postu Story olarak da paylaşılsın mı?
- Saat: 09:00 mı, akşam 21:00 mı en iyi etkileşim saati? (analytics ile sonra optimize edilir)
