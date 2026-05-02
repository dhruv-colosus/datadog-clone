"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useMetricTagKeys } from "../hooks";
import { useExplorerStore } from "../store";
import type { MetricQuery } from "../types";
import { Popover } from "./Popover";

type Props = { query: MetricQuery };

export function GroupByEditor({ query }: Props) {
  const addGroupBy = useExplorerStore((s) => s.addGroupBy);
  const removeGroupBy = useExplorerStore((s) => s.removeGroupBy);
  const tagKeys = useMetricTagKeys(query.metricName);
  const empty = query.groupBy.length === 0;
  const available = (tagKeys.data ?? []).filter(
    (t) => !query.groupBy.includes(t),
  );

  return (
    <div className="flex h-7 min-w-[140px] items-center gap-1 bg-[#fce5e8] px-2">
      {query.groupBy.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-white pl-1.5 text-[12px] text-[#202124] shadow-sm"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeGroupBy(query.id, tag)}
            className="rounded-md p-0.5 hover:bg-[#f1f3f4]"
            aria-label="Remove group by"
          >
            <X size={10} weight="bold" />
          </button>
        </span>
      ))}
      <Popover
        placement="bottom-start"
        panelClassName="w-[240px] py-1"
        trigger={
          <button
            type="button"
            className={`flex h-6 items-center gap-1 rounded-md px-2 text-[12px] ${
              empty
                ? "w-full text-[#5f6368] hover:bg-white/40"
                : "text-[#5f6368] hover:bg-white/40"
            }`}
          >
            {empty ? (
              <span>(everything)</span>
            ) : (
              <>
                <Plus size={11} weight="bold" />
                <span>Add</span>
              </>
            )}
          </button>
        }
      >
        {({ close }) => (
          <div className="max-h-[260px] overflow-y-auto">
            {available.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-[#5f6368]">
                No more tags.
              </div>
            )}
            {available.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  addGroupBy(query.id, t);
                  close();
                }}
                className="flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4]"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
