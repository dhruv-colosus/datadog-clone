"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  patchNotebook,
  type CreateNotebookPayload,
  type PatchNotebookPayload,
} from "./api";
import type { Notebook } from "./types";

const KEYS = {
  list: ["notebooks"] as const,
  byId: (id: string) => ["notebooks", id] as const,
};

export function useNotebooks() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: listNotebooks,
  });
}

export function useNotebook(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.byId(id) : KEYS.list,
    queryFn: () => getNotebook(id!),
    enabled: !!id,
  });
}

export function useCreateNotebook(): UseMutationResult<
  Notebook,
  Error,
  CreateNotebookPayload
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNotebookPayload) => createNotebook(payload ?? {}),
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.setQueryData(KEYS.byId(nb.id), nb);
    },
  });
}

export function usePatchNotebook(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchNotebookPayload) => patchNotebook(id, payload),
    onSuccess: (nb) => {
      qc.setQueryData(KEYS.byId(id), nb);
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useDeleteNotebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotebook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}
