#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo="$(cd -- "$script_dir/.." && pwd -P)"
tag=""
lang=""
output_root="$repo/dist/releases"
platforms=()

detect_lang() {
  local locale="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
  locale="${locale,,}"
  [[ "$locale" == tr* ]] && printf tr || printf en
}

msg() {
  local key="$1"; shift
  if [[ "$lang" == tr ]]; then
    case "$key" in
      usage) printf 'Kullanım: %s [--lang tr|en] [--output DİZİN] [--platform linux/amd64|linux/arm64]... vX.Y.Z\n' "$0" ;;
      error) printf 'Hata: %s\n' "$*" >&2 ;;
      start) printf '%s etiketi denetleniyor.\n' "$tag" ;;
      checks) printf 'Temiz tag kaynağında public audit, bağımlılık, test ve build kontrolleri çalışıyor…\n' ;;
      platform) printf '%s release paketleri derleniyor…\n' "$1" ;;
      done) printf 'Paketler hazır: %s\n' "$1"; printf 'Checksum doğrulama: cd %s && sha256sum -c SHA256SUMS\n' "$1" ;;
      *) printf '%s\n' "$*" ;;
    esac
  else
    case "$key" in
      usage) printf 'Usage: %s [--lang tr|en] [--output DIR] [--platform linux/amd64|linux/arm64]... vX.Y.Z\n' "$0" ;;
      error) printf 'Error: %s\n' "$*" >&2 ;;
      start) printf 'Checking release tag %s.\n' "$tag" ;;
      checks) printf 'Running public audit, dependency, test and build checks from clean tag source…\n' ;;
      platform) printf 'Building %s release packages…\n' "$1" ;;
      done) printf 'Packages ready: %s\n' "$1"; printf 'Verify checksums: cd %s && sha256sum -c SHA256SUMS\n' "$1" ;;
      *) printf '%s\n' "$*" ;;
    esac
  fi
}

lang="$(detect_lang)"
while (($#)); do
  case "$1" in
    --lang)
      [[ $# -ge 2 && ( "$2" == tr || "$2" == en ) ]] || { msg usage; exit 2; }
      lang="$2"; shift 2 ;;
    --output)
      [[ $# -ge 2 && -n "$2" ]] || { msg usage; exit 2; }
      output_root="$2"; shift 2 ;;
    --platform)
      [[ $# -ge 2 ]] || { msg usage; exit 2; }
      platforms+=("$2"); shift 2 ;;
    --help|-h) msg usage; exit 0 ;;
    v*)
      [[ -z "$tag" ]] || { msg usage; exit 2; }
      tag="$1"; shift ;;
    *) msg usage; exit 2 ;;
  esac
done

[[ -n "$tag" ]] || { msg usage; exit 2; }
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || { msg error 'tag must be vX.Y.Z'; exit 2; }
if (("${#platforms[@]}" == 0)); then
  host_platform="$(docker info --format '{{.OSType}}/{{.Architecture}}' 2>/dev/null || true)"
  case "$host_platform" in
    linux/amd64|linux/arm64) platforms+=("$host_platform") ;;
    *) msg error 'pass --platform linux/amd64 or linux/arm64'; exit 2 ;;
  esac
fi
for platform in "${platforms[@]}"; do
  case "$platform" in
    linux/amd64|linux/arm64) ;;
    *) msg error "unsupported platform: $platform"; exit 2 ;;
  esac
done

tag_commit="$(git -C "$repo" rev-parse --verify "$tag^{commit}" 2>/dev/null || true)"
head_commit="$(git -C "$repo" rev-parse HEAD)"
[[ -n "$tag_commit" && "$tag_commit" == "$head_commit" ]] || { msg error 'tag must exist locally and point to current HEAD'; exit 1; }
[[ -z "$(git -C "$repo" status --porcelain --untracked-files=all)" ]] || { msg error 'working tree must be clean; commit source and selected assets first'; exit 1; }

node_major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf 0)"
((node_major >= 22)) || { msg error 'Node.js 22+ is required'; exit 1; }
if command -v corepack >/dev/null 2>&1; then
  pnpm_cmd=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1; then
  pnpm_cmd=(pnpm)
else
  msg error 'pnpm or Corepack is required'; exit 1
fi
expected_pnpm="$(cd "$repo" && node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).packageManager.replace(/^pnpm@/, "")')"
actual_pnpm="$(cd "$repo" && "${pnpm_cmd[@]}" --version 2>/dev/null || true)"
[[ "$actual_pnpm" == "$expected_pnpm" ]] || { msg error "expected pnpm $expected_pnpm; found ${actual_pnpm:-none}"; exit 1; }
app_version="$(cd "$repo" && node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).version')"
cargo_version="$(awk '/^\[package\]/{package=1;next} /^\[/{package=0} package && /^version =/{gsub(/[" ]/, "", $3); print $3; exit}' "$repo/Cargo.toml")"
[[ "$app_version" == "$cargo_version" && "$tag" == "v$app_version" ]] || { msg error "tag and package versions must match (package.json=$app_version, Cargo.toml=$cargo_version)"; exit 1; }
for tool in cargo docker tar gzip sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || { msg error "required command not found: $tool"; exit 1; }
done
docker buildx version >/dev/null 2>&1 || { msg error 'Docker Buildx is required'; exit 1; }

