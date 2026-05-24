/**
 * Base Page Object — every per-page POM extends this.
 *
 * Provides the `waitForLoaded` contract every page must support: each page
 * root carries a `data-testid="<page>-page"` per the universal acceptance
 * checklist §6, and that testid serves as the loaded indicator.
 */
import type { Locator, Page } from "@playwright/test";

export abstract class BasePage {
  /** The kebab-case identifier baked into `data-testid="<id>-page"`. */
  abstract readonly id: string;
  /** The route segment used by `goto()`. */
  abstract readonly route: string;

  constructor(protected readonly page: Page) {}

  /** Navigate to the page. */
  async goto(): Promise<void> {
    await this.page.goto(this.route);
    await this.waitForLoaded();
  }

  /** Wait until the page-root testid is mounted. */
  async waitForLoaded(): Promise<void> {
    await this.root().waitFor({ state: "visible", timeout: 15_000 });
  }

  /** The DOM node carrying `data-testid="<id>-page"`. */
  root(): Locator {
    return this.page.getByTestId(`${this.id}-page`);
  }

  /** Optional empty-state matcher — `<id>-empty`. */
  empty(): Locator {
    return this.page.getByTestId(`${this.id}-empty`);
  }

  /** Optional error-state matcher — `<id>-error`. */
  error(): Locator {
    return this.page.getByTestId(`${this.id}-error`);
  }
}
