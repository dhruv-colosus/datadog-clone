"use client";

import {
  Binoculars,
  CaretDown,
  CaretRight,
  CornersOut,
  Funnel,
  Gear,
  Globe,
  MagnifyingGlass,
  Plus,
  Question,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
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
import { useWatchdogStories } from "../hooks";
import type {
  WatchdogSeverity,
  WatchdogStatus,
  WatchdogStory,
} from "../types";
import { WatchdogStoryDrawer } from "./WatchdogStoryDrawer";

const KIND_LABEL: Record<string, string> = {
  anomaly: "APM ERROR RATE",
  outlier: "APM OUTLIER",
  deployment_regression: "APM REGRESSION",
  deviation: "APM DEVIATION",
};

const STATUS_DOT: Record<WatchdogStatus, string> = {
  active: "#d32f2f",
  acknowledged: "#1e88e5",
  resolved: "#137333",
};

const STATUS_LABEL: Record<WatchdogStatus, string> = {
  active: "ONGOING",
  acknowledged: "ACKNOWLEDGED",
  resolved: "RESOLVED",
};

const SERVICE_COLORS: Record<string, string> = {
  web: "#7c3aed",
  api: "#1e88e5",
  auth: "#0d9488",
  payments: "#ec4899",
  worker: "#f59e0b",
  caddy: "#64748b",
  postgres: "#2563eb",
  redis: "#dc2626",
};

function serviceColor(service: string): string {
  return SERVICE_COLORS[service] ?? "#5f6368";
}

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

export function WatchdogList() {
  const { data: stories, isLoading } = useWatchdogStories();

  const [search, setSearch] = useState("");
  const [showControls, setShowControls] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Facet selections (multi-select per facet group; all selected by default)
  const [catSel, setCatSel] = useState<Set<string>>(new Set(["APM"]));
  const [typeSel, setTypeSel] = useState<Set<string>>(
    new Set(["anomaly", "outlier", "deployment_regression", "deviation"]),
  );
  const [statusSel, setStatusSel] = useState<Set<WatchdogStatus>>(
    new Set(["active", "acknowledged", "resolved"]),
  );
  const [envSel, setEnvSel] = useState<Set<string>>(new Set(["prod"]));
  const [svcSel, setSvcSel] = useState<Set<string>>(new Set());
  const [rootCauseSel, setRootCauseSel] = useState<Set<string>>(
    new Set(["Undefined"]),
  );

  // Auto-select all services when summary loads (so the facet starts checked)
  useEffect(() => {
    if (!stories) return;
    if (svcSel.size > 0) return;
    const all = new Set(stories.map((s) => s.service));
    if (all.size > 0) setSvcSel(all);
  }, [stories, svcSel.size]);

  const filtered = useMemo(() => {
    if (!stories) return [];
    return stories.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${s.title} ${s.service} ${s.metric ?? ""} ${s.narrative}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (typeSel.size && !typeSel.has(s.kind)) return false;
      if (statusSel.size && !statusSel.has(s.status)) return false;
      if (svcSel.size && !svcSel.has(s.service)) return false;
      return true;
    });
  }, [stories, search, typeSel, statusSel, svcSel]);

  const facetCounts = useMemo(() => {
    const cat = { APM: 0, Infrastructure: 0, Logs: 0, "Third Party": 0 };
    const type = { anomaly: 0, outlier: 0, deployment_regression: 0, deviation: 0 };
    const status = { active: 0, acknowledged: 0, resolved: 0 };
    const svc = new Map<string, number>();
    const env = { prod: 0 };
    for (const s of stories ?? []) {
      cat.APM += 1;
      type[s.kind] = (type[s.kind] ?? 0) + 1;
      status[s.status] = (status[s.status] ?? 0) + 1;
      svc.set(s.service, (svc.get(s.service) ?? 0) + 1);
      env.prod += 1;
    }
    return { cat, type, status, svc, env };
  }, [stories]);

  const openStory = useMemo(
    () => filtered.find((s) => s.id === openId) ?? stories?.find((s) => s.id === openId) ?? null,
    [openId, filtered, stories],
  );

  return (
    <div
      data-testid="watchdog-page"
      className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]"
    >
      {!bannerDismissed && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#1e88e5] via-[#7c3aed] to-[#c026d3] px-4 py-2 text-white">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <Gear size={14} weight="bold" />
          </span>
          <span className="text-[13px] font-medium">
            Watchdog is calibrating…
          </span>
          <a
            href="#"
            className="text-[13px] font-medium underline-offset-2 hover:underline"
          >
            See Details
          </a>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="ml-auto text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* Title + Views/My View tabs + time range picker */}
      <div className="border-b border-[#e8eaed] bg-white">
        <div className="flex items-center gap-2 px-5 py-3">
          <Binoculars size={22} className="text-[#202124]" />
          <h1 className="text-[18px] font-semibold tracking-tight">
            Datadog Watchdog
          </h1>
          <button
            type="button"
            aria-label="Help"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Question size={13} weight="bold" />
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-[#e8eaed] px-5 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
            >
              <CaretRight size={12} weight="bold" />
              Views
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-[12.5px] font-medium text-[#202124] hover:bg-[#f1f3f4]"
            >
              My View
            </button>
          </div>
          <TimeRangePill />
        </div>
      </div>

      {/* Filter alerts global search */}
      <div className="border-b border-[#e8eaed] bg-white px-5 py-2.5">
        <div className="flex h-8 items-center gap-2 rounded-md border border-[#dadce0] bg-white px-2.5">
          <MagnifyingGlass size={13} className="text-[#5f6368]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter alerts"
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[#9aa0a6]"
          />
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left facet rail */}
        <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[#e8eaed] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8eaed] px-3 py-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#202124]"
            >
              <CaretRight size={11} weight="bold" />
              My Teams
            </button>
            <Toggle />
          </div>
          <div className="border-b border-[#e8eaed] px-3 py-2">
            <div className="flex h-7 items-center gap-2 rounded border border-[#dadce0] bg-white px-2">
              <MagnifyingGlass size={12} className="text-[#5f6368]" />
              <input
                placeholder="Search facets"
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#9aa0a6]"
              />
            </div>
          </div>

          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
            <button className="flex w-full items-center gap-1.5">
              <CaretDown size={10} weight="bold" />
              ALL ALERTS
            </button>
          </div>

          <FacetGroup title="Alert Category" defaultOpen>
            <FacetItem
              label="APM"
              count={facetCounts.cat.APM}
              checked={catSel.has("APM")}
              color="#7c3aed"
              onToggle={() => toggleSet(setCatSel, "APM")}
            />
            <FacetItem
              label="Infrastructure"
              count={facetCounts.cat.Infrastructure}
              checked={catSel.has("Infrastructure")}
              color="#1e88e5"
              onToggle={() => toggleSet(setCatSel, "Infrastructure")}
            />
            <FacetItem
              label="Logs"
              count={facetCounts.cat.Logs}
              checked={catSel.has("Logs")}
              color="#f59e0b"
              onToggle={() => toggleSet(setCatSel, "Logs")}
            />
            <FacetItem
              label="Third Party"
              count={facetCounts.cat["Third Party"]}
              checked={catSel.has("Third Party")}
              color="#64748b"
              onToggle={() => toggleSet(setCatSel, "Third Party")}
            />
          </FacetGroup>

          <FacetGroup title="Alert Type" defaultOpen>
            <FacetItem
              label="Error Rate"
              count={facetCounts.type.anomaly}
              checked={typeSel.has("anomaly")}
              onToggle={() => toggleSet(setTypeSel, "anomaly")}
            />
            <FacetItem
              label="Outlier"
              count={facetCounts.type.outlier}
              checked={typeSel.has("outlier")}
              onToggle={() => toggleSet(setTypeSel, "outlier")}
            />
            <FacetItem
              label="Deploy Regression"
              count={facetCounts.type.deployment_regression}
              checked={typeSel.has("deployment_regression")}
              onToggle={() => toggleSet(setTypeSel, "deployment_regression")}
            />
            <FacetItem
              label="Deviation"
              count={facetCounts.type.deviation}
              checked={typeSel.has("deviation")}
              onToggle={() => toggleSet(setTypeSel, "deviation")}
            />
          </FacetGroup>

          <FacetGroup title="Alert Status" defaultOpen>
            <FacetItem
              label="Ongoing"
              count={facetCounts.status.active}
              checked={statusSel.has("active")}
              colorBar="#d32f2f"
              onToggle={() => toggleSet(setStatusSel, "active" as WatchdogStatus)}
            />
            <FacetItem
              label="Expired"
              count={facetCounts.status.acknowledged}
              checked={statusSel.has("acknowledged")}
              colorBar="#9aa0a6"
              onToggle={() =>
                toggleSet(setStatusSel, "acknowledged" as WatchdogStatus)
              }
            />
            <FacetItem
              label="Resolved"
              count={facetCounts.status.resolved}
              checked={statusSel.has("resolved")}
              colorBar="#137333"
              onToggle={() => toggleSet(setStatusSel, "resolved" as WatchdogStatus)}
            />
          </FacetGroup>

          <FacetGroup title="Env" defaultOpen>
            <FacetItem
              label="prod"
              count={facetCounts.env.prod}
              checked={envSel.has("prod")}
              onToggle={() => toggleSet(setEnvSel, "prod")}
            />
          </FacetGroup>

          <FacetGroup title="Service" defaultOpen>
            {Array.from(facetCounts.svc.entries()).map(([svc, c]) => (
              <FacetItem
                key={svc}
                label={svc}
                count={c}
                checked={svcSel.has(svc)}
                colorBar={serviceColor(svc)}
                onToggle={() => toggleSet(setSvcSel, svc)}
              />
            ))}
          </FacetGroup>

          <FacetGroup title="Root Cause" defaultOpen>
            <FacetItem
              label="Undefined"
              count={facetCounts.cat.APM}
              checked={rootCauseSel.has("Undefined")}
              onToggle={() => toggleSet(setRootCauseSel, "Undefined")}
            />
          </FacetGroup>
        </aside>

        {/* Main: alerts list */}
        <main className="flex-1 overflow-y-auto bg-[#f8f9fb]">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#e8eaed] bg-white px-5 py-2.5">
            <button
              type="button"
              onClick={() => setShowControls(!showControls)}
              className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12.5px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
            >
              <Funnel size={12} weight="bold" />
              {showControls ? "Hide Controls" : "Show Controls"}
            </button>
            <span className="text-[#dadce0]">|</span>
            <span className="text-[12.5px] font-semibold text-[#202124]">
              {isLoading
                ? "Loading…"
                : `${filtered.length} recent alerts found`}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2.5 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
              >
                <CornersOut size={12} />
                Save to Dashboard
              </button>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded border border-[#dadce0] bg-white px-2.5 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
              >
                More…
                <CaretDown size={10} />
              </button>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded bg-[#1a73e8] px-2.5 text-[12px] font-medium text-white hover:bg-[#1864c1]"
              >
                <Plus size={12} weight="bold" />
                New Monitor
              </button>
            </div>
          </div>

          <div className="space-y-0">
            {!isLoading && filtered.length === 0 && (
              <div className="m-5 rounded border border-dashed border-[#dadce0] bg-white py-16 text-center text-[12.5px] text-[#5f6368]">
                No alerts match the current facets.
              </div>
            )}
            {filtered.map((s) => (
              <AlertCard
                key={s.id}
                story={s}
                onOpen={() => setOpenId(s.id)}
              />
            ))}
          </div>
        </main>
      </div>

      {openStory && (
        <WatchdogStoryDrawer
          story={openStory}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function toggleSet<T>(
  setter: React.Dispatch<React.SetStateAction<Set<T>>>,
  v: T,
) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  });
}

function Toggle() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOn((o) => !o)}
      className="relative inline-flex h-4 w-7 items-center rounded-full transition"
      style={{ background: on ? "#1a73e8" : "#dadce0" }}
      aria-pressed={on}
    >
      <span
        className="absolute h-3 w-3 rounded-full bg-white transition"
        style={{ left: on ? 14 : 2 }}
      />
    </button>
  );
}

function FacetGroup({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-[#f1f3f4] px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-[12.5px] font-semibold text-[#202124]"
      >
        {open ? (
          <CaretDown size={11} weight="bold" />
        ) : (
          <CaretRight size={11} weight="bold" />
        )}
        {title}
      </button>
      {open && <div className="mt-1.5 space-y-0.5">{children}</div>}
    </div>
  );
}

function FacetItem({
  label,
  count,
  checked,
  color,
  colorBar,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  color?: string;
  colorBar?: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-[#f8f9fb]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 cursor-pointer accent-[#1a73e8]"
      />
      {colorBar && (
        <span
          className="inline-block h-3 w-1 rounded-sm"
          style={{ background: colorBar }}
        />
      )}
      {color && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: color }}
        />
      )}
      <span className="flex-1 text-[12.5px] text-[#202124]">{label}</span>
      <span className="text-[11.5px] tabular-nums text-[#5f6368]">{count}</span>
    </label>
  );
}

function TimeRangePill() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="text-right text-[10.5px] leading-tight text-[#5f6368]">
        UTC+05:30
      </div>
      <div className="flex h-7 items-center gap-2 rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#202124]">
        <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums">
          1w
        </span>
        <span className="tabular-nums">
          {fmtRange(Date.now() - 7 * 24 * 3600 * 1000, Date.now())}
        </span>
        <CaretDown size={10} className="text-[#5f6368]" />
      </div>
    </div>
  );
}

