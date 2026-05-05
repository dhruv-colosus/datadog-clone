"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createRule,
  deleteRule,
  getRule,
  getSignal,
  listRules,
  listSignals,
  patchSignal,
  previewRule,
  updateRule,
  type RulePayload,
  type SignalFilters,
} from "./api";
import type { ArchiveReason, SignalStatus } from "./types";

const KEYS = {
  rules: ["security", "rules"] as const,
  rule: (id: string) => ["security", "rules", id] as const,
  signals: (filters?: SignalFilters) =>
    ["security", "signals", filters ?? {}] as const,
  signal: (id: string) => ["security", "signals", id] as const,
};

export function useDetectionRules() {
  return useQuery({ queryKey: KEYS.rules, queryFn: listRules });
}

export function useDetectionRule(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.rule(id) : ["security", "rules", "null"],
    queryFn: () => getRule(id!),
    enabled: !!id,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RulePayload) => createRule(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.rules });
    },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<RulePayload>;
    }) => updateRule(id, payload),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: KEYS.rules });
      qc.setQueryData(KEYS.rule(rule.id), rule);
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.rules });
    },
  });
}

export function usePreviewRule(id: string | undefined) {
  return useQuery({
    queryKey: id ? ["security", "rules", id, "preview"] : ["security", "preview", "null"],
    queryFn: () => previewRule(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

export function useSecuritySignals(filters?: SignalFilters) {
  return useQuery({
    queryKey: KEYS.signals(filters),
    queryFn: () => listSignals(filters),
    refetchInterval: 30_000,
  });
}

export function useSecuritySignal(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.signal(id) : ["security", "signals", "null"],
    queryFn: () => getSignal(id!),
    enabled: !!id,
  });
}

export function usePatchSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      archive_reason,
    }: {
      id: string;
      status?: SignalStatus;
      archive_reason?: ArchiveReason;
    }) => patchSignal(id, { status, archive_reason }),
    onSuccess: (signal) => {
      qc.invalidateQueries({ queryKey: ["security", "signals"] });
      qc.setQueryData(KEYS.signal(signal.id), signal);
    },
  });
}
