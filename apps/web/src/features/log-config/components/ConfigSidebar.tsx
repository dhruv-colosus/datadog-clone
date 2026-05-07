"use client";

import { ArrowSquareOut, ListMagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  label: string;
  href: string;
  external?: boolean;
};

type Section = {
  heading: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    heading: "PROCESSING",
    items: [
      { label: "Pipelines", href: "/logs/pipelines" },
      { label: "Standard Attributes", href: "/logs/pipelines/standard-attributes" },
      {
        label: "Sensitive Data Scanner",
        href: "/security/data-security/rules",
        external: true,
      },
    ],
  },
  {
    heading: "ROUTING",
    items: [
      { label: "Indexes", href: "/logs/pipelines/indexes" },
      { label: "Flex Logs Controls", href: "/logs/pipelines/flex-logs-controls" },
      { label: "Archiving & Forwarding", href: "/logs/pipelines/archiving" },
      { label: "Rehydrations", href: "/logs/pipelines/rehydrations" },
    ],
  },
  {
    heading: "STREAM INSIGHTS",
    items: [{ label: "Generate Metrics", href: "/logs/pipelines/generate-metrics" }],
  },
  {
    heading: "ACCESS CONTROL",
    items: [{ label: "Data Access", href: "/logs/pipelines/data-access" }],
  },
];

export function ConfigSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/logs/pipelines") {
      // Active only on the exact pipelines list (or a /pipelines/[uuid] editor)
      return (
        pathname === "/logs/pipelines" ||
        /^\/logs\/pipelines\/[0-9a-f-]{36}$/.test(pathname ?? "")
      );
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className="w-[220px] shrink-0 border-r border-[#dadce0] bg-white">
      <div className="flex items-center gap-2 border-b border-[#dadce0] px-4 py-3 text-[14px] font-medium text-[#202124]">
        <ListMagnifyingGlass size={16} weight="duotone" className="text-[#774aa4]" />
        <Link href="/logs" className="text-[#1a73e8] hover:underline">
          Logs
        </Link>
        <span className="text-[#bdc1c6]">›</span>
        <span>Configuration</span>
      </div>
      <nav className="px-2 py-3">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="mb-3">
            <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#80868b]">
              {section.heading}
            </div>
            <ul>
              {section.items.map((item) => {
                const active = isActive(item.href);
                const className = `flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] ${
                  active
                    ? "bg-[#774aa4] font-medium text-white"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`;
                if (item.external) {
                  return (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className}
                      >
                        <span>{item.label}</span>
                        <ArrowSquareOut size={11} className="opacity-70" />
                      </a>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={className}>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
