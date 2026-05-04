"use client";

import {
  TimeRangePicker as GlobalTimeRangePicker,
  type TimeRangePresetDef,
} from "@/components/ui/TimeRangePicker";
import {
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
  useInfraStore,
} from "../store";

const INFRA_PRESET_DEFS: TimeRangePresetDef[] = TIME_RANGE_PRESETS.map((p) => ({
  value: p.value,
  shortLabel: p.shortLabel,
  label: p.label,
  ms: p.ms,
}));

export function TimeRangePicker() {
  const preset = useInfraStore((s) => s.timeRangePreset);
  const setPreset = useInfraStore((s) => s.setTimeRangePreset);
  const def = TIME_RANGE_PRESETS.find((p) => p.value === preset)!;
  const now = Date.now();

  return (
    <GlobalTimeRangePicker
      value={{ preset, fromMs: now - def.ms, toMs: now }}
      presets={INFRA_PRESET_DEFS}
      onChange={(range) => {
        if (range.preset !== "custom") {
          setPreset(range.preset as TimeRangePreset);
        }
      }}
    />
  );
}
