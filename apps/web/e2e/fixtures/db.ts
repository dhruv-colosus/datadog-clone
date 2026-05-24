/**
 * DB fixture — exposes read-only state assertions for specs.
 *
 * The universal acceptance checklist §2 explicitly forbids public
 * `POST /reset` style HTTP endpoints that wipe the DB. This fixture
 * therefore goes through admin-gated routes (`/admin/*`) which require
 * `X-Admin-Key`. Set the env var `ADMIN_API_KEY` to enable destructive
 * helpers — without it they no-op (404).
 */
import { test as base, type APIRequestContext } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? "";

export type DbFixture = {
  db: {
    /** Backend seed-state snapshot (counts, schema version). */
    state: () => Promise<{
      users_count: number;
      is_seeded: boolean;
      schema_version: string | null;
    }>;
    /** Admin-gated: truncate telemetry tables. Skips silently if no key. */
    clearTelemetry: () => Promise<void>;
    /** Admin-gated: reseed canned fixtures. Skips silently if no key. */
    reseed: () => Promise<void>;
  };
};

function adminHeaders(): Record<string, string> {
  return ADMIN_KEY ? { "X-Admin-Key": ADMIN_KEY } : {};
}

export const test = base.extend<DbFixture>({
  db: async ({ request }, use: (db: DbFixture["db"]) => Promise<void>) => {
    const helpers = makeDb(request);
    await use(helpers);
  },
});

function makeDb(request: APIRequestContext): DbFixture["db"] {
  return {
    async state() {
      const res = await request.get(`${API_URL}/state`);
      if (!res.ok()) {
        throw new Error(`/state -> ${res.status()}`);
      }
      return await res.json();
    },
    async clearTelemetry() {
      if (!ADMIN_KEY) return;
      await request.post(`${API_URL}/admin/clear-telemetry`, {
        headers: adminHeaders(),
      });
    },
    async reseed() {
      if (!ADMIN_KEY) return;
      await request.post(`${API_URL}/admin/seed`, {
        headers: adminHeaders(),
      });
    },
  };
}
