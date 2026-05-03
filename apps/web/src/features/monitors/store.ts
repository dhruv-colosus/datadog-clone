"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MOCK_MONITORS } from "./mock-data";
import type { Monitor, MonitorType } from "./types";

function uid(): string {
  return `mon_${Math.random().toString(36).slice(2, 10)}`;
}

type MonitorsState = {
  monitors: Monitor[];
  create: (input: { name: string; type: MonitorType }) => Monitor;
  remove: (id: string) => void;
  setMuted: (id: string, muted: boolean) => void;
  resolve: (id: string) => void;
};

export const useMonitorsStore = create<MonitorsState>()(
  persist(
    (set) => ({
      monitors: MOCK_MONITORS,
      create: ({ name, type }) => {
        const monitor: Monitor = {
          id: uid(),
          name,
          status: "OK",
          priority: null,
          type,
          pack: type === "host" ? "host" : "rum",
          tags: [],
          query: "avg(last_5m):avg:system.cpu.user{*} > 80",
          evaluationLabel: "AVG over the last 5m",
          thresholdLabel: "y > 80",
          threshold: 80,
          source: "Custom",
          createdMs: Date.now(),
          author: { name: "Vedanta Neogi", avatarColor: "#7c8a5b" },
          message: "Threshold exceeded for {{name}}.",
          recoveryMessage: "Metric has recovered. Current value: {{value}}.",
          impact:
            "Investigate this alert promptly to avoid impact on downstream services.",
          runbookSteps: [
            "Open the Metrics Explorer for the underlying query.",
            "Correlate with recent deploys and configuration changes.",
            "Page the on-call if the impact is widespread.",
          ],
          team: "support-techbrig-baeuv29da9go",
          muted: false,
        };
        set((s) => ({ monitors: [monitor, ...s.monitors] }));
        return monitor;
      },
      remove: (id) =>
        set((s) => ({ monitors: s.monitors.filter((m) => m.id !== id) })),
      setMuted: (id, muted) =>
        set((s) => ({
          monitors: s.monitors.map((m) => (m.id === id ? { ...m, muted } : m)),
        })),
      resolve: (id) =>
        set((s) => ({
          monitors: s.monitors.map((m) =>
            m.id === id ? { ...m, status: "OK" } : m,
          ),
        })),
    }),
    { name: "datadog-clone:monitors:v1" },
  ),
);
