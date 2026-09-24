# SELY Docker — __RELEASE_TAG__ (linux/__ARCH__)

Docker Engine ve Compose eklentisi gerekir. Bu paket uygulama image'ını, Compose dosyasını ve yerel ayar örneğini içerir.

```sh
./start.sh
```

İlk çalıştırmada `.env` oluşturulur. SQLite verisi Docker volume'unda saklanır; harici veritabanı veya Redis gerekmez. Site `http://localhost:3000` adresinde açılır. Dış servis ve alan adı ayarları isteğe bağlıdır; gerektiğinde `.env` dosyasını düzenleyip `./start.sh` çalıştır.

`docker compose down` uygulamayı durdurur ve verileri korur. Veri silmek istemiyorsan `--volumes` kullanma. Güncelleme öncesi `sely-data` volume'unu yedekle.

Diğer yollar için [kurulum rehberine](https://github.com/dixtuel/sely-minigame-hub/blob/main/docs/DEPLOYMENT.md) bak.
