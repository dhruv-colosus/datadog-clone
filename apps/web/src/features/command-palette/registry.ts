import {
  ChartLine,
  ClipboardText,
  ClockCounterClockwise,
  Cube,
  Faders,
  ListMagnifyingGlass,
  MagnifyingGlass,
  Notebook,
  Plus,
  Speedometer,
  UserPlus,
  type Icon,
} from "@phosphor-icons/react";

import { navSections } from "@/features/sidebar/nav-config";

/**
 * Routes that have a corresponding Next.js `page.tsx`.
 * Anything not listed here is rendered without a route hint and
 * the palette will navigate to "/" as a fallback.
 *
 * Add new routes here as pages are scaffolded.
 */
const EXISTING_ROUTES = new Set<string>([
  "/",
  "/apm",
  "/apm/home",
  "/apm/service-map",
  "/apm/traces",
  "/dashboard",
  "/dashboard/lists",
  "/infrastructure",
  "/infrastructure/map",
  "/logs",
  "/metric/explore",
  "/metrics",
  "/monitors/create",
  "/monitors/manage",
  "/notebook/list",
  "/rum",
  "/rum/explorer",
  "/rum/session-replay",
  "/rum/summary",
  "/slo/create",
  "/slo/manage",
]);

export type CommandSection = "recents" | "pages" | "actions";

export type CommandEntry = {
  id: string;
  label: string;
  /** Sub-label rendered next to the title (e.g. "Software Catalog"). */
  context?: string;
  icon: Icon;
  section: CommandSection;
  /** Path to navigate to. Only shown in the UI if the route exists. */
  href?: string;
  /** Optional keyboard hint shown on the right side. */
  shortcut?: string;
  /** Search index — joined with label/context for fuzzy matching. */
  keywords?: string[];
};

/** Quick lookup helper used by the palette. */
export function routeExists(href: string | undefined): href is string {
  return Boolean(href && EXISTING_ROUTES.has(href));
}

/**
 * RECENTS — top entries surfaced when the palette opens.
 * Edit this list to change what appears under "Recents".
 * Each entry references a stable `id` from the sidebar nav so the
 * label/route stays in sync if the sidebar changes.
 */
const RECENTS: Array<{
  id: string;
  /** Sidebar item label OR sidebar flyout item label. */
  matchLabel: string;
  /** Optional context label (e.g. "Software Catalog") for flyout items. */
  matchContext?: string;
  icon: Icon;
  /** Fallback href used if the sidebar nav-config doesn't declare one. */
  fallbackHref?: string;
}> = [
  { id: "recent-services", matchLabel: "Services", matchContext: "Software Catalog", icon: Cube, fallbackHref: "/apm/home" },
  { id: "recent-add-log-source", matchLabel: "Add a Log Source", matchContext: "Log Configuration", icon: MagnifyingGlass, fallbackHref: "/logs/onboarding" },
  { id: "recent-logs", matchLabel: "Logs", icon: ListMagnifyingGlass, fallbackHref: "/logs" },
  { id: "recent-dashboards", matchLabel: "Dashboards", icon: ChartLine, fallbackHref: "/dashboard/lists" },
  { id: "recent-metrics", matchLabel: "Metrics", icon: Speedometer, fallbackHref: "/metric/explore" },
];

/**
 * ACTIONS — global commands (not page navigation).
 * Edit this list to add new actions.
 */
const ACTIONS: CommandEntry[] = [
  {
    id: "action-clipboard",
    label: "View Datadog Clipboard",
    icon: ClipboardText,
    section: "actions",
    shortcut: "⌘+Shift+K",
  },
  {
    id: "action-new-dashboard",
    label: "Create New Dashboard",
    icon: Plus,
    section: "actions",
  },
  {
    id: "action-new-synthetic",
    label: "Create New Synthetics Test",
    icon: Plus,
    section: "actions",
  },
  {
    id: "action-new-notebook",
    label: "Create New Notebook",
    icon: Notebook,
    section: "actions",
  },
  {
    id: "action-new-spreadsheet",
    label: "Create New Spreadsheet",
    icon: Plus,
    section: "actions",
  },
  {
    id: "action-page-team",
    label: "Page Team or User",
    context: "On-Call",
    icon: UserPlus,
    section: "actions",
    shortcut: "Ctrl+Opt+P",
  },
];

type SidebarIndexEntry = {
  label: string;
  context?: string;
  href: string;
  icon: Icon;
};

/**
 * Walks the sidebar nav config and returns a flat list of every page
 * that has an explicit `href` (top-level item or flyout sub-item).
 * Used as the search index AND as the source of truth for recents.
 */
function buildSidebarIndex(): SidebarIndexEntry[] {
  const out: SidebarIndexEntry[] = [];

  for (const section of navSections) {
    for (const item of section) {
      if (item.href) {
        out.push({ label: item.label, href: item.href, icon: item.icon });
      }
      for (const group of item.flyout ?? []) {
        for (const sub of group.primary ?? []) {
          if (sub.href) {
            out.push({
              label: sub.label,
              context: group.heading,
              href: sub.href,
              icon: item.icon,
            });
          }
        }
      }
    }
  }
  return out;
}

export function buildCommandRegistry(): CommandEntry[] {
  const sidebarIndex = buildSidebarIndex();

  const recents: CommandEntry[] = RECENTS.map((r) => {
    const match = sidebarIndex.find(
      (s) =>
        s.label === r.matchLabel &&
        (r.matchContext ? s.context === r.matchContext : true),
    );
    return {
      id: r.id,
      label: r.matchLabel,
      context: match?.context ?? r.matchContext,
      icon: match?.icon ?? r.icon,
      section: "recents" as const,
      href: match?.href ?? r.fallbackHref,
      keywords: match ? [match.context ?? "", match.href] : [],
    };
  });

  // PAGES — every sidebar entry that points at a real, scaffolded route.
  // De-dupe against RECENTS by href so the same page does not appear twice.
  const recentHrefs = new Set(recents.map((r) => r.href).filter(Boolean));
  const seenHref = new Set<string>();
  const pages: CommandEntry[] = [];
  for (const s of sidebarIndex) {
    if (!routeExists(s.href)) continue;
    if (recentHrefs.has(s.href)) continue;
    if (seenHref.has(s.href)) continue;
    seenHref.add(s.href);
    pages.push({
      id: `page-${s.href}`,
      label: s.label,
      context: s.context,
      icon: s.icon,
      section: "pages",
      href: s.href,
      keywords: [s.context ?? "", s.href],
    });
  }

  return [...recents, ...pages, ...ACTIONS];
}

/** Convenience metadata icon for the "Recents" header chip. */
export const RECENTS_ICON = ClockCounterClockwise;
/** Convenience icon for placeholder "+" rows used in actions. */
export const PLUS_ICON = Plus;
/** Re-export so consumers can resolve icons without importing phosphor. */
export type { Icon };
export { Faders };
