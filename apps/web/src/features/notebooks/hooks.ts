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
import {
  createNotebookTemplate,
  deleteNotebookTemplate,
  getNotebookTemplate,
  instantiateNotebookTemplate,
  listNotebookTemplates,
  patchNotebookTemplate,
  type CreateTemplatePayload,
  type PatchTemplatePayload,
} from "./templatesApi";
import type { Notebook, NotebookTemplate } from "./types";

const KEYS = {
  list: ["notebooks"] as const,
  byId: (id: string) => ["notebooks", id] as const,
  templatesList: ["notebook-templates"] as const,
  templateById: (id: string) => ["notebook-templates", id] as const,
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

export function useNotebookTemplates() {
  return useQuery({
    queryKey: KEYS.templatesList,
    queryFn: listNotebookTemplates,
  });
}

export function useNotebookTemplate(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.templateById(id) : KEYS.templatesList,
    queryFn: () => getNotebookTemplate(id!),
    enabled: !!id,
  });
}

export function useCreateNotebookTemplate(): UseMutationResult<
  NotebookTemplate,
  Error,
  CreateTemplatePayload
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) =>
      createNotebookTemplate(payload ?? {}),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: KEYS.templatesList });
      qc.setQueryData(KEYS.templateById(t.id), t);
    },
  });
}

export function usePatchNotebookTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchTemplatePayload) =>
      patchNotebookTemplate(id, payload),
    onSuccess: (t) => {
      qc.setQueryData(KEYS.templateById(id), t);
      qc.invalidateQueries({ queryKey: KEYS.templatesList });
    },
  });
}

export function useDeleteNotebookTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotebookTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.templatesList });
    },
  });
}

export function useInstantiateNotebookTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => instantiateNotebookTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}
