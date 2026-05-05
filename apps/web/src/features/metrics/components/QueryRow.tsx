"use client";

import { Code, Palette, Sparkle, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { useExplorerStore } from "../store";
import type { MetricQuery } from "../types";
import { AggregatorMenu } from "./AggregatorMenu";
import { FilterEditor } from "./FilterEditor";
import { FunctionPipeline } from "./FunctionPipeline";
import { GroupByEditor } from "./GroupByEditor";
import { MetricCombobox } from "./MetricCombobox";
import { Popover } from "./Popover";

type Props = { query: MetricQuery; canRemove: boolean };

export function QueryRow({ query, canRemove }: Props) {
  const setMetric = useExplorerStore((s) => s.setMetric);
  const updateQuery = useExplorerStore((s) => s.updateQuery);
  const removeQuery = useExplorerStore((s) => s.removeQuery);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-1 items-stretch overflow-hidden rounded-md border border-[#bdc1c6] bg-white">
        <span className="flex h-7 w-7 items-center justify-center bg-[#1a73e8] text-[12px] font-semibold uppercase text-white">
          {query.alias}
        </span>
        <Divider />
        <SourcePill />
        <Divider />
        <MetricCombobox
          value={query.metricName}
          onChange={(v) => setMetric(query.id, v)}
        />
        <Divider />
        <span className="flex h-7 items-center bg-[#f1f3f4] px-2 text-[12px] text-[#5f6368]">
          from
        </span>
        <Divider />
        <FilterEditor query={query} />
        <Divider />
        <AggregatorMenu
          value={query.aggregator}
          onChange={(v) => updateQuery(query.id, { aggregator: v })}
        />
        <Divider />
        <GroupByEditor query={query} />
      </div>
      <FunctionPipeline query={query} />
      <Button
        variant="primary"
        size="sm"
        iconOnly
        title="Apply Bits AI suggestion"
      >
        <Sparkle size={14} weight="fill" />
      </Button>
      <span className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" iconOnly title="Edit as text">
          <Code size={14} />
        </Button>
        <Popover
          placement="bottom-end"
          panelClassName="w-[260px] p-3"
          trigger={
            <Button variant="ghost" size="sm" iconOnly title="Color">
              <Palette size={14} />
            </Button>
          }
        >
          <div className="text-[12px] text-[#5f6368]">
            Color override (per query) — coming soon.
          </div>
        </Popover>
        <Popover
          placement="bottom-end"
          panelClassName="w-[260px] p-3 space-y-2"
          trigger={
            <Button variant="ghost" size="sm">
              as…
            </Button>
          }
        >
          <label className="block text-[11px] uppercase tracking-wide text-[#5f6368]">
            Display name
          </label>
          <input
            value={query.displayName ?? ""}
            onChange={(e) =>
              updateQuery(query.id, {
                displayName: e.target.value || null,
              })
            }
            placeholder="alias / display name"
            className="w-full rounded-md border border-[#bdc1c6] px-2 py-1 text-[13px] outline-none focus:border-[#1a73e8]"
          />
        </Popover>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => removeQuery(query.id)}
            aria-label="Remove query"
          >
            <X size={14} weight="bold" />
          </Button>
        )}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="w-px self-stretch bg-[#bdc1c6]" aria-hidden />;
}

function SourcePill() {
  return (
    <Popover
      placement="bottom-start"
      panelClassName="min-w-[160px] py-1"
      trigger={
        <button
          type="button"
          className="flex h-7 items-center gap-1 bg-[#f1f3f4] px-2 text-[13px] text-[#202124] hover:bg-[#e8eaed]"
        >
          Metrics ▾
        </button>
      }
    >
      <ul>
        {["Metrics", "Logs", "RUM", "APM"].map((label) => (
          <li key={label}>
            <button
              type="button"
              className={`flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
                label === "Metrics" ? "text-[#1a73e8]" : "text-[#202124]"
              }`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
