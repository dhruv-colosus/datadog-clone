"use client";

import {
  CaretDown,
  CaretUp,
  FastForward,
  Gauge,
  Pause,
  Plus,
  Question,
  Rewind,
  Sigma,
  Warning,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchMetricNames } from "@/features/metrics/api";
import { useCreateMonitor, useMonitorPreview } from "../hooks";
import { MONITOR_TYPE_OPTIONS } from "../mock-data";
import type { MonitorType } from "../types";

type DetectionMethod =
  | "threshold"
  | "change"
  | "anomaly"
  | "outliers"
  | "forecast"
  | "watchdog";

type Aggregator = "avg" | "sum" | "min" | "max";
type Operator = ">" | ">=" | "<" | "<=";

const WINDOW_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: "last 1 minute" },
  { value: 300, label: "last 5 minutes" },
  { value: 600, label: "last 10 minutes" },
  { value: 900, label: "last 15 minutes" },
  { value: 1800, label: "last 30 minutes" },
  { value: 3600, label: "last 1 hour" },
];

const AGG_OPTIONS: { value: Aggregator; label: string }[] = [
  { value: "avg", label: "average" },
  { value: "sum", label: "sum" },
  { value: "min", label: "minimum" },
  { value: "max", label: "maximum" },
];

const TEMPLATES = [
  {
    id: "system-mem",
    pack: "SYSTEM",
    title: "Memory space is low",
    metric: "system.mem.used",
    aggregator: "avg" as Aggregator,
    operator: ">" as Operator,
    critical: 1.2e10,
    warning: 1e10,
    color: "#fef3c7",
    glyph: "system",
  },
  {
    id: "redis-mem",
    pack: "REDIS",
    title: "Memory consumption is high",
    metric: "redis.mem.used",
    aggregator: "avg" as Aggregator,
    operator: ">" as Operator,
    critical: 2.5e8,
    warning: 2.2e8,
    color: "#fee2e2",
    glyph: "redis",
  },
  {
    id: "postgres-pool",
    pack: "POSTGRES",
    title: "Connection pool is reaching saturation",
    metric: "postgresql.percent_usage_connections",
    aggregator: "avg" as Aggregator,
    operator: ">" as Operator,
    critical: 50,
    warning: 40,
    color: "#dbeafe",
    glyph: "postgres",
  },
];

type Props = {
  type: MonitorType;
};

