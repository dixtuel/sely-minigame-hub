# Kurulum ve dağıtım

SELY dört şekilde çalışır. Hazır release paketleri **Linux amd64** içindir; diğer mimariler için kaynaktan build alın. Tüm self-host kurulumları varsayılan olarak yerel SQLite kullanır. Redis ve dış LLM anahtarları isteğe bağlıdır.

| Yol | Gerekenler | İlk komut | Veri |
| --- | --- | --- | --- |
| [Hazır Docker paketi](#hazır-docker-paketi) | Docker Engine + Compose | `./start.sh` | Docker volume içinde SQLite |
| [Hazır standalone paketi](#hazır-standalone-paketi) | Linux amd64, glibc 2.34+ | `./install.sh` | Kurulum dizininde SQLite |
| [Kaynaktan](#kaynaktan-kurulum) | Git + Docker **veya** Node.js/pnpm + Rust | `docker compose up -d --build` **veya** `pnpm start` | Yerel SQLite |
| [Vercel](#vercel) | Vercel hesabı; kalıcılık için Turso | Git import → Deploy | Turso/libSQL |

## Hazır paketleri indirme ve doğrulama

[Releases](https://github.com/dixtuel/sely-minigame-hub/releases/latest) sayfasından kendi yoluna ait arşivi ve `SHA256SUMS` dosyasını **aynı dizine** indir. Yeni release'lerde dosya adları `sely-linux-amd64-docker.tar.gz` ve `sely-linux-amd64-standalone.tar.gz` biçimindedir. Önceki `v2.0.2` release'inde daha uzun `sely-minigame-hub-v2.0.2-linux-amd64-*.tar.gz` adları kullanıldı; indirdiğin gerçek adı komutta kullan.

```bash
sha256sum -c --ignore-missing SHA256SUMS
```

Bu komut yalnız indirilen arşivi doğrular. İki arşivi de indirdiysen `sha256sum -c SHA256SUMS` ile ikisini birden denetle. Dosya adını wildcard ile tahmin etmek yerine indirdiğin dosyanın tam adını yaz.

## Hazır Docker paketi

```bash
mkdir sely-docker
# Aşağıdaki arşiv adını indirdiğin dosyayla değiştir.
tar -xzf sely-linux-amd64-docker.tar.gz -C sely-docker
cd sely-docker
./start.sh
```

`start.sh` ilk açılışta `.env` oluşturur, paketteki image'ı yükler ve Compose servisini başlatır. [http://localhost:3000](http://localhost:3000) ve `/api/config` adresini kontrol et. Image için registry hesabı veya internetten image çekme gerekmez. Veriler `sely-data` volume'unda kalır.

Güncellemek için **aynı dizindeki** `sely-data` volume'unu yedekle, yeni arşivi bu dizine aç ve `./start.sh` çalıştır. Dizin/Compose proje adını değiştirmek yeni volume oluşturabilir. `docker compose down` veriyi korur; `down --volumes` veriyi siler. `.env` güncellemede korunur.

## Hazır standalone paketi

```bash
mkdir sely-standalone
# Aşağıdaki arşiv adını indirdiğin dosyayla değiştir.
tar -xzf sely-linux-amd64-standalone.tar.gz -C sely-standalone
cd sely-standalone
./install.sh
cd ~/.local/opt/sely-minigame-hub
./standalone
```

Hazır binary için glibc 2.34+ ve `libgcc_s` gerekir; Docker, Node.js veya Rust kurulumu gerekmez. Daha eski dağıtımda kaynaktan build al. Normal kullanıcı kurulumu `~/.local/opt/sely-minigame-hub` dizinine yapılır. `.env` ve `data/sely.db` korunur; güncellemeden önce veritabanını yedekle. Varsayılan port 3000'dir. Kurulum olmadan denemek istersen arşiv dizininde doğrudan `./standalone` çalıştırabilirsin; uygulama `dist/public` ve yazılabilir `data/` dizinini çalışma dizinine göre bulur.

Sistem servisi istersen `sudo ./install.sh --systemd` kullan. Bu, `/opt/sely-minigame-hub` konumunu, `sely` kullanıcısını ve `sely-minigame.service` birimini kurar. Ayarlar `/etc/sely-minigame-hub/sely.env` dosyasındadır; değişiklikten sonra `sudo systemctl restart sely-minigame.service` çalıştır. Günlük içerik/temizlik timer'ları varsayılan olarak kapalıdır. Etkinleştirmek için `DAILY_JOB_TOKEN` ayarla, ardından `sudo systemctl enable --now sely-daily-content.timer sely-daily-cleanup.timer` çalıştır. Aynı instance için başka bir zamanlayıcı da çalıştırma.

## Kaynaktan kurulum

```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
```

Docker ile kaynak build:

```bash
docker compose up -d --build
docker compose ps
```

Bu yol da varsayılan olarak SQLite kullanır. Yerel Redis gerekiyorsa `.env` içine `REDIS_URL=redis://redis:6379` koyup `docker compose --profile redis up -d --build` çalıştır. Sonraki güncellemelerde `git pull --ff-only` ve aynı Compose komutunu tekrarla.

Docker olmadan kaynak build için Node.js 22+, Corepack/pnpm 10.34.5, stable Rust ve sistem build bağımlılıkları gerekir:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build
cargo build --release --locked --bin standalone
./target/release/standalone
```

Geliştirme için `pnpm dev` yalnız Vite arayüzünü açar; tam sunucu için yukarıdaki build'i veya `pnpm start` komutunu kullan. `pnpm start` Rust release binary'sini gerekirse yeniden derler. `git pull --ff-only` sonrası frontend ve Rust build'i tekrar çalıştır.

## Vercel

1. Repoyu kendi GitHub hesabına fork edip Vercel'de **Import Git Repository** ile aç.
2. Projenin Environment Variables bölümüne `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` ve rastgele üretilmiş `CRON_SECRET` ekle. Kalıcı skorlar/günlük içerik için Turso gereklidir; serverless dosya sistemi kalıcı değildir.
3. Deploy et. Vercel `pnpm run build` ile frontend'i, `api/index.rs` ile Rust Function'ı derler. Siteyi ve `/api/config` endpoint'ini kontrol et.

`vercel.json` günlük iki cron tanımlar; cron yalnız production deployment'ta çalışır. Vercel `CRON_SECRET` değerini çağrıda Bearer header olarak gönderir. Hobby planında her cron günde en çok bir kez çalışır ve tetikleme saati aynı saat içinde kayabilir; mevcut ifadeler bu sınıra uygundur. [Vercel Cron sınırları](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [Cron güvenliği](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Git ile import edilen kendi projen her push'ta otomatik deploy eder; `sely.tr` üzerindeki mevcut canlı proje ise VDS'ten Vercel CLI ile yönetilir.

## Ayarlar ve kontrol

`.env.example` tüm değişkenleri açıklar. `PRIMARY_DOMAIN` boş bırakılabilir. Reverse proxy kullanıyorsan `Host` ve `X-Forwarded-Proto` başlıklarını ilet. PostgreSQL `DATABASE_URL` bu Rust backend'inde desteklenmez. Vaka API anahtarları boşken yerel motorla çalışır.
