"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getExecution,
  listExecutions,
  listPipelines,
  listTestRuns,
  listTestServices,
  type ExecutionFilters,
} from "./api";

export function useCiPipelines() {
  return useQuery({ queryKey: ["ci", "pipelines"], queryFn: listPipelines });
}

export function useCiExecutions(filters?: ExecutionFilters) {
  return useQuery({
    queryKey: ["ci", "executions", filters ?? {}],
    queryFn: () => listExecutions(filters),
    refetchInterval: 60_000,
  });
}

export function useCiExecution(id: string | undefined) {
  return useQuery({
    queryKey: id ? ["ci", "executions", id] : ["ci", "executions", "null"],
    queryFn: () => getExecution(id!),
    enabled: !!id,
  });
}

export function useCiTestRuns(executionId?: string, status?: string[]) {
  return useQuery({
    queryKey: ["ci", "test-runs", executionId, status ?? []],
    queryFn: () => listTestRuns(executionId, status),
    enabled: !!executionId,
  });
}

export function useCiTestServices(days = 14) {
  return useQuery({
    queryKey: ["ci", "test-services", days],
    queryFn: () => listTestServices(days),
  });
}
