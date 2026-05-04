import {
  Broadcast,
  Browsers,
  Bug,
  ChartLine,
  Cloud,
  ClockCounterClockwise,
  Cube,
  Database,
  Faders,
  Gauge,
  GitBranch,
  Lightning,
  ListMagnifyingGlass,
  MagicWand,
  Shield,
  Sparkle,
  Speedometer,
  type Icon,
} from "@phosphor-icons/react";

export type FlyoutBadge = "NEW" | "PREVIEW";

export type FlyoutSubItem = {
  label: string;
  href?: string;
  isCreate?: boolean;
  badge?: FlyoutBadge;
  external?: boolean;
};

export type FlyoutGroup = {
  heading: string;
  href?: string;
  badge?: FlyoutBadge;
  primary?: FlyoutSubItem[];
  secondary?: FlyoutSubItem[];
  emptyState?: string;
};

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
  flyout?: FlyoutGroup[];
};

export type NavSection = NavItem[];

const VALID_ROUTES = new Set<string>([
  "/",
  "/apm",
  "/apm/home",
  "/apm/service-map",
  "/apm/services",
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

export function isRouteAvailable(href: string | undefined): boolean {
  if (!href) return false;
  const path = href.split("?")[0].split("#")[0];
  return VALID_ROUTES.has(path);
}

export const navSections: NavSection[] = [
  [
    {
      label: "Recent",
      href: "/recent",
      icon: ClockCounterClockwise,
      flyout: [
        {
          heading: "Recent",
          primary: [
            { label: "Dashboards" },
            { label: "Metrics" },
            { label: "Page Not Found" },
            { label: "Vedanta's Dashboard Fri, May 1, 3:27:30 pm" },
            { label: "Monitors" },
            { label: "Investigations" },
          ],
        },
      ],
    },
    {
      label: "Bits AI",
      href: "/bits-ai",
      icon: Sparkle,
      flyout: [
        {
          heading: "SRE Agent",
          badge: "NEW",
          primary: [
            { label: "New Investigation", badge: "PREVIEW" },
            { label: "Investigations" },
            { label: "Reports" },
            { label: "Settings" },
            { label: "Monitors" },
          ],
        },
        {
          heading: "Dev Agent",
          badge: "NEW",
          primary: [{ label: "Code Sessions" }, { label: "Settings" }],
        },
      ],
    },
    {
      label: "Dashboards",
      href: "/dashboard/lists",
      icon: ChartLine,
      flyout: [
        {
          heading: "Dashboards",
          primary: [
            { label: "Dashboard List", href: "/dashboard/lists" },
            { label: "New Dashboard", isCreate: true },
            { label: "Reports" },
          ],
        },
        {
          heading: "Notebooks",
          href: "/notebook/list",
          primary: [
            { label: "Notebooks List", href: "/notebook/list" },
            { label: "New Notebook", href: "/notebook/list", isCreate: true },
          ],
        },
        {
          heading: "Sheets",
          badge: "NEW",
          primary: [
            { label: "Spreadsheets List" },
            { label: "New Spreadsheet", isCreate: true },
          ],
        },
        { heading: "Quick Graph" },
        { heading: "DDSQL Editor" },
      ],
    },
    {
      label: "Monitoring",
      href: "/monitors/manage",
      icon: Gauge,
      flyout: [
        {
          heading: "Monitors",
          primary: [
            { label: "Monitor List", href: "/monitors/manage" },
            { label: "New Monitor", href: "/monitors/create", isCreate: true },
            { label: "Triggered" },
            { label: "Downtimes" },
            { label: "Quality" },
          ],
          secondary: [{ label: "Settings" }],
        },
        {
          heading: "SLOs",
          primary: [
            { label: "Manage SLOs", href: "/slo/manage" },
            { label: "New SLO", href: "/slo/create", isCreate: true },
          ],
        },
        { heading: "Check Summary" },
        {
          heading: "Event Management",
          primary: [{ label: "Triage Inbox" }, { label: "All Events" }],
          secondary: [{ label: "Settings" }],
        },
        { heading: "Watchdog" },
        { heading: "External Provider Status", badge: "NEW" },
      ],
    },
    {
      label: "Incident Response",
      href: "/incidents",
      icon: Broadcast,
      flyout: [
        {
          heading: "On-Call",
          primary: [
            { label: "Teams" },
            { label: "Pages" },
            { label: "Send a Page", isCreate: true },
          ],
          secondary: [{ label: "Settings" }],
        },
        {
          heading: "Incident Management",
          primary: [
            { label: "Incident List" },
            { label: "Declare Incident", isCreate: true },
          ],
          secondary: [{ label: "Settings" }],
        },
        { heading: "Status Pages", badge: "NEW" },
        { heading: "Case Management" },
      ],
    },
    {
      label: "Automation",
      href: "/automation",
      icon: Lightning,
      flyout: [
        {
          heading: "Actions",
          primary: [
            { label: "Workflow Automation" },
            { label: "New Workflow", isCreate: true },
            { label: "App Builder" },
            { label: "New App", isCreate: true },
            { label: "Case Management" },
            { label: "Agent Builder", badge: "PREVIEW" },
            { label: "Forms", badge: "PREVIEW", external: true },
          ],
          secondary: [{ label: "Action Catalog" }],
        },
        {
          heading: "Internal Developer Portal",
          badge: "NEW",
          primary: [
            { label: "Software Catalog" },
            { label: "Scorecards" },
            { label: "Self-Service Actions" },
          ],
          secondary: [{ label: "Teams" }],
        },
      ],
    },
  ],
  [
    {
      label: "Infrastructure",
      href: "/infrastructure",
      icon: Cube,
      flyout: [
        {
          heading: "Resources",
          primary: [
            { label: "Catalog", href: "/infrastructure" },
            { label: "Cloudcraft", badge: "NEW" },
            { label: "Changes", badge: "PREVIEW" },
          ],
          secondary: [
            { label: "Policies", badge: "PREVIEW" },
            { label: "Add Resources" },
          ],
        },
        { heading: "Universal Service Monitoring", badge: "NEW" },
        {
          heading: "Hosts",
          primary: [
            { label: "Host Map", href: "/infrastructure/map" },
            { label: "GPU Monitoring" },
          ],
        },
        {
          heading: "Containers",
          primary: [
            { label: "Kubernetes Overview" },
            { label: "Kubernetes Explorer" },
            { label: "Kubernetes Autoscaling", badge: "NEW" },
            { label: "Container Images" },
            { label: "ECS Explorer" },
          ],
        },
        { heading: "Processes" },
        { heading: "Serverless" },
        {
          heading: "Cloud Network",
          primary: [{ label: "Analytics" }, { label: "Network Map" }],
        },
        {
          heading: "Network Devices",
          primary: [
            { label: "Device Geomap", badge: "NEW" },
            { label: "Device Topology Map" },
            { label: "NetFlow" },
          ],
          secondary: [{ label: "Settings" }],
        },
        { heading: "Network Path", badge: "NEW" },
        { heading: "Storage Management", badge: "NEW" },
        { heading: "Starred Maps", emptyState: "No starred maps" },
      ],
    },
    {
      label: "Cloud Cost",
      href: "/cloud-cost",
      icon: Cloud,
    },
    {
      label: "APM",
      href: "/apm/home",
      icon: Faders,
      flyout: [
        {
          heading: "Software Catalog",
          primary: [
            { label: "Services", href: "/apm/home" },
            { label: "Service Map", href: "/apm/service-map" },
            { label: "Endpoints" },
            { label: "Scorecards" },
          ],
          secondary: [{ label: "Add an Entity" }, { label: "Settings" }],
        },
        {
          heading: "Traces",
          primary: [
            { label: "Explorer", href: "/apm/traces" },
            { label: "Generate Metrics" },
          ],
          secondary: [
            { label: "Ingestion Control" },
            { label: "Retention Filters" },
            { label: "Sensitive Data Scanner" },
          ],
        },
        {
          heading: "Profiles",
          primary: [
            { label: "Explorer" },
            { label: "Comparison" },
            { label: "Insights", badge: "NEW" },
          ],
        },
        { heading: "Live Debugger", badge: "PREVIEW" },
        { heading: "Dynamic Instrumentation" },
        { heading: "Database Monitoring" },
        { heading: "Data Streams Monitoring" },
        { heading: "Data Jobs Monitoring" },
        { heading: "Recommendations", badge: "NEW" },
        {
          heading: "Starred Items",
          emptyState: "No starred services nor saved views",
        },
      ],
    },
    {
      label: "Digital Experience",
      href: "/digital-experience",
      icon: Browsers,
      flyout: [
        {
          heading: "Synthetic Monitoring & Testing",
          primary: [
            { label: "Tests" },
            { label: "New Test", isCreate: true },
            { label: "Test Suites", badge: "NEW" },
            { label: "New Test Suite", badge: "NEW", isCreate: true },
            { label: "Results Explorer" },
            { label: "Continuous Testing" },
            { label: "Test Coverage" },
          ],
          secondary: [{ label: "Settings" }],
        },
        {
          heading: "Real User Monitoring",
          href: "/rum/summary",
          primary: [
            { label: "Summary", href: "/rum/summary" },
            { label: "Explorer", href: "/rum/explorer" },
            { label: "Optimization", href: "/rum/summary" },
            { label: "Manage Applications", href: "/rum/summary" },
            { label: "Generate Metrics" },
            { label: "Sensitive Data Scanner" },
            { label: "Feature Flag Tracking" },
            { label: "Error Tracking", href: "/rum/summary" },
          ],
        },
        {
          heading: "Session Replay",
          href: "/rum/session-replay",
          primary: [
            { label: "Recordings", href: "/rum/session-replay" },
            { label: "Playlists", href: "/rum/session-replay?tab=playlists" },
          ],
        },
        { heading: "Product Analytics", badge: "NEW" },
        { heading: "Starred Saved Views", emptyState: "No starred saved views" },
      ],
    },
    {
      label: "Software Delivery",
      href: "/software-delivery",
      icon: GitBranch,
      flyout: [
        { heading: "Intro to CI Visibility" },
        {
          heading: "Feature Flags",
          badge: "NEW",
          primary: [
            { label: "Feature Flags" },
            { label: "Environments" },
            { label: "Deployment Gates", badge: "PREVIEW" },
          ],
        },
        { heading: "Intro to Test Optimization" },
        { heading: "Intro to Code Coverage", badge: "NEW" },
        { heading: "Code Security" },
        { heading: "PR Gates", badge: "NEW" },
        { heading: "DORA Metrics" },
        { heading: "Starred Saved Views", emptyState: "no matching items" },
      ],
    },
    {
      label: "Security",
      href: "/security",
      icon: Shield,
      flyout: [
        { heading: "Security", primary: [{ label: "Research Feed" }] },
        { heading: "Cloud SIEM" },
        { heading: "Code Security" },
        { heading: "Cloud Security" },
        { heading: "App & API Protection" },
        { heading: "Workload Protection" },
        { heading: "Sensitive Data Scanner" },
        { heading: "Findings" },
        { heading: "Settings" },
      ],
    },
    {
      label: "Data Observability",
      href: "/data-observability",
      icon: Database,
      flyout: [
        {
          heading: "Data Observability",
          badge: "NEW",
          primary: [{ label: "Catalog", badge: "NEW" }],
          secondary: [{ label: "Settings" }],
        },
        {
          heading: "Quality Monitoring",
          badge: "NEW",
          primary: [{ label: "Monitors" }, { label: "Datasets" }],
        },
        {
          heading: "Jobs Monitoring",
          primary: [{ label: "Jobs" }, { label: "Queries", badge: "PREVIEW" }],
        },
        { heading: "Lineage", badge: "NEW" },
      ],
    },
    {
      label: "AI Observability",
      href: "/ai-observability",
      icon: MagicWand,
      flyout: [
        {
          heading: "LLM Observability",
          primary: [
            { label: "Overview" },
            { label: "Traces" },
            { label: "Experiments" },
            { label: "Datasets" },
            { label: "Annotations", badge: "NEW" },
            { label: "Playground" },
          ],
          secondary: [{ label: "Evaluations" }, { label: "Settings" }],
        },
        { heading: "GPU Monitoring" },
        { heading: "AI Agents Console", badge: "PREVIEW" },
      ],
    },
  ],
  [
    {
      label: "Errors",
      href: "/errors",
      icon: Bug,
    },
    {
      label: "Metrics",
      href: "/metrics",
      icon: Speedometer,
      flyout: [
        {
          heading: "Metrics",
          primary: [
            { label: "Explorer", href: "/metric/explore" },
            { label: "Summary" },
            { label: "Volume" },
          ],
        },
      ],
    },
    {
      label: "Logs",
      href: "/logs",
      icon: ListMagnifyingGlass,
      flyout: [
        {
          heading: "Search & Analytics",
          primary: [
            { label: "Explorer", href: "/logs" },
            { label: "Archive Search" },
            { label: "Live Tail" },
            { label: "Notebooks", href: "/notebook/list" },
          ],
        },
        {
          heading: "Log Configuration",
          primary: [
            { label: "Pipelines" },
            { label: "Indexes" },
            { label: "Flex Logs Controls" },
            { label: "Add a Log Source" },
            { label: "Generate Metrics" },
            { label: "Data Access" },
            { label: "Archiving & Forwarding" },
          ],
        },
        { heading: "Observability Pipelines", badge: "NEW" },
        { heading: "Sensitive Data Scanner" },
        { heading: "Starred Saved Views", emptyState: "No starred saved views" },
      ],
    },
  ],
];
