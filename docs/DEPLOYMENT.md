# Kurulum

VPS için Docker Compose en kısa yoldur. [GitHub Releases](https://github.com/dixtuel/sely-minigame-hub/releases/latest) sayfasından Linux mimarine uygun `*-docker.tar.gz` dosyasını ve `SHA256SUMS` dosyasını indir. Docker Engine ile Compose eklentisi kurulu olmalı.

## Docker Compose

```bash
sha256sum --check --ignore-missing SHA256SUMS
mkdir sely-docker
tar -xzf sely-minigame-hub-v2.0.2-linux-amd64-docker.tar.gz -C sely-docker
cd sely-docker
./start.sh
```

Örnekteki dosya adını indirdiğin sürüm ve mimariyle eşleştir. `start.sh` ilk çalıştırmada `.env` oluşturur, paket içindeki uygulama image'ını yükler ve servisi başlatır. Harici API anahtarı veya Redis gerekmez; skorlar kalıcı SQLite volume'unda tutulur. Site [localhost:3000](http://localhost:3000) adresinde açılır.

Güncellemede yeni paketi **aynı `sely-docker` dizinine** açıp `./start.sh` komutunu tekrar çalıştır; `.env` ve Docker volume'ları korunur. Öncesinde `sely-data` volume'unun yedeğini al. `docker compose down` servisi durdurur; `--volumes` veri volume'unu da siler.

Kaynaktan Docker build almak istersen:

```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
docker compose up --build -d
```

Kaynak build Rust derlemesi yaptığından hazır pakete göre uzun sürer.

## Standalone Linux

Docker istemiyorsan aynı Release sayfasından `*-standalone.tar.gz` ve `SHA256SUMS` dosyalarını indir:

```bash
sha256sum --check --ignore-missing SHA256SUMS
mkdir sely-standalone
tar -xzf sely-minigame-hub-v2.0.2-linux-amd64-standalone.tar.gz -C sely-standalone
cd sely-standalone
./scripts/install-standalone.sh
~/.local/opt/sely-minigame-hub/standalone
```

Normal kullanıcı kurulumunda uygulama `~/.local/opt/sely-minigame-hub` altına yerleşir; `.env` ve yerel SQLite dosyası güncellemede korunur. systemd istersen `sudo ./scripts/install-standalone.sh --systemd` kullan. Servis ayarları `/etc/sely-minigame-hub/sely.env` dosyasındadır; günlük timer'lar ayrıca etkinleştirilir. Ayrıntı: [standalone paket rehberi](standalone-release-README.md).

## Vercel

1. GitHub deposunu kendi Vercel hesabına import et.
2. Kalıcı skorlar ve günlük içerik için Project Settings → Environment Variables bölümüne `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` ve rastgele bir `CRON_SECRET` ekle.
3. Deploy et; siteyi ve `/api/config` endpoint'ini kontrol et.

Vercel `api/index.rs` Rust Function'ını kaynak koddan derler. Turso ayarlanmazsa sunucu verisi function ömrüyle sınırlı kalır. Günlük cron'lar `vercel.json` içinde tanımlıdır; Hobby planındaki güncel sınırları [Vercel belgelerinden](https://vercel.com/docs/cron-jobs/usage-and-pricing) kontrol et.

## Veri ve ayarlar

Tüm değişkenler [.env.example](../.env.example) dosyasında açıklanır. Self-host varsayılanı yerel SQLite'tır; Redis yalnız leaderboard hız katmanıdır. Vercel'de kalıcılık için Turso/libSQL gerekir; PostgreSQL desteklenmez. `PRIMARY_DOMAIN` boş kalabilir; reverse proxy kullanıyorsan `Host` ve `X-Forwarded-Proto` başlıklarını ilet. Vaka için dış LLM anahtarları isteğe bağlıdır; boşken yerel motor çalışır.
