import {
  AnomalyMonitorConfigure,
  ForecastMonitorConfigure,
  MonitorConfigure,
} from "@/features/monitors";
import type { MonitorType } from "@/features/monitors";

const VALID_TYPES: MonitorType[] = [
  "metric",
  "change",
  "anomaly",
  "outlier",
  "forecast",
  "host",
  "audit-trail",
  "ci-tests",
  "composite",
  "data-observability",
  "error-tracking",
  "event",
  "integration",
  "live-process",
  "llm-observability",
  "log",
  "network",
  "process",
  "rum",
  "synthetic-test",
  "watchdog",
];

export default async function MonitorConfigurePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const monitorType = (
    VALID_TYPES.includes(type as MonitorType) ? type : "metric"
  ) as MonitorType;
  if (monitorType === "anomaly") return <AnomalyMonitorConfigure />;
  if (monitorType === "forecast") return <ForecastMonitorConfigure />;
  return <MonitorConfigure type={monitorType} />;
}
