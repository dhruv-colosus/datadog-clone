"use client";

import { CaretDown, Plus } from "@phosphor-icons/react";
import { useApmServiceSummarySeries } from "../hooks";
import { useApmTracesStore } from "../store";
import type { ApmService } from "../types";
import { ApmBarChart } from "./ApmBarChart";
import { ApmLineChart } from "./ApmLineChart";

export function ServiceSummaryTab({ service }: { service: ApmService }) {
  const range = useApmTracesStore((s) => s.timeRange);
  const { data: series } = useApmServiceSummarySeries(service.id, range);
  const points = series?.[0]?.points ?? [];
  const hits = points.map((p) => p.hits);
  const errors = points.map((p) => p.errors);
  const p50 = points.map((p) => p.p50Ms ?? p.latencyMs * 0.6);
  const p95 = points.map((p) => p.p95Ms ?? p.latencyMs);
  const p99 = points.map((p) => p.p99Ms ?? p.latencyMs * 1.2);
  const totalHits = hits.reduce((acc, v) => acc + v, 0);
  const totalErrors = errors.reduce((acc, v) => acc + v, 0);

  const formatRps = (n: number) => {
    const rps = n / 3600;
    if (rps < 0.1) return "< 0.1";
    return rps.toFixed(2);
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f8f9fb] p-5">
      <SectionHeader title="Service Summary" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SummaryCard label="Incidents" value="None" action="+ Declare">
          No incidents reported.
        </SummaryCard>
        <SummaryCard
          label="Service Health Monitors"
          value="None"
          action="+ Configure"
        >
          There are no service health monitors configured.
        </SummaryCard>
        <SummaryCard label="SLOs" value="None" action="+ Create" disabled>
          No SLOs for this service.
        </SummaryCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard
          title="Requests and Errors"
          subtitle={`${totalHits} total (${formatRps(totalHits)} req/s)`}
        >
          <ApmBarChart
            series={[{ id: "hits", color: "#a8c5f7", values: hits }]}
            yLabel="Requests"
          />
          <Legend items={[{ color: "#a8c5f7", label: "Hits" }]} />
        </ChartCard>

        <ChartCard
          title="Errors"
          subtitle={`${totalErrors} total (${formatRps(totalErrors)} req/s)`}
        >
          <ApmLineChart
            series={[{ id: "err", color: "#d93025", values: errors }]}
          />
        </ChartCard>

        <ChartCard
          title={`Latency for ${service.name}.${service.type === "db" ? "query" : "request"}`}
        >
          <ApmLineChart
            series={[
              { id: "p99", color: "#a142f4", values: p99 },
              { id: "p95", color: "#1a73e8", values: p95 },
              { id: "p50", color: "#fbbc04", values: p50 },
            ]}
            formatY={(v) => `${Math.round(v)}`}
          />
          <Legend
            items={[
              { color: "#a142f4", label: "p99" },
              { color: "#1a73e8", label: "p95" },
              { color: "#fbbc04", label: "p50" },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Changes"
          actions={
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-[#5f6368]">Changes on</span>
              <div className="inline-flex overflow-hidden rounded-md border border-[#bdc1c6]">
                <button
                  type="button"
                  className="bg-[#e8f0fe] px-2 py-1 text-[12.5px] text-[#1a73e8]"
                >
                  This Service
                </button>
                <button
                  type="button"
                  className="border-l border-[#bdc1c6] bg-white px-2 py-1 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
                >
                  + Dependencies
                </button>
              </div>
            </div>
          }
        >
          <div className="flex h-[200px] items-center justify-center text-[12.5px] text-[#5f6368]">
            No changes detected.
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-[#202124]">
      <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
      {title}
    </h2>
  );
}

function SummaryCard({
  label,
  value,
  action,
  children,
  disabled,
}: {
  label: string;
  value: string;
  action: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#5f6368]">
            {label}
          </span>
          <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[10px] font-semibold text-[#5f6368]">
            {value}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex items-center gap-0.5 text-[12px] ${
            disabled
              ? "cursor-not-allowed text-[#9aa0a6]"
              : "text-[#1a73e8] hover:underline"
          }`}
        >
          <Plus size={10} weight="bold" />
          {action.replace("+ ", "")}
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-[#5f6368]">{children}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[13px] text-[#202124]">
            <span className="font-medium">{title}</span>
            <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
          </div>
          {subtitle && (
            <div className="text-[12px] text-[#5f6368]">{subtitle}</div>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="mt-2 flex items-center gap-3 text-[11px] text-[#5f6368]">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
