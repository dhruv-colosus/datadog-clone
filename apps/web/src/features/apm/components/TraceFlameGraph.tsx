"use client";

import { useMemo } from "react";
import type { ApmFlameSpan } from "../types";

const ROW_H = 26;
const ROW_GAP = 4;

export const SERVICE_FILL: Record<string, string> = {
  caddy: "#10b981",
  web: "#a8c5f7",
  api: "#a142f4",
  auth: "#34a853",
  payments: "#fbbc04",
  worker: "#f59e0b",
  postgres: "#1a73e8",
  redis: "#e8b3a8",
};

export const FALLBACK_FILL = "#c4a5f7";
const SERVICE_BORDER_FALLBACK = "#a142f4";

type LaidOutSpan = ApmFlameSpan & {
  depth: number;
  startMs: number;
  endMs: number;
};

export function colorForService(service: string): string {
  return SERVICE_FILL[service] ?? FALLBACK_FILL;
}

export function formatSpanResource(span: ApmFlameSpan): string {
  if (!span.httpMethod) return span.resource;
  const re = new RegExp(`^${span.httpMethod}\\s+`, "i");
  if (re.test(span.resource)) return span.resource;
  return `${span.httpMethod} ${span.resource}`;
}

export function buildTree(spans: ApmFlameSpan[]): LaidOutSpan[] {
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

const AXIS_HEIGHT = 26;

export function TraceFlameGraph({
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
  const laidOut = useMemo(() => buildTree(spans), [spans]);
  const totalMs = Math.max(0.001, endMs - startMs);
  const maxDepth = Math.max(0, ...laidOut.map((s) => s.depth));
  const bodyHeight = (maxDepth + 1) * (ROW_H + ROW_GAP) + 12;
  const height = AXIS_HEIGHT + bodyHeight;

  return (
    <div className="relative h-full overflow-x-auto bg-white">
      <div
        className="relative"
        style={{ width: "100%", minWidth: 640, height }}
      >
        <Gridlines totalMs={totalMs} bodyHeight={bodyHeight} />
        <div style={{ position: "absolute", top: AXIS_HEIGHT, left: 0, right: 0, height: bodyHeight }}>
          {laidOut.map((s) => {
            const left = ((s.startMs - startMs) / totalMs) * 100;
            const widthPct = Math.max(0.4, (s.durationMs / totalMs) * 100);
            const top = 6 + s.depth * (ROW_H + ROW_GAP);
            const isSelected = selectedSpanId === s.spanId;
            const fill =
              s.status === "error" ? "#fbeae8" : colorForService(s.service);
            const border =
              s.status === "error"
                ? "#d93025"
                : SERVICE_FILL[s.service] ?? SERVICE_BORDER_FALLBACK;
            return (
              <button
                key={s.spanId}
                type="button"
                onClick={() =>
                  onSelect(selectedSpanId === s.spanId ? null : s.spanId)
                }
                title={`${s.service} · ${s.resource} · ${formatLatency(s.durationMs)}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${widthPct}%`,
                  top,
                  height: ROW_H,
                  backgroundColor: fill,
                  outline: isSelected ? `1.5px solid #202124` : undefined,
                  outlineOffset: isSelected ? 0 : undefined,
                  borderRight: `2px solid ${border}`,
                }}
                className="overflow-hidden whitespace-nowrap rounded-[3px] px-1.5 text-left text-[11.5px] font-medium text-[#202124] hover:brightness-95"
              >
                <span className="inline-block max-w-full truncate align-bottom">
                  {formatSpanResource(s)}
                  <span className="ml-1.5 font-normal text-[#3c4043]">
                    {formatLatency(s.durationMs)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Gridlines({
  totalMs,
  bodyHeight,
}: {
  totalMs: number;
  bodyHeight: number;
}) {
  const ticks = 4; // 0, 50, 100, 150, 200 style spacing - 5 marks
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
        const isFirst = i === 0;
        const isLast = i === ticks;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: 0,
              height: AXIS_HEIGHT + bodyHeight,
              width: 1,
              backgroundColor: "#f1f3f4",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 6,
                left: isLast ? "auto" : isFirst ? 2 : -16,
                right: isLast ? 2 : "auto",
                color: "#5f6368",
                fontSize: 10.5,
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
