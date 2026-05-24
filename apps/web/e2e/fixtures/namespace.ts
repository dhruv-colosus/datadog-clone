/**
 * Namespace fixture — gives each spec a unique prefix for the entities it
 * creates, so parallel + repeat runs don't collide.
 *
 * Convention from the universal acceptance checklist §5c:
 *   "`ns.name(...)` for created entities. Per-spec unique prefixes prevent
 *    parallel/repeat-run collisions."
 *
 * Usage:
 *   const ns = test.use({ namespace: "monitor-create" }); // optional override
 *   await api.step("POST /monitors", { name: ns.name("cpu-alert") });
 */
import { test as base } from "@playwright/test";

export type NamespaceFixture = {
  ns: {
    /** Returns `"<prefix>-<suffix>"` where the prefix is unique per spec. */
    name: (suffix: string) => string;
    /** The raw prefix, useful for substring assertions. */
    prefix: string;
  };
};

export const test = base.extend<NamespaceFixture>({
  ns: async ({}, use, testInfo) => {
    // testInfo.testId is stable per test run; combine with a short random
    // segment so re-running locally doesn't replay the exact same name.
    const random = Math.random().toString(36).slice(2, 6);
    const prefix = `e2e-${testInfo.testId.slice(0, 6)}-${random}`;
    await use({
      prefix,
      name: (suffix) => `${prefix}-${suffix}`,
    });
  },
});
