# Açık Kaynak Lisans ve Atıf Bildirimleri (Attribution)

Bu belge, **SELY MiniGame Hub** (`sely.tr`) projesinde doğrudan veya dolaylı olarak kullanılan açık kaynaklı yazılımları, 3D motorlarını, grafik ve ses kütüphanelerini, veri setlerini ve algoritmik referansları listeler. Tüm bileşenlerin telif hakları ilgili hak sahiplerine aittir.

---

## 1. 3D Motoru ve Grafik Kütüphaneleri

### [Babylon.js](https://www.babylonjs.com/)
- **Kullanım:** Yankı Odası (Echo Room) 3D prosedürel labirent motoru, dinamik ışıklandırma, sis perdesi (fog-of-war), kamera yönetimi ve WebGL/WebGPU render döngüsü (`@babylonjs/core`).
- **Lisans:** Apache License 2.0
- **Telif Hakkı:** Copyright (c) 2013-2026 BabylonJS
- **Kaynak:** https://github.com/BabylonJS/Babylon.js

### [Lucide Icons](https://lucide.dev/)
- **Kullanım:** Arayüz, kontrol ve oyun navigasyon simgeleri (`lucide-react`).
- **Lisans:** ISC Lisansı
- **Telif Hakkı:** Copyright (c) 2022-2026 Lucide Contributors
- **Kaynak:** https://github.com/lucide-icons/lucide

---

## 2. Temel Çerçeveler ve Runtime

### [React & React DOM](https://react.dev/)
- **Kullanım:** Bileşen mimarisi, Virtual DOM ve kullanıcı arayüzü yaşam döngüsü (React 19).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) Meta Platforms, Inc. and affiliates.
- **Kaynak:** https://github.com/facebook/react

### [Vite](https://vitejs.dev/)
- **Kullanım:** İstemci tarafı modül paketleyici, HMR ve üretim optimizasyonu.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2019-present Yuxi (Evan) You and Vite contributors
- **Kaynak:** https://github.com/vitejs/vite

### [Wouter](https://github.com/molefrog/wouter)
- **Kullanım:** Minimalist (~1.5KB), hafif ve dependency-free istemci yönlendiricisi (resmi upstream sürüm).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2018 Alexey Taktarov
- **Kaynak:** https://github.com/molefrog/wouter

### [Tailwind CSS](https://tailwindcss.com/)
- **Kullanım:** Utility-first stil motoru, editoryal tipografi ve responsive düzenleme.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) Tailwind Labs, Inc.
- **Kaynak:** https://github.com/tailwindlabs/tailwindcss

### [Radix UI Primitives](https://www.radix-ui.com/)
- **Kullanım:** WAI-ARIA uyumlu, erişilebilir ilkel bileşenler (Dialog, Tooltip, Sonner, Dropdown).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2022 WorkOS
- **Kaynak:** https://github.com/radix-ui/primitives

---

## 3. Arka Uç, Veritabanı ve Ağ İletişimi

### [tRPC](https://trpc.io/)
- **Kullanım:** İstemci ile sunucu arasında uçtan uca tip güvenli RPC haberleşmesi (`@trpc/server`, `@trpc/client`).
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2020-present Alex Johansson and tRPC contributors
- **Kaynak:** https://github.com/trpc/trpc

### [Drizzle ORM](https://orm.drizzle.team/)
- **Kullanım:** PostgreSQL ve libSQL tip güvenli veritabanı ORM katmanı.
- **Lisans:** Apache License 2.0
- **Telif Hakkı:** Copyright (c) 2023 Drizzle Team
- **Kaynak:** https://github.com/drizzle-team/drizzle-orm

### [Express](https://expressjs.com/)
- **Kullanım:** Vercel Serverless ve Node.js arka uç HTTP yönlendirme katmanı.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) StrongLoop, Inc., and other expressjs.com contributors
- **Kaynak:** https://github.com/expressjs/express

### [TanStack React Query](https://tanstack.com/query)
- **Kullanım:** Asenkron veri alma, önbellekleme ve durum yönetimi.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) TanStack
- **Kaynak:** https://github.com/TanStack/query

---

