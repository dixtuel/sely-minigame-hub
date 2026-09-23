# Üçüncü Taraf Lisans ve Atıf Bildirimleri (Third-Party Notices & Attribution)

Bu belge, **SELY MiniGame Hub** (`sely.tr`) projesinde uyarlanan açık kaynak oyun kodlarını ve kullanılan üçüncü taraf kütüphane, görsel/ses varlığı, kelime veri seti ve yazı tiplerini belgeler.

Tüm üçüncü taraf bileşenlerin telif hakları, ticari markaları ve patent hakları ilgili hak sahiplerine aittir.

---

## İçindekiler

1. [Proje Lisansı ve Uyumluluk Esasları](#1-proje-lisansı-ve-uyumluluk-esasları)
2. [Oyun İçi Ses Efektleri (Audio)](#2-oyun-içi-ses-efektleri-audio)
3. [3D Dokular ve Yüzey Materyalleri (Textures)](#3-3d-dokular-ve-yüzey-materyalleri-textures)
4. [Sözlükler, Kelime Havuzları ve Dil Veri Setleri](#4-sözlükler-kelime-havuzları-ve-dil-veri-setleri)
5. [Tipografi ve Yazı Tipleri (Fonts)](#5-tipografi-ve-yazı-tipleri-fonts)
6. [3D Grafik ve Render Motorları](#6-3d-grafik-ve-render-motorları)
7. [Üretim Bağımlılıkları](#7-üretim-bağımlılıkları)
8. [Lisans Metinleri ve Bağlantılar](#8-lisans-metinleri-ve-bağlantılar)
9. [İletişim](#9-iletişim)

---

## 1. Proje Lisansı ve Uyumluluk Esasları

SELY MiniGame Hub kaynak kodları **[GNU Affero General Public License v3.0](LICENSE)** (AGPL-3.0) kapsamında sunulmaktadır.

Üçüncü taraf bileşenler aşağıdaki lisans aileleri altında dağıtılmaktadır:
- **MIT Lisansı** (`MIT`)
- **Apache License 2.0** (`Apache-2.0`)
- **ISC Lisansı** (`ISC`)
- **BSD 2-Clause & 3-Clause Lisansları** (`BSD-2-Clause`, `BSD-3-Clause`)
- **Mozilla Public License 2.0** (`MPL-2.0`)
- **SIL Open Font License 1.1** (`OFL-1.1`)
- **Creative Commons Zero 1.0 Universal** (`CC0-1.0` / Kamu Malı)
- **Public Domain Dedications** (ENABLE, Wordle Guess Lexicon)

### Oyun kodu ve içerik uyarlamaları

| Oyun | Kaynak / hak sahibi | Lisans ve uyarlanan kapsam |
| :--- | :--- | :--- |
| Asteroids (Göktaşı Çemberi) | [dmcinnes/HTML5-Asteroids](https://github.com/dmcinnes/HTML5-Asteroids), Doug McInnes | MIT; hareket/ekran sarımı, göktaşı parçalanması ve puanlama mekaniği. Göktaşı poligon koordinatları ve klasik puan değerleri kaynakla eşleşir. Copyright (c) 2010 Doug McInnes. |
| Lander (Modül İnişi) | [KilledByAPixel/LittleJS — `examples/shorts/landerGame.js`](https://github.com/KilledByAPixel/LittleJS), Frank Force | MIT; güvenli iniş için açı/hız eşiği yaklaşımı uyarlanmıştır. SELY arazi üretimi ve hareket parametreleri farklıdır. Copyright (c) 2021 Frank Force. |
| Sokoban (İstif Meydanı) | [muthuspark/javascript-games — Sokoban](https://github.com/muthuspark/javascript-games/tree/main/public/posts/sokoban), Muthukrishnan | MIT; 10 seviye düzeni ve başlıkları kaynakla eşleşir (harita işaretçileri SELY'de farklı sembollerle kodlanır); kutu itme/hedef kuralları uyarlanmıştır. Copyright (c) 2025 Muthukrishnan. |
| Tetris (Dörtyol Blokları) | [jakesgordon/javascript-tetris](https://github.com/jakesgordon/javascript-tetris), Jake Gordon ve katkıda bulunanlar | MIT; yedi tetromino türünün dört dönüş konumuna ait 16-bit parça maskeleri kaynakla aynı sabit değerlerdir; oyun motoru bu gösterime uyarlanmıştır. Copyright (c) 2011–2016 Jake Gordon and contributors. |
| Lights Out (Işık Söndürme) | [muthuspark/javascript-games — Lights Out](https://github.com/muthuspark/javascript-games/tree/main/public/posts/lights-out), Muthukrishnan | MIT; seçilen hücre ve dört komşusunu değiştirme kuralı ile çözülebilir tahta üretme yaklaşımı uyarlanmıştır. Copyright (c) 2025 Muthukrishnan. |
| 2048 (Kare Katlama) | [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048), Gabriele Cirulli | MIT; 4×4 tahtada kaydırma/birleştirme, yönlü tarama ve yeni taş üretme kuralları uyarlanmıştır. Copyright (c) 2014 Gabriele Cirulli. |

---

## 2. Oyun İçi Ses Efektleri (Audio)

Yankı Odası (Echo Room) 3D oyununda kullanılan ses efektleri, [Kenney](https://kenney.nl) tarafından kamu malı (CC0 1.0 Universal) olarak sağlanan ses paketlerinden alınmıştır:

| Dosya Yolu | Kaynak Paket | Orijinal Dosya | Lisans | Kullanım Amacı |
| :--- | :--- | :--- | :--- | :--- |
| `client/public/assets/audio/footstep-00.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `footstep00.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Karakter yürüme sesi |
| `client/public/assets/audio/footstep-01.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `footstep01.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Karakter yürüme sesi |
| `client/public/assets/audio/footstep-02.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `footstep02.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Karakter yürüme sesi |
| `client/public/assets/audio/footstep-03.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `footstep04.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Karakter yürüme sesi |
| `client/public/assets/audio/gate-open.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `doorOpen_1.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Çıkış kapısı açılma sesi |
| `client/public/assets/audio/echo-pulse.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `glass_002.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Sonar yankı darbesi sesi |
| `client/public/assets/audio/mark-collect.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `confirmation_002.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Glif/anahtar toplama geri bildirimi |
| `client/public/assets/audio/listener-caught.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `error_004.ogg` | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Yakalanma ve tur sonu uyarısı |

*Not: Yukarıda listelenen dosyalar dışındaki oyun içi ses efektleri ve ortam tonları (Hane, Kıvılcım, Kırpık vb.), harici bir ses kaydı kullanılmaksızın tarayıcının yerel Web Audio API osilatörleri ile prosedürel olarak sentezlenmektedir.*

---

## 3. 3D Dokular ve Yüzey Materyalleri (Textures)

Yankı Odası (Echo Room) 3D labirentinde kullanılan PBR dokuları, [ambientCG](https://ambientcg.com) (Lennart Demes) tarafından sağlanan CC0 materyallerdir:

| Dosya Yolu | Varlık | Harita Türü | Lisans | İşleme / Format |
| :--- | :--- | :--- | :--- | :--- |
| `client/public/assets/textures/stone-wall-color.jpg` | [Rock030](https://ambientcg.com/a/Rock030) | Color | [CC0 1.0](https://docs.ambientcg.com/license/) | 512×512 piksel JPEG |
| `client/public/assets/textures/stone-wall-normal.jpg` | [Rock030](https://ambientcg.com/a/Rock030) | NormalDX | [CC0 1.0](https://docs.ambientcg.com/license/) | 512×512 piksel JPEG |
| `client/public/assets/textures/floor-basalt-color.jpg` | [Ground068](https://ambientcg.com/a/Ground068) | Color | [CC0 1.0](https://docs.ambientcg.com/license/) | 512×512 piksel JPEG |
| `client/public/assets/textures/floor-basalt-normal.jpg` | [Ground068](https://ambientcg.com/a/Ground068) | NormalDX | [CC0 1.0](https://docs.ambientcg.com/license/) | 512×512 piksel JPEG |

---

## 4. Sözlükler, Kelime Havuzları ve Dil Veri Setleri

Hane oyununun harf/kelime modunda oyuncu tahminlerinin geçerliliğini denetlemek için kamuya açık ve açık kaynaklı sözlük veri setleri kullanılmıştır:

### 1. TDK Kamusal Türkçe Sözlük Madde Başları (Türkçe Sözlük)
- **Veri Derleyicisi:** `ncarkaci/TDKDictionaryCrawler` (Nurettin Sadık Çarkacı)
- **Kaynak Veri:** Türk Dil Kurumu (TDK) güncel çevrimiçi sözlüğünden derlenmiş madde başları listesi.
- **Kapsam:** 4 harfli (1.971 geçerli sözcük) ve 5 harfli (5.242 geçerli sözcük) ayıklanmış sözlük havuzu.
- **Lisans:** MIT Lisansı
- **Kaynak:** https://github.com/ncarkaci/TDKDictionaryCrawler

### 2. ENABLE — Enhanced North American Benchmark Lexicon (İngilizce Sözlük)
- **Yazarlar / Derleyenler:** Keith Schmidt & Alan Beale
- **Kapsam:** 3.903 adet 4 harfli ve 8.636 adet 5 harfli İngilizce sözcük.
- **Lisans:** Public Domain (Kamu Malı)
- **Açıklama:** Scrabble ve kelime oyunu geliştiricilerinin 1997'den beri temel aldığı kamu malı İngilizce referans sözlüğü.

### 3. Wordle Allowed Guesses List (Genişletilmiş İngilizce 5 Harf Sözlüğü)
- **Köken:** Josh Wardle / Wordle kamuya açık tahmin sözlüğü.
- **Kapsam:** 14.856 adet 5 harfli geçerli İngilizce tahmin sözcüğü.
- **Lisans:** Public Domain / Permissive Lexicon

---

## 5. Tipografi ve Yazı Tipleri (Fonts)

SELY arayüzünde Bricolage Grotesque ve DM Mono Google Fonts üzerinden kullanılır. OG görsellerinin sunucu taraflı üretiminde DM Mono ve Space Grotesk dosyaları projede gömülüdür. Üç yazı tipi de **SIL Open Font License 1.1** (OFL-1.1) kapsamındadır:

| Yazı Tipi Ailesi | Tasarımcı / Dökümhane | Lisans | Kullanım Alanı | Kaynak Depo |
| :--- | :--- | :--- | :--- | :--- |
| **Bricolage Grotesque** | Mathieu Triay | SIL OFL 1.1 | Başlıklar, katalog kartları ve skor sayaçları | [ateliertriay/bricolage](https://github.com/ateliertriay/bricolage) |
| **DM Mono** | Colophon Foundry | SIL OFL 1.1 | Monospace kayıt panelleri, HUD göstergeleri ve tuş takımı; ayrıca `assets/fonts/DMMono-Regular.ttf` ve `DMMono-Medium.ttf` olarak `/api/og` sunucu taraflı PNG paylaşım kartı render'ında gömülü (resvg fontdb) | [googlefonts/dm-fonts](https://github.com/googlefonts/dm-fonts) |
| **Space Grotesk** | Florian Karsten | SIL OFL 1.1 | `assets/fonts/SpaceGrotesk.ttf` olarak OG görsellerinin sunucu taraflı render'ında gömülü | [floriankarsten/space-grotesk](https://github.com/floriankarsten/space-grotesk) |

*SIL Open Font License 1.1 uyarınca yazı tipleri tek başlarına satılamaz; bu yazılım projesiyle birlikte özgürce dağıtılmakta ve kullanılmaktadır. Orijinal Reserved Font Name (RFN) hakları saklıdır.*

---

## 6. 3D Grafik ve Render Motorları

### [Babylon.js Core](https://www.babylonjs.com/) (`@babylonjs/core`)
- **İşlev:** Yankı Odası (Echo Room) 3D labirentinin prosedürel oluşturulması, WebGL/WebGPU render döngüsü, dinamik ışıklandırma, görüş alanı simülasyonu, PBR materyaller ve kamera yönetimi.
- **Lisans:** Apache License 2.0
- **Telif Hakkı:** Copyright (c) 2013-2026 BabylonJS
- **Kaynak:** https://github.com/BabylonJS/Babylon.js

---

## 7. Üretim Bağımlılıkları

| Alan | Kullanılan başlıca bileşenler | Lisans |
| :--- | :--- | :--- |
| Web arayüzü | React, Babylon.js, TanStack Query, tRPC, Wouter, Radix UI, Sonner, SuperJSON, next-themes, Vercel Analytics / Speed Insights | Çoğu MIT; Babylon.js Apache-2.0 |
| Web yardımcıları | Lucide React, clsx, tailwind-merge, class-variance-authority | ISC, MIT, Apache-2.0 |
| Rust sunucusu | Axum, Tokio, Tower, Tower HTTP/Cookies, libSQL, fred, governor, tracing | MIT |
| Rust sunucusu (diğer) | Serde, SQLx, Reqwest, Chrono, rand, regex, sha2, base64, flate2 | MIT OR Apache-2.0; `subtle` BSD-3-Clause |
| Vercel Rust Runtime | `vercel_runtime` | Apache-2.0 |
| WASM köprüsü | wasm-bindgen, serde-wasm-bindgen, getrandom | MIT, MIT OR Apache-2.0 |
| OG görsel render'ı | resvg | MPL-2.0 |

Sürüm numaraları proje manifestolarında (`Cargo.toml`, `package.json`) tutulur; burada tekrarlanmaz.

---

## 8. Lisans Metinleri ve Bağlantılar

MIT lisansı kapsamındaki oyun uyarlamaları için standart lisans metni aşağıdadır; ilgili telif sahipleri oyun tablosunda belirtilmiştir. Diğer lisansların güncel metinleri: [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), [ISC](https://opensource.org/license/isc-license-txt/), [BSD-3-Clause](https://opensource.org/license/bsd-3-clause/), [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/), [SIL OFL 1.1](https://openfontlicense.org/open-font-license-official-text/) ve [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode/).

### MIT Lisansı (MIT License)

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

### Apache License 2.0 (kısa bildirim)

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

### ISC Lisansı (ISC License)

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

### SIL Open Font License 1.1 (OFL-1.1) (kısa bildirim)

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

### Creative Commons Zero v1.0 Universal (CC0 1.0) (kısa bildirim)

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

### BSD 3-Clause License (kısa bildirim)

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

## 9. İletişim

Bu belgedeki bildirimler, açık kaynak topluluğunun şeffaflık, izlenebilirlik ve telif haklarına saygı ilkeleri doğrultusunda düzenli olarak denetlenir ve güncellenir. 

Eksik veya güncellenmesi gereken herhangi bir atıf bildirimi tespit etmeniz halinde, lütfen projenin GitHub deposu üzerinden bir bildirim (Issue) veya katkı (Pull Request) açınız.
