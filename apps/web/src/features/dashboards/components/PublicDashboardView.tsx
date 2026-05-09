"use client";

import { CircleNotch, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import {
  TimeRangePicker,
  rangeFromPreset,
  type TimeRange,
} from "@/components/ui/TimeRangePicker";
import {
  PublicDashboardNotFoundError,
  fetchPublicDashboard,
  type DashboardResponse,
} from "../api";
import { applyTemplateVars } from "../templateVars";
import type { ShareTheme, Widget } from "../types";
import { useTemplateVarSelections } from "../useTemplateVarSelections";
import { TemplateVariableBar } from "./template-vars/TemplateVariableBar";
import { WidgetView } from "./widget-views";

type Props = {
  dashboardId: string;
};

type ResolvedTheme = "light" | "dark";

type FetchState =
  | { status: "loading" }
  | { status: "ok"; data: DashboardResponse }
  | { status: "not-found" }
  | { status: "error"; message: string };

export function PublicDashboardView({ dashboardId }: Props) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchPublicDashboard(dashboardId)
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof PublicDashboardNotFoundError) {
          setState({ status: "not-found" });
        } else {
          const message =
            err instanceof Error ? err.message : "Failed to load dashboard";
          setState({ status: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId]);

  const dashboard = state.status === "ok" ? state.data : undefined;
  const share = dashboard?.share?.public;

  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    rangeFromPreset("1h"),
  );

  useEffect(() => {
    if (share?.defaultTimeframe) {
      setTimeRange(rangeFromPreset(share.defaultTimeframe));
    }
  }, [share?.defaultTimeframe]);

  const resolvedTheme = useResolvedTheme(share?.theme ?? "auto");
  const isDark = resolvedTheme === "dark";

  if (state.status === "loading") {
    return <FullPageLoader isDark={isDark} />;
  }

  if (state.status === "not-found") {
    return (
      <UnavailableView
        title="Dashboard is not shared"
        message="This share link is invalid, the dashboard has been deleted, or public sharing has been disabled."
        isDark={isDark}
      />
    );
  }

  if (state.status === "error") {
    return (
      <UnavailableView
        title="Couldn’t load dashboard"
        message={state.message}
        isDark={isDark}
      />
    );
  }

  if (!dashboard || !share?.enabled) {
    return (
      <UnavailableView
        title="Dashboard is not shared"
        message="The owner of this dashboard has not enabled public sharing."
        isDark={isDark}
      />
    );
  }

  const widgets = dashboard.widgets ?? [];
  const templateVars = dashboard.templateVars ?? [];
  const displayName = share.shareName?.trim() || dashboard.name;
  const tzLabel = formatTzOffset(new Date().getTimezoneOffset());

  const surfaceClass = isDark
    ? "bg-[#0f1115] text-[#e8eaed]"
    : "bg-[#f8f9fa] text-[#202124]";

  return (
    <div className={`flex min-h-screen w-screen flex-col ${surfaceClass}`}>
      <header
        className={`flex items-center justify-between px-6 py-4 ${
          isDark ? "border-b border-[#1f2937]" : "border-b border-[#dadce0]"
        }`}
      >
        <h1 className="truncate text-[18px] font-medium">{displayName}</h1>
        <div className="flex items-center gap-3">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide ${
              isDark ? "text-[#7aa7f9]" : "text-[#1a73e8]"
            }`}
          >
            UTC{tzLabel}
          </span>
          {share.allowTimeframeChange ? (
            <TimeRangePicker
              value={timeRange}
              onChange={setTimeRange}
              placement="bottom-end"
            />
          ) : (
            <ReadOnlyRange range={timeRange} isDark={isDark} />
          )}
          <span
            className={`inline-flex items-center gap-1 text-[12px] ${
              isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"
            }`}
            aria-label={`${resolvedTheme} theme`}
          >
            {isDark ? (
              <Moon size={14} weight="fill" />
            ) : (
              <Sun size={14} weight="fill" />
            )}
          </span>
        </div>
      </header>

      {templateVars.length > 0 && (
        <div
          className={`px-6 py-2 ${
            isDark ? "border-b border-[#1f2937]" : "border-b border-[#dadce0]"
          }`}
        >
          <PublicTemplateVariableRow
            dashboardId={dashboardId}
            templateVars={templateVars}
          />
        </div>
      )}
      <main className="flex-1 px-6 py-6">
        {widgets.length === 0 ? (
          <div
            className={`flex h-[260px] w-full items-center justify-center rounded-md border border-dashed text-[14px] ${
              isDark
                ? "border-[#374151] text-[#9aa0a6]"
                : "border-[#dadce0] text-[#5f6368]"
            }`}
          >
            This shared dashboard has no widgets yet.
          </div>
        ) : (
          <PublicWidgetsGrid
            widgets={widgets}
            timeRange={timeRange}
            templateVars={templateVars}
            isDark={isDark}
          />
        )}
      </main>
    </div>
  );
}

function PublicTemplateVariableRow({
  dashboardId,
  templateVars,
}: {
  dashboardId: string;
  templateVars: NonNullable<DashboardResponse["templateVars"]>;
}) {
  const { selections, setSelection } = useTemplateVarSelections(templateVars);
  return (
    <TemplateVariableBar
      dashboardId={dashboardId}
      variables={templateVars}
      selections={selections}
      onSelectionChange={setSelection}
      readOnly
    />
  );
}

function PublicWidgetsGrid({
  widgets,
  timeRange,
  templateVars,
  isDark,
}: {
  widgets: Widget[];
  timeRange: TimeRange;
  templateVars: NonNullable<DashboardResponse["templateVars"]>;
  isDark: boolean;
}) {
  const { selections } = useTemplateVarSelections(templateVars);
  const effectiveWidgets = useMemo<Widget[]>(() => {
    if (templateVars.length === 0) return widgets;
    return widgets.map((w) => ({
      ...w,
      queries: w.queries.map((q) =>
        applyTemplateVars(q, templateVars, selections, w.id),
      ),
    }));
  }, [widgets, templateVars, selections]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {effectiveWidgets.map((w) => (
        <article
          key={w.id}
          className={`flex h-[260px] flex-col rounded-md border ${
            isDark
              ? "border-[#1f2937] bg-[#161a22]"
              : "border-[#dadce0] bg-white"
          }`}
        >
          <div
            className={`border-b px-3 py-2 text-[13px] font-medium ${
              isDark
                ? "border-[#1f2937] text-[#e8eaed]"
                : "border-[#f1f3f4] text-[#202124]"
            }`}
          >
            <span className="truncate">{w.title}</span>
          </div>
          <div className="min-h-0 flex-1 px-2 py-2">
            <WidgetView widget={w} timeRange={timeRange} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ReadOnlyRange({
  range,
  isDark,
}: {
  range: TimeRange;
  isDark: boolean;
}) {
  const label = `${formatLabel(range.fromMs, range.toMs)}`;
  const presetShort = range.preset === "custom" ? "•" : range.preset;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[12px] ${
        isDark
          ? "border-[#1f2937] bg-[#161a22] text-[#e8eaed]"
          : "border-[#bdc1c6] bg-white text-[#202124]"
      }`}
    >
      <span
        className={`inline-flex h-5 items-center justify-center rounded px-1.5 text-[11px] ${
          isDark ? "bg-[#1f2937] text-[#9aa0a6]" : "bg-[#f1f3f4] text-[#5f6368]"
        }`}
      >
        {presetShort}
      </span>
      <span>{label}</span>
    </div>
  );
}

