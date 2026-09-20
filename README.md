<div align="center">

# SELY.TR — MiniGame Hub (v2.0 Rust Edition)

**Tarayıcıda oynanan yedi mini oyun. Her gün yeni bir set. Her seviye deterministik, her rota çözülebilir.**

[![Canlı demo](https://img.shields.io/badge/canl%C4%B1_demo-sely.tr-F38020?style=flat-square&logo=vercel&logoColor=white)](https://sely.tr)
[![Lisans](https://img.shields.io/badge/lisans-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Backend](https://img.shields.io/badge/backend-Rust%202021%20%7C%20Axum%200.8%20%7C%20Tokio-DEA584?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%7C%20Vite%207%20%7C%20Tailwind-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Serverless](https://img.shields.io/badge/serverless-Vercel%20Rust%20%7C%20Zero--CDN--Cache-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/tests-Cargo%2035%20Passed%20%7C%20Vitest-brightgreen?style=flat-square)](https://github.com/dixtuel/sely-minigame-hub)
[![CI](https://github.com/dixtuel/sely-minigame-hub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dixtuel/sely-minigame-hub/actions/workflows/ci.yml)

[**Canlı demoyu aç**](https://sely.tr) · [**Branch Mimarisi**](#git-branch-yap%C4%B1s%C4%B1-main-vs-nodejs-legacy) · [**Oyun Kataloğu**](#oyun-katalo%C4%9Fu) · [**Hızlı Başlangıç**](#h%C4%B1zl%C4%B1-ba%C5%9Flang%C4%B1%C3%A7) · [**Vercel & Dağıtım**](#da%C4%9F%C4%B1t%C4%B1m-se%C3%A7enekleri)

</div>

---

## Sely Nedir?

SELY.TR, birkaç dakikada oynanabilen yedi mini oyunu tek bir günlük deneyimde birleştiren açık kaynaklı bir web oyun platformudur. Oyuncu her gün aynı temel seed’den üretilen seti görür. Kişisel ustalık seviyesi yükseldikçe oyunlar daha yoğun hâle gelir; fakat prosedürel üretimden çıkan her seviye, oyuncuya sunulmadan önce ilgili çözücü katmanından geçer.

Projenin 2.0 sürümüyle birlikte arka uç katmanı **Node.js/Express** altyapısından sıfır bellek sızıntılı, ultra hafif ve sub-millisecond yanıt süreli **Rust (Axum + Tokio)** mimarisine taşınmıştır.

---

## Git Branch Yapısı (`main` vs `nodejs-legacy`)

Depo, mimari evrimini ve geriye dönük tam referansını korumak için iki ana dalda sürdürülmektedir:

| Özellik / Kriter | `main` (Aktif / Canlı) | `nodejs-legacy` (Dondurulmuş Arşiv) |
| :--- | :--- | :--- |
| **Rol & Durum** | Aktif üretim dalı (Production), yeni geliştirmeler | Dondurulmuş arşiv dalı (Frozen LTS) |
| **Arka Uç Runtime** | **Rust 2021** (Axum 0.8 + Tokio Async Engine) | **Node.js 22 LTS** (Express 4 + tsx/esbuild) |
| **İletişim & API** | Rust native tRPC uyumlu JSON-RPC + REST API | TypeScript `@trpc/server` v11 |
| **RAM Tüketimi (VDS)** | **~12–18 MB** (Sıfır GC baskısı, sızıntısız) | ~150–220 MB (V8 heap & GC periyodu) |
| **Cold Start / Başlangıç** | **< 2 ms** (Vercel Serverless / Lambda) | ~350–600 ms (Node.js modül çözümleme) |
| **Veritabanı / Sürücü** | Native Rust `libsql` (Turso, resmi client) | `@libsql/client` (HTTP) + `pg` (Node) |
| **Redis Entegrasyonu** | Native `fred` (Async RESP pipelining) | `ioredis` (Node.js TCP client) |
| **Vercel Serverless** | `vercel_runtime` (resmi crate, `axum` feature — `api/index.rs`, Fluid Compute) | Node.js Serverless (`api/index.js`) |
| **Önbellek Politikası** | **Zero-CDN-Cache** (Veri tazeliği garantili) | Agresif Edge CDN Caching (s-maxage) |

> [!NOTE]
> Eski Node.js altyapısına, kod örneklerine veya referans tRPC TypeScript router'larına erişmek isterseniz `git checkout nodejs-legacy` komutuyla dondurulmuş arşive geçebilirsiniz.

---

## Öne Çıkan Özellikler

- **Yedi Farklı Oyun:** 3D labirent keşfi, akış bulmacası, dinamik geometri kesimi, gecikmeli gölge zamanlaması, mantık/çıkarım dedektifliği, kelime/sayı bulmacası ve sonsuz arcade uçuşu.
- **Deterministik Günlük İçerik:** Tüm oyuncular her gün aynı küresel seed ile üretilen seviyeleri çözer.
- **Matematiksel Çözülebilirlik Garantisi:** BFS, Dijkstra, spanning tree, poligon kesişim algoritmaları ve vaka çelişki grafikleri ile imkânsız seviyeler anında elenir.
- **Rust ile Ultra Düşük Kaynak Tüketimi:** VDS (1 vCPU, 2 GB RAM) ve Vercel Serverless (fra1) üzerinde neredeyse sıfır gecikme ve minimum kaynak kullanımı.
- **Sıfır CDN Önbellek Tıkanıklığı (Zero-CDN-Cache):** Skorlar, günlük vaka durumları ve anlık mutasyonlar hiçbir proxy/edge katmanında takılmaz.
- **Anonim ve Gizlilik Odaklı:** Hesap açma, parola veya e-posta istemez. Tüm kayıtlar cihazda şifreli saklanır, liderlik tablosu isteğe bağlı rumuz üreticisi ile eşleşir.
- **Saf Web Audio Sentetizörü:** Harici ses dosyası indirilmez; tüm ses efektleri tarayıcı içinde gerçek zamanlı osilatörlerle sentezlenir.
- **Paylaşılan Rust Çekirdeği (Backend ↔ WASM):** Düğüm/Kırpık/Gölge/Hane/Kıvılcım seviye üreticileri ve deterministik PRNG, `crates/sely-game-core` üzerinden derlenen `sely_game_core.wasm` ile tarayıcıda çalışır; kaynak kodu `src/games/` ile paylaşılır (backend ve istemci birebir aynı algoritmayı üretir), WASM başarısız olursa saf TypeScript implementasyonuna otomatik düşer.

---

## Oyun Kataloğu

| № | Oyun | Tür | Temel Mekanik | Süre |
| :---: | :--- | :--- | :--- | :---: |
| **01** | **Yankı Odası (Echo Room)** | 3D Keşif & Risk | Karanlık labirentte yankı sinyallerini yöneterek sinyalleri topla. | 3–5 dk |
| **02** | **Düğüm (Knot)** | Akış Bulmacası | Karoları döndürerek kaynak ve hedef arasındaki rotayı tamamla. | 1–3 dk |
| **03** | **Kırpık (Cutout)** | Geometri & Ritim | Hareket eden çokgenleri sınırlı enerjiyle tek hamlede dilimle. | 90 sn |
| **04** | **Gölge Payı (Shadow Share)** | Zamanlama & Senkronizasyon | Gecikmeli gölgeni yönlendirerek iki hedefi aynı anda tetikle. | 2 dk |
| **05** | **Vaka (Case)** | Dedektiflik & Mantık | Şüphelilerin ifadelerindeki çelişkileri kanıtlarla açığa çıkar. | 3–5 dk |
| **06** | **Hane (Hane)** | Kelime & Sayı Mantığı | Sayı (Bulls & Cows) veya kelime tahminleriyle olasılıkları daralt. | 2–4 dk |
| **07** | **Kıvılcım (Spark)** | Arcade Uçuş | Parçacığı dar koridorlarda tut ve rekor mesafeye ulaş. | Sonsuz |

---

## Tasarım ve Teknik Yaklaşım

### Günlük Seed ve Ustalık

Günlük içerik, tarih ve oyun kimliğinden türetilen deterministik seed'lerle oluşturulur. Böylece aynı günün temel seviyesi yeniden üretilebilir ve oyuncular aynı günlük yapıyı paylaşabilir. Kişisel skor, ustalık hesabında kullanılır; bu nedenle tekrar oynama yalnızca yeni rastgelelik aramak yerine daha iyi bir çözüm ve daha yüksek performans arayışına dönüşür.

### Çözülebilirlik Güvencesi

Prosedürel üretim tek başına yeterli kabul edilmez. `src/games/*.rs` (backend + `sely-game-core` WASM, aynı kaynak dosyaları paylaşır) içindeki üretim ve doğrulama katmanları aşağıdaki yaklaşımı kullanır:

| Oyun | Üretim Yaklaşımı | Doğrulama Yaklaşımı |
| :--- | :--- | :--- |
| Yankı Odası | Labirent üretimi ve koridor bağlantıları (`maze.rs`) | BFS rota kontrolü ve minimum gürültü için Dijkstra |
| Düğüm | Rastgeleleştirilmiş DFS spanning tree (`knot.rs`) | BFS ile kaynak-hedef erişilebilirlik kontrolü |
| Kırpık | Rejection sampling ile çokgen katmanları (`cut.rs`) | Geometrik alan ve kesilebilirlik doğrulaması |
| Gölge Payı | Gecikmeli hareket ve çift hedef yerleşimi (`shadow.rs`) | Zaman tamponu simülasyonu |
| Vaka | İpucu-şüpheli ilişkileri ve vaka state machine'i (`services/vaka_*.rs`) | Tekil suçlu ve çelişki grafı çözümü |
| Hane | Deterministik kelime ve sayı havuzları (`hane.rs`) | Sözlük ve frekans doğrulaması |
| Kıvılcım | Seed tabanlı engel ve fizik üretimi (`spark.rs`) | Geçilebilir açıklık ve delta-time kısıtları |

---

## Mimari Genel Görünüm

```mermaid
graph TD
    subgraph Frontend ["İstemci Katmanı (Vite + React 19)"]
        UI[Arayüz & Sayfalar]
        Studio[GameStudio Orkestratörü]
        Games[7 Mini Oyun]
        Babylon[Babylon.js 3D]
        Canvas[Canvas 2D Engine]
        WebAudio[Web Audio Sentezi]
        WASM[sely-game-core.wasm - Rust]
    end

    subgraph Backend ["Sunucu Katmanı (Rust Axum 0.8)"]
        Router[Axum Router & Katmanlar]
        TRPC_Bridge[tRPC JSON-RPC Uyumluluk Motoru]
        DailyEngine[Deterministik Günlük Seviye & Vaka Üretici]
        Leaderboard[Liderlik Tablosu & Doğrulama]
        OG_SEO[Dinamik OG Görsel & SEO Rotaları]
    end

    subgraph Storage [Veri & Dağıtım]
        Turso[(Turso / LibSQL)]
        Redis[(Redis Önbellek)]
        Vercel["Vercel Serverless (fra1) - No CDN Cache"]
        VDS["VDS Standalone Binary (:3000)"]
    end

    UI --> Studio
    Studio --> Games
    Games --> Babylon
    Games --> Canvas
    Games --> WebAudio
    Games --> WASM

    Studio -.->|HTTP / JSON-RPC| Router
    Router --> TRPC_Bridge
    Router --> DailyEngine
    Router --> Leaderboard
    Router --> OG_SEO

    Router --> Turso
    Router --> Redis

    Router -.-> VDS
    Router -.-> Vercel
```

### Dizin Yapısı

```
src/          Rust backend (Axum router'lar, oyun üretici/doğrulayıcılar, storage)
crates/       sely-game-core — tarayıcıda çalışan WASM oyun çekirdeği (src/games/ ile paylaşımlı)
client/       React arayüzü, sayfalar, bileşenler ve oyun render katmanı
api/          Vercel serverless girişi (api/index.rs) ve OG endpoint'i
shared/       İstemci ve sunucu arasında paylaşılan tipler ve vaka verileri
scripts/      Public release denetimleri ve veri hazırlama script'leri
client/public/Statik görseller, posterler, dokular ve ses varlıkları
```

---

## Hızlı Başlangıç

### Sistem Gereksinimleri

- **Rust:** `1.75+` (Cargo araç zinciri)
- **Node.js:** `22 LTS` (Sadece frontend derlemesi ve testler için)
- **pnpm:** `10.x`
- **İsteğe Bağlı:** Yerel Redis ve SQLite / Turso hesabı

### 1. Depoyu Klonlama

```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
```

### 2. Frontend Bağımlılıklarını Kurma

```bash
pnpm install
```

### 3. Geliştirme Ortamını Başlatma

#### Seçenek A: Rust Backend + Vite Frontend (Önerilen - `main`)

Terminal 1 (Rust Backend):
```bash
cargo run --bin standalone
```

Terminal 2 (Vite Frontend):
```bash
pnpm dev
```
Uygulama `http://localhost:5173` (veya `:3000`) adresinde açılır.

#### Seçenek B: Eski Node.js Ortamı (`nodejs-legacy` branch)

```bash
git checkout nodejs-legacy
pnpm install
pnpm dev
```

---

## Geliştirme ve Test Komutları

| Komut | Açıklama |
| :--- | :--- |
| `pnpm dev` | Vite frontend geliştirme sunucusunu başlatır. |
| `pnpm check` | TypeScript frontend tip kontrolünü (`tsc --noEmit`) çalıştırır. |
| `pnpm test` | Vitest frontend birim ve bileşen testlerini çalıştırır. |
| `pnpm audit:public` | Hassas anahtar/dosya sızıntı denetimini yürütür. |
| `pnpm build` | Vite ile frontend üretim çıktısını (`dist/public`) oluşturur. |
| `cargo test` | Rust backend, çözücüler, tRPC parser ve doğrulama testlerini çalıştırır (35 test). |
| `cargo check` | Rust kaynak kodunun derleme ve tip kontrolünü saniyeler içinde yapar. |
| `pnpm run build:wasm` | `crates/sely-game-core`'u yeniden derleyip `client/src/wasm/`'a WASM çıktısını üretir (kaynak değişince çalıştırılıp commit'lenmeli). |

---

## Dağıtım Seçenekleri

### 1. Vercel Serverless (Rust Runtime & Limit Koruma Mimarisi)

`main` branch'i doğrudan Vercel üzerinde Rust Serverless fonksiyonu olarak çalışacak şekilde yapılandırılmıştır (`api/index.rs` + `vercel.json`):

- **Runtime:** `vercel_runtime` (Vercel'in resmi Rust crate'i, `axum` feature)
- **Bölge:** `fra1` (Frankfurt), Fluid Compute açık.
- **Kota koruması:** Statik asset'ler (ses, font, 3D) uzun süreli immutable cache alır; günlük bulmaca/SEO rotaları `s-maxage`/`stale-while-revalidate` ile Edge'den yanıtlanır; skor/vaka gibi mutasyonlar hiç önbelleklenmez.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdixtuel%2Fsely-minigame-hub)

### 2. Linux VDS / Systemd Standalone

Canlı sunucuda (VDS) Rust standalone binary'si tek bir process olarak çalışır:

```bash
# Standalone binary doğrudan çalıştırılır
./target/release/standalone
```
- Nginx veya Caddy reverse proxy ile `127.0.0.1:3000` portundan `https://sely.tr` adresine yönlendirilir.
- Bellek tüketimi 15 MB altındadır.

### 3. Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

---

## Ortam Değişkenleri

Zorunlu değişken yoktur; tanımlanmadığında uygulama güvenli yerel fallback mekanizmalarını devreye sokar.

| Değişken | Açıklama | Örnek / Varsayılan |
| :--- | :--- | :--- |
| `PORT` | Sunucu dinleme portu | `3000` |
| `TURSO_DATABASE_URL` | Turso / LibSQL veritabanı adresi | `libsql://sely-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso JWT kimlik doğrulama belirteci | `eyJ...` |
| `REDIS_URL` | Redis bağlantı URL'i | `redis://127.0.0.1:6379` |
| `CRON_SECRET` | Zamanlanmış cron istekleri için güvenlik anahtarı | `sely_cron_sec_...` |
| `PRIMARY_DOMAIN` | Canonical domain adı | `sely.tr` |
| `GOOGLE_SITE_VERIFICATION` | Google arama motoru doğrulama kodu | Opsiyonel |

---

## Güvenlik ve Gizlilik

- **Sıfır Kişisel Veri:** E-posta, parola veya telefon toplanmaz.
- **Kriptografik İmzalar:** Skorlar ve liderlik girdileri istemci tarafında SHA-256 ve FNV-1a tabanlı mühürlerle doğrulanır.
- **Hassas Bilgi Koruması:** `pnpm audit:public` betiği her sürüm öncesi secret taraması yapar.

---

## İletişim ve Destek

- **Geliştirici:** Asrın Kılıç ([@dixtuel](https://github.com/dixtuel))
- **E-posta:** `asrinklcc@sely.tr`
- **Web Sitesi:** [sely.tr](https://sely.tr)

---

## Katkıda Bulunma

Hata bildirmek, yeni bir oyun fikri önermek veya mevcut bir mekaniği geliştirmek için [issue](https://github.com/dixtuel/sely-minigame-hub/issues) açabilirsin. Kod değişikliklerinde şu akış önerilir:

1. Repo'yu fork'la veya bir feature branch oluştur.
2. Değişikliği küçük ve tek amaçlı tut.
3. `pnpm check`, `pnpm test`, `pnpm audit:public`, `pnpm build` ve (Rust dokunduysan) `cargo check`/`cargo test` komutlarını çalıştır.
4. Değişikliğin oyun davranışını veya veri sözleşmesini etkilediğini açıklayan bir Pull Request gönder.

Yeni bir oyun eklerken katalog kaydını, İngilizce metin eşlemesini, oyun bileşenini, kontrolleri, testleri ve gerekiyorsa hem `src/games/` (backend/WASM) hem `client/src/lib/levelGenerators/` (JS fallback) tarafındaki solver doğrulamasını birlikte güncelle.

---

## Atıflar

Kullanılan açık kaynak bileşenler ve üçüncü taraf içerik bildirimleri [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) dosyasında listelenir. Başlıca teknik bileşenler [Axum](https://github.com/tokio-rs/axum), [Tokio](https://tokio.rs/), [React](https://react.dev/), [Babylon.js](https://www.babylonjs.com/), [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Tailwind CSS](https://tailwindcss.com/) ve [Radix UI](https://www.radix-ui.com/).

---

## Lisans

Bu proje [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) altında lisanslanmıştır.  
Telif Hakkı © 2026 dixtuel.
