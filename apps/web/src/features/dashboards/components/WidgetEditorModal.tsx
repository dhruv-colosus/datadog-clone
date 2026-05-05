"use client";

import {
  ArrowsCounterClockwise,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretRight,
  ChartBar,
  ChartLine,
  ChartPie,
  ChartScatter,
  Globe,
  ListBullets,
  MagnifyingGlassMinus,
  Pause,
  Pencil,
  Plus,
  Question,
  Square,
  SquaresFour,
  Table as TableIcon,
  Thermometer,
  TrendUp,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  rangeFromPreset,
  TimeRangePicker,
  type TimeRange,
} from "@/components/ui/TimeRangePicker";
import { useDashboardsStore, newWidgetId, newQueryId } from "../store";
import {
  defaultChangeConfig,
  defaultDistributionConfig,
  defaultHeatmapConfig,
  defaultQueryValueConfig,
  defaultTopListConfig,
  type ChangeConfig,
  type DistributionConfig,
  type HeatmapConfig,
  type QueryValueConfig,
  type TimeseriesDisplay,
  type TopListConfig,
  type Widget,
  type WidgetConfig,
  type WidgetQuery,
  type WidgetType,
} from "../types";
import { WidgetQueryRow } from "./WidgetQueryRow";
import { WidgetView } from "./widget-views";

type Props = {
  open: boolean;
  /** Required when persisting through the dashboards store (default mode). Omit when using `onSave`. */
  dashboardId?: string;
  initialType: WidgetType;
  /** When set, edits an existing widget rather than creating a new one. */
  editingWidget?: Widget;
  onClose: () => void;
  /** Optional override — when provided, persistence happens via this callback instead of the dashboards store. */
  onSave?: (widget: Widget) => void;
};

type VizOption = {
  type: WidgetType | "unsupported";
  label: string;
  icon: Icon;
  enabled: boolean;
};

const VISUALIZATIONS: VizOption[] = [
  { type: "timeseries", label: "Timeseries", icon: ChartLine, enabled: true },
  { type: "query_value", label: "Query Value", icon: Square, enabled: true },
  { type: "table", label: "Table", icon: TableIcon, enabled: true },
  { type: "heatmap", label: "Heatmap", icon: Thermometer, enabled: true },
  { type: "unsupported", label: "Scatter Plot", icon: ChartScatter, enabled: false },
  { type: "distribution", label: "Distribution", icon: TrendUp, enabled: true },
  { type: "top_list", label: "Top List", icon: ListBullets, enabled: true },
  { type: "unsupported", label: "Bar Chart", icon: ChartBar, enabled: false },
  { type: "unsupported", label: "List", icon: ListBullets, enabled: false },
  { type: "change", label: "Change", icon: ArrowsCounterClockwise, enabled: true },
  { type: "unsupported", label: "Geomap", icon: Globe, enabled: false },
  { type: "unsupported", label: "Tree Map", icon: SquaresFour, enabled: false },
  { type: "pie-chart", label: "Pie Chart", icon: ChartPie, enabled: true },
];

function defaultQuery(): WidgetQuery {
  return {
    id: newQueryId(),
    alias: "a",
    metricName: "system.cpu.user",
    aggregator: "avg",
    filters: [],
    groupBy: [],
  };
}

function defaultWidget(type: WidgetType): Widget {
  return {
    id: newWidgetId(),
    type,
    title: defaultTitle(type),
    queries: [defaultQuery()],
    display: type === "timeseries" ? "lines" : undefined,
    config: defaultConfigFor(type),
    createdAt: Date.now(),
  };
}

function defaultConfigFor(type: WidgetType): WidgetConfig | undefined {
  switch (type) {
    case "query_value":
      return { query_value: defaultQueryValueConfig() };
    case "top_list":
      return { top_list: defaultTopListConfig() };
    case "heatmap":
      return { heatmap: defaultHeatmapConfig() };
    case "change":
      return { change: defaultChangeConfig() };
    case "distribution":
      return { distribution: defaultDistributionConfig() };
    default:
      return undefined;
  }
}

function defaultTitle(type: WidgetType): string {
  switch (type) {
    case "timeseries":
      return "Timeseries";
    case "pie-chart":
      return "Pie Chart";
    case "query_value":
      return "Query Value";
    case "top_list":
      return "Top List";
    case "heatmap":
      return "Heatmap";
    case "change":
      return "Change";
    case "distribution":
      return "Distribution";
    case "table":
    default:
      return "Table";
  }
}

