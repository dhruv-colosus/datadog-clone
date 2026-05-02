#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://localhost:3000}"
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

echo "Running Web smoke tests against $WEB_URL"

# Home page loads
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/")
check "GET / (home)" "$STATUS" 200

# Auth pages load
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/auth/sign-in")
check "GET /auth/sign-in" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/auth/sign-up")
check "GET /auth/sign-up" "$STATUS" 200

# Static assets served (Next.js _next path)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/_next/static/")
# 400 or 404 both mean Next.js is serving (not 502/503)
if [ "$STATUS" -lt 500 ]; then
  echo "[PASS] Next.js static assets reachable (HTTP $STATUS)"
  PASS=$((PASS + 1))
else
  echo "[FAIL] Next.js static assets — got HTTP $STATUS"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
