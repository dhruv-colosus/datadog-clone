"use client";

import { ArrowRight, CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";
import { useApmServiceMap } from "../hooks";
import { useApmHomeStore, useApmTracesStore } from "../store";
import type { ApmService, ApmServiceMapEdge } from "../types";

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

const SERVICE_DOT: Record<string, string> = {
  caddy: "bg-[#10b981]",
  web: "bg-[#a8c5f7]",
  api: "bg-[#a142f4]",
  auth: "bg-[#34a853]",
  payments: "bg-[#fbbc04]",
  worker: "bg-[#f59e0b]",
  postgres: "bg-[#1a73e8]",
  redis: "bg-[#e8b3a8]",
};

export function ServiceDependenciesTab({ service }: { service: ApmService }) {
  const env = useApmHomeStore((s) => s.envFilter);
  const range = useApmTracesStore((s) => s.timeRange);
  const lookback = Math.max(
    60,
    Math.min(86400, Math.round((range.toMs - range.fromMs) / 1000)),
  );
  const { data, isLoading } = useApmServiceMap(env, lookback);

  const { upstreams, downstreams } = useMemo(() => {
    const upstreams: ApmServiceMapEdge[] = [];
    const downstreams: ApmServiceMapEdge[] = [];
    if (!data) return { upstreams, downstreams };
    for (const e of data.edges) {
      if (e.callee === service.id) upstreams.push(e);
      if (e.caller === service.id) downstreams.push(e);
    }
    upstreams.sort((a, b) => b.calls - a.calls);
    downstreams.sort((a, b) => b.calls - a.calls);
    return { upstreams, downstreams };
  }, [data, service.id]);

  const nodeStats = useMemo(() => {
    if (!data) return null;
    return data.nodes.find((n) => n.service === service.id) ?? null;
  }, [data, service.id]);

  return (
    <div className="flex-1 overflow-auto bg-[#f8f9fb] p-5">
      <h2 className="mb-3 inline-flex items-center gap-2 text-[14px] font-semibold text-[#202124]">
        <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
        Dependencies
      </h2>

      {isLoading && (
        <div className="rounded-lg border border-[#e8eaed] bg-white p-4 text-[13px] text-[#5f6368]">
          Loading dependencies…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Stat
              label="Inbound services"
              value={String(upstreams.length)}
            />
            <Stat
              label="Outbound services"
              value={String(downstreams.length)}
            />
            <Stat
              label={`${service.name} p95`}
              value={formatLatency(nodeStats?.p95LatencyMs ?? 0)}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DepCard
              title="Inbound (callers)"
              edges={upstreams}
              direction="in"
              focus={service.id}
            />
            <DepCard
              title="Outbound (callees)"
              edges={downstreams}
              direction="out"
              focus={service.id}
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-[#e8eaed] bg-white px-4 py-3 text-[12.5px]">
            <span className="text-[#5f6368]">
              See the full topology in the{" "}
              <Link
                href="/apm/service-map"
                className="text-[#1a73e8] hover:underline"
              >
                Service Map
              </Link>
              .
            </span>
            <Link
              href="/apm/service-map"
              className="inline-flex items-center gap-1 text-[#1a73e8] hover:underline"
            >
              Open Service Map <ArrowRight size={11} weight="bold" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold text-[#202124]">
        {value}
      </div>
    </div>
  );
}

function DepCard({
  title,
  edges,
  direction,
  focus,
}: {
  title: string;
  edges: ApmServiceMapEdge[];
  direction: "in" | "out";
  focus: string;
}) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white p-3">
      <div className="mb-2 text-[13px] font-semibold text-[#202124]">
        {title}
      </div>
      {edges.length === 0 ? (
        <p className="text-[12.5px] text-[#5f6368]">
          No traffic observed in this window.
        </p>
      ) : (
        <ul className="divide-y divide-[#f1f3f4]">
          {edges.map((e) => {
            const other = direction === "in" ? e.caller : e.callee;
            const errorRate = e.calls > 0 ? e.errors / e.calls : 0;
            return (
              <li
                key={`${e.caller}-${e.callee}`}
                className="flex items-center gap-3 py-2 text-[12.5px]"
              >
                <span
                  className={`h-3 w-1 rounded-sm ${
                    SERVICE_DOT[other] ?? "bg-[#5f6368]"
                  }`}
                />
                <Link
                  href={`/apm/services/${other}`}
                  className="flex-1 truncate font-medium text-[#202124] hover:underline"
                >
                  {direction === "in" ? `${other} → ${focus}` : `${focus} → ${other}`}
                </Link>
                <span className="text-[#5f6368]">
                  {e.calls.toLocaleString()} calls
                </span>
                <span
                  className={
                    errorRate > 0.05
                      ? "text-[#d93025]"
                      : errorRate > 0
                      ? "text-[#fbbc04]"
                      : "text-[#5f6368]"
                  }
                >
                  {(errorRate * 100).toFixed(1)}% err
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
