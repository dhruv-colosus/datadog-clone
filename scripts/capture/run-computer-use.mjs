#!/usr/bin/env node
// Capture stage entrypoint.
//
// The actual capture loop runs inside Claude Code (using your Max subscription)
// against the capture-mcp server registered in .mcp.json. This script is a thin
// instructions printer — it does not drive the browser itself.

const lines = [
  "",
  "=== Datadog clone — capture stage ===",
  "",
  "The capture loop runs inside Claude Code, not this script.",
  "",
  "One-time setup:",
  "  1. cp .env.example .env && fill in E2B_API_KEY, DATADOG_BASE_URL.",
  "  2. pnpm install                              # root + workspaces",
  "  3. pnpm --dir agents/capture-agent build     # compile the MCP server",
  "  4. node scripts/auth/export-datadog-cookies.mjs",
  "     (a headed browser opens — log into Datadog, press Enter)",
  "",
  "Run the capture:",
  "  5. From this project root, run: claude",
  "  6. Inside Claude Code:",
  "       /capture --dry-run     # smoke-test auth + sandbox",
  "       /capture nav-shell     # one screen",
  "       /capture --all         # full starter slice",
  "",
  "Outputs:",
  "  research/captures/<run-id>/   raw artifacts (screenshots, DOM, HAR, narration)",
  "  research/reports/<run-id>/    human-readable per-screen reports + index.md",
  "",
];

for (const l of lines) console.log(l);
