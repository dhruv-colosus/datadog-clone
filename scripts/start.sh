#!/usr/bin/env bash
# Boot helper for `task datadog:up`.
#
# Builds + starts the docker compose stack, waits for the API /health endpoint,
# then runs the topology + telemetry seed. Idempotent — safe to re-run.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

API_HEALTH_URL="${API_HEALTH_URL:-http://localhost:8001/health}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-180}"

if [ ! -f .env ]; then
  echo "[start] No .env found — copying .env.example. Edit secrets before exposing externally."
  cp .env.example .env
fi

echo "[start] Building images…"
docker compose build

echo "[start] Starting stack (detached)…"
docker compose up -d

echo "[start] Waiting for API health at ${API_HEALTH_URL} (timeout ${BOOT_TIMEOUT}s)…"
deadline=$(( SECONDS + BOOT_TIMEOUT ))
while (( SECONDS < deadline )); do
  if curl --silent --fail --max-time 3 "$API_HEALTH_URL" >/dev/null 2>&1; then
    echo "[start] API healthy."
    break
  fi
  sleep 2
done

if ! curl --silent --fail --max-time 3 "$API_HEALTH_URL" >/dev/null 2>&1; then
  echo "[start] ERROR: API never became healthy. Recent api logs:" >&2
  docker compose logs --tail=80 api >&2 || true
  exit 1
fi

echo "[start] Seeding topology + telemetry catalog…"
docker compose exec -T api python -m scripts.seed_db || {
  echo "[start] Seed failed; the stack is up but data is missing. Re-run: task datadog:seed" >&2
  exit 1
}

echo "[start] Done."
echo "[start]   Web:  http://localhost:3001"
echo "[start]   API:  http://localhost:8001"
echo "[start]   Docs: http://localhost:8001/docs"
