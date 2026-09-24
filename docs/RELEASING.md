# Sürüm yayımlama (maintainer)

Kullanıcı kurulum adımları yalnız [kurulum rehberinde](DEPLOYMENT.md) tutulur. Bu sayfa tag'den **taslak** GitHub Release üretme adımlarını anlatır. Vercel production deploy'u ayrı işlemdir; bu workflow canlı siteyi değiştirmez.

## Tek yayın akışı

1. `package.json` ve `Cargo.toml` sürümlerini aynı `X.Y.Z` değerine getir; değişiklikleri `main` dalına commit/push et. Çalışma ağacı temiz olsun.
2. Aynı commit'e `vX.Y.Z` tag'i oluşturup gönder:

   ```bash
   git tag -a vX.Y.Z -m "SELY MiniGame Hub vX.Y.Z"
   git push origin main vX.Y.Z
   ```

3. GitHub **Actions → Prepare Draft Release → Run workflow**: branch `main`, input `vX.Y.Z`. Workflow tag'in `main` geçmişinde olduğunu ve iki manifest sürümünü doğrular; public audit, frontend/Rust testlerini, build'leri ve Docker ve standalone açılış testlerini çalıştırır.
4. Oluşan **draft** Release'de iki arşivi ve `SHA256SUMS` dosyasını, açıklamayı ve dosya boyutlarını incele; ardından GitHub arayüzünden yayımla. Var olan Release'in üzerine yazılmaz.

Linux amd64 için dosyalar:

| Dosya | İçerik |
| --- | --- |
| `sely-vX.Y.Z-amd64-docker.tar.gz` | Hazır image, Compose, `.env.example`, `start.sh` |
| `sely-vX.Y.Z-amd64-standalone.tar.gz` | Rust binary, web dosyaları, `install.sh`, systemd örnekleri |
| `SHA256SUMS` | Her iki arşivin SHA-256 özeti |

GitHub'ın otomatik source ZIP/tar.gz dosyaları kaynaktan/Vercel kurulumu içindir. Hazır binary içermez. Public görsel allowlist'i `scripts/release-assets.list` dosyasında tutulur. Tag/release değiştirmek yerine hata durumunda yeni patch sürümü çıkar.

## Yerel paketleme (yalnız özel ihtiyaçta)

Normal akış GitHub Actions'tır. Yerel üretim için Linux, Node.js 22+, manifestteki pnpm sürümü, Rust, Docker Engine + Buildx, `tar`, `gzip`, `sha256sum` gerekir. Tag temiz çalışma ağacının `HEAD` commit'ini göstermelidir.

```bash
./scripts/package-release.sh --platform linux/amd64 vX.Y.Z
cd dist/releases/vX.Y.Z
sha256sum -c SHA256SUMS
```

Arm64 gerektiğinde `--platform linux/arm64` eklenebilir; Buildx çapraz derleme desteğini doğrula. Betik aynı tag için çıktıyı yanlışlıkla ezmez. Yerel paketlemeyi yaptıysan testleri ve container açılışını ayrıca doğrula; Actions yolundaki iki smoke test otomatik çalışır.

## GitHub Actions ve cache politikası

Repo public olduğu ve standart `ubuntu-24.04` runner kullandığı için Actions işlem dakikaları ücretsizdir. 2026-09-24 ölçümünde 42 cache kaydı toplam yaklaşık 2,37 GB idi; bu yüzden Docker `mode=max` ara katmanlarını korumak için bırakıldı. GitHub Free'nin **500 MB artifact** ve repo başına **10 GB cache** dahil alanını yine de gözetiyoruz. Bu limitler zamanla değişebilir; [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [cache sınırları](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) ve [workflow path filtreleri](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) geçerlidir.

| Workflow | Ne zaman | Cache ve çıktı |
| --- | --- | --- |
| `ci.yml` | Kod/manifest değişen `main` push ve PR; yalnız doküman/Docker değişiminde atlanır | pnpm store lockfile ile; Cargo cache yalnız `main` push'ta kaydedilir, PR restore eder |
| `docker-build.yml` | Dockerfile, Compose, ignore/build tanımı değişince | BuildKit `gha` cache `mode=max`; yalnız `main` push yazar, PR okur; image yayımlanmaz |
| `codeql.yml` | Kod değişen push/PR ve haftalık zamanlama | CodeQL JS dependency cache; haftalık tarama docs değişmese de çalışır |
| `dependency-review.yml` | Bağımlılık manifest/lockfile değişen PR | Build/cache yok; yalnız yeni runtime risklerini inceler |
| `release-draft.yml` | Maintainer tarafından elle başlatılır | CI Cargo cache'i salt okunur kullanır; arşivler job'lar arasında 1 gün saklanır, sonra draft Release kalıcı varlıktır |

Path filtresiyle atlanan workflow'u branch protection'da **zorunlu check** yapma; GitHub atlanan zorunlu check'i pending bırakabilir. Cache içerikleri hiçbir zaman sır veya `.env` içermez. GitHub cache, tekrar indirilebilir build girdileri içindir; release dosyaları iki job arasında kısa ömürlü artifact olarak taşınır. Docker cache dolarsa eski entries LRU ile silinir; gereksiz sık cache yazımı yerine `main` ile sınırlıyoruz. [Docker `gha` backend ayarları](https://docs.docker.com/build/cache/backends/gha/), [Rust cache `save-if`/`shared-key`](https://github.com/Swatinem/rust-cache).
