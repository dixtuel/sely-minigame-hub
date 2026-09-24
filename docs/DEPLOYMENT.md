# Kurulum ve dağıtım

Önce yöntemi seç, sonra yalnızca o bölümdeki adımları uygula. Hazır Linux paketleri [GitHub Releases](https://github.com/dixtuel/sely-minigame-hub/releases/latest) sayfasındadır.

| Yöntem           | Ne zaman seçilir?                              | Veri                                   |
| ---------------- | ---------------------------------------------- | -------------------------------------- |
| Vercel           | GitHub üzerinden serverless yayın              | Kalıcı veri için Turso/libSQL          |
| Docker Compose   | VPS veya Docker sunucusu                       | SQLite volume; Redis Compose ile gelir |
| Standalone Linux | Binary'yi doğrudan veya systemd ile çalıştırma | Yerel SQLite veya Turso                |

## Vercel

1. GitHub deposunu kendi Vercel hesabına import et.
2. Project Settings → Environment Variables bölümünde kalıcı veri için TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN; günlük görevleri doğrulamak için rastgele CRON_SECRET tanımla.
3. Deploy et ve siteyi, /api/config endpoint'ini ve deployment loglarını kontrol et.

Proje, Vercel Rust Function'ını api/index.rs üzerinden kullanır. Rust runtime'ın güncel durumu için [Vercel dokümanına](https://vercel.com/docs/functions/runtimes/rust) bak.

vercel.json günlük içerik üretimi ve eski kayıt temizliği için günde birer cron tanımlar. Hobby planında her cron günde bir kez çalışabilir; tetikleme dakikası garanti edilmez, seçilen saat içinde çalışabilir. Ayrıntı: [Hobby Cron sınırları](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Turso/libSQL tanımlanmazsa Vercel'de skor ve günlük kayıtlar kalıcı olmaz. Bu kurulum yalnızca kendi Vercel projen içindir, sely.tr projesini değiştirmez.

## Docker Compose

### Hazır release paketi

Aynı sürümün linux-amd64 image, compose ve SHA256SUMS dosyalarını indir. Örnekte TAG değerini kullanacağın release ile eşleştir:

    TAG=v2.0.0
    ASSET="sely-minigame-hub-$TAG-linux-amd64"

    grep -E "$ASSET-(image|compose)\.tar\.gz$" SHA256SUMS | sha256sum -c -
    mkdir sely-compose
    tar -xzf "$ASSET-compose.tar.gz" -C sely-compose
    gzip -dc "$ASSET-image.tar.gz" | docker load
    cd sely-compose
    cp .env.example .env
    docker compose up -d --pull never

Uygulama varsayılan olarak [localhost:3000](http://localhost:3000) adresinde açılır. Veriler Docker volume'larında saklanır. docker compose down --volumes komutu bu verileri siler.

### Kaynaktan build

Repo kökünde Docker Engine ve Compose eklentisi kurulu olmalı:

    cp .env.example .env
    docker compose --env-file .env -f docker/docker-compose.yml up --build -d

## Standalone Linux

linux-amd64 standalone arşivini ve SHA256SUMS dosyasını indir:

    TAG=v2.0.0
    ASSET="sely-minigame-hub-$TAG-linux-amd64"

    grep -E "$ASSET-standalone\.tar\.gz$" SHA256SUMS | sha256sum -c -
    mkdir sely-standalone
    tar -xzf "$ASSET-standalone.tar.gz" -C sely-standalone
    cd sely-standalone
    ./scripts/install-standalone.sh

Kurulum normal kullanıcıda ~/.local/opt/sely-minigame-hub altına yapılır. systemd istersen aynı arşivden sudo ./scripts/install-standalone.sh --systemd çalıştır; ortam ayarları /etc/sely-minigame-hub/sely.env dosyasındadır. Timer'lar otomatik açılmaz. Tam notlar: [standalone paket rehberi](standalone-release-README.md).

## Veri ve ayarlar

Tüm değişkenler [.env.example](../.env.example) dosyasında açıklanır.

- Standalone ve Docker varsayılan olarak yerel SQLite kullanır; Docker veritabanını volume'da saklar.
- Vercel'de kalıcı skor ve günlük kayıtlar için Turso/libSQL gerekir. PostgreSQL ve genel DATABASE_URL desteklenmez.
- Redis isteğe bağlı ve leaderboard için kısa ömürlü hız katmanıdır; kalıcı veritabanı değildir. Compose kendi Redis servisini başlatır.
- CRON_SECRET Vercel, DAILY_JOB_TOKEN self-host günlük görevleri içindir. Aynı instance'ta Vercel Cron ve systemd timer'ı birlikte etkinleştirme.
- PRIMARY_DOMAIN boşken uygulama gelen host'u kullanır; sely.tr'ye yönlendirme yapmaz. Reverse proxy'de Host ve X-Forwarded-Proto başlıklarını ilet.

Dış Vaka LLM anahtarları isteğe bağlıdır. Ayarlanmaz veya servis hata verirse yerel oyun motoru kullanılabilir.
