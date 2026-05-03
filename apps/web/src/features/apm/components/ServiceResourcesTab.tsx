"use client";

import { CaretDown, Gear, MagnifyingGlass, Star } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  useApmResources,
  useApmServiceResourceSeries,
} from "../hooks";
import { useApmServiceDetailStore } from "../store";
import type { ApmResource, ApmService } from "../types";
import { ApmBarChart } from "./ApmBarChart";
import { ApmLineChart } from "./ApmLineChart";
import { MiniBar } from "./MiniBar";

type SortKey = "name" | "requests" | "totalTime" | "p95" | "errors" | "errorRate";

const RESOURCE_COLORS = ["#a8c5f7", "#1a73e8", "#a142f4", "#e8b3a8", "#7c3aed"];

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(0)}µs`;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

export function ServiceResourcesTab({ service }: { service: ApmService }) {
  const search = useApmServiceDetailStore((s) => s.resourceSearch);
  const setSearch = useApmServiceDetailStore((s) => s.setResourceSearch);
  const [sortKey, setSortKey] = useState<SortKey>("totalTime");
  const { data: resources } = useApmResources(service.id);
  const { data: seriesByResource } = useApmServiceResourceSeries(service.id);

  const filtered = useMemo<ApmResource[]>(() => {
    const list = resources ?? [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? list.filter((r) => r.name.toLowerCase().includes(q))
      : list;
    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "requests")
        return (b.requests ?? -1) - (a.requests ?? -1);
      if (sortKey === "totalTime") return b.totalTimeMs - a.totalTimeMs;
      if (sortKey === "p95") return b.p95LatencyMs - a.p95LatencyMs;
      if (sortKey === "errors") return (b.errors ?? -1) - (a.errors ?? -1);
      return b.errorRate - a.errorRate;
    });
    return sorted;
  }, [resources, search, sortKey]);

  const totalCount = resources?.length ?? 0;
  const pageEnd = Math.min(10, filtered.length);

  const top5Series = useMemo(() => {
    const arr = (seriesByResource ?? []).slice(0, 5);
    return arr.map((s, i) => ({
      requests: {
        id: s.service,
        color: RESOURCE_COLORS[i] ?? "#1a73e8",
        values: s.points.map((p) => p.hits),
      },
      latency: {
        id: s.service,
        color: RESOURCE_COLORS[i] ?? "#1a73e8",
        values: s.points.map((p) => p.latencyMs),
      },
      errors: {
        id: s.service,
        color: RESOURCE_COLORS[i] ?? "#1a73e8",
        values: s.points.map((p) => p.errors),
      },
    }));
  }, [seriesByResource]);

  const requestsSeries = top5Series.map((s) => s.requests);
  const latencySeries = top5Series.map((s) => s.latency);
  const errorsSeries = top5Series.map((s) => s.errors);

  const top5 = filtered.slice(0, 5);

  return (
    <div className="flex-1 overflow-auto bg-[#f8f9fb] p-5">
      <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-[#202124]">
        <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
        <span className="inline-flex items-center gap-1 rounded bg-[#e8eaed] px-1.5 py-0.5 text-[12px] text-[#5f6368]">
          {"{}"}
        </span>
        Resources
      </h2>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard title="Requests" topLabel="Top 5">
          <ApmBarChart series={requestsSeries} height={170} />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {top5.slice(0, 2).map((r, i) => (
              <Chip
                key={r.id}
                color={RESOURCE_COLORS[i] ?? "#1a73e8"}
                label={shortName(r.name)}
              />
            ))}
            {top5.length > 2 && (
              <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]">
                +{top5.length - 2}
              </span>
            )}
          </div>
        </ChartCard>

        <ChartCard title="p95 Latency" topLabel="Top 5">
          <ApmLineChart
            series={latencySeries}
            height={170}
            formatY={(v) => `${Math.round(v)}`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {top5.slice(0, 2).map((r, i) => (
              <Chip
                key={r.id}
                color={RESOURCE_COLORS[i] ?? "#1a73e8"}
                label={shortName(r.name)}
              />
            ))}
            {top5.length > 2 && (
              <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]">
                +{top5.length - 2}
              </span>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Errors" topLabel="Top 5">
          <ApmLineChart series={errorsSeries} height={170} />
        </ChartCard>
      </div>

      <div className="mt-4 rounded-lg border border-[#e8eaed] bg-white">
        <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2.5">
          <span className="text-[13px] text-[#202124]">
            Showing <span className="font-semibold">1–{pageEnd}</span> of{" "}
            <span className="font-semibold">{totalCount}</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-[260px] items-center gap-2 rounded-md border border-[#bdc1c6] px-2">
              <MagnifyingGlass size={13} className="text-[#5f6368]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Resources"
                className="w-full bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
              />
            </div>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <Gear size={12} />
              Options
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[13px]">
            <thead>
              <tr className="border-b border-[#e8eaed] text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                <th className="w-8 px-2 py-2"></th>
                <SortHeader
                  active={sortKey === "name"}
                  onClick={() => setSortKey("name")}
                >
                  Resource Name
                </SortHeader>
                <th className="px-3 py-2 text-left">Frontend Views</th>
                <SortHeader
                  active={sortKey === "requests"}
                  onClick={() => setSortKey("requests")}
                >
                  Requests
                </SortHeader>
                <SortHeader
                  active={sortKey === "totalTime"}
                  onClick={() => setSortKey("totalTime")}
                >
                  ↓² Total Time
                </SortHeader>
                <SortHeader
                  active={sortKey === "p95"}
                  onClick={() => setSortKey("p95")}
                >
                  P95 Latency
                </SortHeader>
                <SortHeader
                  active={sortKey === "errors"}
                  onClick={() => setSortKey("errors")}
                >
                  Errors
                </SortHeader>
                <SortHeader
                  active={sortKey === "errorRate"}
                  onClick={() => setSortKey("errorRate")}
                >
                  Error Rate
                </SortHeader>
                <th className="px-3 py-2 text-left">Monitors</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 10).map((r) => (
                <ResourceRow
                  key={r.id}
                  resource={r}
                  maxRequests={Math.max(1, ...filtered.map((x) => x.requests ?? 0))}
                  maxLatency={Math.max(1, ...filtered.map((x) => x.p95LatencyMs))}
                  maxTotal={Math.max(1, ...filtered.map((x) => x.totalTimeMs))}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#5f6368]">
                    No resources match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function shortName(s: string): string {
  return s.length > 28 ? `${s.slice(0, 26)}…` : s;
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#202124]">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

function SortHeader({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${
          active ? "text-[#202124]" : "hover:text-[#202124]"
        }`}
      >
        {children}
      </button>
    </th>
  );
}

