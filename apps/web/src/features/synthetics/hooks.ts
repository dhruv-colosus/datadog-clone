"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  createSyntheticTest,
  deleteSyntheticTest,
  getSyntheticTest,
  listSyntheticEvents,
  listSyntheticResults,
  listSyntheticTests,
  patchSyntheticTest,
  runOnce,
  runSyntheticTest,
  type CreateSyntheticPayload,
  type PatchSyntheticPayload,
  type RunOncePayload,
} from "./api";
import type { SyntheticResult, SyntheticTest } from "./types";

const KEYS = {
  list: ["synthetics"] as const,
  byId: (id: string) => ["synthetics", id] as const,
  results: (id: string) => ["synthetics", id, "results"] as const,
  events: ["synthetics", "events"] as const,
};

export function useSyntheticTests() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: listSyntheticTests,
    refetchInterval: 30_000,
  });
}

export function useSyntheticTest(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.byId(id) : KEYS.list,
    queryFn: () => getSyntheticTest(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useSyntheticResults(id: string | undefined, limit = 100) {
  return useQuery({
    queryKey: id ? KEYS.results(id) : KEYS.list,
    queryFn: () => listSyntheticResults(id!, limit),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useSyntheticEvents(limit = 50) {
  return useQuery({
    queryKey: KEYS.events,
    queryFn: () => listSyntheticEvents(limit),
    refetchInterval: 30_000,
  });
}

export function useCreateSyntheticTest(): UseMutationResult<
  SyntheticTest,
  Error,
  CreateSyntheticPayload
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSyntheticTest,
    onSuccess: (test) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.byId(test.id), test);
    },
  });
}

export function usePatchSyntheticTest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchSyntheticPayload) =>
      patchSyntheticTest(id, payload),
    onSuccess: (test) => {
      qc.setQueryData(KEYS.byId(id), test);
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useDeleteSyntheticTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSyntheticTest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useRunSyntheticTest(): UseMutationResult<
  SyntheticResult[],
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runSyntheticTest,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.byId(id) });
      qc.invalidateQueries({ queryKey: KEYS.results(id) });
      qc.invalidateQueries({ queryKey: KEYS.events });
    },
  });
}

export function useRunOnce(): UseMutationResult<
  SyntheticResult[],
  Error,
  RunOncePayload
> {
  return useMutation({ mutationFn: runOnce });
}
