"use client";

import {
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  Clock,
  Copy,
  Globe,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApmTrace } from "../hooks";
import type { ApmFlameSpan, ApmTraceDetail } from "../types";
import { ApmHeader } from "./ApmHeader";
import { formatSpanResource, TraceFlameGraph } from "./TraceFlameGraph";
import { TraceLegend } from "./TraceLegend";
import { TraceSpanInspector } from "./TraceSpanInspector";

type ViewTab = {
  id: "flame" | "waterfall" | "list" | "map";
  label: string;
  showCount?: boolean;
};

const VIEW_TABS: ViewTab[] = [
  { id: "flame", label: "Flame Graph" },
  { id: "waterfall", label: "Waterfall" },
  { id: "list", label: "Span List", showCount: true },
  { id: "map", label: "Map" },
];

type ViewId = ViewTab["id"];

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

function formatAbsoluteTimestamp(ms: number): string {
  const d = new Date(ms);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const millis = String(d.getMilliseconds()).padStart(3, "0");
  return `${month} ${day} ${hh}:${mm}:${ss}.${millis}`;
}

function formatRelativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Timeout",
  409: "Conflict",
  422: "Unprocessable",
  429: "Too Many Requests",
  500: "Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

function pickRootSpan(spans: ApmFlameSpan[]): ApmFlameSpan | null {
  if (!spans.length) return null;
  const known = new Set(spans.map((s) => s.spanId));
  const roots = spans.filter(
    (s) => !s.parentSpanId || !known.has(s.parentSpanId),
  );
  const ordered = (roots.length ? roots : spans)
    .slice()
    .sort((a, b) => a.tsMs - b.tsMs);
  return ordered[0];
}

function buildRootUrl(span: ApmFlameSpan): string | null {
  if (!span.host) return null;
  const path = span.resource.replace(/^[A-Z]+\s+/, "");
  return `https://${span.host}${path.startsWith("/") ? path : `/${path}`}`;
}


export function TraceDetailPage({ traceId }: { traceId: string }) {
  const { data, isLoading, isError } = useApmTrace(traceId);
  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <ApmHeader />
      {isLoading && (
        <div className="px-5 py-4 text-[13px] text-[#5f6368]">
          Loading trace…
        </div>
      )}
      {isError && (
        <div className="mx-5 mt-4 rounded-md border border-[#fbcfc7] bg-[#fef2f1] px-4 py-3 text-[13px] text-[#a8261c]">
          We couldn&apos;t load this trace. It may be older than the 7-day
          retention window.
        </div>
      )}
      {data && <TraceDetailBody data={data} traceId={traceId} />}
    </div>
  );
}

