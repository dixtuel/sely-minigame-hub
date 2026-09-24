# Elle release hazırlama

Release hazırlama betiği testleri ve indirilebilir dosyaları üretir; Git tag'i oluşturmaz, GitHub'a yükleme yapmaz, GHCR'a push etmez ve Vercel'e deploy etmez. GitHub, release tag'inden kaynak ZIP/tar.gz dosyalarını kendisi sunar; üretilen Docker ve standalone arşivleri Release arayüzünde elle eklenir. [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

## Üretilen dosyalar

`vX.Y.Z` tag'i için `dist/releases/vX.Y.Z/` altında platform başına üç arşiv ve bir checksum listesi oluşur:

| Dosya                                                                 | İçerik ve kullanım                                                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*-linux-amd64-standalone.tar.gz` / `*-linux-arm64-standalone.tar.gz` | Rust binary, derlenmiş web istemcisi, `.env.example`, lisans/kurulum notları, systemd service/timer örnekleri ve kurulum betiği. Linux glibc x86-64/ARM64 makinede çalışır. |
| `*-linux-amd64-image.tar.gz` / `*-linux-arm64-image.tar.gz`           | İlgili mimari için Docker image; `docker load` ile yerel olarak yüklenir.                                                                                                   |
| `*-linux-amd64-compose.tar.gz` / `*-linux-arm64-compose.tar.gz`       | `compose.yaml`, temiz `.env.example` ve Docker başlangıç adımları. Image arşivindeki sürüm etiketiyle çalışır.                                                              |
| `SHA256SUMS`                                                          | Release klasöründeki bütün platform arşivlerinin SHA-256 özetleri.                                                                                                          |

GitHub tag kaynağı için ayrıca ZIP/tar.gz sunar. Temiz kaynak arşivi Vercel kurulumu içindir; `.env`, `.vercel` ve Git'te tutulmayan yerel görseller dahil edilmez. Yalnız `scripts/release-assets.list` içindeki katalog/marka/paylaşım görselleri public source'a girer.

## Maintainer: arşivleri üretme

Linux'ta Node.js 22+, Corepack (manifestte sabitlenmiş pnpm sürümü), stable Rust, Docker Engine + Buildx, `tar`, `gzip` ve `sha256sum` gerekir. `docker buildx version` ve `docker buildx inspect --bootstrap` ile plugin ve hedef mimari desteğini önceden kontrol et. Buildx yoksa kullandığın Docker dağıtımına uygun CLI plugin'ini kur; Ubuntu için Docker'ın [resmî kurulum yönergesi](https://docs.docker.com/engine/install/ubuntu/) `docker-buildx-plugin` paketini belgeler. Mevcut Docker Engine'i otomatik kaldırıp değiştirme. Çalışma ağacı temiz olmalı ve tag mevcut `HEAD` commit'ini göstermelidir:

```bash
git status --short
git tag -a vX.Y.Z -m "SELY MiniGame Hub vX.Y.Z"
./scripts/package-release.sh vX.Y.Z --platform linux/amd64 --platform linux/arm64
```

İlk üretimde tek mimari seçilebilir. `linux/arm64` çapraz derlemesi Buildx'in uygun emülasyon/worker desteğini gerektirebilir. Docker imajı Docker exporter ile, standalone dosyaları ise Buildx `local` exporter ile çıkarılır; script mimarileri ayrı build ederek her Release arşivini tek platformda tutar ([Buildx exporters](https://docs.docker.com/build/exporters/)). Betik tag arşivini temiz geçici dizine çıkarır; public release audit, sabitlenmiş pnpm ile install/check/test/build, Rust test suite’i ve Docker/standalone derlemelerini çalıştırır. Çıktıyı GitHub Releases sayfasında taslak olarak açıp dosyaları seçerek yükle; tag ve açıklamayı incelemeden yayımlama. `SHA256SUMS` dosyasını da ekle.

Betiğin mesaj dili `LC_ALL`, `LC_MESSAGES`, `LANG` sırasıyla sistem locale'inden algılanır (`tr*` Türkçe, diğerleri İngilizce); `--lang tr|en` ile seçilebilir. Dosya adları ve komutlar locale'den bağımsızdır.

## Docker Compose ile kurulum

İstenen mimarinin `*-image.tar.gz` ve aynı mimarinin `*-compose.tar.gz` dosyalarını indir. Checksum'u doğrula, Compose paketini ayrı dizine çıkar, image'ı yükle ve ayar dosyasını kopyala:

```bash
sha256sum -c SHA256SUMS
mkdir sely-compose && tar -xzf sely-minigame-hub-vX.Y.Z-linux-amd64-compose.tar.gz -C sely-compose
cd sely-compose
gzip -dc ../sely-minigame-hub-vX.Y.Z-linux-amd64-image.tar.gz | docker load
cp .env.example .env
```

İhtiyaç varsa `.env` içindeki `TURSO_DATABASE_URL` ve `TURSO_AUTH_TOKEN` değerlerini ayarla. Bunlar yoksa Compose named volume içindeki SQLite kullanılır. `REDIS_URL` boşken Compose kendi Redis servisini leaderboard hızlı katmanı olarak bağlar. Ardından:

```bash
docker compose up -d --pull never
docker compose ps
```

Arayüz varsayılan olarak `http://localhost:3000` adresindedir. SQLite ve Redis named volume'ları uygulama yeniden oluşturulsa da korunur; `docker compose down --volumes` bu verileri siler, yedek almadan çalıştırma. Reverse proxy/alan adı için [dağıtım rehberine](DEPLOYMENT.md#alan-adı-ve-reverse-proxy) bak.

