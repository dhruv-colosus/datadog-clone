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

export type NavItem = {
  label: string;
  href: string;
  icon: Icon;
};

export type NavSection = NavItem[];

export const navSections: NavSection[] = [
  [
    { label: "Recent", href: "/recent", icon: ClockCounterClockwise },
    { label: "Bits AI", href: "/bits-ai", icon: Sparkle },
    { label: "Dashboards", href: "/dashboard", icon: ChartLine },
    { label: "Monitoring", href: "/monitoring", icon: Gauge },
    { label: "Incident Response", href: "/incidents", icon: Broadcast },
    { label: "Automation", href: "/automation", icon: Lightning },
  ],
  [
    { label: "Infrastructure", href: "/infrastructure", icon: Cube },
    { label: "Cloud Cost", href: "/cloud-cost", icon: Cloud },
    { label: "APM", href: "/apm", icon: Faders },
    { label: "Digital Experience", href: "/digital-experience", icon: Browsers },
    { label: "Software Delivery", href: "/software-delivery", icon: GitBranch },
    { label: "Security", href: "/security", icon: Shield },
    { label: "Data Observability", href: "/data-observability", icon: Database },
    { label: "AI Observability", href: "/ai-observability", icon: MagicWand },
  ],
  [
    { label: "Errors", href: "/errors", icon: Bug },
    { label: "Metrics", href: "/metrics", icon: Speedometer },
    { label: "Logs", href: "/logs", icon: ListMagnifyingGlass },
  ],
];
