/**
 * API fixture — provides a thin `api.step(toolName, args)` helper that
 * POSTs against the FastAPI backend and asserts the endpoint exists in
 * the OpenAPI schema.
 *
 * Convention from the universal acceptance checklist §5c:
 *   "Tool registry. Every tool a spec uses via `api.step()` exists in
 *    `server.py:TOOLS`. The fixture caches the registry on first call
 *    and asserts on every step."
 *
 * This repo uses FastAPI routers (not a flat TOOLS dict). The cache below
 * walks the OpenAPI document to extract every `path:method` pair, which is
 * the equivalent registry.
 *
 * Usage:
 *   await api.step("POST /monitors", { name: ns.name("cpu"), query: "…" });
 */
import { test as base, type APIRequestContext } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

type ToolRegistry = Set<string>;
let cachedRegistry: ToolRegistry | null = null;

async function loadRegistry(req: APIRequestContext): Promise<ToolRegistry> {
  if (cachedRegistry) return cachedRegistry;
  const res = await req.get(`${API_URL}/openapi.json`);
  if (!res.ok()) {
    throw new Error(
      `Could not load OpenAPI schema for tool-registry assertion (${res.status()})`,
    );
  }
  const schema = (await res.json()) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const reg: ToolRegistry = new Set();
  for (const [route, methods] of Object.entries(schema.paths)) {
    for (const method of Object.keys(methods)) {
      reg.add(`${method.toUpperCase()} ${route}`);
    }
  }
  cachedRegistry = reg;
  return reg;
}

export type ApiFixture = {
  api: {
    /**
     * Call a backend tool by `"METHOD /path"`. Asserts the tool exists in
     * the OpenAPI schema (cached on first call). Returns the parsed body
     * for chaining.
     */
    step: <T = unknown>(tool: string, body?: unknown) => Promise<T>;
    /** Raw request context for non-mutating reads. */
    request: APIRequestContext;
  };
};

export const test = base.extend<ApiFixture>({
  api: async ({ request }, use) => {
    const registry = await loadRegistry(request);

    await use({
      request,
      async step<T>(tool: string, body?: unknown): Promise<T> {
        if (!registry.has(tool)) {
          throw new Error(
            `api.step("${tool}") — endpoint not in OpenAPI registry. ` +
              `Add the route in app/api/router.py before using it from specs.`,
          );
        }
        const [method, route] = tool.split(" ");
        const url = `${API_URL}${route}`;
        const opts = body === undefined ? undefined : { data: body };
        let res;
        switch (method) {
          case "GET":
            res = await request.get(url);
            break;
          case "POST":
            res = await request.post(url, opts);
            break;
          case "PUT":
            res = await request.put(url, opts);
            break;
          case "PATCH":
            res = await request.patch(url, opts);
            break;
          case "DELETE":
            res = await request.delete(url, opts);
            break;
          default:
            throw new Error(`Unsupported method in api.step: ${method}`);
        }
        if (!res.ok()) {
          const text = await res.text();
          throw new Error(
            `api.step("${tool}") -> ${res.status()} ${res.statusText()}\n${text}`,
          );
        }
        try {
          return (await res.json()) as T;
        } catch {
          return undefined as T;
        }
      },
    });
  },
});
