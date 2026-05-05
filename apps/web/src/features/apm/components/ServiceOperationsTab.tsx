"use client";

import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useApmOperations } from "../hooks";
import type { ApmService } from "../types";
import { MiniBar } from "./MiniBar";

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

type SortKey = "hits" | "errors" | "p50" | "p95" | "p99";

export function ServiceOperationsTab({ service }: { service: ApmService }) {
  const [sort, setSort] = useState<SortKey>("hits");
  const [search, setSearch] = useState("");
  const { data: ops, isLoading } = useApmOperations(service.id);

  const filtered = useMemo(() => {
    if (!ops) return [];
    const q = search.trim().toLowerCase();
    const list = q ? ops.filter((o) => o.name.toLowerCase().includes(q)) : ops;
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "hits") return b.hits - a.hits;
      if (sort === "errors") return b.errors - a.errors;
      if (sort === "p50") return b.p50LatencyMs - a.p50LatencyMs;
      if (sort === "p95") return b.p95LatencyMs - a.p95LatencyMs;
      return b.p99LatencyMs - a.p99LatencyMs;
    });
    return sorted;
  }, [ops, search, sort]);

  const maxHits = Math.max(1, ...filtered.map((o) => o.hits));
  const maxLatency = Math.max(1, ...filtered.map((o) => o.p99LatencyMs));

  return (
    <div className="flex-1 overflow-auto bg-[#f8f9fb] p-5">
      <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-[#202124]">
        <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
        Operations · last 15 min
      </h2>

      <div className="rounded-lg border border-[#e8eaed] bg-white">
        <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2.5">
          <span className="text-[13px] text-[#202124]">
            Showing <span className="font-semibold">{filtered.length}</span>{" "}
            operation{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="flex h-7 w-[260px] items-center gap-2 rounded-md border border-[#bdc1c6] px-2">
            <MagnifyingGlass size={13} className="text-[#5f6368]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search operations"
              className="w-full bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
            />
          </div>
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-[13px] text-[#5f6368]">Loading…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="px-4 py-6 text-[13px] text-[#5f6368]">
            No operations seen in the last 15 minutes.
          </div>
        )}

        {filtered.length > 0 && (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eaed] text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                <th className="px-3 py-2 text-left">Operation</th>
                <SortHead k="hits" current={sort} onClick={setSort}>
                  Requests
                </SortHead>
                <SortHead k="errors" current={sort} onClick={setSort}>
                  Errors
                </SortHead>
                <SortHead k="p50" current={sort} onClick={setSort}>
                  P50
                </SortHead>
                <SortHead k="p95" current={sort} onClick={setSort}>
                  P95
                </SortHead>
                <SortHead k="p99" current={sort} onClick={setSort}>
                  P99
                </SortHead>
              </tr>
            </thead>
            <tbody>
              {filtered.map((op) => (
                <tr
                  key={op.name}
                  className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]"
                >
                  <td className="px-3 py-2.5 font-mono text-[12.5px] text-[#1a73e8]">
                    {op.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[#202124]">{op.hits}</div>
                    <MiniBar value={op.hits} max={maxHits} color="#1a73e8" />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        op.errors > 0 ? "text-[#d93025]" : "text-[#5f6368]"
                      }
                    >
                      {op.errors}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[#202124]">
                      {formatLatency(op.p50LatencyMs)}
                    </div>
                    <MiniBar
                      value={op.p50LatencyMs}
                      max={maxLatency}
                      color="#fbbc04"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[#202124]">
                      {formatLatency(op.p95LatencyMs)}
                    </div>
                    <MiniBar
                      value={op.p95LatencyMs}
                      max={maxLatency}
                      color="#1a73e8"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[#202124]">
                      {formatLatency(op.p99LatencyMs)}
                    </div>
                    <MiniBar
                      value={op.p99LatencyMs}
                      max={maxLatency}
                      color="#a142f4"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SortHead({
  k,
  current,
  onClick,
  children,
}: {
  k: SortKey;
  current: SortKey;
  onClick: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 ${
          current === k ? "text-[#202124]" : "hover:text-[#202124]"
        }`}
      >
        {children}
      </button>
    </th>
  );
}
