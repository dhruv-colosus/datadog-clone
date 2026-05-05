"use client";

import { Broadcast, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FacetPanel, type FacetGroup } from "@/components/ui/FacetPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusKind } from "@/lib/severity";
import { useIncidents } from "../hooks";
import type { Incident } from "../types";
import { DeclareIncidentModal } from "./DeclareIncidentModal";

const SEVS = ["SEV-1", "SEV-2", "SEV-3", "SEV-4", "SEV-5"] as const;
const STATUSES = ["active", "stable", "resolved", "completed"] as const;

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

function commanderInitials(label: string | null | number | null): string {
  if (!label) return "—";
  const text = String(label);
  return text
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function IncidentsList() {
  const router = useRouter();
  const { data: incidents, isLoading } = useIncidents();
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [search, setSearch] = useState("");
  const [showDeclare, setShowDeclare] = useState(false);

  const filtered = useMemo(() => {
    if (!incidents) return [];
    return incidents.filter((i) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !i.title.toLowerCase().includes(q) &&
          !i.displayId.toLowerCase().includes(q) &&
          !i.affectedServices.some((s) => s.toLowerCase().includes(q))
        )
          return false;
      }
      const sev = filters.severity;
      if (sev?.size && !sev.has(i.severity)) return false;
      const st = filters.status;
      if (st?.size && !st.has(i.status)) return false;
      const sv = filters.service;
      if (sv?.size && !i.affectedServices.some((s) => sv.has(s))) return false;
      return true;
    });
  }, [incidents, filters, search]);

  const facetGroups: FacetGroup[] = useMemo(() => {
    const sevCounts = new Map<string, number>();
    const stCounts = new Map<string, number>();
    const svCounts = new Map<string, number>();
    for (const i of incidents ?? []) {
      sevCounts.set(i.severity, (sevCounts.get(i.severity) ?? 0) + 1);
      stCounts.set(i.status, (stCounts.get(i.status) ?? 0) + 1);
      for (const s of i.affectedServices) {
        svCounts.set(s, (svCounts.get(s) ?? 0) + 1);
      }
    }
    return [
      {
        key: "severity",
        title: "Severity",
        options: SEVS.map((s) => ({
          value: s,
          label: s,
          count: sevCounts.get(s) ?? 0,
        })),
      },
      {
        key: "status",
        title: "Status",
        options: STATUSES.map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
          count: stCounts.get(s) ?? 0,
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
  }, [incidents]);

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
    setFilters((prev) => ({ ...prev, [group]: new Set() }));
  };

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Broadcast}
        title="Incidents"
        subtitle="Coordinate response to active and historical incidents"
        actions={
          <button
            type="button"
            onClick={() => setShowDeclare(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#6d28d9]"
          >
            <Plus size={13} weight="bold" />
            Declare incident
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
                placeholder="Search by title, ID, or service"
                className="w-[300px] bg-transparent text-[12.5px] outline-none placeholder:text-[#5f6368]"
              />
            </div>
            <span className="ml-auto text-[12px] text-[#5f6368]">
              {filtered.length} of {incidents?.length ?? 0} incidents
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-[#f1f3f4] text-[11px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-left font-medium">Severity</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Services</th>
                  <th className="px-4 py-2 text-left font-medium">Commander</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#5f6368]">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[#5f6368]">
                      <Broadcast size={32} className="mx-auto mb-2 opacity-40" />
                      No incidents match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((inc) => (
                  <Row
                    key={inc.id}
                    incident={inc}
                    onClick={() => router.push(`/incidents/${inc.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {showDeclare && (
        <DeclareIncidentModal onClose={() => setShowDeclare(false)} />
      )}
    </div>
  );
}

function Row({
  incident,
  onClick,
}: {
  incident: Incident;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa]"
    >
      <td className="px-4 py-2.5 font-mono text-[12px] text-[#5f6368]">
        {incident.displayId}
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-[#202124]">{incident.title}</div>
        {incident.summary && (
          <div className="mt-0.5 line-clamp-1 text-[12px] text-[#5f6368]">
            {incident.summary}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <SeverityBadge severity={incident.severity} />
      </td>
      <td className="px-4 py-2.5">
        <StatusPill status={incident.status as StatusKind} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {incident.affectedServices.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-mono text-[#202124]"
            >
              {s}
            </span>
          ))}
          {incident.affectedServices.length > 3 && (
            <span className="text-[11px] text-[#5f6368]">
              +{incident.affectedServices.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1a73e8] text-[10px] font-semibold text-white">
          {commanderInitials(incident.commanderUserId)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {relativeTime(incident.createdMs)}
      </td>
    </tr>
  );
}
