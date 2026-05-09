import {
  DASHBOARD_GRID_COLS,
  DEFAULT_WIDGET_HEIGHT,
  DEFAULT_WIDGET_WIDTH,
  type Dashboard,
  type Widget,
  type WidgetQuery,
  type WidgetType,
} from "./types";

// ---------- Datadog dashboard JSON shape ----------
// Mirrors the export format Datadog produces when you click "Export dashboard
// JSON" in the Share menu (see https://docs.datadoghq.com/dashboards/widgets/).
// We only emit the subset of fields we can faithfully reconstruct from our
// internal model — extra fields Datadog ships (e.g. notify_list members,
// global time defaults) are emitted as empty defaults.

type DatadogQuery = {
  data_source: "metrics";
  name: string;
  query: string;
  aggregator: string;
};

type DatadogRequest = {
  response_format: "timeseries" | "scalar";
  queries: DatadogQuery[];
  style?: {
    palette: string;
    order_by: string;
    line_type: string;
    line_width: string;
  };
  display_type?: "line" | "bars" | "area";
};

type DatadogWidgetDefinition = {
  title: string;
  title_size: string;
  title_align: string;
  type: string;
  requests: DatadogRequest[];
  show_legend?: boolean;
  legend_layout?: string;
  legend_columns?: string[];
  time?: Record<string, never>;
};

type DatadogWidget = {
  id: number;
  definition: DatadogWidgetDefinition;
  layout: { x: number; y: number; width: number; height: number };
};

export type DatadogDashboardJson = {
  title: string;
  description: string | null;
  widgets: DatadogWidget[];
  template_variables: unknown[];
  layout_type: "ordered" | "free";
  notify_list: unknown[];
  pause_auto_refresh: boolean;
  reflow_type: "fixed" | "auto";
};

const WIDGET_TYPE_MAP: Record<WidgetType, string> = {
  timeseries: "timeseries",
  "pie-chart": "pie_chart",
  table: "query_table",
  query_value: "query_value",
  top_list: "toplist",
  heatmap: "heatmap",
  change: "change",
  distribution: "distribution",
};

const DISPLAY_MAP: Record<NonNullable<Widget["display"]>, "line" | "bars" | "area"> = {
  lines: "line",
  bars: "bars",
  areas: "area",
};

function queryToString(q: WidgetQuery): string {
  const filterStr = q.filters
    .filter((f) => f.tag && f.values.length > 0)
    .map((f) => {
      const expr =
        f.values.length === 1
          ? `${f.tag}:${f.values[0]}`
          : `${f.tag}:(${f.values.join(" OR ")})`;
      return f.operator === "not in" ? `!${expr}` : expr;
    })
    .join(",");
  const scope = filterStr ? `{${filterStr}}` : "{*}";
  const groupBy = q.groupBy.length > 0 ? ` by {${q.groupBy.join(",")}}` : "";
  return `${q.aggregator}:${q.metricName || "*"}${scope}${groupBy}`;
}

function widgetToDatadogQueries(w: Widget): DatadogQuery[] {
  return w.queries.map((q, idx) => ({
    data_source: "metrics",
    name: q.alias?.trim() || `query${idx + 1}`,
    query: queryToString(q),
    aggregator: q.aggregator,
  }));
}

function widgetToDefinition(w: Widget): DatadogWidgetDefinition {
  const queries = widgetToDatadogQueries(w);
  const isTimeseries = w.type === "timeseries";
  const responseFormat: "timeseries" | "scalar" = isTimeseries
    ? "timeseries"
    : "scalar";

  const request: DatadogRequest = {
    response_format: responseFormat,
    queries,
  };
  if (isTimeseries) {
    request.style = {
      palette: "dog_classic",
      order_by: "values",
      line_type: "solid",
      line_width: "normal",
    };
    request.display_type = DISPLAY_MAP[w.display ?? "lines"];
  }

  const def: DatadogWidgetDefinition = {
    title: w.title,
    title_size: "16",
    title_align: "left",
    type: WIDGET_TYPE_MAP[w.type] ?? w.type,
    requests: [request],
  };
  if (isTimeseries) {
    def.show_legend = true;
    def.legend_layout = "auto";
    def.legend_columns = ["avg", "min", "max", "value", "sum"];
    def.time = {};
  }
  return def;
}

// Pack widgets onto a 12-col grid in row-major order. Internal widgets don't
// store x/y — they flow — so we synthesize positions that match the rendered
// layout closely enough for re-import.
function computeLayouts(widgets: Widget[]): {
  x: number;
  y: number;
  width: number;
  height: number;
}[] {
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  return widgets.map((w) => {
    const width = Math.min(
      DASHBOARD_GRID_COLS,
      w.width ?? DEFAULT_WIDGET_WIDTH,
    );
    // Datadog layout heights are in grid units (~50px each).
    const heightUnits = Math.max(
      1,
      Math.round((w.height ?? DEFAULT_WIDGET_HEIGHT) / 50),
    );

    if (cursorX + width > DASHBOARD_GRID_COLS) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    const layout = { x: cursorX, y: cursorY, width, height: heightUnits };
    cursorX += width;
    rowHeight = Math.max(rowHeight, heightUnits);
    return layout;
  });
}

// 16-digit numeric IDs match what Datadog assigns to exported widgets. Our
// internal widget ids are uuid-like strings, so we generate fresh ones for
// the export.
function generateWidgetId(): number {
  // Random 16-digit positive integer, computed from two 32-bit halves so we
  // stay within JS safe integer range (2^53 - 1 ≈ 9e15, so 15 digits max).
  const hi = Math.floor(Math.random() * 9000) + 1000; // 4 digits, no leading 0
  const lo = Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, "0");
  return Number(`${hi}${lo}`);
}

export function dashboardToDatadogJson(
  dashboard: Dashboard,
): DatadogDashboardJson {
  const widgets = dashboard.widgets ?? [];
  const layouts = computeLayouts(widgets);
  return {
    title: dashboard.name,
    description: null,
    widgets: widgets.map((w, i) => ({
      id: generateWidgetId(),
      definition: widgetToDefinition(w),
      layout: layouts[i],
    })),
    template_variables: [],
    layout_type: "ordered",
    notify_list: [],
    pause_auto_refresh: false,
    reflow_type: "fixed",
  };
}

export function dashboardJsonString(dashboard: Dashboard): string {
  return JSON.stringify(dashboardToDatadogJson(dashboard), null, 2);
}

export function dashboardJsonFilename(dashboard: Dashboard): string {
  const safeName = dashboard.name.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80);
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "_")
    .replace(/Z$/, "");
  return `${safeName || "dashboard"}--${ts}.json`;
}

export function downloadDashboardJson(dashboard: Dashboard) {
  if (typeof window === "undefined") return;
  const blob = new Blob([dashboardJsonString(dashboard)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dashboardJsonFilename(dashboard);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
