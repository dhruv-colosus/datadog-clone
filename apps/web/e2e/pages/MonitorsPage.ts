import type { Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class MonitorsPage extends BasePage {
  readonly id = "monitors-manage";
  readonly route = "/monitor/manage";

  constructor(page: Page) {
    super(page);
  }

  newMonitorButton() {
    return this.page.getByTestId("new-monitor-button");
  }

  monitorRow(id: number | string) {
    return this.page.getByTestId(`monitor-row-${id}`);
  }

  emptyState() {
    return this.empty();
  }
}