function ResourceRow({
  resource,
  maxRequests,
  maxLatency,
  maxTotal,
}: {
  resource: ApmResource;
  maxRequests: number;
  maxLatency: number;
  maxTotal: number;
}) {
  const [starred, setStarred] = useState(false);
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]">
      <td className="px-2 py-2.5">
        <button
          type="button"
          onClick={() => setStarred((v) => !v)}
          className="text-[#bdc1c6] hover:text-[#fbbc04]"
        >
          <Star
            size={13}
            weight={starred ? "fill" : "regular"}
            className={starred ? "text-[#fbbc04]" : ""}
          />
        </button>
      </td>
      <td className="px-3 py-2.5 font-mono text-[12.5px] text-[#7c3aed]">
        {resource.name}
      </td>
      <td className="px-3 py-2.5 text-[#5f6368]"></td>
      <td className="px-3 py-2.5">
        {resource.requests === null ? (
          <span className="text-[#5f6368]">--</span>
        ) : (
          <>
            <div className="text-[#202124]">{resource.requests}</div>
            <MiniBar
              value={resource.requests}
              max={maxRequests}
              color="#1a73e8"
            />
          </>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[#202124]">
          {formatDuration(resource.totalTimeMs)}
        </div>
        <MiniBar
          value={resource.totalTimeMs}
          max={maxTotal}
          color="#1a73e8"
        />
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[#202124]">{formatLatency(resource.p95LatencyMs)}</div>
        <MiniBar
          value={resource.p95LatencyMs}
          max={maxLatency}
          color="#1a73e8"
        />
      </td>
      <td className="px-3 py-2.5">
        {resource.errors === null ? (
          <span className="text-[#5f6368]">--</span>
        ) : (
          <span className={resource.errors > 0 ? "text-[#d93025]" : "text-[#202124]"}>
            {resource.errors}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={
            resource.errorRate > 0 ? "text-[#d93025]" : "text-[#5f6368]"
          }
        >
          {(resource.errorRate * 100).toFixed(0)}%
        </span>
        <MiniBar
          value={resource.errorRate}
          max={1}
          color={resource.errorRate > 0 ? "#d93025" : "#1a73e8"}
        />
      </td>
      <td className="px-3 py-2.5"></td>
    </tr>
  );
}

function ChartCard({
  title,
  topLabel,
  children,
}: {
  title: string;
  topLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] text-[#202124]">
        <span className="inline-flex items-center gap-1">
          <span className="font-medium">{title}</span>
          <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        </span>
        {topLabel && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]">
            {topLabel}
            <CaretDown size={9} weight="bold" />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
