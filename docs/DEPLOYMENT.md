# Dağıtım ve self-host

Bu belge güncel `main` dalındaki Rust uygulaması içindir. Vercel serverless, Docker Compose ve standalone Linux seçeneklerini kapsar. Hazır release arşivlerinin elle üretilmesi [release rehberinde](RELEASING.md), arşivden kurulum ise [standalone paket notlarında](standalone-release-README.md) anlatılır.

## Hangi dağıtım?

| Seçenek           | Uygulama                                             | Kalıcılık                                                   | Zamanlanmış görev                      |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| Vercel serverless | Statik Vite çıktısı + Rust Function (`api/index.rs`) | Kalıcı veri için uzak Turso/libSQL yapılandır               | `vercel.json` içindeki iki günlük Cron |
| Docker Compose    | Rust standalone + yerel Redis container              | Yerel SQLite ve Redis named volume; isteğe bağlı uzak Turso | İsteğe bağlı systemd timer             |
| Standalone Linux  | Rust binary + derlenmiş frontend                     | Yerel SQLite; isteğe bağlı Turso ve Redis                   | İsteğe bağlı systemd timer             |

Aynı SELY instance'ı için Vercel Cron ile systemd timer'larını birlikte etkinleştirme. İki yol da aynı günlük endpoint'leri çalıştırır.

## Ön koşullar

- Kaynak build: Node.js 22+, Corepack/pnpm 10.34.5 ve stable Rust.
- Docker: Docker Engine ve Compose eklentisi.
- Release binary: arşivdeki `install-standalone.sh` betiği; dışarıdan Node.js/Rust kurmak gerekmez.
- Linux release arşivleri yalnız kendi dosya adında belirtilen mimaride çalışır.
- Değişkenlerin tam açıklaması [`.env.example`](../.env.example) içindedir. `VITE_*` değerleri istemci build'ine girebilir; bunlara gizli anahtar koyma.

## Veritabanı ve fallback davranışı

Rust backend SQL için libSQL/SQLite kullanır. PostgreSQL ve genel `DATABASE_URL` bağlantısı desteklenmez.

