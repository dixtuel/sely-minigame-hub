# SELY.TR VDS Proje Paketi — Eksiksiz Kurulum Ağacı

Bu arşiv, VDS üzerinde eski sürümle birleştirilmeden kurulum yapılması için hazırlanmıştır. Paket kökünde `package.json`, `pnpm-lock.yaml`, `client/`, `server/`, `shared/`, `db/`, `scripts/` ve `prod-overlay.example/` bulunur.

## Zorunlu Denetimler

Kurulumdan önce aşağıdaki iki dosyanın varlığını doğrulayın. Eksikse arşiv bozuk kabul edilmeli ve kurulum durdurulmalıdır.

```text
db/postgres/001_daily_content.sql
scripts/audit-public-release.mjs
```

Varlıklar bu pakete gömülü değildir. Ayrı `sely-vds-assets.zip` paketindeki `images/*.png` dosyaları, derlemeden önce `client/public/manus-storage/` yoluna; favicon ise `client/public/favicon.svg` yoluna kopyalanmalıdır. Kodda `/manus-storage/<dosya>.png` URL’leri kullanılır; `/assets/sely/` yoluna geçmeyin ve kaynak URL’lerini değiştirmeyin.

## Yalnız Kaynak Paketinde Bulunmayanlar

`node_modules/`, `dist/`, `.git/`, `.manus-logs/`, gerçek `.env`, production kimlik/doğrulama dosyaları ve VDS sırları bu pakette bulunmaz. Bunlar kurulum sırasında yeniden üretilmeli veya private overlay’den uygulanmalıdır.
