"use client";

import { create } from "zustand";
import type {
  HostInfoTabId,
  MapFillBy,
  MapGroupBy,
  MapMainResource,
} from "./types";

export type TimeRangePreset = "2h" | "4h" | "12h" | "1d" | "2d" | "1w";

export const TIME_RANGE_PRESETS: {
  value: TimeRangePreset;
  shortLabel: string;
  label: string;
  ms: number;
}[] = [
  { value: "2h", shortLabel: "2h", label: "Past 2 Hours", ms: 2 * 60 * 60_000 },
  { value: "4h", shortLabel: "4h", label: "Past 4 Hours", ms: 4 * 60 * 60_000 },
  { value: "12h", shortLabel: "12h", label: "Past 12 Hours", ms: 12 * 60 * 60_000 },
  { value: "1d", shortLabel: "1d", label: "Past 1 Day", ms: 24 * 60 * 60_000 },
  { value: "2d", shortLabel: "2d", label: "Past 2 Days", ms: 2 * 24 * 60 * 60_000 },
  { value: "1w", shortLabel: "1w", label: "Past 1 Week", ms: 7 * 24 * 60 * 60_000 },
];

type State = {
  selectedHostId: string | null;
  activeTab: HostInfoTabId;
  selectedAppForMetrics: string;
  searchQuery: string;
  groupByQuery: string;
  timeRangePreset: TimeRangePreset;
  mapMainResource: MapMainResource;
  mapFillBy: MapFillBy;
  mapGroupBy: MapGroupBy;
  mapQueryId: string;
  mapQueryPickerOpen: boolean;
};

type Actions = {
  selectHost: (id: string | null) => void;
  setActiveTab: (tab: HostInfoTabId) => void;
  setSelectedAppForMetrics: (app: string) => void;
  setSearchQuery: (q: string) => void;
  setGroupByQuery: (q: string) => void;
  setTimeRangePreset: (p: TimeRangePreset) => void;
  setMapMainResource: (v: MapMainResource) => void;
  setMapFillBy: (v: MapFillBy) => void;
  setMapGroupBy: (v: MapGroupBy) => void;
  setMapQueryId: (v: string) => void;
  setMapQueryPickerOpen: (v: boolean) => void;
};

export const useInfraStore = create<State & Actions>((set) => ({
  selectedHostId: null,
  activeTab: "host-info",
  selectedAppForMetrics: "container",
  searchQuery: "",
  groupByQuery: "",
  timeRangePreset: "2h",
  mapMainResource: "Host",
  mapFillBy: "CPU usage",
  mapGroupBy: "tags.availability-zone",
  mapQueryId: "cpu-by-az",
  mapQueryPickerOpen: false,
  selectHost: (id) => set({ selectedHostId: id, activeTab: "host-info" }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedAppForMetrics: (app) => set({ selectedAppForMetrics: app }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setGroupByQuery: (q) => set({ groupByQuery: q }),
  setTimeRangePreset: (p) => set({ timeRangePreset: p }),
  setMapMainResource: (v) => set({ mapMainResource: v }),
  setMapFillBy: (v) => set({ mapFillBy: v }),
  setMapGroupBy: (v) => set({ mapGroupBy: v }),
  setMapQueryId: (v) => set({ mapQueryId: v, mapQueryPickerOpen: false }),
  setMapQueryPickerOpen: (v) => set({ mapQueryPickerOpen: v }),
}));
