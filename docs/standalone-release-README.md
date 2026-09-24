# SELY standalone Linux

Bu paket Linux/glibc için hazır sunucu ve web dosyalarını içerir. Arşiv dizininde:

```bash
./install.sh
cd ~/.local/opt/sely-minigame-hub
./standalone
```

Varsayılan adres `http://localhost:3000`. Kurulum `.env` ve `data/sely.db` dosyasını güncellemede korur. Root ve systemd seçeneği için `sudo ./install.sh --systemd` kullan; ayarlar `/etc/sely-minigame-hub/sely.env` içindedir. Veri yedeğini güncellemeden önce al.

Dört kurulum yöntemi, güncelleme ve timer ayrıntıları için [kurulum rehberi](https://github.com/dixtuel/sely-minigame-hub/blob/main/docs/DEPLOYMENT.md).
