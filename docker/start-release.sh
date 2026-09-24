#!/usr/bin/env bash
set -Eeuo pipefail

bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$bundle_dir"

locale="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
if [[ "${locale,,}" == tr* ]]; then
  missing='Docker Engine ve Compose eklentisi gerekli.'
  bad_bundle='Docker paketi eksik veya bozuk.'
  ready='SELY başlatıldı. Adres ve port yukarıdaki Compose çıktısında görünüyor.'
else
  missing='Docker Engine and the Compose plugin are required.'
  bad_bundle='The Docker package is incomplete or damaged.'
  ready='SELY started. The address and port are shown in the Compose output above.'
fi

command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || { printf '%s\n' "$missing" >&2; exit 1; }
for file in image.tar compose.yaml .env.example; do
  [[ -f "$file" ]] || { printf '%s %s\n' "$bad_bundle" "$file" >&2; exit 1; }
done

if [[ ! -e .env && ! -L .env ]]; then
  install -m 0600 .env.example .env
fi

docker load --input image.tar
docker compose config --quiet
docker compose up -d --pull never
docker compose ps
printf '%s\n' "$ready"
