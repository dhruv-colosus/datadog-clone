"use client";

import {
  ArrowDown,
  ArrowUp,
  Faders,
  ListMagnifyingGlass,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  createPipeline,
  deletePipeline,
  listPipelines,
  reorderPipelines,
  updatePipeline,
} from "../api";
import type { LogPipeline } from "../types";

export function PipelinesList() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: pipelines, isLoading } = useQuery({
    queryKey: ["log-pipelines"],
    queryFn: listPipelines,
  });
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    if (pipelines) setOrder(pipelines.map((p) => p.id));
  }, [pipelines]);

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderPipelines(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log-pipelines"] }),
  });

  const update = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updatePipeline(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log-pipelines"] }),
  });

  const create = useMutation({
    mutationFn: () =>
      createPipeline({
        name: "New pipeline",
        filter_query: "",
        processors: [],
        order_index: order.length,
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["log-pipelines"] });
      router.push(`/logs/pipelines/${p.id}`);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePipeline(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log-pipelines"] }),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const newOrder = [...order];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setOrder(newOrder);
    reorder.mutate(newOrder);
  };

  const orderedPipelines = order
    .map((id) => pipelines?.find((p) => p.id === id))
    .filter((p): p is LogPipeline => !!p);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Faders}
        title="Logs Pipelines"
        breadcrumbs={[{ label: "Logs", href: "/logs" }]}
        subtitle="Filter logs, then mutate attributes through ordered processors"
        actions={
          <>
            <a
              href="/logs/pipelines/library"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              Pipeline library
            </a>
            <a
              href="/logs/configuration/facets"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              Facets
            </a>
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              <Plus size={13} weight="bold" />
              New pipeline
            </button>
          </>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && <div className="text-[13px] text-[#5f6368]">Loading…</div>}
        {!isLoading && orderedPipelines.length === 0 && (
          <div className="rounded-md border border-dashed border-[#bdc1c6] p-12 text-center text-[13px] text-[#5f6368]">
            <ListMagnifyingGlass size={32} className="mx-auto mb-2 opacity-50" />
            No pipelines yet. Click "New pipeline" to add one.
          </div>
        )}
        <ul className="space-y-2">
          {orderedPipelines.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-[#dadce0] bg-white px-3 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-30"
                >
                  <ArrowUp size={11} weight="bold" />
                </button>
                <button
                  type="button"
                  disabled={i === orderedPipelines.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-30"
                >
                  <ArrowDown size={11} weight="bold" />
                </button>
              </div>

              <div className="flex-1 cursor-pointer" onClick={() => router.push(`/logs/pipelines/${p.id}`)}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#202124]">
                    {p.name}
                  </span>
                  {p.filterQuery && (
                    <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[11px] text-[#1a73e8]">
                      {p.filterQuery}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#5f6368]">
                  {p.processors.length} processor{p.processors.length === 1 ? "" : "s"} ·
                  updated {new Date(p.updatedMs).toLocaleString()}
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) =>
                    update.mutate({ id: p.id, enabled: e.target.checked })
                  }
                  className="peer sr-only"
                />
                <span className="relative inline-block h-4 w-7 rounded-full bg-[#bdc1c6] transition-colors peer-checked:bg-[#1a73e8]">
                  <span className="absolute left-0.5 top-0.5 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete pipeline "${p.name}"?`)) del.mutate(p.id);
                }}
                aria-label="Delete"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#5f6368] hover:bg-[#fde7e7] hover:text-[#d32f2f]"
              >
                <Trash size={13} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
