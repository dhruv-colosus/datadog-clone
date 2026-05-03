"use client";

import { ArrowLeft, Copy, Heart } from "@phosphor-icons/react";
import Link from "next/link";
import { useApmTrace } from "../hooks";
import { ApmHeader } from "./ApmHeader";
import { TraceFlameGraph } from "./TraceFlameGraph";

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

export function TraceDetailPage({ traceId }: { traceId: string }) {
  const { data, isLoading, isError } = useApmTrace(traceId);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <ApmHeader />

      <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2.5">
        <Link
          href="/apm/traces"
          className="inline-flex items-center gap-1 text-[12.5px] text-[#1a73e8] hover:underline"
        >
          <ArrowLeft size={11} weight="bold" />
          Back to Traces
        </Link>
        <span className="ml-2 text-[12px] uppercase tracking-wide text-[#5f6368]">
          Trace
        </span>
        <span className="font-mono text-[13px] text-[#202124]">{traceId}</span>
        <button
          type="button"
          aria-label="Copy trace ID"
          onClick={() =>
            navigator.clipboard
              ?.writeText(traceId)
              .catch(() => undefined)
          }
          className="text-[#5f6368] hover:bg-[#f1f3f4] rounded p-1"
        >
          <Copy size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        {isLoading && (
          <div className="text-[13px] text-[#5f6368]">Loading trace…</div>
        )}
        {isError && (
          <div className="rounded-md border border-[#fbcfc7] bg-[#fef2f1] px-4 py-3 text-[13px] text-[#a8261c]">
            We couldn&apos;t load this trace. It may be older than the 7-day
            retention window.
          </div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Duration" value={formatLatency(data.durationMs)} />
              <Stat label="Spans" value={String(data.spanCount)} />
              <Stat
                label="Errors"
                value={String(data.errorCount)}
                tone={data.errorCount > 0 ? "danger" : "default"}
              />
              <Stat label="Services" value={String(data.services.length)} />
            </div>

            <div className="mt-4 rounded-lg border border-[#e8eaed] bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f0fe] px-2 py-0.5 text-[11px] font-semibold text-[#1a73e8]">
                  <Heart size={11} weight="fill" />
                  Trace Health: {data.errorCount === 0 ? "OK" : "Errors"}
                </span>
                <span className="text-[12px] text-[#5f6368]">
                  Touched services:
                </span>
                {data.services.map((s) => (
                  <Link
                    key={s}
                    href={`/apm/services/${s}`}
                    className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#202124] hover:bg-[#e8eaed]"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <TraceFlameGraph
                spans={data.spans}
                startMs={data.startMs}
                endMs={data.endMs}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  const valueColor = tone === "danger" ? "text-[#d93025]" : "text-[#202124]";
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className={`mt-1 text-[18px] font-semibold ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
