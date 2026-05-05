"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getStory,
  listStories,
  patchStory,
  type WatchdogFilters,
} from "./api";
import type { WatchdogStatus } from "./types";

const KEYS = {
  list: (filters?: WatchdogFilters) =>
    ["watchdog", "stories", filters ?? {}] as const,
  byId: (id: string) => ["watchdog", "stories", id] as const,
};

export function useWatchdogStories(filters?: WatchdogFilters) {
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: () => listStories(filters),
    refetchInterval: 30_000,
  });
}

export function useWatchdogStory(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.byId(id) : ["watchdog", "stories", "null"],
    queryFn: () => getStory(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function usePatchWatchdogStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WatchdogStatus }) =>
      patchStory(id, status),
    onSuccess: (story) => {
      qc.invalidateQueries({ queryKey: ["watchdog", "stories"] });
      qc.setQueryData(KEYS.byId(story.id), story);
    },
  });
}
