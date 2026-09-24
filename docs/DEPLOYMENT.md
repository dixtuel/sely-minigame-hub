# Dağıtım ve self-host kurulumu

Bu rehber Vercel, Docker Compose ve standalone Rust kurulumlarını kapsar. İndirilebilir Docker ve standalone release paketlerini elle üretme adımları [release rehberindedir](RELEASING.md). Özet, hızlı başlangıç ve oyun kataloğu için [ana README](../README.md) dosyasına dön.

## Hangi dağıtım?

| Seçenek        | Uygulama                                    | Kalıcı veri                                               | Zamanlanmış görev                                  |
| -------------- | ------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Vercel         | Statik Vite istemcisi + Rust serverless API | Kalıcılık için uzak Turso/libSQL ayarla                   | `vercel.json` içindeki Vercel Cron                 |
| Docker Compose | Rust standalone + Redis container'ı         | SQLite ve Redis named volume'ları                         | systemd timer örneklerini ayrıca çalıştırabilirsin |
| Standalone     | Rust binary + derlenmiş frontend            | Varsayılan yerel SQLite; uzak Turso ve Redis isteğe bağlı | systemd service/timer örnekleri isteğe bağlı       |

Aynı uygulama kopyası için Vercel Cron ile systemd timer'larını birlikte etkinleştirme. Tek bir zamanlayıcı yolunu seç.

## Canlıya çıkış kontrolü

- Production ortamı için kalıcı `TURSO_DATABASE_URL` (ve gerekiyorsa `TURSO_AUTH_TOKEN`) tanımlı.
- Cron kullanılıyorsa rastgele ve gizli `CRON_SECRET` (Vercel) veya `DAILY_JOB_TOKEN` (self-host) ayarlı.
- Yerel SQLite kullanılıyorsa veri dizini kalıcı diskte ve uygulama kullanıcısı tarafından yazılabilir.
- `PRIMARY_DOMAIN` gerekmiyorsa boş bırakılmış; reverse proxy varsa host ve protokol başlıklarını iletiyor.
- Günlük görevler için yalnız tek scheduler etkin; yedekleme yöntemi belirlenmiş.

## Başlamadan önce

- Ön yüz geliştirme için Node.js 22+ ve pnpm 10 gerekir.
- Standalone Rust backend için stable Rust toolchain gerekir.
- Docker Compose için Docker Engine ve Compose eklentisi gerekir.
- Değişkenlerin tam listesi [`.env.example`](../.env.example) dosyasındadır.
- `.env` dosyasına token veya API anahtarı koyarsan onu Git'e ekleme. `VITE_` ile başlayan değerler istemci build'inde görünür olabilir; bunlara gizli anahtar koyma.

## Veritabanı, önbellek ve dış servisler

Rust backend'i libSQL/Turso ve SQLite destekler. `DATABASE_URL` ve `POSTGRES_URL` üzerinden PostgreSQL bağlantısı desteklenmez.

| Ayar                                                    | Etki                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL` + gerekirse `TURSO_AUTH_TOKEN`     | Uzak libSQL/Turso veritabanı. Vercel'de kalıcı skorlar için yapılandırılmalıdır.                                                       |
| `REDIS_URL`                                             | İsteğe bağlı leaderboard hız katmanı; `redis://` self-hosted, `rediss://` TLS endpoint'i için. Redis verileri 24 saatlik TTL kullanır. |
| `GROQ_API_KEY`, `NVIDIA_NIM_API_KEY`, `MISTRAL_API_KEY` | Vaka LLM sağlayıcıları. Bunlar yoksa veya sağlayıcı yanıt vermezse deterministik yerel oyun motoru devam eder.                         |
| `PRIMARY_DOMAIN`                                        | İsteğe bağlı canonical host; protokol eklemeden yalnız host adı girilir.                                                               |

Standalone'da Turso ayarı yoksa `./data/sely.db` kullanılır. Uzak Turso bağlantısı kurulamazsa standalone yerel SQLite'a düşebilir. Vercel'in kalıcı yerel dosya sistemi yoktur; Turso olmadan skorlar yalnız function belleğiyle sınırlı kalabilir. Redis yoksa SQL/SQLite, ardından sınırlı process belleği fallback'i devreye girer. Kalıcı skor kaynağı Redis değildir.

Yerel sunucuda varsayılanlar için sır gerekmez. `.env.example` içindeki örnek URL'ler ve açıklamalar başlangıç noktasıdır; kendi ortamına göre değerleri değiştir.

## Vercel

Repo Vercel'in Rust function'ı ile statik ön yüz için yapılandırılmıştır. `vercel.json` build komutunu (`pnpm run build`), çıktı dizinini (`dist/public`), API yönlendirmesini, function süresini ve zamanlanmış görevleri tanımlar.

