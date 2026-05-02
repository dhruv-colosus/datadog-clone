"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useState } from "react";
import { useMetricTagKeys, useMetricTagValues } from "../hooks";
import { useExplorerStore } from "../store";
import type { Filter, MetricQuery } from "../types";
import { Popover } from "./Popover";

type Props = { query: MetricQuery };

export function FilterEditor({ query }: Props) {
  const addFilter = useExplorerStore((s) => s.addFilter);
  const removeFilter = useExplorerStore((s) => s.removeFilter);
  const updateFilter = useExplorerStore((s) => s.updateFilter);
  const hasFilters = query.filters.length > 0;

  return (
    <div className="flex h-7 min-w-[160px] flex-1 items-center gap-1 bg-white px-2">
      {query.filters.map((f) => (
        <FilterPill
          key={f.id}
          metricName={query.metricName}
          filter={f}
          onChange={(patch) => updateFilter(query.id, f.id, patch)}
          onRemove={() => removeFilter(query.id, f.id)}
        />
      ))}
      <AddFilterButton
        metricName={query.metricName}
        existingTags={query.filters.map((f) => f.tag)}
        onAdd={(tag, values) =>
          addFilter(query.id, { tag, operator: "in", values })
        }
        empty={!hasFilters}
      />
    </div>
  );
}

function AddFilterButton({
  metricName,
  existingTags,
  onAdd,
  empty,
}: {
  metricName: string;
  existingTags: string[];
  onAdd: (tag: string, values: string[]) => void;
  empty: boolean;
}) {
  const [tag, setTag] = useState<string | null>(null);
  const tagKeys = useMetricTagKeys(metricName);
  const tagValues = useMetricTagValues(metricName, tag ?? "");
  const availableTags = (tagKeys.data ?? []).filter(
    (t) => !existingTags.includes(t),
  );

  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[280px] py-1"
      trigger={
        <button
          type="button"
          onClick={() => setTag(null)}
          className={`flex h-6 items-center gap-1 rounded-md px-2 text-[12px] ${
            empty
              ? "w-full text-[#5f6368] hover:bg-[#f1f3f4]"
              : "text-[#1a73e8] hover:bg-[#f1f3f4]"
          }`}
        >
          {empty ? (
            <span>(everywhere)</span>
          ) : (
            <>
              <Plus size={11} weight="bold" />
              <span>Add filter</span>
            </>
          )}
        </button>
      }
    >
      {({ close }) => {
        if (!tag) {
          return (
            <div>
              <div className="border-b border-[#bdc1c6] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#5f6368]">
                Pick a tag
              </div>
              <div className="max-h-[260px] overflow-y-auto py-1">
                {availableTags.length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-[#5f6368]">
                    No more tags available.
                  </div>
                )}
                {availableTags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTag(t)}
                    className="flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div>
            <div className="flex items-center gap-2 border-b border-[#bdc1c6] px-3 py-1.5 text-[12px]">
              <button
                type="button"
                onClick={() => setTag(null)}
                className="text-[#1a73e8] hover:underline"
              >
                ← back
              </button>
              <span className="text-[#5f6368]">tag:</span>
              <span className="font-medium text-[#202124]">{tag}</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {(tagValues.data ?? []).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => {
                    onAdd(tag, [v]);
                    close();
                    setTag(null);
                  }}
                  className="flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        );
      }}
    </Popover>
  );
}

function FilterPill({
  metricName,
  filter,
  onChange,
  onRemove,
}: {
  metricName: string;
  filter: Filter;
  onChange: (patch: Partial<Filter>) => void;
  onRemove: () => void;
}) {
  const tagValues = useMetricTagValues(metricName, filter.tag);
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md bg-[#e8f0fe] pl-1.5 text-[12px] text-[#1a73e8]">
      <span className="font-medium">{filter.tag}:</span>
      <Popover
        placement="bottom-start"
        panelClassName="w-[240px] py-1"
        trigger={
          <button
            type="button"
            className="rounded-md px-1 hover:bg-[#d2e3fc]"
          >
            {filter.values.join(", ") || "*"}
          </button>
        }
      >
        {({ close }) => (
          <div className="max-h-[240px] overflow-y-auto">
            {(tagValues.data ?? []).map((v) => {
              const checked = filter.values.includes(v);
              return (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1 text-[13px] hover:bg-[#f1f3f4]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? filter.values.filter((x) => x !== v)
                        : [...filter.values, v];
                      onChange({ values: next });
                    }}
                  />
                  <span>{v}</span>
                </label>
              );
            })}
            <div className="border-t border-[#bdc1c6] px-3 py-1.5 text-right">
              <button
                type="button"
                onClick={close}
                className="text-[12px] text-[#1a73e8] hover:underline"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-0.5 hover:bg-[#d2e3fc]"
        aria-label="Remove filter"
      >
        <X size={10} weight="bold" />
      </button>
    </span>
  );
}
