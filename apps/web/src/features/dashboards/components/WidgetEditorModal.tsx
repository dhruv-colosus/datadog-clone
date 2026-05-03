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
import type { TimeseriesDisplay, Widget, WidgetQuery, WidgetType } from "../types";
import { WidgetQueryRow } from "./WidgetQueryRow";
import { WidgetView } from "./widget-views";

type Props = {
  open: boolean;
  dashboardId: string;
  initialType: WidgetType;
  /** When set, edits an existing widget rather than creating a new one. */
  editingWidget?: Widget;
  onClose: () => void;
};

type VizOption = {
  type: WidgetType | "unsupported";
  label: string;
  icon: Icon;
  enabled: boolean;
};

const VISUALIZATIONS: VizOption[] = [
  { type: "timeseries", label: "Timeseries", icon: ChartLine, enabled: true },
  { type: "unsupported", label: "Query Value", icon: Square, enabled: false },
  { type: "table", label: "Table", icon: TableIcon, enabled: true },
  { type: "unsupported", label: "Heatmap", icon: Thermometer, enabled: false },
  { type: "unsupported", label: "Scatter Plot", icon: ChartScatter, enabled: false },
  { type: "unsupported", label: "Distribution", icon: TrendUp, enabled: false },
  { type: "unsupported", label: "Top List", icon: ListBullets, enabled: false },
  { type: "unsupported", label: "Bar Chart", icon: ChartBar, enabled: false },
  { type: "unsupported", label: "List", icon: ListBullets, enabled: false },
  { type: "unsupported", label: "Change", icon: ArrowsCounterClockwise, enabled: false },
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
    createdAt: Date.now(),
  };
}

function defaultTitle(type: WidgetType): string {
  if (type === "timeseries") return "Timeseries";
  if (type === "pie-chart") return "Pie Chart";
  return "Table";
}

export function WidgetEditorModal({
  open,
  dashboardId,
  initialType,
  editingWidget,
  onClose,
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
    if (editingWidget) {
      updateWidget(dashboardId, draft.id, draft);
    } else {
      addWidget(dashboardId, draft);
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
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7c3aed] text-[12px] font-semibold text-white">
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
