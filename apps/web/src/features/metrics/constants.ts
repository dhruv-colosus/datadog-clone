import type {
  Aggregator,
  ColorPalette,
  LineStroke,
  LineStyle,
  OrderBy,
  TimeRangePreset,
  VisualizationType,
} from "./types";

export const AGGREGATORS: { value: Aggregator; label: string }[] = [
  { value: "avg", label: "avg by" },
  { value: "sum", label: "sum by" },
  { value: "min", label: "min by" },
  { value: "max", label: "max by" },
  { value: "count", label: "count by" },
];

export const ALIASES = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

export const VISUALIZATIONS: {
  value: VisualizationType;
  label: string;
}[] = [
  { value: "line", label: "Lines" },
  { value: "area", label: "Areas" },
  { value: "bar", label: "Bars" },
];

export const LINE_STYLES: { value: LineStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

export const LINE_STROKES: { value: LineStroke; label: string }[] = [
  { value: "thin", label: "Thin" },
  { value: "normal", label: "Normal" },
  { value: "thick", label: "Thick" },
];

export const ORDER_BYS: { value: OrderBy; label: string }[] = [
  { value: "tags", label: "Tags" },
  { value: "values", label: "Values" },
];

export const COLOR_PALETTES: {
  value: ColorPalette;
  label: string;
  swatches: string[];
  description: string;
}[] = [
  {
    value: "consistent",
    label: "Consistent",
    swatches: ["#f59e0b", "#3b82f6", "#10b981", "#a855f7"],
    description: "Same color for the same tag value across charts.",
  },
  {
    value: "classic",
    label: "Classic",
    swatches: ["#3b82f6", "#a3c4f3", "#bfdbfe"],
    description: "The Datadog default cool blue palette.",
  },
  {
    value: "cool",
    label: "Cool",
    swatches: ["#0d9488", "#14b8a6", "#60a5fa"],
    description: "A discrete multi-hue palette with cool shades.",
  },
  {
    value: "warm",
    label: "Warm",
    swatches: ["#dc2626", "#f97316", "#facc15"],
    description: "A discrete multi-hue palette with warm shades.",
  },
  {
    value: "purple",
    label: "Purple",
    swatches: ["#6d28d9", "#8b5cf6", "#c4b5fd"],
    description: "A discrete multi-hue palette with shades of purple.",
  },
  {
    value: "orange",
    label: "Orange",
    swatches: ["#c2410c", "#f97316", "#fdba74"],
    description: "Warm orange tones.",
  },
  {
    value: "gray",
    label: "Gray",
    swatches: ["#374151", "#6b7280", "#d1d5db"],
    description: "Greyscale palette.",
  },
  {
    value: "red",
    label: "Red",
    swatches: ["#991b1b", "#ef4444", "#fca5a5"],
    description: "Red palette.",
  },
  {
    value: "green",
    label: "Green",
    swatches: ["#166534", "#22c55e", "#86efac"],
    description: "Green palette.",
  },
  {
    value: "blue",
    label: "Blue",
    swatches: ["#1e3a8a", "#3b82f6", "#93c5fd"],
    description: "Blue palette.",
  },
  {
    value: "datadog16",
    label: "Datadog16",
    swatches: ["#22c55e", "#3b82f6", "#a855f7", "#f97316"],
    description: "16-color discrete Datadog palette.",
  },
];

export const PALETTE_COLORS: Record<ColorPalette, string[]> = {
  consistent: ["#f59e0b", "#3b82f6", "#10b981", "#a855f7", "#ef4444", "#14b8a6"],
  classic: ["#3b82f6", "#7dd3fc", "#a5b4fc", "#c4b5fd", "#fb7185", "#f59e0b"],
  cool: ["#0d9488", "#14b8a6", "#22d3ee", "#60a5fa", "#3b82f6", "#6366f1"],
  warm: ["#dc2626", "#ea580c", "#f59e0b", "#facc15", "#f97316", "#fb923c"],
  purple: ["#4c1d95", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"],
  orange: ["#7c2d12", "#9a3412", "#c2410c", "#ea580c", "#f97316", "#fdba74"],
  gray: ["#1f2937", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db"],
  red: ["#7f1d1d", "#991b1b", "#b91c1c", "#dc2626", "#ef4444", "#fca5a5"],
  green: ["#14532d", "#166534", "#15803d", "#16a34a", "#22c55e", "#86efac"],
  blue: ["#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa"],
  datadog16: [
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#f97316",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#eab308",
    "#14b8a6",
    "#6366f1",
    "#ef4444",
    "#0ea5e9",
    "#d946ef",
    "#f59e0b",
    "#10b981",
    "#8b5cf6",
  ],
};

export const TIME_RANGE_PRESETS: {
  value: TimeRangePreset;
  shortLabel: string;
  label: string;
  ms: number;
}[] = [
  { value: "5m", shortLabel: "5m", label: "Past 5 Minutes", ms: 5 * 60_000 },
  { value: "15m", shortLabel: "15m", label: "Past 15 Minutes", ms: 15 * 60_000 },
  { value: "30m", shortLabel: "30m", label: "Past 30 Minutes", ms: 30 * 60_000 },
  { value: "1h", shortLabel: "1h", label: "Past 1 Hour", ms: 60 * 60_000 },
  { value: "4h", shortLabel: "4h", label: "Past 4 Hours", ms: 4 * 60 * 60_000 },
  { value: "1d", shortLabel: "1d", label: "Past 1 Day", ms: 24 * 60 * 60_000 },
  {
    value: "2d",
    shortLabel: "2d",
    label: "Past 2 Days",
    ms: 2 * 24 * 60 * 60_000,
  },
  {
    value: "1w",
    shortLabel: "1w",
    label: "Past 1 Week",
    ms: 7 * 24 * 60 * 60_000,
  },
  {
    value: "1mo",
    shortLabel: "1mo",
    label: "Past 1 Month",
    ms: 30 * 24 * 60 * 60_000,
  },
];

export const FUNCTION_OPTIONS: {
  kind:
    | "rate"
    | "derivative"
    | "rollup"
    | "as_count"
    | "as_rate"
    | "cumulative_sum"
    | "integral"
    | "abs"
    | "log2"
    | "log10";
  label: string;
  description: string;
}[] = [
  {
    kind: "rate",
    label: "rate()",
    description: "Per-second rate of change.",
  },
  {
    kind: "derivative",
    label: "derivative()",
    description: "First derivative of the metric.",
  },
  {
    kind: "rollup",
    label: "rollup()",
    description: "Aggregate points within fixed intervals.",
  },
  { kind: "as_count", label: "as_count()", description: "Treat as raw count." },
  { kind: "as_rate", label: "as_rate()", description: "Treat as rate." },
  {
    kind: "cumulative_sum",
    label: "cumsum()",
    description: "Cumulative sum from start of range.",
  },
  {
    kind: "integral",
    label: "integral()",
    description: "Integral over time.",
  },
  { kind: "abs", label: "abs()", description: "Absolute value." },
  { kind: "log2", label: "log2()", description: "Log base 2." },
  { kind: "log10", label: "log10()", description: "Log base 10." },
];

export const ROLLUP_INTERVALS: { seconds: number; label: string }[] = [
  { seconds: 10, label: "10s" },
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
  { seconds: 600, label: "10m" },
  { seconds: 3600, label: "1h" },
];
