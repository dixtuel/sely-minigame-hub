# Release hazırlama

Release hazırlama betiği testleri ve indirilebilir dosyaları üretir. Tag'i gönderdikten sonra GitHub Actions bu dosyaları taslak Release'e ekleyebilir. GitHub ayrıca tag'in kaynak ZIP/tar.gz dosyalarını sunar. [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

## Üretilen dosyalar

`vX.Y.Z` tag'i için `dist/releases/vX.Y.Z/` altında platform başına iki arşiv ve bir checksum listesi oluşur:

| Dosya                                                                 | İçerik |
| --------------------------------------------------------------------- | ------ |
| `*-linux-amd64-docker.tar.gz` / `*-linux-arm64-docker.tar.gz`         | Uygulama image'ı, Compose, `.env.example` ve `start.sh`. |
| `*-linux-amd64-standalone.tar.gz` / `*-linux-arm64-standalone.tar.gz` | Rust binary, web istemcisi, kurulum betiği ve isteğe bağlı systemd birimleri. |
| `SHA256SUMS`                                                          | Arşivlerin SHA-256 özetleri. |

GitHub tag kaynağı için ayrıca ZIP/tar.gz sunar. Temiz kaynak arşivi Vercel kurulumu içindir; `.env`, `.vercel` ve Git'te tutulmayan yerel görseller dahil edilmez. Yalnız `scripts/release-assets.list` içindeki katalog/marka/paylaşım görselleri public source'a girer.

## Maintainer: release hazırlama

### GitHub Actions ile taslak release

Önce sürüm değişikliklerini `main` dalına gönder, sürümle eşleşen bir tag oluşturup gönder. Tag'deki `package.json` ve `Cargo.toml` sürümleri aynı olmalı ve tag `main` geçmişinde bulunmalı:

```bash
git push origin main
git tag -a vX.Y.Z -m "SELY MiniGame Hub vX.Y.Z"
git push origin vX.Y.Z
```

GitHub'da **Actions → Prepare Draft Release → Run workflow** yolunu aç; branch olarak `main`'i, tag alanına gönderdiğin `vX.Y.Z` değerini seç. Workflow public audit'i, frontend/Rust test ve build'lerini, checksum doğrulamasını ve paket içindeki Docker servisinin açılış testini çalıştırır; Linux amd64 arşivlerini taslak GitHub Release'e ekler. Paketleme ve yükleme ayrı işlerdir; `contents: write` yalnız taslak oluşturma işinde kullanılır. Taslağı ve dosyaları inceleyip GitHub arayüzünden elle yayımla.

### Yerelde arşivleri üretme

Linux'ta Node.js 22+, Corepack (manifestte sabitlenmiş pnpm sürümü), stable Rust, Docker Engine + Buildx, `tar`, `gzip` ve `sha256sum` gerekir. `docker buildx version` ve `docker buildx inspect --bootstrap` ile plugin ve hedef mimari desteğini önceden kontrol et. Buildx yoksa kullandığın Docker dağıtımına uygun CLI plugin'ini kur; Ubuntu için Docker'ın [resmî kurulum yönergesi](https://docs.docker.com/engine/install/ubuntu/) `docker-buildx-plugin` paketini belgeler. Mevcut Docker Engine'i otomatik kaldırıp değiştirme. Çalışma ağacı temiz olmalı ve tag mevcut `HEAD` commit'ini göstermelidir:

```bash
git status --short
git tag -a vX.Y.Z -m "SELY MiniGame Hub vX.Y.Z"
./scripts/package-release.sh vX.Y.Z --platform linux/amd64 --platform linux/arm64
```

İlk üretimde tek mimari seçilebilir. `linux/arm64` çapraz derlemesi Buildx'in uygun emülasyon/worker desteğini gerektirebilir. Docker imajı Docker exporter ile, standalone dosyaları ise Buildx `local` exporter ile çıkarılır; script mimarileri ayrı build ederek her Release arşivini tek platformda tutar ([Buildx exporters](https://docs.docker.com/build/exporters/)). Betik tag arşivini temiz geçici dizine çıkarır; public release audit, sabitlenmiş pnpm ile install/check/test/build, Rust test suite’i ve Docker/standalone derlemelerini çalıştırır. Çıktıyı GitHub Releases sayfasında taslak olarak açıp dosyaları seçerek yükle; tag ve açıklamayı incelemeden yayımlama. `SHA256SUMS` dosyasını da ekle.

Betiğin mesaj dili `LC_ALL`, `LC_MESSAGES`, `LANG` sırasıyla sistem locale'inden algılanır (`tr*` Türkçe, diğerleri İngilizce); `--lang tr|en` ile seçilebilir. Dosya adları ve komutlar locale'den bağımsızdır.

## Kurulum

Docker, standalone ve Vercel adımları [dağıtım rehberinde](DEPLOYMENT.md). Docker paketini açıp `./start.sh` çalıştırmak yeterlidir; yerel SQLite volume'u ve `.env` güncellemelerde korunur.
