#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' .env 2>/dev/null || true
}

GHCR_OWNER="${GHCR_OWNER:-$(read_env GHCR_OWNER)}"
IMAGE_TAG="${IMAGE_TAG:-$(read_env IMAGE_TAG)}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-/api}"
TARGET="${1:-all}"

if [ -z "$GHCR_OWNER" ]; then
  echo "Missing GHCR_OWNER. Set it in .env or export GHCR_OWNER=your-ghcr-owner." >&2
  exit 1
fi

docker buildx inspect datadog-builder >/dev/null 2>&1 || docker buildx create --name datadog-builder --use >/dev/null
docker buildx use datadog-builder >/dev/null
docker buildx inspect --bootstrap >/dev/null

build_api() {
  docker buildx build \
    --platform "$PLATFORM" \
    -f apps/api/Dockerfile \
    -t "ghcr.io/$GHCR_OWNER/datadog-backend:$IMAGE_TAG" \
    --push .
}

build_web() {
  docker buildx build \
    --platform "$PLATFORM" \
    -f apps/web/Dockerfile \
    --build-arg "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" \
    -t "ghcr.io/$GHCR_OWNER/datadog-frontend:$IMAGE_TAG" \
    --push .
}

case "$TARGET" in
  api)
    build_api
    ;;
  web)
    build_web
    ;;
  all)
    build_api
    build_web
    ;;
  *)
    echo "Usage: $0 [all|api|web]" >&2
    exit 1
    ;;
esac

echo "Pushed images for $PLATFORM with tag '$IMAGE_TAG' under ghcr.io/$GHCR_OWNER."
