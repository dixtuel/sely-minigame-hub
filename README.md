<div align="center">

# SELY.TR — MiniGame Hub

**Günlük prosedürel 7 mini oyun platformu: tek tohum ve ustalık sistemi, matematiksel çözülebilirlik güvencesi, risograph editoryal görsel dili, sıfır takip çerezi.**

[![Canlı Demo](https://img.shields.io/badge/canlı_demo-sely.tr-F38020?style=flat-square&logo=vercel&logoColor=white)](https://sely.tr)
[![Lisans: AGPL v3](https://img.shields.io/badge/lisans-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Çalışma Ortamı](https://img.shields.io/badge/runtime-Vercel%20Edge%20%2B%20Serverless-black?style=flat-square&logo=vercel)](https://sely.tr)
[![3D Motoru](https://img.shields.io/badge/3D-Babylon.js%20v9-bb464b?style=flat-square)](https://www.babylonjs.com/)
[![Testler](https://img.shields.io/badge/testler-86%20geçti%20(9.3k%20assert)-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9%20strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<br/>

Her sabah saat 00:00'da tüm dünya için tek bir günlük tohumdan (seed) deterministik olarak yeni bir "günün seti" üretilir. Oyuncunun ustalık seviyesi (1–4) arttıkça turlar karmaşıklaşır; ancak üretilen her labirent, akış rotası, çokgen kesimi ve dedektiflik delil grafı üretim anında **matematiksel çözücüler (BFS, Dijkstra, Spanning Tree, Evidence Graph Solvers)** tarafından taranarak **kesinlikle çözülebilir** olduğu doğrulanır.

[Canlı Demo](https://sely.tr) • [Neden SELY?](#neden-sely-minigame-hub) • [Oyun Kataloğu](#oyun-kataloğu-ve-motor-mimarisi) • [Çözülebilirlik Güvenceleri](#matematiksel-çözülebilirlik-güvenceleri) • [Kontroller](#kontroller-ve-erişilebilirlik) • [Sistem Mimarisi](#sistem-mimarisi) • [Teknoloji Yığını](#teknoloji-yığını) • [Güvenlik ve Gizlilik](#güvenlik-ve-gizlilik) • [Yerel Geliştirme](#yerel-geliştirme) • [Lisans](#lisans-ve-marka)

</div>

---

## Neden SELY MiniGame Hub?

İnternet üzerindeki çoğu web oyunu ya agresif reklam ağlarıyla sarılmış, kullanıcıyı kayıt olmaya zorlayan veya prosedürel seviye üretiminde imkânsız/çıkmaz durumları test etmeyen yüzeysel kopyalardan ibarettir. **SELY MiniGame Hub**, bağımsız web oyunculuğuna ve algoritmik bulmaca tasarımına radikal bir alternatif sunar:

* **Deterministik ve Eşit Günlük Set:** Her sabah üretilen günlük set, tüm dünyadaki oyuncular için aynı tohumu paylaşır. Günlük rekabette şans faktörü asgari düzeye indirilir.
* **Sıfır İmkânsız Bölüm Garantisi:** "Rastgele" üretilen hiçbir seviye oyuncuya doğrudan sunulmaz. Arka plandaki matematiksel çözücüler bölümün geçerli bir çıkış yolu olduğunu kanıtlamadan tur başlamaz.
* **Sıfır Harici Ses Varlığı (Pure Web Audio):** Megabaytlarca MP3/WAV dosyası indirilmez. Tüm ses efektleri (tıklama, kesim, motor sesi, harmonik çanlar) tarayıcının yerel Web Audio API osilatörleriyle (`sine`, `sawtooth`, `triangle`, filtrelenmiş gürültü) gerçek zamanlı sentezlenir.
* **Radikal Veri Minimizasyonu:** Kayıt olma, parola girme veya e-posta bırakma zorunluluğu yoktur. Skorlar ve ustalık dereceleri yalnızca oyuncunun kendi tarayıcısında (`localStorage`) saklanır.
* **Risograph Editoryal Estetik:** 20. yüzyıl ortası bağımsız baskı atölyelerinden, kâğıt dokularından ve editoryal poster tipografisinden esinlenen özgün görsel kimlik.
* **Çift Dilli Altyapı:** Tarayıcı dilini otomatik tespit eden, tam yalıtımlı Türkçe (`/`) ve İngilizce (`/en`) rotaları.

---

## Oyun Kataloğu ve Motor Mimarisi

Platformda yedi bağımsız mini oyun bulunur. Ortak paydaları; günlük tohum tabanı, 4 aşamalı ustalık sistemi ve yerel skor defteridir:

| Oyun | Tür | Motor | Doğrudan Erişim | Temel Mekanik |
| :--- | :--- | :--- | :--- | :--- |
| **Yankı Odası** | 3D Akustik Hayatta Kalma | Babylon.js 9 | [Oyna](https://sely.tr/?play=daily&game=echo) | Ekolokasyon, kör labirent, dinamik sis perdesi, akustik yapay zekâ |
| **Düğüm** | 2D Devre Akış Bulmacası | HTML5 Canvas | [Oyna](https://sely.tr/?play=daily&game=knot) | 4×4 boru ağı yönlendirme, DFS Spanning Tree, klavye mühürleme |
| **Kırpık** | 2D Geometri & Refleks | HTML5 Canvas | [Oyna](https://sely.tr/?play=daily&game=cut) | Rejection sampling çokgen katmanları, çift katmanlı lazer kesimi |
| **Gölge Payı** | 2D Zaman Gecikmeli Eşleme | HTML5 Canvas | [Oyna](https://sely.tr/?play=daily&game=shadow) | Geçmiş hareket tamponu simülasyonu, çift hedefli eşzamanlı kilit |
| **Vaka** | Dedektiflik & Mantık | State Machine | [Oyna](https://sely.tr/?play=daily&game=vaka) | 16 sinematik vaka, psikolojik stres, blöf/ters blöf, çelişki grafı |
| **Hane** | Kelime & Kod Çözümleme | Mantık / Metin | [Oyna](https://sely.tr/?play=daily&game=hane) | 4 haneli Mastermind ve 76 bin kelimelik TDK sözlük Wordle modu |
| **Kıvılcım** | 2D Arcade Uçuş Fiziği | Canvas + Web Audio | [Oyna](https://sely.tr/?play=daily&game=spark) | Delta-time bağımsız uçuş adımı, dinamik pilon aralıkları |

### 1. Yankı Odası (Echo Room)
* **Görsel ve Atmosfer:** Zifiri karanlık ortam, yalnızca oyuncunun ve düşmanın yaydığı ses dalgalarıyla aydınlanan duvarlar, hacimsel sis perdesi ve Poisson dağılımlı taş kemer gizli kapılar.
* **Akustik Düşman (The Umbral Stalker):** Konik obsidyen örtü, göğüs kafesinde parıldayan fasetli kristal çekirdek ve havada asılı 4 rezonans dikitinden oluşan 3D fantom varlık.
* **Dinamik Sonar:** Normal devriyede **5.2 saniyede bir**, oyuncu gürültü yaptığında veya tuzağa bastığında ise **2.8 saniyede bir** çift frekanslı kızıl akustik şok dalgası (`#ff1122` ve `#ff0055`) yayar.
* **Koridor Devriyesi:** `maze.ts` içerisindeki koridor BFS algoritması (`findMazePath`) ile 4 oda arasında 20–40 adımlık kapalı bir döngüde kesintisiz devriye gezer; duvara çarpıp kilitlenmez.
* **Çözücü:** Dijkstra minimum-gürültü çözücüsü (`echoMinimalNoise`), ideal 0-hatalı rotanın ses maliyetini hesaplayarak seviyenin ses bütçesini adil bir tolerans marjıyla belirler.

### 2. Düğüm (Knot)
* **Mekanik:** Randomized DFS Spanning Tree üzerinden yönlendirilen akış rotası. 16 karo döndürülerek kaynak (`S`) ile hedef (`H`/`T`) arasındaki enerji hattı birleştirilir.
* **Erişilebilirlik:** Ok tuşları veya WASD ile serbest karo seçimi, Boşluk/Enter ile döndürme, M ile akışı mühürleme ve Z ile hamle geri alma.
* **Çözücü:** Her seviye üretildikten sonra `isKnotLevelSolvable` BFS algoritması ile taranır (900/900 tohumda %100 çözülebilir).

### 3. Kırpık (Cutout)
* **Mekanik:** Rejection-sampling ile üretilen hareketli kâğıt katmanları. Sınırlı kesim enerjisiyle tehlikeli leke sınırlarına çarpmadan hedef şekilleri dilimleme.
* **Görsel Ayrıntı:** Çift katmanlı parıldayan lazer kılıcı, parçacık patlamaları ve klavye numaralarıyla (`[1]–[9]`) birebir eşleşen dairesel nişangah rozetleri.
* **Çözücü:** Çokgen alan doğrulayıcı, kesim hatlarının poligonları geçerli alanlara ayırdığını ve hedefin erişilebilir olduğunu onaylar.

### 4. Gölge Payı (Shadow Share)
* **Mekanik:** Oyuncunun hareket vektörlerini geçmiş tamponunda saklayan ve gecikmeli olarak yeniden oynatan spektral gölge. İki farklı basınç plakasını geçmişinizle senkronize biçimde aynı anda aktif etme zorunluluğu.
* **Çözücü:** Krono-simülasyon motoru, her iki hedefin eşzamanlı olarak tetiklenebilirliğini doğrular.

### 5. Vaka (Dedektiflik & Sorgu Odası)
* **16 Sinematik Dosya:** Boğaz Yalısı Kasa Soygunu, Siber Zirve Donanım Sızıntısı, Açık Deniz Yat Vurgunu, Kapadokya Balon Sabotajı, Göbeklitepe Kireçtaşı Mührü, F1 Telemetry Sabotajı, Michelin Mutfak Tarif Hırsızlığı, Bağımsız Oyun Stüdyosu Kaynak Kod Sabotajı vb.
* **Psikolojik Sorgu Mekaniği:**
  * Şüphelilerin 0–100 dinamik stres seviyesi, kademeli yalanları (Seviye 1–3) ve davranışsal ipuçları (terleme, göz kaçırma, savunmacı duruş).
  * **İki Yönlü Blöf:** Şüphelinin stresi düşükken (< 45) zamansız blöf yapıldığında şüpheli blöfü görür ve rahatlar (`stress -= 12`). Köşeye sıkıştığında (stres >= 45) yapılan blöf savunmasını çatlatır (`stress += 16`).
  * **İtiraf Güvencesi:** Düz sorular stresi en fazla 60'a çıkarabilir ve asla itiraf doğurmaz. Suçlunun itiraf etmesi için stresin kırılma eşiğini (80–86) aşması VE doğrudan çelişen delille yüzleştirilmesi şarttır.
  * **Taktiksel Eylemler:** Çapraz sorgu (`cross_examine`), sessizlik baskısı (`stay_silent`) ve 4 ayaklı resmi iddianame mahkeme modalı.
* **Çözücü:** `solveVakaCase` bağımsız çözücüsü, delil grafından tekil suçlunun çıkarılabildiğini ve masumların tamamen aklandığını matematiksel olarak ispatlar.

### 6. Hane (Digits & Words)
* **Sayı Modu:** 4 haneli, rakamları tekrarsız Mastermind / Bulls & Cows mantığı. Tam yerinde (+) ve var ama yanlış yerde (-) anlık geri bildirimi.
* **Türkçe Sözlük Modu:** Günün kelimesi küratörlü havuzdan seçilirken, oyuncunun tahminleri 76.187 kelimelik tam TDK sözlüğünde (`ncarkaci/TDKDictionaryCrawler`) doğrulanır. Harf tekrarları Wordle kuralına uygun şekilde tekil tüketilir.

### 7. Kıvılcım (Spark)
* **Uçuş Fiziği:** Delta-time bağımsız yerçekimi ve darbe fiziği (`sparkPhysicsStep`), pilonlar arası dikey açıklık kısıtı (`maxDelta = 140` clamp) ve daire-AABB hibrit toleranslı çarpışma denetimi.
* **Harmonik Sentez:** Saf Web Audio API osilatörleriyle üretilen kanat çırpma, pilon geçiş çanı ve çarpışma sesleri.

---

## Matematiksel Çözülebilirlik Güvenceleri

SELY MiniGame Hub'ın temel ilkesi: **Hiçbir oyuncu imkânsız bir prosedürel tohum yüzünden oyunu kaybetmemelidir.**

| Oyun | Algoritmik Üretim Motoru | Doğrulama & Çözücü Algoritması | Test Kapsamı |
| :--- | :--- | :--- | :--- |
| **Yankı Odası** | Recursive Backtracker + Braiding | Dijkstra En-Az-Gürültü Bütçesi (`echoMinimalNoise`) | Kilitli kapı anahtarlardan önce ulaşılamaz; rota garantili |
| **Düğüm** | Randomized DFS Spanning Tree | BFS Rota Ulaşılabilirlik Denetimi (`isKnotLevelSolvable`) | 900/900 tohumda %100 çözülebilir |
| **Kırpık** | Rejection Sampling Poligon Katmanları | Geometrik Çokgen Alan Doğrulayıcı | Hedef dilimlenebilirliği ve leke ayrımı doğrulanır |
| **Gölge Payı** | Çift Plakalı Topolojik Yerleşim | Zaman Tamponlu Çoklu-Tohum Simülasyonu | Eşzamanlı plaka kilidi doğrulanır |
| **Vaka** | Çift Yönlü İpucu-Şüpheli Grafı | Skor Tabanlı Çelişki Çözücüsü (`solveVakaCase`) | Tekil suçlu, tam aklanan masumlar |
| **Hane** | Deterministik Kelime/Sayı Havuzu | TDK Sözlük Doğrulayıcı & Frekans Sayacı | Tam TDK sözlük doğrulaması, çift harf sayımı engeli |
| **Kıvılcım** | Deterministik Tohumlu Pilon Üretimi | Sınırlanmış Delta-Time Uçuş Fiziği | Geçilebilir dikey koridor genişliği garantisi |

---

## Kontroller ve Erişilebilirlik

Platform hem tam masaüstü klavye donanımını hem de dokunmatik mobil cihazları birinci sınıf yurttaş olarak destekler:

| Oyun | Klavye Kısayolları | Dokunmatik / Fare Etkileşimi |
| :--- | :--- | :--- |
| **Yankı Odası** | <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> veya Ok Tuşları: Hareket<br/><kbd>Boşluk</kbd>: Yankı Dalgası Gönder | Sanal yön çubuğu ve dokunmatik nabız butonu |
| **Düğüm** | <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> veya Ok Tuşları: Karolar arası odaklanma<br/><kbd>Boşluk</kbd> / <kbd>Enter</kbd>: Çevir<br/><kbd>M</kbd>: Akışı Mühürle · <kbd>Z</kbd>: Geri Al | Karoya doğrudan dokunarak 90° çevirme, mobil mühürleme çubuğu |
| **Kırpık** | <kbd>1</kbd> – <kbd>9</kbd>: İlgili numaralı hedefi doğrudan dilimle | Parmağı tuval üzerinde sürükleyip bırakarak serbest lazer kesimi |
| **Gölge Payı** | <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> veya Ok Tuşları: Gezgin hareketi | Sanal yön oku kontrolleri |
| **Vaka** | <kbd>1</kbd> – <kbd>4</kbd>: Eylem sekmesi seçimi<br/><kbd>Boşluk</kbd>: Seçili sorgu eylemini uygula | Mobilde 4 sekmeli dokunmatik konsol, yatay kaydırmalı şüpheli kartları, alttan açılan mahkeme paneli |
| **Hane** | <kbd>A</kbd> – <kbd>Z</kbd> / <kbd>0</kbd> – <kbd>9</kbd>: Harf/rakam girişi<br/><kbd>Enter</kbd>: Tahmin gönder · <kbd>Backspace</kbd>: Sil | Ekran üzeri dokunmatik sanal klavye |
| **Kıvılcım** | <kbd>Boşluk</kbd> / <kbd>Yukarı Ok</kbd>: Kanat çırp / Yüksel | Ekrana herhangi bir noktadan tek dokunuş |

---

## Sistem Mimarisi

```mermaid
graph TD
    Client([Kullanıcı / Tarayıcı]) -->|Edge CDN Önbelleği| VercelCDN[Vercel Edge Network<br/>dist/public - 30 gün / 1 yıl Immutable Cache]
    Client -->|/api/* & tRPC| VercelFn[Vercel Serverless Function<br/>api/index.js - Node.js ESM]

    subgraph "İstemci Katmanı (Vite + React 19 + TypeScript)"
        Router[Wouter Router] --> Home[Home.tsx - Katalog & Skor Defteri]
        Home --> GameStudio[GameStudio.tsx - Birleşik Oyun Çalışma Alanı]
        
        GameStudio --> Echo[1. Yankı Odası — Babylon.js 3D & Akustik AI]
        GameStudio --> Knot[2. Düğüm — 2D Canvas & Spanning Tree]
        GameStudio --> Cut[3. Kırpık — 2D Geometri & Lazer Fiziği]
        GameStudio --> Shadow[4. Gölge Payı — 2D Krono-Eşleme]
        GameStudio --> Vaka[5. Vaka — 16 Dosyalı Dedektiflik Motoru]
        GameStudio --> Hane[6. Hane — 76k TDK Sözlük & Mastermind]
        GameStudio --> Spark[7. Kıvılcım — 2D Uçuş Fiziği & Synth]

        GameStudio --> WebAudio[Web Audio Saf Osilatör Sentezleyicisi]
        GameStudio --> Consent[CookieConsentContext - Consent Mode v2]
        GameStudio --> Honeypot[ProtectedIdentity - Anti-Scraper Honeypot]
    end

    subgraph "Sunucu & Veri Hattı"
        VercelFn --> Security[Security Headers & Kayan Pencereli Rate Limiter]
        VercelFn --> SEORoutes[Dinamik SEO & Arama Motoru Doğrulama]
        VercelFn --> tRPC[tRPC v11 Tip-Güvenli Router]
        
        tRPC --> DailyService[DailyContent Servisi]
        DailyService --> Postgres[(PostgreSQL 16 - Drizzle ORM)]
        DailyService -.->|Fallback| Memory[(Deterministik Bellek-İçi Fallback)]
    end
```

---

## Teknoloji Yığını

| Katman | Teknoloji | Sürüm | Mimari Görev ve Sorumluluk |
| :--- | :--- | :--- | :--- |
| **Kullanıcı Arayüzü** | React | `^19.0.0` | Concurrent React mimarisi, Suspense tembel yükleme, Context API |
| **3D Render Motoru** | Babylon.js | `^9.22.2` | Yankı Odası 3D labirent render'ı, özel materyaller, dinamik ışık |
| **Stil ve Tasarım** | Tailwind CSS | `^4.0.0` | Utility-first editoryal stil motoru, responsive düzenler |
| **Arayüz İlkelleri** | Radix UI | `^1.x / ^2.x` | WAI-ARIA uyumlu erişilebilir bileşenler (Dialog, Tooltip, Sonner) |
| **Vektörel Simgeler** | Lucide React | `^0.475.0` | Tutarlı ve hafif arayüz ikon seti |
| **İstemci Yönlendirme** | Wouter | `^3.5.0` | Minimalist (~1.5KB), bağımsızlıksız hashless router |
| **Uçtan Uca RPC** | tRPC | `^11.6.0` | İstemci ile sunucu arasında tam tip-güvenli RPC iletişimi |
| **Veritabanı & ORM** | Drizzle ORM | `^0.44.5` | PostgreSQL ve libSQL destekli hafif TypeScript ORM |
| **Birim & Çözücü Testi** | Vitest | `^3.0.5` | 14 test dosyasında 86 test ve 9.300'den fazla doğrulama |
| **Paketleyici & HMR** | Vite & esbuild | `^6.1.0` | Hızlı HMR, istemci optimizasyonu ve serverless derleme |
| **Çalışma Ortamı** | Node.js / Bun | `Node 22 LTS / Bun 1.x` | Canlıda Node.js 22 LTS; yerel geliştirmede ultra hızlı Bun |

---

## Güvenlik ve Gizlilik

* **Radikal Veri Minimizasyonu:** Oyuncuların kişisel bilgileri, e-postaları veya parolaları toplanmaz. Tüm başarı ve skor verileri oyuncunun kendi cihazındaki `localStorage` alanında kalır.
* **Sıfır İzinsiz Takip Çerezi:** Varsayılan durumda hiçbir analiz veya reklam çerezi yerleştirilmez.
* **Google Consent Mode v2:** `ad_storage`, `ad_personalization` ve `analytics_storage` izinleri varsayılan olarak `denied` durumundadır. Kullanıcı onay verdiğinde sinyaller dinamik olarak güncellenir; Footer'daki "Çerez Ayarları" üzerinden her an geri çekilebilir.
* **Anti-Scraper Kimlik Koruması (`ProtectedIdentity`):** İletişim e-posta adresi ve veri sorumlusu adı kaynak kodda veya ham HTML'de düz metin olarak yer almaz. Çalışma zamanında karakter dizilerinden çözülür; DOM üzerindeki görünmez tuzak elemanlarıyla (`.bot-decoy`) otomatik e-posta toplayıcı botlar yanıltılır.
* **Otomatik `audit:public` CI Kapısı:** Her dağıtım öncesinde depoda hiçbir gizli anahtar, doğrulama dosyası veya kişisel kimlik sızıntısı kalmadığı otomatik olarak denetlenir (`pnpm audit:public`).
* **Sertleştirilmiş Sunucu Başlıkları:** Vercel Serverless fonksiyonlarında kayan pencereli hız sınırlayıcı (rate limiter), katı İçerik Güvenlik Politikası (CSP), `X-Content-Type-Options: nosniff` ve `X-Frame-Options: DENY` başlıkları zorunludur.

---

## Yerel Geliştirme

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/dixtuel/sely-minigame-hub.git
cd sely-minigame-hub
```

### 2. Bağımlılıkları Yükleyin
Node.js 22 LTS önerilir. Paket yöneticisi olarak `pnpm` veya hızlı geliştirme için `bun` kullanabilirsiniz:
```bash
pnpm install
# ya da Bun ile:
bun install
```

### 3. Geliştirme Sunucusunu Başlatın
```bash
pnpm dev
# Geliştirme sunucusu http://localhost:3000 üzerinde açılır
```

### 4. Doğrulama ve Test Paketini Çalıştırın
```bash
# TypeScript katı tip denetimi
pnpm check
# ya da: bun run check

# Çözücü ve birim test paketi (14 dosya, 86 test, 9.3k+ assertion)
pnpm test
# ya da: bun test

# Kamuya açık dağıtım sızıntı denetimi
pnpm audit:public

# Üretim derlemesi testi
pnpm build
```

---

## Ortam Değişkenleri

Tüm ortam değişkenleri opsiyoneldir. Herhangi bir veritabanı bağlantısı sağlanmadığında sistem bellek-içi deterministik tohum üretimiyle sorunsuz çalışır.

| Değişken | Zorunlu | Varsayılan | Açıklama |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | Hayır | `undefined` | PostgreSQL 16 bağlantı dizesi (Neon / yerel). |
| `CONTENT_DB_PROVIDER` | Hayır | `postgres` | libSQL / Turso kullanılacaksa `turso` olarak ayarlanır. |
| `TURSO_URL` | Hayır | `undefined` | Turso veritabanı URL adresi. |
| `TURSO_AUTH_TOKEN` | Hayır | `undefined` | Turso yetkilendirme anahtarı. |
| `REDIS_URL` | Hayır | `undefined` | VDS / Docker TCP Redis bağlantı dizesi (`redis://127.0.0.1:6379` vb.). Tanımsızsa memory fallback devrededir. |
| `UPSTASH_REDIS_REST_URL` | Hayır | `undefined` | Vercel Marketplace Upstash Redis REST URL adresi (Serverless liderlik tablosu). |
| `UPSTASH_REDIS_REST_TOKEN` | Hayır | `undefined` | Vercel Marketplace Upstash Redis REST yetkilendirme token'ı. |
| `PRIMARY_DOMAIN` | Hayır | `sely.tr` | Kanonik alan adı — SEO etiketleri ve sitemap için kullanılır. |
| `GOOGLE_SITE_VERIFICATION`| Hayır | `undefined` | Google Search Console doğrulama kodu. |
| `BING_SITE_VERIFICATION`  | Hayır | `undefined` | Bing Webmaster Tools doğrulama kodu. |
| `YANDEX_SITE_VERIFICATION`| Hayır | `undefined` | Yandex Webmaster doğrulama kodu. |
| `VITE_ADSENSE_CLIENT_ID`  | Hayır | `undefined` | Google AdSense yayıncı kimliği (`ca-pub-...`). Tanımsızsa reklamlar gizlenir. |
| `VITE_ADSENSE_RESULT_SLOT_ID` | Hayır | `undefined` | Oyun sonu panelindeki reklam alanı kimliği. |
| `VITE_ENABLE_VERCEL_ANALYTICS` | Hayır | `false` | Vercel Web Analytics'i etkinleştirir (`true`/`false`). Hardcoded ID içermez, sıfır çerezli gizlilik dostudur. |
| `VITE_ENABLE_VERCEL_SPEED_INSIGHTS` | Hayır | `false` | Vercel Speed Insights (RUM / Core Web Vitals) takibini etkinleştirir (`true`/`false`). Hardcoded ID içermez. |
| `VITE_VERCEL_SPEED_INSIGHTS_SAMPLE_RATE` | Hayır | `undefined` (1.0) | Speed Insights için örnekleme oranı (`0.0` - `1.0`). Free tier 10k kota kontrolü için opsiyoneldir. |
| `CRON_SECRET`             | Hayır | `undefined` | Vercel Cron Jobs otomatik çağrıları için `Bearer` yetkilendirme anahtarı. |
| `DAILY_JOB_TOKEN`         | Hayır | `undefined` | VDS crontab çağrıları (`x-sely-cron-token`) için yetkilendirme anahtarı. |

---

## Açık Kaynak Atıfları

Babylon.js, React, Tailwind CSS, Lucide simgeleri, Radix UI, tRPC, Drizzle ORM ve TDK Türkçe sözlük tarayıcısının açık kaynak lisans bildirimleri için **[ATTRIBUTION.md](ATTRIBUTION.md)** belgesini inceleyebilirsiniz.

---

## Lisans ve Marka

Bu deponun kaynak kodları **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0) kapsamında sunulmaktadır. Değiştirilmiş veya ağ üzerinden hizmet sunan türevlerin de aynı AGPL-3.0 koşullarıyla kaynak kodunu kamuya açık kılması şarttır.

`SELY.TR`, `dixtuel` markası, özgün oyun logoları, risograph stil varlıkları ve oyun konseptleri **dixtuel (SELY.TR)** mülkiyetindedir. Telif hakkı **© 2026 dixtuel**.
