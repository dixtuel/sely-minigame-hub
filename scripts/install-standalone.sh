#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
bundle_dir="$(cd -- "$script_dir/.." && pwd -P)"
lang=""
prefix=""
install_systemd=0

detect_lang() {
  local value="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
  value="${value,,}"
  [[ "$value" == tr* ]] && printf 'tr' || printf 'en'
}

say() {
  local key="$1"; shift
  if [[ "${lang}" == tr ]]; then
    case "$key" in
      usage) printf 'Kullanım: %s [--lang tr|en] [--prefix DİZİN] [--systemd]\n' "$0" ;;
      linux) printf 'Bu paket yalnız Linux içindir. Docker veya Vercel paketini kullanın.\n' ;;
      arch) printf 'Bu paket hedefi (%s), bu makineyle (%s) eşleşmiyor.\n' "$1" "$2" ;;
      files) printf 'Paket eksik veya bozuk: gerekli dosya bulunamadı: %s\n' "$1" ;;
      root) printf '--systemd seçeneği root yetkisi gerektirir. Örnek: sudo %s --systemd\n' "$0" ;;
      sys) printf 'Çalışan systemd bulunamadı; --systemd kullanılamaz.\n' ;;
      install) printf 'SELY standalone kuruldu: %s\n' "$1" ;;
      service) printf 'systemd servisi etkin ve çalışır durumda.\n'; printf 'Günlük timer’lar varsayılan olarak etkin değildir; kullanmak için: sudo systemctl enable --now sely-daily-content.timer sely-daily-cleanup.timer\n' ;;
      manual) printf 'Başlatmak için: cd %s && ./standalone\n' "$1"; printf 'Önce %s/.env dosyasını düzenleyin.\n' "$1" ;;
      *) printf '%s\n' "$*" ;;
    esac
  else
    case "$key" in
      usage) printf 'Usage: %s [--lang tr|en] [--prefix DIR] [--systemd]\n' "$0" ;;
      linux) printf 'This package targets Linux only. Use the Docker or Vercel option instead.\n' ;;
      arch) printf 'Package target (%s) does not match this machine (%s).\n' "$1" "$2" ;;
      files) printf 'Package is incomplete or corrupt; required file is missing: %s\n' "$1" ;;
      root) printf '--systemd requires root. Example: sudo %s --systemd\n' "$0" ;;
      sys) printf 'systemd is not running; --systemd cannot be used.\n' ;;
      install) printf 'SELY standalone installed: %s\n' "$1" ;;
      service) printf 'The systemd service is enabled and running.\n'; printf 'Daily timers are not enabled by default; enable them only if needed: sudo systemctl enable --now sely-daily-content.timer sely-daily-cleanup.timer\n' ;;
      manual) printf 'Start with: cd %s && ./standalone\n' "$1"; printf 'Edit %s/.env first.\n' "$1" ;;
      *) printf '%s\n' "$*" ;;
    esac
  fi
}

lang="$(detect_lang)"
while (($#)); do
  case "$1" in
    --lang)
      [[ $# -ge 2 && ( "$2" == tr || "$2" == en ) ]] || { say usage; exit 2; }
      lang="$2"; shift 2 ;;
    --prefix)
      [[ $# -ge 2 && -n "$2" ]] || { say usage; exit 2; }
      prefix="$2"; shift 2 ;;
    --systemd) install_systemd=1; shift ;;
    --help|-h) say usage; exit 0 ;;
    *) say usage; exit 2 ;;
  esac
done

[[ "$(uname -s)" == Linux ]] || { say linux; exit 1; }
[[ -f "$bundle_dir/release-target" ]] || { say files "$bundle_dir/release-target"; exit 1; }
target="$(<"$bundle_dir/release-target")"
case "$(uname -m)" in
  x86_64|amd64) machine="linux/amd64" ;;
  aarch64|arm64) machine="linux/arm64" ;;
  *) machine="unsupported/$(uname -m)" ;;
esac
[[ "$target" == "$machine" ]] || { say arch "$target" "$machine"; exit 1; }

for file in "$bundle_dir/standalone" "$bundle_dir/dist/public/index.html" "$bundle_dir/.env.example"; do
  [[ -f "$file" ]] || { say files "$file"; exit 1; }
done

if [[ -z "$prefix" ]]; then
  if ((EUID == 0)); then prefix="/opt/sely-minigame-hub";
  else prefix="${HOME:?HOME is not set}/.local/opt/sely-minigame-hub"; fi
fi
[[ "$prefix" == /* ]] || { say usage; exit 2; }

if ((install_systemd)); then
  ((EUID == 0)) || { say root; exit 1; }
  [[ -d /run/systemd/system && -x "$(command -v systemctl || true)" ]] || { say sys; exit 1; }
  [[ "$prefix" == /opt/sely-minigame-hub ]] || { say usage; exit 2; }
fi

install -d -m 0755 "$prefix" "$prefix/dist/public" "$prefix/data"
install -m 0755 "$bundle_dir/standalone" "$prefix/standalone"
cp -a "$bundle_dir/dist/public/." "$prefix/dist/public/"

if ((install_systemd)); then
  if ! getent passwd sely >/dev/null; then
    useradd --system --user-group --home-dir "$prefix" --shell /usr/sbin/nologin sely
  fi
  getent group sely >/dev/null || { say files "system group sely"; exit 1; }
  install -d -o root -g sely -m 0750 /etc/sely-minigame-hub
  if [[ ! -e /etc/sely-minigame-hub/sely.env ]]; then
    install -o root -g sely -m 0640 "$bundle_dir/.env.example" /etc/sely-minigame-hub/sely.env
  else
    chown root:sely /etc/sely-minigame-hub/sely.env
    chmod 0640 /etc/sely-minigame-hub/sely.env
  fi
  chown -R root:root "$prefix"
  chown -R sely:sely "$prefix/data"
  install -m 0644 "$bundle_dir"/systemd/*.service "$bundle_dir"/systemd/*.timer /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now sely-minigame.service
  say install "$prefix"
  say service
else
  if [[ ! -e "$prefix/.env" ]]; then
    install -m 0600 "$bundle_dir/.env.example" "$prefix/.env"
  fi
  say install "$prefix"
  say manual "$prefix"
fi
