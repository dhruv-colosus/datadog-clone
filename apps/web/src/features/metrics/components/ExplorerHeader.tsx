"use client";

import {
  CaretDown,
  FastForward,
  MagnifyingGlassMinus,
  Pause,
  Play,
  Rewind,
  Speedometer,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { useExplorerStore } from "../store";
import { Popover } from "./Popover";
import { TimeRangePicker } from "./TimeRangePicker";

const TABS = ["Overview", "Explorer", "Summary", "Volume"];

export function ExplorerHeader() {
  const paused = useExplorerStore((s) => s.paused);
  const togglePaused = useExplorerStore((s) => s.togglePaused);
  const setTimeRangePreset = useExplorerStore((s) => s.setTimeRangePreset);
  const timeRange = useExplorerStore((s) => s.timeRange);

  const stepRange = (direction: -1 | 1) => {
    const span = timeRange.toMs - timeRange.fromMs;
    useExplorerStore.getState().setTimeRange({
      preset: "custom",
      fromMs: timeRange.fromMs + direction * span,
      toMs: timeRange.toMs + direction * span,
    });
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-[#bdc1c6] bg-white px-4 py-2">
      <div className="flex items-center gap-2 text-[#202124]">
        <Speedometer size={20} />
        <h1 className="text-[16px] font-semibold">Metrics</h1>
      </div>
      <nav className="flex items-stretch self-stretch text-[14px]">
        {TABS.map((tab) => {
          const active = tab === "Explorer";
          return (
            <button
              key={tab}
              type="button"
              className={`relative -mb-2 flex items-end px-3 pb-3 pt-2 transition-colors ${
                active
                  ? "bg-gradient-to-b from-[#e8eaed] to-transparent font-semibold text-[#202124]"
                  : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
            >
              <span>{tab}</span>
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#202124]" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <ConfigureMetricsMenu />
        <div className="flex items-center gap-1">
          <TimeRangePicker />
          <div className="flex items-stretch overflow-hidden rounded-md border border-[#bdc1c6] bg-white">
            <GroupedIconButton
              onClick={() => stepRange(-1)}
              aria-label="Previous range"
            >
              <Rewind size={14} weight="fill" />
            </GroupedIconButton>
            <GroupedIconButton
              active={paused}
              onClick={togglePaused}
              aria-label={paused ? "Resume" : "Pause"}
            >
              {paused ? (
                <Pause size={12} weight="fill" />
              ) : (
                <Play size={12} weight="fill" />
              )}
            </GroupedIconButton>
            <GroupedIconButton
              onClick={() => stepRange(1)}
              aria-label="Next range"
            >
              <FastForward size={14} weight="fill" />
            </GroupedIconButton>
            <GroupedIconButton
              onClick={() => setTimeRangePreset("1h")}
              aria-label="Reset range"
              isLast
            >
              <MagnifyingGlassMinus size={14} />
            </GroupedIconButton>
          </div>
        </div>
      </div>
    </header>
  );
}

function GroupedIconButton({
  children,
  active,
  isLast,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex h-7 w-7 items-center justify-center transition-colors ${
        isLast ? "" : "border-r border-[#bdc1c6]"
      } ${
        active
          ? "bg-[#e8f0fe] text-[#1a73e8]"
          : "bg-white text-[#5f6368] hover:bg-[#f1f3f4]"
      }`}
    >
      {children}
    </button>
  );
}

function ConfigureMetricsMenu() {
  return (
    <Popover
      placement="bottom-end"
      panelClassName="w-[440px] grid grid-cols-[200px_1fr]"
      trigger={
        <Button>
          Configure Metrics
          <CaretDown size={10} weight="bold" />
        </Button>
      }
    >
      {({ close }) => (
        <>
          <ul className="border-r border-[#bdc1c6] py-1">
            {[
              "Manage tags",
              "Enable percentiles",
              "Enable historical metrics",
            ].map((label, idx) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={close}
                  className={`flex w-full items-center px-3 py-2 text-left text-[13px] ${
                    idx === 2
                      ? "bg-[#1a73e8] text-white"
                      : "text-[#202124] hover:bg-[#f1f3f4]"
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="p-3 text-[12px] leading-5 text-[#5f6368]">
            Correct or backfill your data to errors or processing delays.
          </div>
        </>
      )}
    </Popover>
  );
}