| Yapılandırma                                            | Davranış                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL` ve gerektiğinde `TURSO_AUTH_TOKEN` | Uzak kalıcı Turso/libSQL primary store.                                                                              |
| Turso ayarı olmayan standalone/Docker                   | `./data/sely.db` içindeki yerel SQLite. Docker'da bu yol named volume'a bağlıdır.                                    |
| Redis için `REDIS_URL`                                  | İsteğe bağlı, 24 saatlik leaderboard hızlı katmanı. Kalıcı skor kaynağı değildir.                                    |
| Redis ayarı olmayan self-host                           | Leaderboard önce SQL/SQLite kullanır; kullanılabilir kalıcı store da yoksa process belleği fallback'i devreye girer. |
| Turso ayarı olmayan Vercel                              | Function'ın yerel diski kullanılmaz; server-side skor/günlük içerik kalıcı olmaz ve invocation belleğine düşebilir.  |

Standalone'da uzak Turso başta erişilemiyorsa uygulama yerel SQLite'a düşebilir. Veritabanı yedeğini, kendi SQLite/Turso sağlayıcının prosedürüne göre ayrıca planla. Vercel için local SQLite fallback'i yoktur.

## Ortak ayarlar

- `PRIMARY_DOMAIN` isteğe bağlıdır. Boşken uygulama request host/protokol başlıklarını kullanır; başlıklar da yoksa mutlak URL üretmez ve `sely.tr`'ye düşmez.
- `GROQ_API_KEY`, `NVIDIA_NIM_API_KEY`, `MISTRAL_API_KEY` Vaka oyununun isteğe bağlı sağlayıcılarıdır. Anahtar tanımlanmazsa veya sağlayıcı başarısız olursa yerel oyun motoru kullanılır.
- `CRON_SECRET` Vercel Cron'un `Authorization: Bearer <secret>` başlığıyla; `DAILY_JOB_TOKEN` self-host timer'larının `x-sely-cron-token` başlığıyla kullanılır. Bunları public repoya koyma.
- Yerel varsayılanları denemek için API anahtarı zorunlu değildir. Canlı leaderboard/günlük kayıtlarını kalıcı tutmak için doğru ortamda Turso/libSQL ayarla.

## Vercel serverless

Vercel statik Vite çıktısını CDN'den, Rust/Axum API'sini `api/index.rs` üzerinden Function olarak sunar. Proje `vercel.json` ile `dist/public` çıktısını, `fra1` bölgesini, Function süresini, yönlendirmeleri ve günlük Cron tanımlarını belirler. Vercel'in [Rust runtime dokümanı](https://vercel.com/docs/functions/runtimes/rust) runtime'ı beta olarak tanımlar; yeni projede Vercel panelindeki güncel runtime/plan desteğini doğrula.

1. [GitHub deposunu](https://github.com/dixtuel/sely-minigame-hub) kendi Vercel hesabına import et.
2. Project Settings → Environment Variables altında kalıcı veri için `TURSO_DATABASE_URL` ve `TURSO_AUTH_TOKEN`; günlük görevleri doğrulamak için rastgele `CRON_SECRET` tanımla.
3. İhtiyacın varsa Vaka sağlayıcı anahtarları ve diğer server-side ayarları ekle. `VITE_*` ile başlayan değişkenlere secret koyma.
4. Vercel'in normal build/deploy akışını çalıştır; API, statik sayfalar ve cron endpoint'lerini deployment loglarında kontrol et.

Günlük endpoint'ler `vercel.json` içinde tanımlıdır:

| Endpoint                       | Cron ifadesi | Görevi                                   |
| ------------------------------ | ------------ | ---------------------------------------- |
| `/api/scheduled/daily-content` | `5 0 * * *`  | Günlük oyun içeriğini üretir/günceller.  |
| `/api/scheduled/daily-cleanup` | `15 0 * * *` | Eski günlük içerik ve skorları temizler. |

Bu iki job da günde bir kez çalışacak şekilde tanımlıdır. Vercel Hobby planı günlük Cron kullanımına izin verir; ancak Hobby'de tetikleme dakikası kesin değildir ve job seçilen saat içinde kayabilir. Kesin çalıştırma dakikası gerekiyorsa bu plana güvenme. Güncel sınırlar için [Vercel Cron fiyatlandırma/sınırları](https://vercel.com/docs/cron-jobs/usage-and-pricing) ve [yönetim notlarına](https://vercel.com/docs/cron-jobs/manage-cron-jobs) bak. `CRON_SECRET` tanımlı değilse cron çağrısının kimlik doğrulaması beklenen secret ile eşleşmeyebilir; endpoint'leri el ile herkese açık bırakma.

Vercel'de `TURSO_DATABASE_URL` olmadan SQLite dosyası kalıcı veri deposu değildir. Redis tek başına kalıcı DB yerine geçmez. Ortam değişkenlerini ekledikten/değiştirdikten sonra yeni deployment oluştur ve `/api/config`, oyun kaydı ve leaderboard akışını kontrol et. Bu adımlar yalnızca senin Vercel projen için geçerlidir; `sely.tr` projesini değiştirmez.

## Docker Compose

### Kaynak koddan

Repo kök dizininde:

```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
cp .env.example .env
docker compose --env-file .env -f docker/docker-compose.yml up --build -d
docker compose --env-file .env -f docker/docker-compose.yml ps
```

Compose Rust uygulamasını ve Redis 7 servisini kurar. SQLite `/app/data/sely.db` altında named volume'da; Redis kendi named volume'unda saklanır. Varsayılan host portu 3000; `.env` içindeki `PORT` ile değiştirilebilir. İsteğe bağlı olarak `TURSO_DATABASE_URL` ve `TURSO_AUTH_TOKEN` ver. Boş `REDIS_URL` için Compose kendi Redis servisini bağlar.

Kurulumdan sonra `http://localhost:3000/api/config` ve ana sayfayı açarak kontrol et. Yayın sunucusunda uygulama portunu doğrudan internete açmak yerine reverse proxy kullan. Log ve güncelleme komutları:

```bash
docker compose --env-file .env -f docker/docker-compose.yml logs -f sely-hub
docker compose --env-file .env -f docker/docker-compose.yml up --build -d
docker compose --env-file .env -f docker/docker-compose.yml stop
```

`docker compose down` container'ları kaldırır, named volume'ları korur. `down --volumes` SQLite ve Redis verisini siler; sadece bilerek sıfırlamak istediğinde kullan.

### GitHub Release image'ı

