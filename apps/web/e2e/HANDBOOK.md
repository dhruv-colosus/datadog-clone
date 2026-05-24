# E2E Handbook

Onboarding doc for the Playwright suite — read once, refer back when authoring specs.

## 1. The five fixtures

Every spec imports the composed `test` from `fixtures/test.ts`, which merges these four:

| Fixture | Purpose |
|---|---|
| `auth` | Provides default admin storageState and a `signOut(page)` helper. |
| `api`  | `api.step("METHOD /path", body)` — types, asserts the endpoint exists in OpenAPI, throws on non-2xx. |
| `db`   | Read-only `db.state()` (counts + schema version). Admin-gated `db.reseed()`, `db.clearTelemetry()` (no-ops without `ADMIN_API_KEY`). |
| `ns`   | `ns.name("monitor-cpu")` — per-spec unique-prefixed entity name to prevent collisions. |

Import once:

```ts
import { test, expect } from "../fixtures/test";

test("valid login lands on home", async ({ page, api, ns, db }) => {
  // …
});
```

## 2. Page Object Models

Every page that has a spec has a POM in `pages/`. POMs extend `BasePage` and expose:

```ts
class MonitorsPage extends BasePage {
  readonly id = "monitors-manage";
  readonly route = "/monitor/manage";

  newMonitorButton() { return this.page.getByTestId("new-monitor-button"); }
  monitorRow(id) { return this.page.getByTestId(`monitor-row-${id}`); }
}
```

`BasePage.goto()` navigates and awaits `<id>-page`. `BasePage.root()`, `.empty()`, `.error()` map to the canonical state testids.

## 3. Testid conventions

| Element | Testid shape | Example |
|---|---|---|
| Page root | `<page>-page` | `monitors-manage-page` |
| Form field | `<form>-<field>` | `login-email`, `login-password` |
| Submit button | `<form>-submit` | `login-submit` |
| Action button | `<action>-button` | `new-monitor-button`, `mute-monitor-button` |
| List row | `<entity>-row-<id>` | `monitor-row-42` |
| Tab | `<page>-tab-<key>` | `monitor-detail-tab-history` |
| Modal | `<purpose>-modal` | `delete-confirm-modal` |
| Empty state | `<page>-empty` | `monitors-manage-empty` |
| Error state | `<page>-error` | `monitors-manage-error` |

If a test would want to assert on it, give it a testid.

## 4. Default auth + opt-out

Default storageState is `e2e/.auth/admin.json`. To start logged out:

```ts
test.describe("invalid login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("rejects bad password", async ({ page }) => {
    // …
  });
});
```

## 5. Arrange via API, Act + Assert via UI

Don't click 30 buttons just to set up state. Seed via `api.step` and exercise the contract in the browser:

```ts
test("mutes a monitor", async ({ page, api, ns }) => {
  // Arrange — create a monitor via the backend.
  const monitor = await api.step<{ id: number }>("POST /monitors", {
    name: ns.name("cpu-mute-test"),
    query: "avg:system.cpu.user{*} > 80",
    type: "metric alert",
  });

  // Act — drive the UI.
  const monitors = new MonitorsPage(page);
  await monitors.goto();
  await monitors.monitorRow(monitor.id).getByTestId("mute-monitor-button").click();

  // Assert — UI reflects the new state.
  await expect(monitors.monitorRow(monitor.id)).toContainText("Muted");
});
```

## 6. Naming entities

`ns.name(suffix)` returns `e2e-<testId>-<rand>-<suffix>`. Use it for every name your spec creates. Never hardcode names — they collide across parallel runs.

## 7. Each spec file is independent

A spec must not assume another spec ran first. If you need a shared precondition, encode it in `api.step()` calls inside `beforeEach`.

## 8. When a spec is flaky

1. Re-run with `--ui` and watch the trace.
2. If a wait is too short, raise the timeout in the locator call — not in `playwright.config.ts`.
3. If the test relies on a backend-side timer (e.g. telemetry tick), poll via `expect.poll(...)`.
4. If still flaky, mark `⚠️` in `COVERAGE.md` and open an issue.
