"use client";

import {
  ArrowRight,
  CaretDown,
  CaretRight,
  Gear,
  SidebarSimple,
  Sigma,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { useApmFacets, useApmSpans } from "../hooks";
import {
  selectTracesSearchText,
  useApmTracesStore,
} from "../store";
import type { ApmSpan, ApmTracesQuery } from "../types";

const COL_GRID =
  "grid-cols-[160px_180px_minmax(0,1fr)_100px_90px_120px]";

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate().toString().padStart(2, "0");
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms3 = d.getMilliseconds().toString().padStart(3, "0");
  return `${month} ${day} ${hh}:${mm}:${ss}.${ms3}`;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(0)}µs`;
}

const SERVICE_DOT: Record<string, string> = {
  web: "bg-[#a8c5f7]",
  api: "bg-[#a142f4]",
  auth: "bg-[#34a853]",
  payments: "bg-[#fbbc04]",
  worker: "bg-[#f59e0b]",
  caddy: "bg-[#10b981]",
  postgres: "bg-[#7c3aed]",
  redis: "bg-[#e8b3a8]",
};

const SERVICE_ICON_BG: Record<string, string> = {
  web: "bg-[#e8f0fe] text-[#1a73e8]",
  api: "bg-[#fce8f4] text-[#a142f4]",
  auth: "bg-[#e6f4ea] text-[#34a853]",
  payments: "bg-[#fef7e0] text-[#a37200]",
  worker: "bg-[#fff4e5] text-[#f59e0b]",
  caddy: "bg-[#dff5ec] text-[#10b981]",
  postgres: "bg-[#f3e8fd] text-[#7c3aed]",
  redis: "bg-[#fef7e0] text-[#e8b3a8]",
};

export function TracesTable() {
  const services = useApmTracesStore((s) => s.selectedServices);
  const statuses = useApmTracesStore((s) => s.selectedStatuses);
  const resources = useApmTracesStore((s) => s.selectedResources);
  const expandedSpanId = useApmTracesStore((s) => s.expandedSpanId);
  const setExpandedSpan = useApmTracesStore((s) => s.setExpandedSpan);
  const range = useApmTracesStore((s) => s.timeRange);
  const searchText = useApmTracesStore(selectTracesSearchText);

  const query: ApmTracesQuery = useMemo(
    () => ({
      text: searchText,
      services: services,
      statuses: statuses,
      resources: resources,
    }),
    [searchText, services, statuses, resources],
  );

  const { data: spans, isLoading } = useApmSpans(query, range);
  const { data: facets } = useApmFacets(query, range);

  const total = facets?.total ?? spans?.length ?? 0;
  const seconds = (range.toMs - range.fromMs) / 1000;
  const rate = seconds > 0 ? total / seconds : 0;

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-[#e8eaed] px-4 py-2">
        <button
          type="button"
          className="flex items-center gap-2 text-[13px] text-[#202124] hover:underline"
        >
          <CaretRight size={12} weight="bold" className="text-[#5f6368]" />
          <span className="font-medium">Requests, Errors, and Latency</span>
        </button>
        <div className="ml-auto flex items-center gap-4 text-[12.5px]">
          <button
            type="button"
            className="text-[#1a73e8] hover:underline"
          >
            Analyze Error Spans <ArrowRight size={11} className="inline" />
          </button>
          <span className="h-4 w-px bg-[#e8eaed]" />
          <button
            type="button"
            className="text-[#1a73e8] hover:underline"
          >
            Analyze High Latency Spans{" "}
            <ArrowRight size={11} className="inline" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#e8eaed] px-4 py-2">
        <button
          type="button"
          aria-label="Collapse facets"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <SidebarSimple size={14} />
        </button>
        <span className="text-[13px] text-[#202124]">
          <span className="font-semibold">{rate.toFixed(0)}</span>{" "}
          <span className="text-[#5f6368]">spans/s</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            <Sigma size={12} />
            Generate New Metric
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            <Gear size={12} />
            Options
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          <div
            className={`grid ${COL_GRID} items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]`}
          >
            <span className="inline-flex items-center gap-1">
              <CaretDown size={10} weight="bold" />
              Date
            </span>
            <span>Service</span>
            <span>Resource</span>
            <span>Duration</span>
            <span>Method</span>
            <span>Status Code</span>
          </div>

          {isLoading && (
            <div className="px-4 py-6 text-[13px] text-[#5f6368]">Loading…</div>
          )}
          {!isLoading && (spans?.length ?? 0) === 0 && (
            <div className="px-4 py-6 text-[13px] text-[#5f6368]">
              No spans match the current filters.
            </div>
          )}
          {spans?.map((span) => (
            <SpanRow
              key={span.id}
              span={span}
              active={span.id === expandedSpanId}
              onSelect={() =>
                setExpandedSpan(span.id === expandedSpanId ? null : span.id)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SpanRow({
  span,
  active,
  onSelect,
}: {
  span: ApmSpan;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full ${COL_GRID} items-center gap-2 border-b border-[#f1f3f4] px-4 py-1 text-left text-[12.5px] transition-colors ${
        active ? "bg-[#e8f0fe]" : "hover:bg-[#f8f9fb]"
      }`}
    >
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span
          className={`h-3 w-[3px] rounded-sm ${
            span.status === "error" ? "bg-[#d93025]" : "bg-[#34a853]"
          }`}
        />
        <span className="text-[#202124]">{formatTimestamp(span.timestampMs)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded ${
            SERVICE_ICON_BG[span.service] ?? "bg-[#f1f3f4] text-[#5f6368]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              SERVICE_DOT[span.service] ?? "bg-[#5f6368]"
            }`}
          />
        </span>
        <span className="truncate text-[#202124]">{span.service}</span>
      </div>
      <span className="truncate text-[#202124]">{span.resource}</span>
      <span className="text-[#202124]">{formatDuration(span.durationMs)}</span>
      <span className="text-[#202124]">{span.method ?? ""}</span>
      <span>
        {span.statusCode ? <StatusCodeBadge code={span.statusCode} /> : null}
      </span>
    </button>
  );
}

function StatusCodeBadge({ code }: { code: number }) {
  const tone =
    code < 300
      ? "bg-[#34a853] text-white"
      : code < 400
      ? "bg-[#1a73e8] text-white"
      : code < 500
      ? "bg-[#fbbc04] text-[#202124]"
      : "bg-[#d93025] text-white";
  return (
    <span
      className={`inline-flex h-5 w-9 items-center justify-center rounded text-[11px] font-bold ${tone}`}
    >
      {code}
    </span>
  );
}
