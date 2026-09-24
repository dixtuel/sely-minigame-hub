<div align="center">

<img src="client/public/assets/logo-mark.png" width="88" alt="SELY simgesi">

# SELY.TR — MiniGame Hub

**Tarayıcıda oynanan 17 kısa oyun. Her gün değişen seçki; mobil ve masaüstü desteği.**

[![Canlı demo](https://img.shields.io/badge/canl%C4%B1_demo-sely.tr-F38020?style=flat-square&logo=vercel&logoColor=white)](https://sely.tr)
[![Sürüm](https://img.shields.io/github/v/release/dixtuel/sely-minigame-hub?style=flat-square)](https://github.com/dixtuel/sely-minigame-hub/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/dixtuel/sely-minigame-hub/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/dixtuel/sely-minigame-hub/actions/workflows/ci.yml)
[![Lisans](https://img.shields.io/badge/lisans-AGPL--3.0-blue?style=flat-square)](LICENSE)

[**Oyunları aç**](https://sely.tr) · [**Kurulum**](#kurulum) · [**Dağıtım rehberi**](docs/DEPLOYMENT.md) · [**Atıflar**](docs/ATTRIBUTION.md)

</div>

SELY; arcade, bulmaca, mantık ve 3D keşif oyunlarını tek bir web kataloğunda birleştirir. Oyunları klavye, fare veya dokunmatik kontrollerle oynayabilir; arayüzü Türkçe ya da İngilizce kullanabilirsin.

## Oyun kataloğu

| Oyun                      | Tür               |
| ------------------------- | ----------------- |
| Yankı Odası (Echo Room)   | 3D keşif          |
| Vaka (Case)               | Dedektiflik       |
| Dörtyol (Tetris)          | Arcade bulmaca    |
| Kıvılcım (Spark)          | Refleks           |
| Düğüm (Knot)              | Mantık bulmacası  |
| Kırpık (Cutout)           | Beceri            |
| Gölge Payı (Shadow Share) | Zamanlama         |
| Hane                      | Sayı ve kelime    |
| Göktaşı (Asteroids)       | Arcade            |
| İstif (Sokoban)           | Mantık bulmacası  |
| İniş (Lander)             | Fizik             |
| Şebeke (Lights Out)       | Mantık bulmacası  |
| Kare 2048                 | Sayı bulmacası    |
| Coil                      | Yılan             |
| Apex                      | Trafik ve refleks |
| Lift                      | Platform          |
| Breakline                 | Tuğla kırma       |

Oyun adları ve açıklamalarının kaynağı client/src/lib/catalog.ts dosyasıdır.

## Hızlı başlangıç

Gereksinimler: Node.js 22+, Corepack/pnpm 10.34.5 ve tam Rust sunucusu için stable Rust.

    git clone https://github.com/dixtuel/sely-minigame-hub.git
    cd sely-minigame-hub
    corepack enable
    pnpm install --frozen-lockfile
    pnpm dev

Vite geliştirme sunucusu arayüzü [localhost:5173](http://localhost:5173) adresinde açar. Rust API'siyle birlikte çalıştırmak için:

    pnpm run build
    pnpm start

Tam sunucu [localhost:3000](http://localhost:3000) adresinde açılır.

## Kurulum

Kendi ortamında çalıştırmanın üç yolu var:

| Yöntem                                                  | Ne sağlar?                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Vercel](docs/DEPLOYMENT.md#vercel)                     | GitHub kaynağından site ve Rust serverless API. Kalıcı veri için Turso/libSQL gerekir. |
| [Docker Compose](docs/DEPLOYMENT.md#docker-compose)     | Uygulama, Redis ve kalıcı volume'lar. Hazır paket veya kendi Docker build'in.          |
| [Standalone Linux](docs/DEPLOYMENT.md#standalone-linux) | Hazır Rust binary'si; doğrudan veya isteğe bağlı systemd servisi.                      |

Hazır paketler [GitHub Releases](https://github.com/dixtuel/sely-minigame-hub/releases/latest) sayfasındadır. Güncel release paketleri Linux amd64 içindir; diğer mimarilerde kaynaktan build al. Adım adım kurulum [dağıtım rehberinde](docs/DEPLOYMENT.md).

## Teknik yapı

Ön yüz React, TypeScript ve Vite; backend Rust, Axum ve Tokio ile çalışır. Bazı oyun mantıkları Rust/WASM ortak çekirdeğini kullanır. Self-host varsayılanı SQLite'tır; Vercel'de kalıcı sunucu verisi için Turso/libSQL yapılandırılır. Redis yalnızca isteğe bağlı leaderboard hız katmanıdır.

- main: güncel Rust uygulaması.
- nodejs-legacy: önceki Node.js sürümünün arşiv dalı.
- [Ortam değişkenleri](.env.example) · [Release hazırlama](docs/RELEASING.md) · [Güvenlik](SECURITY.md)

## Katkı ve lisans

Hata veya geliştirme önerileri için [GitHub Issues](https://github.com/dixtuel/sely-minigame-hub/issues) açabilirsin. Kaynak kodu [AGPL-3.0](LICENSE) lisanslıdır. Üçüncü taraf kod ve asset bildirimleri [ATTRIBUTION.md](docs/ATTRIBUTION.md) dosyasındadır.
