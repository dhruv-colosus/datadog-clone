"use client";

import {
  ArrowsCounterClockwise,
  Article,
  ChartBar,
  ChartDonut,
  ChartLine,
  ChartLineUp,
  ChartPie,
  ChartScatter,
  Code,
  Globe,
  Image as ImageIcon,
  ListBullets,
  MagnifyingGlass,
  Note,
  Square,
  SquaresFour,
  Table,
  TextT,
  Thermometer,
  TreeStructure,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { WIDGET_TEMPLATES } from "../mock-data";
import type { WidgetTemplate, WidgetType } from "../types";

type Tab = "widgets" | "powerpacks" | "apps";

const WIDGET_ICON_MAP: Record<
  string,
  ComponentType<{
    size?: number;
    weight?: "fill" | "regular" | "bold" | "duotone";
    className?: string;
  }>
> = {
  timeseries: ChartLine,
  "query-value": Square,
  "top-list": ChartBar,
  table: Table,
  list: ListBullets,
  "pie-chart": ChartPie,
  "bar-chart": ChartBar,
  treemap: SquaresFour,
  distribution: ChartLineUp,
  heatmap: Thermometer,
  geomap: Globe,
  "scatter-plot": ChartScatter,
  "service-summary": Article,
  "alert-graph": TrendUp,
  "alert-value": Square,
  "check-status": ChartDonut,
  change: ArrowsCounterClockwise,
  group: SquaresFour,
  powerpack: TreeStructure,
  note: Note,
  "free-text": TextT,
  image: ImageIcon,
  iframe: Code,
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPickWidget: (type: WidgetType) => void;
};

export function AddWidgetsDrawer({ open, onClose, onPickWidget }: Props) {
  const [tab, setTab] = useState<Tab>("widgets");
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  // Mount on open so the slide-in transition runs from the off-screen state.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => {
        // ensure initial transform is applied before transitioning
      });
      return () => window.cancelAnimationFrame(id);
    }
    const t = window.setTimeout(() => setMounted(false), 250);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const widgets = useMemo(() => {
    if (!search.trim()) return WIDGET_TEMPLATES;
    const q = search.toLowerCase();
    return WIDGET_TEMPLATES.filter((w) => w.label.toLowerCase().includes(q));
  }, [search]);

  if (!mounted && !open) return null;

  const graphs = widgets.filter((w) => w.category === "graph");
  const groups = widgets.filter((w) => w.category === "group");
  const annotations = widgets.filter((w) => w.category === "annotation");

  return (
    <div
      className="absolute inset-0 z-40 flex"
      aria-hidden={!open}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className={`absolute inset-0 bg-black/10 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`relative z-10 flex h-full w-[360px] flex-col border-r border-[#dadce0] bg-white shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-label="Add widgets"
      >
        <div className="flex items-center justify-between border-b border-[#dadce0] px-3">
          <div className="flex">
            <TabButton active={tab === "widgets"} onClick={() => setTab("widgets")}>
              Widgets
            </TabButton>
            <TabButton
              active={tab === "powerpacks"}
              onClick={() => setTab("powerpacks")}
            >
              Powerpacks
            </TabButton>
            <TabButton active={tab === "apps"} onClick={() => setTab("apps")}>
              Apps
            </TabButton>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="border-b border-[#dadce0] p-3">
          <div className="relative">
            <MagnifyingGlass
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5f6368]"
            />
            <input
              type="text"
              placeholder="Search widgets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-[#bdc1c6] py-1.5 pl-8 pr-3 text-[12px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-3 pb-4">
          {tab === "widgets" ? (
            <>
              <WidgetSection
                title="Graphs"
                widgets={graphs}
                onPick={onPickWidget}
              />
              <WidgetSection
                title="Groups"
                widgets={groups}
                onPick={onPickWidget}
              />
              <WidgetSection
                title="Annotations"
                widgets={annotations}
                onPick={onPickWidget}
              />
            </>
          ) : (
            <div className="px-2 py-8 text-center text-[12px] text-[#5f6368]">
              {tab === "powerpacks"
                ? "Powerpack catalog coming soon."
                : "App widgets coming soon."}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-2.5 text-[12px] ${
        active ? "font-medium text-[#202124]" : "text-[#5f6368] hover:text-[#202124]"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#1a73e8]" />
      )}
    </button>
  );
}

function WidgetSection({
  title,
  widgets,
  onPick,
}: {
  title: string;
  widgets: WidgetTemplate[];
  onPick: (type: WidgetType) => void;
}) {
  if (widgets.length === 0) return null;
  return (
    <section className="mt-3">
      <h3 className="px-1 pb-1.5 text-[11px] uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-1.5">
        {widgets.map((w) => {
          const Icon = WIDGET_ICON_MAP[w.id] ?? Square;
          const usable = !!w.widgetType;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => w.widgetType && onPick(w.widgetType)}
              disabled={!usable}
              title={usable ? w.label : `${w.label} (coming soon)`}
              className={`flex flex-col items-center gap-1 rounded-md border border-[#dadce0] p-2 text-center transition-colors ${
                usable
                  ? "hover:border-[#7c3aed] hover:bg-[#faf5ff]"
                  : "opacity-60"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-md border border-[#dadce0] ${
                  usable ? "text-[#7c3aed]" : "text-[#9aa0a6]"
                }`}
              >
                <Icon size={16} weight="duotone" />
              </span>
              <span className="text-[11px] leading-tight text-[#202124]">
                {w.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
