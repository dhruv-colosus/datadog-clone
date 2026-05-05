"use client";

import { Gauge, GitBranch, Question } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchMetricNames } from "@/features/metrics/api";
import { previewForecast } from "../api";
import { useCreateMonitor } from "../hooks";

type Algorithm = "linear" | "seasonal";
type Operator = ">" | ">=" | "<" | "<=";

const ALGOS: { id: Algorithm; label: string; description: string }[] = [
  {
    id: "linear",
    label: "Linear",
    description:
      "Linear regression on recent values. Best for monotonic metrics like disk usage.",
  },
  {
    id: "seasonal",
    label: "Seasonal",
    description:
      "Forecast that accounts for daily/weekly cycles. Best for traffic-pattern metrics.",
  },
];

const FORECAST_WINDOWS = [
  { v: 3600, label: "1 hour" },
  { v: 21600, label: "6 hours" },
  { v: 86400, label: "1 day" },
  { v: 604800, label: "1 week" },
];

export function ForecastMonitorConfigure() {
  const router = useRouter();
  const create = useCreateMonitor();

  const { data: metricNames } = useQuery<string[]>({
    queryKey: ["metric-names"],
    queryFn: () => fetchMetricNames(),
  });

  const [metric, setMetric] = useState("system.disk.used");
  const [windowSeconds, setWindowSeconds] = useState(14400);
  const [rollupSeconds, setRollupSeconds] = useState(300);
  const [algorithm, setAlgorithm] = useState<Algorithm>("linear");
  const [forecastWindowSeconds, setForecastWindowSeconds] = useState(86400);
  const [threshold, setThreshold] = useState(85);
  const [operator, setOperator] = useState<Operator>(">");
  const [name, setName] = useState("Forecast: system.disk.used");

  const previewKey = useMemo(
    () => [
      "forecast-preview",
      metric,
      windowSeconds,
      rollupSeconds,
      forecastWindowSeconds,
      threshold,
      operator,
      algorithm,
    ],
    [
      metric,
      windowSeconds,
      rollupSeconds,
      forecastWindowSeconds,
      threshold,
      operator,
      algorithm,
    ],
  );

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: previewKey,
    queryFn: () =>
      previewForecast({
        metric,
        window_seconds: windowSeconds,
        rollup_seconds: rollupSeconds,
        forecast_window_seconds: forecastWindowSeconds,
        threshold,
        operator,
        algorithm,
      }),
    enabled: !!metric,
    refetchInterval: 30_000,
  });

  const chartData = useMemo(() => {
    if (!preview) return [];
    const actual = preview.points.map((p) => ({
      ts: p.ts,
      time: new Date(p.ts).toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      actual: p.value,
      forecast: null as number | null,
    }));
    const forecast = preview.forecast.map((p) => ({
      ts: p.ts,
      time: new Date(p.ts).toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      actual: null as number | null,
      forecast: p.value,
    }));
    return [...actual, ...forecast].sort((a, b) => a.ts - b.ts);
  }, [preview]);

  const onSave = async () => {
    await create.mutateAsync({
      name,
      type: "forecast",
      query: {
        metric,
        windowSeconds,
        rollupSeconds,
        forecastWindowSeconds,
        algorithm,
        expr: `forecast(avg:${metric}{*}, '${algorithm}', 1, interval=${forecastWindowSeconds})`,
      },
      thresholds: {
        operator,
        critical: threshold,
        evaluation: `FORECAST ${forecastWindowSeconds / 3600}h ahead`,
        label: `projected y ${operator} ${threshold}`,
      },
      tags: [`monitor_pack:forecast`, `algorithm:${algorithm}`],
    });
    router.push("/monitor/manage");
  };

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Section number={1} title="Define the metric">
            <label className="block text-[12px] font-medium text-[#5f6368]">
              Metric
            </label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="mt-1 w-full max-w-[480px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
            >
              {(metricNames ?? [metric]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <div className="mt-3 grid max-w-[640px] grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  History window
                </label>
                <select
                  value={windowSeconds}
                  onChange={(e) => setWindowSeconds(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  {[3600, 14400, 86400, 604800].map((s) => (
                    <option key={s} value={s}>
                      Last {s >= 86400 ? `${s / 86400}d` : `${s / 3600}h`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Rollup interval
                </label>
                <select
                  value={rollupSeconds}
                  onChange={(e) => setRollupSeconds(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  {[60, 300, 600, 3600].map((v) => (
                    <option key={v} value={v}>
                      {v >= 3600 ? `${v / 3600}h` : `${v / 60}m`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section number={2} title="Choose an algorithm">
            <div className="space-y-2">
              {ALGOS.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                    algorithm === a.id
                      ? "border-[#1a73e8] bg-[#e8f0fe]"
                      : "border-[#dadce0] bg-white hover:border-[#a8b3be]"
                  }`}
                >
                  <input
                    type="radio"
                    checked={algorithm === a.id}
                    onChange={() => setAlgorithm(a.id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-[#1a73e8]"
                  />
                  <div>
                    <div className="text-[13px] font-medium">{a.label}</div>
                    <div className="mt-0.5 text-[12px] text-[#5f6368]">
                      {a.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Section>

          <Section number={3} title="Set forecast conditions">
            <div className="grid max-w-[720px] grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Forecast horizon
                </label>
                <select
                  value={forecastWindowSeconds}
                  onChange={(e) =>
                    setForecastWindowSeconds(Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  {FORECAST_WINDOWS.map((w) => (
                    <option key={w.v} value={w.v}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Operator
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as Operator)}
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  <option value=">">{">"}</option>
                  <option value=">=">{">="}</option>
                  <option value="<">{"<"}</option>
                  <option value="<=">{"<="}</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Threshold
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                />
              </div>
            </div>
          </Section>

          <Section
            number={4}
            title="Preview"
            description={`Solid line: actual values. Dashed line: linear projection ${forecastWindowSeconds / 3600}h ahead.`}
          >
            <div className="rounded-md border border-[#dadce0] bg-white p-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[13px] font-medium">{metric}</div>
                <div className="flex items-center gap-3 text-[11px] text-[#5f6368]">
                  {preview?.currentValue != null && (
                    <span>
                      current: {preview.currentValue.toFixed(2)}
                    </span>
                  )}
                  {preview?.projectedValue != null && (
                    <span>
                      projected: {preview.projectedValue.toFixed(2)}
                    </span>
                  )}
                  {previewLoading && (
                    <span className="text-[#1a73e8]">refreshing…</span>
                  )}
                  <StatusBadge status={preview?.status ?? "No Data"} />
                </div>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer>
                  <ComposedChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "#5f6368" }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#5f6368" }} />
                    <Tooltip />
                    <ReferenceLine
                      y={threshold}
                      stroke="#d32f2f"
                      strokeDasharray="4 4"
                      label={{
                        value: `threshold ${threshold}`,
                        position: "right",
                        fill: "#d32f2f",
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#1a73e8"
                      strokeWidth={1.6}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#1a73e8"
                      strokeWidth={1.6}
                      strokeDasharray="6 4"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>

          <Section number={5} title="Name and save">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-[640px] rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[14px]"
            />
          </Section>
        </main>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#dadce0] bg-white px-6 py-3">
        <button
          type="button"
          onClick={() => router.push("/monitor/create")}
          className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={create.isPending || !name.trim()}
          onClick={onSave}
          className="rounded-md bg-[#1a73e8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
        >
          {create.isPending ? "Saving…" : "Save forecast monitor"}
        </button>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-[15px] text-[#202124]">
        <Gauge size={18} />
        <span>Monitors</span>
        <span className="text-[#bdc1c6]">›</span>
        <span>New Monitor</span>
        <span className="text-[#bdc1c6]">›</span>
        <span className="font-medium">Forecast</span>
      </div>
      <button
        type="button"
        aria-label="Help"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
      >
        <Question size={14} weight="bold" />
      </button>
    </div>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-lg border border-[#dadce0] bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[12px] font-semibold text-[#1a73e8]">
          {number}
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-[#202124]">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[12px] text-[#5f6368]">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Alert"
      ? { fg: "#d32f2f", bg: "#fde7e7" }
      : status === "Warn"
        ? { fg: "#a07000", bg: "#fff9d9" }
        : status === "OK"
          ? { fg: "#137333", bg: "#e1f3e6" }
          : { fg: "#5f6368", bg: "#f1f3f4" };
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color: color.fg, background: color.bg }}
    >
      <GitBranch size={11} />
      {status}
    </span>
  );
}
