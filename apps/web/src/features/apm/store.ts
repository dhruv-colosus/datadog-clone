import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ApmSearchToken,
  ApmSpanStatus,
  ApmTimeRange,
  ApmTimeRangePreset,
  ApmTracesVisualization,
} from "./types";

function presetTimeRange(preset: ApmTimeRangePreset): ApmTimeRange {
  const now = Date.now();
  const ms: Record<ApmTimeRangePreset, number> = {
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
    "2d": 2 * 24 * 60 * 60_000,
    "1w": 7 * 24 * 60 * 60_000,
  };
  return { preset, fromMs: now - ms[preset], toMs: now };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const ALL_STATUSES: ApmSpanStatus[] = ["ok", "error"];

export type ApmTracesState = {
  tokens: ApmSearchToken[];
  freeText: string;
  timeRange: ApmTimeRange;
  paused: boolean;
  visualization: ApmTracesVisualization;
  searchMode: "spans" | "traces";
  showControls: boolean;

  selectedServices: string[];
  selectedStatuses: ApmSpanStatus[];
  selectedResources: string[];

  expandedSpanId: string | null;

  addToken: (key: string, value: string) => void;
  removeToken: (id: string) => void;
  setFreeText: (text: string) => void;
  clearSearch: () => void;

  setTimeRange: (range: ApmTimeRange) => void;
  setTimeRangePreset: (preset: ApmTimeRangePreset) => void;
  togglePaused: () => void;

  setVisualization: (vis: ApmTracesVisualization) => void;
  setSearchMode: (mode: "spans" | "traces") => void;
  toggleControls: () => void;

  toggleService: (svc: string) => void;
  toggleStatus: (status: ApmSpanStatus) => void;
  toggleResource: (resource: string) => void;
  setSelectedServices: (services: string[]) => void;
  setSelectedResources: (resources: string[]) => void;
  setSelectedStatuses: (statuses: ApmSpanStatus[]) => void;

  setExpandedSpan: (id: string | null) => void;

  reset: () => void;
};

const INITIAL_TOKENS: ApmSearchToken[] = [
  { id: "tok_initial_env", key: "env", value: "prod" },
];

export const useApmTracesStore = create<ApmTracesState>()(
  persist(
    (set) => ({
      tokens: INITIAL_TOKENS,
      freeText: "",
      timeRange: presetTimeRange("15m"),
      paused: false,
      visualization: "list",
      searchMode: "spans",
      showControls: true,

      selectedServices: [],
      selectedStatuses: ALL_STATUSES,
      selectedResources: [],

      expandedSpanId: null,

      addToken: (key, value) =>
        set((s) => ({
          tokens: [...s.tokens, { id: uid("tok"), key, value }],
        })),
      removeToken: (id) =>
        set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),
      setFreeText: (text) => set({ freeText: text }),
      clearSearch: () => set({ tokens: [], freeText: "" }),

      setTimeRange: (range) => set({ timeRange: range }),
      setTimeRangePreset: (preset) =>
        set({ timeRange: presetTimeRange(preset) }),
      togglePaused: () => set((s) => ({ paused: !s.paused })),

      setVisualization: (vis) => set({ visualization: vis }),
      setSearchMode: (mode) => set({ searchMode: mode }),
      toggleControls: () => set((s) => ({ showControls: !s.showControls })),

      toggleService: (svc) =>
        set((s) => ({
          selectedServices: s.selectedServices.includes(svc)
            ? s.selectedServices.filter((x) => x !== svc)
            : [...s.selectedServices, svc],
        })),
      toggleStatus: (status) =>
        set((s) => ({
          selectedStatuses: s.selectedStatuses.includes(status)
            ? s.selectedStatuses.filter((x) => x !== status)
            : [...s.selectedStatuses, status],
        })),
      toggleResource: (resource) =>
        set((s) => ({
          selectedResources: s.selectedResources.includes(resource)
            ? s.selectedResources.filter((x) => x !== resource)
            : [...s.selectedResources, resource],
        })),
      setSelectedServices: (services) => set({ selectedServices: services }),
      setSelectedResources: (resources) => set({ selectedResources: resources }),
      setSelectedStatuses: (statuses) => set({ selectedStatuses: statuses }),

      setExpandedSpan: (id) => set({ expandedSpanId: id }),

      reset: () =>
        set({
          tokens: INITIAL_TOKENS,
          freeText: "",
          timeRange: presetTimeRange("15m"),
          paused: false,
          visualization: "list",
          searchMode: "spans",
          showControls: true,
          selectedServices: [],
          selectedStatuses: ALL_STATUSES,
          selectedResources: [],
          expandedSpanId: null,
        }),
    }),
    {
      name: "datadog-clone:apm-traces:v1",
      partialize: (s) => ({
        tokens: s.tokens,
        freeText: s.freeText,
        visualization: s.visualization,
        searchMode: s.searchMode,
        showControls: s.showControls,
        selectedServices: s.selectedServices,
        selectedStatuses: s.selectedStatuses,
        selectedResources: s.selectedResources,
      }),
    },
  ),
);

export type ApmHomeState = {
  envFilter: string;
  recommendationType: "all" | "performance" | "reliability" | "cost";
  serviceSearch: string;
  setEnvFilter: (env: string) => void;
  setRecommendationType: (
    t: "all" | "performance" | "reliability" | "cost",
  ) => void;
  setServiceSearch: (s: string) => void;
};

export const useApmHomeStore = create<ApmHomeState>((set) => ({
  envFilter: "prod",
  recommendationType: "all",
  serviceSearch: "",
  setEnvFilter: (env) => set({ envFilter: env }),
  setRecommendationType: (t) => set({ recommendationType: t }),
  setServiceSearch: (s) => set({ serviceSearch: s }),
}));

export type ApmServiceDetailTab =
  | "summary"
  | "resources"
  | "deployments"
  | "dependencies"
  | "traces"
  | "errors"
  | "infrastructure"
  | "databases"
  | "logs"
  | "security";

export type ApmServiceDetailState = {
  tab: ApmServiceDetailTab;
  resourceSearch: string;
  setTab: (t: ApmServiceDetailTab) => void;
  setResourceSearch: (s: string) => void;
};

export const useApmServiceDetailStore = create<ApmServiceDetailState>(
  (set) => ({
    tab: "summary",
    resourceSearch: "",
    setTab: (t) => set({ tab: t }),
    setResourceSearch: (s) => set({ resourceSearch: s }),
  }),
);

export function selectTracesSearchText(s: ApmTracesState): string {
  const tokensStr = s.tokens.map((t) => `${t.key}:${t.value}`).join(" ");
  return [tokensStr, s.freeText].filter(Boolean).join(" ").trim();
}
