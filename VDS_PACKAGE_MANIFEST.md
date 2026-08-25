# SELY.TR VDS Source Package

Bu arşiv, SELY.TR MiniGame Hub’ın kaynak paketidir. Ayrı verilen `sely-vds-assets.zip` arşivi zorunludur; içindeki PNG’ler, bu kaynakta kullanılan `/manus-storage/...` yollarına bağlanmak üzere `client/public/manus-storage/` içine kopyalanmalıdır.

| Kapsam | Dahil edilen öğe |
|---|---|
| İstemci | React/Vite oyun yüzeyleri, Hane Sayı/Sözcük modları, Yankı takip penceresi, Düğüm mühürleme akışı ve Canvas Kıvılcım |
| Sunucu | Günlük manifest, sınırlı planlanmış içerik uçları ve güvenlik katmanları |
| Veri | `db/postgres/001_daily_content.sql`, Drizzle tanımları ve migration meta verisi |
| Denetim | Vitest yapılandırması ve `scripts/audit-public-release.mjs` |
| Dağıtım | `VDS_AGENT_COMMAND.md`, örnek production overlay ve AGPL-3.0 lisansı |

Kurulum sırasında `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build` ve `pnpm audit:public` sırasıyla çalıştırılmalıdır. Private `.env`, production iletişim bilgileri, arama motoru doğrulamaları ve mevcut veritabanı bu arşivde bulunmaz ve eklenmemelidir.
