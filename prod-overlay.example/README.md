# Production Overlay Example

Bu dizin yalnız şablondur. Gerçek üretim overlay’i public repoya **asla** eklenmez.

VDS üzerinde private bir dizinde aynı dosya yapısını oluşturun:

```text
prod-overlay/
├─ client/src/lib/contact.ts       # gerçek hukuki iletişim e-postası
├─ client/public/robots.txt        # production robots kuralı
├─ client/public/sitemap.xml       # production site haritası
├─ client/public/ads.txt           # mevcut production seller kaydı
├─ client/public/google*.html      # varsa doğrulama dosyaları
├─ client/public/BingSiteAuth.xml  # varsa doğrulama dosyası
├─ client/public/yandex_*.html     # varsa doğrulama dosyaları
└─ .env                            # PostgreSQL URI + DAILY_JOB_TOKEN
```

Overlay, public repo klonlandıktan sonra `rsync -a --exclude README.md <private-overlay>/ <checkout>/` ile uygulansın. Overlay içeriği hiçbir koşulda `git add`, `git commit` veya `git push` işlemine dahil edilmemelidir.

`robots.txt` şablonu `/en` yolunu `Disallow` eder. İngilizce arayüz kullanıcı deneyimi için sunulur; yalnız Türkçe kanonik URL’ler `sitemap.xml` içinde tutulur.
