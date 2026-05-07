"use client";

import {
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  Copy,
  Cube,
  Funnel,
  Gear,
  Globe,
  Lightbulb,
  Link as LinkIcon,
  MagnifyingGlass,
  ThumbsDown,
  ThumbsUp,
  TreeStructure,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WatchdogStatus, WatchdogStory } from "../types";
import { humanTitle, ServiceTag, shortHash } from "./WatchdogList";

const STATUS_BG: Record<WatchdogStatus, { fg: string; bg: string; label: string }> =
  {
    active: { fg: "#d32f2f", bg: "#fde7e7", label: "ONGOING" },
    acknowledged: { fg: "#1e88e5", bg: "#e6f0fa", label: "ACKNOWLEDGED" },
    resolved: { fg: "#137333", bg: "#e1f3e6", label: "RESOLVED" },
  };

function fmtRange(startMs: number, endMs: number | null): string {
  const fmt = (t: number) =>
    new Date(t).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const e = endMs ?? Date.now();
  return `${fmt(startMs)} - ${fmt(e)}`;
}

function fmtDurationMin(startMs: number, endMs: number | null): string {
  const e = endMs ?? Date.now();
  const m = Math.max(1, Math.round((e - startMs) / 60000));
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function WatchdogStoryDrawer({
  story,
  onClose,
}: {
  story: WatchdogStory;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const sb = STATUS_BG[story.status];

  const points = story.evidence.points ?? [];
  const chartData = useMemo(
    () =>
      points.map((p) => ({ ts: p.ts, v: p.value })),
    [points],
  );
  const peakTs = useMemo(() => {
    let best = -Infinity;
    let idx = -1;
    for (let i = 0; i < chartData.length; i++) {
      const v = chartData[i].v;
      if (v != null && v > best) {
        best = v;
        idx = i;
      }
    }
    return idx >= 0 ? chartData[idx].ts : null;
  }, [chartData]);
  const peakLabel = peakTs
    ? `${new Date(peakTs).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })} - ${new Date(peakTs + 6 * 60000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`
    : "";

  const fakeResource = useMemo(
    () => fakeResourcePath(story),
    [story],
  );
  const traces = useMemo(() => mockTraces(story), [story]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <div className="flex h-full w-[min(1280px,calc(100vw-72px))] flex-col bg-white shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-[#1e88e5] via-[#7c3aed] to-[#c026d3]" />

        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-[#e8eaed] px-5 py-2.5">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
            style={{ background: sb.bg, color: sb.fg }}
          >
            {sb.label}
          </span>
          <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[#202124]">
            {fmtDurationMin(story.startedMs, story.endedMs)}
          </span>
          <span className="text-[11.5px] tabular-nums text-[#5f6368]">
            {fmtRange(story.startedMs, story.endedMs)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Save view"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#dadce0] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <ArrowSquareOut size={12} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded border border-[#dadce0] px-2.5 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              Actions <CaretDown size={10} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 rounded border border-[#dadce0] px-2.5 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <LinkIcon size={11} />
              Copy Link
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1100px] px-7 py-6">
            <h2 className="text-[20px] font-semibold leading-snug text-[#202124]">
              {humanTitle(story)} <ServiceTag service={story.service} />
            </h2>
            <div className="my-4 h-px bg-[#e8eaed]" />

            <div className="flex items-center gap-3 text-[12.5px]">
              <span className="text-[#5f6368]">Is this helpful?</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[#dadce0] bg-white px-2 py-1 text-[12px] hover:bg-[#f1f3f4]"
              >
                <ThumbsUp size={12} />
                Yes
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[#dadce0] bg-white px-2 py-1 text-[12px] hover:bg-[#f1f3f4]"
              >
                <ThumbsDown size={12} />
                No
              </button>
            </div>

            {/* Tags row */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5 border-y border-[#e8eaed] py-3">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#5f6368]">
                TAGS
              </span>
              <button
                type="button"
                aria-label="Copy tags"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
              >
                <Copy size={11} />
              </button>
              <Tag k="env" v="prod" />
              <Tag k="resource_hash" v={shortHash(story.id)} />
              <Tag k="resource_name" v={fakeResource} truncate />
              <span className="inline-flex h-5 items-center rounded border border-[#dadce0] bg-white px-1.5 text-[10.5px] font-medium text-[#5f6368]">
                +2
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex h-7 items-center gap-2 rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#202124]">
                  <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums">
                    2d
                  </span>
                  <span className="tabular-nums">
                    {fmtRange(
                      story.startedMs - 24 * 3600 * 1000,
                      (story.endedMs ?? Date.now()) + 24 * 3600 * 1000,
                    )}
                  </span>
                  <CaretDown size={10} className="text-[#5f6368]" />
                </div>
                <button
                  type="button"
                  aria-label="Search"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#dadce0] text-[#5f6368] hover:bg-[#f1f3f4]"
                >
                  <MagnifyingGlass size={12} />
                </button>
                <button
                  type="button"
                  aria-label="Reset"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
                >
                  <Gear size={12} />
                </button>
              </div>
            </div>

            {/* Critical Failure section */}
            <section className="mt-7">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#f3e8ff] text-[#7c3aed]">
                  <Warning size={14} weight="fill" />
                </span>
                <h3 className="text-[15.5px] font-semibold text-[#7c3aed]">
                  Critical Failure
                </h3>
              </div>

              <div className="rounded-lg border border-[#e8eaed] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-[#202124]">
                      Error rate increased on service{" "}
                      <ServiceTag service={story.service} />
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-[#5f6368]">
                      {fakeResource}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded bg-[#e8f0fe] px-2.5 text-[12px] font-medium text-[#1a73e8] hover:bg-[#d2e3fc]"
                  >
                    Investigate… <CaretDown size={10} />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11.5px] text-[#5f6368]">
                    <span>Error rate</span>
                    <button
                      type="button"
                      aria-label="Expand"
                      className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-[#f1f3f4]"
                    >
                      <ArrowSquareOut size={11} />
                    </button>
                  </div>
                  <div className="h-[280px]">
                    {chartData.length > 1 ? (
                      <ResponsiveContainer>
                        <AreaChart
                          data={chartData}
                          margin={{ top: 16, right: 16, bottom: 12, left: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id={`drawer-spike-${story.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#d32f2f"
                                stopOpacity={0.18}
                              />
                              <stop
                                offset="100%"
                                stopColor="#d32f2f"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="#f1f3f4"
                          />
                          <XAxis
                            dataKey="ts"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            tick={{ fontSize: 11, fill: "#9aa0a6" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(t) =>
                              new Date(t).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })
                            }
                            minTickGap={64}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#9aa0a6" }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                            domain={[0, "dataMax"]}
                            label={{
                              value: "Percent",
                              angle: -90,
                              position: "insideLeft",
                              fontSize: 10,
                              fill: "#9aa0a6",
                            }}
                          />
                          {peakTs && (
                            <ReferenceLine
                              x={peakTs}
                              stroke="#d32f2f"
                              strokeDasharray="3 3"
                              label={{
                                value: peakLabel,
                                position: "insideTopRight",
                                fill: "#d32f2f",
                                fontSize: 11,
                                offset: 6,
                              }}
                            />
                          )}
                          <Area
                            type="monotone"
                            dataKey="v"
                            stroke="#d32f2f"
                            strokeWidth={1.7}
                            fill={`url(#drawer-spike-${story.id})`}
                            isAnimationActive={false}
                            dot={false}
                          />
                          <RTooltip
                            cursor={{ stroke: "#bdc1c6", strokeDasharray: "3 3" }}
                            contentStyle={{
                              fontSize: 11,
                              border: "1px solid #dadce0",
                              borderRadius: 4,
                            }}
                            labelFormatter={(v) =>
                              new Date(v as number).toLocaleString()
                            }
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-[12px] text-[#9aa0a6]">
                        No evidence series
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11.5px] text-[#5f6368]">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: "#d32f2f" }}
                    />
                    <span className="truncate font-mono">{fakeResource}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Next Steps */}
            <section className="mt-8">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#e8f0fe] text-[#1a73e8]">
                  <Lightbulb size={14} weight="fill" />
                </span>
                <h3 className="text-[15.5px] font-semibold text-[#1a73e8]">
                  Next Steps
                </h3>
              </div>

              <div className="rounded-lg border border-[#e8eaed] bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[13.5px] font-semibold text-[#202124]">
                    Investigate error traces found during the critical failures
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded bg-[#1a73e8] px-3 text-[12px] font-medium text-white hover:bg-[#1864c1]"
                  >
                    Investigate in Traces <ArrowSquareOut size={11} />
                  </button>
                </div>
                <TracesTable rows={traces} service={story.service} />
              </div>
            </section>

            {/* Dependencies */}
            <section className="mt-8 mb-10">
              <div className="rounded-lg border border-[#e8eaed] bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[13.5px] font-semibold text-[#202124]">
                    Investigate upstream and downstream dependencies for
                  </h4>
                  <ServiceTag service={story.service} />
                  <span className="text-[#dadce0]">|</span>
                  <span className="truncate text-[12.5px] text-[#5f6368]">
                    {fakeResource}
                  </span>
                </div>

                <div className="mt-4 rounded border border-[#e8eaed] bg-[#fafbfc] p-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#1a73e8] hover:underline"
                    >
                      <CaretRight size={11} weight="bold" />
                      <TreeStructure size={12} />
                      Open Service List
                    </button>
                    <div className="flex items-center gap-2 text-[12px] text-[#5f6368]">
                      <span>Node Path:</span>
                      <NodeChip label="start:*" />
                      <ArrowConnector />
                      <NodeChip
                        label={fakeResource}
                        accent
                        service={story.service}
                      />
                      <ArrowConnector />
                      <NodeChip label="end:*" />
                      <button
                        type="button"
                        aria-label="Settings"
                        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded border border-[#dadce0] text-[#5f6368] hover:bg-[#f1f3f4]"
                      >
                        <Gear size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tag({
  k,
  v,
  truncate,
}: {
  k: string;
  v: string;
  truncate?: boolean;
}) {
  const display = truncate && v.length > 60 ? `${v.slice(0, 56)}…` : v;
  return (
    <span className="inline-flex h-5 items-center rounded bg-[#f1f3f4] px-1.5 text-[11px] text-[#5f6368]">
      <span className="font-medium text-[#202124]">{k}</span>
      <span className="px-0.5 text-[#9aa0a6]">:</span>
      <span className="font-mono text-[#1a73e8]">{display}</span>
    </span>
  );
}

function NodeChip({
  label,
  accent,
  service,
}: {
  label: string;
  accent?: boolean;
  service?: string;
}) {
  if (accent) {
    return (
      <span className="inline-flex h-7 max-w-[280px] items-center gap-1 rounded border-2 border-[#7c3aed] bg-white px-2 text-[12px]">
        {service && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded"
            style={{ background: "#1e88e5", color: "white" }}
          >
            <Globe size={9} weight="fill" />
          </span>
        )}
        <span className="truncate font-medium text-[#202124]">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#202124]">
      <span className="font-mono">{label}</span>
    </span>
  );
}

function ArrowConnector() {
  return (
    <span className="inline-flex h-7 w-5 items-center justify-center text-[#bdc1c6]">
      →
    </span>
  );
}

function fakeResourcePath(story: WatchdogStory): string {
  if (story.metric) {
    return `/home/azureuser/${story.service}/frontend/node_modules/next/dist/compiled/${story.metric.replace(/\./g, "/")}.js`;
  }
  return `/home/azureuser/${story.service}/frontend/node_modules/next/dist/compiled/jest-worker/processChild.js`;
}

type TraceRow = {
  date: string;
  service: string;
  resource: string;
  errorMessage: string;
  duration: string;
  method: string;
  statusCode: string;
  spans: number;
  latency: number;
};

function mockTraces(story: WatchdogStory): TraceRow[] {
  const base = story.startedMs;
  const path = fakeResourcePath(story);
  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  return [
    {
      date: fmt(base + 540_000),
      service: story.service,
      resource: path,
      errorMessage: "",
      duration: "9.51s",
      method: "",
      statusCode: "",
      spans: 1,
      latency: 0.92,
    },
    {
      date: fmt(base + 480_000),
      service: story.service,
      resource: path,
      errorMessage: "",
      duration: "5.80s",
      method: "",
      statusCode: "",
      spans: 1,
      latency: 0.6,
    },
    {
      date: fmt(base + 419_000),
      service: story.service,
      resource: path,
      errorMessage: "",
      duration: "31.9s",
      method: "",
      statusCode: "",
      spans: 1,
      latency: 1,
    },
  ];
}

function TracesTable({
  rows,
  service,
}: {
  rows: TraceRow[];
  service: string;
}) {
  return (
    <div className="overflow-x-auto rounded border border-[#e8eaed]">
      <table className="min-w-full text-[12.5px]">
        <thead className="bg-[#fafbfc] text-[10.5px] uppercase tracking-wider text-[#5f6368]">
          <tr>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              <span className="inline-flex items-center gap-1">
                <CaretDown size={9} weight="bold" />
                DATE
              </span>
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              SERVICE
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              RESOURCE
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              @ERROR.MESSAGE
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              DURATION
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              METHOD
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              STATUS CODE
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              SPANS
            </th>
            <th className="border-b border-[#e8eaed] px-3 py-2 text-left font-semibold">
              LATENCY BR
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[#fafbfc]">
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-1 rounded-sm"
                    style={{ background: "#d32f2f" }}
                  />
                  <span className="tabular-nums text-[#202124]">{r.date}</span>
                </span>
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#e6f0fa] text-[#1e88e5]">
                    <Cube size={9} weight="fill" />
                  </span>
                  <span className="font-medium text-[#202124]">{service}</span>
                </span>
              </td>
              <td className="max-w-[260px] truncate border-b border-[#f1f3f4] px-3 py-2 align-middle font-mono text-[#5f6368]">
                {r.resource.length > 40
                  ? `${r.resource.slice(0, 36)}…`
                  : r.resource}
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle text-[#5f6368]">
                {r.errorMessage || ""}
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle font-mono tabular-nums text-[#202124]">
                {r.duration}
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle text-[#5f6368]">
                {r.method}
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle text-[#5f6368]">
                {r.statusCode}
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle tabular-nums text-[#202124]">
                {r.spans}
              </td>
              <td className="border-b border-[#f1f3f4] px-3 py-2 align-middle">
                <div className="h-2 w-[120px] overflow-hidden rounded-full bg-[#f1f3f4]">
                  <div
                    className="h-full rounded-full bg-[#1e88e5]"
                    style={{ width: `${Math.round(r.latency * 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
