# benden içeri

Otomatik günlük tasavvuf paylaşımları için Instagram automation.

Her gün 09:00'da (GMT+3) GitHub Actions, `content/verses.json`'dan sıradaki mısrayı seçer, `content/photos.json`'dan uygun mood'da bir fotoğraf eşleştirir, Cormorant Italic + dark overlay ile 1080×1350 PNG render eder ve Instagram Graph API üzerinden @iceribenden'ye postlar.

**Maliyet:** $0/ay forever. **Mac açık olması gerekmez.**

## Geliştirme

### Önkoşul

- Node.js 20+ (`.nvmrc`)
- npm

### Kurulum

```bash
npm install
npx playwright install chromium
```

### Test

```bash
npm test
```

### Yerel render

```bash
npm run render
open output/$(date -u +%Y-%m-%d).png
```

## Deployment

### 1. GitHub repo

```bash
gh repo create benden-iceri --public --source=. --push
```

(Public öneriliyor — Actions'ın free quota'sı sınırsız oluyor + raw URL erişimi açık.)

### 2. Instagram + Meta App kurulumu

Detaylı talimat: [docs/META_APP_SETUP.md](docs/META_APP_SETUP.md)

Kısaca:
1. Instagram hesabını **Business** veya **Creator** hesaba çevir
2. Bir Facebook Page oluştur, Instagram hesabını bağla
3. Meta Developer'da app oluştur, Instagram Graph API izinleri al
4. Long-lived access token üret (60 gün)

### 3. GitHub Secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Değer |
|---|---|
| `IG_USER_ID` | Instagram Graph API'den dönen Business hesabının ID'si |
| `IG_ACCESS_TOKEN` | Long-lived access token |

### 4. İlk test

Repo → Actions sekmesi → "Daily Post" workflow → "Run workflow" butonu (workflow_dispatch).

İlk çalışmadan sonra:
- `output/YYYY-MM-DD.png` repo'ya commit edilir
- Instagram hesabında post görünmelidir
- Action log'unda "✓ Posted IG-..." mesajı

### 5. Otomatik akış

Schedule kurulu — her gün 06:00 UTC (09:00 GMT+3) otomatik çalışır.

## İçerik ekleme

Yeni mısra eklemek için `content/verses.json`'a JSON entry ekle, PR aç, merge et.

Her entry:

```json
{
  "id": "020",
  "verse": "Mısra burada (\\n ile satır kırıkları)",
  "original": null,
  "source": "Niyazî-i Mısrî",
  "moods": ["halvet", "tefekkür"],
  "format": "A",
  "caption": "post açıklaması 🌙\n\n#niyazimisri",
  "verified": true
}
```

Mood listesi (`content/photos.json` ile uyumlu):
- `halvet`, `ic-dunya`, `seyran`, `ask-yangini`, `yalnizlik`, `mihrap`, `divan`, `gece`, `tefekkür`

## Sorun giderme

- **Action başarısız:** Repo → Actions → ilgili çalıştırma → log'a bak.
- **Token süresi doldu:** [META_APP_SETUP.md](docs/META_APP_SETUP.md) Token Refresh bölümü.
- **Yanlış post yayınlandı:** Manuel sil. `output/log.json`'da `lastPost.postId`'yi bul, IG'de sil. PR ile düzelt.
