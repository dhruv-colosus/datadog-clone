import type { Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  readonly id = "sign-in";
  readonly route = "/auth/sign-in";

  constructor(page: Page) {
    super(page);
  }

  emailInput() {
    return this.page.getByTestId("login-email");
  }
  passwordInput() {
    return this.page.getByTestId("login-password");
  }
  submitButton() {
    return this.page.getByTestId("login-submit");
  }
  errorBanner() {
    return this.page.getByTestId("login-error");
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton().click();
  }
}
