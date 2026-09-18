# SELY.TR — "Vaka" (Dedektiflik) Oyunu Yeniden İnşa Planı

> Bu doküman, SELY.TR üzerindeki mevcut mekanik eşleme bulmacasını (`VakaBoard.tsx`), 12 popüler açık kaynaklı AI dedektiflik/gizem oyununun mimarisinden sentezlenen 3 bağımsız oyun modu ve çoklu LLM entegrasyonu ile gerçek bir dedektiflik oyununa dönüştürme planını içerir.

---

## 1. Mimari Hedef ve Temel İlkeler

1. **"Tırt" Yapıdan Çıkış:** Şüphelilerin aynı şablon cümleleri (`"O saatte X'deydim..."`) kurduğu ve tek tıklamayla çözülen mekanik yapı tamamen terk edilir.
2. **3 Farklı Oyun Modu:** Oyuncu tipine ve platform kısıtlarına (mobil, masaüstü, hızlı oyun, derin rol yapma) göre 3 ayrı mod sunulur.
3. **Maksimum Dayanıklılık & Sıfır Kesinti (Zero Downtime / Fallback):** API limitleri aşılsa veya ağ kopsa dahi oyun deterministik kurallarla kesintisiz oynanabilir kalır (Commit Günlüğü ve Mikoshi AI mimarisi).
4. **Çoklu Sağlayıcı (Multi-Provider LLM Engine):** Groq, Mistral ve NVIDIA NIM arasında otomatik failover/fallback zinciri.
5. **Vercel + VDS Uyumu:** Canlı ortam (Vercel Serverless Edge) ile VDS cron işleri (`mikoshi-ai` / systemd) arasında kusursuz iş bölümü.

---

## 2. Üç Oyun Modunun Ayrıntılı Tasarımı

```
                      ┌────────────────────────────────────────┐
                      │          VAKA OYUN MERKEZİ             │
                      │  (Mod Seçici & Vaka Dosyası Başlığı)   │
                      └──────────────────┬─────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│   1. MOD: SORGU  │           │ 2. MOD: ÇELİŞKİ  │           │  3. MOD: GÜNÜN   │
│      ODASI       │           │       AVI        │           │      VAKASI      │
│  (Canlı AI /     │           │  (Hızlı Taktik / │           │  (Ortak Günlük / │
│   Serbest Soru)  │           │   Phoenix-Style) │           │   Global Rekabet)│
└──────────────────┘           └──────────────────┘           └──────────────────┘
```

### Mod 1: "Sorgu Odası" (Live AI Interrogation — Alibi + VERDICT Hibriti)
* **Kime Göre:** Klavyeyle yazmayı seven, şüphelinin psikolojisini zorlamak ve yalanlarını bizzat ortaya çıkarmak isteyen dedektifler.
* **Oynanış Döngüsü:**
  1. **Vaka Özeti & Şüpheli Dosyaları:** Kurban, ölüm nedeni, cinayet mahalli ve 3-4 şüpheli profili.
  2. **Serbest / Yönlendirmeli Soru Sorma:** Oyuncu şüpheliye doğrudan istediği soruyu yazar (veya mobil için hazır soru kalıpları seçer: *"O gece saat 22:00'de neredeydin?"*, *"Kurbanla arandaki para meselesi neydi?"*).
  3. **Stres & Baskı Barı (0-100%):** Şüpheli köşeye sıkıştıkça stres barı artar. Stres arttıkça üslubu değişir (Rahat → Huzursuz → Savunmacı → Köşeye Sıkışmış → İtiraf).
  4. **Kanıt Yüzleştirme:** Oyuncu envanterindeki delili seçip *"Bunu olay yerinde düşürmüşsün, ne diyeceksin?"* diyerek şüphelinin önüne koyar.
  5. **Çelişki Analisti Asistanı (Opsiyonel Buton):** Oyuncu tıkandığında, davadaki ifadeleri tarafsızca karşılaştırıp sadece tutarsızlıkları listeleyen (ama katili söylemeyen) adli analist desteği.
  6. **Suçlama & Dava Raporu:** Katil + Delil + Cinayet Sebebi seçilerek dava kapatılır.

