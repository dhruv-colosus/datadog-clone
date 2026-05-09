"use client";

import {
  Archive,
  Article,
  Binoculars,
  Bug,
  CaretDown,
  CaretRight,
  Cloud,
  Database,
  DotsSixVertical,
  Eye,
  Funnel,
  Gauge,
  GearSix,
  MagnifyingGlass,
  PlayCircle,
  Plus,
  PuzzlePiece,
  Question,
  ShieldCheck,
  SignOut,
  Stack,
  Trash,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPipeline,
  deletePipeline,
  getLogSettings,
  listPipelineLibrary,
  listPipelines,
  patchLogSettings,
  reorderPipelines,
  updatePipeline,
} from "../api";
import type { LogPipeline, ProcessorType } from "../types";

type EnabledFilter = "all" | "enabled" | "disabled";
type TypeFilter = "all" | "integration" | "custom";
type RecencyFilter = "all" | "1h" | "24h" | "7d" | "30d";
type EditorFilter = "all" | "you" | "datadog";
type ContainsFilter = "all" | ProcessorType | "none";

const PROCESSOR_LABELS: Record<ProcessorType, string> = {
  "grok-parser": "Grok parser",
  "date-remapper": "Date remapper",
  "status-remapper": "Status remapper",
  "service-remapper": "Service remapper",
  "message-remapper": "Message remapper",
  "attribute-remapper": "Attribute remapper",
  "url-parser": "URL parser",
  "category-processor": "Category processor",
  "trace-id-remapper": "Trace ID remapper",
};

