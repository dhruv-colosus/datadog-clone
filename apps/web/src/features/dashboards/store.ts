"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Dashboard,
  DashboardKind,
  DashboardShareSettings,
  Widget,
} from "./types";

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultName(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "short" });
  const month = now.toLocaleDateString("en-US", { month: "short" });
  const date = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const h12 = ((hours + 11) % 12) + 1;
  return `Vedanta's Dashboard ${day}, ${month} ${date}, ${h12}:${minutes}:${seconds} ${ampm}`;
}

type DashboardsState = {
  dashboards: Dashboard[];
  setDashboards: (dashboards: Dashboard[]) => void;
  upsertDashboard: (dashboard: Dashboard) => void;
  create: (input: { name?: string; kind: DashboardKind; teams?: string[] }) => Dashboard;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  touch: (id: string) => void;
  addWidget: (dashboardId: string, widget: Widget) => void;
  updateWidget: (
    dashboardId: string,
    widgetId: string,
    patch: Partial<Widget>,
  ) => void;
  removeWidget: (dashboardId: string, widgetId: string) => void;
  setPublicShare: (id: string, settings: DashboardShareSettings) => void;
  disablePublicShare: (id: string) => void;
  setServerId: (id: string, serverId: string) => void;
};

export const useDashboardsStore = create<DashboardsState>()(
  persist(
    (set) => ({
      dashboards: [],
      setDashboards: (dashboards) => set({ dashboards }),
      upsertDashboard: (dashboard) =>
        set((s) => {
          const idx = s.dashboards.findIndex((d) => d.id === dashboard.id);
          if (idx === -1) return { dashboards: [dashboard, ...s.dashboards] };
          const next = [...s.dashboards];
          next[idx] = { ...next[idx], ...dashboard };
          return { dashboards: next };
        }),
      create: ({ name, kind, teams }) => {
        const dashboard: Dashboard = {
          id: uid("db"),
          name: name && name.trim().length > 0 ? name.trim() : defaultName(),
          kind,
          author: { name: "Vedanta Neogi", avatarColor: "#7c8a5b" },
          modifiedMs: Date.now(),
          popularity: 5,
          teams: teams ?? [],
          widgets: [],
        };
        set((s) => ({ dashboards: [dashboard, ...s.dashboards] }));
        return dashboard;
      },
      remove: (id) =>
        set((s) => ({ dashboards: s.dashboards.filter((d) => d.id !== id) })),
      rename: (id, name) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === id ? { ...d, name, modifiedMs: Date.now() } : d,
          ),
        })),
      touch: (id) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === id ? { ...d, modifiedMs: Date.now() } : d,
          ),
        })),
      addWidget: (dashboardId, widget) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === dashboardId
              ? {
                  ...d,
                  modifiedMs: Date.now(),
                  widgets: [...(d.widgets ?? []), widget],
                }
              : d,
          ),
        })),
      updateWidget: (dashboardId, widgetId, patch) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === dashboardId
              ? {
                  ...d,
                  modifiedMs: Date.now(),
                  widgets: (d.widgets ?? []).map((w) =>
                    w.id === widgetId ? { ...w, ...patch } : w,
                  ),
                }
              : d,
          ),
        })),
      removeWidget: (dashboardId, widgetId) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === dashboardId
              ? {
                  ...d,
                  modifiedMs: Date.now(),
                  widgets: (d.widgets ?? []).filter((w) => w.id !== widgetId),
                }
              : d,
          ),
        })),
      setPublicShare: (id, settings) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === id
              ? {
                  ...d,
                  modifiedMs: Date.now(),
                  share: { ...(d.share ?? {}), public: settings },
                }
              : d,
          ),
        })),
      disablePublicShare: (id) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === id
              ? {
                  ...d,
                  modifiedMs: Date.now(),
                  share: { ...(d.share ?? {}), public: undefined },
                }
              : d,
          ),
        })),
      setServerId: (id, serverId) =>
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === id ? { ...d, serverId } : d,
          ),
        })),
    }),
    { name: "datadog-clone:dashboards:v3" },
  ),
);

export function useDashboardsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useDashboardsStore.persist.hasHydrated(),
  );
  useEffect(() => {
    const unsubFinish = useDashboardsStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useDashboardsStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsubFinish();
    };
  }, []);
  return hydrated;
}

export function suggestDefaultName(): string {
  return defaultName();
}

export function newWidgetId(): string {
  return uid("w");
}

export function newQueryId(): string {
  return uid("q");
}
