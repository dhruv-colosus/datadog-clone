"use client";

import {
  Lightbulb,
  MagnifyingGlass,
  Question,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FacetPanel, type FacetGroup } from "@/components/ui/FacetPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { SeverityLevel, StatusKind } from "@/lib/severity";
import { useWatchdogStories } from "../hooks";
import type { WatchdogSeverity, WatchdogStory } from "../types";

const SEV_TO_LEVEL: Record<WatchdogSeverity, SeverityLevel> = {
  high: "critical",
  medium: "high",
  low: "medium",
};

const KIND_LABEL: Record<string, string> = {
  anomaly: "Anomaly",
  outlier: "Outlier",
  deployment_regression: "Deployment regression",
  deviation: "Deviation",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function WatchdogList() {
  const router = useRouter();
  const { data: stories, isLoading } = useWatchdogStories();
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!stories) return [];
    return stories.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !s.title.toLowerCase().includes(q) &&
          !s.service.toLowerCase().includes(q) &&
          !(s.metric ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      const sev = filters.severity;
      if (sev?.size && !sev.has(s.severity)) return false;
      const st = filters.status;
      if (st?.size && !st.has(s.status)) return false;
      const sv = filters.service;
      if (sv?.size && !sv.has(s.service)) return false;
      const k = filters.kind;
      if (k?.size && !k.has(s.kind)) return false;
      return true;
    });
  }, [stories, filters, search]);

  const facetGroups: FacetGroup[] = useMemo(() => {
    const sevCounts = new Map<string, number>();
    const stCounts = new Map<string, number>();
    const svcCounts = new Map<string, number>();
    const kindCounts = new Map<string, number>();
    for (const s of stories ?? []) {
      sevCounts.set(s.severity, (sevCounts.get(s.severity) ?? 0) + 1);
      stCounts.set(s.status, (stCounts.get(s.status) ?? 0) + 1);
      svcCounts.set(s.service, (svcCounts.get(s.service) ?? 0) + 1);
      kindCounts.set(s.kind, (kindCounts.get(s.kind) ?? 0) + 1);
    }
    return [
      {
        key: "severity",
        title: "Severity",
        options: [
          { value: "high", label: "High", count: sevCounts.get("high") ?? 0 },
          {
            value: "medium",
            label: "Medium",
            count: sevCounts.get("medium") ?? 0,
          },
          { value: "low", label: "Low", count: sevCounts.get("low") ?? 0 },
        ],
      },
      {
        key: "status",
        title: "Status",
        options: [
          {
            value: "active",
            label: "Active",
            count: stCounts.get("active") ?? 0,
          },
          {
            value: "acknowledged",
            label: "Acknowledged",
            count: stCounts.get("acknowledged") ?? 0,
          },
          {
            value: "resolved",
            label: "Resolved",
            count: stCounts.get("resolved") ?? 0,
          },
        ],
      },
      {
        key: "kind",
        title: "Type",
        options: Object.keys(KIND_LABEL).map((k) => ({
          value: k,
          label: KIND_LABEL[k],
          count: kindCounts.get(k) ?? 0,
        })),
      },
      {
        key: "service",
        title: "Service",
        searchable: true,
        options: Array.from(svcCounts.entries()).map(([v, c]) => ({
          value: v,
          count: c,
        })),
      },
    ];
  }, [stories]);

  const onToggle = (group: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      const current = new Set(next[group] ?? new Set<string>());
      if (current.has(value)) current.delete(value);
      else current.add(value);
      next[group] = current;
      return next;
    });
  };

  const onClear = (group: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      next[group] = new Set();
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Lightbulb}
        title="Watchdog"
        subtitle="Auto-detected anomalies and regressions across your services"
        actions={
          <button
            type="button"
            aria-label="Help"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Question size={14} weight="bold" />
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <FacetPanel
          groups={facetGroups}
          selected={filters}
          onToggle={onToggle}
          onClear={onClear}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
              <MagnifyingGlass size={13} className="text-[#5f6368]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stories"
                className="w-[280px] bg-transparent text-[12.5px] outline-none placeholder:text-[#5f6368]"
              />
            </div>
            <span className="ml-auto text-[12px] text-[#5f6368]">
              {filtered.length} of {stories?.length ?? 0} stories
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-[#f1f3f4] text-[11px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Severity</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Service</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#5f6368]">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#5f6368]">
                      <Lightbulb size={32} className="mx-auto mb-2 opacity-40" />
                      No Watchdog stories match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((story) => (
                  <StoryRow key={story.id} story={story} onClick={() => router.push(`/watchdog/insights/${story.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function StoryRow({
  story,
  onClick,
}: {
  story: WatchdogStory;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa]"
    >
      <td className="px-4 py-2.5">
        <SeverityBadge severity={SEV_TO_LEVEL[story.severity]} />
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-[#202124]">{story.title}</div>
        <div className="mt-0.5 line-clamp-1 text-[12px] text-[#5f6368]">
          {story.narrative}
        </div>
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">{KIND_LABEL[story.kind]}</td>
      <td className="px-4 py-2.5">
        <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[12px] font-mono text-[#202124]">
          {story.service}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <StatusPill status={story.status as StatusKind} />
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {relativeTime(story.startedMs)}
      </td>
    </tr>
  );
}