## Standalone Linux kurulumu

Mimarine uygun `*-standalone.tar.gz` dosyasını doğrula ve ayrı bir dizine aç. systemd olmadan kullanıcı dizinine kurulum:

```bash
sha256sum -c SHA256SUMS
mkdir sely-standalone && tar -xzf sely-minigame-hub-vX.Y.Z-linux-amd64-standalone.tar.gz -C sely-standalone
cd sely-standalone
./scripts/install-standalone.sh
```

Betik sistem locale'ine göre mesaj verir. Root olarak çalıştırılırsa `/opt/sely-minigame-hub`, normal kullanıcıda `~/.local/opt/sely-minigame-hub` varsayılanıdır. Mevcut veri ve `.env` üzerine yazmaz; ilk kurulumda örnek env oluşturur. `.env`'yi düzenledikten sonra `cd <kurulum-dizini> && ./standalone` ile başlat.

Debian 12+ veya güncel glibc tabanlı Linux'ta isteğe bağlı systemd service:

```bash
sudo ./scripts/install-standalone.sh --systemd
sudoedit /etc/sely-minigame-hub/sely.env
sudo systemctl restart sely-minigame.service
```

Timer unit örnekleri kurulur ama etkinleştirilmez. Bu instance için Vercel Cron kullanılmıyorsa ve `DAILY_JOB_TOKEN` ayarlıysa timer'ları ayrıca etkinleştir. Aynı kurulumda Vercel Cron ve systemd timer'ı birlikte çalıştırma. Windows/macOS için standalone binary yayımlanmaz; Docker veya Vercel/source yolunu seç.

## Vercel serverless

Vercel, hazır standalone/Docker dosyalarını çalıştırmaz; tag'deki kaynak koddan statik Vite istemcisini ve `api/index.rs` Rust function'ını kendi build akışında üretir ([Vercel Rust runtime](https://vercel.com/docs/functions/runtimes/rust)). GitHub repository'sini kendi Vercel hesabına import et veya GitHub'ın kaynak ZIP/tar.gz arşivini indirip CLI ile kendi projenle bağla. `.vercel` ayarları ve credentials release'e dahil değildir.

Vercel Project Settings → Environment Variables alanında kendi ortamın için gerekli değerleri gir; kalıcı leaderboard/günlük içerik için Turso/libSQL gerekir. `CRON_SECRET` Vercel Cron için gizli kalmalıdır. Anahtarları kaynak dosyasına, GitHub Release açıklamasına veya istemciye giden `VITE_*` değerlerine koyma. Kendi projen için CLI:

```bash
pnpm install --frozen-lockfile
vercel link
vercel deploy --prod
```

Bu komutlar yalnız sen kendi hesabında çalıştırdığında deploy eder; `package-release.sh` Vercel CLI çağırmaz. Free/Hobby uygunluğu hesap ve plan limitlerine bağlıdır; üretim öncesi Vercel panelindeki function, cron ve build limitlerini kontrol et.
