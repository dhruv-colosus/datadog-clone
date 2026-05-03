"use client";

import { CalendarBlank, CaretDown, DotsThree } from "@phosphor-icons/react";
import { Button } from "./Button";
import { Popover } from "@/features/metrics/components/Popover";

export type TimeRangePreset =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "2d"
  | "1w"
  | "1mo";

export type TimeRange = {
  preset: TimeRangePreset | "custom";
  fromMs: number;
  toMs: number;
};

type Preset = {
  value: TimeRangePreset;
  shortLabel: string;
  label: string;
  ms: number;
};

export const TIME_RANGE_PRESETS: Preset[] = [
  { value: "5m", shortLabel: "5m", label: "Past 5 Minutes", ms: 5 * 60_000 },
  { value: "15m", shortLabel: "15m", label: "Past 15 Minutes", ms: 15 * 60_000 },
  { value: "30m", shortLabel: "30m", label: "Past 30 Minutes", ms: 30 * 60_000 },
  { value: "1h", shortLabel: "1h", label: "Past 1 Hour", ms: 60 * 60_000 },
  { value: "4h", shortLabel: "4h", label: "Past 4 Hours", ms: 4 * 60 * 60_000 },
  { value: "1d", shortLabel: "1d", label: "Past 1 Day", ms: 24 * 60 * 60_000 },
  { value: "2d", shortLabel: "2d", label: "Past 2 Days", ms: 2 * 24 * 60 * 60_000 },
  { value: "1w", shortLabel: "1w", label: "Past 1 Week", ms: 7 * 24 * 60 * 60_000 },
  { value: "1mo", shortLabel: "1mo", label: "Past 1 Month", ms: 30 * 24 * 60 * 60_000 },
];

export function rangeFromPreset(preset: TimeRangePreset, now = Date.now()): TimeRange {
  const found = TIME_RANGE_PRESETS.find((p) => p.value === preset);
  const ms = found?.ms ?? 60 * 60_000;
  return { preset, fromMs: now - ms, toMs: now };
}

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

type TimeRangePickerProps = {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
};

export function TimeRangePicker({
  value,
  onChange,
  placement = "bottom-end",
}: TimeRangePickerProps) {
  const current = TIME_RANGE_PRESETS.find((p) => p.value === value.preset);

  return (
    <Popover
      placement={placement}
      panelClassName="w-[420px] py-1"
      trigger={
        <Button>
          <span className="flex h-6 w-7 items-center justify-center rounded-md bg-[#f1f3f4] text-[12px] text-[#5f6368]">
            {current?.shortLabel ?? "1h"}
          </span>
          <span>{current?.label ?? "Past 1 Hour"}</span>
          <CaretDown size={10} weight="bold" />
        </Button>
      }
    >
      {({ close }) => (
        <div>
          <div className="border-b border-[#bdc1c6] bg-[#e8f0fe] px-3 py-1.5 text-[12px] text-[#1a73e8]">
            <span className="text-[10px] uppercase tracking-wide">UTC</span>{" "}
            {formatLabel(value.fromMs, value.toMs)}
          </div>
          <ul className="py-1">
            {TIME_RANGE_PRESETS.map((p) => {
              const active = p.value === value.preset;
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(rangeFromPreset(p.value));
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
