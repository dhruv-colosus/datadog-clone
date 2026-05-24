"use client";

import {
  ArrowRight,
  ArrowsOut,
  CaretDown,
  CaretLeft,
  CaretRight,
  Cloud,
  Code,
  DotsThree,
  Download,
  FunnelSimple,
  Gear,
  MagnifyingGlass,
  Plus,
  Sparkle,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type CostRollup,
  type CostType,
  type ExplorerResponse,
  queryExplorer,
} from "../api";

type TopTab = { id: string; label: string; caret?: boolean };
const TOP_TABS: TopTab[] = [
  { id: "overview", label: "Overview" },
  { id: "containers", label: "Containers" },
  { id: "recommendations", label: "Recommendations", caret: true },
  { id: "explorer", label: "Explorer" },
  { id: "dashboards", label: "Dashboards", caret: true },
];

const COST_TYPE_LABELS: Record<CostType, string> = {
  amortized: "Amortized",
  blended: "Blended",
  unblended: "Unblended",
};

const ROLLUP_LABELS: Record<CostRollup, string> = {
  "1d": "1d",
  "1w": "1w",
  "1mo": "1mo",
};

const DATE_PRESETS = [
  { id: "7d", label: "Past 7 Days", short: "1w", days: 7 },
  { id: "14d", label: "Past 14 Days", short: "2w", days: 14 },
  { id: "30d", label: "Past 30 Days", short: "1mo", days: 30 },
  { id: "60d", label: "Past 2 Months", short: "2mo", days: 60 },
  { id: "90d", label: "Past 90 Days", short: "3mo", days: 90 },
];

const PROVIDER_OPTIONS = [
  { id: "aws", label: "AWS" },
  { id: "azure", label: "Azure" },
  { id: "gcp", label: "Google" },
];

const COST_TYPE_OPTIONS = [
  { id: "amortized", label: "Amortized" },
  { id: "blended", label: "Blended" },
  { id: "unblended", label: "Unblended" },
];

const ENABLED_OPTIONS = [
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" },
];

const SERVICE_OPTIONS = [
  { id: "", label: "All" },
  { id: "web", label: "web" },
  { id: "api", label: "api" },
  { id: "auth", label: "auth" },
  { id: "payments", label: "payments" },
  { id: "worker", label: "worker" },
  { id: "caddy", label: "caddy" },
  { id: "postgres", label: "postgres" },
  { id: "redis", label: "redis" },
];

const TEAM_OPTIONS = [
  { id: "", label: "All" },
  { id: "platform", label: "platform" },
  { id: "web", label: "web" },
  { id: "infra", label: "infra" },
  { id: "security", label: "security" },
  { id: "payments", label: "payments" },
];

// Datadog-style color rotation for stacked bars / legend chips.
const COLORS = [
  "#7baaf7",
  "#a5c0ed",
  "#1a73e8",
  "#3b78e7",
  "#4285f4",
  "#5985e0",
  "#669df6",
  "#185abc",
  "#1967d2",
  "#aecbfa",
  "#8ab4f8",
  "#1565c0",
];

function fmtUsd(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return "$0";
  const abs = Math.abs(n);
  if (opts.compact !== false) {
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
    if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  }
  return `$${n.toFixed(2)}`;
}

function fmtCell(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtRange(startISO: string, endISO: string): string {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  const m = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  return `${m(start).toUpperCase()} ${day(start)} - ${m(end).toUpperCase()} ${day(end)}`;
}

function fmtShortDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const m = d
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  return `${m}-${d.getUTCDate()}`;
}

function colorFor(idx: number): string {
  return COLORS[idx % COLORS.length];
}

