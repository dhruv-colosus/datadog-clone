"use client";

import { useEffect, useState } from "react";
import { CalendarBlank, CaretDown, DotsThree } from "@phosphor-icons/react";
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

export type TimeRange<P extends string = TimeRangePreset> = {
  preset: P | "custom";
  fromMs: number;
  toMs: number;
};

export type TimeRangePresetDef = {
  value: string;
  shortLabel: string;
  label: string;
  ms: number;
};

export const TIME_RANGE_PRESETS: TimeRangePresetDef[] = [
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

export function rangeFromPreset<P extends string = TimeRangePreset>(
  preset: P,
  presets: TimeRangePresetDef[] = TIME_RANGE_PRESETS,
  now = Date.now(),
): TimeRange<P> {
  const found = presets.find((p) => p.value === preset);
  const ms = found?.ms ?? 60 * 60_000;
  return { preset, fromMs: now - ms, toMs: now };
}

function formatStamp(ms: number): string {
  const d = new Date(ms);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const h12 = ((hours + 11) % 12) + 1;
  return `${month} ${day}, ${h12}:${minutes} ${ampm}`;
}

function formatRange(fromMs: number, toMs: number): string {
  return `${formatStamp(fromMs)} – ${formatStamp(toMs)}`;
}

function formatTzLabel(): string {
  if (typeof Intl === "undefined") return "UTC";
  const offsetMinutes = new Date().getTimezoneOffset();
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

type TimeRangePickerProps<P extends string = TimeRangePreset> = {
  value: TimeRange<P>;
  onChange: (range: TimeRange<P>) => void;
  presets?: TimeRangePresetDef[];
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
};

export function TimeRangePicker<P extends string = TimeRangePreset>({
  value,
  onChange,
  presets = TIME_RANGE_PRESETS,
  placement = "bottom-end",
}: TimeRangePickerProps<P>) {
  const current = presets.find((p) => p.value === value.preset);
  const tz = useTzLabel();

  return (
    <Popover
      placement={placement}
      panelClassName="w-[340px] py-1"
      trigger={
        <button
          type="button"
          className="relative inline-flex h-9 w-[280px] shrink-0 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] text-[#202124] transition-colors hover:bg-[#f8f9fa] aria-expanded:border-[#1a73e8]"
        >
          <span className="pointer-events-none absolute -top-2 left-2 bg-white px-1 text-[10px] font-medium leading-none text-[#1a73e8]">
            {tz}
          </span>
          <span className="flex h-6 w-9 items-center justify-center rounded-md bg-[#f1f3f4] text-[12px] text-[#5f6368]">
            {current?.shortLabel ?? value.preset}
          </span>
          <span className="flex-1 truncate text-left">
            {value.preset === "custom"
              ? formatRange(value.fromMs, value.toMs)
              : current?.label ?? "Past 1 Hour"}
          </span>
          <CaretDown size={12} weight="bold" className="text-[#5f6368]" />
        </button>
      }
    >
      {({ close }) => (
        <div>
          <div className="px-2 pt-1.5">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#1a73e8]">
              {tz}
            </div>
            <div className="mt-1 flex items-center gap-2 rounded-md bg-[#e8f0fe] px-1.5 py-1 text-[#1a73e8]">
              <span className="flex h-5 w-8 items-center justify-center rounded bg-[#1a73e8] text-[11px] font-medium text-white">
                {current?.shortLabel ?? value.preset}
              </span>
              <span className="text-[12px] font-medium">
                {formatRange(value.fromMs, value.toMs)}
              </span>
            </div>
          </div>
          <ul className="py-1">
            {presets.map((p) => {
              const active = p.value === value.preset;
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(rangeFromPreset(p.value as P, presets));
                      close();
                    }}
                    className={`flex w-full items-center gap-2 px-2 py-1 text-left ${
                      active
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : "text-[#202124] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-8 items-center justify-center rounded text-[11px] ${
                        active
                          ? "bg-[#1a73e8] text-white"
                          : "bg-[#f1f3f4] text-[#5f6368]"
                      }`}
                    >
                      {p.shortLabel}
                    </span>
                    <span className="text-[12px]">{p.label}</span>
                  </button>
                </li>
              );
            })}
            <li className="my-1 h-px bg-[#e8eaed]" />
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 px-2 py-1 text-left text-[#9aa0a6]"
              >
                <span className="flex h-5 w-8 items-center justify-center rounded bg-[#f1f3f4]">
                  <CalendarBlank size={14} />
                </span>
                <span className="text-[12px]">Select from calendar…</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled
                className="flex w-full items-center gap-2 px-2 py-1 text-left text-[#9aa0a6]"
              >
                <span className="flex h-5 w-8 items-center justify-center rounded bg-[#f1f3f4]">
                  <DotsThree size={14} />
                </span>
                <span className="text-[12px]">More</span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </Popover>
  );
}

function useTzLabel(): string {
  const [tz, setTz] = useState("UTC");
  useEffect(() => {
    setTz(formatTzLabel());
  }, []);
  return tz;
}