function AlertCard({
  story,
  onOpen,
}: {
  story: WatchdogStory;
  onOpen: () => void;
}) {
  const points = story.evidence.points ?? [];
  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ts: p.ts,
        v: p.value,
      })),
    [points],
  );
  const peakTs = useMemo(() => {
    let bestIdx = -1;
    let best = -Infinity;
    for (let i = 0; i < chartData.length; i++) {
      const v = chartData[i].v;
      if (v != null && v > best) {
        best = v;
        bestIdx = i;
      }
    }
    return bestIdx >= 0 ? chartData[bestIdx].ts : null;
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

  const tags = useMemo(() => {
    const tagList: { k: string; v: string }[] = [
      { k: "env", v: "prod" },
      {
        k: "resource_hash",
        v: shortHash(story.id),
      },
    ];
    if (story.metric) {
      tagList.push({ k: "resource_name", v: story.metric });
    }
    return tagList;
  }, [story.id, story.metric]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="grid cursor-pointer grid-cols-[1fr_minmax(360px,520px)] gap-6 border-b border-[#e8eaed] bg-white px-5 py-4 hover:bg-[#fafbfc]"
    >
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={story.status} />
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#5f6368]">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-[#7c3aed] text-white">
              <Warning size={9} weight="bold" />
            </span>
            {KIND_LABEL[story.kind] ?? "APM ALERT"}
          </span>
        </div>
        <div className="text-[16px] font-semibold leading-snug text-[#202124]">
          {humanTitle(story)}{" "}
          <ServiceTag service={story.service} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {tags.slice(0, 3).map((t) => (
            <Tag key={t.k} k={t.k} v={t.v} />
          ))}
          {tags.length > 3 && (
            <span className="inline-flex h-5 items-center rounded border border-[#dadce0] bg-white px-1.5 text-[10.5px] font-medium text-[#5f6368]">
              +{tags.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-end gap-2 text-[11.5px] text-[#5f6368]">
          <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 font-medium tabular-nums text-[#202124]">
            {fmtDurationMin(story.startedMs, story.endedMs)}
          </span>
          <span className="tabular-nums">
            {fmtRange(story.startedMs, story.endedMs)}
          </span>
          <button
            type="button"
            aria-label="Save"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
            onClick={(e) => e.stopPropagation()}
          >
            <CornersOut size={11} />
          </button>
        </div>
        <div className="mt-1 text-[10.5px] text-[#5f6368]">Error rate</div>
        <div className="h-[110px]">
          {chartData.length > 1 ? (
            <ResponsiveContainer>
              <AreaChart
                data={chartData}
                margin={{ top: 14, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`spike-${story.id}`}
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
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 10, fill: "#9aa0a6" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  }
                  minTickGap={48}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#9aa0a6" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  domain={[0, "dataMax"]}
                  tickCount={3}
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
                      fontSize: 10,
                      offset: 4,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#d32f2f"
                  strokeWidth={1.6}
                  fill={`url(#spike-${story.id})`}
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
            <div className="flex h-full items-center justify-center text-[11px] text-[#9aa0a6]">
              No evidence series
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WatchdogStatus }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
      style={{
        background:
          status === "resolved"
            ? "#e1f3e6"
            : status === "active"
              ? "#fde7e7"
              : "#e6f0fa",
        color: STATUS_DOT[status],
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ServiceTag({ service }: { service: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline text-[12.5px] font-medium"
      style={{
        background: `${serviceColor(service)}1a`,
        color: serviceColor(service),
      }}
    >
      <Globe size={11} weight="fill" />
      {service}
    </span>
  );
}

function Tag({ k, v }: { k: string; v: string }) {
  const display =
    v.length > 22 ? `${v.slice(0, 18)}…` : v;
  return (
    <span className="inline-flex h-5 items-center rounded bg-[#f1f3f4] px-1.5 text-[11px] text-[#5f6368]">
      <span className="font-medium text-[#202124]">{k}</span>
      <span className="px-0.5 text-[#9aa0a6]">:</span>
      <span className="font-mono text-[#1a73e8]">{display}</span>
    </span>
  );
}

function shortHash(id: string): string {
  // Take alphanumerics from uuid for a deterministic 14-char hex-like hash
  const hex = id.replace(/-/g, "");
  return hex.slice(0, 14);
}

function humanTitle(story: WatchdogStory): string {
  // Match "Error rate increased on one resource in" / "Error rate increased on the POST /500 resource in"
  if (story.kind === "anomaly" && story.metric) {
    if (/error|failure|500/.test(story.metric)) {
      return "Error rate increased on the POST /500 resource in";
    }
    if (/latency/.test(story.metric)) {
      return "Latency increased on one resource in";
    }
  }
  if (story.kind === "deployment_regression") {
    return "Deployment regression detected on";
  }
  if (story.kind === "outlier") {
    return "Outlier detected on";
  }
  return "Error rate increased on one resource in";
}

// Re-export for the drawer
export { humanTitle, shortHash };
export type { WatchdogSeverity, WatchdogStatus };
