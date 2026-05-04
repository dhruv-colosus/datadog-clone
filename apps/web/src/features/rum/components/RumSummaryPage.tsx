"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowSquareOut,
  ArrowUp,
  Bug,
  ChartLine,
  ListBullets,
  MagnifyingGlass,
  PencilSimple,
  Pulse,
  SidebarSimple,
  Stack,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  useRumApplications,
  useRumDeployments,
  useRumErrorRate,
  useRumResources,
  useRumSeries,
  useRumSummary,
  useRumTopViews,
  useRumVitals,
} from "../hooks";
import type { RumPerfMetric } from "../types";
import { PerfChart } from "./PerfChart";
import { RumHeader } from "./RumHeader";
import { Sparkline } from "./Sparkline";

type SummaryTab = "Overview" | "Optimize Vitals" | "Frontend Errors" | "Deployments" | "Resources";

const TABS: { id: SummaryTab; label: string; icon: typeof ChartLine }[] = [
  { id: "Overview", label: "Overview", icon: ChartLine },
  { id: "Optimize Vitals", label: "Optimize Vitals", icon: Pulse },
  { id: "Frontend Errors", label: "Frontend Errors", icon: Bug },
  { id: "Deployments", label: "Deployments", icon: Stack },
  { id: "Resources", label: "Resources", icon: ListBullets },
];

const PERF_METRICS: { id: RumPerfMetric; label: string }[] = [
  { id: "loadingTime", label: "Loading Time" },
  { id: "lcp", label: "LCP" },
  { id: "fcp", label: "FCP" },
  { id: "cls", label: "CLS" },
  { id: "inp", label: "INP" },
];