function TraceDetailBody({
  data,
  traceId,
}: {
  data: ApmTraceDetail;
  traceId: string;
}) {
  const root = useMemo(() => pickRootSpan(data.spans), [data.spans]);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(
    root?.spanId ?? null,
  );
  const [view, setView] = useState<ViewId>("flame");
  const [legendVisible, setLegendVisible] = useState(true);
  const [filter, setFilter] = useState("");

  const filteredSpans = useMemo(() => {
    if (!filter) return data.spans;
    const q = filter.toLowerCase();
    return data.spans.filter(
      (s) =>
        s.service.toLowerCase().includes(q) ||
        s.resource.toLowerCase().includes(q) ||
        s.operation.toLowerCase().includes(q) ||
        (s.host ?? "").toLowerCase().includes(q),
    );
  }, [data.spans, filter]);

  const selectedSpan =
    data.spans.find((s) => s.spanId === selectedSpanId) ?? root ?? null;

  if (!root) {
    return (
      <div className="px-5 py-4 text-[13px] text-[#5f6368]">
        No spans recorded for this trace.
      </div>
    );
  }

  const rootMethod = root.httpMethod;
  const rootUrl = buildRootUrl(root);
  const rootStatus = root.httpStatus;
  const rootStatusText =
    rootStatus !== null ? HTTP_STATUS_TEXT[rootStatus] ?? "" : "";
  const statusOk = rootStatus !== null && rootStatus < 400;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2.5 text-[13px]">
        <Link
          href="/apm/traces"
          className="font-semibold text-[#202124] hover:text-[#1a73e8]"
        >
          Traces
        </Link>
        <CaretRight size={10} weight="bold" className="text-[#9aa0a6]" />
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[#a142f4] text-[#a142f4]"
            aria-hidden
          >
            <Globe size={11} weight="regular" />
          </span>
          <Link
            href={`/apm/services/${root.service}`}
            className="font-semibold text-[#202124] hover:text-[#1a73e8]"
          >
            {root.service}
          </Link>
        </span>
        <CaretRight size={10} weight="bold" className="text-[#9aa0a6]" />
        <span className="font-mono text-[#202124]">{formatSpanResource(root)}</span>
        <CaretRight size={10} weight="bold" className="text-[#9aa0a6]" />
        <span className="uppercase tracking-wide text-[12px] text-[#5f6368]">
          trace_id
        </span>
        <span
          className="max-w-[28ch] truncate font-mono text-[12.5px] text-[#202124]"
          title={traceId}
        >
          {traceId}
        </span>
        <button
          type="button"
          aria-label="Copy trace ID"
          onClick={() =>
            navigator.clipboard?.writeText(traceId).catch(() => undefined)
          }
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <Copy size={12} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#7c4dff] px-2.5 py-1 text-[12.5px] font-medium text-white hover:bg-[#6c3fff]"
          >
            <Sparkle size={12} weight="fill" />
            Ask Bits
          </button>
        </div>
      </div>

      {/* Status summary bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2 text-[12.5px]">
        <span className="inline-flex items-center rounded-sm bg-[#fde7c8] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#a37200]">
          p80
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-[#f1f3f4] px-1.5 py-0.5 tabular-nums text-[#202124]">
          <Clock size={11} weight="regular" />
          {formatLatency(data.durationMs)}
        </span>
        {rootMethod && (
          <span className="font-mono text-[12px] uppercase text-[#5f6368]">
            {rootMethod}
          </span>
        )}
        {rootUrl && (
          <span className="min-w-0 max-w-[40ch] truncate text-[#202124]">
            {rootUrl}
          </span>
        )}
        {rootStatus !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${
              statusOk
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#fce8e6] text-[#a8261c]"
            }`}
          >
            {rootStatus} {rootStatusText}
          </span>
        )}
        <span className="text-[#5f6368]">
          {formatAbsoluteTimestamp(data.startMs)}{" "}
          <span>({formatRelativeTime(data.startMs)})</span>
        </span>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-[#e8eaed] bg-white px-4">
        <span className="mr-2 text-[12px] uppercase tracking-wide text-[#5f6368]">
          Trace:
        </span>
        {VIEW_TABS.map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`relative inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] ${
                active
                  ? "font-semibold text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t.label}
              {t.showCount && (
                <span
                  className={`inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-sm px-1 text-[10.5px] font-semibold ${
                    active
                      ? "bg-[#e8f0fe] text-[#1a73e8]"
                      : "bg-[#f1f3f4] text-[#5f6368]"
                  }`}
                >
                  {data.spanCount}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter + color/legend controls */}
      <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2">
        <label className="flex h-7 flex-1 items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2 text-[12.5px] focus-within:border-[#1a73e8]">
          <MagnifyingGlass size={12} className="text-[#5f6368]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter spans by any attribute"
            className="h-full w-full bg-transparent text-[#202124] placeholder-[#9aa0a6] outline-none"
          />
        </label>
        <div className="flex items-center gap-1 text-[12px] text-[#5f6368]">
          <span>Color by</span>
          <div className="mx-1 h-3 w-px bg-[#e8eaed]" />
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded border border-[#dadce0] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f8f9fb]"
          >
            Service
            <CaretDown size={9} weight="bold" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setLegendVisible((v) => !v)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12.5px] text-[#1a73e8] hover:bg-[#e8f0fe]"
        >
          {legendVisible ? "Hide Legend" : "Show Legend"}
          <ArrowSquareOut size={11} weight="bold" />
        </button>
      </div>

      {/* Main viz row: flame + side legend */}
      <div className="flex bg-white">
        <div className="flex-1 overflow-hidden">
          {view === "flame" && (
            <TraceFlameGraph
              spans={filteredSpans}
              startMs={data.startMs}
              endMs={data.endMs}
              selectedSpanId={selectedSpanId}
              onSelect={setSelectedSpanId}
            />
          )}
          {view === "waterfall" && (
            <WaterfallView
              spans={filteredSpans}
              startMs={data.startMs}
              endMs={data.endMs}
              selectedSpanId={selectedSpanId}
              onSelect={setSelectedSpanId}
            />
          )}
          {view === "list" && (
            <SpanListView
              spans={filteredSpans}
              startMs={data.startMs}
              selectedSpanId={selectedSpanId}
              onSelect={setSelectedSpanId}
            />
          )}
          {view === "map" && <MapPlaceholder services={data.services} />}
        </div>
        {legendVisible && (
          <TraceLegend
            spans={filteredSpans}
            totalDurationMs={data.durationMs}
          />
        )}
      </div>

      {/* Span Inspector */}
      {selectedSpan && (
        <TraceSpanInspector
          span={selectedSpan}
          traceDurationMs={data.durationMs}
        />
      )}

      {/* Footer */}
      <DatadogFooter />
    </div>
  );
}

function WaterfallView({
  spans,
  startMs,
  endMs,
  selectedSpanId,
  onSelect,
}: {
  spans: ApmFlameSpan[];
  startMs: number;
  endMs: number;
  selectedSpanId: string | null;
  onSelect: (spanId: string | null) => void;
}) {
  const total = Math.max(0.001, endMs - startMs);
  const ordered = useMemo(
    () => spans.slice().sort((a, b) => a.tsMs - b.tsMs),
    [spans],
  );
  return (
    <div className="h-full overflow-auto px-4 py-3">
      {ordered.map((s) => {
        const left = ((s.tsMs - startMs) / total) * 100;
        const widthPct = Math.max(0.4, (s.durationMs / total) * 100);
        const active = selectedSpanId === s.spanId;
        return (
          <button
            key={s.spanId}
            type="button"
            onClick={() =>
              onSelect(selectedSpanId === s.spanId ? null : s.spanId)
            }
            className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-[#f8f9fb] ${
              active ? "bg-[#e8f0fe]" : ""
            }`}
          >
            <span className="w-44 shrink-0 truncate text-[12.5px] text-[#202124]">
              <span className="font-semibold">{s.service}</span>
              <span className="ml-1 text-[#5f6368]">{formatSpanResource(s)}</span>
            </span>
            <span className="relative h-3 flex-1 rounded bg-[#f1f3f4]">
              <span
                className="absolute top-0 h-3 rounded"
                style={{
                  left: `${left}%`,
                  width: `${widthPct}%`,
                  backgroundColor: s.status === "error" ? "#fbeae8" : "#c4a5f7",
                }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-[11.5px] tabular-nums text-[#5f6368]">
              {formatLatency(s.durationMs)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SpanListView({
  spans,
  startMs,
  selectedSpanId,
  onSelect,
}: {
  spans: ApmFlameSpan[];
  startMs: number;
  selectedSpanId: string | null;
  onSelect: (spanId: string | null) => void;
}) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-[#f8f9fb] text-[11px] uppercase tracking-wide text-[#5f6368]">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Service</th>
            <th className="px-3 py-2 text-left font-semibold">Resource</th>
            <th className="px-3 py-2 text-left font-semibold">Operation</th>
            <th className="px-3 py-2 text-right font-semibold">Offset</th>
            <th className="px-3 py-2 text-right font-semibold">Duration</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {spans.map((s) => {
            const active = selectedSpanId === s.spanId;
            return (
              <tr
                key={s.spanId}
                onClick={() =>
                  onSelect(selectedSpanId === s.spanId ? null : s.spanId)
                }
                className={`cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fb] ${
                  active ? "bg-[#e8f0fe]" : ""
                }`}
              >
                <td className="px-3 py-2 font-semibold text-[#202124]">
                  {s.service}
                </td>
                <td className="px-3 py-2 font-mono text-[#202124]">
                  {formatSpanResource(s)}
                </td>
                <td className="px-3 py-2 text-[#5f6368]">{s.operation}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#5f6368]">
                  {formatLatency(Math.max(0, s.tsMs - startMs))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[#202124]">
                  {formatLatency(s.durationMs)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold ${
                      s.status === "error"
                        ? "bg-[#fce8e6] text-[#a8261c]"
                        : "bg-[#e6f4ea] text-[#137333]"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MapPlaceholder({ services }: { services: string[] }) {
  return (
    <div className="flex h-64 items-center justify-center px-4 text-[12.5px] text-[#5f6368]">
      Service map view for {services.length} service
      {services.length === 1 ? "" : "s"}: {services.join(", ")}.
    </div>
  );
}

function DatadogFooter() {
  return (
    <div className="mt-auto flex items-center justify-center gap-2 border-t border-[#e8eaed] bg-white px-4 py-3 text-[11.5px] text-[#5f6368]">
      <span>Copyright Datadog, Inc. 2026</span>
      <span>-</span>
      <span className="font-mono">35.112487216</span>
      <span>-</span>
      <a href="#" className="hover:text-[#1a73e8]">
        Master Subscription Agreement
      </a>
      <span>-</span>
      <a href="#" className="hover:text-[#1a73e8]">
        Privacy Policy
      </a>
      <span>-</span>
      <a href="#" className="hover:text-[#1a73e8]">
        Cookie Policy
      </a>
      <span>-</span>
      <a href="#" className="inline-flex items-center gap-1 hover:text-[#1a73e8]">
        Datadog Status <span aria-hidden>→</span>
      </a>
      <span className="inline-flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full bg-[#34a853]"
        />
        All Systems Operational
      </span>
    </div>
  );
}