release_dir="$output_root/$tag"
[[ ! -e "$release_dir" ]] || { msg error "output already exists; inspect before moving/removing: $release_dir"; exit 1; }
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/sely-release.XXXXXXXX")"
staging_dir=""
cleanup() {
  if [[ -n "$staging_dir" && "$staging_dir" == "$output_root"/.* && -d "$staging_dir" ]]; then
    rm -rf -- "$staging_dir"
  fi
  rm -rf -- "$temp_root"
}
trap cleanup EXIT INT TERM
source_dir="$temp_root/source"
mkdir -p "$source_dir"
git -C "$repo" archive --format=tar "$tag" | tar -xf - -C "$source_dir"
node "$source_dir/scripts/verify-release-assets.mjs"

while IFS= read -r asset || [[ -n "$asset" ]]; do
  [[ -z "$asset" || "$asset" == \#* ]] && continue
  [[ -f "$source_dir/$asset" ]] || { msg error "manifest asset missing from tag: $asset"; exit 1; }
done < "$source_dir/scripts/release-assets.list"

msg start
(cd "$repo" && "${pnpm_cmd[@]}" run audit:public)
msg checks
(
  cd "$source_dir"
  "${pnpm_cmd[@]}" install --frozen-lockfile
  "${pnpm_cmd[@]}" run check
  "${pnpm_cmd[@]}" test
  "${pnpm_cmd[@]}" run build
  cargo test --locked --all-targets
)

docker buildx inspect --bootstrap >/dev/null
source_epoch="$(git -C "$repo" show -s --format=%ct "$tag_commit")"
mkdir -p "$output_root"
staging_dir="$(mktemp -d "$output_root/.${tag}.stage.XXXXXXXX")"

for platform in "${platforms[@]}"; do
  arch="${platform#linux/}"
  image_ref="ghcr.io/dixtuel/sely-minigame-hub:$tag"
  msg platform "$platform"

  image_tar="$temp_root/image-$arch.tar"
  docker buildx build \
    --platform "$platform" \
    --build-arg "SELY_VERSION=$tag" \
    --tag "$image_ref" \
    --output "type=docker,dest=$image_tar" \
    --file "$source_dir/docker/Dockerfile" \
    "$source_dir"

  export_dir="$temp_root/standalone-$arch"
  docker buildx build \
    --platform "$platform" \
    --target standalone-artifact \
    --output "type=local,dest=$export_dir" \
    --file "$source_dir/docker/Dockerfile" \
    "$source_dir"

  bundle="$temp_root/standalone-bundle-$arch"
  mkdir -p "$bundle/dist/public" "$bundle/systemd" "$bundle/scripts" "$bundle/docs"
  install -m 0755 "$export_dir/standalone" "$bundle/standalone"
  cp -a "$export_dir/dist/public/." "$bundle/dist/public/"
  install -m 0644 "$source_dir/.env.example" "$bundle/.env.example"
  install -m 0644 "$source_dir/docs/standalone-release-README.md" "$bundle/README.md"
  install -m 0644 "$source_dir/LICENSE" "$bundle/LICENSE"
  install -m 0644 "$source_dir/SECURITY.md" "$bundle/SECURITY.md"
  install -m 0644 "$source_dir/docs/DEPLOYMENT.md" "$bundle/docs/DEPLOYMENT.md"
  install -m 0644 "$source_dir/docs/ATTRIBUTION.md" "$bundle/docs/ATTRIBUTION.md"
  install -m 0755 "$source_dir/scripts/install-standalone.sh" "$bundle/scripts/install-standalone.sh"
  install -m 0644 "$source_dir"/systemd/*.service "$source_dir"/systemd/*.timer "$bundle/systemd/"
  printf '%s\n' "$platform" > "$bundle/release-target"
  printf '%s\n' "$tag_commit" > "$bundle/SOURCE-COMMIT"
  tar --sort=name --mtime="@$source_epoch" --owner=0 --group=0 --numeric-owner -cf - -C "$bundle" . \
    | gzip -n -9 > "$staging_dir/sely-minigame-hub-$tag-linux-$arch-standalone.tar.gz"

  docker_bundle="$temp_root/docker-bundle-$arch"
  mkdir -p "$docker_bundle"
  mv "$image_tar" "$docker_bundle/image.tar"
  sed "s/__RELEASE_TAG__/$tag/g" "$source_dir/docker/compose.release.yaml" > "$docker_bundle/compose.yaml"
  install -m 0644 "$source_dir/docker/.env.release.example" "$docker_bundle/.env.example"
  install -m 0755 "$source_dir/docker/start-release.sh" "$docker_bundle/start.sh"
  sed -e "s/__RELEASE_TAG__/$tag/g" -e "s/__ARCH__/$arch/g" "$source_dir/docker/README.release.md" > "$docker_bundle/README.md"
  tar --sort=name --mtime="@$source_epoch" --owner=0 --group=0 --numeric-owner -cf - -C "$docker_bundle" . \
    | gzip -n -9 > "$staging_dir/sely-minigame-hub-$tag-linux-$arch-docker.tar.gz"
done

(
  cd "$staging_dir"
  find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > SHA256SUMS
)
mkdir -p "$output_root"
mv "$staging_dir" "$release_dir"
staging_dir=""
msg done "$release_dir"
if [[ "$lang" == tr ]]; then
  printf 'Bu betik GitHub Release oluşturmaz, GHCR’a push etmez veya Vercel deploy etmez; dosyaları inceleyip elle ekleyin.\n'
else
  printf 'This script does not create a GitHub Release, push to GHCR, or deploy to Vercel; review and attach files manually.\n'
fi
