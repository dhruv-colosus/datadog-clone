"use client";

import { Binoculars, CaretLeft, CaretRight, DownloadSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApmWatchdog } from "../hooks";
import type { ApmWatchdogAnomaly } from "../types";

const PAGE_SIZE = 1;

export function ApmHomeWatchdog() {
  const { data: anomalies, isLoading } = useApmWatchdog(48);
  const [page, setPage] = useState(1);

  const total = anomalies?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = (anomalies ?? []).slice(start, start + PAGE_SIZE);

  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center gap-3 border-b border-[#e8eaed] px-4 py-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f1f3f4] px-2 py-1 text-[12.5px] text-[#202124]">
          <Binoculars size={12} className="text-[#5f6368]" />
          <span className="font-medium">Watchdog</span>
        </div>
        <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#5f6368]">
          2d
        </span>
        <span className="text-[12.5px] text-[#5f6368]">Past 2 Days</span>
        <Link
          href="/apm/traces"
          className="ml-auto text-[12.5px] text-[#1a73e8] hover:underline"
        >
          View All →
        </Link>
      </header>

      {isLoading && (
        <div className="px-4 py-8 text-[13px] text-[#5f6368]">Loading…</div>
      )}

      {!isLoading && total === 0 && (
        <div className="flex flex-col items-center gap-3 px-4 py-10">
          <Binoculars size={36} className="text-[#1a73e8]" />
          <p className="text-[13px] text-[#5f6368]">
            Watchdog is monitoring your services. Any anomalies will appear here.
          </p>
        </div>
      )}

      {!isLoading && visible.map((a) => <AnomalyCard key={a.id} anomaly={a} />)}

      {!isLoading && total > 0 && (
        <footer className="flex items-center justify-center gap-2 border-t border-[#e8eaed] px-4 py-2.5 text-[12.5px]">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-40"
          >
            <CaretLeft size={12} weight="bold" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                n === safePage
                  ? "bg-[#1a73e8] text-white"
                  : "text-[#202124] hover:bg-[#f1f3f4]"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-40"
          >
            <CaretRight size={12} weight="bold" />
          </button>
        </footer>
      )}
    </section>
  );
}

function AnomalyCard({ anomaly }: { anomaly: ApmWatchdogAnomaly }) {
  const points = anomaly.points;
  const peakPct = Math.round(anomaly.peakRate * 100);
  return (
    <article className="grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#137333]">
            Resolved
          </span>
          <span className="inline-flex items-center gap-1 text-[11.5px] text-[#5f6368]">
            <Binoculars size={11} className="text-[#1a73e8]" />
            <span className="font-semibold uppercase tracking-wide">
              {anomaly.kind}
            </span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[#5f6368]">
            <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5f6368]">
              {durationLabel(anomaly.endedMs - anomaly.startedMs)}
            </span>
            <span>{rangeLabel(anomaly.startedMs, anomaly.endedMs)}</span>
            <button
              type="button"
              aria-label="Download"
              className="text-[#5f6368] hover:text-[#202124]"
            >
              <DownloadSimple size={12} />
            </button>
          </span>
        </div>

        <h4 className="mt-3 max-w-md text-[14px] font-semibold leading-snug text-[#202124]">
          <span className="font-bold">Error rate</span> increased on the{" "}
          <span className="font-bold">{anomaly.resource}</span> resource in{" "}
          <span className="inline-flex items-center gap-1 rounded-md bg-[#fef7e0] px-1.5 py-0.5 text-[11px] font-semibold text-[#202124]">
            {anomaly.service}
          </span>
        </h4>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <Tag>env:prod</Tag>
          <Tag>service:{anomaly.service}</Tag>
          <Tag>resource:{shortResource(anomaly.resource)}</Tag>
          <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5f6368]">
            +2
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-[#5f6368]">Error rate</span>
          <span className="font-semibold text-[#d93025]">peak {peakPct}%</span>
        </div>
        <ErrorRateChart points={points} markStartMs={anomaly.startedMs} />
      </div>
    </article>
  );
}

function ErrorRateChart({
  points,
  markStartMs,
}: {
  points: ApmWatchdogAnomaly["points"];
  markStartMs: number;
}) {
  const w = 320;
  const h = 110;
  const data = useMemo(() => {
    if (points.length === 0)
      return { polyline: "", markX: 0, hasMark: false };
    const xs = points.map((p) => p.t);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = Math.max(1, maxX - minX);
    const polyline = points
      .map(
        (p) =>
          `${((p.t - minX) / span) * w},${h - Math.min(1, p.rate) * h}`,
      )
      .join(" ");
    const markX = ((markStartMs - minX) / span) * w;
    return { polyline, markX, hasMark: markX >= 0 && markX <= w };
  }, [points, markStartMs]);

  return (
    <div className="mt-1.5">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-[110px] w-full"
      >
        <line
          x1={0}
          x2={w}
          y1={h}
          y2={h}
          stroke="#e8eaed"
          strokeWidth={1}
        />
        <line
          x1={0}
          x2={w}
          y1={h / 2}
          y2={h / 2}
          stroke="#e8eaed"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
        <polyline
          points={data.polyline}
          fill="none"
          stroke="#d93025"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {data.hasMark && (
          <line
            x1={data.markX}
            x2={data.markX}
            y1={0}
            y2={h}
            stroke="#d93025"
            strokeDasharray="2 2"
            strokeWidth={1}
          />
        )}
        <text x={2} y={10} fontSize={9} fill="#5f6368">
          100
        </text>
        <text x={2} y={h / 2 + 3} fontSize={9} fill="#5f6368">
          50
        </text>
        <text x={2} y={h - 2} fontSize={9} fill="#5f6368">
          0
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[#5f6368]">
        {chartTicks(points).map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function chartTicks(points: ApmWatchdogAnomaly["points"]): string[] {
  if (points.length === 0) return ["", "", "", ""];
  const first = new Date(points[0].t);
  const last = new Date(points[points.length - 1].t);
  const mid = new Date((points[0].t + points[points.length - 1].t) / 2);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  return [fmt(first), "12:00", fmt(mid), fmt(last)];
}

function shortResource(s: string): string {
  return s.length > 18 ? `${s.slice(0, 16)}…` : s;
}

function rangeLabel(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${fmt(startMs)} – ${fmt(endMs).split(", ").slice(-1).join(", ")}`;
}

function durationLabel(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  return `${h}h`;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] font-medium text-[#202124]">
      {children}
    </span>
  );
}
