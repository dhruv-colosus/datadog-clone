/**
 * Auth fixture — exposes the seeded admin / user session.
 *
 * Default storageState for every spec is `e2e/.auth/admin.json` (set in
 * `playwright.config.ts`). Specs that need a logged-out start opt in via
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 *
 * Convention enforced by the universal acceptance checklist §5c:
 * "Default auth = admin."
 */
import { test as base, type Page } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, "..", ".auth");

export type AuthFixture = {
  /** Path on disk to the storageState bundle written by global.setup.ts. */
  storagePathFor: (label: "admin" | "user") => string;
  /** Force-logout helper for specs that exercise the unauthenticated UI. */
  signOut: (page: Page) => Promise<void>;
};

export const test = base.extend<AuthFixture>({
  storagePathFor: async ({}, use) => {
    await use((label) => path.join(AUTH_DIR, `${label}.json`));
  },

  signOut: async ({}, use) => {
    await use(async (page) => {
      await page.context().clearCookies();
      await page.goto("/auth/sign-in");
    });
  },
});
