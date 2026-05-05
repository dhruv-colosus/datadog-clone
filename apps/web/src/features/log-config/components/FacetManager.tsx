"use client";

import { Faders, Question } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listFacets, patchFacet } from "../api";
import type { LogFacet } from "../types";

export function FacetManager() {
  const qc = useQueryClient();
  const { data: facets, isLoading } = useQuery({
    queryKey: ["log-facets"],
    queryFn: listFacets,
  });
  const toggle = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      patchFacet(id, { hidden }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log-facets"] }),
  });

  const groups = useMemo(() => {
    const map = new Map<string, LogFacet[]>();
    for (const f of facets ?? []) {
      map.set(f.groupName, [...(map.get(f.groupName) ?? []), f]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [facets]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Faders}
        title="Logs Facets"
        breadcrumbs={[{ label: "Logs", href: "/logs" }]}
        subtitle="Define attribute paths surfaced as facets in the Logs Explorer"
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

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && <div className="text-[13px] text-[#5f6368]">Loading…</div>}
        <div className="space-y-5">
          {groups.map(([group, items]) => (
            <section
              key={group}
              className="rounded-lg border border-[#dadce0] bg-white"
            >
              <h3 className="border-b border-[#f1f3f4] px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
                {group}
              </h3>
              <ul>
                {items.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 border-b border-[#f1f3f4] px-4 py-2 last:border-b-0"
                  >
                    <span className="font-mono text-[12px] text-[#1a73e8]">
                      {f.path}
                    </span>
                    <span className="text-[13px] text-[#202124]">
                      {f.displayName}
                    </span>
                    <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] uppercase text-[#5f6368]">
                      {f.facetKind}
                    </span>
                    <span className="text-[10.5px] text-[#9aa0a6]">
                      {f.dataType}
                    </span>
                    <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={!f.hidden}
                        onChange={(e) =>
                          toggle.mutate({ id: f.id, hidden: !e.target.checked })
                        }
                        className="peer sr-only"
                      />
                      <span className="relative inline-block h-4 w-7 rounded-full bg-[#bdc1c6] transition-colors peer-checked:bg-[#1a73e8]">
                        <span className="absolute left-0.5 top-0.5 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                      </span>
                      {f.hidden ? "Hidden" : "Visible"}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
