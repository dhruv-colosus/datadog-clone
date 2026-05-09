import type {
  Aggregator,
  Filter,
  MetricQuery,
} from "@/features/metrics/types";

export type DashboardKind = "dashboard" | "timeboard" | "screenboard";

export type DashboardAuthor = {
  name: string;
  avatarColor: string;
};

export type DashboardIcon =
  | "system"
  | "datadog"
  | "container"
  | "docker"
  | "user";

export type WidgetType =
  | "timeseries"
  | "pie-chart"
  | "table"
  | "query_value"
  | "top_list"
  | "heatmap"
  | "change"
  | "distribution";

export type TimeseriesDisplay = "lines" | "bars" | "areas";

export type WidgetQuery = {
  id: string;
  alias: string;
  metricName: string;
  aggregator: Aggregator;
  filters: Filter[];
  groupBy: string[];
};

// ---------- per-widget config ----------
// Mirrors the configuration surface of each Datadog widget (see
// https://docs.datadoghq.com/dashboards/widgets/<type>/). Stored as a single
// JSON blob alongside the widget so the backend stays schemaless.

export type AggregateOverTime = "avg" | "sum" | "min" | "max" | "last";

export type QueryValueConfig = {
  aggregateOverTime: AggregateOverTime;
  precision: number;
  customUnit: string | null;
  autoscale: boolean;
  textAlign: "left" | "center" | "right";
  /** Conditional formats: green/yellow/red thresholds (Datadog parity). */
  conditionalFormats: ConditionalFormat[];
};

export type ConditionalFormat = {
  comparator: ">" | ">=" | "<" | "<=";
  value: number;
  palette:
    | "white_on_green"
    | "white_on_yellow"
    | "white_on_red"
    | "green_on_white"
    | "yellow_on_white"
    | "red_on_white"
    | "custom_text";
};

export type TopListConfig = {
  display: "stacked" | "flat";
  scaling: "absolute" | "relative";
  sortDir: "asc" | "desc";
  limit: number;
  aggregateOverTime: AggregateOverTime;
};

export type HeatmapConfig = {
  yAxisScale: "linear" | "log" | "pow" | "sqrt";
  yAxisMin: number | null;
  yAxisMax: number | null;
  yAxisIncludeZero: boolean;
  numBuckets: number;
};

export type ChangeConfig = {
  compareTo: "hour_before" | "day_before" | "week_before" | "month_before";
  changeType: "absolute" | "relative";
  orderBy: "change" | "name" | "present" | "past";
  orderDir: "asc" | "desc";
  showPresent: boolean;
  /** When true, an upward trend is rendered green (else red). */
  increaseGood: boolean;
};

export type DistributionConfig = {
  /** "groups": one bucketed value per dimension; "points": all raw points. */
  histogramOf: "groups" | "points";
  aggregateOverTime: AggregateOverTime;
  numBuckets: number;
  yAxisScale: "linear" | "log";
  showLegend: boolean;
};

export type WidgetConfig = {
  query_value?: QueryValueConfig;
  top_list?: TopListConfig;
  heatmap?: HeatmapConfig;
  change?: ChangeConfig;
  distribution?: DistributionConfig;
};

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  queries: WidgetQuery[];
  display?: TimeseriesDisplay;
  config?: WidgetConfig;
  /** Grid column span on a 12-col grid. Defaults to {@link DEFAULT_WIDGET_WIDTH}. */
  width?: number;
  /** Pixel height of the widget body+chrome. Defaults to {@link DEFAULT_WIDGET_HEIGHT}. */
  height?: number;
  createdAt: number;
};

export const DASHBOARD_GRID_COLS = 12;
export const DEFAULT_WIDGET_WIDTH = 4;
export const DEFAULT_WIDGET_HEIGHT = 260;
export const MIN_WIDGET_WIDTH = 2;
export const MIN_WIDGET_HEIGHT = 140;
export const WIDGET_HEIGHT_SNAP = 20;

// ---------- defaults ----------

