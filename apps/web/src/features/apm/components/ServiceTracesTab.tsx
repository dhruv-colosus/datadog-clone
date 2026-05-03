"use client";

import { ArrowRight, CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";
import { useApmSpans } from "../hooks";
import { useApmTracesStore } from "../store";
import type { ApmService, ApmTracesQuery } from "../types";

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(0)}µs`;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}.${d.getMilliseconds().toString().padStart(3, "0")}`;
}

export function ServiceTracesTab({ service }: { service: ApmService }) {
  const range = useApmTracesStore((s) => s.timeRange);
  const query: ApmTracesQuery = useMemo(
    () => ({
      text: "",
      services: [service.id],
      statuses: [],
      resources: [],
    }),
    [service.id],
  );
  const { data: spans, isLoading } = useApmSpans(query, range);

  return (
    <div className="flex-1 overflow-auto bg-[#f8f9fb] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#202124]">
          <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
          Recent traces
        </h2>
        <Link
          href={`/apm/traces`}
          className="inline-flex items-center gap-1 text-[12.5px] text-[#1a73e8] hover:underline"
        >
          Open Traces explorer <ArrowRight size={11} weight="bold" />
        </Link>
      </div>

      <div className="rounded-lg border border-[#e8eaed] bg-white">
        <div className="grid grid-cols-[160px_minmax(0,1fr)_120px_90px_120px] items-center gap-2 border-b border-[#e8eaed] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
          <span>Time</span>
          <span>Resource</span>
          <span>Duration</span>
          <span>Method</span>
          <span>Status</span>
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-[13px] text-[#5f6368]">Loading…</div>
        )}
        {!isLoading && (spans?.length ?? 0) === 0 && (
          <div className="px-4 py-6 text-[13px] text-[#5f6368]">
            No spans for this service in the selected time range.
          </div>
        )}

        {spans?.slice(0, 50).map((span) => (
          <Link
            key={`${span.traceId}-${span.id}`}
            href={`/apm/traces/${span.traceId}`}
            className="grid grid-cols-[160px_minmax(0,1fr)_120px_90px_120px] items-center gap-2 border-b border-[#f1f3f4] px-4 py-1.5 text-[12.5px] last:border-b-0 hover:bg-[#f8f9fb]"
          >
            <span className="text-[#202124]">
              {formatTimestamp(span.timestampMs)}
            </span>
            <span className="truncate text-[#202124]">{span.resource}</span>
            <span className="text-[#202124]">
              {formatLatency(span.durationMs)}
            </span>
            <span className="text-[#202124]">{span.method ?? ""}</span>
            <span>
              {span.status === "error" ? (
                <span className="rounded bg-[#fbeae8] px-1.5 py-0.5 text-[11px] font-semibold text-[#d93025]">
                  ERROR
                </span>
              ) : span.statusCode ? (
                <span className="rounded bg-[#e6f4ea] px-1.5 py-0.5 text-[11px] font-semibold text-[#0d652d]">
                  {span.statusCode}
                </span>
              ) : (
                <span className="text-[#5f6368]">—</span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
