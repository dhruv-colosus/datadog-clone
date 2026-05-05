"use client";

import { Gauge, Question, Sigma, Waveform } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchMetricNames } from "@/features/metrics/api";
import { previewAnomaly } from "../api";
import { useCreateMonitor } from "../hooks";

type Algorithm = "basic" | "agile" | "robust";
type Direction = "above" | "below" | "both";
type Seasonality = "none" | "hourly" | "daily" | "weekly";

const ALGOS: { id: Algorithm; label: string; description: string }[] = [
  {
    id: "basic",
    label: "Basic",
    description:
      "Rolling quantile of recent values. Best for non-seasonal metrics with no large historical context.",
  },
  {
    id: "agile",
    label: "Agile",
    description:
      "SARIMA-style model that adapts quickly to level shifts. Best for shifting seasonal data.",
  },
  {
    id: "robust",
    label: "Robust",
    description:
      "Seasonal-trend decomposition. Most stable for predictably seasonal metrics with clear daily/weekly patterns.",
  },
];

const SEASONALITIES: Seasonality[] = ["none", "hourly", "daily", "weekly"];
const ROLLUPS = [
  { v: 60, label: "1 minute" },
  { v: 300, label: "5 minutes" },
  { v: 600, label: "10 minutes" },
];

export function AnomalyMonitorConfigure() {
  const router = useRouter();
  const create = useCreateMonitor();

  const { data: metricNames } = useQuery<string[]>({
    queryKey: ["metric-names"],
    queryFn: () => fetchMetricNames(),
  });

  const [metric, setMetric] = useState("api.request_latency_ms");
  const [windowSeconds, setWindowSeconds] = useState(1800);
  const [rollupSeconds, setRollupSeconds] = useState(60);
  const [algorithm, setAlgorithm] = useState<Algorithm>("basic");
  const [deviations, setDeviations] = useState(2);
  const [seasonality, setSeasonality] = useState<Seasonality>("hourly");
  const [direction, setDirection] = useState<Direction>("both");
  const [name, setName] = useState("Anomaly: api.request_latency_ms");

  const previewKey = useMemo(
    () => [
      "anomaly-preview",
      metric,
      windowSeconds,
      rollupSeconds,
      deviations,
      direction,
      algorithm,
    ],
    [metric, windowSeconds, rollupSeconds, deviations, direction, algorithm],
  );

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: previewKey,
    queryFn: () =>
      previewAnomaly({
        metric,
        window_seconds: windowSeconds,
        rollup_seconds: rollupSeconds,
        deviations,
        direction,
        algorithm,
      }),
    enabled: !!metric,
    refetchInterval: 30_000,
  });

  const chartData = useMemo(() => {
    if (!preview?.points) return [];
    return preview.points.map((p) => {
      const isAnomaly =
        preview.upper !== null &&
        preview.lower !== null &&
        ((direction !== "below" && p.value > preview.upper) ||
          (direction !== "above" && p.value < preview.lower));
      return {
        ts: p.ts,
        time: new Date(p.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: p.value,
        upper: preview.upper,
        lower: preview.lower,
        anomaly: isAnomaly ? p.value : null,
      };
    });
  }, [preview, direction]);

  const onSave = async () => {
    await create.mutateAsync({
      name,
      type: "anomaly",
      query: {
        metric,
        windowSeconds,
        rollupSeconds,
        deviations,
        direction,
        algorithm,
        seasonality,
        expr: `anomalies(avg:${metric}{*}, '${algorithm}', ${deviations})`,
      },
      thresholds: {
        operator: ">",
        evaluation: `ANOMALY over the last ${Math.round(windowSeconds / 60)}m`,
        label: `value outside ${deviations}σ band`,
      },
      tags: [`monitor_pack:anomaly`, `algorithm:${algorithm}`],
    });
    router.push("/monitor/manage");
  };

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Section
            number={1}
            title="Define the metric"
            description="Choose the metric this anomaly monitor evaluates."
          >
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
                  Evaluation window
                </label>
                <select
                  value={windowSeconds}
                  onChange={(e) => setWindowSeconds(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  {[600, 1800, 3600, 7200, 14400].map((s) => (
                    <option key={s} value={s}>
                      Last {s / 60} min
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
                  {ROLLUPS.map((r) => (
                    <option key={r.v} value={r.v}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section
            number={2}
            title="Choose an algorithm"
            description="Pick the model that best fits this metric's behavior."
          >
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
                    name="algorithm"
                    checked={algorithm === a.id}
                    onChange={() => setAlgorithm(a.id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-[#1a73e8]"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-[#202124]">
                      {a.label}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#5f6368]">
                      {a.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Section>

          <Section
            number={3}
            title="Set anomaly conditions"
            description="Tune sensitivity, direction, and seasonality."
          >
            <div className="grid max-w-[720px] grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Deviations: {deviations.toFixed(1)}σ
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.1}
                  value={deviations}
                  onChange={(e) => setDeviations(Number(e.target.value))}
                  className="mt-2 w-full accent-[#1a73e8]"
                />
                <div className="flex justify-between text-[10px] text-[#9aa0a6]">
                  <span>0.5</span>
                  <span>2.5</span>
                  <span>5</span>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as Direction)}
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  <option value="both">Above and below</option>
                  <option value="above">Above only</option>
                  <option value="below">Below only</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368]">
                  Seasonality
                </label>
                <select
                  value={seasonality}
                  onChange={(e) =>
                    setSeasonality(e.target.value as Seasonality)
                  }
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                >
                  {SEASONALITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section
            number={4}
            title="Preview"
            description="Live evaluation against the last evaluation window. Gray band shows the expected range; red dots are anomalies."
          >
            <div className="rounded-md border border-[#dadce0] bg-white p-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[13px] font-medium text-[#202124]">
                  {metric}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#5f6368]">
                  {preview?.currentValue != null && (
                    <span>
                      current: {preview.currentValue.toFixed(2)}
                    </span>
                  )}
                  {preview?.mean != null && (
                    <span>μ: {preview.mean.toFixed(2)}</span>
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
                    <Area
                      type="monotone"
                      dataKey="upper"
                      stroke="#bdc1c6"
                      fill="#e8eaed"
                      fillOpacity={0.6}
                      strokeDasharray="3 3"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      stroke="#bdc1c6"
                      fill="white"
                      strokeDasharray="3 3"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#1a73e8"
                      strokeWidth={1.6}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Scatter
                      dataKey="anomaly"
                      fill="#d32f2f"
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>

          <Section
            number={5}
            title="Name and save"
            description="Pick a clear name. You can edit notifications and tags later."
          >
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
          {create.isPending ? "Saving…" : "Save anomaly monitor"}
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
        <span className="font-medium">Anomaly</span>
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
  description: string;
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
          <p className="mt-0.5 text-[12px] text-[#5f6368]">{description}</p>
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
      <Sigma size={11} />
      {status}
    </span>
  );
}
