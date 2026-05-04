"use client";

import { CaretDown, Atom, MagnifyingGlass, Pause, Play, RewindCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRumApplications } from "../hooks";

const TABS: { label: string; href: string; matches: (p: string) => boolean }[] = [
  {
    label: "Summary",
    href: "/rum/summary",
    matches: (p) => p.startsWith("/rum/summary") || p === "/rum",
  },
  {
    label: "Optimization",
    href: "/rum/summary?tab=optimization",
    matches: () => false,
  },
  {
    label: "Feature Flag Tracking",
    href: "/rum/summary?tab=ff",
    matches: () => false,
  },
  {
    label: "Session Replay",
    href: "/rum/session-replay",
    matches: (p) => p.startsWith("/rum/session-replay"),
  },
  {
    label: "Explorer",
    href: "/rum/explorer",
    matches: (p) => p.startsWith("/rum/explorer"),
  },
  {
    label: "Error Tracking",
    href: "/rum/errors",
    matches: (p) => p.startsWith("/rum/errors"),
  },
  {
    label: "Product Analytics",
    href: "/rum/summary?tab=pa",
    matches: () => false,
  },
];

export function RumHeader({
  range,
  onRangeChange,
}: {
  range: { fromMs: number; toMs: number };
  onRangeChange?: (label: string) => void;
}) {
  const pathname = usePathname() ?? "/rum";
  const { data: apps = [] } = useRumApplications();
  const app = apps[0];
  const fromLabel = new Date(range.fromMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const toLabel = new Date(range.toMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="border-b border-[#e8eaed] bg-white">
      <div className="flex items-center gap-3 px-4 pt-2.5">
        <Link
          href="/rum/summary"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#202124]"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#1c1d1f] text-white">
            <span className="text-[10px]">RUM</span>
          </span>
          RUM
        </Link>
        <span className="text-[#bdc1c6]">|</span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-[13px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          <Atom size={14} weight="duotone" className="text-[#3eb8a3]" />
          {app ? app.name : "Loading…"}
          <CaretDown size={10} weight="bold" />
        </button>

        <div className="ml-auto flex items-center gap-1.5 text-[12.5px] text-[#5f6368]">
          <span className="text-[10.5px] tracking-wide">UTC{getUtcOffsetLabel()}</span>
          <div className="rounded-md border border-[#bdc1c6] bg-white px-2 py-0.5 text-[12.5px] text-[#202124]">
            <div className="flex items-center gap-2">
              <span className="text-[#5f6368]">1d</span>
              <span>
                {fromLabel} – {toLabel}
              </span>
              <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
            </div>
          </div>
          <button className="rounded-md border border-[#bdc1c6] bg-white p-1 hover:bg-[#f1f3f4]" type="button">
            <RewindCircle size={12} />
          </button>
          <button
            className="rounded-md border border-[#1a73e8] bg-[#1a73e8] p-1 text-white"
            type="button"
          >
            <Pause size={12} weight="fill" />
          </button>
          <button className="rounded-md border border-[#bdc1c6] bg-white p-1 hover:bg-[#f1f3f4]" type="button">
            <Play size={12} weight="fill" />
          </button>
          <button className="rounded-md border border-[#bdc1c6] bg-white p-1 hover:bg-[#f1f3f4]" type="button">
            <MagnifyingGlass size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4">
        {TABS.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`relative inline-flex h-10 items-center px-3 text-[13px] ${
                active
                  ? "font-semibold text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function getUtcOffsetLabel(): string {
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}