export function MonitorConfigure({ type }: Props) {
  const router = useRouter();
  const createMutation = useCreateMonitor();
  const typeOption =
    MONITOR_TYPE_OPTIONS.find((o) => o.id === type) ?? MONITOR_TYPE_OPTIONS[0];

  const [detection, setDetection] = useState<DetectionMethod>("threshold");
  const [metric, setMetric] = useState<string>("system.cpu.user");
  const [aggregator, setAggregator] = useState<Aggregator>("avg");
  const [windowSeconds, setWindowSeconds] = useState<number>(300);
  const [evaluator, setEvaluator] = useState<Aggregator>("avg");
  const [operator, setOperator] = useState<Operator>(">");
  const [criticalStr, setCriticalStr] = useState<string>("");
  const [warningStr, setWarningStr] = useState<string>("");
  const [missingDataMin, setMissingDataMin] = useState<number>(5);

  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(true);
  const [step3Open, setStep3Open] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const { data: metricNames } = useQuery({
    queryKey: ["metrics", "names"],
    queryFn: () => fetchMetricNames(),
    staleTime: 5 * 60_000,
  });

  const critical = criticalStr === "" ? null : Number(criticalStr);
  const warning = warningStr === "" ? null : Number(warningStr);

  const previewPayload = useMemo(
    () => ({
      metric,
      aggregator,
      window_seconds: windowSeconds,
      operator,
      critical: Number.isFinite(critical) ? (critical as number) : null,
      warning: Number.isFinite(warning) ? (warning as number) : null,
    }),
    [metric, aggregator, windowSeconds, operator, critical, warning],
  );
  const { data: preview } = useMonitorPreview(previewPayload);

  const incomplete =
    criticalStr.trim() === "" || Number.isNaN(Number(criticalStr));

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setMetric(t.metric);
    setAggregator(t.aggregator);
    setOperator(t.operator);
    setCriticalStr(String(t.critical));
    setWarningStr(String(t.warning));
  };

  const buildName = (): string => {
    const op = operator;
    const t = criticalStr || "?";
    return `${aggregator}:${metric} ${op} ${t}`;
  };

  const buildExpr = (): string => {
    const win = WINDOW_OPTIONS.find((w) => w.value === windowSeconds);
    const winLabel = win
      ? win.label.replace("last ", "last_").replace(/\s/g, "")
      : `last_${windowSeconds}s`;
    return `${evaluator}(${winLabel}):${aggregator}:${metric}{*} ${operator} ${
      criticalStr || "0"
    }`;
  };

  const buildEvaluationLabel = (): string => {
    const win = WINDOW_OPTIONS.find((w) => w.value === windowSeconds)?.label ??
      `last ${windowSeconds}s`;
    return `${evaluator.toUpperCase()} over the ${win}`;
  };

  const submit = async () => {
    setError(null);
    if (incomplete) {
      setError("Set an alert threshold to publish this monitor.");
      return;
    }
    try {
      const m = await createMutation.mutateAsync({
        name: buildName(),
        type,
        query: {
          metric,
          aggregator,
          windowSeconds,
          filters: [],
          groupBy: [],
          expr: buildExpr(),
        },
        thresholds: {
          critical: Number(criticalStr),
          warning: warningStr === "" ? null : Number(warningStr),
          operator,
          evaluation: buildEvaluationLabel(),
          label: `y ${operator} ${criticalStr}`,
          missingDataMinutes: missingDataMin,
          missingDataAction: "show_last_known",
        },
        tags: [`monitor_pack:${detection}`],
        message: `${aggregator} of ${metric} over the ${
          WINDOW_OPTIONS.find((w) => w.value === windowSeconds)?.label
        } has reached {{value}} — exceeding the threshold of {{threshold}}.`,
        recovery_message: `${metric} has recovered. Current value: {{value}}.`,
        impact:
          "A sustained breach of this threshold typically degrades downstream services.",
        runbook_steps: [
          `Open the dashboard for ${metric} and inspect the last hour of data.`,
          "Correlate against recent deploys, traffic shifts, and infrastructure changes.",
        ],
      });
      router.push(`/monitor/${m.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    }
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <Header label={typeOption.label} />

      <div className="flex-1 overflow-auto">
        {/* Top: chart preview + threshold panel */}
        <div className="grid grid-cols-[1fr_360px] gap-6 px-6 pt-6">
          <ChartPreview metric={metric} value={preview?.value ?? null} />
          <ThresholdPanel
            preview={preview}
            critical={critical}
            warning={warning}
          />
        </div>

        {/* Templates */}
        <div className="mx-6 mt-6 rounded-md border border-[#dadce0] bg-[#f8f9fa] p-5">
          <div className="flex items-start gap-6">
            <div className="w-[300px] shrink-0">
              <h3 className="text-[16px] font-medium text-[#202124]">
                Start from a monitor template
              </h3>
              <p className="mt-1 text-[13px] text-[#5f6368]">
                Templates include search queries, alert conditions, and
                notifications
              </p>
              <div className="mt-3">
                <input
                  className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] placeholder:text-[#9aa0a6] focus:border-[#1a73e8] focus:outline-none"
                  placeholder="Search templates by service, integration, or use case"
                />
              </div>
            </div>
            <div className="flex flex-1 items-stretch gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex flex-1 items-center gap-3 rounded-md border border-[#dadce0] bg-white p-3 text-left hover:border-[#1a73e8]"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[18px]"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.glyph === "redis"
                      ? "🟥"
                      : t.glyph === "postgres"
                        ? "🐘"
                        : "⚙️"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5f6368]">
                      {t.pack}
                    </p>
                    <p className="truncate text-[13px] font-medium text-[#202124]">
                      {t.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Detection method */}
        <Step
          n={1}
          title="Choose the detection method"
          open={step1Open}
          onToggle={() => setStep1Open(!step1Open)}
        >
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["threshold", "Threshold Alert"],
                ["change", "Change Alert"],
                ["anomaly", "Anomaly Detection"],
                ["outliers", "Outliers Alert"],
                ["forecast", "Forecast Alert"],
                ["watchdog", "Watchdog"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDetection(id)}
                className={`rounded-md border px-3 py-1.5 text-[13px] ${
                  detection === id
                    ? "border-[#1a73e8] bg-[#1a73e8] text-white"
                    : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[#5f6368]">
            An alert is triggered whenever a{" "}
            <span className="text-[#1a73e8] underline">
              metric crosses a threshold
            </span>
            .
          </p>
        </Step>

        {/* Step 2: Define metric */}
        <Step
          n={2}
          title="Define the metric"
          open={step2Open}
          onToggle={() => setStep2Open(!step2Open)}
        >
          <div className="mb-3 flex items-center gap-4 border-b border-[#dadce0] text-[13px]">
            <span className="px-1 pb-2 text-[#5f6368]">Source</span>
            <span className="border-b-2 border-[#1a73e8] px-1 pb-2 font-medium text-[#1a73e8]">
              Edit
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#1a4ba0] font-mono text-white">
              a
            </span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="h-7 rounded-sm border border-[#bdc1c6] bg-[#fef3c7] px-2 font-mono text-[13px] focus:border-[#1a73e8] focus:outline-none"
            >
              {(metricNames ?? [metric]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-[#5f6368]">from</span>
            <span className="flex h-7 items-center rounded-sm border border-dashed border-[#bdc1c6] bg-white px-3 text-[#5f6368]">
              (everywhere)
            </span>
            <span className="text-[#5f6368]">
              {aggregator === "sum" ? "sum by" : "avg by"}
            </span>
            <span className="flex h-7 items-center rounded-sm border border-dashed border-[#bdc1c6] bg-[#fce4ec] px-3 text-[#5f6368]">
              (everything)
            </span>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-sm border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Sigma size={12} />
              Modify
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Plus size={12} weight="bold" />
              Add Query
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Plus size={12} weight="bold" />
              Add Formula
            </button>
          </div>

          <div className="mt-6">
            <h4 className="text-[13px] font-medium text-[#202124]">
              Evaluation Details
            </h4>
            <div className="mt-3 flex flex-wrap items-end gap-4 text-[13px]">
              <div>
                <p className="text-[12px] text-[#5f6368]">Evaluate the</p>
                <select
                  value={evaluator}
                  onChange={(e) => setEvaluator(e.target.value as Aggregator)}
                  className="mt-1 h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] focus:border-[#1a73e8] focus:outline-none"
                >
                  {AGG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[12px] text-[#5f6368]">
                  Of the query over the
                </p>
                <select
                  value={windowSeconds}
                  onChange={(e) => setWindowSeconds(Number(e.target.value))}
                  className="mt-1 h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] focus:border-[#1a73e8] focus:outline-none"
                >
                  {WINDOW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-3 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4]"
              >
                <Plus size={12} weight="bold" />
                Add Custom Schedule
                <span className="ml-1 rounded-sm bg-[#1a73e8] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  New
                </span>
              </button>
              <Question size={14} className="mb-2 text-[#5f6368]" />
            </div>
          </div>
        </Step>

        {/* Step 3: Alert conditions */}
        <Step
          n={3}
          title="Set alert conditions"
          open={step3Open}
          onToggle={() => setStep3Open(!step3Open)}
        >
          <div className="flex items-center gap-2 text-[13px] text-[#202124]">
            <span>Trigger when the evaluated value is</span>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as Operator)}
              className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] focus:border-[#1a73e8] focus:outline-none"
            >
              <option value=">">above</option>
              <option value=">=">above or equal to</option>
              <option value="<">below</option>
              <option value="<=">below or equal to</option>
            </select>
            <span>the threshold</span>
          </div>

          <div className="mt-5 max-w-[640px] space-y-3">
            <ThresholdRow
              colorBar="#d93025"
              label="Alert threshold:"
              operator={operator}
              value={criticalStr}
              setValue={setCriticalStr}
              placeholder="Enter value"
            />
            <ThresholdRow
              colorBar="#f9ab00"
              label="Warning threshold:"
              operator={operator}
              value={warningStr}
              setValue={setWarningStr}
              placeholder="Optional"
            />
          </div>

          <div className="mt-6 flex items-center gap-3 text-[13px] text-[#202124]">
            <span>If data is missing for</span>
            <input
              type="number"
              min={1}
              value={missingDataMin}
              onChange={(e) =>
                setMissingDataMin(Math.max(1, Number(e.target.value)))
              }
              className="h-8 w-16 rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] focus:border-[#1a73e8] focus:outline-none"
            />
            <span>minutes</span>
            <select className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] focus:border-[#1a73e8] focus:outline-none">
              <option>Show last known status</option>
              <option>Notify as alert</option>
              <option>Notify as no data</option>
              <option>Mark as OK</option>
            </select>
          </div>
        </Step>

        {/* Step 4 placeholder */}
        <div className="px-6 pb-24 pt-6">
          <div className="flex items-center gap-3 text-[14px]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#bdc1c6] text-[12px] text-[#5f6368]">
              4
            </span>
            <CaretDown size={12} className="text-[#5f6368]" />
            <span className="text-[#5f6368]">
              Configure notifications and automations
            </span>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between border-t border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-2 text-[13px]">
          {incomplete ? (
            <span className="inline-flex items-center gap-2 text-[#b1271b]">
              <Warning size={14} weight="fill" />
              Complete steps 3 and 4
            </span>
          ) : error ? (
            <span className="text-[#b1271b]">{error}</span>
          ) : (
            <span className="text-[#5f6368]">
              Ready to publish — preview value:{" "}
              {preview?.value !== null && preview?.value !== undefined
                ? formatNumber(preview.value)
                : "no data"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <button
            type="button"
            className="text-[#5f6368] hover:text-[#1a73e8]"
            disabled={createMutation.isPending}
          >
            Test Notifications
          </button>
          <button
            type="button"
            className="text-[#5f6368] hover:text-[#1a73e8]"
            disabled={createMutation.isPending}
          >
            Export Monitor
          </button>
          <span className="text-[#bdc1c6]">|</span>
          <button
            type="button"
            disabled={createMutation.isPending}
            className="rounded-md border border-[#bdc1c6] bg-white px-4 py-1.5 text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={createMutation.isPending || incomplete}
            className="rounded-md bg-[#1a73e8] px-4 py-1.5 font-medium text-white hover:bg-[#1765cc] disabled:bg-[#a8c7fa]"
          >
            {createMutation.isPending ? "Creating…" : "Create and Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-[15px] text-[#202124]">
        <Gauge size={18} className="text-[#1a73e8]" weight="fill" />
        <span className="text-[#1a73e8]">Monitors</span>
        <span className="text-[#bdc1c6]">›</span>
        <span className="text-[#1a73e8]">New Monitor</span>
        <span className="text-[#bdc1c6]">›</span>
        <span>{label} Monitor</span>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-l-2 border-[#1a73e8] px-6 pt-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 text-left"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a73e8] text-[12px] font-semibold text-white">
          {n}
        </span>
        {open ? (
          <CaretDown size={12} className="text-[#5f6368]" />
        ) : (
          <CaretUp size={12} className="text-[#5f6368]" />
        )}
        <h3 className="text-[18px] font-medium text-[#202124]">{title}</h3>
      </button>
      {open && <div className="mt-4 pl-9">{children}</div>}
    </section>
  );
}

function ThresholdRow({
  colorBar,
  label,
  operator,
  value,
  setValue,
  placeholder,
}: {
  colorBar: string;
  label: string;
  operator: Operator;
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span
        className="block h-5 w-1 rounded-sm"
        style={{ backgroundColor: colorBar }}
        aria-hidden
      />
      <span className="w-[160px] text-[#202124]">{label}</span>
      <span className="text-[#5f6368]">{operator}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-[260px] rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] placeholder:text-[#9aa0a6] focus:border-[#1a73e8] focus:outline-none"
      />
    </div>
  );
}

function ChartPreview({
  metric,
  value,
}: {
  metric: string;
  value: number | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px]">
        <button className="rounded-md bg-[#1a73e8] px-3 py-1 font-medium text-white">
          Evaluated Data
        </button>
        <button className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1 text-[#202124]">
          Source Data
        </button>
        <button className="inline-flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-3 py-1 text-[#202124]">
          All transitions
          <CaretDown size={10} weight="bold" />
        </button>
      </div>
      <div className="mt-3 h-[220px] rounded-md border border-[#dadce0] bg-white">
        <Sparkline />
      </div>
      <div className="mt-2 text-[11px] text-[#5f6368]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 bg-[#1a73e8]" />*
        </span>
        <span className="ml-3 font-mono text-[11px]">{metric}</span>
        {value !== null && (
          <span className="ml-3">
            current ≈ <span className="font-medium">{formatNumber(value)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Sparkline() {
  const path =
    "M10 130 L40 110 L70 120 L100 90 L130 95 L160 70 L190 80 L220 60 L250 65 L280 50 L310 55 L340 40 L370 50 L400 35 L430 45 L460 30 L490 38 L520 30 L550 35 L580 25 L610 32 L640 28";
  return (
    <svg viewBox="0 0 660 180" className="h-full w-full">
      <defs>
        <pattern id="cgrid" width="50" height="30" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 30" fill="none" stroke="#f1f3f4" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="660" height="180" fill="url(#cgrid)" />
      {[0, 0.2, 0.4, 0.6, 0.8].map((y, i) => (
        <text
          key={i}
          x={4}
          y={170 - i * 35}
          fontSize="10"
          fill="#5f6368"
          fontFamily="system-ui"
        >
          {y.toFixed(1)}
        </text>
      ))}
      <path d={path} stroke="#1a73e8" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ThresholdPanel({
  preview,
  critical,
  warning,
}: {
  preview:
    | { value: number | null; status: "OK" | "Warn" | "Alert" | "No Data" }
    | undefined;
  critical: number | null;
  warning: number | null;
}) {
  const noConfig = critical === null && warning === null;
  const status = preview?.status ?? "No Data";
  const counts = {
    Alert: status === "Alert" ? 1 : 0,
    Warn: status === "Warn" ? 1 : 0,
    Recover: 0,
    "No Data": status === "No Data" ? 1 : 0,
  };
  return (
    <aside className="rounded-md border border-[#dadce0] bg-white p-4 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1a73e8]">
          UTC+05:30
        </span>
        <button className="inline-flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px]">
          <span className="inline-flex h-4 items-center justify-center rounded-sm bg-[#f1f3f4] px-1 text-[10px] text-[#5f6368]">
            1h
          </span>
          Past 1 Hour
          <CaretDown size={10} weight="bold" />
        </button>
        <div className="ml-2 flex">
          <button
            aria-label="Earlier"
            className="flex h-7 w-7 items-center justify-center rounded-l-md border border-[#bdc1c6]"
          >
            <Rewind size={11} weight="fill" />
          </button>
          <button
            aria-label="Pause"
            className="flex h-7 w-7 items-center justify-center border-y border-[#bdc1c6] bg-[#202124] text-white"
          >
            <Pause size={10} weight="fill" />
          </button>
          <button
            aria-label="Later"
            className="flex h-7 w-7 items-center justify-center rounded-r-md border border-[#bdc1c6]"
          >
            <FastForward size={11} weight="fill" />
          </button>
        </div>
      </div>

      <h3 className="text-[14px] font-medium text-[#202124]">
        Monitor behavior with this threshold
      </h3>
      <p className="mt-1 text-[12px] leading-relaxed text-[#5f6368]">
        {noConfig
          ? "Add thresholds to see how many times the monitor would have transitioned during the selected timeframe with the current configuration."
          : `Based on the current preview, this monitor is in ${status}.`}
      </p>

      <ul className="mt-3 space-y-2 text-[13px] text-[#202124]">
        <CountRow label="Alert" color="#d93025" count={counts.Alert} />
        <CountRow label="Warn" color="#f9ab00" count={counts.Warn} />
        <CountRow label="Recover" color="#34a853" count={counts.Recover} />
        <CountRow label="No Data" color="#9aa0a6" count={counts["No Data"]} />
      </ul>
    </aside>
  );
}

function CountRow({
  label,
  color,
  count,
}: {
  label: string;
  color: string;
  count: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-medium" style={{ color }}>
        {count}
      </span>
      <span className="text-[#202124]">{label}</span>
    </li>
  );
}

function formatNumber(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}G`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}k`;
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(3);
}
