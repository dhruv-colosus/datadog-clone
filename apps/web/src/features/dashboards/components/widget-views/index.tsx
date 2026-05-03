"use client";

import type { TimeRange } from "@/features/metrics/types";
import type { Widget } from "../../types";
import { PieChartView } from "./PieChartView";
import { TableView } from "./TableView";
import { TimeseriesView } from "./TimeseriesView";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

export function WidgetView({ widget, timeRange }: Props) {
  if (widget.type === "timeseries") {
    return <TimeseriesView widget={widget} timeRange={timeRange} />;
  }
  if (widget.type === "pie-chart") {
    return <PieChartView widget={widget} timeRange={timeRange} />;
  }
  return <TableView widget={widget} timeRange={timeRange} />;
}

export { TimeseriesView, PieChartView, TableView };
