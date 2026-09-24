# SELY MiniGame Hub — standalone Linux

Bu paket, release-target dosyasında belirtilen Linux mimarisi için derlenmiş Rust sunucusunu ve web istemcisini içerir. Docker imajı veya Vercel deploy paketi değildir. Kaynak/lisans bilgisi `LICENSE` ve `docs/ATTRIBUTION.md` içindedir.

## İlk kurulum

Linux/glibc makinede arşivi aç ve kurulum betiğini çalıştır:

```bash
tar -xzf sely-minigame-hub-vX.Y.Z-linux-amd64-standalone.tar.gz
cd sely-minigame-hub-vX.Y.Z-linux-amd64-standalone
./scripts/install-standalone.sh
```

Normal kullanıcıda varsayılan konum `~/.local/opt/sely-minigame-hub`, root ile `/opt/sely-minigame-hub` olur. Kurulum `.env` yoksa örnek oluşturur; mevcut `.env` ve SQLite verisini ezmez. Ortam ayarlarını düzenledikten sonra:

```bash
cd ~/.local/opt/sely-minigame-hub
./standalone
```

Root-owned `/opt` kurulumu için `sudo` kullanıyorsan servisi elle root olarak çalıştırmak yerine systemd seçeneğini öneriyoruz:

```bash
sudo ./scripts/install-standalone.sh --systemd
sudoedit /etc/sely-minigame-hub/sely.env
sudo systemctl restart sely-minigame.service
```

SQLite verisi `data/sely.db` altında tutulur; yedeklerini release güncellemesinden önce al. Uzak kalıcılık için `.env`'de Turso/libSQL değerleri kullanılabilir. Redis isteğe bağlı bir leaderboard hızlı katmanıdır; Compose paketiyle birlikte yerel Redis servisi sunulur.

Systemd timer örnekleri kurulum sırasında yerleştirilir ancak etkinleştirilmez. `DAILY_JOB_TOKEN` yapılandırılmışsa ve aynı instance için Vercel Cron çalışmıyorsa `sely-daily-content.timer` ile `sely-daily-cleanup.timer` ayrıca etkinleştirilebilir.
