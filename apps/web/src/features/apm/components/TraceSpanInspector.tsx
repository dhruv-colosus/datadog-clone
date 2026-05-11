"use client";

import {
  ArrowSquareOut,
  ArrowsOutSimple,
  CaretDown,
  CaretRight,
  DotsThreeVertical,
  Globe,
  Info,
  PushPin,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { ApmFlameSpan } from "../types";
import { colorForService, formatSpanResource } from "./TraceFlameGraph";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "metrics", label: "Metrics" },
  { id: "logs", label: "Logs", count: 0 },
  { id: "network", label: "Network" },
  { id: "processes", label: "Processes" },
  { id: "profiles", label: "Profiles" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(0)}µs`;
}

function buildSpanUrl(span: ApmFlameSpan): string | null {
  if (!span.host) return null;
  // Resource is typically "GET /forms/.../responses" - strip the method prefix.
  const path = span.resource.replace(/^[A-Z]+\s+/, "");
  const scheme = span.tags?.scheme ?? "https";
  // Tolerate hosts that already contain a scheme (rare, but possible).
  if (span.host.startsWith("http://") || span.host.startsWith("https://")) {
    return `${span.host}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return `${scheme}://${span.host}${path.startsWith("/") ? path : `/${path}`}`;
}

function pickUserAgent(span: ApmFlameSpan): string | null {
  const tags = span.tags ?? {};
  return (
    tags["http.user_agent"] ??
    tags["user_agent"] ??
    tags["http.useragent"] ??
    null
  );
}

