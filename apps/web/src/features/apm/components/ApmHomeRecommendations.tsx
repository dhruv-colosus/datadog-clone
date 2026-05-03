"use client";

import { CaretDown, Lightbulb, ListMagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Popover } from "@/features/metrics/components/Popover";
import { useApmRecommendations } from "../hooks";
import { useApmHomeStore } from "../store";

const TYPE_OPTIONS: Array<{
  value: "all" | "performance" | "reliability" | "cost";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "performance", label: "Performance" },
  { value: "reliability", label: "Reliability" },
  { value: "cost", label: "Cost" },
];

export function ApmHomeRecommendations() {
  const type = useApmHomeStore((s) => s.recommendationType);
  const setType = useApmHomeStore((s) => s.setRecommendationType);
  const { data: recs } = useApmRecommendations(type);
  const isEmpty = !recs || recs.length === 0;

  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} weight="fill" className="text-[#7c3aed]" />
          <span className="text-[14px] font-semibold text-[#202124]">
            Recommendations
          </span>
          <span className="rounded-md bg-[#f3e8fd] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7c3aed]">
            New
          </span>
        </div>
        <TypeSelect value={type} onChange={setType} />
      </header>

      {isEmpty ? <EmptyState /> : <RecsList />}
    </section>
  );
}

function TypeSelect({
  value,
  onChange,
}: {
  value: "all" | "performance" | "reliability" | "cost";
  onChange: (v: "all" | "performance" | "reliability" | "cost") => void;
}) {
  const current = TYPE_OPTIONS.find((o) => o.value === value);
  return (
    <Popover
      placement="bottom-end"
      panelClassName="w-[180px] py-1"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <span className="text-[10px] uppercase tracking-wide text-[#5f6368]">
            Type
          </span>
          <span>{current?.label}</span>
          <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        </button>
      }
    >
      {({ close }) => (
        <ul>
          {TYPE_OPTIONS.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] ${
                  o.value === value
                    ? "bg-[#1a73e8] text-white"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pb-10 pt-4">
      <Lightbulb size={42} weight="fill" className="text-[#7c3aed]" />
      <h3 className="text-[18px] font-semibold text-[#202124]">
        No recommendations detected
      </h3>
      <p className="max-w-[640px] text-center text-[13px] leading-5 text-[#5f6368]">
        Datadog continuously analyzes your system for performance optimizations
        and reliability risks. When optimization opportunities or risk patterns
        are detected, they&apos;ll appear here.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <Plus size={12} weight="bold" />
          Instrument a Service
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <ListMagnifyingGlass size={13} />
          View Recent Traces
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#185abc]"
        >
          View Recommendations Page
        </button>
      </div>
    </div>
  );
}

function RecsList() {
  const { data: recs } = useApmRecommendations(
    useApmHomeStore((s) => s.recommendationType),
  );
  return (
    <ul className="divide-y divide-[#e8eaed] border-t border-[#e8eaed]">
      {recs?.map((r) => (
        <li key={r.id} className="px-4 py-3">
          <p className="text-[13px] font-medium text-[#202124]">{r.title}</p>
          <p className="mt-1 text-[12.5px] text-[#5f6368]">{r.description}</p>
        </li>
      ))}
    </ul>
  );
}

// Suppress unused import warning when component file is split later.
void useState;