export function WidgetEditorModal({
  open,
  dashboardId,
  initialType,
  editingWidget,
  onClose,
  onSave,
}: Props) {
  const addWidget = useDashboardsStore((s) => s.addWidget);
  const updateWidget = useDashboardsStore((s) => s.updateWidget);

  const [draft, setDraft] = useState<Widget>(() =>
    editingWidget ?? defaultWidget(initialType),
  );
  const [timeRange, setTimeRange] = useState<TimeRange>(() => rangeFromPreset("1h"));
  const [titleEdit, setTitleEdit] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(editingWidget ?? defaultWidget(initialType));
      setTimeRange(rangeFromPreset("1h"));
      setTitleEdit(false);
    }
  }, [open, initialType, editingWidget]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setType = (type: WidgetType) => {
    setDraft((d) => ({
      ...d,
      type,
      display: type === "timeseries" ? d.display ?? "lines" : undefined,
      config: { ...(d.config ?? {}), ...(defaultConfigFor(type) ?? {}) },
    }));
  };

  const updateConfig = (patch: Partial<WidgetConfig>) => {
    setDraft((d) => ({
      ...d,
      config: { ...(d.config ?? {}), ...patch },
    }));
  };

  const updateQuery = (queryId: string, patch: Partial<WidgetQuery>) => {
    setDraft((d) => ({
      ...d,
      queries: d.queries.map((q) => (q.id === queryId ? { ...q, ...patch } : q)),
    }));
  };

  const addQuery = () => {
    setDraft((d) => {
      const used = d.queries.map((q) => q.alias);
      const aliases = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const alias = aliases.find((x) => !used.includes(x)) ?? `q${used.length + 1}`;
      return {
        ...d,
        queries: [...d.queries, { ...defaultQuery(), alias }],
      };
    });
  };

  const removeQuery = (queryId: string) => {
    setDraft((d) => ({
      ...d,
      queries: d.queries.filter((q) => q.id !== queryId),
    }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(draft);
    } else if (dashboardId) {
      if (editingWidget) {
        updateWidget(dashboardId, draft.id, draft);
      } else {
        addWidget(dashboardId, draft);
      }
    }
    onClose();
  };

  const previewWidget = useMemo<Widget>(() => draft, [draft]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col bg-white">
      <header className="flex items-center justify-between border-b border-[#dadce0] px-6 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Pencil size={16} className="text-[#5f6368]" />
          {titleEdit ? (
            <input
              autoFocus
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              onBlur={() => setTitleEdit(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setTitleEdit(false);
              }}
              className="rounded-md border border-[#bdc1c6] px-2 py-1 text-[16px] outline-none focus:border-[#1a73e8]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setTitleEdit(true)}
              className="truncate text-[16px] font-medium text-[#202124] hover:text-[#1a73e8]"
            >
              {draft.title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1a73e8]">
            UTC{formatTzOffset(new Date().getTimezoneOffset())}
          </span>
          <TimeRangePicker
            value={timeRange}
            onChange={setTimeRange}
            placement="bottom-end"
          />
          <div className="flex">
            <Button iconOnly aria-label="Previous range" className="rounded-r-none">
              <CaretDoubleLeft size={10} weight="bold" />
            </Button>
            <Button
              iconOnly
              aria-label="Pause auto-refresh"
              className="rounded-none border-l-0"
            >
              <Pause size={10} weight="fill" />
            </Button>
            <Button
              iconOnly
              aria-label="Next range"
              className="rounded-l-none border-l-0"
            >
              <CaretDoubleRight size={10} weight="bold" />
            </Button>
          </div>
          <Button iconOnly aria-label="Zoom out">
            <MagnifyingGlassMinus size={12} />
          </Button>
          <Button iconOnly aria-label="Reset">
            <ArrowsCounterClockwise size={12} />
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-auto">
        <section className="border-b border-[#dadce0] bg-white px-8 py-6">
          <div className="h-[340px]">
            <WidgetView widget={previewWidget} timeRange={timeRange} />
          </div>
        </section>

        <section className="border-b border-[#dadce0] px-8 py-5">
          <SectionTitle index={1}>Select your visualization</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-1">
            {VISUALIZATIONS.map((v, i) => (
              <VizTab
                key={`${v.label}-${i}`}
                label={v.label}
                icon={v.icon}
                active={v.type === draft.type}
                disabled={!v.enabled}
                onClick={() => v.enabled && v.type !== "unsupported" && setType(v.type)}
              />
            ))}
          </div>
        </section>

        <section className="flex-1 px-8 py-5">
          <SectionTitle index={2}>Graph your data</SectionTitle>
          <div className="mt-3 flex items-center gap-4 border-b border-[#dadce0]">
            <SubTab active>Edit</SubTab>
            <SubTab>JSON</SubTab>
            <SubTab>Share</SubTab>
            <button
              type="button"
              className="ml-auto flex items-center gap-1 pb-2 text-[12px] text-[#1a73e8] hover:underline"
            >
              <Question size={12} weight="bold" />
              Graphing help
            </button>
          </div>

          <div className="space-y-4 py-4">
            {draft.queries.map((q) => (
              <WidgetQueryRow
                key={q.id}
                query={q}
                canRemove={draft.queries.length > 1}
                onChange={(patch) => updateQuery(q.id, patch)}
                onRemove={() => removeQuery(q.id)}
              />
            ))}
            <div className="flex items-center gap-2">
              <Button onClick={addQuery}>
                <Plus size={12} weight="bold" />
                Add Query
              </Button>
              <Button disabled>
                <Plus size={12} weight="bold" />
                Add Formula
              </Button>
            </div>
          </div>

          {draft.type === "timeseries" && (
            <DisplayOptions
              display={draft.display ?? "lines"}
              onChange={(display) => setDraft((d) => ({ ...d, display }))}
            />
          )}

          {draft.type === "query_value" && (
            <QueryValueOptions
              cfg={draft.config?.query_value ?? defaultQueryValueConfig()}
              onChange={(next) => updateConfig({ query_value: next })}
            />
          )}

          {draft.type === "top_list" && (
            <TopListOptions
              cfg={draft.config?.top_list ?? defaultTopListConfig()}
              onChange={(next) => updateConfig({ top_list: next })}
            />
          )}

          {draft.type === "heatmap" && (
            <HeatmapOptions
              cfg={draft.config?.heatmap ?? defaultHeatmapConfig()}
              onChange={(next) => updateConfig({ heatmap: next })}
            />
          )}

          {draft.type === "change" && (
            <ChangeOptions
              cfg={draft.config?.change ?? defaultChangeConfig()}
              onChange={(next) => updateConfig({ change: next })}
            />
          )}

          {draft.type === "distribution" && (
            <DistributionOptions
              cfg={draft.config?.distribution ?? defaultDistributionConfig()}
              onChange={(next) => updateConfig({ distribution: next })}
            />
          )}

          <Collapsible label="Event Overlays" />
          <Collapsible label="Markers" />
          <Collapsible label="Y-Axis Controls" />
        </section>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-[#dadce0] px-6 py-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button>Save to…</Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </footer>
    </div>
  );
}

function SectionTitle({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a73e8] text-[12px] font-semibold text-white">
        {index}
      </span>
      <h2 className="text-[18px] font-medium text-[#202124]">{children}</h2>
    </div>
  );
}

function VizTab({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: Icon;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} (coming soon)` : label}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
          : disabled
            ? "border-transparent text-[#9aa0a6]"
            : "border-transparent text-[#5f6368] hover:bg-[#f1f3f4]"
      }`}
    >
      <Icon size={14} weight={active ? "fill" : "regular"} />
      {label}
    </button>
  );
}

function SubTab({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`relative pb-2 text-[13px] ${
        active ? "text-[#1a73e8]" : "text-[#5f6368] hover:text-[#202124]"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />}
    </button>
  );
}

function Collapsible({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[#dadce0] py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] text-[#202124]"
      >
        <CaretRight
          size={12}
          weight="bold"
          className={`text-[#5f6368] transition-transform ${open ? "rotate-90" : ""}`}
        />
        {label}
      </button>
      {open && (
        <div className="mt-2 px-5 text-[12px] text-[#5f6368]">
          (Coming soon.)
        </div>
      )}
    </div>
  );
}

function DisplayOptions({
  display,
  onChange,
}: {
  display: TimeseriesDisplay;
  onChange: (display: TimeseriesDisplay) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] py-3 text-[13px]">
      <Field label="Display:">
        <Select
          value={display}
          options={[
            { value: "lines", label: "Lines" },
            { value: "bars", label: "Bars" },
            { value: "areas", label: "Areas" },
          ]}
          onChange={(v) => onChange(v as TimeseriesDisplay)}
        />
      </Field>
      <Field label="Style:">
        <Select value="solid" options={[{ value: "solid", label: "Solid" }]} />
      </Field>
      <Field label="Stroke:">
        <Select value="normal" options={[{ value: "normal", label: "Normal" }]} />
      </Field>
      <Field label="Color:">
        <span className="flex h-7 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
          <span className="flex gap-0.5">
            <span className="h-3 w-1 bg-[#3b82f6]" />
            <span className="h-3 w-1 bg-[#facc15]" />
          </span>
          <span className="text-[12px] text-[#202124]">Classic</span>
          <CaretDown size={9} weight="bold" className="text-[#5f6368]" />
        </span>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[12px] uppercase tracking-wide text-[#5f6368]">
        {label}
      </span>
      {children}
    </span>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange?: (next: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={!onChange}
      className="h-7 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12px] text-[#202124] outline-none focus:border-[#1a73e8] disabled:text-[#5f6368]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

// ---------- per-widget option panels ----------

const AGG_OPTIONS = [
  { value: "avg", label: "Avg" },
  { value: "sum", label: "Sum" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "last", label: "Last" },
];

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  placeholder,
}: {
  value: number | null | "";
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      className={`h-7 w-20 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12px] text-[#202124] outline-none focus:border-[#1a73e8] ${
        className ?? ""
      }`}
    />
  );
}

function QueryValueOptions({
  cfg,
  onChange,
}: {
  cfg: QueryValueConfig;
  onChange: (next: QueryValueConfig) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] py-3 text-[13px]">
      <Field label="Aggregate:">
        <Select
          value={cfg.aggregateOverTime}
          options={AGG_OPTIONS}
          onChange={(v) =>
            onChange({ ...cfg, aggregateOverTime: v as QueryValueConfig["aggregateOverTime"] })
          }
        />
      </Field>
      <Field label="Precision:">
        <NumberInput
          value={cfg.precision}
          min={0}
          max={6}
          step={1}
          onChange={(n) => onChange({ ...cfg, precision: n ?? 0 })}
        />
      </Field>
      <Field label="Custom unit:">
        <input
          type="text"
          value={cfg.customUnit ?? ""}
          placeholder="e.g. ms, %"
          onChange={(e) =>
            onChange({ ...cfg, customUnit: e.target.value || null })
          }
          className="h-7 w-28 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12px] text-[#202124] outline-none focus:border-[#1a73e8]"
        />
      </Field>
      <Field label="Autoscale:">
        <Select
          value={cfg.autoscale ? "on" : "off"}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => onChange({ ...cfg, autoscale: v === "on" })}
        />
      </Field>
      <Field label="Align:">
        <Select
          value={cfg.textAlign}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, textAlign: v as QueryValueConfig["textAlign"] })
          }
        />
      </Field>
    </div>
  );
}

