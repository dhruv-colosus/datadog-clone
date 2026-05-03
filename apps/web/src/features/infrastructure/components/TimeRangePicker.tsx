"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import {
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
  useInfraStore,
} from "../store";

export function TimeRangePicker() {
  const preset = useInfraStore((s) => s.timeRangePreset);
  const setPreset = useInfraStore((s) => s.setTimeRangePreset);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = TIME_RANGE_PRESETS.find((p) => p.value === preset)!;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[13px] text-[#202124] ${
          open
            ? "border-[#1a73e8] bg-white"
            : "border-[#bdc1c6] bg-white hover:bg-[#f1f3f4]"
        }`}
      >
        <span className="flex h-6 w-7 items-center justify-center rounded-md bg-[#f1f3f4] text-[12px] text-[#5f6368]">
          {current.shortLabel}
        </span>
        <span>{current.label}</span>
        <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[520px] rounded-md border border-[#1a73e8] bg-white py-1 shadow-2xl">
          <CurrentRangeRow preset={current} />
          <ul>
            {TIME_RANGE_PRESETS.map((p) => {
              const active = p.value === preset;
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreset(p.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-[13px] ${
                      active
                        ? "bg-[#1a73e8] text-white"
                        : "text-[#202124] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-9 items-center justify-center rounded-md text-[12px] ${
                        active ? "bg-[#1763cd] text-white" : "bg-[#f1f3f4] text-[#5f6368]"
                      }`}
                    >
                      {p.shortLabel}
                    </span>
                    <span className={active ? "font-semibold" : ""}>{p.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function CurrentRangeRow({
  preset,
}: {
  preset: { value: TimeRangePreset; shortLabel: string; ms: number };
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tz = typeof Intl !== "undefined"
    ? `UTC${formatTzOffset(new Date().getTimezoneOffset())}`
    : "UTC";

  return (
    <div className="border-b border-[#e8eaed] px-3 pb-2 pt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#1a73e8]">
        {tz}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex h-6 w-9 items-center justify-center rounded-md bg-[#f1f3f4] text-[12px] text-[#5f6368]">
          {preset.shortLabel}
        </span>
        <span className="text-[13px] text-[#9aa0a6]">
          {now === null
            ? "—"
            : `${formatStamp(now - preset.ms)} – ${formatStamp(now)}`}
        </span>
      </div>
    </div>
  );
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

function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
