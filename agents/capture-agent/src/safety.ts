import type { Page, Route } from "playwright";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const WRITE_PATH_PATTERNS = [
  /\/api\/v\d+\/monitor/i,
  /\/api\/v\d+\/dashboard/i,
  /\/api\/v\d+\/notebook/i,
  /\/api\/v\d+\/synthetics/i,
  /\/api\/v\d+\/slo/i,
  /\/api\/v\d+\/incident/i,
  /\/api\/v\d+\/logs\/config/i,
];

export function isWriteShapedDatadogRequest(
  method: string,
  url: string,
): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return false;
  if (!/datadoghq\.(com|eu)|datadoghq\.us/.test(url)) return false;
  return WRITE_PATH_PATTERNS.some((re) => re.test(url));
}

export async function installNetworkGuards(page: Page): Promise<void> {
  await page.route("**/*", async (route: Route) => {
    const req = route.request();
    if (isWriteShapedDatadogRequest(req.method(), req.url())) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

const EVAL_FORBIDDEN = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnavigator\.sendBeacon\b/,
  /\blocation\s*=/,
  /\blocation\.(href|assign|replace)\s*=/,
  /\bdocument\.cookie\s*=/,
];

export function assertReadOnlyEval(script: string): void {
  for (const re of EVAL_FORBIDDEN) {
    if (re.test(script)) {
      throw new Error(
        `eval_js rejected: script matches forbidden pattern ${re.source}`,
      );
    }
  }
}

const URL_ALLOWLIST = [
  /^https?:\/\/app\.datadoghq\.(com|eu)(\/.*)?$/,
  /^https?:\/\/app\.datadoghq\.us(\/.*)?$/,
  /^about:blank$/,
];

export function assertAllowedUrl(url: string): void {
  if (!URL_ALLOWLIST.some((re) => re.test(url))) {
    throw new Error(`navigate rejected: ${url} is not in the allowlist`);
  }
}