function TopListOptions({
  cfg,
  onChange,
}: {
  cfg: TopListConfig;
  onChange: (next: TopListConfig) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] py-3 text-[13px]">
      <Field label="Aggregate:">
        <Select
          value={cfg.aggregateOverTime}
          options={AGG_OPTIONS}
          onChange={(v) =>
            onChange({
              ...cfg,
              aggregateOverTime: v as TopListConfig["aggregateOverTime"],
            })
          }
        />
      </Field>
      <Field label="Display:">
        <Select
          value={cfg.display}
          options={[
            { value: "stacked", label: "Stacked" },
            { value: "flat", label: "Flat" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, display: v as TopListConfig["display"] })
          }
        />
      </Field>
      <Field label="Values:">
        <Select
          value={cfg.scaling}
          options={[
            { value: "absolute", label: "Absolute" },
            { value: "relative", label: "Relative %" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, scaling: v as TopListConfig["scaling"] })
          }
        />
      </Field>
      <Field label="Sort:">
        <Select
          value={cfg.sortDir}
          options={[
            { value: "desc", label: "Top" },
            { value: "asc", label: "Bottom" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, sortDir: v as TopListConfig["sortDir"] })
          }
        />
      </Field>
      <Field label="Limit:">
        <NumberInput
          value={cfg.limit}
          min={1}
          max={100}
          step={1}
          onChange={(n) => onChange({ ...cfg, limit: Math.max(1, n ?? 10) })}
        />
      </Field>
    </div>
  );
}

