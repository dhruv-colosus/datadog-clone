"use client";

import type { TimeRange } from "@/features/metrics/types";
import type { Widget } from "../../types";
import { ChangeView } from "./ChangeView";
import { DistributionView } from "./DistributionView";
import { HeatmapView } from "./HeatmapView";
import { PieChartView } from "./PieChartView";
import { QueryValueView } from "./QueryValueView";
import { TableView } from "./TableView";
import { TimeseriesView } from "./TimeseriesView";
import { TopListView } from "./TopListView";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
};

export function WidgetView({ widget, timeRange }: Props) {
  switch (widget.type) {
    case "timeseries":
      return <TimeseriesView widget={widget} timeRange={timeRange} />;
    case "pie-chart":
      return <PieChartView widget={widget} timeRange={timeRange} />;
    case "table":
      return <TableView widget={widget} timeRange={timeRange} />;
    case "query_value":
      return <QueryValueView widget={widget} timeRange={timeRange} />;
    case "top_list":
      return <TopListView widget={widget} timeRange={timeRange} />;
    case "heatmap":
      return <HeatmapView widget={widget} timeRange={timeRange} />;
    case "change":
      return <ChangeView widget={widget} timeRange={timeRange} />;
    case "distribution":
      return <DistributionView widget={widget} timeRange={timeRange} />;
    default:
      return <TableView widget={widget} timeRange={timeRange} />;
  }
}

export {
  ChangeView,
  DistributionView,
  HeatmapView,
  PieChartView,
  QueryValueView,
  TableView,
  TimeseriesView,
  TopListView,
};
