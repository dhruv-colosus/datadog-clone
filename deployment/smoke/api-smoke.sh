#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local status="$2"
  local expected="$3"
  if [ "$status" -eq "$expected" ]; then
    echo "[PASS] $name (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name — expected HTTP $expected, got $status"
    FAIL=$((FAIL + 1))
  fi
}

echo "Running API smoke tests against $API_URL"

# Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
check "GET /health" "$STATUS" 200

# Auth endpoints exist (expect redirect or 422, not 404/500)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/login")
check "GET /auth/login (redirect)" "$STATUS" 307

# Protected endpoint without token → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/me")
check "GET /auth/me (no token → 401)" "$STATUS" 401

# Readiness probe
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ready")
check "GET /ready" "$STATUS" 200

# State endpoint (unauthenticated)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/state")
check "GET /state" "$STATUS" 200

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