function HeatmapOptions({
  cfg,
  onChange,
}: {
  cfg: HeatmapConfig;
  onChange: (next: HeatmapConfig) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] py-3 text-[13px]">
      <Field label="Y scale:">
        <Select
          value={cfg.yAxisScale}
          options={[
            { value: "linear", label: "Linear" },
            { value: "log", label: "Log" },
            { value: "pow", label: "Pow" },
            { value: "sqrt", label: "Sqrt" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, yAxisScale: v as HeatmapConfig["yAxisScale"] })
          }
        />
      </Field>
      <Field label="Min:">
        <NumberInput
          value={cfg.yAxisMin}
          placeholder="auto"
          onChange={(n) => onChange({ ...cfg, yAxisMin: n })}
        />
      </Field>
      <Field label="Max:">
        <NumberInput
          value={cfg.yAxisMax}
          placeholder="auto"
          onChange={(n) => onChange({ ...cfg, yAxisMax: n })}
        />
      </Field>
      <Field label="Buckets:">
        <NumberInput
          value={cfg.numBuckets}
          min={5}
          max={120}
          step={1}
          onChange={(n) =>
            onChange({ ...cfg, numBuckets: Math.max(5, Math.min(120, n ?? 30)) })
          }
        />
      </Field>
      <Field label="Include 0:">
        <Select
          value={cfg.yAxisIncludeZero ? "on" : "off"}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, yAxisIncludeZero: v === "on" })
          }
        />
      </Field>
    </div>
  );
}