export function TraceSpanInspector({
  span,
  traceDurationMs,
}: {
  span: ApmFlameSpan;
  traceDurationMs: number;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [httpOpen, setHttpOpen] = useState(true);

  const color = colorForService(span.service);
  const hostColor = span.host ? "#a142f4" : color;
  const pctOfTrace = Math.min(
    100,
    Math.max(1, (span.durationMs / Math.max(1, traceDurationMs)) * 100),
  );
  const url = buildSpanUrl(span);
  const userAgent = pickUserAgent(span);
  const statusOk = span.status === "ok" && (span.httpStatus ?? 0) < 400;

  return (
    <div className="border-t border-[#e8eaed] bg-white">
      {/* Header row: service hierarchy on left, latency + total-exec on right */}
      <div className="flex items-center gap-3 px-4 py-3">
        <ServiceChip color={color} label={span.service} />
        {span.host && (
          <>
            <span className="text-[#5f6368]">→</span>
            <ServiceChip
              color={hostColor}
              label={span.host}
              dashed
            />
          </>
        )}
        <span className="text-[12.5px] text-[#5f6368]">via</span>
        <span className="font-mono text-[12.5px] text-[#202124]">
          {span.operation}
        </span>
        <span className="font-mono text-[12.5px] text-[#202124]">
          {formatSpanResource(span)}
        </span>
        <button
          type="button"
          aria-label="More actions"
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <DotsThreeVertical size={14} weight="bold" />
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center rounded-sm bg-[#fde7c8] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#a37200]">
            p80
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] tabular-nums text-[#202124]">
            <span className="text-[#5f6368]">⏱</span>
            {formatLatency(span.durationMs)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-[#5f6368]">
              {pctOfTrace >= 99.5 ? "100" : pctOfTrace.toFixed(0)}% total exec time
            </span>
            <span className="h-[3px] w-32 overflow-hidden rounded-full bg-[#f1f3f4]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${pctOfTrace}%`, backgroundColor: "#4285f4" }}
              />
            </span>
          </div>
          <button
            type="button"
            aria-label="Expand inspector"
            className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <ArrowsOutSimple size={13} weight="bold" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-[#e8eaed] px-4">
        <span className="mr-2 text-[12px] uppercase tracking-wide text-[#5f6368]">
          Span:
        </span>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] ${
                active
                  ? "font-semibold text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t.label}
              {"count" in t && t.count !== undefined && (
                <span
                  className={`inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-sm px-1 text-[10.5px] font-semibold ${
                    active
                      ? "bg-[#e8f0fe] text-[#1a73e8]"
                      : "bg-[#f1f3f4] text-[#5f6368]"
                  }`}
                >
                  {t.count}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {activeTab === "overview" ? (
        <div className="px-4 py-3">
          <PinnedAttributes
            open={pinnedOpen}
            onToggle={() => setPinnedOpen((v) => !v)}
          />
          <HttpRequests
            open={httpOpen}
            onToggle={() => setHttpOpen((v) => !v)}
            method={span.httpMethod}
            status={span.httpStatus}
            url={url}
            userAgent={userAgent}
            statusOk={statusOk}
          />
        </div>
      ) : (
        <div className="px-4 py-8 text-[12.5px] text-[#5f6368]">
          No {activeTab} data for this span.
        </div>
      )}
    </div>
  );
}

function ServiceChip({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
          dashed ? "border border-dashed" : ""
        }`}
        style={{
          backgroundColor: dashed ? "transparent" : `${color}33`,
          borderColor: color,
          color,
        }}
      >
        <Globe size={11} weight={dashed ? "regular" : "fill"} />
      </span>
      <span className="text-[13px] font-semibold text-[#202124]">{label}</span>
    </span>
  );
}

function PinnedAttributes({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[#f1f3f4] pb-2 text-[12.5px]">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-[#5f6368] hover:text-[#202124]"
      >
        {open ? (
          <CaretDown size={10} weight="bold" />
        ) : (
          <CaretRight size={10} weight="bold" />
        )}
        <span className="font-semibold text-[#202124]">
          Pinned Span Attributes
        </span>
      </button>
      <PushPin size={11} weight="fill" className="text-[#5f6368]" />
      <span className="text-[#5f6368]">No pinned tags found</span>
      <Info size={11} className="text-[#9aa0a6]" />
    </div>
  );
}

function HttpRequests({
  open,
  onToggle,
  method,
  status,
  url,
  userAgent,
  statusOk,
}: {
  open: boolean;
  onToggle: () => void;
  method: string | null;
  status: number | null;
  url: string | null;
  userAgent: string | null;
  statusOk: boolean;
}) {
  return (
    <div className="pt-2 text-[12.5px]">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-[#202124] hover:text-[#1a73e8]"
      >
        {open ? (
          <CaretDown size={10} weight="bold" />
        ) : (
          <CaretRight size={10} weight="bold" />
        )}
        <span className="font-semibold">HTTP Requests</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 pl-3">
          <Row label="Method">
            {method ? (
              <span className="text-[#1a73e8]">{method}</span>
            ) : (
              <span className="text-[#5f6368]">—</span>
            )}
          </Row>
          <Row label="Status Code" highlighted>
            {status !== null ? (
              <span
                className={
                  statusOk ? "text-[#137333]" : "text-[#d93025]"
                }
              >
                {status}
              </span>
            ) : (
              <span className="text-[#5f6368]">—</span>
            )}
          </Row>
          <Row label="URL">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 break-all text-[#1a73e8] hover:underline"
              >
                <span className="break-all">{url}</span>
                <ArrowSquareOut size={11} weight="bold" />
              </a>
            ) : (
              <span className="text-[#5f6368]">—</span>
            )}
          </Row>
          <Row label="User Agent">
            {userAgent ? (
              <span className="text-[#1a73e8]">{userAgent}</span>
            ) : (
              <span className="text-[#5f6368]">—</span>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  highlighted = false,
  children,
}: {
  label: string;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`flex items-center text-[#5f6368] ${
          highlighted ? "before:mr-1 before:text-[#9aa0a6] before:content-['⋮']" : ""
        }`}
      >
        {label}
      </div>
      <div className="font-mono text-[12px] text-[#202124]">{children}</div>
    </>
  );
}
