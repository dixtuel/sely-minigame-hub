<div align="center">

# SELY.TR — MiniGame Hub

**Tarayıcıda oynanan yedi kısa oyun. Her gün yeni bir set. Her seviye deterministik, her rota çözülebilir.**

[![Canlı demo](https://img.shields.io/badge/canl%C4%B1_demo-sely.tr-F38020?style=flat-square&logo=vercel&logoColor=white)](https://sely.tr)
[![Lisans](https://img.shields.io/badge/lisans-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Rust%20%7C%20Axum%20%7C%20Vercel-DEA584?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Test](https://img.shields.io/badge/test-Cargo%20%7C%20Vitest-6E9F18?style=flat-square)](https://vitest.dev/)
[![CI](https://github.com/dixtuel/sely-minigame-hub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dixtuel/sely-minigame-hub/actions/workflows/ci.yml)

[**Canlı demoyu aç**](https://sely.tr) · [**Oyun kataloğuna git**](#oyun-katalo%C4%9Fu) · [**Yerel çalıştır**](#h%C4%B1zl%C4%B1-ba%C5%9Flang%C4%B1%C3%A7)

</div>

---

## Sely nedir?

SELY.TR, birkaç dakikada oynanabilen yedi mini oyunu tek bir günlük deneyimde birleştiren açık kaynaklı bir web oyun platformudur. Oyuncu her gün aynı temel seed'den üretilen seti görür. Kişisel ustalık seviyesi yükseldikçe oyunlar daha yoğun hâle gelir; fakat prosedürel üretimden çıkan her seviye, oyuncuya sunulmadan önce ilgili doğrulama veya çözücü katmanından geçer.

Backend katmanı Rust (Axum + Tokio) ile yazılır; oyun mantığının bir kısmı (`crates/sely-game-core`) WebAssembly olarak derlenip tarayıcıda da çalışır, `src/games/` kaynak dosyalarını backend ile paylaşır. Eski Node.js/Express/tRPC-server altyapısı `nodejs-legacy` branch'inde referans için dondurulmuştur (`git checkout nodejs-legacy`); orada aktif geliştirme yapılmaz.

## Öne çıkan özellikler

- **Yedi farklı oyun:** 3D keşif, akış bulmacası, geometri, zamanlama, dedektiflik, kelime-mantık ve arcade uçuş türleri.

- **Günlük deterministik içerik:** Aynı günün temel seti oyuncular arasında paylaşılır; içerik seed tabanlı üretilir.

- **Çözülebilirlik kontrolleri:** BFS, Dijkstra, spanning tree, geometri doğrulama ve vaka çözücüleri imkânsız prosedürel seviyeleri filtreler.

- **Dört aşamalı ustalık sistemi:** Oyuncunun yüksek skoruna göre tekrar oynanabilirlik ve zorluk artar.

- **Masaüstü ve mobil kontroller:** Klavye, fare, dokunmatik etkileşim ve oyun bazlı sanal kontroller.

- **Türkçe ve İngilizce rotalar:** Türkçe kök rota ve İngilizce `/en` rotası.

- **Saf Web Audio efektleri:** Oyun içi kısa sesler tarayıcıda sentezlenir; oyunun temel sesi için harici ses dosyası zorunlu değildir.

- **Anonim kullanım:** Kullanıcı hesabı veya parola gerektirmez. Yerel ilerleme tarayıcıda tutulur; liderlik tablosu API üzerinden isteğe bağlı olarak çalışır.

- **Backend ↔ WASM paylaşımlı çekirdek:** Düğüm/Kırpık/Gölge/Hane/Kıvılcım seviye üreticileri ve deterministik PRNG hem Rust backend'de hem tarayıcıda (`sely_game_core.wasm`) aynı kaynak dosyalarından çalışır; WASM yüklenemezse istemci saf TypeScript implementasyonuna otomatik düşer.

- **Esnek veri katmanı:** Harici servis tanımlanmadığında yerel/bellek içi fallback seçenekleriyle başlar.

## Oyun kataloğu

| Oyun | Tür | Temel fikir | Yaklaşık süre |
| --- | --- | --- | --- |
| **Yankı Odası / Echo Room** | 3D keşif ve risk | Karanlık bir labirentte yankı bütçesini koruyarak işaretleri topla. | 3–5 dk |
| **Düğüm / Knot** | Akış bulmacası | Karoları çevirerek kaynağı hedefe bağlayan akışı kur. | 1–3 dk |
| **Kırpık / Cutout** | Geometri ve ritim | Hareketli şekilleri sınırlı enerjiyle tek çizgide kes. | 90 sn |
| **Gölge Payı / Shadow Share** | Zamanlama ve eşleme | Gecikmeli gölgeni iki hedefle eşzamanla. | 2 dk |
| **Vaka / Case** | Dedektiflik ve çıkarım | Şüpheliyi, ifadesiyle çelişen kanıtı sunarak sıkıştır. | 3–5 dk |
| **Hane / Hane** | Kelime ve sayı mantığı | Sayı veya kelime kayıtlarındaki işaretleri kullanarak seçenekleri azalt. | 2–4 dk |
| **Kıvılcım / Spark** | Arcade uçuş | Kıvılcımı engeller arasında tut ve mümkün olduğunca uzun uç. | Sonsuz uçuş |

Oyunların kullanıcıya gösterilen başlıkları ve kontrolleri `client/src/lib/catalog.ts` içinde tek katalogdan yönetilir. İngilizce metinler aynı katalogdaki locale eşlemesiyle üretilir.

## Tasarım ve teknik yaklaşım

### Günlük seed ve ustalık

Günlük içerik, tarih ve oyun kimliğinden türetilen deterministik seed'lerle oluşturulur. Böylece aynı günün temel seviyesi yeniden üretilebilir ve oyuncular aynı günlük yapıyı paylaşabilir. Kişisel skor, ustalık hesabında kullanılır; bu nedenle tekrar oynama yalnızca yeni rastgelelik aramak yerine daha iyi bir çözüm ve daha yüksek performans arayışına dönüşür.

### Çözülebilirlik güvencesi

Prosedürel üretim tek başına yeterli kabul edilmez. `src/games/*.rs` (backend ve `sely-game-core` WASM crate'i aynı dosyaları paylaşır) içindeki üretim ve doğrulama katmanları aşağıdaki yaklaşımı kullanır:

| Oyun | Üretim yaklaşımı | Doğrulama yaklaşımı |
| --- | --- | --- |
| Yankı Odası | Labirent üretimi ve koridor bağlantıları | BFS rota kontrolü ve minimum gürültü için Dijkstra |
| Düğüm | Rastgeleleştirilmiş DFS spanning tree | BFS ile kaynak-hedef erişilebilirlik kontrolü |
| Kırpık | Rejection sampling ile çokgen katmanları | Geometrik alan ve kesilebilirlik doğrulaması |
| Gölge Payı | Gecikmeli hareket ve çift hedef yerleşimi | Zaman tamponu simülasyonu |
| Vaka | İpucu-şüpheli ilişkileri ve vaka state machine'i | Tekil suçlu ve çelişki grafı çözümü |
| Hane | Deterministik kelime ve sayı havuzları | Sözlük ve frekans doğrulaması |
| Kıvılcım | Seed tabanlı engel ve fizik üretimi | Geçilebilir açıklık ve delta-time kısıtları |

## Hızlı başlangıç

### Gereksinimler

- Rust (stable toolchain, Cargo)

- Node.js **22 LTS**

- pnpm **10.x**

- Yerel geliştirme için modern bir masaüstü ya da mobil tarayıcı

### Kurulum

```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
pnpm install
```

İki terminal gerekir — biri Rust backend, biri Vite frontend için:

```bash
# Terminal 1
cargo run --bin standalone

# Terminal 2
pnpm dev
```

Frontend `http://localhost:5173` adresinde açılır ve backend'e proxy'lenir.

İlk kurulumda ortam değişkeni zorunlu değildir. İhtiyaç duyarsan örnek dosyayı kopyalayabilirsin:

```bash
cp .env.example .env
```

### Üretim derlemesi

```bash
pnpm build              # Vite frontend çıktısı (dist/public)
cargo build --release --bin standalone
```

## Geliştirme komutları

| Komut | Açıklama |
| --- | --- |
| `pnpm dev` | Vite geliştirme sunucusunu ve dosya izlemeyi başlatır. |
| `pnpm check` | TypeScript tip kontrolünü çalıştırır. |
| `pnpm test` | Vitest testlerini çalıştırır. |
| `pnpm audit:public` | Public release içinde hassas dosya ve bilgi sızıntısı arar. |
| `pnpm build` | Vite üretim çıktısını oluşturur. |
| `pnpm run build:wasm` | `crates/sely-game-core`'u yeniden derleyip `client/src/wasm/`'a WASM çıktısı üretir (kaynak değişince çalıştırılıp commit'lenmeli). |
| `cargo check` | Rust kaynak kodunun derleme/tip kontrolünü yapar. |
| `cargo test` | Rust backend, çözücüler ve doğrulama testlerini çalıştırır. |

Değişiklik göndermeden önce en azından şu doğrulama paketini çalıştırmanı öneririm:

```bash
pnpm check
pnpm test
pnpm audit:public
pnpm build
cargo check
cargo test
```

## Dağıtım seçenekleri

### Vercel

Repo, `vercel.json` içindeki rewrite ve header kurallarıyla Vercel'e hazırdır. Backend `api/index.rs`, Vercel'in resmi Rust runtime'ı (`vercel_runtime` crate, `axum` feature) ile Fluid Compute üzerinde çalışır. Tek tıklık kurulum için:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdixtuel%2Fsely-minigame-hub)

### Standalone Rust (VDS/systemd)

```bash
cargo build --release --bin standalone
./target/release/standalone
```

Nginx veya Caddy reverse proxy ile `127.0.0.1:3000` portundan servis edilir.

### Docker Compose

> [!NOTE]
> `docker/Dockerfile` şu an hâlâ Node.js tabanlı — `main`'in Rust backend'i için henüz güncellenmedi. Docker ile çalıştırmak istersen bu adımlar için `nodejs-legacy` branch'ini kullan:
> ```bash
> git checkout nodejs-legacy
> cp .env.example .env
> docker compose up -d
> ```

## Ortam değişkenleri

Tüm değişkenler zorunlu değildir; tanımlanmadığında uygulama güvenli yerel fallback mekanizmalarını devreye sokar.

| Alan | Değişkenler | Ne için kullanılır? |
| --- | --- | --- |
| Veri deposu | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Turso / libSQL bağlantısı |
| Önbellek | `REDIS_URL` | Liderlik tablosu önbelleği |
| Zamanlanmış işler | `CRON_SECRET`, `DAILY_JOB_TOKEN` | Vercel Cron yetkilendirmesi |
| Vercel | `GLOBAL_CONFIG` / `EDGE_CONFIG` | Duyuru banner'ı ve bakım modu gibi global ayarlar |
| SEO | `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_SITE_VERIFICATION` | Arama motoru doğrulama dosyaları |
| Genel | `PRIMARY_DOMAIN` | Canonical URL ve sunucu ortamı için ana alan adı |
| Genel | `PORT` | Standalone binary dinleme portu |

## Mimari genel görünüm

```mermaid
graph TD
    Browser[Tarayıcı] --> Client["React + TypeScript + Vite"]
    Client --> Studio[GameStudio]
    Studio --> Games["Yedi mini oyun"]
    Games --> Canvas["Canvas oyunları"]
    Games --> Babylon["Babylon.js 3D"]
    Games --> Audio["Web Audio sentezi"]
    Games --> WASM["sely-game-core.wasm (Rust)"]
    Client --> API["Axum Router (api/index.rs)"]
    API --> Storage{Veri deposu}
    Storage --> Turso["Turso / libSQL"]
    API --> Redis["Redis önbelleği"]
```

### Dizin yapısı

```
src/          Rust backend (Axum router'lar, oyun üretici/doğrulayıcılar, storage)
crates/       sely-game-core — tarayıcıda çalışan WASM oyun çekirdeği (src/games/ ile paylaşımlı)
client/       React arayüzü, sayfalar, bileşenler ve oyun render katmanı
api/          Vercel serverless girişi (api/index.rs) ve OG endpoint'i
shared/       İstemci ve sunucu arasında paylaşılan tipler ve vaka verileri
scripts/      Public release denetimleri ve veri hazırlama script'leri
client/public/Statik görseller, posterler, dokular ve ses varlıkları
```

## Veri ve gizlilik

Sely varsayılan olarak hesap, parola veya e-posta istemeden oynanabilir. Yerel ilerleme ve kişisel oyun durumu tarayıcı tarafında tutulur. Liderlik tablosu gibi sunucu özellikleri etkinleştirildiğinde veri deposu yapılandırmasına göre API üzerinden çalışır.

Skorlar ve liderlik girdileri istemci tarafında SHA-256 ve FNV-1a tabanlı mühürlerle doğrulanır. Public release denetimi `pnpm audit:public` komutuyla hassas dosya ve bilgi sızıntılarını kontrol eder.

## Katkıda bulunma

Hata bildirmek, yeni bir oyun fikri önermek veya mevcut bir mekaniği geliştirmek için [issue](https://github.com/dixtuel/sely-minigame-hub/issues) açabilirsin. Kod değişikliklerinde şu akış önerilir:

1. Repo'yu fork'la veya bir feature branch oluştur.

1. Değişikliği küçük ve tek amaçlı tut.

1. `pnpm check`, `pnpm test`, `pnpm audit:public`, `pnpm build` ve (Rust dokunduysan) `cargo check`, `cargo test` komutlarını çalıştır.

1. Değişikliğin oyun davranışını veya veri sözleşmesini etkilediğini açıklayan bir Pull Request gönder.

Yeni bir oyun eklerken katalog kaydını, İngilizce metin eşlemesini, oyun bileşenini, kontrolleri, testleri ve gerekiyorsa hem `src/games/` (backend/WASM) hem `client/src/lib/levelGenerators/` (JS fallback) tarafındaki solver doğrulamasını birlikte güncelle.

## Atıflar

Kullanılan açık kaynak bileşenler ve üçüncü taraf içerik bildirimleri [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) dosyasında listelenir. Başlıca teknik bileşenler [Axum](https://github.com/tokio-rs/axum), [Tokio](https://tokio.rs/), [React](https://react.dev/), [Babylon.js](https://www.babylonjs.com/), [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Tailwind CSS](https://tailwindcss.com/) ve [Radix UI](https://www.radix-ui.com/).

## Lisans

Kaynak kodu [GNU Affero General Public License v3.0](LICENSE) kapsamında lisanslanır. Telif hakkı © 2026 dixtuel.
