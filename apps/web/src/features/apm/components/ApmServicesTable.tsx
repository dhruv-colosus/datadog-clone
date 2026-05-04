"use client";

import {
  CaretDown,
  Funnel,
  MagnifyingGlass,
  Star,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Popover } from "@/features/metrics/components/Popover";
import { useApmServices } from "../hooks";
import { useApmHomeStore } from "../store";
import type { ApmService } from "../types";
import { MiniBar } from "./MiniBar";
import { ServiceTypeIcon } from "./ServiceTypeIcon";

const ENV_OPTIONS = ["prod", "staging", "dev"];

function formatRequests(rps: number): string {
  if (rps < 0.1) return "< 0.1";
  if (rps < 10) return rps.toFixed(1);
  return Math.round(rps).toString();
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${Math.round(ms)}ms`;
  return `${ms.toFixed(1)}ms`;
}

function formatErrorRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatDeploy(min: number | null): string {
  if (min === null) return "";
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}

export function ApmServicesTable() {
  const env = useApmHomeStore((s) => s.envFilter);
  const setEnv = useApmHomeStore((s) => s.setEnvFilter);
  const search = useApmHomeStore((s) => s.serviceSearch);
  const setSearch = useApmHomeStore((s) => s.setServiceSearch);
  const [sortKey, setSortKey] = useState<
    "requests" | "errors" | "p50" | "p95" | "p99"
  >("requests");
  const { data: services } = useApmServices(env);

  const filtered = useMemo<ApmService[]>(() => {
    const list = services ?? [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? list.filter((s) => s.name.toLowerCase().includes(q))
      : list;
    const sorted = [...matched];
    if (sortKey === "requests")
      sorted.sort((a, b) => b.requestsPerSec - a.requestsPerSec);
    else if (sortKey === "errors")
      sorted.sort(
        (a, b) =>
          (b.errorRate ?? -1) - (a.errorRate ?? -1) ||
          b.totalErrors - a.totalErrors,
      );
    else if (sortKey === "p50")
      sorted.sort((a, b) => b.p50LatencyMs - a.p50LatencyMs);
    else if (sortKey === "p95")
      sorted.sort((a, b) => b.p95LatencyMs - a.p95LatencyMs);
    else sorted.sort((a, b) => b.p99LatencyMs - a.p99LatencyMs);
    return sorted;
  }, [services, search, sortKey]);

  const maxRps = useMemo(
    () => Math.max(0.1, ...filtered.map((f) => f.requestsPerSec)),
    [filtered],
  );
  const maxLatency = useMemo(
    () => Math.max(1, ...filtered.map((f) => f.p99LatencyMs)),
    [filtered],
  );

  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center gap-3 border-b border-[#e8eaed] px-4 py-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f1f3f4] px-2 py-1 text-[12.5px] text-[#202124]">
          <Funnel size={12} className="text-[#5f6368]" />
          <span className="font-medium">APM Services</span>
        </div>
        <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#5f6368]">
          1h
        </span>
        <span className="text-[12.5px] text-[#5f6368]">Past 1 Hour</span>

        <div className="ml-3 flex h-7 max-w-[280px] flex-1 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
          <MagnifyingGlass size={13} className="text-[#5f6368]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services"
            className="w-full bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <EnvSelect value={env} onChange={setEnv} />
          <Link
            href="/apm/services"
            className="text-[12.5px] text-[#1a73e8] hover:underline"
          >
            View All →
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e8eaed] text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
              <th className="w-8 px-3 py-2 text-left">
                <CaretDown size={11} weight="bold" />
              </th>
              <th className="w-8 px-1 py-2 text-left">
                <Star size={12} weight="fill" className="text-[#5f6368]" />
              </th>
              <th className="w-[80px] px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Service</th>
              <th className="w-[120px] px-3 py-2 text-left">Last Deploy</th>
              <th className="w-[140px] px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => setSortKey("requests")}
                  className={`inline-flex items-center gap-1 ${
                    sortKey === "requests"
                      ? "text-[#202124]"
                      : "hover:text-[#202124]"
                  }`}
                >
                  <span className="font-bold">↓²</span> Requests
                </button>
              </th>
              <th className="w-[120px] px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => setSortKey("errors")}
                  className="hover:text-[#202124]"
                >
                  Error Rate
                </button>
              </th>
              <th className="w-[110px] px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => setSortKey("p50")}
                  className={
                    sortKey === "p50"
                      ? "text-[#202124]"
                      : "hover:text-[#202124]"
                  }
                >
                  P50 Latency
                </button>
              </th>
              <th className="w-[110px] px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => setSortKey("p95")}
                  className={
                    sortKey === "p95"
                      ? "text-[#202124]"
                      : "hover:text-[#202124]"
                  }
                >
                  P95 Latency
                </button>
              </th>
              <th className="w-[140px] px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => setSortKey("p99")}
                  className={
                    sortKey === "p99"
                      ? "text-[#202124]"
                      : "hover:text-[#202124]"
                  }
                >
                  P99 Latency
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                maxRps={maxRps}
                maxLatency={maxLatency}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[#5f6368]">
                  No services match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ServiceRow({
  service,
  maxRps,
  maxLatency,
}: {
  service: ApmService;
  maxRps: number;
  maxLatency: number;
}) {
  const [starred, setStarred] = useState(Boolean(service.starred));
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]">
      <td className="px-3 py-2.5"></td>
      <td className="px-1 py-2.5">
        <button
          type="button"
          onClick={() => setStarred((v) => !v)}
          aria-label={starred ? "Unstar service" : "Star service"}
          className="text-[#bdc1c6] hover:text-[#fbbc04]"
        >
          <Star
            size={14}
            weight={starred ? "fill" : "regular"}
            className={starred ? "text-[#fbbc04]" : ""}
          />
        </button>
      </td>
      <td className="px-3 py-2.5">
        <ServiceTypeIcon type={service.type} />
      </td>
      <td className="px-3 py-2.5">
        <Link
          href={`/apm/services/${service.id}`}
          className="font-medium text-[#202124] hover:underline"
        >
          {service.name}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        {service.lastDeployMinutesAgo !== null && (
          <span className="text-[#1a73e8] hover:underline">
            {formatDeploy(service.lastDeployMinutesAgo)}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div>
          <div className="text-[#202124]">
            {formatRequests(service.requestsPerSec)}{" "}
            <span className="text-[12px] text-[#5f6368]">req/s</span>
          </div>
          <MiniBar value={service.requestsPerSec} max={maxRps} color="#1a73e8" />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div>
          <div
            className={
              service.errorRate && service.errorRate > 0
                ? "text-[#d93025]"
                : "text-[#5f6368]"
            }
          >
            {formatErrorRate(service.errorRate)}
          </div>
          <MiniBar
            value={service.errorRate ?? 0}
            max={1}
            color={
              service.errorRate && service.errorRate > 0
                ? "#d93025"
                : "#1a73e8"
            }
          />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[#202124]">
          {formatLatency(service.p50LatencyMs)}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[#202124]">
          {formatLatency(service.p95LatencyMs)}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div>
          <div className="text-[#202124]">
            {formatLatency(service.p99LatencyMs)}
          </div>
          <MiniBar
            value={service.p99LatencyMs}
            max={maxLatency}
            color="#1a73e8"
          />
        </div>
      </td>
    </tr>
  );
}

function EnvSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Popover
      placement="bottom-end"
      panelClassName="w-[160px] py-1"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <span className="text-[#5f6368]">env:</span>
          <span>{value}</span>
          <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        </button>
      }
    >
      {({ close }) => (
        <ul>
          {ENV_OPTIONS.map((env) => (
            <li key={env}>
              <button
                type="button"
                onClick={() => {
                  onChange(env);
                  close();
                }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] ${
                  env === value
                    ? "bg-[#1a73e8] text-white"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                env:{env}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
