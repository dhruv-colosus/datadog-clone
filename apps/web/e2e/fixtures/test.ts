/**
 * The single `test` export every spec imports.
 *
 *     import { test, expect } from "../fixtures/test";
 *
 * Composes the auth, api, db, and namespace fixtures so specs don't need
 * to wire them up individually. `expect` is re-exported so specs only
 * import from one place.
 */
import { mergeTests } from "@playwright/test";

import { test as apiTest } from "./api";
import { test as authTest } from "./auth";
import { test as dbTest } from "./db";
import { test as nsTest } from "./namespace";

export const test = mergeTests(authTest, apiTest, dbTest, nsTest);
export { expect } from "@playwright/test";
