/**
 * Monitors — render spec. Asserts the manage page boots and the page-root
 * testid is in the DOM. This is the criteria's "one feature-page render
 * spec" minimum-mergeable bar from §9.
 */
import { test, expect } from "../fixtures/test";
import { MonitorsPage } from "../pages/MonitorsPage";

test("monitor manage page renders for an authenticated user", async ({
  page,
}) => {
  const monitors = new MonitorsPage(page);
  await monitors.goto();

  await expect(monitors.root()).toBeVisible();
  // Page hosts the filter input — confirm it actually mounted, not just a shell.
  await expect(page.getByPlaceholder("Filter monitors")).toBeVisible();
});
