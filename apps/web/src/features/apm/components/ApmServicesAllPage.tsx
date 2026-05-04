"use client";

import { CaretDown, MagnifyingGlass, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Popover } from "@/features/metrics/components/Popover";
import { useApmServices } from "../hooks";
import { useApmHomeStore } from "../store";
import type { ApmService } from "../types";
import { ApmHeader } from "./ApmHeader";
import { MiniBar } from "./MiniBar";
import { ServiceTypeIcon } from "./ServiceTypeIcon";

const ENV_OPTIONS = ["prod", "staging", "dev"];

type SortKey = "requests" | "errors" | "p50" | "p95" | "p99";

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
  return `${(rate * 100).toFixed(2)}%`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function healthBadge(health: ApmService["health"]) {
  if (health === "critical")
    return { label: "Critical", cls: "bg-[#fce8e6] text-[#d93025]" };
  if (health === "warn")
    return { label: "Warn", cls: "bg-[#fef7e0] text-[#b06000]" };
  return { label: "OK", cls: "bg-[#e6f4ea] text-[#137333]" };
}

export function ApmServicesAllPage() {
  const env = useApmHomeStore((s) => s.envFilter);
  const setEnv = useApmHomeStore((s) => s.setEnvFilter);
  const search = useApmHomeStore((s) => s.serviceSearch);
  const setSearch = useApmHomeStore((s) => s.setServiceSearch);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("requests");
  const { data: services, isLoading, error } = useApmServices(env);

  const filtered = useMemo<ApmService[]>(() => {
    const list = services ?? [];
    const q = search.trim().toLowerCase();
    let matched = q
      ? list.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.team ?? "").toLowerCase().includes(q),
        )
      : list;
    if (typeFilter !== "all")
      matched = matched.filter((s) => s.type === typeFilter);
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
  }, [services, search, typeFilter, sortKey]);

  const maxRps = useMemo(
    () => Math.max(0.1, ...filtered.map((f) => f.requestsPerSec)),
    [filtered],
  );
  const maxLatency = useMemo(
    () => Math.max(1, ...filtered.map((f) => f.p99LatencyMs)),
    [filtered],
  );

  const totals = useMemo(() => {
    const requests = filtered.reduce((acc, s) => acc + s.totalRequests, 0);
    const errors = filtered.reduce((acc, s) => acc + s.totalErrors, 0);
    const errorRate = requests > 0 ? errors / requests : 0;
    return { count: filtered.length, requests, errors, errorRate };
  }, [filtered]);

  const types = useMemo(() => {
    const set = new Set<string>();
    (services ?? []).forEach((s) => set.add(s.type));
    return Array.from(set);
  }, [services]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <ApmHeader />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-6 py-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link
                href="/apm/home"
                className="text-[12px] text-[#1a73e8] hover:underline"
              >
                ← APM Home
              </Link>
              <h1 className="mt-1 text-[20px] font-semibold text-[#202124]">
                Service Catalog
              </h1>
              <p className="text-[12.5px] text-[#5f6368]">
                Throughput, latency p50 / p95 / p99, and error rate for all
                instrumented services. Past 1 hour.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EnvSelect value={env} onChange={setEnv} />
            </div>
          </header>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Services" value={totals.count.toString()} />
            <SummaryCard
              label="Total Requests"
              value={formatCount(totals.requests)}
            />
            <SummaryCard
              label="Total Errors"
              value={formatCount(totals.errors)}
            />
            <SummaryCard
              label="Error Rate"
              value={formatErrorRate(totals.errorRate)}
              tone={
                totals.errorRate > 0.05
                  ? "critical"
                  : totals.errorRate > 0.01
                  ? "warn"
                  : "ok"
              }
            />
          </section>

          <section className="rounded-lg border border-[#e8eaed] bg-white">
            <header className="flex flex-wrap items-center gap-3 border-b border-[#e8eaed] px-4 py-2.5">
              <div className="flex h-7 max-w-[320px] flex-1 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
                <MagnifyingGlass size={13} className="text-[#5f6368]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search services or team"
                  className="w-full bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
                />
              </div>
              <TypeSelect
                value={typeFilter}
                options={["all", ...types]}
                onChange={setTypeFilter}
              />
              <span className="ml-auto text-[12px] text-[#5f6368]">
                {filtered.length} {filtered.length === 1 ? "service" : "services"}
              </span>
            </header>

            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#e8eaed] text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                    <th className="w-8 px-2 py-2 text-left"></th>
                    <th className="w-[80px] px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Service</th>
                    <th className="w-[120px] px-3 py-2 text-left">Team</th>
                    <th className="w-[90px] px-3 py-2 text-left">Health</th>
                    <SortHeader
                      label="Throughput"
                      width={150}
                      active={sortKey === "requests"}
                      onClick={() => setSortKey("requests")}
                    />
                    <SortHeader
                      label="Error Rate"
                      width={140}
                      active={sortKey === "errors"}
                      onClick={() => setSortKey("errors")}
                    />
                    <SortHeader
                      label="P50"
                      width={100}
                      active={sortKey === "p50"}
                      onClick={() => setSortKey("p50")}
                    />
                    <SortHeader
                      label="P95"
                      width={100}
                      active={sortKey === "p95"}
                      onClick={() => setSortKey("p95")}
                    />
                    <SortHeader
                      label="P99"
                      width={140}
                      active={sortKey === "p99"}
                      onClick={() => setSortKey("p99")}
                    />
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
                  {filtered.length === 0 && !isLoading && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-[#5f6368]"
                      >
                        {error
                          ? "Failed to load services."
                          : "No services match the current filters."}
                      </td>
                    </tr>
                  )}
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-[#5f6368]"
                      >
                        Loading services…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  width,
  active,
  onClick,
}: {
  label: string;
  width: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2 text-left" style={{ width }}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${
          active ? "text-[#202124]" : "hover:text-[#202124]"
        }`}
      >
        {active && <span className="font-bold">↓</span>}
        {label}
      </button>
    </th>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "critical";
}) {
  const valueColor =
    tone === "critical"
      ? "text-[#d93025]"
      : tone === "warn"
      ? "text-[#b06000]"
      : tone === "ok"
      ? "text-[#137333]"
      : "text-[#202124]";
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className={`mt-1 text-[20px] font-semibold ${valueColor}`}>
        {value}
      </div>
    </div>
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
  const badge = healthBadge(service.health);
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]">
      <td className="px-2 py-2.5">
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
        {service.description && (
          <div className="mt-0.5 line-clamp-1 text-[11.5px] text-[#5f6368]">
            {service.description}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-[12.5px] text-[#5f6368]">
        {service.team ?? "—"}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div>
          <div className="text-[#202124]">
            {formatRequests(service.requestsPerSec)}{" "}
            <span className="text-[12px] text-[#5f6368]">req/s</span>
          </div>
          <div className="text-[11.5px] text-[#5f6368]">
            {formatCount(service.totalRequests)} total
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
          <div className="text-[11.5px] text-[#5f6368]">
            {formatCount(service.totalErrors)} errors
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
      <td className="px-3 py-2.5 text-[#202124]">
        {formatLatency(service.p50LatencyMs)}
      </td>
      <td className="px-3 py-2.5 text-[#202124]">
        {formatLatency(service.p95LatencyMs)}
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
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
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

function TypeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const label = value === "all" ? "All types" : value;
  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[160px] py-1"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <span className="text-[#5f6368]">type:</span>
          <span>{label}</span>
          <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        </button>
      }
    >
      {({ close }) => (
        <ul>
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt);
                  close();
                }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] ${
                  opt === value
                    ? "bg-[#1a73e8] text-white"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                {opt === "all" ? "All types" : opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