### Mod 2: "Çelişki Avı" (Contradiction Hunt — Phoenix Wright / Taktik Mod)
* **Kime Göre:** Uzun yazı yazmak istemeyen, özellikle mobilde hızlı ve akıcı bir mantık bulmacası oynamak isteyen kullanıcılar.
* **Oynanış Döngüsü:**
  1. Her şüphelinin 2-3 paragraflık detaylı bir **resmi ifadesi** vardır.
  2. Oyuncunun elinde adli tıp raporu, otel giriş kaydı, kamera logları ve tanık ifadeleri bulunur.
  3. Şüphelinin ifadesindeki **spesifik bir cümle**, eldeki bir kanıtla doğrudan mantıksal olarak çelişir (Örn: Şüpheli *"Hava zifiri karanlıktı, fırtına dinmemişti"* derken, hava durumu raporu saat 21:00'de dolunay ve açık hava olduğunu belgeler).
  4. Oyuncu çelişkili cümlenin üzerine tıklar, ilgili kanıt kartını seçer ve **"İTİRAZ / ÇELİŞKİ!"** butonuna basar.
  5. Doğru çelişki yakalandığında şüphelinin ifadesi çöker, yeni gerçekler ortaya çıkar.

### Mod 3: "Günün Vakası" (Daily Mystery — Ortak Günlük Gizem)
* **Kime Göre:** Tüm toplulukla aynı anda aynı gizemi çözmek isteyenler (Wordle / NYT Games tarzı).
* **Oynanış Döngüsü:**
  1. Her gece UTC 00:05 (TR 03:05)'te VDS crontab veya zamanlanmış servis o günün özel sinematik gizemini veritabanına yazar.
  2. Günün vakası tüm oyuncular için sabittir.
  3. Çözüm skoru: Yapılan soru sayısı, istenen ipucu sayısı ve harcanan süreye göre hesaplanır.
  4. Günün sonunda "Dedektiflik Karnesi" (S, A, B, C) ve paylaşılabilir emoji tablosu (🟩🟩🟨🟥) üretilir.

---

## 3. Mod Seçimi ve Host Yönetimi (ENV & UI)

Hem sunucuyu çalıştıran yöneticinin (host) hem de oyunu oynayan kullanıcının tam kontrole sahip olması sağlanır.

### Host / Server Yapılandırması (Ortam Değişkenleri - `.env`)

Hostlayan kişi API anahtarı harcamak istemeyebilir veya belirli modları kapatmak isteyebilir:

```bash
# --- VAKA OYUNU TEMEL MOD AYARLARI ---
# Aktif edilecek modlar (virgülle ayrılmış): daily,interrogation,contradiction
VAKA_ENABLED_MODES="daily,interrogation,contradiction"

# Sayfa ilk açıldığında varsayılan gelecek mod:
# Seçenekler: "daily" | "interrogation" | "contradiction"
VAKA_DEFAULT_MODE="daily"

# --- LLM SAĞLAYICI VE ZİNCİR YÖNETİMİ ---
# Birincil sağlayıcı: "groq" | "mistral" | "nvidia" | "auto"
VAKA_LLM_PROVIDER="auto"

# Otomatik zincir sırası (Failover):
# Birincil başarısız olursa sırayla sonrakine geçer
VAKA_LLM_CHAIN="groq,nvidia,mistral"

# Groq Konfigürasyonu
GROQ_API_KEY=""
GROQ_API_KEY_2=""
VAKA_GROQ_MODEL="qwen-2.5-32b" # veya favori modellerden biri

# Mistral Konfigürasyonu
MISTRAL_API_KEY=""
VAKA_MISTRAL_MODEL="mistral-small-latest"

# NVIDIA NIM Konfigürasyonu
NVIDIA_NIM_API_KEY=""
VAKA_NVIDIA_MODEL="nvidia/nemotron-3.5-lightning-30b-a3b"

# Güvenlik ve Hız Sınırları
VAKA_INTERROGATION_MAX_QUESTIONS=15 # Bir vakada sorulabilecek maksimum soru
VAKA_RATE_LIMIT_PER_MINUTE=20      # Spam engeli
```

### Kullanıcı / Oyuncu Arayüzü (In-Game Mode Selector)

* Vaka masasının en üstünde üç sekmeli özel bir **Vaka Göstergesi** yer alır:
  * 📅 **Günün Vakası** (Günün ortak gizemi, günlük seri sayacı)
  * 🎙️ **Sorgu Odası** (Dinamik şüpheli sorgusu, stres barı ve serbest diyalog)
  * ⚖️ **Çelişki Avı** (Hızlı dedektiflik, ifade çürütme)
* Eğer host bir modu `.env` üzerinden devre dışı bıraktıysa o sekme kullanıcıya kilitli rozetiyle gösterilir (`Devre Dışı`).
* Kullanıcının son seçtiği mod `localStorage` üzerinde hatırlanır; bir sonraki ziyaretinde kaldığı moddan açılır.

---

## 4. Çok Katmanlı Prompt Mimarisi (`alibi` + `VERDICT` sentezi)

Şüpheli ajanların tutarlı, sızdırmaz ve zengin oynaması için `alibi` projesinin 8 katmanlı yapısı uyarlanır:

1. **Katman 1: Karakter Özü (Static):** İsim, yaş, meslek, kurbanla ilişki, konuşma üslubu (resmi, argolu, telaşlı, kibirli).
2. **Katman 2: Bilgi Durumu (Knowledge State):**
   * *Bildiği Gerçekler:* Cinayet anında nerede olduğu, ne gördüğü.
   * *Bilmediği Şeyler:* Kesinlikle uydurmaması gereken detaylar (örn: arka kapı kamerasının çalıştığını bilmiyor).
   * *Sakladığı Sırlar:* Büyük sır (cinayet/hırsızlık) ve küçük sır (zimmetine para geçirme/yasak ilişki).
3. **Katman 3: Yalanlar ve Yedek Yalanlar (Fallback Lies):**
   * *1. Kademe:* "O saatte odamda uyuyordum."
   * *2. Kademe (Delil gösterilince):* "Tamam, bahçeye hava almaya çıktım ama içeri hiç girmedim."
   * *3. Kademe (Stres > 85% ve tüm yalanlar çökünce):* Parça parça itiraf başlangıcı.
4. **Katman 4: Anlık Stres ve Psikolojik Durum (Dynamic Pressure 0-100):**
   * `0-25 (Rahat):` Kısa, küstah, alaycı yanıtlar.
   * `26-55 (Huzursuz):` Açıklama yapma telaşı, gereksiz ayrıntı verme.
   * `56-80 (Savunmacı):` Karşı sorular sorma, dedektifi suçlama, terleme/beden dili ipuçları.
   * `81-100 (Köşeye Sıkışmış):` Kekeleme, kaçacak yer kalmaması, itiraf eşiği.
5. **Katman 5: Diğer Şüpheliler Hakkında Dedikodular:** Diğerlerinin zayıf noktalarını dedektife fısıldayarak şüpheyi üstünden atma çabası.

---

## 5. Desteklenecek LLM Modelleri & Parametre Profilleri (Rollerden Bağımsız)

> [!IMPORTANT]
> **Rol Bağımsızlığı İlkesi (Role-Agnostic):** Hiçbir model tek bir role (yalnızca şüpheli, yalnızca analist vb.) zincirlenmez. Herhangi bir model çöktüğünde, rate limite takıldığında veya geç yanıt verdiğinde diğer tüm modeller anında aynı görevi eksiksiz üstlenebilir. Prompt yapıları sağlayıcı ve modelden bağımsız standart formatta tutulur.

### 1. Model Örnekleme ve Davranış Profilleri

Her modelin genel API parametreleri ve düşünce kapatma (`disable thinking`) profili sisteme kayıtlıdır:

| Model ID | Sağlayıcı | Tipik Gecikme | Temp / Top_P | Max Tokens | Thinking Kapatma (Request Parametresi) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Groq Modelleri`** (`qwen-2.5-32b`, `gpt-oss-20b`, `llama-3.3-70b`) | Groq | **Ultra Hızlı** (~300ms) | `0.7 / 0.9` | `512` | `presence_penalty: 0.1` |
| **`nvidia/nemotron-3.5-lightning-30b-a3b`** | NVIDIA NIM | **Çok Hızlı** (~600ms) | `0.6 / 0.95` | `1024` | `"reasoning_budget": 0` (NVIDIA dokümanındaki sonsuz düşünce engelleyici) |
| **`google/gemma-4-31b-it`** | NVIDIA NIM | **Hızlı** (~900ms) | `0.5 / 1.0` | `1024` | `"chat_template_kwargs": { "enable_thinking": false }` |
| **`mistral-small-latest`** (`mistral-small-4-0-26-03`) | Mistral AI | **Çok Hızlı** (~450ms) | `0.65 / 1.0` | `1024` | `"reasoning_effort": "none"` (Düşünce izini kapatır) |
| **`ministral-3-8b-25-12`** / `14b` | Mistral AI | **Ultra Hızlı** (~350ms) | `0.6 / 1.0` | `800` | Standart chat completion |
| **`mistral-medium-3-5-26-04`** | Mistral AI | **Orta / Güçlü** (~1.2s) | `0.7 / 1.0` | `1024` | `"reasoning_effort": "none"` |
| **`mistral-large-latest`** (`mistral-large-3-25-12`) | Mistral AI | **Kapsamlı** (~1.8s) | `0.7 / 1.0` | `1024` | `"reasoning_effort": "none"` |
| **`openai/gpt-oss-20b` / `120b`** | NVIDIA NIM | **Orta** (~1.2s) | `0.7 / 0.95` | `1024` | `"reasoning_effort": "none"` |
| **`z-ai/glm-5-3-flash`** | NVIDIA NIM | **Değişken / Bazen Yavaş** (~2.5-5s) | `0.6 / 0.9` | `1024` | `"reasoning_effort": "none"` |

---

## 6. Düşünce Sürecini Kapatma & Gizleme (Thinking Disable & Sanitization)

`commit-gunlugu` projesindeki test edilmiş sanitization desenine (`strip_reasoning_blocks`) uygun olarak 2 aşamalı savunma uygulanır:

### 1. İstek (Request) Seviyesinde Kapatma:
Model çağrılırken sağlayıcıya özel reasoning kapatma parametreleri eklenir:
- Mistral AI (Tüm yeni modeller): `"reasoning_effort": "none"`
- NVIDIA NIM (Nemotron): `"reasoning_budget": 0`
- NVIDIA NIM (GLM / DeepSeek): `"reasoning_effort": "none"`
- NVIDIA NIM (Gemma / Qwen): `"chat_template_kwargs": { "enable_thinking": false }`

### 2. Yanıt & Streaming Seviyesinde Temizleme (Sanitizer):
Model yine de düşünce içeriği üretirse, bu içerik oyuncunun ekranına kesinlikle sızdırılmaz:
- Gelen stream veya ham metin `stripReasoningBlocks()` fonksiyonundan geçirilir:
  - `<think>...</think>` ve `</think>` arası bloklar
  - `<thought>...</thought>` blokları
  - `[THINK]...[/THINK]` etiketleri
  - `<reasoning>...</reasoning>` etiketleri
- JSON veya SSE chunk'larında yer alan `reasoning_content` alanı istemciye (frontend) aktarılmaz; yalnızca `content` alanı stream edilir.
- Streaming sırasında `<think>` tespit edilirse tamponda (buffer) tutulur, `</think>` kapanana kadar ekrana karakter basılmaz.

---

## 7. Genel ve Esnek Fallback Zinciri (Gecikme Duyarlı & Timeout Korumalı)

Kullanıcı deneyiminin donmaması ve modellerin gecikme farklılıklarının oyunu tıkamaması için şu kurallar işletilir:

1. **Hızlı Modeller En Başta:** En düşük yanıt süresine sahip hafif ve seri modeller (Groq, Nemotron 3.5, Mistral Small) zincirde öne alınır. GLM gibi yanıt süresi değişken olan modeller zincirin arkasında yedek olarak tutulur.
2. **Sıkı Zaman Aşımı (Aggressive Timeout — 5.0 Saniye):** Oyuncunun bekleme süresini minimize etmek için her modele `5.000 ms` süre tanınır. Model 5 saniyede ilk byte'ı veremezse `AbortController` ile istek kesilir ve beklemeden bir sonraki modele geçilir.
3. **Anında Atlama Koşulları:**
   - HTTP 429 (Rate Limit / Kota Doldu) ➔ Anında sonraki model.
   - HTTP 500 / 502 / 503 / 504 ➔ Anında sonraki model.
   - Timeout (5 saniye) ➔ Anında sonraki model.
   - Boş Yanıt veya Bozuk JSON ➔ Anında sonraki model.
4. **Son Durak (Nihai Güvenlik Ağı):** Tüm harici sağlayıcılar ve modeller çökse bile `commit-gunlugu` ve `mikoshi-ai`'da olduğu gibi **Deterministik Kural Motoru** devreye girer; oyun asla hata ekranı vermez, akış devam eder.

```
                  [Oyuncu Hamlesi / Soru / Kanıt]
                                │
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  1. AŞAMA: Ultra Hızlı Modeller (Timeout: 5s)   │
        │  Groq (Qwen/Llama)  ──► Nemotron 3.5 (NVIDIA)   │
        └───────────────────────┬─────────────────────────┘
                                │ (Hata / Timeout / 429)
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  2. AŞAMA: Dengeli Modeller (Timeout: 6s)       │
        │  Mistral Small / Nemo ──► Gemma 4 / GPT OSS     │
        └───────────────────────┬─────────────────────────┘
                                │ (Hata / Timeout / 429)
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  3. AŞAMA: Ağır / Yedek Modeller (Timeout: 7s)  │
        │  GLM-5.3-Flash / Mistral Large                  │
        └───────────────────────┬─────────────────────────┘
                                │ (Tüm API'ler Çökerse)
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  4. AŞAMA: Deterministik Kural Motoru           │
        │  (Offline Yedek — Sıfır Kesinti Garantisi)      │
        └─────────────────────────────────────────────────┘
```

---

## 8. Dosya ve Bileşen Organizasyonu

```
/opt/sely-minigame-hub-src/
├── client/src/
│   └── components/
│       ├── VakaHub.tsx               # Ana vaka konteyneri ve 3 modun sekme yöneticisi
│       ├── vaka/
│       │   ├── VakaBriefing.tsx       # Vaka panosu, olay yeri, kurban bilgileri
│       │   ├── VakaInterrogation.tsx  # Mod 1: Canlı AI sorgu, chat arayüzü, stres barı
│       │   ├── VakaContradiction.tsx  # Mod 2: Metin içi çelişki seçme ve itiraz arayüzü
│       │   ├── VakaDailyBoard.tsx     # Mod 3: Günlük vaka rozeti, puan tablosu
│       │   ├── VakaEvidenceRack.tsx   # Ortak delil ve envanter çekmecesi
│       │   └── VakaVerdictModal.tsx   # Final suçlama ve değerlendirme karnesi
│   └── lib/
│       ├── vakaEngine.ts             # Vaka mantığı, stres hesabı, çelişki denetimi
│       └── vakaCases.ts              # Zengin deterministik yedek vakalar
├── server/
│   ├── routes/
│   │   └── vakaRouter.ts             # tRPC/Express endpointleri: /talk, /contradict, /accuse
│   └── services/
│       ├── vakaLlmService.ts         # Groq, Mistral, NVIDIA NIM adaptörü ve fallback zinciri
│       └── vakaDailyCron.ts          # Her gece 03:05'te yeni vaka üreten servis
└── docs/
    └── VAKA_REBUILD_PLAN.md          # Bu plan dokümanı
```

---

## 9. Uygulama Adımları (Fazlar)

> [!IMPORTANT]
> **Kullanıcı Onay Kuralı:** Kullanıcı model dokümantasyonlarını ve sağlayıcı tercihlerini paylaşıp onay vermeden kod entegrasyonuna başlanmayacaktır.

1. **Aşama 1 (Hazırlık & Onay):** Kullanıcıdan sağlayıcı dokümantasyonları ve model listesinin netleştirilmesi.
2. **Aşama 2 (Frontend İskeleti):** `VakaHub.tsx` ile 3 modu ayıran şık noir arayüzün ve envanter sisteminin kurulması.
3. **Aşama 3 (Deterministik Çelişki Motoru - Mod 2):** Sıfır API gerektiren zengin ifadeli çelişki avı modunun tamamlanması.
4. **Aşama 4 (LLM Entegrasyonu & Fallback Zinciri - Mod 1 & Mod 3):** Groq, Mistral ve NVIDIA NIM bağlantılarının güvenli şekilde kurulması.
5. **Aşama 5 (Test & Canlıya Alma):** Vitest testleri, pnpm audit doğrulaması ve Vercel/VDS dağıtımı.
