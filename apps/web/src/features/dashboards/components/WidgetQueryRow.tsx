"use client";

import {
  CaretDown,
  Code,
  MagnifyingGlass,
  Palette,
  Plus,
  Sparkle,
  Sigma,
  X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MetricCombobox } from "@/features/metrics/components/MetricCombobox";
import { Popover } from "@/features/metrics/components/Popover";
import {
  useMetricTagKeys,
  useMetricTagValues,
} from "@/features/metrics/hooks";
import type { Aggregator, Filter } from "@/features/metrics/types";
import { newQueryId } from "../store";
import type { WidgetQuery } from "../types";

type Props = {
  query: WidgetQuery;
  canRemove: boolean;
  onChange: (patch: Partial<WidgetQuery>) => void;
  onRemove: () => void;
};

export function WidgetQueryRow({ query, canRemove, onChange, onRemove }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-stretch overflow-hidden rounded-md border border-[#bdc1c6] bg-white">
          <span className="flex h-7 w-7 items-center justify-center bg-[#7c3aed] text-[12px] font-semibold uppercase text-white">
            {query.alias}
          </span>
          <Divider />
          <SourcePill />
          <Divider />
          <span className="flex h-7 items-center bg-[#f1f3f4] px-2 text-[12px] text-[#5f6368]">
            of
          </span>
          <Divider />
          <MetricCombobox
            value={query.metricName}
            onChange={(v) => onChange({ metricName: v })}
          />
          <Divider />
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"
            aria-label="Search"
          >
            <MagnifyingGlass size={12} />
          </button>
          <Divider />
          <FilterInput
            metricName={query.metricName}
            filters={query.filters}
            onChange={(filters) => onChange({ filters })}
          />
        </div>
        <Button variant="primary" size="sm" iconOnly title="Apply Bits AI suggestion">
          <Sparkle size={14} weight="fill" />
        </Button>
        <Button variant="ghost" size="sm" iconOnly title="Edit as text">
          <Code size={14} />
        </Button>
        <Button variant="ghost" size="sm" iconOnly title="Color">
          <Palette size={14} />
        </Button>
        <Button variant="ghost" size="sm" title="Display name">
          as…
        </Button>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onRemove}
            aria-label="Remove query"
          >
            <X size={14} weight="bold" />
          </Button>
        )}
      </div>

      <div className="ml-7 flex flex-wrap items-center gap-1.5 text-[12px]">
        <Connector />
        <Chip>Show</Chip>
        <ShowAggregatorChip
          value={query.aggregator}
          onChange={(v) => onChange({ aggregator: v })}
        />
        <Chip className="bg-[#fef7d6]">{query.metricName || "metric"}</Chip>
        <Chip>by</Chip>
        <GroupByChips
          metricName={query.metricName}
          groupBy={query.groupBy}
          onChange={(groupBy) => onChange({ groupBy })}
        />
        <Chip>rollup</Chip>
        <Chip>every</Chip>
        <Chip>20s (auto)</Chip>
        <button
          type="button"
          className="flex h-6 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12px] text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <Sigma size={12} />
          Modify
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <span className="w-px self-stretch bg-[#bdc1c6]" aria-hidden />;
}

function Connector() {
  return (
    <span
      aria-hidden
      className="-ml-3 mr-1 inline-block h-3 w-3 border-b border-l border-[#bdc1c6]"
    />
  );
}

function Chip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex h-6 items-center rounded bg-[#f1f3f4] px-2 text-[#5f6368] ${className}`}
    >
      {children}
    </span>
  );
}

