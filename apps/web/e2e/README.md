# E2E suite (Playwright)

End-to-end tests for the Datadog clone. Run against a live FastAPI + Next.js stack — either the docker compose stack (`task datadog:up`) or the dev servers Playwright boots automatically via the `webServer` block in `playwright.config.ts`.

## Quick start

```bash
# Install Playwright browsers + system deps (once).
task datadog:test-e2e-install

# Run the full suite.
task datadog:test-e2e

# Author a new spec interactively.
task datadog:test-e2e-ui

# Open the last HTML report.
task datadog:test-e2e-report
```

## Layout

```
e2e/
├── COVERAGE.md           Spec contract — one row per flow.
├── HANDBOOK.md           Onboarding doc (fixtures, POMs, conventions).
├── README.md             This file.
├── global.setup.ts       Pre-generates e2e/.auth/<user>.json (setup project).
├── .auth/                gitignored — written by global.setup.ts.
├── fixtures/             5 fixtures composed via test.ts.
│   ├── test.ts           The composed `test` every spec imports.
│   ├── auth.ts           Default admin storageState, signOut() helper.
│   ├── api.ts            api.step() — typed POSTs with OpenAPI assertion.
│   ├── db.ts             /state and admin-gated reseed helpers.
│   └── namespace.ts      ns.name() unique-prefix factory.
├── pages/                Page Object Models, one per page.
│   ├── BasePage.ts       Shared goto/waitForLoaded/empty/error contracts.
│   ├── LoginPage.ts      Sign-in form.
│   └── MonitorsPage.ts   Monitor manage list — pattern anchor.
├── specs/                Playwright tests.
│   ├── auth.spec.ts      Valid + invalid login, logout, session persist.
│   └── monitors.spec.ts  Monitors manage page render.
└── gen-spec/system-prompt.md  Read by the spec generator (parent monorepo).
```

## Conventions (hard rules)

1. **Default auth = admin.** Every spec ships pre-authenticated. Specs that need a logged-out start opt in:

   ```ts
   test.use({ storageState: { cookies: [], origins: [] } });
   ```

2. **Page roots carry `<id>-page` testids.** The generator refuses to write specs for pages that don't.

3. **`ns.name(...)` for created entities.** Per-spec prefixes prevent parallel collisions.

4. **Arrange via API, Act + Assert via UI.** `api.step("POST /monitors", …)` to seed the precondition; drive the contract through the browser.

5. **Each spec file independently runnable.** No shared mutable state across files.

See `HANDBOOK.md` for the full convention reference.

## Updating storageState

`e2e/.auth/admin.json` and `e2e/.auth/user.json` are written by the `setup` project (`global.setup.ts`) on every run. To force a refresh, delete the file and re-run — they'll be regenerated.

## Single-spec invocation

```bash
cd apps/web
pnpm exec playwright test specs/auth.spec.ts
pnpm exec playwright test specs/auth.spec.ts:42  # by line number
pnpm exec playwright test --grep "valid login"   # by title
```
