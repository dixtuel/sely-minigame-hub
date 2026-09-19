# Açık Kaynak Lisans ve Atıf Bildirimleri (Attribution & Third-Party Notices)

Bu belge, **SELY MiniGame Hub** (`sely.tr`) projesinde doğrudan veya dolaylı olarak kullanılan tüm açık kaynaklı yazılımları, 3D motorlarını, grafik ve doku materyallerini, ses efektlerini, kelime ve veri setlerini, web yazı tiplerini (fontlar) ve algoritmik referansları eksiksiz bir şekilde belgeler.

Tüm üçüncü taraf bileşenlerin telif hakları, ticari markaları ve patent hakları ilgili hak sahiplerine aittir.

---

## İçindekiler

1. [Proje Lisansı ve Uyumluluk Esasları](#1-proje-lisansı-ve-uyumluluk-esasları)
2. [Oyun İçi Ses Varlıkları (Audio - TASL)](#2-oyun-içi-ses-varlıkları-audio---tasl)
3. [3D Dokular ve Yüzey Materyalleri (Textures - TASL)](#3-3d-dokular-ve-yüzey-materyalleri-textures---tasl)
4. [Sözlükler, Kelime Havuzları ve Dil Veri Setleri](#4-sözlükler-kelime-havuzları-ve-dil-veri-setleri)
5. [Tipografi ve Yazı Tipleri (Fonts)](#5-tipografi-ve-yazı-tipleri-fonts)
6. [3D Grafik ve Render Motorları](#6-3d-grafik-ve-render-motorları)
7. [Yazılım Kütüphaneleri ve Bağımlılık Matrisi](#7-yazılım-kütüphaneleri-ve-bağımlılık-matrisi)
8. [Algoritmik, Matematiksel ve Tasarım Referansları](#8-algoritmik-matematiksel-ve-tasarım-referansları)
9. [Tam Açık Kaynak Lisans Metinleri](#9-tam-açık-kaynak-lisans-metinleri)

---

## 1. Proje Lisansı ve Uyumluluk Esasları

SELY MiniGame Hub kaynak kodları **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0) kapsamında sunulmaktadır.

Bu depoda kullanılan üçüncü taraf bileşenler (kütüphaneler, dokular, sesler, fontlar ve sözlükler) AGPL-3.0 ile tamamen uyumlu olan permissive (izin verici) ve kamu malı lisanslar altındadır:
- **MIT Lisansı** (`MIT`)
- **Apache License 2.0** (`Apache-2.0`)
- **ISC Lisansı** (`ISC`)
- **BSD 2-Clause & 3-Clause Lisansları** (`BSD-2-Clause`, `BSD-3-Clause`)
- **SIL Open Font License 1.1** (`OFL-1.1`)
- **Creative Commons Zero 1.0 Universal** (`CC0-1.0` / Public Domain)
- **Public Domain Dedications** (ENABLE, Wordle Guess Lexicon)

---

## 2. Oyun İçi Ses Varlıkları (Audio - TASL)

Yankı Odası (Echo Room) 3D oyununda kullanılan fiziksel ses efektleri, açık kaynak oyun geliştirme topluluğunun saygın varlık üreticisi **Kenney** tarafından sağlanan paketlerden derlenmiştir.

Uluslararası **TASL** (Title, Author, Source, License) atıf çerçevesine uygun detaylı varlık dökümü:

| Yerel Dosya Yolu | Varlık Başlığı (Title) | Yazar / Hak Sahibi (Author) | Kaynak Bağlantısı (Source) | Lisans (License) | Değişiklik / İşleme (Modifications) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `client/public/assets/audio/footstep-00.ogg` | RPG Audio: `footstep00.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Dosya adı web dizin standardına göre düzenlendi |
| `client/public/assets/audio/footstep-01.ogg` | RPG Audio: `footstep01.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Dosya adı web dizin standardına göre düzenlendi |
| `client/public/assets/audio/footstep-02.ogg` | RPG Audio: `footstep02.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Dosya adı web dizin standardına göre düzenlendi |
| `client/public/assets/audio/footstep-03.ogg` | RPG Audio: `footstep04.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Dosya adı web dizin standardına göre düzenlendi |
| `client/public/assets/audio/gate-open.ogg` | RPG Audio: `doorOpen_1.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Çıkış kapısı tetikleyicisi için optimize edildi |
| `client/public/assets/audio/echo-pulse.ogg` | Interface Sounds: `glass_002.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Sonar darbe yankısı olarak eşlendi |
| `client/public/assets/audio/mark-collect.ogg` | Interface Sounds: `confirmation_002.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Glif/anahtar toplama geri bildirimi olarak eşlendi |
| `client/public/assets/audio/listener-caught.ogg` | Interface Sounds: `error_004.ogg` | Kenney ([Kenney.nl](https://kenney.nl)) | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) | Yakalanma ve tur sonu uyarısı olarak eşlendi |

### Web Audio API Prosedürel Ses Sentezleme (Harici Dosyasız Mimari)
SELY MiniGame Hub, ağ yükünü en aza indirmek ve gecikmesiz ses üretimi sağlamak için harici örnek dosyalar yerine tarayıcının yerel **Web Audio API** modülünü kullanarak prosedürel ses sentezleme tekniğini benimser:
- **`client/src/lib/sfx.ts`:**
  - `playStamp`: Hane damga onay sesi (640–1000 Hz üçgen ve sinüs osilatörleri).
  - `playHit`: Kıvılcım çarpma darbesi (170 Hz testere ve 85 Hz kare dalga frekans kayması).
  - `playThrust`: Kıvılcım dikey ivme sesi (210 Hz kısa kare dalga darbesi).
  - `playComplete`: Seviye tamamlama arpeji (C5 523 Hz, E5 659 Hz, G5 784 Hz, C6 1046 Hz üçgen dalga harmonisi).
  - `playFail`: Seviye başarısızlık tonu (220 Hz'den 60 Hz'e üstel sönen testere dalgası).
  - `playAccuse` & `playContradiction`: Vaka sorgu ve çelişki tespit akorları (340 Hz kare, 880/1320 Hz üçgen dalga).
  - `playSlice`: Kırpık çokgen kesme hışırtısı (1100 Hz ve 740 Hz frekans rampalı çift dalga).
- **`client/src/game/audio.ts`:**
  - Yankı Odası düşük frekanslı dinamik ortam uğultusu (`startDrone`: 48 Hz ve 72 Hz sinüs osilatörleri, rastgele dalgalanan kazanç katmanı).
- **`client/src/components/SparkCanvasGame.tsx`:**
  - Elektrik arkı zıplama (460–840 Hz sinüs rampası), pilon geçiş harmonik tonu (523/659 Hz üçgen) ve ark boşalma çarpışması (160–35 Hz testere dalga).

*Not: Prosedürel olarak sentezlenen sesler saf matematiksel dalga formları olup herhangi bir harici ses kaydı, telif hakkı veya lisans yükümlülüğü içermez.*

---

## 3. 3D Dokular ve Yüzey Materyalleri (Textures - TASL)

Yankı Odası (Echo Room) 3D labirentinde kullanılan PBR (Physically Based Rendering) materyalleri, fotogerçekçi açık kaynak doku arşivi **ambientCG** üzerinden temin edilmiştir:

| Yerel Dosya Yolu | Varlık Başlığı (Title) | Yazar / Hak Sahibi (Author) | Kaynak Bağlantısı (Source) | Lisans (License) | Değişiklik / İşleme (Modifications) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `client/public/assets/textures/stone-wall-color.jpg` | Rock030 Color Map | Lennart Demes ([ambientCG](https://ambientcg.com)) | [ambientCG Rock030](https://ambientcg.com/a/Rock030) | [CC0 1.0 Universal](https://docs.ambientcg.com/license/) | Orijinal 1K PNG dokudan 512×512 piksel JPEG formatına optimize edildi |
| `client/public/assets/textures/stone-wall-normal.jpg` | Rock030 NormalDX Map | Lennart Demes ([ambientCG](https://ambientcg.com)) | [ambientCG Rock030](https://ambientcg.com/a/Rock030) | [CC0 1.0 Universal](https://docs.ambientcg.com/license/) | Orijinal 1K PNG dokudan 512×512 piksel JPEG formatına optimize edildi |
| `client/public/assets/textures/floor-basalt-color.jpg` | Ground068 Color Map | Lennart Demes ([ambientCG](https://ambientcg.com)) | [ambientCG Ground068](https://ambientcg.com/a/Ground068) | [CC0 1.0 Universal](https://docs.ambientcg.com/license/) | Orijinal 1K PNG dokudan 512×512 piksel JPEG formatına optimize edildi |
| `client/public/assets/textures/floor-basalt-normal.jpg` | Ground068 NormalDX Map | Lennart Demes ([ambientCG](https://ambientcg.com)) | [ambientCG Ground068](https://ambientcg.com/a/Ground068) | [CC0 1.0 Universal](https://docs.ambientcg.com/license/) | Orijinal 1K PNG dokudan 512×512 piksel JPEG formatına optimize edildi |

*Telif Feragatı: ambientCG dokuları CC0 1.0 Universal kapsamında sunulmakta olup yasal olarak atıf şartı bulunmamaktadır; şeffaflık ve kaynak izlenebilirliği amacıyla belgelenmiştir.*

---

## 4. Sözlükler, Kelime Havuzları ve Dil Veri Setleri

Hane oyununun harf/kelime modunda oyuncuların girdiği tahminlerin geçerliliğini denetlemek için (gerçek Wordle standartlarında "solutions" ve "allowed-guesses" ayrımıyla) kapsamlı açık kaynak ve kamu malı sözlük veri setleri derlenmiştir:

### 1. TDK Kamusal Türkçe Sözlük Madde Başları (Türkçe Modu)
- **Kullanım:** `HANE_WORD_GUESS_LISTS_TR` — Hane Türkçe tahmin doğrulama sözlüğü (`client/src/lib/haneWordLists.ts`).
- **Veri Derleyicisi:** `ncarkaci/TDKDictionaryCrawler` (Nurettin Sadık Çarkacı)
- **Kaynak Veri:** Türk Dil Kurumu (TDK) çevrimiçi güncel sözlüğünden kamuya açık biçimde toplanmış madde başları.
- **Kapsam:** 4 harfli (1.971 geçerli kelime) ve 5 harfli (5.242 geçerli kelime) temizlenmiş sözlük havuzu.
- **Lisans:** MIT Lisansı
- **Kaynak:** https://github.com/ncarkaci/TDKDictionaryCrawler

### 2. ENABLE — Enhanced North American Benchmark Lexicon (İngilizce Modu)
- **Kullanım:** `HANE_WORD_GUESS_LISTS_EN` — Hane İngilizce tahmin doğrulama sözlüğü.
- **Yazarlar / Derleyenler:** Keith Schmidt & Alan Beale
- **Kapsam:** 3.903 adet 4 harfli ve 8.636 adet 5 harfli İngilizce sözcük.
- **Lisans:** Public Domain (Kamu Malı — herhangi bir telif veya ticari kullanım kısıtlaması yoktur).
- **Açıklama:** Scrabble ve kelime oyunu topluluklarının 1997'den bu yana temel aldığı en yaygın kamu malı İngilizce referans sözlüğü.

### 3. Wordle Allowed Guesses List (İngilizce 5 Harfli Genişletilmiş Mod)
- **Kullanım:** `HANE_WORD_GUESS_LISTS_EN[5]` — Hane İngilizce 5 harfli tahmin doğrulama havuzunun zenginleştirilmesi.
- **Köken:** Josh Wardle / Wordle kamuya açık istemci tahmin sözlüğü.
- **Kapsam:** 14.856 adet 5 harfli geçerli İngilizce tahmin sözcüğü.
- **Lisans:** Public Domain / Permissive Lexicon

*Mimari Not: Bu sözlükler yalnızca TAHMİN DOĞRULAMA (allowed guesses) için kullanılır. Günün hedef çözümleri, `client/src/lib/levelGenerators.ts` içindeki küratörlü, tematik ve anlamlı sözcük havuzlarından deterministik günlük seed ile seçilir. Ayrıca sözlük dosyası (~203KB) ana JS paket boyutunu şişirmemek için dinamik import (`import("./haneWordLists")`) ile tembel yüklenir.*

---

## 5. Tipografi ve Yazı Tipleri (Fonts)

SELY MiniGame Hub arayüzünde kullanılan tüm web yazı tipleri Google Fonts aracılığıyla **SIL Open Font License 1.1** (OFL-1.1) koşulları altında sunulmaktadır:

| Yazı Tipi Ailesi (Font Family) | Tasarımcı / Dökümhane (Designer) | Lisans | Kullanım Alanı ve CSS Değişkeni | Kaynak Depo |
| :--- | :--- | :--- | :--- | :--- |
| **Bricolage Grotesque** | Mathieu Triay | SIL OFL 1.1 | Başlıklar, editoryal katalog kartları ve büyük skor sayaçları (`--font-display`) | [ateliertriay/bricolage](https://github.com/ateliertriay/bricolage) |
| **DM Mono** | Colophon Foundry | SIL OFL 1.1 | Monospace kayıt fişleri, HUD panelleri, tuş takımı ve oyun içi kodlar (`--font-mono`) | [googlefonts/dm-fonts](https://github.com/googlefonts/dm-fonts) |
| **Space Grotesk** | Florian Karsten | SIL OFL 1.1 | Yankı Odası (Echo Room) 3D arayüzü, pusula, durum göstergeleri ve wayfinding paneli | [floriankarsten/space-grotesk](https://github.com/floriankarsten/space-grotesk) |

*OFL Bildirimi: SIL Open Font License 1.1 uyarınca yazı tipleri tek başlarına satılamaz; bu yazılım projesiyle birlikte özgürce dağıtılmakta ve kullanılmaktadır. Orijinal Reserved Font Name (RFN) hakları korunmuştur.*

---

## 6. 3D Grafik ve Render Motorları

### [Babylon.js Core](https://www.babylonjs.com/) (`@babylonjs/core`)
- **Rol:** Yankı Odası (Echo Room) 3D labirentinin prosedürel olarak oluşturulması, WebGL/WebGPU render döngüsü, dinamik nokta ve spot ışıklandırmaları, görüş alanı (fog-of-war) simülasyonu, PBR materyal işleme ve ArcRotateCamera yönetimi.
- **Sürüm:** `^9.22.2`
- **Lisans:** Apache License 2.0
- **Telif Hakkı:** Copyright (c) 2013-2026 BabylonJS
- **Kaynak:** https://github.com/BabylonJS/Babylon.js

### [Three.js](https://threejs.org/) & [React Three Fiber](https://r3f.docs.pmnd.rs/) (`three`, `@react-three/fiber`, `@react-three/drei`)
- **Rol:** 3D sahne bileşenleri, geometri işleme ve kamera matris yönetimi.
- **Sürümler:** `three: ^0.185.1`, `@react-three/fiber: ^9.7.0`, `@react-three/drei: ^10.7.8`
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2010-2026 Three.js Authors; Copyright (c) 2019-2026 pmndrs
- **Kaynak:** https://github.com/mrdoob/three.js | https://github.com/pmndrs/react-three-fiber

---

## 7. Yazılım Kütüphaneleri ve Bağımlılık Matrisi

Aşağıdaki tablo, projede kullanılan doğrudan kod kütüphanelerini, sürümlerini, lisanslarını ve işlevlerini listeler:

| Paket Adı | Sürüm | SPDX Lisans | Telif Hakkı Sahibi | Sorumluluk / İşlev |
| :--- | :--- | :--- | :--- | :--- |
| `react` & `react-dom` | `^19.2.1` | `MIT` | Meta Platforms, Inc. and affiliates | Çekirdek UI kütüphanesi, Virtual DOM ve bileşen mimarisi |
| `vite` | `^7.1.7` | `MIT` | Yuxi (Evan) You & Vite contributors | İstemci tarafı modül paketleyici, HMR ve derleme sistemi |
| `tailwindcss` | `^4.1.14` | `MIT` | Tailwind Labs, Inc. | Utility-first CSS motoru ve tasarım sistemi |
| `wouter` | `^3.3.5` | `MIT` | Alexey Taktarov | Minimalist (~1.5KB), hafif ve dependency-free SPA yönlendiricisi |
| `lucide-react` | `^0.453.0` | `ISC` | Lucide Contributors | Arayüz, kontrol ve oyun navigasyon simgeleri |
| `framer-motion` | `^12.23.22` | `MIT` | Framer B.V. | Arayüz geçişleri ve akıcı etkileşim animasyonları |
| `@tanstack/react-query` | `^5.90.2` | `MIT` | TanStack (Tanner Linsley) | Asenkron sunucu durumu yönetimi ve önbellekleme |
| `@trpc/server` & `@trpc/client` | `^11.6.0` | `MIT` | Alex Johansson and tRPC contributors | Uçtan uca tip güvenli RPC API haberleşmesi |
| `drizzle-orm` | `^0.44.5` | `Apache-2.0` | Drizzle Team | Tip güvenli SQL sorgu ve şema modelleme katmanı |
| `drizzle-kit` | `^0.31.4` | `Apache-2.0` | Drizzle Team | Veritabanı şema migrasyon ve yönetim araçları |
| `@libsql/client` | `^0.17.4` | `MIT` | ChiselStrike, Inc. / Turso | Sunucusuz libSQL / SQLite veritabanı sürücüsü |
| `pg` | `^8.23.0` | `MIT` | Brian Carlson | PostgreSQL istemci sürücüsü |
| `express` | `^4.21.2` | `MIT` | StrongLoop, Inc. & contributors | HTTP sunucu ve arka uç REST yönlendirme katmanı |
| `zod` | `^4.1.12` | `MIT` | Colin McDonnell | Tip güvenli şema ve girdi doğrulama kütüphanesi |
| `sonner` | `^2.0.7` | `MIT` | Emil Kowalski | Erişilebilir görsel bildirim (toast) sistemi |
| `cmdk` | `^1.1.1` | `MIT` | Paco Coursey | Hızlı komut ve arama paleti arayüzü |
| `recharts` | `^2.15.2` | `MIT` | Recharts Group | İstatistik ve performans veri görselleştirmeleri |
| `embla-carousel-react` | `^8.6.0` | `MIT` | Petter Hedman | Akıcı dokunmatik karusel bileşeni |
| `vaul` | `^1.1.2` | `MIT` | Emil Kowalski | Mobil alt çekmece (drawer) bileşeni |
| `@radix-ui/react-*` | `1.x` | `MIT` | WorkOS | WAI-ARIA uyumlu ilkel UI bileşenleri (Dialog, Tooltip, Tabs vb.) |
| `clsx` & `tailwind-merge` | `2.x / 3.x` | `MIT` | Luke Edwards / Dany Castillo | Koşullu ve çakışmasız Tailwind sınıf birleştirme |
| `date-fns` | `^4.1.0` | `MIT` | Sasha Koss & Lesha Koss | Tarih, saat ve günlük tohum formatlama araçları |
| `nanoid` | `^5.1.5` | `MIT` | Andrey Sitnik | Kriptografik güvenli benzersiz kimlik üretimi |
| `vitest` | `^2.1.4` | `MIT` | Anthony Fu & Vitest contributors | Birim, entegrasyon ve çözülebilirlik stres test koşucusu |
| `typescript` | `5.9.3` | `Apache-2.0` | Microsoft Corporation | Statik tip denetimi ve geliştirme araç seti |
| `esbuild` | `^0.25.0` | `MIT` | Evan Wallace | Ultra hızlı sunucu derleme ve paketleme aracı |

---

## 8. Algoritmik, Matematiksel ve Tasarım Referansları

SELY MiniGame Hub'daki yedi mini oyunun temelini oluşturan algoritmik ve matematiksel referanslar:

### 1. Recursive Backtracker & Braiding Labirent Mimarisi (Echo Room)
- **Kaynak / Referans:** Jamis Buck — *Mazes for Programmers* & Recursive Depth-First Search Maze Generation.
- **Uygulama (`client/src/game/maze.ts`):** 
  - Deterministik günlük seed tabanlı `generateMaze` fonksiyonu.
  - Labirent çıkmaz sokaklarının (dead-ends) oyuncu ustalık seviyesine (`mastery`) göre açılarak döngüsel alternatif koridorlara dönüştürülmesi (*braiding*).
  - A* / BFS koridor rota hesaplayıcısı (`findMazePath`) ile oyuncunun anahtarlara ve kilitli çıkış kapısına ulaşabilirliğinin matematiksel ispatı.

### 2. Spanning Tree Akış Yönlendirmesi ve BFS Çözücü (Knot / Düğüm)
- **Uygulama (`client/src/lib/levelGenerators.ts`):**
  - Randomized DFS Spanning Tree algoritmasıyla 4×4 karo ızgarası üzerinde döngüsüz, tekil birincil akış rotası oluşturulması.
  - BFS (Breadth-First Search) kuyruk çözücüsü (`isKnotLevelSolvable`) ile ısı limiti (`heatLimit`) dahilinde rotanın ve opsiyonel bonus karolarının daima çözülebilir olduğunun garantilenmesi.

### 3. Konveks Çokgen Kesme ve Açısal Örnekleme (Cut / Kırpık)
- **Uygulama (`client/src/lib/levelGenerators.ts` & `client/src/components/GameStudio.tsx`):**
  - Rejection sampling ile belirlenen içbükey/dışbükey çokgen sınırları.
  - Çokgenin düzlem üzerinde bir doğru ile kesilmesi (Sutherland-Hodgman polygon clipping türevi) ve kalan alanların orantısal yüzdesinin hesaplanması.

### 4. Zaman Gecikmeli Gölge Hafıza Matrisi (Shadow Share / Gölge Payı)
- **Uygulama (`client/src/lib/levelGenerators.ts`):**
  - 5×5 ızgara üzerinde oyuncu hareketlerinin $N$ adım gecikmeli gölge izdüşümüyle eşzamanlı simülasyonu.
  - Ters polarite karoları (`is-inverse`) ve eşzamanlı hedef aktivasyon matrisi.

### 5. Tümdengelimsel Çelişki Grafı ve Kanıt Çözücü (Vaka / VakaHub)
- **Uygulama (`client/src/lib/vakaEngine.ts` & `shared/vakaCases.ts`):**
  - World Model + Truth Model + Evidence Graph dedektiflik mantık motoru.
  - Şüpheli ifadeleri, tanık beyanları ve fiziksel deliller arasındaki çelişkileri bağımsız olarak puanlayan ve tek bir suçluya indirgeyen grafik tabanlı çözücü (`solveVakaCase`).

### 6. İki Geçişli Frekans Eşleme Algoritması (Hane)
- **Uygulama (`client/src/lib/levelGenerators.ts`):**
  - Wordle ve Mastermind kural motorlarına dayanan iki geçişli (two-pass) harf değerlendirme algoritması (`compareHaneWordGuess`).
  - Birinci geçişte tam eşleşmeler (`exact`) işaretlenir; ikinci geçişte hedefte kalan harf frekansları üzerinden izde kalanlar (`present`) tüketilir. Bu sayede tekrarlanan harfler asla hedeften fazla sayılmaz.

### 7. Delta-Time Arcade Uçuş ve Fizik Mimarisi (Spark / Kıvılcım)
Kıvılcım (Spark) oyununun 60 FPS Canvas render motoru ve pilon kaçış mekaniği geliştirilirken incelenen ve faydalanılan açık kaynak arcade projeleri:
- **[Serkanbyx/flappy-bird](https://github.com/Serkanbyx/flappy-bird):** (MIT Lisansı) — Saf JavaScript & HTML5 Canvas ile delta-time tabanlı yerçekimi ($g$), zıplama ivmesi ve pilon hız senkronizasyonu mimarisi.
- **[robert-kratz/flappy-bird](https://github.com/robert-kratz/flappy-bird):** (Apache-2.0 Lisansı) — Ardışık engeller arası dikey açıklık farkını sınırlandırma (`maxDelta = 140` clamping) tekniği.
- **[JohnDev19/Flappy-Ball](https://github.com/JohnDev19/Flappy-Ball):** (MIT Lisansı) — Dairesel gövde ile dikdörtgen engeller arasında hibrit AABB toleranslı çarpışma geometrisi.
- **[wayou/t-rex-runner](https://github.com/wayou/t-rex-runner):** (BSD-3-Clause) — Sonsuz koşu/uçuş döngüsü ve prosedürel hız eskalasyonu.

---

## 9. Tam Açık Kaynak Lisans Metinleri

### 1. MIT Lisansı (MIT License)

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 2. Apache License 2.0

```text
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.
"License" shall mean the terms and conditions for use, reproduction, and distribution
as defined by Sections 1 through 9 of this document.
"Licensor" shall mean the copyright owner or entity authorized by the copyright
owner that is granting the License.
"Legal Entity" shall mean the union of the acting entity and all other entities
that control, are controlled by, or are under common control with that entity.

2. Grant of Copyright License.
Subject to the terms and conditions of this License, each Contributor hereby grants
to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable
copyright license to reproduce, prepare Derivative Works of, publicly display,
publicly perform, sublicense, and distribute the Work and such Derivative Works
in Source or Object form.

3. Grant of Patent License.
Subject to the terms and conditions of this License, each Contributor hereby grants
to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable
patent license to make, have made, use, offer to sell, sell, import, and otherwise
transfer the Work.

4. Redistribution.
You may reproduce and distribute copies of the Work or Derivative Works thereof in
any medium, with or without modifications, and in Source or Object form, provided
that You meet the following conditions:
(a) You must give any other recipients of the Work or Derivative Works a copy of this License; and
(b) You must cause any modified files to carry prominent notices stating that You changed the files; and
(c) You must retain, in the Source form of any Derivative Works that You distribute, all copyright,
    patent, trademark, and attribution notices from the Source form of the Work; and
(d) If the Work includes a "NOTICE" text file as part of its distribution, then any Derivative Works
    that You distribute must include a readable copy of the attribution notices contained within
    such NOTICE file.

5. Disclaimer of Warranty.
Unless required by applicable law or agreed to in writing, Licensor provides the Work
(and each Contributor provides its Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES
OR CONDITIONS OF ANY KIND, either express or implied.
```

---

### 3. ISC Lisansı (ISC License)

```text
ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

---

### 4. SIL Open Font License 1.1 (OFL-1.1)

```text
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide development
of collaborative font projects, to support the font creation efforts of academic
and linguistic communities, and to provide a free and open framework in which
fonts may be shared and improved in partnership with others.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a copy
of the Font Software, to use, study, copy, merge, embed, modify, redistribute,
and sell modified and unmodified copies of the Font Software, subject to the
following conditions:

1) Neither the Font Software nor any of its individual components, in Original
or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled, redistributed
and/or sold with any software, provided that each copy contains the above copyright
notice and this license.

3) No Modified Version of the Font Software may use the Reserved Font Name(s)
unless explicit written permission is granted by the corresponding Copyright Holder.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software
shall not be used to promote, endorse or advertise any Modified Version.

TERMINATION & DISCLAIMER
This license becomes null and void if any of the above conditions are not met.
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT,
TRADEMARK, OR OTHER RIGHT.
```

---

### 5. Creative Commons Zero v1.0 Universal (CC0 1.0)

```text
Creative Commons Legal Code
CC0 1.0 Universal

CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE LEGAL SERVICES.
DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN ATTORNEY-CLIENT RELATIONSHIP.

Statement of Purpose
The laws of most jurisdictions throughout the world automatically confer exclusive
Copyright and Related Rights upon the creator and subsequent owner(s) of an original work.

Certain owners wish to permanently relinquish those rights to a work for the purpose
of contributing to a commons of creative, cultural and scientific works that the public
can reliably and without fear of later claims of infringement build upon, modify,
incorporate in other works, reuse and redistribute as freely as possible in any form
whatsoever and for any purposes, including without limitation commercial purposes.

Affirmation of Surrender
To the greatest extent permitted by, but not in contravention of, applicable law,
Affirmer hereby overtly, fully, permanently, irrevocably and unconditionally
waives, abandons, and surrenders all of Affirmer's Copyright and Related Rights
and associated claims and causes of action, whether now known or unknown, in the
work for the benefit of each and every member of the public and to the detriment
of Affirmer's heirs and successors.
```

---

### 6. BSD 3-Clause License

```text
BSD 3-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## 10. İletişim ve Lisans Denetimi

Bu belgedeki bildirimler, açık kaynak topluluğunun şeffaflık, izlenebilirlik ve telif haklarına saygı ilkeleri uyarınca düzenli olarak denetlenir ve güncellenir. 

Eksik veya güncellenmesi gereken herhangi bir atıf bildirimi tespit etmeniz halinde, lütfen projenin GitHub deposu üzerinden bir Issue veya Pull Request açarak bildirin.
