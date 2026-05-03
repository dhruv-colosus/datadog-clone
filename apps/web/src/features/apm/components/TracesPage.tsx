"use client";

import { CaretDoubleRight, Question } from "@phosphor-icons/react";
import { TimeRangePicker } from "@/components/ui/TimeRangePicker";
import { useApmTracesStore } from "../store";
import { ApmHeader } from "./ApmHeader";
import { TracesFacets } from "./TracesFacets";
import { TracesQueryBar } from "./TracesQueryBar";
import { TracesTable } from "./TracesTable";

export function TracesPage() {
  const range = useApmTracesStore((s) => s.timeRange);
  const setRange = useApmTracesStore((s) => s.setTimeRange);
  const showControls = useApmTracesStore((s) => s.showControls);
  const toggleControls = useApmTracesStore((s) => s.toggleControls);

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <ApmHeader>
        <TimeRangePicker value={range} onChange={setRange} />
        <button
          type="button"
          aria-label="Help"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <Question size={14} weight="bold" />
        </button>
      </ApmHeader>

      <TracesQueryBar />

      <div className="flex items-center gap-1 border-b border-[#e8eaed] bg-white px-4 py-2">
        <button
          type="button"
          onClick={toggleControls}
          className="inline-flex items-center gap-1 text-[12.5px] text-[#1a73e8] hover:underline"
        >
          <CaretDoubleRight
            size={11}
            weight="bold"
            className={showControls ? "rotate-180" : ""}
          />
          {showControls ? "Hide Controls" : "Show Controls"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showControls && <TracesFacets />}
        <TracesTable />
      </div>
    </div>
  );
}