1. GitHub deposunu Vercel projesine bağla veya [Vercel ile yeni proje oluştur](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdixtuel%2Fsely-minigame-hub).
2. Project Settings → Environment Variables altında ihtiyacın olan server-side değerleri tanımla. Kalıcı skorlar için `TURSO_DATABASE_URL` ve `TURSO_AUTH_TOKEN`, Cron isteklerini doğrulamak için `CRON_SECRET` ekle.
3. Project'i deploy et ve siteyi, API'yi ve logları kontrol et.

`VITE_` ile başlayan değişkenler frontend build aşamasında istemciye gömülür; bu değişkenler gizli değildir. Vercel'de Production için değişken eklediğinde yeni bir deployment gerekir. Preview ve Production ortamlarının değerlerini ayrı kontrol et.

Günlük Cron yolları `vercel.json` dosyasında tanımlıdır:

| Endpoint                       | Zaman (UTC)   | İş                                               |
| ------------------------------ | ------------- | ------------------------------------------------ |
| `/api/scheduled/daily-content` | Her gün 00:05 | Günlük oyun içeriğini üretir/günceller.          |
| `/api/scheduled/daily-cleanup` | Her gün 00:15 | Eski günlük içerik ve skor kayıtlarını temizler. |

`CRON_SECRET` ayarlıysa endpoint, Vercel Cron'un gönderdiği `Authorization: Bearer <değer>` başlığıyla doğrulanır. Vercel'de yerel SQLite dosyasını kalıcı veri deposu olarak kullanmaya güvenme. Redis eklemek de Turso gereksiniminin yerini almaz.

Build tamamlandıktan sonra tarayıcıdan uygulamayı ve `https://alan-adin.example/api/config` adresini kontrol et. Zamanlanmış job'ların çalışması Vercel Cron yapılandırmasına ve gerekli token'ın tanımlı olmasına bağlıdır.

## Docker Compose

Compose dosyası Rust uygulamasını ve Redis 7 servisini başlatır. Varsayılan yapılandırmada SQLite ve Redis kendi named volume'larında saklanır.

Repo kökünde:

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build -d
docker compose -f docker/docker-compose.yml ps
```

Port varsayılanı host üzerinde 3000'dir; `.env` dosyasındaki `PORT` ile host portunu değiştirebilirsin. SQLite verisi uygulama container'ında `/app/data/sely.db`, Redis verisi Redis volume'unda tutulur. İstersen `TURSO_DATABASE_URL` ve `REDIS_URL` ile uzak servisleri kullan.

İlk açılış ve güncellemeden sonra `http://sunucu-adresi:3000/api/config` endpoint'inin yanıt verdiğini ve ana sayfanın yüklendiğini doğrula. Reverse proxy kullanıyorsan uygulamanın portunu doğrudan internete açmak yerine yalnız proxy üzerinden yayınla.

Yaygın bakım komutları:

```bash
docker compose -f docker/docker-compose.yml logs -f sely-hub
docker compose -f docker/docker-compose.yml up --build -d
docker compose -f docker/docker-compose.yml stop
```

