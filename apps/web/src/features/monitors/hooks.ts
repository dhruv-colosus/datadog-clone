"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createMonitor,
  deleteMonitor,
  getMonitor,
  listMonitors,
  muteMonitor,
  patchMonitor,
  previewMonitor,
  resolveMonitor,
  unmuteMonitor,
  type CreateMonitorPayload,
  type MonitorPreviewPayload,
  type MuteDuration,
  type PatchMonitorPayload,
} from "./api";
import type { Monitor } from "./types";

const KEYS = {
  list: ["monitors"] as const,
  byId: (id: string) => ["monitors", id] as const,
};

export function useMonitors() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: listMonitors,
    refetchInterval: 30_000,
  });
}

export function useMonitor(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.byId(id) : KEYS.list,
    queryFn: () => getMonitor(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useCreateMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMonitorPayload) => createMonitor(payload),
    onSuccess: (m: Monitor) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.byId(m.id), m);
    },
  });
}

export function usePatchMonitor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchMonitorPayload) => patchMonitor(id, payload),
    onSuccess: (m: Monitor) => {
      qc.setQueryData(KEYS.byId(id), m);
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useDeleteMonitors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(deleteMonitor));
      return ids;
    },
    onSuccess: (ids) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      for (const id of ids) qc.removeQueries({ queryKey: KEYS.byId(id) });
    },
  });
}

export function useMuteMonitors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids: string[]; duration: MuteDuration }) => {
      const results = await Promise.all(
        input.ids.map((id) => muteMonitor(id, input.duration)),
      );
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      for (const m of results) qc.setQueryData(KEYS.byId(m.id), m);
    },
  });
}

export function useUnmuteMonitors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      return Promise.all(ids.map(unmuteMonitor));
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      for (const m of results) qc.setQueryData(KEYS.byId(m.id), m);
    },
  });
}

export function useMonitorPreview(payload: MonitorPreviewPayload | null) {
  return useQuery({
    queryKey: ["monitors", "preview", payload],
    queryFn: () => previewMonitor(payload!),
    enabled: !!payload && !!payload.metric,
    refetchInterval: 15_000,
  });
}

export function useResolveMonitors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      return Promise.all(ids.map(resolveMonitor));
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      for (const m of results) qc.setQueryData(KEYS.byId(m.id), m);
    },
  });
}
