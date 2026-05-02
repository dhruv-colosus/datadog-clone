#!/usr/bin/env python3
from pathlib import Path
import json
import os
import textwrap


APP_NAME = os.environ.get("APP_NAME", "datadog")
ROOT = Path.cwd()


DIRS = [
    "docs/architecture",
    "docs/operating-procedures",
    "docs/conventions",

    "apps/web/src/app",
    "apps/web/src/components",
    "apps/web/src/features",
    "apps/web/src/hooks",
    "apps/web/src/lib",
    "apps/web/src/store",
    "apps/web/src/styles",
    "apps/web/src/generated",
    "apps/web/public",
    "apps/web/tests-e2e/clone",
    "apps/web/tests-e2e/target",
    "apps/web/tests-e2e/pom",
    "apps/web/reports",

    "apps/api/app/api/routes",
    "apps/api/app/core",
    "apps/api/app/db",
    "apps/api/app/models",
    "apps/api/app/schemas",
    "apps/api/app/repositories",
    "apps/api/app/services",
    "apps/api/app/permissions",
    "apps/api/app/audit",
    "apps/api/app/search",
    "apps/api/app/auth",
    "apps/api/app/workflows",
    "apps/api/app/seeds/factories",
    "apps/api/app/seeds/scenarios",
    "apps/api/tests/unit",
    "apps/api/tests/integration",
    "apps/api/tests/contract",
    "apps/api/tests/fixtures",
    "apps/api/reports",

    "apps/desktop/src",
    "apps/desktop/assets",
    "apps/desktop/reports",

    "research/raw/computer-use/target",
    "research/raw/computer-use/clone",
    "research/raw/playwright-target/auth",
    "research/raw/playwright-target/routes",
    "research/raw/playwright-target/workflows",
    "research/raw/playwright-clone/auth",
    "research/raw/playwright-clone/routes",
    "research/raw/playwright-clone/workflows",
    "research/normalized",
    "research/reports/coverage",
    "research/reports/parity",
    "research/reports/failures",
    "research/reports/qa",

    "specs/schema/semantic-rules",
    "specs/generated",

    "agents/capture-agent/prompts",
    "agents/capture-agent/src",
    "agents/capture-agent/tests",
    "agents/formalization-agent/prompts",
    "agents/formalization-agent/src",
    "agents/formalization-agent/tests",
    "agents/playwright-synthesis-agent/prompts",
    "agents/playwright-synthesis-agent/src",
    "agents/playwright-synthesis-agent/tests",
    "agents/spec-agent/prompts",
    "agents/spec-agent/src",
    "agents/spec-agent/tests",
    "agents/generation-agent/prompts",
    "agents/generation-agent/src",
    "agents/generation-agent/tests",
    "agents/qa-agent/prompts",
    "agents/qa-agent/src",
    "agents/qa-agent/tests",
    "agents/patch-agent/prompts",
    "agents/patch-agent/src",
    "agents/patch-agent/tests",

    "scripts/bootstrap",
    "scripts/capture",
    "scripts/formalize",
    "scripts/synthesize",
    "scripts/generate",
    "scripts/validate",
    "scripts/package",
    "scripts/deploy",

    "packages/ui/src",
    "packages/api-client/src",
    "packages/config",
    "packages/spec-types/src",
    "packages/test-utils/src",
    "packages/shared-types/src",

    "templates/clone-base",
    "templates/feature-slice",
    "templates/entity-crud",
    "templates/page-object",
    "templates/docker",
    "templates/electron",

    "generated/manifests",
    "generated/codegen",
    "generated/diffs",

    "docker/compose",
    "docker/api",
    "docker/web",
    "docker/postgres",
    "docker/nginx",

    "deployment/environments/local",
    "deployment/environments/qa",
    "deployment/environments/staging",
    "deployment/environments/production",
    "deployment/smoke",
    "deployment/releases",
    "deployment/rollback",

    ".github/workflows",
]


GITKEEP_DIRS = [
    "research/raw/computer-use/target",
    "research/raw/computer-use/clone",
    "research/raw/playwright-target/auth",
    "research/raw/playwright-target/routes",
    "research/raw/playwright-target/workflows",
    "research/raw/playwright-clone/auth",
    "research/raw/playwright-clone/routes",
    "research/raw/playwright-clone/workflows",
    "research/reports/coverage",
    "research/reports/parity",
    "research/reports/failures",
    "research/reports/qa",
    "specs/generated",
    "generated/manifests",
    "generated/codegen",
    "generated/diffs",
]


