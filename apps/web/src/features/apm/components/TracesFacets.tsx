"use client";

import {
  CaretDown,
  CaretRight,
  ChartLine,
  Funnel,
  Gear,
  MagnifyingGlass,
  Pencil,
  Plus,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useApmFacets } from "../hooks";
import {
  selectTracesSearchText,
  useApmTracesStore,
} from "../store";
import type { ApmSpanStatus, ApmTracesQuery } from "../types";

const STATUS_TONE: Record<
  ApmSpanStatus,
  { label: string; bar: string }
> = {
  ok: { label: "Ok", bar: "bg-[#34a853]" },
  error: { label: "Error", bar: "bg-[#d93025]" },
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function TracesFacets() {
  const services = useApmTracesStore((s) => s.selectedServices);
  const statuses = useApmTracesStore((s) => s.selectedStatuses);
  const resources = useApmTracesStore((s) => s.selectedResources);
  const searchText = useApmTracesStore(selectTracesSearchText);
  const range = useApmTracesStore((s) => s.timeRange);
  const toggleService = useApmTracesStore((s) => s.toggleService);
  const toggleStatus = useApmTracesStore((s) => s.toggleStatus);
  const toggleResource = useApmTracesStore((s) => s.toggleResource);

  const query: ApmTracesQuery = useMemo(
    () => ({
      text: searchText,
      services: services,
      statuses: statuses,
      resources: resources,
    }),
    [searchText, services, statuses, resources],
  );

  const { data: facets } = useApmFacets(query, range);

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#e8eaed] bg-white text-[13px]">
      <div className="px-3 pb-2 pt-3">
        <div className="flex h-8 items-center gap-2 rounded-md border border-[#bdc1c6] px-2">
          <MagnifyingGlass size={14} className="text-[#5f6368]" />
          <input
            type="text"
            placeholder="Search facets"
            className="w-full bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[12px] text-[#202124]">
            <Pencil size={12} className="text-[#5f6368]" />
            Showing 55 of 55
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[12px] text-[#1a73e8] hover:underline"
          >
            <Plus size={11} weight="bold" />
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <FacetGroup heading="Core" defaultOpen>
          <FacetCollapsibleSection title="Duration" />
          <FacetCollapsibleSection title="Status" defaultOpen>
            {facets?.status.map((row) => {
              const tone = STATUS_TONE[row.value];
              return (
                <FacetRow
                  key={row.value}
                  checked={statuses.includes(row.value)}
                  onToggle={() => toggleStatus(row.value)}
                  label={tone.label}
                  count={row.count}
                  leadingIndicator={
                    <span className={`h-3 w-1 rounded-sm ${tone.bar}`} />
                  }
                />
              );
            })}
          </FacetCollapsibleSection>
          <FacetCollapsibleSection title="Env" filterable />
          <FacetCollapsibleSection title="Service" defaultOpen>
            {facets?.service.map((row) => (
              <FacetRow
                key={row.value}
                checked={services.length === 0 || services.includes(row.value)}
                onToggle={() => toggleService(row.value)}
                label={row.value}
                count={row.count}
                leadingIndicator={<ServiceDot service={row.value} />}
              />
            ))}
          </FacetCollapsibleSection>
          <FacetCollapsibleSection
            title="Resource"
            filterable
            defaultOpen
          >
            {facets?.resource.slice(0, 12).map((row) => (
              <FacetRow
                key={row.value}
                checked={
                  resources.length === 0 || resources.includes(row.value)
                }
                onToggle={() => toggleResource(row.value)}
                label={row.value}
                count={row.count}
              />
            ))}
          </FacetCollapsibleSection>
        </FacetGroup>

        <FacetGroup heading="Error Tracking">
          <FacetCollapsibleSection title="Issue ID" />
        </FacetGroup>

        <FacetGroup heading="Resource">
          <FacetCollapsibleSection title="Container" />
        </FacetGroup>
      </div>
    </aside>
  );
}

function ServiceDot({ service }: { service: string }) {
  const map: Record<string, string> = {
    web: "bg-[#a8c5f7]",
    api: "bg-[#a142f4]",
    auth: "bg-[#34a853]",
    payments: "bg-[#fbbc04]",
    worker: "bg-[#f59e0b]",
    caddy: "bg-[#10b981]",
    postgres: "bg-[#1a73e8]",
    redis: "bg-[#e8b3a8]",
  };
  const cls = map[service] ?? "bg-[#5f6368]";
  return <span className={`h-3 w-1 rounded-sm ${cls}`} />;
}

function FacetGroup({
  heading,
  defaultOpen = false,
  children,
}: {
  heading: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#e8eaed]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 bg-[#e8eaed] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368] hover:bg-[#dfe1e5]"
      >
        {open ? (
          <CaretDown size={10} weight="bold" />
        ) : (
          <CaretRight size={10} weight="bold" />
        )}
        <span>{heading}</span>
      </button>
      {open && <div className="py-0.5">{children}</div>}
    </div>
  );
}

function FacetCollapsibleSection({
  title,
  filterable = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  filterable?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showFilter, setShowFilter] = useState(filterable);
  return (
    <div className="group">
      <div className="flex items-center pr-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          {open ? (
            <CaretDown size={10} weight="bold" />
          ) : (
            <CaretRight size={10} weight="bold" />
          )}
          <span className="font-medium">{title}</span>
        </button>
        <div className="hidden items-center gap-1 group-hover:flex">
          <button
            type="button"
            aria-label="Plot facet"
            className="text-[#5f6368] hover:text-[#202124]"
          >
            <ChartLine size={12} />
          </button>
          <button
            type="button"
            aria-label="Settings"
            className="text-[#5f6368] hover:text-[#202124]"
          >
            <Gear size={12} />
          </button>
        </div>
      </div>
      {filterable && open && showFilter && (
        <div className="mx-3 mb-1 mt-1 flex h-7 items-center gap-1 rounded-md border border-[#e8eaed] px-1.5">
          <Funnel size={11} className="text-[#5f6368]" />
          <button
            type="button"
            onClick={() => setShowFilter(false)}
            aria-label="Clear filter"
            className="ml-auto text-[#5f6368] hover:text-[#202124]"
          >
            <X size={10} weight="bold" />
          </button>
        </div>
      )}
      {open && children && (
        <ul className="pl-2">
          {children}
          <li>
            <button
              type="button"
              className="ml-3 mt-1 inline-flex items-center gap-1 text-[12px] text-[#1a73e8] hover:underline"
            >
              <Plus size={10} weight="bold" />
              Show more
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function FacetRow({
  checked,
  onToggle,
  label,
  count,
  leadingIndicator,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  leadingIndicator?: React.ReactNode;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 accent-[#1a73e8]"
        />
        {leadingIndicator}
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[11px] text-[#5f6368]">{formatCount(count)}</span>
      </label>
    </li>
  );
}
