"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createTask,
  declareFromMonitor,
  declareIncident,
  getIncident,
  listIncidents,
  patchIncident,
  patchTask,
  postTimeline,
  upsertPostmortem,
  type DeclareIncidentPayload,
  type IncidentFilters,
  type PatchIncidentPayload,
} from "./api";
import type { TaskStatus } from "./types";

const KEYS = {
  list: (filters?: IncidentFilters) =>
    ["incidents", filters ?? {}] as const,
  byId: (id: string) => ["incidents", id] as const,
};

export function useIncidents(filters?: IncidentFilters) {
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: () => listIncidents(filters),
    refetchInterval: 30_000,
  });
}

export function useIncident(id: string | undefined) {
  return useQuery({
    queryKey: id ? KEYS.byId(id) : ["incidents", "null"],
    queryFn: () => getIncident(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useDeclareIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeclareIncidentPayload) => declareIncident(payload),
    onSuccess: (incident) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}

export function useDeclareFromMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      monitorId,
      overrides,
    }: {
      monitorId: string;
      overrides?: Partial<DeclareIncidentPayload>;
    }) => declareFromMonitor(monitorId, overrides),
    onSuccess: (incident) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}

export function usePatchIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PatchIncidentPayload }) =>
      patchIncident(id, payload),
    onSuccess: (incident) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}

export function usePostTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      kind,
      payload,
    }: {
      id: string;
      kind?: string;
      payload: Record<string, unknown>;
    }) => postTimeline(id, { kind, payload }),
    onSuccess: (incident) => {
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      title,
      assignee,
    }: {
      id: string;
      title: string;
      assignee?: string;
    }) => createTask(id, { title, assignee_label: assignee }),
    onSuccess: (incident) => {
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}

export function usePatchTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      taskId,
      status,
    }: {
      id: string;
      taskId: string;
      status: TaskStatus;
    }) => patchTask(id, taskId, { status }),
    onSuccess: (incident) => {
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}

export function useUpsertPostmortem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      content,
      status,
    }: {
      id: string;
      content: string;
      status?: "draft" | "published";
    }) => upsertPostmortem(id, { content, status }),
    onSuccess: (incident) => {
      qc.setQueryData(KEYS.byId(incident.id), incident);
    },
  });
}