[GitHub Releases](https://github.com/dixtuel/sely-minigame-hub/releases/latest) sayfasından mimariye uygun `image` ve `compose` arşivlerini, ayrıca `SHA256SUMS` dosyasını indir. Checksum'u doğrula, Compose arşivini aç, image'ı `docker load` ile yükle, `.env.example` dosyasını `.env` olarak kopyala ve `docker compose up -d --pull never` çalıştır. Tam komutlar ana [README Kurulum](../README.md#kurulum) bölümünde bulunur.

## Standalone ve systemd

### Release binary ile

Release arşivindeki `scripts/install-standalone.sh` kurulumu sistem locale'ine göre mesajlandırır; Linux paketi kendi hedef mimarisini kontrol eder. Normal kullanıcı kurulumu `~/.local/opt/sely-minigame-hub` altındadır. systemd seçeneği `/opt/sely-minigame-hub` dizinine kurar, `sely` servis kullanıcısını oluşturur ve servisi başlatır:

```bash
./scripts/install-standalone.sh
# veya, arşiv dizininden:
sudo ./scripts/install-standalone.sh --systemd
```

İlk kurulumda normal kullanıcı için kurulum dizinindeki `.env`, systemd için `/etc/sely-minigame-hub/sely.env` düzenlenir. systemd servis durumu ve logları:

```bash
sudo systemctl status sely-minigame.service --no-pager
sudo journalctl -u sely-minigame.service -n 100 --no-pager
```

Script mevcut `.env` ve SQLite verisini ezmez. Güncellemeden önce SQLite yedeği al; canlı DB'yi uygulama yazarken tutarsız dosya kopyasıyla yedekleme.

### Kaynak koddan

Node.js 22+, pnpm 10.34.5 ve stable Rust kurulu repo kökünde:

```bash
pnpm install --frozen-lockfile
pnpm run build
cargo build --release --bin standalone
./target/release/standalone
```

Derlenmiş ön yüz `dist/public` içinden sunulur. Varsayılan port 3000'dir (`PORT` ile değiştirilebilir). Yerel SQLite için çalışma dizininde `data/` oluşturup uygulama kullanıcısına yazma izni ver.

### Günlük systemd timer'ları

Release installer systemd unit ve timer dosyalarını yükler; timer'lar kendiliğinden etkinleşmez. Yalnız aynı instance için Vercel Cron kullanılmıyorsa ve `DAILY_JOB_TOKEN` ayarlıysa etkinleştir:

```bash
sudoedit /etc/sely-minigame-hub/sely.env
sudo systemctl enable --now sely-daily-content.timer sely-daily-cleanup.timer
systemctl list-timers 'sely-*'
```

Timer unit'leri her gün 00:05 UTC'de günlük içeriği, 00:15 UTC'de eski kayıtları işler. Bu systemd takvimidir; Vercel Hobby Cron'daki zamanlama hassasiyetiyle aynı değildir.

## Alan adı ve reverse proxy

Caddy/Nginx gibi proxy'de upstream'in `Host` ve `X-Forwarded-Proto` başlıklarını koru/ilet. `PRIMARY_DOMAIN` boşsa uygulama gelen request bilgisini kullanır; host yoksa absolute URL üretmez ve `sely.tr`'ye zorlamaz. Sabit canonical host istiyorsan protokolsüz host adı gir. HTTPS sertifikasını proxy katmanında yönet.

## Sorun giderme

| Belirti                                       | Kontrol                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Vercel'de skor veya günlük kayıt kalıcı değil | Project'in doğru environment'ında `TURSO_DATABASE_URL` ve gerekirse `TURSO_AUTH_TOKEN` tanımlı mı?               |
| Scheduled endpoint `403` dönüyor              | Vercel için `CRON_SECRET`; self-host için `DAILY_JOB_TOKEN` ile istek başlığı eşleşiyor mu?                      |
| Standalone SQLite açılmıyor                   | `data/` yolu, çalışma dizini ve dosya sahipliği/yazma iznini kontrol et.                                         |
| Docker yeniden başlatınca DB yok              | Named volume aynı Compose projesinde mi; daha önce `down --volumes` çalıştırıldı mı?                             |
| Paylaşım URL'si yanlış host üretiyor          | Proxy'nin `Host` ve `X-Forwarded-Proto` başlıklarını ilettiğini, gerekirse `PRIMARY_DOMAIN` değerini kontrol et. |

Gerçek API key, cron token veya `.env` dosyasını Git'e ya da public release'e ekleme. Güvenlik bildirimi için [SECURITY.md](../SECURITY.md) yolunu kullan.