export function FullPageLoader({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`flex h-screen w-screen items-center justify-center ${
        isDark ? "bg-[#0f1115] text-[#e8eaed]" : "bg-white text-[#5f6368]"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <CircleNotch
          size={28}
          weight="bold"
          className={`animate-spin ${isDark ? "text-[#7aa7f9]" : "text-[#1a73e8]"}`}
        />
        <span className="text-[13px]">Loading dashboard…</span>
      </div>
    </div>
  );
}

function UnavailableView({
  title,
  message,
  isDark,
}: {
  title: string;
  message: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex h-screen w-screen items-center justify-center ${
        isDark ? "bg-[#0f1115] text-[#e8eaed]" : "bg-white text-[#202124]"
      }`}
    >
      <div className="text-center">
        <h1 className="text-[18px] font-semibold">{title}</h1>
        <p
          className={`mt-2 text-[13px] ${
            isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"
          }`}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

function useResolvedTheme(theme: ShareTheme): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(
    theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    if (theme === "light") {
      setResolved("light");
      return;
    }
    if (theme === "dark") {
      setResolved("dark");
      return;
    }
    if (typeof window === "undefined" || !window.matchMedia) {
      setResolved("light");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setResolved(mq.matches ? "dark" : "light");
    const onChange = (e: MediaQueryListEvent) =>
      setResolved(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return resolved;
}

function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function formatLabel(fromMs: number, toMs: number): string {
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    const h12 = ((hours + 11) % 12) + 1;
    return `${month} ${day}, ${h12}:${minutes} ${ampm}`;
  };
  return `${fmt(fromMs)} – ${fmt(toMs)}`;
}
