"use client";

import { TimeRangePicker as GlobalTimeRangePicker } from "@/components/ui/TimeRangePicker";
import { useExplorerStore } from "../store";
import type { TimeRangePreset } from "../types";

export function TimeRangePicker() {
  const timeRange = useExplorerStore((s) => s.timeRange);
  const setTimeRangePreset = useExplorerStore((s) => s.setTimeRangePreset);
  const setTimeRange = useExplorerStore((s) => s.setTimeRange);

  return (
    <GlobalTimeRangePicker
      placement="bottom-start"
      value={timeRange}
      onChange={(range) => {
        if (range.preset !== "custom") {
          setTimeRangePreset(range.preset as TimeRangePreset);
        } else {
          setTimeRange(range);
        }
      }}
    />
  );
}