function ChangeOptions({
  cfg,
  onChange,
}: {
  cfg: ChangeConfig;
  onChange: (next: ChangeConfig) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] py-3 text-[13px]">
      <Field label="Compare to:">
        <Select
          value={cfg.compareTo}
          options={[
            { value: "hour_before", label: "Hour before" },
            { value: "day_before", label: "Day before" },
            { value: "week_before", label: "Week before" },
            { value: "month_before", label: "Month before" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, compareTo: v as ChangeConfig["compareTo"] })
          }
        />
      </Field>
      <Field label="Type:">
        <Select
          value={cfg.changeType}
          options={[
            { value: "absolute", label: "Absolute" },
            { value: "relative", label: "Relative %" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, changeType: v as ChangeConfig["changeType"] })
          }
        />
      </Field>
      <Field label="Order by:">
        <Select
          value={cfg.orderBy}
          options={[
            { value: "change", label: "Change" },
            { value: "name", label: "Name" },
            { value: "present", label: "Present" },
            { value: "past", label: "Past" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, orderBy: v as ChangeConfig["orderBy"] })
          }
        />
      </Field>
      <Field label="Direction:">
        <Select
          value={cfg.orderDir}
          options={[
            { value: "desc", label: "Descending" },
            { value: "asc", label: "Ascending" },
          ]}
          onChange={(v) =>
            onChange({ ...cfg, orderDir: v as ChangeConfig["orderDir"] })
          }
        />
      </Field>
      <Field label="Show present:">
        <Select
          value={cfg.showPresent ? "on" : "off"}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => onChange({ ...cfg, showPresent: v === "on" })}
        />
      </Field>
      <Field label="Increase is:">
        <Select
          value={cfg.increaseGood ? "good" : "bad"}
          options={[
            { value: "good", label: "Good" },
            { value: "bad", label: "Bad" },
          ]}
          onChange={(v) => onChange({ ...cfg, increaseGood: v === "good" })}
        />
      </Field>
    </div>
  );
}

function DistributionOptions({
  cfg,
  onChange,
}: {
  cfg: DistributionConfig;
  onChange: (next: DistributionConfig) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] py-3 text-[13px]">
      <Field label="Histogram of:">
        <Select
          value={cfg.histogramOf}
          options={[
            { value: "groups", label: "Groups" },
            { value: "points", label: "Points" },
          ]}
          onChange={(v) =>
            onChange({
              ...cfg,
              histogramOf: v as DistributionConfig["histogramOf"],
            })
          }
        />
      </Field>
      <Field label="Aggregate:">
        <Select
          value={cfg.aggregateOverTime}
          options={AGG_OPTIONS}
          onChange={(v) =>
            onChange({
              ...cfg,
              aggregateOverTime: v as DistributionConfig["aggregateOverTime"],
            })
          }
        />
      </Field>
      <Field label="Buckets:">
        <NumberInput
          value={cfg.numBuckets}
          min={5}
          max={100}
          step={1}
          onChange={(n) =>
            onChange({ ...cfg, numBuckets: Math.max(5, Math.min(100, n ?? 20)) })
          }
        />
      </Field>
      <Field label="Y scale:">
        <Select
          value={cfg.yAxisScale}
          options={[
            { value: "linear", label: "Linear" },
            { value: "log", label: "Log" },
          ]}
          onChange={(v) =>
            onChange({
              ...cfg,
              yAxisScale: v as DistributionConfig["yAxisScale"],
            })
          }
        />
      </Field>
      <Field label="Legend:">
        <Select
          value={cfg.showLegend ? "on" : "off"}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => onChange({ ...cfg, showLegend: v === "on" })}
        />
      </Field>
    </div>
  );
}
