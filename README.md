<div align="center">

<img src="client/public/assets/logo-mark.png" width="88" alt="SELY simgesi">

# SELY.TR — MiniGame Hub

**Tarayıcıda oynanan 17 kısa oyun. Günlük seçki, masaüstü ve mobil kontroller; Türkçe ve İngilizce.**

[![Canlı demo](https://img.shields.io/badge/canl%C4%B1_demo-sely.tr-F38020?style=flat-square&logo=vercel&logoColor=white)](https://sely.tr)
[![Sürüm](https://img.shields.io/github/v/release/dixtuel/sely-minigame-hub?style=flat-square)](https://github.com/dixtuel/sely-minigame-hub/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/dixtuel/sely-minigame-hub/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/dixtuel/sely-minigame-hub/actions/workflows/ci.yml)
[![Lisans](https://img.shields.io/badge/lisans-AGPL--3.0-blue?style=flat-square)](LICENSE)

[**Canlı demoyu aç**](https://sely.tr) · [**Oyunlar**](#oyun-kataloğu) · [**Kurulum**](#kurulum) · [**Dağıtım rehberi**](docs/DEPLOYMENT.md) · [**Atıflar**](docs/ATTRIBUTION.md)

</div>

## SELY nedir?

SELY, kısa oyun oturumlarını tek bir web kataloğunda bir araya getiren açık kaynaklı bir mini oyun platformudur. Günlük seçkiyle öne çıkan oyunları oynayabilir veya kataloğun tamamından seçim yapabilirsin. Arayüz telefon ve masaüstü ekranlarına uyum sağlar.

Oyun türüne göre klavye, fare, dokunma, kaydırma ve sürükleme kontrolleri kullanılır. Skor, ustalık ve oyun sonu akışları ortak platform özellikleriyle çalışır; her oyunun kendi mekaniği ve görsel alanı vardır.

### Öne çıkanlar

- 3D keşif, arcade, mantık ve bulmaca türlerinde 17 oyun.
- Bazı oyunlarda yeni oturumlar için seed tabanlı seviye/içerik üretimi ve oyuna özgü doğrulamalar.
- Masaüstü ve dokunmatik cihazlar için farklı oyun kontrolleri.
- Ortak skor tablosu, ustalık ve paylaşım akışları.
- Türkçe ve İngilizce arayüz.

## Oyun kataloğu

| Oyun                      | Oynanış                                             |
| ------------------------- | --------------------------------------------------- |
| Yankı Odası (Echo Room)   | 3D labirentte yankıları izleyerek çıkışı bul.       |
| Vaka (Case)               | İfadeleri kanıtlarla karşılaştırıp vakayı çöz.      |
| Dörtyol (Tetris)          | Blokları yerleştir ve satırları temizle.            |
| Kıvılcım (Spark)          | Kıvılcımı havada tutup engellerin arasından geçir.  |
| Düğüm (Knot)              | Karoları çevirip kaynaktan hedefe akış kur.         |
| Kırpık (Cutout)           | Hareketli şekilleri tek çizgiyle kes.               |
| Gölge Payı (Shadow Share) | Gecikmeli gölgeni doğru zaman ve konuma eşle.       |
| Hane                      | Sayı veya kelime kaydındaki ipuçlarını çıkar.       |
| Göktaşı (Asteroids)       | Gemiyi yönlendirip asteroitlerden kaç.              |
| İstif (Sokoban)           | Kutuları iterek hedeflere ulaştır.                  |
| İniş (Lander)             | İtki ve eğimi ayarlayıp piste güvenle in.           |
| Şebeke (Lights Out)       | Hücreleri değiştirerek tahtadaki ışıkları söndür.   |
| Kare 2048                 | Sayıları kaydırıp birleştirerek 2048'e ulaş.        |
| Coil                      | Yılanı büyütürken duvardan ve kuyruğundan kaç.      |
| Apex                      | Otoyol trafiğinde hızını ayarla ve yakın geçiş yap. |
| Lift                      | Hareketli platformlardan düşmeden yüksel.           |
| Breakline                 | Topu oyunda tutup tuğla dizisini kır.               |

Oyunların adları, türleri ve yerelleştirilmiş açıklamaları [katalog kaynağında](client/src/lib/catalog.ts) tutulur.

## Kurulum

Hazır paketler için [GitHub Releases](https://github.com/dixtuel/sely-minigame-hub/releases/latest) sayfasını kullan. Şu an yayımlanan Linux paketleri `amd64` (x86-64) içindir. ARM veya başka bir hedefte kaynaktan derleyebilir ya da kendi mimarin için Docker imajı oluşturabilirsin.

### Docker Compose

Release sayfasından aynı mimariye ait `*-linux-amd64-image.tar.gz`, `*-linux-amd64-compose.tar.gz` ve `SHA256SUMS` dosyalarını indirip aynı dizine koy. Aşağıdaki örnek `v2.0.0` sürümünü kullanır:

```bash
TAG=v2.0.0
ASSET="sely-minigame-hub-${TAG}-linux-amd64"

grep -E "${ASSET}-(image|compose)\.tar\.gz$" SHA256SUMS | sha256sum -c -
mkdir -p sely-compose
tar -xzf "${ASSET}-compose.tar.gz" -C sely-compose
gzip -dc "${ASSET}-image.tar.gz" | docker load
cd sely-compose
cp .env.example .env
docker compose up -d --pull never
```

Uygulama varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde açılır. Compose paketi uygulama, Redis ve kalıcı SQLite/Redis volume'larını içerir. Turso/libSQL kullanacaksan `.env` dosyasını düzenle. Veriyi silmemek için `docker compose down --volumes` çalıştırma.

### Standalone Linux

Release sayfasından `*-linux-amd64-standalone.tar.gz` ve `SHA256SUMS` dosyalarını indir. Arşivi açıp kurulum betiğini çalıştır:

```bash
TAG=v2.0.0
ASSET="sely-minigame-hub-${TAG}-linux-amd64"

grep -E "${ASSET}-standalone\.tar\.gz$" SHA256SUMS | sha256sum -c -
mkdir -p sely-standalone
tar -xzf "${ASSET}-standalone.tar.gz" -C sely-standalone
cd sely-standalone
./scripts/install-standalone.sh
```

Normal kullanıcı kurulumu `~/.local/opt/sely-minigame-hub` altına yapılır. `.env` dosyasını düzenledikten sonra oradaki `./standalone` dosyasını çalıştır. systemd service seçeneği kurulum betiğiyle eklenebilir:

```bash
sudo ./scripts/install-standalone.sh --systemd
sudoedit /etc/sely-minigame-hub/sely.env
sudo systemctl restart sely-minigame.service
```

systemd timer örnekleri varsayılan olarak etkin değildir. Ayrıntılar ve güncelleme notları [standalone paket rehberinde](docs/standalone-release-README.md).

### Vercel serverless

Vercel için Docker veya standalone arşivini değil, GitHub deposunu kendi Vercel projen olarak import et. Kalıcı skor ve günlük içerik için project environment variables bölümünde Turso/libSQL bağlantısını; günlük görevler için `CRON_SECRET` değerini tanımla. Bu kurulum yalnızca kendi Vercel projen üzerinde çalışır; `sely.tr` canlı sitesini değiştirmez.

Vercel Hobby planındaki Cron zamanlaması dakika hassasiyetinde garanti edilmez; ayrıntılar [dağıtım rehberinde](docs/DEPLOYMENT.md#vercel-serverless).

## Geliştirme

### Gereksinimler

- Node.js 22 veya üzeri ve Corepack ile `package.json` içinde sabitlenmiş pnpm 10.34.5.
- Kaynak koddan Rust backend'i derlemek/çalıştırmak için stable Rust toolchain.
- Docker Compose kullanacaksan Docker Engine ve Compose eklentisi.

### Hızlı başlangıç

```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Vite geliştirme sunucusu arayüzü [http://localhost:5173](http://localhost:5173) adresinde açar; bu komut tek başına Rust API'sini başlatmaz. Derlenmiş istemciyi standalone Rust sunucuyla birlikte çalıştırmak için:

```bash
pnpm run build
pnpm start
```

Standalone sunucu varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde dinler ve yerel SQLite verisini çalışma dizinindeki `data/sely.db` dosyasında tutar.

### Kontroller

```bash
pnpm run check
pnpm test
pnpm run audit:public
pnpm run build
cargo check --bin standalone --bin index
cargo test --lib
```

Paylaşılan Rust oyun çekirdeği değiştiğinde takip edilen WASM çıktısını `pnpm run build:wasm` ile yeniden üretip değişiklikle birlikte kontrol et.

## Mimari

| Katman                    | Teknoloji ve sorumluluk                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Web istemcisi             | React 19, TypeScript, Vite 7; Canvas, Web Audio ve Babylon.js tabanlı oyunlar.           |
| Paylaşılan oyun çekirdeği | Rust `crates/sely-game-core`; bazı oyun mantıkları tarayıcıda WASM olarak çalışır.       |
| Backend                   | Rust, Axum ve Tokio; Vercel Function veya standalone Linux sunucusu.                     |
| Kalıcılık                 | libSQL/Turso veya yerel SQLite; Redis isteğe bağlı, kısa ömürlü leaderboard hız katmanı. |

Backend seçimi, ortam değişkenleri, scheduled job'lar, systemd ve sorun giderme için [dağıtım rehberine](docs/DEPLOYMENT.md); elle release üretmek için [release rehberine](docs/RELEASING.md) bak.

## Yapı ve belgeler

- `client/` — React arayüzü, oyun bileşenleri ve istemci tarafı level generator'ları.
- `src/` — Rust/Axum route'ları, servisler, storage ve oyun mantığı.
- `crates/sely-game-core/` — Rust/WASM ortak çekirdeği.
- `api/` — Vercel Rust Function girişi.
- `docker/`, `systemd/` — self-host yapılandırmaları ve örnek servisler.
- `docs/ATTRIBUTION.md` — üçüncü taraf kod ve asset bildirimleri.

`main` aktif Rust sürümüdür. Önceki Node.js uygulaması [`nodejs-legacy`](https://github.com/dixtuel/sely-minigame-hub/tree/nodejs-legacy) dalında arşivlenmiştir.

## Yapılandırma

Açıklamalı değişkenler [`.env.example`](.env.example) dosyasındadır. Başlıca ayarlar:

| Değişken                                                | Kullanım                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`                | Uzak kalıcı libSQL/Turso veritabanı. Vercel'de sunucu verilerinin kalıcı olması için gerekir. |
| `REDIS_URL`                                             | İsteğe bağlı Redis leaderboard hız katmanı; Compose kendi Redis servisini başlatır.           |
| `CRON_SECRET`, `DAILY_JOB_TOKEN`                        | Vercel Cron veya self-host zamanlayıcısı için görev doğrulaması.                              |
| `PRIMARY_DOMAIN`                                        | İsteğe bağlı canonical host; boşken uygulama gelen host'u kullanır, `sely.tr`'ye zorlamaz.    |
| `GROQ_API_KEY`, `NVIDIA_NIM_API_KEY`, `MISTRAL_API_KEY` | Vaka oyunundaki dış LLM sağlayıcıları; isteğe bağlı, yerel fallback bulunur.                  |

Rust uygulaması PostgreSQL veya genel `DATABASE_URL` bağlantısını desteklemez. Vercel'in dosya sistemi kalıcı olmadığından Turso/libSQL ayarlanmamışsa skorlar ve günlük içerik kalıcı depoda tutulmaz. Ayrıntı için [DEPLOYMENT.md](docs/DEPLOYMENT.md#veritabanı-ve-fallback-davranışı).

## Katkı, lisans ve atıflar

Hata bildirimi ve geliştirme önerileri için [GitHub Issues](https://github.com/dixtuel/sely-minigame-hub/issues) kullan. Değişiklik göndermeden önce ilgili kontrolleri çalıştır; oyun eklerken katalog metinlerini, kontrolleri, responsive davranışı ve ilgili testleri de güncelle.

Kaynak kodu [AGPL-3.0](LICENSE) lisanslıdır. Üçüncü taraf kod ve asset atıfları [ATTRIBUTION.md](docs/ATTRIBUTION.md) içinde yer alır. SELY adı ve özgün marka varlıkları kaynak kodu lisansından ayrı değerlendirilir.
