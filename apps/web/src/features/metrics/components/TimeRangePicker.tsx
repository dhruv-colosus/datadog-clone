"use client";

import { CalendarBlank, CaretDown, DotsThree } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { TIME_RANGE_PRESETS } from "../constants";
import { useExplorerStore } from "../store";
import type { TimeRangePreset } from "../types";
import { Popover } from "./Popover";

function formatLabel(fromMs: number, toMs: number): string {
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    const h12 = ((hours + 11) % 12) + 1;
    return `${month} ${day}, ${h12}:${minutes} ${ampm}`;
  };
  return `${fmt(fromMs)} – ${fmt(toMs)}`;
}

export function TimeRangePicker() {
  const timeRange = useExplorerStore((s) => s.timeRange);
  const setTimeRangePreset = useExplorerStore((s) => s.setTimeRangePreset);
  const currentPreset = TIME_RANGE_PRESETS.find(
    (p) => p.value === timeRange.preset,
  );

  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[420px] py-1"
      trigger={
        <Button>
          <span className="flex h-6 w-7 items-center justify-center rounded-md bg-[#f1f3f4] text-[12px] text-[#5f6368]">
            {currentPreset?.shortLabel ?? "1h"}
          </span>
          <span>{currentPreset?.label ?? "Past 1 Hour"}</span>
          <CaretDown size={10} weight="bold" />
        </Button>
      }
    >
      {({ close }) => (
        <div>
          <div className="border-b border-[#bdc1c6] bg-[#e8f0fe] px-3 py-1.5 text-[12px] text-[#1a73e8]">
            <span className="text-[10px] uppercase tracking-wide">UTC</span>{" "}
            {formatLabel(timeRange.fromMs, timeRange.toMs)}
          </div>
          <ul className="py-1">
            {TIME_RANGE_PRESETS.map((p) => {
              const active = p.value === timeRange.preset;
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setTimeRangePreset(p.value as TimeRangePreset);
                      close();
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-1.5 text-left ${
                      active
                        ? "bg-[#1a73e8] text-white"
                        : "text-[#202124] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-9 items-center justify-center rounded-md text-[12px] ${
                        active
                          ? "bg-white/15 text-white"
                          : "bg-[#f1f3f4] text-[#5f6368]"
                      }`}
                    >
                      {p.shortLabel}
                    </span>
                    <span className="text-[13px]">{p.label}</span>
                  </button>
                </li>
              );
            })}
            <li className="my-1 h-px bg-[#bdc1c6]" />
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-[#9aa0a6]"
              >
                <span className="flex h-6 w-9 items-center justify-center rounded-md bg-[#f1f3f4]">
                  <CalendarBlank size={14} />
                </span>
                <span className="text-[13px]">Select from calendar…</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-[#9aa0a6]"
              >
                <span className="flex h-6 w-9 items-center justify-center rounded-md bg-[#f1f3f4]">
                  <DotsThree size={14} />
                </span>
                <span className="text-[13px]">More</span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </Popover>
  );
}