`docker compose down` container ve ağı kaldırır ama named volume'ları korur. `down -v` ise SQLite ve Redis volume'larını da siler; yalnız verileri bilerek sıfırlamak istediğinde kullan. İmaj, port, volume ve health check tanımları [Compose dosyasında](../docker/docker-compose.yml) ve [Dockerfile'da](../docker/Dockerfile) tutulur.

## Standalone ve systemd

Standalone aynı origin üzerinden derlenmiş frontend'i ve API route'larını sunar. Gerekli araçlar: Node.js 22+, pnpm 10 ve stable Rust.

Repo kökünde:

```bash
pnpm install --frozen-lockfile
pnpm run build
cargo build --release --bin standalone
```

Geliştirme sunucusunda repo kökünden `./target/release/standalone` başlatılabilir. Varsayılan port 3000'dir; `PORT` ile değiştirilir. SQLite kullanıyorsan çalışma dizininde `data/` dizininin uygulama kullanıcısı tarafından yazılabilir olması gerekir.

### systemd ile sürekli çalıştırma

Aşağıdaki örnek `/opt/sely-minigame-hub` kurulum yolunu kullanır. Servis dosyası aynı çalışma dizini ile `data/` yazma alanını bekler. Başka yol kullanıyorsan `systemd/sely-minigame.service` içindeki `WorkingDirectory` ve `ReadWritePaths` değerlerini de düzenle. `sely` sistem kullanıcısı zaten varsa ilk komutu atla.

```bash
sudo useradd --system --user-group --home-dir /opt/sely-minigame-hub --shell /usr/sbin/nologin sely
sudo install -d -o sely -g sely -m 0750 /opt/sely-minigame-hub/data /opt/sely-minigame-hub/dist/public
sudo install -o sely -g sely -m 0750 target/release/standalone /opt/sely-minigame-hub/standalone
sudo cp -a dist/public/. /opt/sely-minigame-hub/dist/public/
sudo chown -R sely:sely /opt/sely-minigame-hub
sudo install -d -o root -g sely -m 0750 /etc/sely-minigame-hub
sudo touch /etc/sely-minigame-hub/sely.env
sudo chown root:sely /etc/sely-minigame-hub/sely.env
sudo chmod 0640 /etc/sely-minigame-hub/sely.env
sudoedit /etc/sely-minigame-hub/sely.env
```

Environment dosyasına yalnız kullandığın değerleri `KEY=value` biçiminde ekle. Örnek: `PORT=3000`. Günlük timer kullanacaksan `DAILY_JOB_TOKEN` tanımla; `openssl rand -hex 32` ile güçlü rastgele token üretebilirsin. Örnek dosyanın izinleri root:sely ve 0640 olacak şekilde sınırlandırılmıştır.

Servis ve timer birimlerini yükleyip uygulamayı başlat:

```bash
sudo install -m 0644 systemd/sely-minigame.service systemd/sely-daily-content.service systemd/sely-daily-content.timer systemd/sely-daily-cleanup.service systemd/sely-daily-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sely-minigame.service
systemctl status sely-minigame.service
journalctl -u sely-minigame.service -n 100 --no-pager
```

Güncelleme sırasında servisi durdur, yerel SQLite dosyanı yedekle, yeni `standalone` binary'sini ve `dist/public/` içeriğini aynı dizinlere kopyala, sahiplikleri koruyup servisi tekrar başlat. Canlı SQLite dosyasını uygulama yazarken basit bir dosya kopyasıyla yedekleme; önce servisi durdur veya SQLite'ın tutarlı yedekleme aracını kullan.

### Günlük görev timer'ları

Timer'lar isteğe bağlıdır; yalnız self-host ortamında `DAILY_JOB_TOKEN` ayarlıysa ve aynı instance için Vercel Cron çalışmıyorsa etkinleştir:

```bash
sudo systemctl enable --now sely-daily-content.timer sely-daily-cleanup.timer
systemctl status sely-daily-content.timer sely-daily-cleanup.timer
```

Örnek birimler günlük içeriği 00:05 UTC'de, temizliği 00:15 UTC'de çalıştırır. Bunlar `/api/scheduled/daily-content` ve `/api/scheduled/daily-cleanup` endpoint'lerine `x-sely-cron-token` başlığını gönderir. Token'ı günlük loglara yazma.

## Alan adı ve reverse proxy

Caddy veya Nginx gibi reverse proxy kullanıyorsan upstream'e `Host` ve `X-Forwarded-Proto` başlıklarını ilet. `PRIMARY_DOMAIN` boşsa uygulama gelen request host/protokolünü kullanır; host bilgisi de yoksa mutlak URL üretmez ve `sely.tr` alan adına zorlamaz. Sabit canonical adres gerekiyorsa `PRIMARY_DOMAIN` değerine protokolsüz host adı ver.

## Sorun giderme

| Belirti                                    | Kontrol                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Vercel'de skorlar kalıcı değil             | `TURSO_DATABASE_URL` ve gerekirse `TURSO_AUTH_TOKEN` değerlerinin doğru Vercel ortamında tanımlandığını kontrol et.     |
| Günlük endpoint `403` dönüyor              | Vercel için `CRON_SECRET`; self-host timer için `DAILY_JOB_TOKEN` ve gönderilen başlık eşleşmeli.                       |
| Standalone SQLite açılmıyor                | Servis kullanıcısının çalışma dizini ve `data/` klasöründe yazma izni olduğunu kontrol et.                              |
| Paylaşım/absolute URL yanlış host üretiyor | Reverse proxy'nin `Host` ve `X-Forwarded-Proto` başlıklarını ilettiğini, gerekirse `PRIMARY_DOMAIN` ayarını kontrol et. |

Dağıtım değişikliği öncesinde yerel SQLite dosyasını veya uzak veritabanını yedekle. Uzak Turso/libSQL için yedekleme ve geri yükleme işlemlerini kullandığın sağlayıcının güncel prosedürüne göre yap. Gerçek API anahtarlarını, cron token'larını ve `.env` dosyasını public repoya ekleme.
