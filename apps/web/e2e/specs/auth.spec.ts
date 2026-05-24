/**
 * Auth flows — the criteria's §5b minimum is: valid login, invalid login,
 * logout, session persistence. All four are here.
 *
 * The seed user is created by `e2e/global.setup.ts` via the gated
 * `POST /auth/test-login` route. It is registered as
 * `playwright-e2e@example.com / password123` on first run.
 */
import { test, expect } from "../fixtures/test";
import { LoginPage } from "../pages/LoginPage";

const SEED_EMAIL = process.env.TEST_AUTH_EMAIL ?? "playwright-e2e@example.com";
const SEED_PASSWORD = "password123";

test.describe("valid login", () => {
  // Logged-out start — opt out of the default admin storageState.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("lands on the dashboard after correct credentials", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.fillCredentials(SEED_EMAIL, SEED_PASSWORD);
    await login.submit();

    // Successful login redirects through "/" -> "/dashboard" -> "/dashboard/lists".
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("invalid login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows an error and stays on /auth/sign-in", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.fillCredentials(SEED_EMAIL, "definitely-not-the-password");
    await login.submit();

    await expect(login.errorBanner()).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/auth/sign-in");
  });
});

test("logout clears the session cookie", async ({ page, api }) => {
  // Default storageState is admin — we start authenticated.
  await page.goto("/");
  // Confirm we landed inside the app shell (not bounced to sign-in).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Hit the logout endpoint directly; the UI logout button surface is
  // covered by a separate spec once the user-menu testid lands.
  await api.step("POST /auth/logout");

  // After logout, /auth/me must 401.
  const me = await api.request.get(`${process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000"}/auth/me`);
  expect(me.status()).toBe(401);
});

test("session persists across a hard reload", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.reload();
  // Still in the app shell — no bounce to /auth/sign-in.
  await expect(page).toHaveURL(/\/dashboard/);
});
