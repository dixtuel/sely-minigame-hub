# Sürüm yayımlama (maintainer)

Kullanıcı kurulum adımları yalnız [kurulum rehberinde](DEPLOYMENT.md) tutulur. Bu sayfa tag'den **taslak** GitHub Release üretme adımlarını anlatır. Vercel production deploy'u ayrı işlemdir; release workflow'u canlı siteyi değiştirmez.

## Yayın akışı

1. `package.json` ve `Cargo.toml` sürümlerini aynı `X.Y.Z` değerine getir; değişiklikleri `main` dalına commit/push et. Çalışma ağacı temiz olsun.
2. Aynı commit'e `vX.Y.Z` tag'i oluşturup gönder:

   ```bash
   git tag -a vX.Y.Z -m "SELY MiniGame Hub vX.Y.Z"
   git push origin vX.Y.Z
   ```

3. Tag push'u **Prepare Draft Release** workflow'unu otomatik başlatır. Workflow tag'in `main` geçmişinde olduğunu ve iki manifest sürümünü doğrular; public audit, frontend/Rust testlerini, build'leri, checksum ve iki paket için açılış testlerini çalıştırır.
4. Oluşan **draft** Release'de iki arşivi, `SHA256SUMS` dosyasını, otomatik kurulum açıklamasını ve dosya boyutlarını incele; GitHub arayüzünden yayımla. Var olan Release'in üzerine yazılmaz. Workflow hata verirse logu düzeltip **Re-run jobs** kullan; sorun tag kaynağındaysa yeni patch sürümü çıkar.

Linux amd64 için dosyalar:

| Dosya | İçerik |
| --- | --- |
| `sely-linux-amd64-docker.tar.gz` | Hazır image, Compose, `.env.example`, `start.sh` |
| `sely-linux-amd64-standalone.tar.gz` | Rust binary, web dosyaları, `install.sh`, systemd örnekleri |
| `SHA256SUMS` | Her iki arşivin SHA-256 özeti |

Her paketin `README.md` dosyası [tek kurulum rehberinden](DEPLOYMENT.md) alınır; ayrı paket README şablonu tutulmaz. GitHub'ın otomatik source ZIP/tar.gz dosyaları kaynaktan/Vercel kurulumu içindir, hazır binary içermez. Public görsel allowlist'i `scripts/release-assets.list` dosyasında tutulur.

## Yerel paketleme (özel ihtiyaçta)

Normal akış tag push'udur. Yerel üretim için Linux, Node.js 22+, manifestteki pnpm sürümü, Rust, Docker Engine + Buildx, `tar`, `gzip`, `sha256sum` gerekir. Tag temiz çalışma ağacının `HEAD` commit'ini göstermelidir.

```bash
./scripts/package-release.sh vX.Y.Z
cd dist/releases/vX.Y.Z
sha256sum -c SHA256SUMS
```

Varsayılan platform yerel Docker mimarisidir. Arm64 gerektiğinde `--platform linux/arm64` eklenebilir; Buildx çapraz derleme desteğini doğrula. Betik mevcut çıktıyı ezmez. Yerel paketlemeyi yaptıysan iki arşivin açılışını ayrıca doğrula; Actions yolunda smoke test otomatik çalışır.

## GitHub Actions ve cache politikası

Repo public olduğu ve standart `ubuntu-24.04` runner kullandığı için Actions işlem dakikaları ücretsizdir. 2026-09-24 ölçümünde 42 cache kaydı toplam yaklaşık 2,37 GB idi; bu yüzden Docker `mode=max` ara katmanları korumak için bırakıldı. GitHub Free'nin **500 MB artifact** ve repo başına **10 GB cache** dahil alanını yine de gözetiyoruz. Güncel sınırlar: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [cache sınırları](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching), [workflow path filtreleri](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

| Workflow | Ne zaman | Cache ve çıktı |
| --- | --- | --- |
| `ci.yml` | Kod/manifest değişen `main` push ve PR; yalnız doküman/Docker değişiminde atlanır | pnpm store lockfile ile; Cargo cache yalnız `main` push'ta kaydedilir, PR restore eder |
| `docker-build.yml` | Dockerfile, Compose, ignore/build tanımı değişince | BuildKit `gha` cache `mode=max`; yalnız `main` push yazar, PR okur; image yayımlanmaz |
| `codeql.yml` | JS/TS/Rust kodunu etkileyen push/PR ve haftalık zamanlama; yalnız shell betiği değişiminde atlanır | CodeQL JS dependency cache; haftalık tarama docs değişmese de çalışır |
| `dependency-review.yml` | Bağımlılık manifest/lockfile değişen PR | Build/cache yok; yalnız yeni runtime risklerini inceler |
| `release-draft.yml` | `v*` tag push | CI Cargo cache'ini salt okunur geri yükler; paketleme betiği testlerde repo `target/` dizinini kullanır. Arşivler job'lar arasında 1 gün saklanır, sonra draft Release kalıcı varlıktır |

CI, CodeQL ve Docker işlerinde aynı dalın yeni koşusu eskisini iptal eder; release koşusu iptal edilmez. Path filtresiyle atlanan workflow'u branch protection'da **zorunlu check** yapma; GitHub atlanan zorunlu check'i pending bırakabilir. Cache içerikleri hiçbir zaman sır veya `.env` içermez. GitHub cache tekrar üretilebilir build girdileri içindir; release dosyaları iki job arasında kısa ömürlü artifact olarak taşınır. Docker cache dolarsa eski kayıtlar son erişime göre silinir. [Docker `gha` backend ayarları](https://docs.docker.com/build/cache/backends/gha/), [Rust cache `save-if`/`shared-key`](https://github.com/Swatinem/rust-cache).
