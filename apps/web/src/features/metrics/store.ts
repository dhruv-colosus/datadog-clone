import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ALIASES } from "./constants";
import type {
  ColorPalette,
  Filter,
  Formula,
  FunctionStep,
  LineStroke,
  LineStyle,
  MetricQuery,
  OrderBy,
  TimeRange,
  TimeRangePreset,
  VisualizationType,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nextAlias(existing: string[]): string {
  for (const candidate of ALIASES) {
    if (!existing.includes(candidate)) return candidate;
  }
  return `q${existing.length + 1}`;
}

function presetTimeRange(preset: TimeRangePreset): TimeRange {
  const now = Date.now();
  const ms: Record<TimeRangePreset, number> = {
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
    "2d": 2 * 24 * 60 * 60_000,
    "1w": 7 * 24 * 60 * 60_000,
    "1mo": 30 * 24 * 60 * 60_000,
  };
  return { preset, fromMs: now - ms[preset], toMs: now };
}

function makeQuery(alias: string): MetricQuery {
  return {
    id: uid("q"),
    alias,
    metricName: "system.cpu.user",
    filters: [],
    groupBy: [],
    aggregator: "avg",
    functions: [],
    displayName: null,
    enabled: true,
  };
}

export type ExplorerState = {
  queries: MetricQuery[];
  formulas: Formula[];
  visualization: VisualizationType;
  lineStyle: LineStyle;
  lineStroke: LineStroke;
  colorPalette: ColorPalette;
  orderBy: OrderBy;
  reverseOrder: boolean;
  oneGraphPerQuery: boolean;
  timeRange: TimeRange;
  paused: boolean;

  addQuery: () => void;
  removeQuery: (id: string) => void;
  updateQuery: (id: string, patch: Partial<MetricQuery>) => void;
  setMetric: (id: string, metricName: string) => void;
  addFilter: (id: string, filter: Omit<Filter, "id">) => void;
  removeFilter: (id: string, filterId: string) => void;
  updateFilter: (
    id: string,
    filterId: string,
    patch: Partial<Filter>,
  ) => void;
  addGroupBy: (id: string, tag: string) => void;
  removeGroupBy: (id: string, tag: string) => void;
  addFunction: (id: string, fn: FunctionStep) => void;
  removeFunction: (id: string, fnId: string) => void;
  updateFunction: (
    id: string,
    fnId: string,
    patch: Partial<FunctionStep>,
  ) => void;

  addFormula: () => void;
  removeFormula: (id: string) => void;
  updateFormula: (id: string, patch: Partial<Formula>) => void;

  setVisualization: (v: VisualizationType) => void;
  setLineStyle: (v: LineStyle) => void;
  setLineStroke: (v: LineStroke) => void;
  setColorPalette: (v: ColorPalette) => void;
  setOrderBy: (v: OrderBy) => void;
  toggleReverse: () => void;
  toggleOneGraphPerQuery: () => void;

  setTimeRange: (range: TimeRange) => void;
  setTimeRangePreset: (preset: TimeRangePreset) => void;
  togglePaused: () => void;

  reset: () => void;
};

const INITIAL_QUERIES = [makeQuery("a")];

export const useExplorerStore = create<ExplorerState>()(
  persist(
    (set, get) => ({
      queries: INITIAL_QUERIES,
      formulas: [],
      visualization: "line",
      lineStyle: "solid",
      lineStroke: "normal",
      colorPalette: "classic",
      orderBy: "tags",
      reverseOrder: false,
      oneGraphPerQuery: false,
      timeRange: presetTimeRange("1h"),
      paused: true,

      addQuery: () =>
        set((s) => ({
          queries: [
            ...s.queries,
            makeQuery(nextAlias(s.queries.map((q) => q.alias))),
          ],
        })),

      removeQuery: (id) =>
        set((s) => ({ queries: s.queries.filter((q) => q.id !== id) })),

      updateQuery: (id, patch) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id ? { ...q, ...patch } : q,
          ),
        })),

      setMetric: (id, metricName) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id ? { ...q, metricName } : q,
          ),
        })),

      addFilter: (id, filter) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id
              ? {
                  ...q,
                  filters: [...q.filters, { ...filter, id: uid("f") }],
                }
              : q,
          ),
        })),

      removeFilter: (id, filterId) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id
              ? { ...q, filters: q.filters.filter((f) => f.id !== filterId) }
              : q,
          ),
        })),

      updateFilter: (id, filterId, patch) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id
              ? {
                  ...q,
                  filters: q.filters.map((f) =>
                    f.id === filterId ? { ...f, ...patch } : f,
                  ),
                }
              : q,
          ),
        })),

      addGroupBy: (id, tag) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id && !q.groupBy.includes(tag)
              ? { ...q, groupBy: [...q.groupBy, tag] }
              : q,
          ),
        })),

      removeGroupBy: (id, tag) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id
              ? { ...q, groupBy: q.groupBy.filter((g) => g !== tag) }
              : q,
          ),
        })),

      addFunction: (id, fn) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id ? { ...q, functions: [...q.functions, fn] } : q,
          ),
        })),

      removeFunction: (id, fnId) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id
              ? {
                  ...q,
                  functions: q.functions.filter((f) => f.id !== fnId),
                }
              : q,
          ),
        })),

      updateFunction: (id, fnId, patch) =>
        set((s) => ({
          queries: s.queries.map((q) =>
            q.id === id
              ? {
                  ...q,
                  functions: q.functions.map((f) =>
                    f.id === fnId ? ({ ...f, ...patch } as FunctionStep) : f,
                  ),
                }
              : q,
          ),
        })),

      addFormula: () =>
        set((s) => ({
          formulas: [
            ...s.formulas,
            { id: uid("fm"), expression: "", displayName: null },
          ],
        })),

      removeFormula: (id) =>
        set((s) => ({ formulas: s.formulas.filter((f) => f.id !== id) })),

      updateFormula: (id, patch) =>
        set((s) => ({
          formulas: s.formulas.map((f) =>
            f.id === id ? { ...f, ...patch } : f,
          ),
        })),

      setVisualization: (v) => set({ visualization: v }),
      setLineStyle: (v) => set({ lineStyle: v }),
      setLineStroke: (v) => set({ lineStroke: v }),
      setColorPalette: (v) => set({ colorPalette: v }),
      setOrderBy: (v) => set({ orderBy: v }),
      toggleReverse: () => set((s) => ({ reverseOrder: !s.reverseOrder })),
      toggleOneGraphPerQuery: () =>
        set((s) => ({ oneGraphPerQuery: !s.oneGraphPerQuery })),

      setTimeRange: (range) => set({ timeRange: range }),
      setTimeRangePreset: (preset) =>
        set({ timeRange: presetTimeRange(preset) }),
      togglePaused: () => set((s) => ({ paused: !s.paused })),

      reset: () =>
        set({
          queries: [makeQuery("a")],
          formulas: [],
          visualization: "line",
          lineStyle: "solid",
          lineStroke: "normal",
          colorPalette: "classic",
          orderBy: "tags",
          reverseOrder: false,
          oneGraphPerQuery: false,
          timeRange: presetTimeRange("1h"),
          paused: true,
        }),
    }),
    {
      name: "datadog-clone:metrics-explorer",
      partialize: (s) => ({
        queries: s.queries,
        formulas: s.formulas,
        visualization: s.visualization,
        lineStyle: s.lineStyle,
        lineStroke: s.lineStroke,
        colorPalette: s.colorPalette,
        orderBy: s.orderBy,
        reverseOrder: s.reverseOrder,
        oneGraphPerQuery: s.oneGraphPerQuery,
      }),
    },
  ),
);

export const explorerHelpers = { uid, nextAlias };