## 4. Test ve Doğrulama Araçları

### [Vitest](https://vitest.dev/)
- **Kullanım:** Birim, entegrasyon ve prosedürel seviye çözülebilirlik stres testleri.
- **Lisans:** MIT Lisansı
- **Telif Hakkı:** Copyright (c) 2021-present Anthony Fu and Vitest contributors
- **Kaynak:** https://github.com/vitest-dev/vitest

---

## 5. Algoritmik, Matematiksel ve Tasarım Referansları

### Recursive Backtracker Maze Generation
- **Kullanım:** Yankı Odası (Echo) 3D labirentinin prosedürel olarak üretilmesi ve zorluğa göre braiding (döngü/alternatif yol) eklenmesi (`client/src/game/maze.ts`).
- **Açıklama:** Deterministik günlük seed tabanlı, çözülebilirliği matematiksel olarak garantilenen labirent algoritması.

### Deterministik Prosedürel Bulmaca Üreticileri & Çözücüleri
- **Kullanım:**
  - **Düğüm (Knot):** Randomized DFS Spanning Tree üzerinden yönlendirilmiş akış rotası ve BFS çözülebilirlik doğrulayıcısı (`isKnotLevelSolvable`).
  - **Kırpık (Cut):** Rejection-sampling ile açısal çokgen ve hareketli kâğıt dilimleme motoru.
  - **Gölge Payı (Shadow):** Zaman gecikmeli gölge matrisi ve hedef eşleme simülatörü.
  - **Vaka:** World Model + Truth Model + Evidence Graph. Dedektiflik çelişki grafı ve bağımsız kanıt çözücüsü (`solveVakaCase`).
  - **Hane:** Deterministik harf/sayı kısıt motoru ve entropi denetimi.
  - **Kıvılcım:** Elektrik arkı / pilon kaçış fiziği, dikey açıklık kısıtı (`maxDelta = 140` clamp) ve daire-kutu hibrit çarpışma toleransı.
- **Açıklama:** Seed ve mastery parametreleriyle her gün tekil ve kesinlikle çözülebilir seviyeler üreten algoritmalar.

### [ncarkaci/TDKDictionaryCrawler](https://github.com/ncarkaci/TDKDictionaryCrawler)
- **Kullanım:** Hane oyununda tahmin geçerliliği denetimi için kullanılan 76.187 kelimelik kapsamlı Türkçe sözlük veri seti (`client/src/lib/haneWordLists.ts`).
- **Lisans:** MIT Lisansı
- **Kaynak:** https://github.com/ncarkaci/TDKDictionaryCrawler

### Açık Kaynak Arcade Uçuş ve Fizik Motorları
Kıvılcım (Spark) oyununun baştan aşağı yenilenmesi sürecinde incelenen ve delta-time fizik adımı, toleranslı çarpışma kontrolü ile Web Audio API sentezleme mimarisine ilham veren projeler:
- **[Serkanbyx/flappy-bird](https://github.com/Serkanbyx/flappy-bird):** (Lisans: MIT) — Saf JavaScript & Canvas ile delta-time tabanlı yerçekimi, zıplama ivmesi ve pilon hizalama mimarisi.
- **[robert-kratz/flappy-bird](https://github.com/robert-kratz/flappy-bird):** (Lisans: Apache-2.0) — Ardışık engeller arası yükseklik farkı kısıtlama (dikey delta clamping) ve aerodinamik geçilebilirlik garantisi.
- **[JohnDev19/Flappy-Ball](https://github.com/JohnDev19/Flappy-Ball):** (Lisans: MIT) — Dairesel gövde ile dikdörtgen engeller arasında hibrit AABB toleranslı çarpışma matematiği.
- **[wayou/t-rex-runner](https://github.com/wayou/t-rex-runner):** (Lisans: BSD-3-Clause) — Sonsuz koşu/uçuş döngüsü ve prosedürel hız eskalasyonu.

---

## 6. Lisans Bildirimi

Yukarıda listelenen bileşenlerin kendi açık kaynak lisans koşulları saklı kalmak kaydıyla, SELY MiniGame Hub kaynak kodları **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0) kapsamında sunulmaktadır.
