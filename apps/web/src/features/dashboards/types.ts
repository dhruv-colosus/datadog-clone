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

export type WidgetType = "timeseries" | "pie-chart" | "table";

export type TimeseriesDisplay = "lines" | "bars" | "areas";

export type WidgetQuery = {
  id: string;
  alias: string;
  metricName: string;
  aggregator: Aggregator;
  filters: Filter[];
  groupBy: string[];
};

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  queries: WidgetQuery[];
  display?: TimeseriesDisplay;
  createdAt: number;
};

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
