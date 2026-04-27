# Meta Developer App + Instagram Graph API Setup

Bir kerelik kurulum. ~30-60 dakika sürer.

## 1. Instagram Hesabını Business'e Çevir

1. Instagram uygulamasından @benden.iceri profiline git
2. Settings → Account → "Switch to Professional Account"
3. Business veya Creator seç (her ikisi de Graph API'sine erişiyor)

## 2. Facebook Page Oluştur ve Bağla

1. https://www.facebook.com/pages/create
2. "Brand or Product" → "benden içeri" adıyla
3. Page Settings → Linked Accounts → Instagram → @benden.iceri ile bağla

## 3. Meta Developer App

1. https://developers.facebook.com/apps/ → "Create App"
2. App type: "Business"
3. Use case: "Other" → "Business"
4. App'in dashboard'unda:
   - "Add Product" → **Instagram** ve **Facebook Login for Business**

## 4. Permission'lar

App Review → Permissions and Features:

İhtiyacımız olan:
- `instagram_basic` (read)
- `instagram_content_publish` (post)
- `pages_show_list` (FB Page listesi)
- `pages_read_engagement` (FB Page detayı)

İlk testler için **Test User** olarak çalışıyor — App Review olmadan kendi hesabınla test edebilirsin. Production'a geçince Permissions tab'ından review başlatılır (1-7 gün).

## 5. Access Token

### Short-lived → Long-lived

1. Graph API Explorer: https://developers.facebook.com/tools/explorer/
2. App'i seç, "User Token" + permission'ları işaretle ("Generate Access Token")
3. Bu kısa ömürlü token (1 saat)

Long-lived'e çevir (60 gün):

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}"
```

Çıktıdan `access_token` field'i — bu uzun ömürlü token.

### Page Token (kalıcı)

User token long-lived olsa da Page Access Token aslında **kalıcı** (Page bağlı kaldıkça).

```bash
curl -X GET "https://graph.facebook.com/v21.0/me/accounts?access_token={LONG_USER_TOKEN}"
```

Çıktıdaki Page'in `access_token` değeri — bunu GitHub Secret olarak kullan.

## 6. IG Business Account ID Bulma

```bash
curl -X GET "https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token={PAGE_TOKEN}"
```

Çıktı: `{"instagram_business_account": {"id": "1789..."}}` — bu ID'yi `IG_USER_ID` Secret'a yaz.

## 7. Test

```bash
# imageUrl public erişilebilir olmalı
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media?image_url=https://example.com/test.jpg&caption=test&access_token={TOKEN}"

# yanıt: {"id": "container-id"}
# sonra yayınla:
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media_publish?creation_id={container-id}&access_token={TOKEN}"
```

Başarılıysa Instagram'da post görünür.

## 8. Token Refresh (Faz 2)

User long-lived token 60 günde bir yenilenmeli. Page token kalıcı (Page bağlı kaldıkça) ama refresh önerilir.

Faz 2'de bir GitHub Action eklenecek: 50 günde bir tokenı otomatik refresh eder. Şimdilik manuel olarak 50 günde bir adım 5'i tekrar et.

## Yararlı Linkler

- IG Graph API: https://developers.facebook.com/docs/instagram-api
- Content Publishing: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
- Token Debugger: https://developers.facebook.com/tools/debug/accesstoken/
