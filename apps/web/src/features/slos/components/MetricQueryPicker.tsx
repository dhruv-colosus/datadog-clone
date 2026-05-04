"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useState } from "react";
import {
  useMetricNames,
  useMetricTagKeys,
  useMetricTagValues,
} from "@/features/metrics/hooks";
import type { Filter } from "@/features/metrics/types";
import type { SLOMetricQuery } from "../types";

type Props = {
  badge: "a" | "b" | "c";
  query: SLOMetricQuery;
  onChange: (q: SLOMetricQuery) => void;
};

export function MetricQueryPicker({ badge, query, onChange }: Props) {
  const setMetric = (metricName: string) =>
    onChange({ ...query, metricName });

  const setFilters = (filters: Filter[]) => onChange({ ...query, filters });

  const filterSummary =
    query.filters.length === 0
      ? "(everywhere)"
      : query.filters
          .map(
            (f) => `${f.tag}:${f.values.join(",")}`,
          )
          .join(", ");

  return (
    <div className="rounded-md border border-[#dadce0] bg-[#fafbfc] p-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span
          className={
            "inline-flex h-6 min-w-[24px] items-center justify-center rounded text-[11px] font-medium uppercase " +
            (badge === "a"
              ? "bg-[#1a73e8] text-white"
              : badge === "b"
                ? "bg-[#34a853] text-white"
                : "bg-[#fbbc04] text-[#202124]")
          }
        >
          {badge}
        </span>

        <MetricNameField value={query.metricName} onChange={setMetric} />

        <span className="text-[#5f6368]">from</span>
        <FilterField
          metricName={query.metricName}
          filters={query.filters}
          onChange={setFilters}
        />

        <span className="text-[#5f6368]">sum by</span>
        <span className="rounded-md border border-dashed border-[#dadce0] bg-white px-2 py-1 text-[13px] text-[#9aa0a6]">
          (everything)
        </span>
      </div>
      {query.metricName ? (
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#f1f3f4] px-2 py-1 text-[11px] text-[#5f6368]">
          <span>as count</span>
          <span className="text-[#9aa0a6]">·</span>
          <span>{filterSummary}</span>
        </div>
      ) : null}
    </div>
  );
}

function MetricNameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: names = [] } = useMetricNames(search || undefined);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "min-w-[220px] rounded-md border px-2 py-1 text-left text-[13px] " +
          (value
            ? "border-[#dadce0] bg-white text-[#202124]"
            : "border-[#dadce0] bg-[#fff7d6] text-[#5f6368]")
        }
      >
        {value || "(select metric)"}
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-1 w-[320px] rounded-md border border-[#dadce0] bg-white shadow-lg">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics…"
            className="w-full border-b border-[#dadce0] px-2 py-1.5 text-[13px] outline-none"
          />
          <div className="max-h-[260px] overflow-auto">
            {names.length === 0 ? (
              <div className="px-2 py-2 text-[12px] text-[#9aa0a6]">
                No metrics found
              </div>
            ) : (
              names.slice(0, 200).map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="block w-full truncate px-2 py-1 text-left text-[13px] hover:bg-[#f1f3f4]"
                >
                  {n}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({
  metricName,
  filters,
  onChange,
}: {
  metricName: string;
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const { data: tagKeys = [] } = useMetricTagKeys(metricName);
  const [pendingTag, setPendingTag] = useState("");
  const { data: tagValues = [] } = useMetricTagValues(metricName, pendingTag);

  const addFilter = (tag: string, value: string) => {
    onChange([
      ...filters,
      {
        id: `f_${Math.random().toString(36).slice(2, 8)}`,
        tag,
        operator: "in",
        values: [value],
      },
    ]);
    setAdding(false);
    setPendingTag("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {filters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 rounded bg-[#e6f1f9] px-2 py-0.5 text-[12px] text-[#006CC2]"
        >
          {f.tag}:{f.values.join(",")}
          <button
            type="button"
            onClick={() => onChange(filters.filter((x) => x.id !== f.id))}
            className="text-[#5f6368] hover:text-[#202124]"
            aria-label="Remove filter"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
        <div className="relative flex items-center gap-1">
          {!pendingTag ? (
            <select
              autoFocus
              onChange={(e) => setPendingTag(e.target.value)}
              defaultValue=""
              className="rounded-md border border-[#dadce0] bg-white px-2 py-1 text-[12px] outline-none"
            >
              <option value="" disabled>
                Tag key…
              </option>
              {tagKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          ) : (
            <select
              autoFocus
              onChange={(e) => addFilter(pendingTag, e.target.value)}
              defaultValue=""
              className="rounded-md border border-[#dadce0] bg-white px-2 py-1 text-[12px] outline-none"
            >
              <option value="" disabled>
                Value…
              </option>
              {tagValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setPendingTag("");
            }}
            className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      ) : metricName ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded border border-dashed border-[#dadce0] bg-white px-2 py-0.5 text-[12px] text-[#5f6368] hover:border-[#1a73e8] hover:text-[#1a73e8]"
        >
          <Plus size={10} /> filter
        </button>
      ) : (
        <span className="rounded-md border border-dashed border-[#dadce0] bg-white px-2 py-1 text-[13px] text-[#9aa0a6]">
          (everywhere)
        </span>
      )}
    </div>
  );
}
