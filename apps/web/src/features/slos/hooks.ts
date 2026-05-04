"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  createBurnRateAlert,
  createSLO,
  deleteBurnRateAlert,
  deleteSLO,
  fetchBurnRate,
  fetchSLOHistory,
  getSLO,
  listBurnRateAlerts,
  listSLOs,
  patchSLO,
  type CreateBurnRateAlertPayload,
  type CreateSLOPayload,
  type PatchSLOPayload,
} from "./api";
import type { SLO } from "./types";

const KEYS = {
  list: ["slos"] as const,
  byId: (id: string) => ["slos", id] as const,
  history: (id: string) => ["slos", id, "history"] as const,
  burnRate: (id: string) => ["slos", id, "burn-rate"] as const,
  alerts: (id: string) => ["slos", id, "alerts"] as const,
};

export function useSLOs() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: listSLOs,
    refetchInterval: 30_000,
  });
}

export function useSLO(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.byId(id) : KEYS.list,
    queryFn: () => getSLO(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useSLOHistory(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.history(id) : KEYS.list,
    queryFn: () => fetchSLOHistory(id!),
    enabled: !!id,
  });
}

export function useSLOBurnRate(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.burnRate(id) : KEYS.list,
    queryFn: () => fetchBurnRate(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useSLOAlerts(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.alerts(id) : KEYS.list,
    queryFn: () => listBurnRateAlerts(id!),
    enabled: !!id,
  });
}

export function useCreateSLO(): UseMutationResult<
  SLO,
  Error,
  CreateSLOPayload
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSLO,
    onSuccess: (slo) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.byId(slo.id), slo);
    },
  });
}

export function usePatchSLO(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchSLOPayload) => patchSLO(id, payload),
    onSuccess: (slo) => {
      qc.setQueryData(KEYS.byId(id), slo);
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useDeleteSLO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSLO,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useCreateBurnRateAlert(sloId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBurnRateAlertPayload) =>
      createBurnRateAlert(sloId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.alerts(sloId) });
      qc.invalidateQueries({ queryKey: KEYS.burnRate(sloId) });
    },
  });
}

export function useDeleteBurnRateAlert(sloId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => deleteBurnRateAlert(sloId, alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.alerts(sloId) });
      qc.invalidateQueries({ queryKey: KEYS.burnRate(sloId) });
    },
  });
}
