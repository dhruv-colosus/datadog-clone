SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

APP_NAME ?= datadog
PYTHON ?= python3
NODE_PM ?= pnpm
UV ?= uv
GIT ?= git
ENV ?= local

BOOTSTRAP_SCRIPT := scripts/bootstrap/bootstrap_repo.py

.PHONY: help
help:
	@echo ""
	@echo "Scaffold"
	@echo "  make init                   Create monorepo scaffold"
	@echo "  make doctor                 Check local tools"
	@echo "  make git-init               Initialize git if missing"
	@echo "  make install                Install root/web/desktop deps, sync api if uv exists"
	@echo ""
	@echo "Pipeline placeholders"
	@echo "  make capture                Run capture placeholder"
	@echo "  make formalize              Run formalization placeholder"
	@echo "  make synthesize             Run synthesis placeholder"
	@echo "  make generate               Run generation placeholder"
	@echo "  make validate               Run validation placeholder"
	@echo "  make qa                     Run QA placeholder"
	@echo "  make package                Run packaging placeholder"
	@echo "  make deploy ENV=qa          Deploy local|qa|staging|production"
	@echo ""
	@echo "Cleanup"
	@echo "  make clean                  Remove transient artifacts"
	@echo "  make reset-generated        Clear generated and reports folders"
	@echo ""

.PHONY: init
init: ensure-bootstrap bootstrap chmod-scripts git-init doctor
	@echo ""
	@echo "Scaffold complete."
	@echo "Next:"
	@echo "  make install"
	@echo "  git status"
	@echo ""

.PHONY: ensure-bootstrap
ensure-bootstrap:
	@mkdir -p scripts/bootstrap
	@test -f "$(BOOTSTRAP_SCRIPT)" || { \
		echo "Missing $(BOOTSTRAP_SCRIPT). Create it first."; \
		exit 1; \
	}

.PHONY: bootstrap
bootstrap:
	@APP_NAME="$(APP_NAME)" $(PYTHON) $(BOOTSTRAP_SCRIPT)

.PHONY: chmod-scripts
chmod-scripts:
	@find scripts -type f -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

.PHONY: doctor
doctor:
	@echo "Checking tools..."
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo "$(PYTHON) not found"; exit 1; }
	@command -v $(GIT) >/dev/null 2>&1 || { echo "$(GIT) not found"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "docker not found"; exit 1; }
	@if command -v $(NODE_PM) >/dev/null 2>&1; then echo "$(NODE_PM) found"; else echo "$(NODE_PM) not found"; fi
	@if command -v $(UV) >/dev/null 2>&1; then echo "$(UV) found"; else echo "$(UV) not found"; fi
	@echo "OK"

.PHONY: git-init
git-init:
	@if [ ! -d .git ]; then \
		$(GIT) init; \
		echo "Initialized git repository."; \
	else \
		echo "Git already initialized."; \
	fi

.PHONY: install
install:
	@if command -v $(NODE_PM) >/dev/null 2>&1; then \
		if [ -f package.json ]; then $(NODE_PM) install; fi; \
		if [ -f apps/web/package.json ]; then $(NODE_PM) --dir apps/web install; fi; \
		if [ -f apps/desktop/package.json ]; then $(NODE_PM) --dir apps/desktop install; fi; \
	else \
		echo "$(NODE_PM) not found; skipping JS installs"; \
	fi
	@if [ -f apps/api/pyproject.toml ]; then \
		if command -v $(UV) >/dev/null 2>&1; then \
			cd apps/api && $(UV) sync; \
		else \
			echo "$(UV) not found; skipping api sync"; \
		fi; \
	fi
	@echo "Install step complete."

.PHONY: capture
capture:
	@node scripts/capture/run-computer-use.mjs

.PHONY: formalize
formalize:
	@node scripts/formalize/normalize-session.mjs

.PHONY: synthesize
synthesize:
	@node scripts/synthesize/generate-playwright-assets.mjs
	@node scripts/synthesize/generate-specs.mjs

.PHONY: generate
generate:
	@node scripts/generate/generate-backend.mjs
	@node scripts/generate/generate-openapi-client.mjs
	@node scripts/generate/generate-frontend.mjs
	@node scripts/generate/generate-tests.mjs
	@node scripts/generate/generate-seeds.mjs

.PHONY: validate
validate:
	@bash scripts/validate/run-typecheck.sh
	@bash scripts/validate/run-pytests.sh
	@bash scripts/validate/run-playwright-target.sh
	@bash scripts/validate/run-playwright-clone.sh
	@bash scripts/validate/run-visual-diff.sh

.PHONY: qa
qa:
	@bash scripts/validate/run-playwright-clone.sh
	@bash scripts/validate/run-visual-diff.sh
	@bash scripts/validate/smoke.sh

.PHONY: package
package:
	@bash scripts/package/build-api-image.sh
	@bash scripts/package/build-web-image.sh
	@bash scripts/package/build-electron.sh

.PHONY: deploy
deploy:
	@case "$(ENV)" in \
		local) bash scripts/deploy/deploy-local.sh ;; \
		qa) bash scripts/deploy/deploy-qa.sh ;; \
		staging) bash scripts/deploy/deploy-staging.sh ;; \
		production) bash scripts/deploy/deploy-production.sh ;; \
		*) echo "Unknown ENV=$(ENV). Use local|qa|staging|production"; exit 1 ;; \
	esac
	@bash scripts/deploy/verify-release.sh

.PHONY: clean
clean:
	@rm -rf .next dist build out coverage playwright-report blob-report test-results
	@rm -rf apps/web/.next apps/web/test-results apps/web/playwright-report apps/web/blob-report
	@rm -rf apps/api/.pytest_cache apps/api/.mypy_cache apps/api/.ruff_cache
	@echo "Cleaned transient artifacts."

.PHONY: reset-generated
reset-generated:
	@find generated -mindepth 1 -maxdepth 1 ! -name ".gitkeep" -exec rm -rf {} + 2>/dev/null || true
	@find specs/generated -mindepth 1 ! -name ".gitkeep" -exec rm -rf {} + 2>/dev/null || true
	@find research/reports -mindepth 2 ! -name ".gitkeep" -exec rm -rf {} + 2>/dev/null || true
	@echo "Reset generated artifacts."
