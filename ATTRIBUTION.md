# Açık Kaynak Lisans ve Atıf Bildirimleri (Attribution)

Bu belge, **SELY MiniGame Hub** projesinde doğrudan veya dolaylı olarak kullanılan açık kaynaklı kütüphaneleri, 3D motorlarını, grafik kütüphanelerini, yazı tiplerini ve algoritmik referansları listeler. Tüm bileşenlerin telif hakları ilgili hak sahiplerine aittir.

---

## 1. 3D Motoru ve Grafik Kütüphaneleri

### [Babylon.js](https://www.babylonjs.com/)
- **Kullanım:** Yankı Odası (Echo Room) 3D labirent motoru, dinamik ışıklandırma, sis perdesi (fog-of-war) ve kamera yönetimi (`@babylonjs/core`).
- **Lisans:** Apache License 2.0
- **Telif Hakkı:** Copyright (c) 2013-2026 BabylonJS
- **Web Sitesi:** https://github.com/BabylonJS/Babylon.js

### [Lucide Icons](https://lucide.dev/)
- **Kullanım:** Arayüz ve oyun simgeleri (`lucide-react`).
- **Lisans:** ISC Lisansı
- **Telif Hakkı:** Copyright (c) 2022-2026 Lucide Contributors

---

## 2. Temel Çerçeveler ve Runtime

### [React & React DOM](https://react.dev/)
- **Kullanım:** Kullanıcı arayüzü bileşen mimarisi (React 19).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) Meta Platforms, Inc. and affiliates.

### [Vite](https://vitejs.dev/)
- **Kullanım:** İstemci tarafı derleme ve geliştirme sunucusu.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2019-present Yuxi (Evan) You and Vite contributors

### [Wouter](https://github.com/molefrog/wouter)
- **Kullanım:** Minimalist ve hafif istemci yönlendiricisi.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2018 Alexey Taktarov

### [Tailwind CSS](https://tailwindcss.com/)
- **Kullanım:** Stil ve duyarlı arayüz tasarımı.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) Tailwind Labs, Inc.

### [Radix UI Primitives](https://www.radix-ui.com/)
- **Kullanım:** Erişilebilir ve stil verilebilir arayüz bileşenleri (Dialog, Dropdown, Tooltip vb.).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2022 WorkOS

---

## 3. Backend, Veritabanı ve API

### [tRPC](https://trpc.io/)
- **Kullanım:** Uçtan uca tip güvenli RPC API katmanı (`@trpc/server`, `@trpc/client`).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2020-present Alex Johansson and tRPC contributors

### [Drizzle ORM](https://orm.drizzle.team/)
- **Kullanım:** PostgreSQL ve libSQL tip güvenli veritabanı ORM katmanı.
- **Lisans:** Apache License 2.0
- **Telif Hakkı:** Copyright (c) 2023 Drizzle Team

### [Express](https://expressjs.com/)
- **Kullanım:** Node.js arka uç HTTP yönlendirme katmanı.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) StrongLoop, Inc., and other expressjs.com contributors

### [TanStack React Query](https://tanstack.com/query)
- **Kullanım:** Asenkron veri alma, önbellekleme ve durum yönetimi.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) TanStack

---

## 4. Test ve Doğrulama Araçları

### [Vitest](https://vitest.dev/)
- **Kullanım:** Birim, entegrasyon ve prosedürel seviye çözülebilirlik stres testleri.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2021-present Anthony Fu and Vitest contributors

---

## 5. Algoritmik ve Tasarım Referansları

### Recursive Backtracker Maze Generation
- **Kullanım:** Yankı Odası (Echo) labirentinin prosedürel olarak üretilmesi ve zorluğa göre braiding (döngü/alternatif yol) eklenmesi (`client/src/game/maze.ts`).
- **Açıklama:** Deterministik günlük seed tabanlı, çözülebilirliği matematiksel olarak garantilenen labirent algoritması.

### Deterministik Prosedürel Bulmaca Üreticileri
- **Kullanım:** Knot (topolojik çizgi akışı), Cut (açısal dilimleme), Shadow (gecikmeli gölge matrisi), Vaka (çelişki grafı çözücüsü), Hane (harf/sayı kısıt motoru) ve Spark (elektrik arkı / pilon kaçış fiziği).
- **Açıklama:** Seed ve mastery parametreleriyle her gün tekil ve kesinlikle çözülebilir seviyeler üreten algoritmalar.

### [ncarkaci/TDKDictionaryCrawler](https://github.com/ncarkaci/TDKDictionaryCrawler)
- **Kullanım:** Hane oyununda tahmin geçerliliği denetimi için kullanılan 76.187 kelimelik kapsamlı Türkçe sözlük veri seti (`client/src/lib/haneWordLists.ts`).
- **Lisans:** MIT Lisansı / Açık Kaynak Referans
- **Web Sitesi:** https://github.com/ncarkaci/TDKDictionaryCrawler

### [Serkanbyx/flappy-bird](https://github.com/Serkanbyx/flappy-bird) & Açık Kaynak Arcade Uçuş Motorları
- **Kullanım:** Kıvılcım (Spark) oyununun delta-time bağımsız fizik döngüsü, Web Audio API prosedürel ses sentezleyicisi (`sine`/`sawtooth`/`triangle` dalga osilatörleri) ve dokunmatik tuval entegrasyonu.
- **İncelenen Referanslar:** Serkanbyx/flappy-bird (MIT), robert-kratz/flappy-bird (Apache-2.0), JohnDev19/Flappy-Ball (MIT).
- **Lisans:** MIT Lisansı / Açık Kaynak

---

## 6. Lisans Bildirimi

Yukarıda listelenen bileşenlerin kendi lisans koşulları saklı kalmak kaydıyla, SELY MiniGame Hub kaynak kodu **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0) kapsamında sunulmaktadır.
