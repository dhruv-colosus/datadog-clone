#!/usr/bin/env bash
# Repo-structure validator. Mirrors the §1 file-tree contract from
# ~/Downloads/universal-acceptance-criteria.md. Exits non-zero on any
# missing required path. Does NOT run network calls or boot the stack —
# call `task datadog:test-unit` / `task datadog:test-e2e` for those.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0
fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL + 1)); }
pass() { echo "  ✓ $1"; }

check_file() {
  if [ -f "$1" ]; then
    if [ -s "$1" ]; then
      pass "$1"
    else
      fail "$1 (exists but empty)"
    fi
  else
    fail "$1 (missing)"
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    pass "$1/"
  else
    fail "$1/ (missing)"
  fi
}

echo "── §1 required files ──────────────────────────────────"
check_file README.md
check_file FEATURES.md
check_file Taskfile.yml
check_file docker-compose.yml
check_file apps/api/pyproject.toml
check_file apps/api/Dockerfile
check_dir  apps/api/alembic
check_file apps/api/app/main.py
check_file apps/api/scripts/seed_db.py
check_file apps/web/package.json
check_file apps/web/playwright.config.ts
check_file apps/web/src/design-tokens.css
check_file apps/web/e2e/global.setup.ts
check_file apps/web/e2e/COVERAGE.md
check_file apps/web/e2e/README.md
check_file apps/web/e2e/fixtures/test.ts
check_file apps/web/e2e/fixtures/auth.ts
check_file apps/web/e2e/fixtures/api.ts
check_file apps/web/e2e/fixtures/db.ts
check_file apps/web/e2e/fixtures/namespace.ts
check_dir  apps/web/e2e/pages
check_file apps/web/e2e/pages/BasePage.ts
check_file apps/web/e2e/pages/LoginPage.ts
check_dir  apps/web/e2e/specs
check_file apps/web/e2e/specs/auth.spec.ts
check_file apps/web/e2e/gen-spec/system-prompt.md
check_file scripts/start.sh
check_file scripts/validate.sh

echo ""
echo "── §2 anti-pattern grep ───────────────────────────────"

EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=.next
  --exclude-dir=.venv
  --exclude-dir=__pycache__
  --exclude-dir=.pytest_cache
  --exclude-dir=.mypy_cache
  --exclude-dir=.ruff_cache
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=playwright-report
  --exclude-dir=test-results
  --exclude-dir=blob-report
  --exclude-dir=.auth
)

# Only check files git knows about — untracked scratch files (e.g., local
# helper scripts in screenshots/) shouldn't fail the validator.
leaked_paths=$(git ls-files apps/ 2>/dev/null | while read -r f; do
  if [ -f "$f" ] && grep -Il "/Users/" "$f" >/dev/null 2>&1; then
    echo "$f"
  fi
done)
if [ -n "$leaked_paths" ]; then
  fail "leaked personal paths (/Users/...) in tracked files:"
  echo "$leaked_paths" | sed 's/^/      /' >&2
else
  pass "no leaked /Users/ paths in tracked files"
fi

unparam_sql=$(grep -rInE "${EXCLUDES[@]}" 'f"(SELECT|INSERT|UPDATE|DELETE)' apps/api/ 2>/dev/null \
  | grep -vE "text\(|\\.format\(|execute\(" || true)
# The grep above intentionally over-matches; humans audit the rest.
if [ -n "$unparam_sql" ]; then
  echo "  ⚠ raw f-string SQL detected (verify each uses parameterised text()):"
  echo "$unparam_sql" | sed 's/^/      /'
fi

forbidden_files=$(find . -maxdepth 4 \
  \( -name "LAYOFF.md" -o -name "TODO_PRIVATE.md" -o -name ".DS_Store" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || true)
if [ -n "$forbidden_files" ]; then
  fail "scratch/forbidden files committed:"
  echo "$forbidden_files" | sed 's/^/      /' >&2
else
  pass "no scratch/forbidden files"
fi

echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "✗ validate failed: $FAIL issue(s)" >&2
  exit 1
fi
echo "✓ validate passed"