function ShowAggregatorChip({
  value,
  onChange,
}: {
  value: Aggregator;
  onChange: (v: Aggregator) => void;
}) {
  const labels: Record<Aggregator, string> = {
    avg: "Average of",
    sum: "Sum of",
    min: "Min of",
    max: "Max of",
    count: "Count of",
  };
  const opts: Aggregator[] = ["avg", "sum", "min", "max", "count"];
  return (
    <Popover
      placement="bottom-start"
      panelClassName="min-w-[160px] py-1"
      trigger={
        <button
          type="button"
          className="flex h-6 items-center gap-1 rounded bg-[#f1f3f4] px-2 text-[12px] text-[#202124] hover:bg-[#e8eaed]"
        >
          {labels[value]}
          <CaretDown size={9} weight="bold" />
        </button>
      }
    >
      {({ close }) => (
        <ul>
          {opts.map((a) => (
            <li key={a}>
              <button
                type="button"
                onClick={() => {
                  onChange(a);
                  close();
                }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
                  a === value
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "text-[#202124]"
                }`}
              >
                {labels[a]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

function GroupByChips({
  metricName,
  groupBy,
  onChange,
}: {
  metricName: string;
  groupBy: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: tagKeys } = useMetricTagKeys(metricName);
  const available = (tagKeys ?? []).filter((k) => !groupBy.includes(k));

  return (
    <span className="flex items-center gap-1">
      {groupBy.length === 0 ? (
        <span className="flex h-6 items-center rounded bg-[#fce7f3] px-2 text-[#9d174d]">
          (everything)
        </span>
      ) : (
        groupBy.map((g) => (
          <span
            key={g}
            className="flex h-6 items-center gap-1 rounded bg-[#fce7f3] px-2 text-[#9d174d]"
          >
            {g}
            <button
              type="button"
              onClick={() => onChange(groupBy.filter((x) => x !== g))}
              className="hover:text-[#831843]"
              aria-label={`Remove group by ${g}`}
            >
              <X size={10} weight="bold" />
            </button>
          </span>
        ))
      )}
      <Popover
        placement="bottom-start"
        panelClassName="min-w-[200px] max-h-[260px] overflow-auto py-1"
        trigger={
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded bg-[#fce7f3] text-[#9d174d] hover:bg-[#fbcfe8]"
            aria-label="Add group by"
          >
            <Plus size={11} weight="bold" />
          </button>
        }
      >
        {({ close }) => (
          <ul>
            {!metricName && (
              <li className="px-3 py-2 text-[12px] text-[#5f6368]">
                Pick a metric first.
              </li>
            )}
            {metricName && available.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-[#5f6368]">
                No more tags.
              </li>
            )}
            {available.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...groupBy, k]);
                    close();
                  }}
                  className="flex w-full items-center px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                >
                  {k}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </span>
  );
}

function FilterInput({
  metricName,
  filters,
  onChange,
}: {
  metricName: string;
  filters: Filter[];
  onChange: (next: Filter[]) => void;
}) {
  return (
    <div className="flex flex-1 items-center gap-1.5 px-2">
      {filters.map((f) => (
        <span
          key={f.id}
          className="flex h-6 items-center gap-1 rounded bg-[#e8f0fe] px-2 text-[12px] text-[#1a73e8]"
        >
          {f.tag}:{f.values.join(",") || "*"}
          <button
            type="button"
            onClick={() => onChange(filters.filter((x) => x.id !== f.id))}
            aria-label={`Remove filter ${f.tag}`}
            className="hover:text-[#1765cc]"
          >
            <X size={10} weight="bold" />
          </button>
        </span>
      ))}
      <AddFilterButton
        metricName={metricName}
        onAdd={(f) => onChange([...filters, f])}
      />
    </div>
  );
}

function AddFilterButton({
  metricName,
  onAdd,
}: {
  metricName: string;
  onAdd: (f: Filter) => void;
}) {
  const [tag, setTag] = useState<string | null>(null);
  const { data: tagKeys } = useMetricTagKeys(metricName);
  const { data: tagValues } = useMetricTagValues(metricName, tag ?? "");

  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[260px] max-h-[300px] overflow-auto py-1"
      trigger={
        <button
          type="button"
          className="flex-1 truncate text-left text-[12px] text-[#9aa0a6] hover:text-[#5f6368]"
          aria-label="Add filter"
        >
          Filter your metric data
        </button>
      }
    >
      {({ close }) => (
        <div className="flex flex-col">
          {!tag ? (
            <>
              <div className="border-b border-[#dadce0] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#5f6368]">
                Tag
              </div>
              <ul>
                {(tagKeys ?? []).map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setTag(k)}
                      className="flex w-full items-center px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                    >
                      {k}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="border-b border-[#dadce0] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#5f6368]">
                {tag}
              </div>
              <ul>
                {(tagValues ?? []).map((v) => (
                  <li key={v}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd({
                          id: newQueryId(),
                          tag,
                          operator: "in",
                          values: [v],
                        });
                        setTag(null);
                        close();
                      }}
                      className="flex w-full items-center px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                    >
                      {v}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

function SourcePill() {
  const sources: { label: string; enabled: boolean }[] = [
    { label: "Metrics", enabled: true },
    { label: "RUM", enabled: false },
    { label: "Logs", enabled: false },
    { label: "APM", enabled: false },
  ];
  return (
    <Popover
      placement="bottom-start"
      panelClassName="min-w-[160px] py-1"
      trigger={
        <button
          type="button"
          className="flex h-7 items-center gap-1 bg-[#1a73e8] px-2 text-[13px] text-white hover:bg-[#1765cc]"
        >
          Metrics
          <CaretDown size={9} weight="bold" />
        </button>
      }
    >
      <ul>
        {sources.map(({ label, enabled }) => (
          <li key={label}>
            <button
              type="button"
              disabled={!enabled}
              title={enabled ? label : `${label} (coming soon)`}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] ${
                label === "Metrics"
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : enabled
                    ? "text-[#202124] hover:bg-[#f1f3f4]"
                    : "text-[#9aa0a6]"
              }`}
            >
              <span>{label}</span>
              {!enabled && (
                <span className="text-[10px] uppercase tracking-wide text-[#9aa0a6]">
                  Soon
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