const RECENCY_MS: Record<Exclude<RecencyFilter, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function PipelinesPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ["log-pipelines"],
    queryFn: listPipelines,
  });
  const { data: settings } = useQuery({
    queryKey: ["log-config-settings"],
    queryFn: getLogSettings,
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

  const setSettings = useMutation({
    mutationFn: (
      payload: Partial<{
        anomaly_detection_enabled: boolean;
        error_tracking_enabled: boolean;
        preprocessing_json_enabled: boolean;
      }>,
    ) => patchLogSettings(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["log-config-settings"] }),
  });

  const [search, setSearch] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>("all");
  const [editorFilter, setEditorFilter] = useState<EditorFilter>("all");
  const [containsFilter, setContainsFilter] = useState<ContainsFilter>("all");
  const [pipelinesOpen, setPipelinesOpen] = useState(true);
  const [archivingOpen, setArchivingOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const orderedPipelines = useMemo(() => {
    return order
      .map((id) => pipelines?.find((p) => p.id === id))
      .filter((p): p is LogPipeline => !!p);
  }, [order, pipelines]);

  const containsOptions = useMemo(() => {
    const seen = new Set<ProcessorType>();
    for (const p of orderedPipelines) {
      for (const proc of p.processors) {
        seen.add(proc.type);
      }
    }
    return Array.from(seen);
  }, [orderedPipelines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return orderedPipelines.filter((p) => {
      if (enabledFilter === "enabled" && !p.enabled) return false;
      if (enabledFilter === "disabled" && p.enabled) return false;
      if (typeFilter === "integration" && !p.isIntegration) return false;
      if (typeFilter === "custom" && p.isIntegration) return false;
      if (recencyFilter !== "all") {
        const window = RECENCY_MS[recencyFilter];
        if (now - p.updatedMs > window) return false;
      }
      if (editorFilter !== "all") {
        const editor = p.isIntegration ? "datadog" : "you";
        if (editor !== editorFilter) return false;
      }
      if (containsFilter !== "all") {
        if (containsFilter === "none") {
          if (p.processors.length > 0) return false;
        } else if (!p.processors.some((proc) => proc.type === containsFilter)) {
          return false;
        }
      }
      if (q && !p.name.toLowerCase().includes(q) && !p.filterQuery.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [
    orderedPipelines,
    search,
    enabledFilter,
    typeFilter,
    recencyFilter,
    editorFilter,
    containsFilter,
  ]);

  const filtersActive =
    !!search.trim() ||
    enabledFilter !== "all" ||
    typeFilter !== "all" ||
    recencyFilter !== "all" ||
    editorFilter !== "all" ||
    containsFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setEnabledFilter("all");
    setTypeFilter("all");
    setRecencyFilter("all");
    setEditorFilter("all");
    setContainsFilter("all");
  };

  const activeCount = orderedPipelines.filter((p) => p.enabled).length;
  const disabledCount = orderedPipelines.length - activeCount;

  const move = (idx: number, dir: -1 | 1) => {
    const newOrder = [...order];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setOrder(newOrder);
    reorder.mutate(newOrder);
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e6e7ea] bg-white px-7 py-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-semibold text-[#202124]">Pipelines</h1>
          <a
            href="https://docs.datadoghq.com/logs/log_configuration/pipelines"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] text-[#1a73e8] hover:underline"
          >
            View docs
            <SignOut size={11} weight="bold" className="rotate-[-45deg]" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => searchRef.current?.focus()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            <MagnifyingGlass size={13} weight="bold" />
            Pipeline Scanner
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            onClick={() => setLibraryOpen(true)}
          >
            <Stack size={13} weight="bold" />
            Browse Pipeline Library
          </button>
          <button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#774aa4] px-3 text-[12.5px] font-medium text-white hover:bg-[#603981] disabled:opacity-60"
          >
            <Plus size={12} weight="bold" />
            New Pipeline
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-7 py-5">
        {/* Search */}
        <div className="relative mb-3">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#80868b]"
          />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter pipelines"
            className="h-9 w-full rounded-md border border-[#dadce0] bg-white pl-8 pr-9 text-[13px] outline-none focus:border-[#774aa4]"
          />
          <span className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[#80868b] hover:bg-[#f1f3f4]">
            <span className="font-mono text-[10px]">{"</>"}</span>
          </span>
        </div>

        {/* Filter row */}
        <div className="mb-5 flex flex-wrap items-end gap-2">
          <SelectFilter
            label="Is pipeline enabled"
            value={enabledFilter}
            onChange={(v) => setEnabledFilter(v as EnabledFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Disabled" },
            ]}
          />
          <SelectFilter
            label="Pipeline Type"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "integration", label: "Integration" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <SelectFilter
            label="Time of last edit"
            value={recencyFilter}
            onChange={(v) => setRecencyFilter(v as RecencyFilter)}
            options={[
              { value: "all", label: "Any time" },
              { value: "1h", label: "Last hour" },
              { value: "24h", label: "Last 24 hours" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
            ]}
          />
          <SelectFilter
            label="User who last edited"
            value={editorFilter}
            onChange={(v) => setEditorFilter(v as EditorFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "you", label: "You" },
              { value: "datadog", label: "Datadog" },
            ]}
          />
          <SelectFilter
            label="Contains"
            value={containsFilter}
            onChange={(v) => setContainsFilter(v as ContainsFilter)}
            options={[
              { value: "all", label: "Any processor" },
              { value: "none", label: "No processors" },
              ...containsOptions.map((t) => ({
                value: t,
                label: PROCESSOR_LABELS[t],
              })),
            ]}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-3 text-[12.5px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Flow card */}
        <div className="overflow-hidden rounded-lg border border-[#e6e7ea] bg-white">
          {/* Ingest API */}
          <FlowRow icon={<Cloud size={16} weight="duotone" className="text-[#5f6368]" />}>
            <span className="text-[13px] text-[#202124]">Ingest API</span>
          </FlowRow>

          {/* Preprocessing */}
          <FlowRow
            connector
            icon={
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#774aa4] text-white">
                <span className="text-[11px] font-bold">✓</span>
              </span>
            }
          >
            <span className="text-[13px] text-[#202124]">
              Preprocessing for JSON logs
            </span>
            <Toggle
              checked={settings?.preprocessingJsonEnabled ?? true}
              onChange={(v) =>
                setSettings.mutate({ preprocessing_json_enabled: v })
              }
            />
          </FlowRow>

          {/* Pipelines block */}
          <div className="relative">
            <ConnectorLine />
            <div className="bg-[#fafbfc]">
              <button
                type="button"
                onClick={() => setPipelinesOpen((v) => !v)}
                className="flex w-full items-center gap-2 border-b border-[#e6e7ea] px-5 py-2.5 text-left hover:bg-[#f1f3f4]"
              >
                {pipelinesOpen ? (
                  <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
                ) : (
                  <CaretRight size={11} weight="bold" className="text-[#5f6368]" />
                )}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                  Pipelines
                </span>
                <span className="text-[12px] text-[#5f6368]">
                  {activeCount} active
                </span>
                <span className="text-[#bdc1c6]">|</span>
                <span className="text-[12px] text-[#5f6368]">
                  {disabledCount} disabled
                </span>
              </button>

              {pipelinesOpen && (
                <div>
                  {/* table header */}
                  <div className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 border-b border-[#e6e7ea] bg-white px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#5f6368]">
                    <div />
                    <div>Pipeline Name</div>
                    <div>Usage</div>
                    <div>Tags</div>
                    <div>Filters</div>
                    <div>Last Edited</div>
                    <div>By</div>
                    <div />
                  </div>

                  {isLoading && (
                    <div className="px-5 py-6 text-[13px] text-[#5f6368]">
                      Loading pipelines…
                    </div>
                  )}

                  {!isLoading && filtered.length === 0 && (
                    <div className="px-5 py-6 text-center text-[13px] text-[#5f6368]">
                      {orderedPipelines.length === 0
                        ? "No pipelines yet. Click “New Pipeline” to add one."
                        : "No pipelines match the current filters."}
                    </div>
                  )}

                  <ul>
                    {filtered.map((p, idxInFiltered) => {
                      const realIdx = order.indexOf(p.id);
                      return (
                        <li
                          key={p.id}
                          className="group grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 border-b border-[#f1f3f4] bg-white px-5 py-2.5 hover:bg-[#fafbfc]"
                        >
                          <button
                            type="button"
                            onClick={() => router.push(`/logs/pipelines/${p.id}`)}
                            className="flex items-center gap-1 text-[#5f6368]"
                            aria-label="Open pipeline"
                          >
                            <CaretRight size={11} weight="bold" />
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#774aa4] text-[10px] font-bold text-white">
                              {realIdx + 1}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/logs/pipelines/${p.id}`)}
                            className="flex min-w-0 items-center gap-1.5 text-left"
                          >
                            <span className="truncate text-[13px] font-medium text-[#202124] hover:text-[#1a73e8]">
                              {p.name}
                            </span>
                            {p.isIntegration && (
                              <PuzzlePiece
                                size={12}
                                weight="duotone"
                                className="shrink-0 text-[#774aa4]"
                              />
                            )}
                          </button>
                          <div className="text-[12px] text-[#5f6368]">—</div>
                          <div className="text-[12px] text-[#5f6368]">
                            {p.integrationName ?? "—"}
                          </div>
                          <div className="min-w-0 truncate">
                            {p.filterQuery ? (
                              <span className="inline-flex items-center gap-1 rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[11px] text-[#202124]">
                                <Funnel size={10} className="text-[#5f6368]" />
                                {p.filterQuery}
                              </span>
                            ) : (
                              <span className="text-[12px] text-[#5f6368]">—</span>
                            )}
                          </div>
                          <div className="text-[12px] text-[#5f6368]">
                            {new Date(p.updatedMs).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="truncate text-[12px] text-[#5f6368]">
                            {p.isIntegration ? "Datadog" : "You"}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Toggle
                              checked={p.enabled}
                              onChange={(v) => update.mutate({ id: p.id, enabled: v })}
                            />
                            <button
                              type="button"
                              className="hidden h-6 w-6 items-center justify-center rounded text-[#5f6368] hover:bg-[#fde7e7] hover:text-[#d32f2f] group-hover:flex"
                              aria-label="Delete"
                              onClick={() => {
                                if (confirm(`Delete pipeline "${p.name}"?`))
                                  del.mutate(p.id);
                              }}
                            >
                              <Trash size={12} />
                            </button>
                            <span className="cursor-grab text-[#bdc1c6] hover:text-[#5f6368]">
                              <DotsSixVertical
                                size={14}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (e.shiftKey) move(idxInFiltered, -1);
                                  else move(idxInFiltered, 1);
                                }}
                              />
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Add new pipeline */}
                  <button
                    type="button"
                    disabled={create.isPending}
                    onClick={() => create.mutate()}
                    className="flex w-full items-center gap-2 px-5 py-3 text-left hover:bg-[#fafbfc] disabled:opacity-60"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#1a73e8] text-[#1a73e8]">
                      <Plus size={11} weight="bold" />
                    </span>
                    <span className="text-[13px] font-medium text-[#1a73e8]">
                      Add a new pipeline
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Standard Attributes */}
          <FlowRow
            connector
            icon={
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#774aa4] text-white">
                <span className="text-[11px] font-bold">✓</span>
              </span>
            }
            href="/logs/pipelines/standard-attributes"
          >
            <span className="text-[13px] text-[#1a73e8] hover:underline">
              Standard Attributes
            </span>
          </FlowRow>

          {/* Sensitive Data Scanner */}
          <FlowRow
            connector
            icon={
              <Eye
                size={16}
                weight="duotone"
                className="text-[#774aa4]"
              />
            }
            href="/security/data-security/rules"
          >
            <span className="text-[13px] text-[#1a73e8] hover:underline">
              Sensitive Data Scanner
            </span>
          </FlowRow>

          {/* Security Rules */}
          <FlowRow
            connector
            icon={<ShieldCheck size={16} weight="duotone" className="text-[#774aa4]" />}
            href="/security/rules"
          >
            <span className="text-[13px] text-[#1a73e8] hover:underline">
              Security Rules
            </span>
          </FlowRow>

          {/* Error Tracking */}
          <FlowRow
            connector
            icon={<Bug size={16} weight="duotone" className="text-[#774aa4]" />}
          >
            <span className="text-[13px] text-[#1a73e8] hover:underline">
              Error Tracking
            </span>
            <Question
              size={13}
              weight="bold"
              className="cursor-help text-[#bdc1c6] hover:text-[#5f6368]"
            />
          </FlowRow>

          {/* Log Anomaly Detection */}
          <FlowRow
            connector
            icon={<Binoculars size={16} weight="duotone" className="text-[#774aa4]" />}
          >
            <span className="text-[13px] text-[#202124]">
              Log Anomaly Detection
            </span>
            <Toggle
              checked={settings?.anomalyDetectionEnabled ?? true}
              onChange={(v) =>
                setSettings.mutate({ anomaly_detection_enabled: v })
              }
            />
          </FlowRow>

          {/* Branching tail rows: Live Tail / Generate Metrics / Indexes / Archiving */}
          <div className="relative">
            <ConnectorLine />
            <BranchRow
              icon={<PlayCircle size={15} weight="duotone" className="text-[#774aa4]" />}
              label="Live Tail"
              href="/logs?live=1"
            />
            <BranchRow
              icon={<Gauge size={15} weight="duotone" className="text-[#774aa4]" />}
              label="Generate Metrics"
              href="/logs/pipelines/generate-metrics"
            />
            <BranchRow
              icon={<Database size={15} weight="duotone" className="text-[#774aa4]" />}
              label="Indexes"
              href="/logs/pipelines/indexes"
            />
            <button
              type="button"
              onClick={() => setArchivingOpen((v) => !v)}
              className="flex w-full items-center gap-3 border-t border-[#f1f3f4] bg-white px-5 py-2.5 text-left hover:bg-[#fafbfc]"
            >
              {archivingOpen ? (
                <CaretDown size={11} weight="bold" className="text-[#5f6368]" />
              ) : (
                <CaretRight size={11} weight="bold" className="text-[#5f6368]" />
              )}
              <Article size={15} weight="duotone" className="text-[#774aa4]" />
              <span className="text-[13px] text-[#202124]">
                Archiving &amp; Forwarding
              </span>
            </button>
            {archivingOpen && (
              <div className="border-t border-[#f1f3f4] bg-[#fafbfc] pl-6">
                <BranchRow
                  icon={<Archive size={14} weight="duotone" className="text-[#774aa4]" />}
                  label="External Archives"
                  href="/logs/pipelines/archiving"
                />
                <BranchRow
                  icon={<GearSix size={14} weight="duotone" className="text-[#774aa4]" />}
                  label="Custom Destinations"
                  href="/logs/pipelines/archiving#destinations"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {libraryOpen && (
        <PipelineLibraryDialog
          onClose={() => setLibraryOpen(false)}
          nextOrderIndex={order.length}
          onCreated={(p) => {
            setLibraryOpen(false);
            qc.invalidateQueries({ queryKey: ["log-pipelines"] });
            router.push(`/logs/pipelines/${p.id}`);
          }}
        />
      )}
    </div>
  );
}

function FlowRow({
  icon,
  children,
  connector,
  href,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  connector?: boolean;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
  return (
    <div
      className={`relative border-t border-[#f1f3f4] bg-white ${
        href ? "hover:bg-[#fafbfc]" : ""
      }`}
    >
      {connector && <ConnectorLine />}
      {href ? <Link href={href}>{content}</Link> : content}
    </div>
  );
}

function BranchRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-t border-[#f1f3f4] bg-white px-5 py-2.5 hover:bg-[#fafbfc]"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="text-[13px] text-[#1a73e8] hover:underline">{label}</span>
    </Link>
  );
}

function ConnectorLine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[27px] top-0 h-full w-px bg-[#dadce0]"
    />
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative inline-block h-[18px] w-8 rounded-full bg-[#bdc1c6] transition-colors peer-checked:bg-[#1a73e8]">
        <span className="absolute left-0.5 top-0.5 inline-block h-[14px] w-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
      </span>
    </label>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-[#5f6368]">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-[170px] appearance-none rounded-md border border-[#dadce0] bg-white pl-3 pr-7 text-[12.5px] text-[#202124] outline-none focus:border-[#774aa4] disabled:bg-[#f8f9fb] disabled:text-[#5f6368]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <CaretDown
          size={11}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5f6368]"
        />
      </div>
    </label>
  );
}

function PipelineLibraryDialog({
  onClose,
  nextOrderIndex,
  onCreated,
}: {
  onClose: () => void;
  nextOrderIndex: number;
  onCreated: (pipeline: LogPipeline) => void;
}) {
  const { data: library, isLoading } = useQuery({
    queryKey: ["log-pipelines-library"],
    queryFn: listPipelineLibrary,
  });
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (item: { name: string; integration: string }) =>
      createPipeline({
        name: item.name,
        filter_query: `source:${item.integration}`,
        processors: [],
        order_index: nextOrderIndex,
      }),
    onSuccess: (p) => onCreated(p),
    onSettled: () => setPendingId(null),
  });

  const filtered = useMemo(() => {
    if (!library) return [];
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.integration.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q),
    );
  }, [library, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Pipeline Library"
        className="w-[680px] max-h-[80vh] overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#dadce0] px-5 py-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#202124]">
              Pipeline Library
            </h3>
            <p className="mt-0.5 text-[12px] text-[#5f6368]">
              Pre-built pipelines for popular integrations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] text-[#5f6368] hover:text-[#202124]"
          >
            Close
          </button>
        </div>
        <div className="border-b border-[#e6e7ea] px-5 py-3">
          <div className="relative">
            <MagnifyingGlass
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#80868b]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              placeholder="Search the library"
              className="h-8 w-full rounded-md border border-[#dadce0] bg-white pl-8 pr-3 text-[12.5px] outline-none focus:border-[#774aa4]"
            />
          </div>
        </div>
        <ul className="max-h-[440px] overflow-y-auto">
          {isLoading && (
            <li className="px-5 py-6 text-[12.5px] text-[#5f6368]">
              Loading library…
            </li>
          )}
          {!isLoading && filtered.length === 0 && (
            <li className="px-5 py-6 text-center text-[12.5px] text-[#5f6368]">
              No library entries match.
            </li>
          )}
          {filtered.map((item) => {
            const id = `${item.integration}:${item.name}`;
            const busy = pendingId === id && create.isPending;
            return (
              <li
                key={id}
                className="flex items-start gap-3 border-b border-[#f1f3f4] px-5 py-3 last:border-b-0"
              >
                <PuzzlePiece
                  size={16}
                  weight="duotone"
                  className="mt-0.5 shrink-0 text-[#774aa4]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[#202124]">
                    {item.name}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#5f6368]">
                    {item.description}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[10.5px] text-[#5f6368]">
                    source:{item.integration}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || create.isPending}
                  onClick={() => {
                    setPendingId(id);
                    create.mutate(item);
                  }}
                  className="shrink-0 rounded-md bg-[#774aa4] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#603981] disabled:opacity-60"
                >
                  {busy ? "Adding…" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
