import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SavedWidget } from "./types";

type DashboardWidgetsState = {
  widgets: SavedWidget[];
  add: (widget: SavedWidget) => void;
  remove: (id: string) => void;
  byDashboard: (dashboardId: string) => SavedWidget[];
};

export const useDashboardWidgetsStore = create<DashboardWidgetsState>()(
  persist(
    (set, get) => ({
      widgets: [],
      add: (widget) => set((s) => ({ widgets: [widget, ...s.widgets] })),
      remove: (id) =>
        set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      byDashboard: (dashboardId) =>
        get().widgets.filter((w) => w.dashboardId === dashboardId),
    }),
    { name: "datadog-clone:dashboard-widgets" },
  ),
);
