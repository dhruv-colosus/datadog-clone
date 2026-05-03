"use client";

import { Faders } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ label: string; href: string; matches: (p: string) => boolean }> = [
  {
    label: "Service",
    href: "/apm/home",
    matches: (p) =>
      p === "/apm" || p.startsWith("/apm/home") || p.startsWith("/apm/services"),
  },
  {
    label: "Traces",
    href: "/apm/traces",
    matches: (p) => p.startsWith("/apm/traces"),
  },
  {
    label: "Profiles",
    href: "/apm/profiles",
    matches: (p) => p.startsWith("/apm/profiles"),
  },
];

export function ApmHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname() ?? "/apm";
  return (
    <div className="flex items-center gap-1 border-b border-[#e8eaed] bg-white px-4">
      <Link
        href="/apm/home"
        className="mr-2 inline-flex h-11 items-center gap-1.5 text-[13px] font-medium text-[#5f6368] hover:text-[#202124]"
      >
        <Faders size={14} weight="bold" />
        APM
      </Link>
      <div className="flex h-11 items-center gap-1">
        {TABS.map((t) => {
          const active = t.matches(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative inline-flex h-11 items-center px-3 text-[13px] ${
                active
                  ? "font-semibold text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
              )}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