def mkdirs():
    for d in DIRS:
        (ROOT / d).mkdir(parents=True, exist_ok=True)
    for d in GITKEEP_DIRS:
        p = ROOT / d / ".gitkeep"
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            p.write_text("", encoding="utf-8")


def write_if_missing(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        p.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")


def main():
    mkdirs()

    root_package = {
        "name": APP_NAME,
        "private": True,
        "packageManager": "pnpm@10",
        "scripts": {
            "dev:web": "pnpm --dir apps/web dev",
            "dev:api": "cd apps/api && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
            "capture": "node scripts/capture/run-computer-use.mjs",
            "formalize": "node scripts/formalize/normalize-session.mjs",
            "synthesize": "node scripts/synthesize/generate-playwright-assets.mjs && node scripts/synthesize/generate-specs.mjs",
            "generate": "node scripts/generate/generate-backend.mjs && node scripts/generate/generate-openapi-client.mjs && node scripts/generate/generate-frontend.mjs && node scripts/generate/generate-tests.mjs && node scripts/generate/generate-seeds.mjs",
            "validate": "bash scripts/validate/run-typecheck.sh && bash scripts/validate/run-pytests.sh && bash scripts/validate/run-playwright-clone.sh",
            "package": "bash scripts/package/build-api-image.sh && bash scripts/package/build-web-image.sh && bash scripts/package/build-electron.sh",
        },
    }

    web_package = {
        "name": f"@{APP_NAME}/web",
        "private": True,
        "scripts": {
            "dev": "next dev -p 3000",
            "build": "next build",
            "start": "next start -p 3000",
            "lint": "next lint",
            "playwright": "playwright test",
        },
        "dependencies": {
            "next": "^15.0.0",
            "react": "^19.0.0",
            "react-dom": "^19.0.0",
        },
        "devDependencies": {
            "@playwright/test": "^1.54.0",
            "@types/node": "^22.0.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            "typescript": "^5.6.0",
        },
    }

    desktop_package = {
        "name": f"@{APP_NAME}/desktop",
        "private": True,
        "main": "src/main.ts",
        "scripts": {
            "dev": "electron .",
        },
        "devDependencies": {
            "electron": "^37.0.0",
            "typescript": "^5.6.0",
        },
    }

    write_if_missing("README.md", f"""
    # {APP_NAME}

    Monorepo boilerplate for SaaS clone research, normalized manifests, spec synthesis,
    generation, validation, packaging, and deployment.
    """)

    write_if_missing(".env.example", """
    NODE_ENV=development
    NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
    DATABASE_URL=postgresql://app:app@db:5432/app
    API_PORT=8000
    WEB_PORT=3000
    POSTGRES_DB=app
    POSTGRES_USER=app
    POSTGRES_PASSWORD=app
    """)

    write_if_missing("package.json", json.dumps(root_package, indent=2) + "\n")

    write_if_missing("pnpm-workspace.yaml", """
    packages:
      - "apps/*"
      - "packages/*"
    """)

    write_if_missing("turbo.json", json.dumps({
        "$schema": "https://turbo.build/schema.json",
        "tasks": {
            "build": {"dependsOn": ["^build"], "outputs": [".next/**", "dist/**"]},
            "lint": {"dependsOn": ["^lint"]},
            "test": {"dependsOn": ["^test"]},
            "typecheck": {"dependsOn": ["^typecheck"]},
        },
    }, indent=2) + "\n")

    write_if_missing("apps/web/package.json", json.dumps(web_package, indent=2) + "\n")
    write_if_missing("apps/web/next.config.ts", """
    const nextConfig = {};
    export default nextConfig;
    """)
    write_if_missing("apps/web/tsconfig.json", json.dumps({
        "compilerOptions": {
            "target": "ES2022",
            "lib": ["dom", "dom.iterable", "es2022"],
            "allowJs": False,
            "skipLibCheck": True,
            "strict": True,
            "noEmit": True,
            "module": "esnext",
            "moduleResolution": "bundler",
            "resolveJsonModule": True,
            "isolatedModules": True,
            "jsx": "preserve",
            "incremental": True,
            "baseUrl": ".",
            "paths": {"@/*": ["./src/*"]},
        },
        "include": ["**/*.ts", "**/*.tsx"],
        "exclude": ["node_modules"],
    }, indent=2) + "\n")
    write_if_missing("apps/web/src/app/layout.tsx", """
    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="en">
          <body>{children}</body>
        </html>
      );
    }
    """)
    write_if_missing("apps/web/src/app/page.tsx", """
    export default function HomePage() {
      return <main style={{ padding: 24 }}>Clone factory web app</main>;
    }
    """)
    write_if_missing("apps/web/Dockerfile", """
    FROM node:22-alpine
    WORKDIR /app
    COPY apps/web /app
    RUN npm install -g pnpm && pnpm install && pnpm build
    CMD ["pnpm", "start"]
    """)

    write_if_missing("apps/api/pyproject.toml", f"""
    [project]
    name = "{APP_NAME}-api"
    version = "0.1.0"
    requires-python = ">=3.11"
    dependencies = [
      "fastapi>=0.115.0",
      "uvicorn[standard]>=0.30.0",
      "sqlalchemy>=2.0.0",
      "psycopg[binary]>=3.2.0",
      "pydantic>=2.8.0"
    ]
    """)
    write_if_missing("apps/api/app/main.py", """
    from fastapi import FastAPI
    from app.api.router import api_router

    app = FastAPI(title="Clone Factory API")
    app.include_router(api_router, prefix="/api")


    @app.get("/health")
    def health():
        return {"status": "ok"}
    """)
    write_if_missing("apps/api/app/api/router.py", """
    from fastapi import APIRouter

    api_router = APIRouter()
    """)
    write_if_missing("apps/api/Dockerfile", """
    FROM python:3.12-slim
    WORKDIR /app
    COPY apps/api /app
    RUN pip install --no-cache-dir fastapi uvicorn sqlalchemy psycopg[binary] pydantic
    CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    """)

    write_if_missing("apps/desktop/package.json", json.dumps(desktop_package, indent=2) + "\n")
    write_if_missing("apps/desktop/src/main.ts", """
    console.log("Electron shell placeholder");
    """)

    write_if_missing("docker-compose.yml", """
    services:
      db:
        image: postgres:16
        environment:
          POSTGRES_DB: app
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
        ports:
          - "5432:5432"

      api:
        build:
          context: .
          dockerfile: apps/api/Dockerfile
        env_file:
          - .env.example
        depends_on:
          - db
        ports:
          - "8000:8000"

      web:
        build:
          context: .
          dockerfile: apps/web/Dockerfile
        env_file:
          - .env.example
        depends_on:
          - api
        ports:
          - "3000:3000"
    """)

    write_if_missing("docker/compose/dev.yaml", 'include:\n  - ../../docker-compose.yml\n')
    write_if_missing("docker/compose/qa.yaml", 'include:\n  - ../../docker-compose.yml\n')
    write_if_missing("docker/compose/staging.yaml", 'include:\n  - ../../docker-compose.yml\n')
    write_if_missing("docker/compose/prod.yaml", 'include:\n  - ../../docker-compose.yml\n')

    for name, content in {
        "specs/app-definition.yaml": 'schema_version: "1.0"\napp:\n  key: ""\n  name: ""\n',
        "specs/pages.yaml": 'schema_version: "1.0"\npages: []\n',
        "specs/entities.yaml": 'schema_version: "1.0"\nentities: []\n',
        "specs/workflows.yaml": 'schema_version: "1.0"\nworkflows: []\n',
        "specs/permissions.yaml": 'schema_version: "1.0"\nroles: []\n',
        "specs/state-model.yaml": 'schema_version: "1.0"\nstate_model: {}\n',
        "specs/seed-plan.yaml": 'schema_version: "1.0"\nseed_plan: {}\n',
        "specs/stub-register.yaml": 'schema_version: "1.0"\nstubs: []\n',
        "specs/api-conventions.yaml": 'schema_version: "1.0"\napi:\n  style: rest\n',
        "specs/feature-matrix.csv": 'feature_key,page_key,route,component_key,entity_key,action_type,workflow_key,query_keys,mutation_keys,permission_keys,backend_endpoint,status,test_unit,test_integration,test_e2e,visual_covered,seed_covered,notes\n',
    }.items():
        write_if_missing(name, content)

    for schema_file in [
        "app-definition.schema.yaml",
        "pages.schema.yaml",
        "entities.schema.yaml",
        "workflows.schema.yaml",
        "permissions.schema.yaml",
        "state-model.schema.yaml",
        "seed-plan.schema.yaml",
        "stub-register.schema.yaml",
        "api-conventions.schema.yaml",
        "feature-matrix.schema.yaml",
    ]:
        write_if_missing(f"specs/schema/{schema_file}", "type: object\n")

    for name, data in {
        "research/normalized/routes.json": {"routes": []},
        "research/normalized/workflows.json": {"workflows": []},
        "research/normalized/components.json": {"components": []},
        "research/normalized/locator-hints.json": {"locator_hints": []},
        "research/normalized/network-hints.json": {"network_hints": []},
        "research/normalized/page-state-map.json": {"page_states": []},
        "research/normalized/permission-surface.json": {"permission_surface": []},
        "research/normalized/entity-hypotheses.json": {"entity_hypotheses": []},
    }.items():
        write_if_missing(name, json.dumps(data, indent=2) + "\n")

    for agent in [
        "capture-agent",
        "formalization-agent",
        "playwright-synthesis-agent",
        "spec-agent",
        "generation-agent",
        "qa-agent",
        "patch-agent",
    ]:
        write_if_missing(f"agents/{agent}/README.md", f"# {agent}\n")
        write_if_missing(f"agents/{agent}/src/run.mjs", f'console.log("{agent} placeholder");\n')

    for path, content in {
        "scripts/capture/run-computer-use.mjs": 'console.log("capture placeholder");\n',
        "scripts/formalize/normalize-session.mjs": 'console.log("formalize placeholder");\n',
        "scripts/synthesize/generate-playwright-assets.mjs": 'console.log("generate Playwright assets placeholder");\n',
        "scripts/synthesize/generate-specs.mjs": 'console.log("generate specs placeholder");\n',
        "scripts/generate/generate-backend.mjs": 'console.log("generate backend placeholder");\n',
        "scripts/generate/generate-openapi-client.mjs": 'console.log("generate openapi client placeholder");\n',
        "scripts/generate/generate-frontend.mjs": 'console.log("generate frontend placeholder");\n',
        "scripts/generate/generate-tests.mjs": 'console.log("generate tests placeholder");\n',
        "scripts/generate/generate-seeds.mjs": 'console.log("generate seeds placeholder");\n',
    }.items():
        write_if_missing(path, content)

    shell_scripts = {
        "scripts/validate/run-typecheck.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "typecheck placeholder"\n',
        "scripts/validate/run-pytests.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "pytest placeholder"\n',
        "scripts/validate/run-playwright-target.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "playwright target placeholder"\n',
        "scripts/validate/run-playwright-clone.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "playwright clone placeholder"\n',
        "scripts/validate/run-visual-diff.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "visual diff placeholder"\n',
        "scripts/validate/smoke.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "smoke placeholder"\n',
        "scripts/package/build-api-image.sh": f'#!/usr/bin/env bash\nset -euo pipefail\ndocker build -f apps/api/Dockerfile -t {APP_NAME}-api .\n',
        "scripts/package/build-web-image.sh": f'#!/usr/bin/env bash\nset -euo pipefail\ndocker build -f apps/web/Dockerfile -t {APP_NAME}-web .\n',
        "scripts/package/build-electron.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "electron package placeholder"\n',
        "scripts/deploy/deploy-local.sh": '#!/usr/bin/env bash\nset -euo pipefail\ndocker compose -f docker/compose/dev.yaml up -d --build\n',
        "scripts/deploy/deploy-qa.sh": '#!/usr/bin/env bash\nset -euo pipefail\ndocker compose -f docker/compose/qa.yaml up -d --build\n',
        "scripts/deploy/deploy-staging.sh": '#!/usr/bin/env bash\nset -euo pipefail\ndocker compose -f docker/compose/staging.yaml up -d --build\n',
        "scripts/deploy/deploy-production.sh": '#!/usr/bin/env bash\nset -euo pipefail\ndocker compose -f docker/compose/prod.yaml up -d --build\n',
        "scripts/deploy/verify-release.sh": '#!/usr/bin/env bash\nset -euo pipefail\necho "verify release placeholder"\n',
    }

    for path, content in shell_scripts.items():
        write_if_missing(path, content)

    print(f"Bootstrapped {APP_NAME}")


if __name__ == "__main__":
    main()