export function CostExplorer() {
  const [providers, setProviders] = useState<string[]>(["aws", "azure", "gcp"]);
  const [costType, setCostType] = useState<CostType>("amortized");
  const [containerAllocated, setContainerAllocated] = useState(true);
  const [usageChargesOnly, setUsageChargesOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<string[]>(["provider", "service"]);
  const [rollup, setRollup] = useState<CostRollup>("1d");
  const [datePresetId, setDatePresetId] = useState<string>("60d");
  const [analyzeAs, setAnalyzeAs] = useState<"summary" | "breakdown">(
    "breakdown",
  );
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [insightsOpen, setInsightsOpen] = useState(false);

  const datePreset =
    DATE_PRESETS.find((d) => d.id === datePresetId) ?? DATE_PRESETS[3];
  const days = datePreset.days;

  const { data, isLoading, error } = useQuery<ExplorerResponse>({
    queryKey: [
      "cost",
      "explorer",
      providers.join(","),
      groupBy.join(","),
      days,
      costType,
      containerAllocated,
      usageChargesOnly,
      rollup,
      serviceFilter,
      teamFilter,
    ],
    queryFn: () =>
      queryExplorer({
        group_by: groupBy,
        days,
        cost_type: costType,
        container_allocated: containerAllocated,
        usage_charges_only: usageChargesOnly,
        rollup,
        providers: providers.length > 0 ? providers : undefined,
        services: serviceFilter ? [serviceFilter] : undefined,
        teams: teamFilter ? [teamFilter] : undefined,
      }),
  });

  const dailyTotals = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const out: Record<string, number> = {};
    for (const d of data.dayKeys) {
      out[d] = data.rows.reduce((s, r) => s + (r.daily[d] ?? 0), 0);
    }
    return out;
  }, [data]);

  const seriesKeys = data?.rows.map((r) => r.key) ?? [];
  const visibleLegend = seriesKeys.slice(0, 4);
  const hiddenLegendCount = Math.max(0, seriesKeys.length - visibleLegend.length);

  const queryString = useMemo(() => {
    if (providers.length === 3) return "( providername IN (aws,azure,gcp) )";
    if (providers.length === 0) return "( providername IN () )";
    return `( providername IN (${providers.join(",")}) )`;
  }, [providers]);

  return (
    <div
      data-testid="cost-explorer-page"
      className="flex h-full min-h-0 flex-col bg-[#f6f7f9] text-[#202124]"
    >
      <TopTabsBar />
      <ViewsBar
        datePreset={datePreset}
        onChangeDatePreset={(id) => setDatePresetId(id)}
      />
      <ScopeBar
        providers={providers}
        onProvidersChange={setProviders}
        costType={costType}
        onCostTypeChange={setCostType}
        containerAllocated={containerAllocated}
        onContainerAllocatedChange={setContainerAllocated}
        usageChargesOnly={usageChargesOnly}
        onUsageChargesOnlyChange={setUsageChargesOnly}
      />
      <QueryBar
        queryString={queryString}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        rollup={rollup}
        onRollupChange={setRollup}
      />
      <FilterBar
        serviceFilter={serviceFilter}
        onServiceFilterChange={setServiceFilter}
        teamFilter={teamFilter}
        onTeamFilterChange={setTeamFilter}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pb-12 pt-4">
          {error && (
            <div className="mb-3 rounded border border-[#fce8e6] bg-[#fce8e6] px-3 py-2 text-[12.5px] text-[#c5221f]">
              Failed to load cost data: {(error as Error).message}
            </div>
          )}

          <StatsAndChartCard
            data={data}
            isLoading={isLoading}
            seriesKeys={seriesKeys}
            visibleLegend={visibleLegend}
            hiddenLegendCount={hiddenLegendCount}
          />

          <WatchdogBanner
            insights={data?.insights ?? []}
            open={insightsOpen}
            onToggle={() => setInsightsOpen((v) => !v)}
          />

          <BreakdownTable
            data={data}
            isLoading={isLoading}
            analyzeAs={analyzeAs}
            onAnalyzeAsChange={setAnalyzeAs}
            dailyTotals={dailyTotals}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top tabs row                                                              */
/* -------------------------------------------------------------------------- */

function TopTabsBar() {
  const activeTab = "explorer";
  return (
    <div className="flex items-center gap-1 border-b border-[#e1e3e6] bg-white px-3 pt-1.5">
      <div className="mr-2 flex items-center gap-1.5 px-1.5 text-[14px] text-[#202124]">
        <Cloud size={16} weight="duotone" className="text-[#5f6368]" />
        <span className="font-semibold">Cloud Cost</span>
      </div>
      {TOP_TABS.map((t) => {
        const isActive = t.id === activeTab;
        return (
          <button
            key={t.id}
            type="button"
            disabled={!isActive}
            aria-disabled={!isActive}
            title={isActive ? undefined : "Tab switching disabled"}
            className={`flex items-center gap-1 px-3 pb-2 pt-1.5 text-[13px] ${
              isActive
                ? "border-b-2 border-[#774aff] font-medium text-[#202124]"
                : "cursor-not-allowed border-b-2 border-transparent text-[#9aa0a6]"
            }`}
            style={{ marginBottom: -1 }}
          >
            {t.label}
            {t.caret && <CaretDown size={10} weight="bold" />}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-1 pb-1.5">
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[#5f6368] hover:text-[#202124]"
        >
          <Gear size={14} />
          Settings
          <CaretDown size={10} weight="bold" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Views + date range row                                                    */
/* -------------------------------------------------------------------------- */

function ViewsBar({
  datePreset,
  onChangeDatePreset,
}: {
  datePreset: (typeof DATE_PRESETS)[number];
  onChangeDatePreset: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#e1e3e6] bg-white px-3 py-1.5">
      <div className="flex items-center gap-2 text-[12.5px] text-[#202124]">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-[#e1e3e6] px-1.5 py-0.5 text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          <CaretRight size={10} weight="bold" />
          Views
        </button>
        <span className="font-medium">My View</span>
        <button
          type="button"
          aria-label="View options"
          className="flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <DotsThree size={14} weight="bold" />
        </button>
      </div>
      <DateRangePicker
        datePreset={datePreset}
        onChangeDatePreset={onChangeDatePreset}
      />
    </div>
  );
}

function DateRangePicker({
  datePreset,
  onChangeDatePreset,
}: {
  datePreset: (typeof DATE_PRESETS)[number];
  onChangeDatePreset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded border border-[#dadce0] bg-white px-2 py-1 text-[12px] hover:bg-[#f8f9fa]"
      >
        <span className="rounded bg-[#e8eaed] px-1.5 py-0.5 font-mono text-[10.5px] text-[#5f6368]">
          {datePreset.short}
        </span>
        <span className="text-[12.5px] text-[#202124]">{datePreset.label}</span>
        <span className="text-[10.5px] text-[#9aa0a6]">UTC</span>
        <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
      </button>
      <button
        type="button"
        aria-label="Previous range"
        className="flex h-7 w-7 items-center justify-center rounded border border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa]"
      >
        <CaretLeft size={11} weight="bold" />
        <CaretLeft size={11} weight="bold" className="-ml-2" />
      </button>
      <button
        type="button"
        aria-label="Next range"
        className="flex h-7 w-7 items-center justify-center rounded border border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa]"
      >
        <CaretRight size={11} weight="bold" />
        <CaretRight size={11} weight="bold" className="-ml-2" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-48 rounded-md border border-[#dadce0] bg-white py-1 shadow-lg">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChangeDatePreset(p.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] hover:bg-[#f1f3f4] ${
                p.id === datePreset.id
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : "text-[#202124]"
              }`}
            >
              <span>{p.label}</span>
              <span className="rounded bg-[#e8eaed] px-1.5 py-0.5 font-mono text-[10px] text-[#5f6368]">
                {p.short}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scope ("Scope to ...") row                                                */
/* -------------------------------------------------------------------------- */

function ScopeBar({
  providers,
  onProvidersChange,
  costType,
  onCostTypeChange,
  containerAllocated,
  onContainerAllocatedChange,
  usageChargesOnly,
  onUsageChargesOnlyChange,
}: {
  providers: string[];
  onProvidersChange: (next: string[]) => void;
  costType: CostType;
  onCostTypeChange: (next: CostType) => void;
  containerAllocated: boolean;
  onContainerAllocatedChange: (next: boolean) => void;
  usageChargesOnly: boolean;
  onUsageChargesOnlyChange: (next: boolean) => void;
}) {
  const providerLabel = useMemo(() => {
    if (providers.length === 0) return "None";
    if (providers.length === 3) return "AWS, Azure, Google";
    return providers
      .map((p) => PROVIDER_OPTIONS.find((o) => o.id === p)?.label ?? p)
      .join(", ");
  }, [providers]);

  return (
    <div className="flex items-center gap-2 border-b border-[#e1e3e6] bg-white px-4 py-2">
      <span className="pr-1 text-[12.5px] text-[#5f6368]">Scope to</span>
      <FieldSelect
        label="Provider"
        value={providerLabel}
        valueColor="#1a73e8"
        options={PROVIDER_OPTIONS}
        selectedIds={providers}
        onChange={onProvidersChange}
        multi
      />
      <FieldSelect
        label="Cost Type"
        value={COST_TYPE_LABELS[costType]}
        options={COST_TYPE_OPTIONS}
        selectedIds={[costType]}
        onChange={(ids) => onCostTypeChange(ids[0] as CostType)}
      />
      <span className="px-1 text-[12.5px] text-[#5f6368]">with</span>
      <FieldSelect
        label="Container Allocated"
        value={containerAllocated ? "Enabled" : "Disabled"}
        valueColor={containerAllocated ? "#137333" : "#5f6368"}
        options={ENABLED_OPTIONS}
        selectedIds={[containerAllocated ? "enabled" : "disabled"]}
        onChange={(ids) => onContainerAllocatedChange(ids[0] === "enabled")}
      />
      <FieldSelect
        label="Usage Charges Only"
        value={usageChargesOnly ? "Enabled" : "Disabled"}
        valueColor={usageChargesOnly ? "#137333" : "#5f6368"}
        options={ENABLED_OPTIONS}
        selectedIds={[usageChargesOnly ? "enabled" : "disabled"]}
        onChange={(ids) => onUsageChargesOnlyChange(ids[0] === "enabled")}
      />
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Code editor"
          className="flex h-7 w-7 items-center justify-center rounded border border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa]"
        >
          <Code size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

type FieldOption = { id: string; label: string };

function FieldSelect({
  label,
  value,
  valueColor,
  options,
  selectedIds,
  onChange,
  multi,
}: {
  label: string;
  value: string;
  valueColor?: string;
  options: FieldOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (id: string) => {
    if (multi) {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((x) => x !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    } else {
      onChange([id]);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group relative flex h-9 min-w-[140px] items-center rounded border border-[#dadce0] bg-white px-2 pb-1 pt-3 text-left hover:border-[#80868b]"
      >
        <span className="absolute left-2 top-0 -translate-y-1/2 bg-white px-1 text-[10px] text-[#5f6368]">
          {label}
        </span>
        <span
          className="flex-1 truncate text-[12.5px]"
          style={{ color: valueColor ?? "#202124" }}
        >
          {value}
        </span>
        <CaretDown size={10} weight="bold" className="ml-1 text-[#5f6368]" />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-30 min-w-full whitespace-nowrap rounded-md border border-[#dadce0] bg-white py-1 shadow-lg">
          {options.map((opt) => {
            const isSelected = selectedIds.includes(opt.id);
            return (
              <button
                key={opt.id || "__all__"}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-[#f1f3f4] ${
                  isSelected && !multi
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "text-[#202124]"
                }`}
              >
                {multi ? (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="accent-[#1a73e8]"
                  />
                ) : null}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Query bar (search + group-by chips)                                       */
/* -------------------------------------------------------------------------- */

const ALL_DIMS = [
  { id: "provider", label: "providername" },
  { id: "service", label: "servicename" },
  { id: "region", label: "region" },
  { id: "account", label: "account" },
  { id: "resource_type", label: "resource_type" },
];

function QueryBar({
  queryString,
  groupBy,
  onGroupByChange,
  rollup,
  onRollupChange,
}: {
  queryString: string;
  groupBy: string[];
  onGroupByChange: (next: string[]) => void;
  rollup: CostRollup;
  onRollupChange: (next: CostRollup) => void;
}) {
  const [groupOpen, setGroupOpen] = useState(false);
  const [rollupOpen, setRollupOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-white px-4 py-1.5">
      <div className="flex h-8 flex-1 items-center gap-2 rounded border border-[#dadce0] bg-white px-2 hover:border-[#80868b]">
        <MagnifyingGlass size={13} className="text-[#5f6368]" />
        <span className="flex-1 truncate text-[12.5px] font-mono">
          (&nbsp;
          <span className="text-[#5f6368]">providername</span>
          <span className="px-1 text-[#1a73e8]">IN</span>
          <span className="text-[#202124]">
            {queryString.replace(/^.*IN /, "").replace(/^/, "")}
          </span>
          &nbsp;)
        </span>
        <button
          type="button"
          aria-label="Clear query"
          className="flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <X size={10} weight="bold" />
        </button>
      </div>

      <div className="relative flex items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2 py-1">
        <span className="text-[11px] text-[#5f6368]">Group by</span>
        <div className="flex items-center gap-1">
          {groupBy.map((g) => {
            const dim = ALL_DIMS.find((d) => d.id === g);
            return (
              <span
                key={g}
                className="inline-flex items-center gap-1 rounded bg-[#e8eaed] px-1.5 py-0.5 font-mono text-[11px] text-[#202124]"
              >
                {dim?.label ?? g}
                <button
                  type="button"
                  aria-label={`Remove ${g}`}
                  onClick={() =>
                    onGroupByChange(groupBy.filter((x) => x !== g))
                  }
                  className="text-[#5f6368] hover:text-[#202124]"
                >
                  <X size={9} weight="bold" />
                </button>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setGroupOpen((v) => !v)}
          aria-label="Add group by"
          className="ml-1 flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <CaretDown size={10} weight="bold" />
        </button>
        {groupOpen && (
          <div className="absolute right-0 top-9 z-30 w-44 rounded-md border border-[#dadce0] bg-white py-1 shadow-lg">
            {ALL_DIMS.map((d) => {
              const checked = groupBy.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    if (checked) {
                      onGroupByChange(groupBy.filter((x) => x !== d.id));
                    } else if (groupBy.length < 3) {
                      onGroupByChange([...groupBy, d.id]);
                    }
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-[12.5px] hover:bg-[#f1f3f4]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="accent-[#1a73e8]"
                  />
                  <span className="font-mono">{d.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2 py-1">
        <span className="text-[11px] text-[#5f6368]">Rollup</span>
        <button
          type="button"
          onClick={() => setRollupOpen((v) => !v)}
          className="flex items-center gap-1 text-[12px] text-[#202124]"
        >
          {ROLLUP_LABELS[rollup]}
          <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        </button>
        {rollupOpen && (
          <div className="absolute right-0 top-9 z-30 w-32 rounded-md border border-[#dadce0] bg-white py-1 shadow-lg">
            {(Object.keys(ROLLUP_LABELS) as CostRollup[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onRollupChange(r);
                  setRollupOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1 text-left text-[12.5px] hover:bg-[#f1f3f4] ${
                  r === rollup
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "text-[#202124]"
                }`}
              >
                <span>{ROLLUP_LABELS[r]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filter row (Servicename / Service / Team / + Filter / Refine Results)     */
/* -------------------------------------------------------------------------- */

function FilterBar({
  serviceFilter,
  onServiceFilterChange,
  teamFilter,
  onTeamFilterChange,
}: {
  serviceFilter: string;
  onServiceFilterChange: (s: string) => void;
  teamFilter: string;
  onTeamFilterChange: (s: string) => void;
}) {
  const [service, setService] = useState<string>("");
  return (
    <div className="flex items-center gap-2 border-b border-[#e1e3e6] bg-white px-4 pb-3">
      <FieldSelect
        label="Servicename"
        value={serviceFilter || "All"}
        options={SERVICE_OPTIONS}
        selectedIds={[serviceFilter]}
        onChange={(ids) => onServiceFilterChange(ids[0] ?? "")}
      />
      <FieldSelect
        label="Service"
        value={service || "All"}
        options={SERVICE_OPTIONS}
        selectedIds={[service]}
        onChange={(ids) => setService(ids[0] ?? "")}
      />
      <FieldSelect
        label="Team"
        value={teamFilter || "All"}
        options={TEAM_OPTIONS}
        selectedIds={[teamFilter]}
        onChange={(ids) => onTeamFilterChange(ids[0] ?? "")}
      />
      <button
        type="button"
        className="flex h-8 items-center gap-1 rounded border border-dashed border-[#dadce0] bg-white px-2 text-[12.5px] text-[#5f6368] hover:bg-[#f8f9fa]"
      >
        <Plus size={11} weight="bold" />
        Filter
      </button>
      <button
        type="button"
        className="ml-auto flex h-8 items-center gap-1 rounded border border-[#dadce0] bg-white px-2 text-[12.5px] text-[#5f6368] hover:bg-[#f8f9fa]"
      >
        <FunnelSimple size={12} weight="bold" />
        Refine Results
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stats panel + stacked bar chart                                           */
/* -------------------------------------------------------------------------- */

function StatsAndChartCard({
  data,
  isLoading,
  seriesKeys,
  visibleLegend,
  hiddenLegendCount,
}: {
  data: ExplorerResponse | undefined;
  isLoading: boolean;
  seriesKeys: string[];
  visibleLegend: string[];
  hiddenLegendCount: number;
}) {
  const [showCosts, setShowCosts] = useState<"$" | "%">("$");
  const total = data?.totalCost ?? 0;
  const change = data?.totalCostChange ?? 0;
  const changePct = data?.totalCostChangePct ?? null;
  const positive = change >= 0;

  return (
    <section className="rounded-md border border-[#e1e3e6] bg-white">
      <div className="flex">
        <div className="w-[180px] shrink-0 border-r border-[#e1e3e6] px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5f6368]">
            Total Cost
          </div>
          <div className="mt-0.5 text-[10px] uppercase text-[#80868b]">
            {data
              ? `${fmtRange(data.rangeStart, data.rangeEnd)} (TODAY)`
              : "—"}
          </div>
          <div className="mt-2 text-[28px] font-medium leading-none text-[#202124]">
            {isLoading ? "—" : fmtUsd(total)}
          </div>
          <div className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-[#5f6368]">
            Total Cost Change
          </div>
          <div className="mt-0.5 text-[10px] uppercase text-[#80868b]">
            {data
              ? `COMPARED TO ${fmtRange(
                  data.previousRangeStart,
                  data.previousRangeEnd,
                )}`
              : "—"}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[22px] font-medium leading-none text-[#202124]">
              {isLoading ? "—" : fmtUsd(Math.abs(change))}
            </span>
            <span
              className="rounded px-1 py-0.5 text-[11px] font-medium"
              style={{
                color: positive ? "#c5221f" : "#137333",
                background: positive ? "#fce8e6" : "#e6f4ea",
              }}
            >
              {changePct === null
                ? "—"
                : `${positive ? "" : ""}${changePct.toFixed(0)}%`}
              <span className="ml-0.5">{positive ? "↗" : "↘"}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#e1e3e6] px-3 py-2">
            <span className="text-[12.5px] font-medium text-[#202124]">
              All Cost
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#5f6368]">Show</span>
              <button
                type="button"
                onClick={() =>
                  setShowCosts((v) => (v === "$" ? "%" : "$"))
                }
                className="flex items-center gap-1 rounded border border-[#dadce0] bg-white px-2 py-1 text-[11.5px] text-[#202124] hover:bg-[#f8f9fa]"
              >
                Costs ({showCosts})
                <CaretDown size={10} weight="bold" />
              </button>
              <button
                type="button"
                aria-label="Download"
                className="flex h-6 w-6 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
              >
                <Download size={13} />
              </button>
              <button
                type="button"
                aria-label="Fullscreen"
                className="flex h-6 w-6 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
              >
                <ArrowsOut size={13} />
              </button>
            </div>
          </div>

          <div className="px-3 py-2">
            <div className="h-[200px]">
              <ResponsiveContainer>
                <BarChart
                  data={data?.stackedSeries ?? []}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "#5f6368" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e1e3e6" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v + "T00:00:00Z");
                      const day = d.getUTCDate();
                      if (day === 1) {
                        return d.toLocaleDateString("en-US", {
                          month: "long",
                          timeZone: "UTC",
                        });
                      }
                      const m = d
                        .toLocaleDateString("en-US", {
                          month: "short",
                          timeZone: "UTC",
                        });
                      return `${m} ${day}`;
                    }}
                    interval={6}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#5f6368" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => {
                      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                      return `${v}`;
                    }}
                    width={42}
                    label={{
                      value: "Dollars",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "#5f6368" },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(26,115,232,0.08)" }}
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 4,
                      border: "1px solid #dadce0",
                    }}
                    formatter={(v: number) => fmtCell(v)}
                    labelFormatter={(label: string) => fmtShortDay(label)}
                  />
                  {seriesKeys.map((k, i) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      stackId="cost"
                      fill={colorFor(i)}
                      isAnimationActive={false}
                      maxBarSize={20}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-2">
              {visibleLegend.map((k, i) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 text-[10.5px] text-[#5f6368]"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: colorFor(i) }}
                  />
                  <span className="font-mono">
                    {legendLabel(k, data?.groupBy ?? [])}
                  </span>
                </span>
              ))}
              {hiddenLegendCount > 0 && (
                <span className="rounded bg-[#e8eaed] px-1.5 py-0.5 text-[10px] text-[#5f6368]">
                  +{hiddenLegendCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function legendLabel(seriesKey: string, dims: string[]): string {
  const parts = seriesKey.split("|");
  return parts
    .map((p, i) => `${dims[i] ?? `dim${i}`}:${p}`)
    .join(", ");
}

/* -------------------------------------------------------------------------- */
/*  Watchdog Insights collapsible                                             */
/* -------------------------------------------------------------------------- */

function WatchdogBanner({
  insights,
  open,
  onToggle,
}: {
  insights: ExplorerResponse["insights"];
  open: boolean;
  onToggle: () => void;
}) {
  const count = insights.length;
  return (
    <section className="mt-3 rounded-md border border-dashed border-[#a142f4]/50 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
        ) : (
          <CaretRight size={11} weight="bold" className="text-[#5f6368]" />
        )}
        <span className="flex h-5 min-w-5 items-center justify-center rounded bg-[#fef7e0] px-1 text-[11px] font-bold text-[#b06000]">
          <Warning size={11} weight="fill" className="mr-0.5" />
          {count}
        </span>
        <span className="text-[12.5px] font-medium text-[#202124]">
          Watchdog Insights
        </span>
        <span className="ml-2 text-[12px] text-[#5f6368]">Cloud Cost</span>
        <span className="ml-2 inline-flex items-center gap-0.5 text-[12px] text-[#1a73e8] hover:underline">
          View all
          <ArrowRight size={11} weight="bold" />
        </span>
      </button>
      {open && (
        <div className="border-t border-[#e1e3e6] px-3 py-2">
          {count === 0 ? (
            <div className="text-[12px] text-[#5f6368]">
              No active insights for the current scope.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {insights.map((ins) => (
                <li
                  key={ins.key}
                  className="flex items-start gap-2 text-[12.5px]"
                >
                  <Sparkle
                    size={12}
                    weight="fill"
                    className="mt-0.5 text-[#a142f4]"
                  />
                  <span className="text-[#202124]">{ins.headline}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Breakdown table                                                           */
/* -------------------------------------------------------------------------- */

function ProviderIcon({ provider }: { provider: string }) {
  const p = provider.toLowerCase();
  if (p.includes("aws") || p === "amazon") {
    return (
      <span
        title="AWS"
        className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#fff8e1] text-[#ff9900]"
        style={{ fontSize: 10, fontWeight: 700, fontFamily: "serif" }}
      >
        a
      </span>
    );
  }
  if (p.includes("azure") || p.includes("microsoft")) {
    return (
      <span
        title="Azure"
        className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#e8f0fe] text-[#0078d4]"
        style={{ fontSize: 10, fontWeight: 700 }}
      >
        ▲
      </span>
    );
  }
  if (p.includes("gcp") || p.includes("google")) {
    return (
      <span
        title="Google Cloud"
        className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#e6f4ea] text-[#34a853]"
        style={{ fontSize: 10, fontWeight: 700 }}
      >
        ◢
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#e8eaed] text-[10px] text-[#5f6368]">
      ?
    </span>
  );
}

function BreakdownTable({
  data,
  isLoading,
  analyzeAs,
  onAnalyzeAsChange,
  dailyTotals,
}: {
  data: ExplorerResponse | undefined;
  isLoading: boolean;
  analyzeAs: "summary" | "breakdown";
  onAnalyzeAsChange: (next: "summary" | "breakdown") => void;
  dailyTotals: Record<string, number>;
}) {
  const dayKeys = data?.dayKeys ?? [];
  const totalLabel = data
    ? `TOTAL COST ${fmtRange(data.rangeStart, data.rangeEnd)}`
    : "TOTAL COST";

  const dims = data?.groupBy ?? [];
  const colHeaders = dims.map((d) => {
    if (d === "provider") return "PROVIDERNAME";
    if (d === "service") return "SERVICENAME";
    return d.toUpperCase();
  });

  return (
    <section className="mt-3 rounded-md border border-[#e1e3e6] bg-white">
      <div className="flex items-center gap-2 border-b border-[#e1e3e6] px-3 py-1.5">
        <span className="pr-1 text-[11.5px] uppercase tracking-wide text-[#5f6368]">
          Analyze as
        </span>
        <div className="flex h-6 overflow-hidden rounded border border-[#dadce0]">
          <button
            type="button"
            onClick={() => onAnalyzeAsChange("summary")}
            className={`px-2.5 text-[11.5px] ${
              analyzeAs === "summary"
                ? "bg-[#e8f0fe] text-[#1a73e8]"
                : "bg-white text-[#5f6368] hover:bg-[#f8f9fa]"
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => onAnalyzeAsChange("breakdown")}
            className={`border-l border-[#dadce0] px-2.5 text-[11.5px] ${
              analyzeAs === "breakdown"
                ? "bg-[#1a73e8] text-white"
                : "bg-white text-[#5f6368] hover:bg-[#f8f9fa]"
            }`}
          >
            Breakdown
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#5f6368] hover:bg-[#f8f9fa]"
          >
            <Sparkle size={12} weight="duotone" className="text-[#a142f4]" />
            Create Monitor
          </button>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#5f6368] hover:bg-[#f8f9fa]"
          >
            <UploadSimple size={12} weight="bold" />
            Open in Sheets
          </button>
          <button
            type="button"
            className="flex h-7 items-center rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#5f6368] hover:bg-[#f8f9fa]"
          >
            More...
          </button>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded border border-[#dadce0] bg-white px-2 text-[12px] text-[#5f6368] hover:bg-[#f8f9fa]"
          >
            <Gear size={12} />
            Options
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed border-separate border-spacing-0 text-[12.5px]">
          <thead className="text-[10px] uppercase tracking-wider text-[#5f6368]">
            <tr>
              {dims.map((dim, i) => (
                <th
                  key={dim}
                  className="sticky left-0 z-10 border-b border-[#e1e3e6] bg-white px-3 py-2 text-left font-medium"
                  style={{ width: 140, left: i * 140 }}
                >
                  {colHeaders[i]}
                </th>
              ))}
              <th
                className="border-b border-[#e1e3e6] bg-white px-3 py-2 text-right font-medium"
                style={{ width: 140 }}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="text-[#1a73e8]">↓</span>
                  {totalLabel}
                </span>
              </th>
              {dayKeys.map((d) => (
                <th
                  key={d}
                  className="border-b border-[#e1e3e6] bg-white px-3 py-2 text-right font-medium"
                  style={{ width: 78 }}
                >
                  {fmtShortDay(d)}
                </th>
              ))}
              <th
                className="sticky right-0 z-10 border-b border-[#e1e3e6] bg-white px-3 py-2 text-right font-medium"
                style={{ width: 90 }}
              />
            </tr>
            {!isLoading && data && (
              <tr className="text-[12px] font-semibold text-[#202124]">
                {dims.map((dim, i) => (
                  <td
                    key={dim}
                    className="border-b border-[#e1e3e6] bg-white px-3 py-2"
                    style={{ width: 140 }}
                  />
                ))}
                <td
                  className="border-b border-[#e1e3e6] bg-white px-3 py-2 text-right"
                  style={{ width: 140 }}
                >
                  {fmtCell(data.totalCost)}
                </td>
                {dayKeys.map((d) => (
                  <td
                    key={d}
                    className="border-b border-[#e1e3e6] bg-white px-3 py-2 text-right"
                    style={{ width: 78 }}
                  >
                    {fmtCell(dailyTotals[d] ?? 0)}
                  </td>
                ))}
                <td
                  className="border-b border-[#e1e3e6] bg-white px-3 py-2"
                  style={{ width: 90 }}
                />
              </tr>
            )}
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={dims.length + dayKeys.length + 2}
                  className="px-3 py-6 text-center text-[12.5px] text-[#5f6368]"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.rows.length === 0 && (
              <tr>
                <td
                  colSpan={dims.length + dayKeys.length + 2}
                  className="px-3 py-6 text-center text-[12.5px] text-[#5f6368]"
                >
                  No cost data for the selected scope.
                </td>
              </tr>
            )}
            {!isLoading &&
              data?.rows.map((r) => {
                const providerVal = r.dims.provider ?? r.dims.providername;
                return (
                  <tr
                    key={r.key}
                    className="text-[12.5px] hover:bg-[#f8f9fa]"
                  >
                    {dims.map((dim, i) => {
                      const v = r.dims[dim] ?? "—";
                      return (
                        <td
                          key={dim}
                          className="border-b border-[#f1f3f4] bg-inherit px-3 py-2"
                          style={{ width: 140 }}
                        >
                          {i === 0 && providerVal ? (
                            <ProviderIcon provider={providerVal} />
                          ) : i === 0 ? (
                            <span className="font-mono text-[#5f6368]">{v}</span>
                          ) : (
                            <span className="font-mono text-[#202124]">{v}</span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className="border-b border-[#f1f3f4] px-3 py-2 text-right font-medium"
                      style={{ width: 140 }}
                    >
                      {fmtCell(r.totalCost)}
                    </td>
                    {dayKeys.map((d) => (
                      <td
                        key={d}
                        className="border-b border-[#f1f3f4] px-3 py-2 text-right text-[#202124]"
                        style={{ width: 78 }}
                      >
                        {fmtCell(r.daily[d] ?? 0)}
                      </td>
                    ))}
                    <td
                      className="border-b border-[#f1f3f4] px-3 py-2 text-right"
                      style={{ width: 90 }}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 text-[12px] text-[#1a73e8] hover:underline"
                      >
                        See More
                        <ArrowRight size={11} weight="bold" />
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