export function defaultQueryValueConfig(): QueryValueConfig {
  return {
    aggregateOverTime: "avg",
    precision: 2,
    customUnit: null,
    autoscale: true,
    textAlign: "center",
    conditionalFormats: [],
  };
}

export function defaultTopListConfig(): TopListConfig {
  return {
    display: "stacked",
    scaling: "absolute",
    sortDir: "desc",
    limit: 10,
    aggregateOverTime: "avg",
  };
}

export function defaultHeatmapConfig(): HeatmapConfig {
  return {
    yAxisScale: "linear",
    yAxisMin: null,
    yAxisMax: null,
    yAxisIncludeZero: false,
    numBuckets: 30,
  };
}

export function defaultChangeConfig(): ChangeConfig {
  return {
    compareTo: "hour_before",
    changeType: "relative",
    orderBy: "change",
    orderDir: "desc",
    showPresent: true,
    increaseGood: false,
  };
}

export function defaultDistributionConfig(): DistributionConfig {
  return {
    histogramOf: "groups",
    aggregateOverTime: "avg",
    numBuckets: 20,
    yAxisScale: "linear",
    showLegend: true,
  };
}

export type ShareTheme = "auto" | "light" | "dark";

export type ShareTimeframePreset =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "2d"
  | "1w"
  | "1mo";

export type DashboardShareSettings = {
  enabled: boolean;
  shareName?: string;
  defaultTimeframe: ShareTimeframePreset;
  allowTimeframeChange: boolean;
  theme: ShareTheme;
};

export type DashboardShareConfig = {
  public?: DashboardShareSettings;
};

// ---------- template variables ----------
// Datadog-style dashboard template variables. See
// https://docs.datadoghq.com/dashboards/template_variables/ for the model.
//
// Definitions live on the dashboard (persisted). The currently-selected value
// for each variable lives only in the URL as `tpl_var_<name>=<value>` so it
// survives reload/share without ever being saved on the dashboard record.

export type TemplateVariableType = "filter" | "group";

export type TemplateVariable = {
  id: string;
  /** Identifier referenced in widget queries as `$<name>`. */
  name: string;
  /** Tag key the variable filters/groups by. Often equal to `name`. */
  tagKey: string;
  type: TemplateVariableType;
  /** "*" means "all values" (no filter applied). */
  defaultValue: string;
  /** Optional captured value list — when empty the picker fetches live. */
  availableValues: string[];
  /** Widget ids the variable applies to. Empty = all widgets. */
  appliesTo: string[];
};

export type SavedView = {
  id: string;
  name: string;
  selections: Record<string, string>;
};

export const TEMPLATE_VAR_WILDCARD = "*";

export function defaultTemplateVariable(tagKey: string): TemplateVariable {
  return {
    id: `tv_${Math.random().toString(36).slice(2, 10)}`,
    name: tagKey,
    tagKey,
    type: "filter",
    defaultValue: TEMPLATE_VAR_WILDCARD,
    availableValues: [],
    appliesTo: [],
  };
}

export type Dashboard = {
  id: string;
  serverId?: string;
  name: string;
  kind: DashboardKind;
  icon?: DashboardIcon;
  author: DashboardAuthor;
  modifiedMs: number;
  popularity: number;
  teams: string[];
  widgets?: Widget[];
  share?: DashboardShareConfig;
  templateVars?: TemplateVariable[];
  savedViews?: SavedView[];
};

export type WidgetCategory = "graph" | "group" | "annotation";

export type WidgetTemplate = {
  id: string;
  label: string;
  category: WidgetCategory;
  /** When set, clicking the tile opens the editor with this concrete widget type. */
  widgetType?: WidgetType;
};

export function widgetQueryToMetricQuery(q: WidgetQuery): MetricQuery {
  return {
    id: q.id,
    alias: q.alias,
    metricName: q.metricName,
    filters: q.filters,
    groupBy: q.groupBy,
    aggregator: q.aggregator,
    functions: [],
    displayName: null,
    enabled: true,
  };
}