export function RumSummaryPage() {
  const { data: apps = [], isLoading: appsLoading } = useRumApplications();
  const app = apps[0];
  const appId = app?.id;

  const range = useMemo(() => {
    const to = Date.now();
    return { fromMs: to - 24 * 60 * 60 * 1000, toMs: to };
  }, []);

  const [tab, setTab] = useState<SummaryTab>("Overview");
  const [perfMetric, setPerfMetric] = useState<RumPerfMetric>("loadingTime");

  const summary = useRumSummary(appId, range);
  const series = useRumSeries(appId, perfMetric, range);
  const vitals = useRumVitals(appId, range);
  const errorRate = useRumErrorRate(appId, range);
  const deployments = useRumDeployments(appId);
  const resources = useRumResources(appId, range);
  const topViews = useRumTopViews(appId, range);

  const totalViews = summary.data?.totalViews ?? 0;
  const totalSessions = summary.data?.totalSessions ?? 0;
  const viewsChange = summary.data?.viewsChangePct ?? 0;

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <RumHeader range={range} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[220px] flex-shrink-0 overflow-y-auto border-r border-[#e8eaed] bg-white py-3">
          <ul className="flex flex-col gap-0.5 px-2">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] ${
                      active
                        ? "bg-[#e8f0fe] font-medium text-[#1a73e8]"
                        : "text-[#202124] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    <Icon size={14} weight={active ? "fill" : "regular"} />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-[#e8eaed] px-2 pt-3 text-[12.5px] text-[#5f6368]">
            <button className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 hover:bg-[#f1f3f4]">
              <PencilSimple size={13} />
              Edit Application
            </button>
            <button className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 hover:bg-[#f1f3f4]">
              <SidebarSimple size={13} />
              Collapse
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-6 py-5">
            <FilterBar />

            {appsLoading && !app ? (
              <div className="rounded border border-[#dadce0] bg-white py-10 text-center text-[13px] text-[#5f6368]">
                Loading RUM application…
              </div>
            ) : null}

            {tab === "Overview" && (
              <OverviewSection
                perfMetric={perfMetric}
                onMetricChange={setPerfMetric}
                seriesLoading={series.isLoading}
                seriesData={series.data}
                totalViews={totalViews}
                totalSessions={totalSessions}
                viewsChange={viewsChange}
              />
            )}

            {(tab === "Overview" || tab === "Optimize Vitals") && vitals.data ? (
              <OptimizeVitalsSection vitals={vitals.data} />
            ) : null}

            {(tab === "Overview" || tab === "Frontend Errors") && errorRate.data ? (
              <FrontendErrorsSection errorRate={errorRate.data} />
            ) : null}

            {(tab === "Overview" || tab === "Deployments") && deployments.data ? (
              <DeploymentsSection rows={deployments.data} />
            ) : null}

            {(tab === "Overview" || tab === "Resources") && resources.data ? (
              <ResourcePerformanceSection rows={resources.data} />
            ) : null}

            {tab === "Overview" && topViews.data ? (
              <TopViewsSection rows={topViews.data} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function FilterBar() {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[#e8eaed] bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(60,64,67,0.06)]">
      <button className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12.5px] text-[#5f6368] hover:bg-[#f1f3f4]">
        <span>My Teams</span>
        <span
          aria-hidden
          className="inline-flex h-3 w-7 items-center rounded-full bg-[#dadce0] px-0.5"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white shadow" />
        </span>
      </button>
      <span className="text-[#bdc1c6]">|</span>
      {(["Env", "Service", "Version", "Country", "Browser Name"] as const).map(
        (label) => (
          <FilterPill key={label} label={label} />
        ),
      )}
    </div>
  );
}

function FilterPill({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-1 text-[10px] tracking-wide text-[#5f6368]">{label}</span>
      <button className="inline-flex h-7 min-w-[140px] items-center justify-between gap-1.5 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124]">
        All
        <ArrowDown size={10} className="text-[#5f6368]" />
      </button>
    </div>
  );
}

function OverviewSection({
  perfMetric,
  onMetricChange,
  seriesLoading,
  seriesData,
  totalViews,
  totalSessions,
  viewsChange,
}: {
  perfMetric: RumPerfMetric;
  onMetricChange: (m: RumPerfMetric) => void;
  seriesLoading: boolean;
  seriesData: any;
  totalViews: number;
  totalSessions: number;
  viewsChange: number;
}) {
  const cur = (seriesData?.current as any[]) ?? [];
  const prev = (seriesData?.previous as any[]) ?? [];

  return (
    <section className="rounded-md border border-[#e8eaed] bg-white shadow-[0_1px_0_rgba(60,64,67,0.06)]">
      <div className="flex flex-col gap-2.5 border-b border-[#e8eaed] px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-1.5 text-[10px] tracking-wide text-[#5f6368]">
              Select Page
            </div>
            <button className="inline-flex h-7 min-w-[260px] items-center justify-between rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]">
              All
              <ArrowDown size={10} className="text-[#5f6368]" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">Overall Page Performance</h2>
          <div className="inline-flex items-center gap-1 rounded border border-[#dadce0] bg-[#f8f9fb] p-0.5 text-[12px]">
            <span className="px-2 text-[#5f6368]">Group by</span>
            {PERF_METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => onMetricChange(m.id)}
                className={`rounded px-2 py-1 transition ${
                  perfMetric === m.id
                    ? "bg-white font-medium text-[#1a73e8] shadow"
                    : "text-[#5f6368] hover:text-[#202124]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {seriesLoading || cur.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded border border-dashed border-[#dadce0] text-[13px] text-[#5f6368]">
            {seriesLoading ? "Loading…" : "No data available"}
          </div>
        ) : (
          <PerfChart
            current={cur}
            previous={prev}
            thresholds={
              perfMetric === "loadingTime" || perfMetric === "lcp"
                ? { good: 2500, needsImprovement: 4000 }
                : perfMetric === "fcp"
                ? { good: 1800, needsImprovement: 3000 }
                : perfMetric === "inp"
                ? { good: 200, needsImprovement: 500 }
                : undefined
            }
          />
        )}
        <div className="mt-3 flex items-center gap-4 text-[12px] text-[#5f6368]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-[#f4b400]" />
            Needs improvement
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-[#0f9d58]" />
            Good ≤ 2.5s
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-[#db4437]" />
            Poor &gt; 4s
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 border-t border-[#e8eaed] md:grid-cols-[260px_1fr]">
        <div className="flex flex-col items-start gap-1 border-r border-[#e8eaed] px-4 py-4">
          <div className="text-[24px] font-semibold leading-none">
            {totalViews.toLocaleString()}
          </div>
          <div className="text-[12px] text-[#5f6368]">total views</div>
          <div
            className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] ${
              viewsChange >= 0 ? "bg-[#e6f4ea] text-[#0f9d58]" : "bg-[#fce8e6] text-[#db4437]"
            }`}
          >
            {viewsChange >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(viewsChange).toFixed(1)}% from previous day
          </div>
          <div className="mt-2 text-[11.5px] text-[#5f6368]">
            {totalSessions.toLocaleString()} sessions
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[12px] text-[#5f6368]">Current vs. Previous · 1d</div>
          <div className="-mb-1 mt-1.5">
            {seriesData && cur.length > 0 ? (
              <Sparkline
                points={cur.map((p: any) => ({ ts: p.ts, value: p.count ?? p.p75 ?? 0 }))}
                width={1100}
                height={120}
              />
            ) : (
              <div className="flex h-[120px] items-center justify-center text-[12px] text-[#9aa0a6]">
                No data
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function OptimizeVitalsSection({
  vitals,
}: {
  vitals: NonNullable<ReturnType<typeof useRumVitals>["data"]>;
}) {
  const cards: {
    key: keyof typeof vitals;
    label: string;
    unit: string;
    thresholds?: { good: number; needsImprovement: number };
  }[] = [
    { key: "loadingTime", label: "Loading Time", unit: "ms", thresholds: { good: 2500, needsImprovement: 4000 } },
    { key: "lcp", label: "Largest Contentful Paint", unit: "ms", thresholds: { good: 2500, needsImprovement: 4000 } },
    { key: "fcp", label: "First Contentful Paint", unit: "ms", thresholds: { good: 1800, needsImprovement: 3000 } },
    { key: "cls", label: "Cumulative Layout Shift", unit: "" },
    { key: "inp", label: "Interaction To Next Paint", unit: "ms", thresholds: { good: 200, needsImprovement: 500 } },
  ];
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Optimize Vitals</h2>
        <div className="flex items-center gap-2">
          <button className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]">
            <ChartLine size={12} />
            Performance Dashboard
          </button>
          <button className="inline-flex h-7 items-center gap-1 rounded bg-[#1a73e8] px-2 text-[12.5px] text-white hover:bg-[#0058a3]">
            Optimize Vitals
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, label, unit, thresholds }) => {
          const v = vitals[key];
          const value = v?.p75 ?? 0;
          const series = v?.series ?? [];
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-md border border-[#e8eaed] bg-white px-3 py-3 shadow-[0_1px_0_rgba(60,64,67,0.06)]"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] underline decoration-dotted text-[#1a73e8]">
                  {label}
                </span>
                <span className="text-[11px] text-[#9aa0a6]">P75</span>
              </div>
              <div className="text-[20px] font-semibold leading-none">
                {fmtVitalValue(value, unit)}
              </div>
              <Sparkline
                points={series}
                thresholds={thresholds}
                width={260}
                height={64}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FrontendErrorsSection({
  errorRate,
}: {
  errorRate: NonNullable<ReturnType<typeof useRumErrorRate>["data"]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Debug Frontend Errors</h2>
        <div className="flex items-center gap-2">
          <button className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]">
            <ChartLine size={12} />
            Errors Dashboard
          </button>
          <button className="inline-flex h-7 items-center gap-1 rounded bg-[#1a73e8] px-2 text-[12.5px] text-white hover:bg-[#0058a3]">
            View all issues
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[400px_1fr]">
        <div className="rounded-md border-l-4 border-l-[#0f9d58] border border-[#e8eaed] bg-white px-3 py-3 shadow-[0_1px_0_rgba(60,64,67,0.06)]">
          <div className="text-[12.5px] underline decoration-dotted text-[#1a73e8]">Error Rate</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[24px] font-semibold leading-none">
              {errorRate.errorRate.toFixed(1)}%
            </span>
            <span className="text-[11.5px] text-[#0f9d58]">↘ {errorRate.errorViews} error views</span>
          </div>
          <div className="mt-2">
            <Sparkline
              points={errorRate.series.map((p) => ({ ts: p.ts, value: p.errorRate }))}
              width={360}
              height={140}
              thresholds={{ good: 1, needsImprovement: 5 }}
              color="#0f9d58"
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#dadce0] bg-white px-4 py-8 text-[13px] text-[#5f6368]">
          <Bug size={36} weight="duotone" className="text-[#a142f4]" />
          <div className="mt-3">
            {errorRate.errorViews > 0
              ? `${errorRate.errorViews.toLocaleString()} error views in this period`
              : "No issues found"}
          </div>
        </div>
      </div>
    </section>
  );
}

function DeploymentsSection({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof useRumDeployments>["data"]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Track Deployments</h2>
        <div className="flex items-center gap-2">
          <button className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]">
            <ChartLine size={12} />
            Deployments Dashboard
          </button>
          <button className="inline-flex h-7 items-center gap-1 rounded bg-[#1a73e8] px-2 text-[12.5px] text-white hover:bg-[#0058a3]">
            All active versions
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-[#e8eaed] bg-white shadow-[0_1px_0_rgba(60,64,67,0.06)]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[#e8eaed] bg-[#f8f9fb] text-left text-[11px] uppercase tracking-wide text-[#5f6368]">
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 text-right font-medium">Total Sessions</th>
              <th className="px-3 py-2 text-right font-medium">New Issues</th>
              <th className="px-3 py-2 text-right font-medium">Web Vitals P75 Warnings</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#9aa0a6]">
                  <MagnifyingGlass size={32} weight="duotone" className="mx-auto text-[#a142f4]" />
                  <div className="mt-2">No matching results found</div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.service}-${r.version}`} className="border-b border-[#f1f3f4] last:border-b-0">
                  <td className="px-3 py-2 text-[#202124]">{r.service}</td>
                  <td className="px-3 py-2 text-[#5f6368]">{r.version}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.sessions.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.errors.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#9aa0a6]">{r.webVitalsP75Warnings}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResourcePerformanceSection({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof useRumResources>["data"]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">
          Improve Resource Performance{" "}
          <span className="ml-2 text-[12.5px] font-normal text-[#5f6368]">
            <Stack size={12} className="inline" /> Retained session endpoint data
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]">
            <ChartLine size={12} />
            Resources Dashboard
          </button>
          <button className="inline-flex h-7 items-center gap-1 rounded bg-[#1a73e8] px-2 text-[12.5px] text-white hover:bg-[#0058a3]">
            Explore all resources
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-[#e8eaed] bg-white shadow-[0_1px_0_rgba(60,64,67,0.06)]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[#e8eaed] bg-[#f8f9fb] text-left text-[11px] uppercase tracking-wide text-[#5f6368]">
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">URL</th>
              <th className="px-3 py-2 text-right font-medium">Hits</th>
              <th className="px-3 py-2 text-right font-medium">P50</th>
              <th className="px-3 py-2 text-right font-medium">P95</th>
              <th className="px-3 py-2 text-right font-medium">Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#9aa0a6]">
                  No resources captured yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.method}-${r.url}`} className="border-b border-[#f1f3f4] last:border-b-0">
                  <td className="px-3 py-2 font-medium text-[#5f6368]">{r.method}</td>
                  <td className="px-3 py-2">
                    <span className="text-[#1a73e8]">{r.url}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.hits.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.p50LatencyMs.toFixed(0)} ms</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.p95LatencyMs.toFixed(0)} ms</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.errors.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TopViewsSection({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof useRumTopViews>["data"]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Top Views</h2>
        <a
          href="/rum/explorer"
          className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          Open in Explorer
          <ArrowSquareOut size={12} />
        </a>
      </div>
      <div className="overflow-hidden rounded-md border border-[#e8eaed] bg-white shadow-[0_1px_0_rgba(60,64,67,0.06)]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[#e8eaed] bg-[#f8f9fb] text-left text-[11px] uppercase tracking-wide text-[#5f6368]">
              <th className="px-3 py-2 font-medium">Path</th>
              <th className="px-3 py-2 text-right font-medium">Views</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
              <th className="px-3 py-2 text-right font-medium">Loading P75</th>
              <th className="px-3 py-2 text-right font-medium">LCP P75</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path} className="border-b border-[#f1f3f4] last:border-b-0">
                <td className="px-3 py-2 text-[#1a73e8]">{r.path}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.views.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sessions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.loadingTimeP75Ms.toFixed(0)} ms</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.lcpP75Ms.toFixed(0)} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fmtVitalValue(v: number, unit: string): string {
  if (!v && v !== 0) return "—";
  if (unit === "ms") {
    if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
    return `${v.toFixed(0)} ms`;
  }
  if (unit === "%") return `${v.toFixed(1)}%`;
  return v.toFixed(3);
}
