export type Aggregator = "avg" | "sum" | "min" | "max" | "count";

export type RollupMethod = "avg" | "sum" | "min" | "max" | "count";

export type FunctionKind =
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

export type FunctionStep =
  | { id: string; kind: "rate" }
  | { id: string; kind: "derivative" }
  | {
      id: string;
      kind: "rollup";
      method: RollupMethod;
      intervalSeconds: number;
    }
  | { id: string; kind: "as_count" }
  | { id: string; kind: "as_rate" }
  | { id: string; kind: "cumulative_sum" }
  | { id: string; kind: "integral" }
  | { id: string; kind: "abs" }
  | { id: string; kind: "log2" }
  | { id: string; kind: "log10" };

export type Filter = {
  id: string;
  tag: string;
  operator: "in" | "not in";
  values: string[];
};

export type MetricQuery = {
  id: string;
  alias: string;
  metricName: string;
  filters: Filter[];
  groupBy: string[];
  aggregator: Aggregator;
  functions: FunctionStep[];
  displayName: string | null;
  enabled: boolean;
};

export type Formula = {
  id: string;
  expression: string;
  displayName: string | null;
};

export type VisualizationType =
  | "line"
  | "bar"
  | "area"
  | "heatmap"
  | "toplist"
  | "query_value";

export type LineStyle = "solid" | "dashed" | "dotted";
export type LineStroke = "thin" | "normal" | "thick";

export type ColorPalette =
  | "consistent"
  | "classic"
  | "cool"
  | "warm"
  | "purple"
  | "orange"
  | "gray"
  | "red"
  | "green"
  | "blue"
  | "datadog16";

export type OrderBy = "tags" | "values";

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

export type SeriesPoint = {
  t: number;
  value: number;
};

export type Series = {
  queryId: string;
  alias: string;
  label: string;
  groupTags: Record<string, string>;
  points: SeriesPoint[];
};

export type Dashboard = {
  id: string;
  name: string;
};

export type SavedWidget = {
  id: string;
  title: string;
  dashboardId: string;
  visualization: VisualizationType;
  queries: MetricQuery[];
  formulas: Formula[];
  createdAt: number;
};
