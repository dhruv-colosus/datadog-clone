"use client";

import { MagnifyingGlass, Question, Shield } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FacetPanel, type FacetGroup } from "@/components/ui/FacetPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusKind } from "@/lib/severity";
import { useSecuritySignals } from "../hooks";
import type { SecuritySignal } from "../types";

const SEVS = ["critical", "high", "medium", "low", "info"];
const STATUSES = ["open", "under_review", "archived"];

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SignalsQueue() {
  const router = useRouter();
  const { data: signals, isLoading } = useSecuritySignals();
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!signals) return [];
    return signals.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !s.title.toLowerCase().includes(q) &&
          !(s.affectedService ?? "").toLowerCase().includes(q) &&
          !(s.affectedUser ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      const sev = filters.severity;
      if (sev?.size && !sev.has(s.severity)) return false;
      const st = filters.status;
      if (st?.size && !st.has(s.status)) return false;
      const sv = filters.service;
      if (sv?.size && !(s.affectedService && sv.has(s.affectedService)))
        return false;
      return true;
    });
  }, [signals, filters, search]);

  const facetGroups: FacetGroup[] = useMemo(() => {
    const sevCounts = new Map<string, number>();
    const stCounts = new Map<string, number>();
    const svCounts = new Map<string, number>();
    for (const s of signals ?? []) {
      sevCounts.set(s.severity, (sevCounts.get(s.severity) ?? 0) + 1);
      stCounts.set(s.status, (stCounts.get(s.status) ?? 0) + 1);
      if (s.affectedService) {
        svCounts.set(
          s.affectedService,
          (svCounts.get(s.affectedService) ?? 0) + 1,
        );
      }
    }
    return [
      {
        key: "severity",
        title: "Severity",
        options: SEVS.map((v) => ({
          value: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          count: sevCounts.get(v) ?? 0,
        })),
      },
      {
        key: "status",
        title: "Status",
        options: STATUSES.map((v) => ({
          value: v,
          label: v.replace("_", " "),
          count: stCounts.get(v) ?? 0,
        })),
      },
      {
        key: "service",
        title: "Affected service",
        searchable: true,
        options: Array.from(svCounts.entries()).map(([v, c]) => ({
          value: v,
          count: c,
        })),
      },
    ];
  }, [signals]);

  const onToggle = (group: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      const cur = new Set(next[group] ?? new Set<string>());
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      next[group] = cur;
      return next;
    });
  };

  const onClear = (group: string) => {
    setFilters((prev) => ({ ...prev, [group]: new Set() }));
  };

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Shield}
        title="Signals"
        breadcrumbs={[{ label: "Security", href: "/security" }]}
        subtitle="Severity-ranked detection alerts across logs, spans, and audit"
        actions={
          <>
            <a
              href="/security/rules"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              Detection rules
            </a>
            <button
              type="button"
              aria-label="Help"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Question size={14} weight="bold" />
            </button>
          </>
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
                placeholder="Search by title, service, or user"
                className="w-[300px] bg-transparent text-[12.5px] outline-none placeholder:text-[#5f6368]"
              />
            </div>
            <span className="ml-auto text-[12px] text-[#5f6368]">
              {filtered.length} of {signals?.length ?? 0} signals
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-[#f1f3f4] text-[11px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Severity</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-left font-medium">Service</th>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Detected</th>
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
                      <Shield size={32} className="mx-auto mb-2 opacity-40" />
                      No signals match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((s) => (
                  <Row
                    key={s.id}
                    signal={s}
                    onClick={() => router.push(`/security/signals/${s.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function Row({
  signal,
  onClick,
}: {
  signal: SecuritySignal;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa]"
    >
      <td className="px-4 py-2.5">
        <SeverityBadge severity={signal.severity} />
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-[#202124]">{signal.title}</div>
        {signal.mitreTactics.length > 0 && (
          <div className="mt-0.5 text-[11px] text-[#9aa0a6]">
            {signal.mitreTactics.join(", ")}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        {signal.affectedService ? (
          <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[12px]">
            {signal.affectedService}
          </span>
        ) : (
          <span className="text-[#9aa0a6]">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {signal.affectedUser ?? "—"}
      </td>
      <td className="px-4 py-2.5">
        <StatusPill status={signal.status as StatusKind} />
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {relativeTime(signal.createdMs)}
      </td>
    </tr>
  );
}
