"use client";

import { useMemo, useState } from "react";
import type { ApmFlameSpan } from "../types";

const ROW_H = 22;
const SERVICE_FILL: Record<string, string> = {
  caddy: "#10b981",
  web: "#a8c5f7",
  api: "#a142f4",
  auth: "#34a853",
  payments: "#fbbc04",
  worker: "#f59e0b",
  postgres: "#7c3aed",
  redis: "#e8b3a8",
};

type LaidOutSpan = ApmFlameSpan & {
  depth: number;
  startMs: number;
  endMs: number;
};

function buildTree(spans: ApmFlameSpan[]): LaidOutSpan[] {
  // Group by parent_span_id and walk depth-first so siblings stack horizontally
  // and nested calls indent. Returns spans annotated with their tree depth.
  const byParent = new Map<string | null, ApmFlameSpan[]>();
  spans.forEach((s) => {
    const list = byParent.get(s.parentSpanId ?? null) ?? [];
    list.push(s);
    byParent.set(s.parentSpanId ?? null, list);
  });
  for (const [, list] of byParent) {
    list.sort((a, b) => a.tsMs - b.tsMs);
  }

  const out: LaidOutSpan[] = [];
  const visit = (parent: string | null, depth: number) => {
    const children = byParent.get(parent) ?? [];
    for (const c of children) {
      out.push({
        ...c,
        depth,
        startMs: c.tsMs,
        endMs: c.tsMs + c.durationMs,
      });
      visit(c.spanId, depth + 1);
    }
  };
  visit(null, 0);
  // Some traces have spans whose declared parent isn't in the result set
  // (legitimate when spans were sampled out). Promote those to depth 0.
  const seen = new Set(out.map((s) => s.spanId));
  for (const s of spans) {
    if (!seen.has(s.spanId)) {
      out.push({
        ...s,
        depth: 0,
        startMs: s.tsMs,
        endMs: s.tsMs + s.durationMs,
      });
    }
  }
  return out;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(0)}µs`;
}

export function TraceFlameGraph({
  spans,
  startMs,
  endMs,
}: {
  spans: ApmFlameSpan[];
  startMs: number;
  endMs: number;
}) {
  const laidOut = useMemo(() => buildTree(spans), [spans]);
  const totalMs = Math.max(0.001, endMs - startMs);
  const maxDepth = Math.max(0, ...laidOut.map((s) => s.depth));
  const height = (maxDepth + 1) * (ROW_H + 2) + 40;

  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white">
      <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2 text-[12.5px]">
        <span className="font-semibold text-[#202124]">Flame graph</span>
        <span className="text-[#5f6368]">
          {spans.length} span{spans.length === 1 ? "" : "s"} · {formatLatency(totalMs)}
        </span>
      </div>

      <div className="relative overflow-x-auto" style={{ height }}>
        <div
          className="relative"
          style={{ width: "100%", minWidth: 720, height }}
        >
          {/* time-grid background */}
          <Gridlines totalMs={totalMs} />
          {/* spans */}
          {laidOut.map((s) => {
            const left = ((s.startMs - startMs) / totalMs) * 100;
            const widthPct = Math.max(
              0.2,
              (s.durationMs / totalMs) * 100,
            );
            const top = 8 + s.depth * (ROW_H + 2);
            const fill =
              s.status === "error"
                ? "#fbeae8"
                : SERVICE_FILL[s.service] ?? "#dadce0";
            const border =
              s.status === "error"
                ? "#d93025"
                : SERVICE_FILL[s.service] ?? "#5f6368";
            const isSelected = selected === s.spanId;
            return (
              <button
                key={s.spanId}
                type="button"
                onClick={() =>
                  setSelected((prev) => (prev === s.spanId ? null : s.spanId))
                }
                title={`${s.service} · ${s.resource} · ${formatLatency(s.durationMs)}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${widthPct}%`,
                  top,
                  height: ROW_H,
                  backgroundColor: fill,
                  borderLeft: `3px solid ${border}`,
                  borderTop: isSelected ? `1px solid ${border}` : undefined,
                  borderRight: isSelected ? `1px solid ${border}` : undefined,
                  borderBottom: isSelected ? `1px solid ${border}` : undefined,
                }}
                className="overflow-hidden whitespace-nowrap rounded-sm px-1.5 text-left text-[11px] text-[#202124] hover:brightness-95"
              >
                <span className="font-semibold">{s.service}</span>
                <span className="text-[#5f6368]"> · {s.resource}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <SpanInspector
          span={laidOut.find((s) => s.spanId === selected) ?? null}
          startMs={startMs}
        />
      )}
    </div>
  );
}

function Gridlines({ totalMs }: { totalMs: number }) {
  const ticks = 6;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const left = (i / ticks) * 100;
        const ms = (i / ticks) * totalMs;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: "#f1f3f4",
            }}
          >
            <span
              style={{
                position: "absolute",
                bottom: 4,
                left: 2,
                color: "#5f6368",
                fontSize: 10,
                whiteSpace: "nowrap",
              }}
            >
              {formatLatency(ms)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SpanInspector({
  span,
  startMs,
}: {
  span: LaidOutSpan | null;
  startMs: number;
}) {
  if (!span) return null;
  return (
    <div className="border-t border-[#e8eaed] bg-[#f8f9fb] px-4 py-3 text-[12.5px]">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
        <Field label="Service" value={span.service} />
        <Field label="Operation" value={span.operation} />
        <Field label="Resource" value={span.resource} />
        <Field label="Duration" value={formatLatency(span.durationMs)} />
        <Field label="Status" value={span.status} />
        <Field
          label="HTTP"
          value={
            span.httpMethod
              ? `${span.httpMethod} ${span.httpStatus ?? ""}`.trim()
              : "—"
          }
        />
        <Field label="Host" value={span.host ?? "—"} />
        <Field
          label="Offset"
          value={formatLatency(Math.max(0, span.startMs - startMs))}
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className="font-mono text-[12px] text-[#202124]">{value}</div>
    </div>
  );
}
