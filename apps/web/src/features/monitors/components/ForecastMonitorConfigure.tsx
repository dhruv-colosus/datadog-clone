"use client";

import {
  CaretDown,
  CaretRight,
  Code,
  FastForward,
  Gauge,
  GearSix,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Pause,
  Play,
  Plus,
  Question,
  Rewind,
  Sigma,
  Warning,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchMetricNames } from "@/features/metrics/api";
import { previewForecast } from "../api";
import { useCreateMonitor } from "../hooks";

type DetectionMethod =
  | "threshold"
  | "change"
  | "anomaly"
  | "outliers"
  | "forecast"
  | "watchdog";

type Algorithm = "linear" | "seasonal";
type Operator = ">" | ">=" | "<" | "<=";

const DETECTION_TABS: { id: DetectionMethod; label: string }[] = [
  { id: "threshold", label: "Threshold Alert" },
  { id: "change", label: "Change Alert" },
  { id: "anomaly", label: "Anomaly Detection" },
  { id: "outliers", label: "Outliers Alert" },
  { id: "forecast", label: "Forecast Alert" },
  { id: "watchdog", label: "Watchdog" },
];

const FORECAST_WINDOWS: { v: number; label: string; short: string }[] = [
  { v: 3600, label: "1 hour", short: "1h" },
  { v: 21600, label: "6 hours", short: "6h" },
  { v: 86400, label: "1 day", short: "1d" },
  { v: 259200, label: "3 days", short: "3d" },
  { v: 604800, label: "1 week", short: "1w" },
];

export function ForecastMonitorConfigure() {
  const router = useRouter();
  const create = useCreateMonitor();

  const { data: metricNames } = useQuery<string[]>({
    queryKey: ["metric-names"],
    queryFn: () => fetchMetricNames(),
  });

  const [detection, setDetection] = useState<DetectionMethod>("forecast");
  const [metric, setMetric] = useState("system.load.1");
  const [windowSeconds] = useState(604800);
  const [rollupSeconds] = useState(3600);
  const [algorithm] = useState<Algorithm>("linear");
  const [forecastWindowSeconds, setForecastWindowSeconds] = useState(604800);

  const [operator, setOperator] = useState<Operator>(">");
  const [criticalStr, setCriticalStr] = useState("1.5");
  const [warningStr, setWarningStr] = useState("");

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [notifyTargets, setNotifyTargets] = useState("");

  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(true);
  const [step3Open, setStep3Open] = useState(false);
  const [step4Open, setStep4Open] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [historyZoom, setHistoryZoom] = useState(1);
  const [playing, setPlaying] = useState(true);

  const criticalNum = parseFloat(criticalStr);
  const warningNum = warningStr.trim() === "" ? null : parseFloat(warningStr);
  const threshold = Number.isFinite(criticalNum) ? criticalNum : 1.5;

  const effectiveName = name.trim() || `Forecast: ${metric}`;
  const step3Done =
    criticalStr.trim() !== "" && Number.isFinite(criticalNum);
  const step4Done = effectiveName.length > 0 && message.trim().length > 0;
  const canPublish = step3Done && step4Done;

  const forecastWindow =
    FORECAST_WINDOWS.find((w) => w.v === forecastWindowSeconds) ??
    FORECAST_WINDOWS[FORECAST_WINDOWS.length - 1];

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
    [metric, forecastWindowSeconds],
  );

  const { data: preview } = useQuery({
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
    refetchInterval: 60_000,
  });

  const fallback = useMemo(() => buildFallbackSeries(), []);
  const series = preview?.points?.length ? preview.points : fallback.points;
  const forecastSeries = preview?.forecast?.length
    ? preview.forecast
    : fallback.forecast;

  const historicalChart = useMemo(
    () => buildHistoricalChart(series, historyZoom),
    [series, historyZoom],
  );
  const evaluationChart = useMemo(
    () => buildEvaluationChart(series, forecastSeries),
    [series, forecastSeries],
  );

  const nowTs = series.length ? series[series.length - 1].ts : Date.now();

  const submit = async (asDraft: boolean) => {
    setSubmitError(null);
    if (!canPublish && !asDraft) {
      setSubmitError("Complete steps 3 and 4 before publishing.");
      return;
    }
    const targets = notifyTargets
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const created = await create.mutateAsync({
        name: effectiveName,
        type: "forecast",
        query: {
          metric,
          windowSeconds,
          rollupSeconds,
          forecastWindowSeconds,
          algorithm,
          expr: `forecast(avg:${metric}{*}, '${algorithm}', 1, model='default', interval='${Math.round(
            rollupSeconds / 60,
          )}m', history='${forecastWindow.short}')`,
        },
        thresholds: {
          operator,
          critical: threshold,
          warning: warningNum,
          evaluation: `FORECAST ${forecastWindow.label} ahead`,
          label: `projected y ${operator} ${threshold}`,
        },
        message: message || undefined,
        tags: [
          `monitor_pack:forecast`,
          `algorithm:${algorithm}`,
          ...(asDraft ? ["state:draft"] : []),
          ...targets.map((t) =>
            t.startsWith("@") ? `notify:${t.slice(1)}` : `notify:${t}`,
          ),
        ],
      });
      router.push(`/monitor/${created.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create monitor",
      );
    }
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <Header />

      <div className="flex-1 overflow-y-auto pb-[64px]">
        {/* Chart row */}
        <div className="grid grid-cols-2 gap-6 px-6 pt-6">
          <HistoricalView
            data={historicalChart}
            metric={metric}
            onZoomIn={() => setHistoryZoom((z) => Math.min(4, z * 1.5))}
            onZoomOut={() => setHistoryZoom((z) => Math.max(0.5, z / 1.5))}
          />
          <EvaluationView
            data={evaluationChart}
            metric={metric}
            algorithm={algorithm}
            rollupMinutes={Math.round(rollupSeconds / 60)}
            historyLabel={forecastWindow.short}
            forecastLabel={forecastWindow.short}
            nowTs={nowTs}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
          />
        </div>

        {/* Step 1 */}
        <Step
          n={1}
          title="Choose the detection method"
          open={step1Open}
          state="done"
          onToggle={() => setStep1Open(!step1Open)}
        >
          <div className="flex flex-wrap items-center gap-0 overflow-hidden rounded-md border border-[#dadce0]">
            {DETECTION_TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetection(t.id)}
                className={`flex items-center gap-1.5 border-r border-[#dadce0] px-3 py-1.5 text-[13px] last:border-r-0 ${
                  detection === t.id
                    ? "bg-[#632ca6] text-white"
                    : "bg-white text-[#202124] hover:bg-[#f8f9fa]"
                } ${i === 0 ? "" : ""}`}
              >
                <DetectionGlyph id={t.id} active={detection === t.id} />
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[#202124]">
            An alert is triggered whenever a{" "}
            <span className="text-[#1a73e8] underline decoration-dotted underline-offset-2">
              metric is forecast to cross a threshold
            </span>{" "}
            in the future.
          </p>
        </Step>

        {/* Step 2 */}
        <Step
          n={2}
          title="Define the metric"
          open={step2Open}
          state="done"
          onToggle={() => setStep2Open(!step2Open)}
        >
          <div className="mb-4 flex items-center gap-6 border-b border-[#dadce0] text-[13px]">
            <span className="cursor-pointer px-1 pb-2 text-[#5f6368] hover:text-[#202124]">
              Source
            </span>
            <span className="cursor-pointer border-b-2 border-[#632ca6] px-1 pb-2 font-medium text-[#632ca6]">
              Edit
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#1a4ba0] font-mono text-[12px] font-semibold text-white">
              a
            </span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="h-7 max-w-[220px] appearance-none rounded-sm border border-[#bdc1c6] bg-[#fff7c2] px-2 pr-6 font-mono text-[12px] focus:border-[#1a73e8] focus:outline-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%235f6368' d='M0 0l5 6 5-6z'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 6px center",
              }}
            >
              {(metricNames ?? [metric]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-[#5f6368]">from</span>
            <span className="flex h-7 items-center rounded-sm border border-dashed border-[#bdc1c6] bg-white px-3 text-[12px] text-[#5f6368]">
              (everywhere)
            </span>
            <span className="text-[#5f6368]">avg by</span>
            <span className="flex h-7 items-center rounded-sm border border-dashed border-[#bdc1c6] bg-[#fce4ec] px-3 text-[12px] text-[#5f6368]">
              (everything)
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-sm border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Sigma size={12} />
              Modify
            </button>
            <span className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-sm text-[#5f6368] hover:bg-[#f1f3f4]">
              <Code size={14} />
            </span>
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

          <div className="mt-5 flex items-center gap-3 text-[13px] text-[#202124]">
            <span>Evaluate the forecast bounds within the next</span>
            <select
              value={forecastWindowSeconds}
              onChange={(e) =>
                setForecastWindowSeconds(Number(e.target.value))
              }
              className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 pr-7 text-[13px] focus:border-[#1a73e8] focus:outline-none"
            >
              {FORECAST_WINDOWS.map((w) => (
                <option key={w.v} value={w.v}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </Step>

        {/* Step 3 */}
        <Step
          n={3}
          title="Set alert conditions"
          open={step3Open}
          state={step3Done ? "done" : "todo"}
          onToggle={() => setStep3Open(!step3Open)}
        >
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#202124]">
            <span>Trigger when the forecast crosses</span>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as Operator)}
              className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 pr-7 text-[13px] focus:border-[#1a73e8] focus:outline-none"
            >
              <option value=">">above</option>
              <option value=">=">above or equal to</option>
              <option value="<">below</option>
              <option value="<=">below or equal to</option>
            </select>
            <span>the threshold within the next {forecastWindow.label}.</span>
          </div>

          <div className="mt-5 max-w-[640px] space-y-3">
            <ThresholdRow
              colorBar="#d93025"
              label="Alert threshold"
              operator={operator}
              value={criticalStr}
              setValue={setCriticalStr}
              placeholder="e.g. 1.5"
            />
            <ThresholdRow
              colorBar="#f9ab00"
              label="Warning threshold"
              operator={operator}
              value={warningStr}
              setValue={setWarningStr}
              placeholder="Optional"
            />
          </div>

          {!step3Done && (
            <p className="mt-3 text-[12px] text-[#b1271b]">
              Enter a numeric alert threshold to enable this monitor.
            </p>
          )}
        </Step>

        {/* Step 4 */}
        <Step
          n={4}
          title="Configure notifications and automations"
          open={step4Open}
          state={step4Done ? "done" : "todo"}
          onToggle={() => setStep4Open(!step4Open)}
        >
          <div className="max-w-[720px] space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#5f6368]">
                Monitor name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Forecast: ${metric}`}
                className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] focus:border-[#1a73e8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5f6368]">
                Notification message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="{{metric}} is projected to cross {{threshold}} within the next {{forecast_window}}. Investigate before it does."
                className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 font-mono text-[12px] focus:border-[#1a73e8] focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#5f6368]">
                Supports Markdown and {"{{variables}}"}. Sent to every notify
                target on alert.
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#5f6368]">
                Notify your team
              </label>
              <input
                value={notifyTargets}
                onChange={(e) => setNotifyTargets(e.target.value)}
                placeholder="@oncall-platform @slack-alerts (comma or space separated)"
                className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] focus:border-[#1a73e8] focus:outline-none"
              />
            </div>
          </div>
          {!step4Done && (
            <p className="mt-3 text-[12px] text-[#b1271b]">
              A monitor name and notification message are required.
            </p>
          )}
        </Step>
      </div>

      <FooterBar
        creating={create.isPending}
        canPublish={canPublish}
        step3Done={step3Done}
        step4Done={step4Done}
        error={submitError}
        onPublish={() => submit(false)}
        onSaveDraft={() => submit(true)}
      />
    </div>
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
      <span className="w-[150px] text-[#202124]">{label}</span>
      <span className="w-6 text-center text-[#5f6368]">{operator}</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-[260px] rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] focus:border-[#1a73e8] focus:outline-none"
      />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-[15px]">
        <Gauge size={18} className="text-[#632ca6]" weight="fill" />
        <span className="cursor-pointer text-[#632ca6] hover:underline">
          Monitors
        </span>
        <CaretRight size={11} className="text-[#bdc1c6]" weight="bold" />
        <span className="cursor-pointer text-[#632ca6] hover:underline">
          New Monitor
        </span>
        <CaretRight size={11} className="text-[#bdc1c6]" weight="bold" />
        <span className="text-[#202124]">Forecast Monitor</span>
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

function Step({
  n,
  title,
  open,
  state,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  open: boolean;
  state: "done" | "todo";
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#e8eaed] px-6 pb-6 pt-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 text-left"
      >
        <StepBadge n={n} state={state} />
        <CaretDown
          size={11}
          weight="bold"
          className={`text-[#5f6368] transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <h3 className="text-[16px] font-medium text-[#202124]">{title}</h3>
      </button>
      {open && <div className="mt-4 pl-9">{children}</div>}
    </section>
  );
}

function StepBadge({ n, state }: { n: number; state: "done" | "todo" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#632ca6] text-[12px] font-semibold text-white">
        {n}
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[#bdc1c6] text-[12px] font-semibold text-[#5f6368]">
      {n}
    </span>
  );
}

function DetectionGlyph({
  id,
  active,
}: {
  id: DetectionMethod;
  active: boolean;
}) {
  const color = active ? "#ffffff" : "#5f6368";
  const stroke = { stroke: color, strokeWidth: 1.6, fill: "none" } as const;
  if (id === "threshold")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 11 L4 7 L7 9 L10 4 L13 6" {...stroke} />
        <path d="M1 13 L13 13" stroke={color} strokeWidth="0.6" />
      </svg>
    );
  if (id === "change")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 10 L5 6 L9 8 L13 3" {...stroke} />
        <circle cx="9" cy="8" r="1.2" fill={color} />
      </svg>
    );
  if (id === "anomaly")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 7 L4 7 M5 7 L7 4 L9 10 L11 7 L13 7" {...stroke} />
      </svg>
    );
  if (id === "outliers")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 4 L13 4 M1 8 L13 8 M1 12 L13 12" {...stroke} />
        <circle cx="9" cy="4" r="1" fill={color} />
        <circle cx="4" cy="12" r="1" fill={color} />
      </svg>
    );
  if (id === "forecast")
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M1 11 L4 7 L7 9" {...stroke} />
        <path
          d="M7 9 L10 5 L13 7"
          stroke={color}
          strokeWidth="1.6"
          fill="none"
          strokeDasharray="2 1.5"
        />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M7 2 L8.5 5.5 L12 6 L9.5 8.5 L10 12 L7 10.5 L4 12 L4.5 8.5 L2 6 L5.5 5.5 Z"
        {...stroke}
      />
    </svg>
  );
}

function HistoricalView({
  data,
  metric,
  onZoomIn,
  onZoomOut,
}: {
  data: ChartPoint[];
  metric: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const ticks = useMemo(() => pickTicks(data, 7), [data]);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-[14px] font-medium text-[#202124]">
          Historical View
        </h4>
        <div className="flex items-center gap-0.5 text-[#5f6368]">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={onZoomIn}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#f1f3f4]"
          >
            <MagnifyingGlassPlus size={13} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={onZoomOut}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#f1f3f4]"
          >
            <MagnifyingGlassMinus size={13} />
          </button>
        </div>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 6, bottom: 0, left: -10 }}
          >
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(v) => formatTick(v as number)}
              tick={{ fontSize: 10, fill: "#5f6368" }}
              axisLine={{ stroke: "#dadce0" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, "dataMax + 0.2"]}
              tick={{ fontSize: 10, fill: "#5f6368" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={<MiniTooltip />}
              cursor={{ stroke: "#5f6368", strokeDasharray: "2 2" }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5f6368]">
        <span className="inline-block h-2 w-2 rounded-sm bg-[#1a73e8]" />
        <span className="truncate font-mono">avg:{metric}{"{*}"}</span>
      </div>
    </div>
  );
}

function EvaluationView({
  data,
  metric,
  algorithm,
  rollupMinutes,
  historyLabel,
  forecastLabel,
  nowTs,
  playing,
  onTogglePlay,
}: {
  data: ChartPoint[];
  metric: string;
  algorithm: Algorithm;
  rollupMinutes: number;
  historyLabel: string;
  forecastLabel: string;
  nowTs: number;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const ticks = useMemo(() => pickTicks(data, 7), [data]);
  const lastTs = data.length ? data[data.length - 1].ts : nowTs;
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[14px] font-medium text-[#202124]">
          Evaluation View
        </h4>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Earlier"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Rewind size={11} weight="fill" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onTogglePlay}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            {playing ? (
              <Play size={11} weight="fill" />
            ) : (
              <Pause size={11} weight="fill" />
            )}
          </button>
          <button
            type="button"
            aria-label="Later"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <FastForward size={11} weight="fill" />
          </button>
          <button
            type="button"
            aria-label="Settings"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-sm text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <GearSix size={13} />
          </button>
        </div>
      </div>
      <div className="relative h-[180px]">
        <div
          className="pointer-events-none absolute z-10 text-[10px] font-medium text-[#d6336c]"
          style={{ top: 2, left: `${nowOffsetPct(data, nowTs)}%` }}
        >
          <span className="ml-1">Forecast ({forecastLabel})</span>
        </div>
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 6, bottom: 0, left: -10 }}
          >
            <defs>
              <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#1a73e8" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(v) => formatTick(v as number)}
              tick={{ fontSize: 10, fill: "#5f6368" }}
              axisLine={{ stroke: "#dadce0" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, "dataMax + 0.2"]}
              tick={{ fontSize: 10, fill: "#5f6368" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={<MiniTooltip />}
              cursor={{ stroke: "#5f6368", strokeDasharray: "2 2" }}
            />
            <ReferenceArea
              x1={nowTs}
              x2={lastTs}
              fill="#fdecef"
              fillOpacity={0}
              stroke="none"
              ifOverflow="visible"
            />
            <Area
              type="monotone"
              dataKey="bandLow"
              stackId="band"
              stroke="none"
              fill="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bandDelta"
              stackId="band"
              stroke="none"
              fill="url(#fcBand)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <ReferenceLine
              x={nowTs}
              stroke="#d6336c"
              strokeWidth={1}
              label={{ value: "Now", position: "insideBottom", fill: "#d6336c", fontSize: 10, offset: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {/* pink axis baseline below forecast region */}
        <div
          className="pointer-events-none absolute bottom-[18px] h-[2px] bg-[#d6336c]"
          style={{
            left: `${nowOffsetPct(data, nowTs)}%`,
            right: "6px",
          }}
        />
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5f6368]">
        <span className="inline-block h-2 w-2 rounded-sm bg-[#1a73e8]" />
        <span className="truncate font-mono">
          forecast(avg:{metric}{"{*}"}, '{algorithm}', 1, model='default',
          interval='{rollupMinutes}m', history='{historyLabel}', li…
        </span>
      </div>
    </div>
  );
}

function MiniTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: number;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded border border-[#dadce0] bg-white px-2 py-1 text-[11px] shadow-sm">
      <div className="text-[#5f6368]">
        {label != null ? new Date(label).toLocaleString() : ""}
      </div>
      {payload.map((p, i) => {
        if (p.value == null) return null;
        if (p.name === "bandLow" || p.name === "bandDelta") return null;
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: p.color ?? "#1a73e8" }}
            />
            <span className="text-[#202124]">{p.value.toFixed(3)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FooterBar({
  creating,
  canPublish,
  step3Done,
  step4Done,
  error,
  onPublish,
  onSaveDraft,
}: {
  creating: boolean;
  canPublish: boolean;
  step3Done: boolean;
  step4Done: boolean;
  error: string | null;
  onPublish: () => void;
  onSaveDraft: () => void;
}) {
  const missing: string[] = [];
  if (!step3Done) missing.push("3");
  if (!step4Done) missing.push("4");
  const stepLabel =
    missing.length === 0
      ? null
      : missing.length === 1
        ? `Complete step ${missing[0]}`
        : `Complete steps ${missing.join(" and ")}`;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-[#dadce0] bg-white px-6 py-3 lg:left-[64px] xl:left-[230px]">
      <div className="flex items-center gap-2 text-[13px]">
        {error ? (
          <span className="inline-flex items-center gap-2 text-[#b1271b]">
            <Warning size={14} weight="fill" />
            {error}
          </span>
        ) : stepLabel ? (
          <span className="inline-flex items-center gap-2 text-[#b1271b]">
            <Warning size={14} weight="fill" />
            {stepLabel}
          </span>
        ) : (
          <span className="text-[#137333]">Ready to publish.</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-[13px]">
        <button
          type="button"
          className="text-[#5f6368] hover:text-[#1a73e8]"
        >
          Test Notifications
        </button>
        <button
          type="button"
          className="text-[#5f6368] hover:text-[#1a73e8]"
        >
          Export Monitor
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={creating}
          className="rounded-md border border-[#bdc1c6] bg-white px-4 py-1.5 text-[#202124] hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish || creating}
          className={`rounded-md px-4 py-1.5 font-medium text-white ${
            !canPublish || creating
              ? "cursor-not-allowed bg-[#c8d6f7]"
              : "bg-[#1a73e8] hover:bg-[#1765cc]"
          }`}
        >
          {creating ? "Creating…" : "Create and Publish"}
        </button>
      </div>
    </div>
  );
}

type ChartPoint = {
  ts: number;
  actual: number | null;
  forecast: number | null;
  bandLow: number | null;
  bandDelta: number | null;
};

function buildHistoricalChart(
  series: { ts: number; value: number }[],
  zoom: number,
): ChartPoint[] {
  if (!series.length) return [];
  const span = series[series.length - 1].ts - series[0].ts;
  const cut = series[series.length - 1].ts - span / zoom;
  return series
    .filter((p) => p.ts >= cut)
    .map((p) => ({
      ts: p.ts,
      actual: p.value,
      forecast: null,
      bandLow: null,
      bandDelta: null,
    }));
}

function buildEvaluationChart(
  series: { ts: number; value: number }[],
  forecast: { ts: number; value: number }[],
): ChartPoint[] {
  if (!series.length) return [];
  // Show the most recent ~1 week of history alongside the forecast.
  const cutoff = series[series.length - 1].ts - 1000 * 60 * 60 * 24 * 7;
  const recent = series.filter((p) => p.ts >= cutoff);

  const last = recent[recent.length - 1];
  const points: ChartPoint[] = recent.map((p, i) => ({
    ts: p.ts,
    actual: p.value,
    forecast: i === recent.length - 1 ? p.value : null,
    bandLow: null,
    bandDelta: null,
  }));

  if (!forecast.length || !last) return points;

  const forecastSpan =
    forecast[forecast.length - 1].ts - forecast[0].ts || 1;

  for (const f of forecast) {
    const t = (f.ts - last.ts) / forecastSpan;
    // Confidence band widens with time; ~25% of value range, scaled by sqrt(t).
    const baseSpread = Math.max(0.18, Math.abs(f.value) * 0.18);
    const spread = baseSpread * (0.4 + Math.sqrt(Math.max(0, t)) * 1.4);
    const high = f.value + spread;
    const low = Math.max(0, f.value - spread);
    points.push({
      ts: f.ts,
      actual: null,
      forecast: f.value,
      bandLow: low,
      bandDelta: high - low,
    });
  }
  return points;
}

function buildFallbackSeries(): {
  points: { ts: number; value: number }[];
  forecast: { ts: number; value: number }[];
} {
  // Synthetic system.load.1-shaped wave so the chart renders even without
  // a live API response. Two-week history at 1h cadence + 1-week forecast.
  const now = Date.now();
  const start = now - 1000 * 60 * 60 * 24 * 14;
  const stepMs = 1000 * 60 * 60;
  const points: { ts: number; value: number }[] = [];
  for (let t = start; t <= now; t += stepMs) {
    const days = (t - start) / (1000 * 60 * 60 * 24);
    const dayPhase = ((t / (1000 * 60 * 60 * 24)) % 1) * Math.PI * 2;
    const v =
      0.55 +
      0.35 * Math.sin(dayPhase - Math.PI / 2) +
      0.15 * Math.sin(dayPhase * 2) +
      0.02 * days +
      0.05 * (Math.random() - 0.5);
    points.push({ ts: t, value: Math.max(0.05, v) });
  }
  const last = points[points.length - 1];
  const slope = (last.value - points[points.length - 24 * 7].value) /
    (24 * 7);
  const forecast: { ts: number; value: number }[] = [];
  for (let i = 1; i <= 24 * 7; i++) {
    const ts = last.ts + stepMs * i;
    forecast.push({ ts, value: last.value + slope * i * 0.6 + 0.01 });
  }
  return { points, forecast };
}

function pickTicks(data: { ts: number }[], count: number): number[] {
  if (data.length <= count) return data.map((d) => d.ts);
  const step = Math.floor(data.length / count);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(data[i * step].ts);
  out.push(data[data.length - 1].ts);
  return out;
}

function formatTick(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "short" });
  const weekday = d.toLocaleString("en", { weekday: "short" });
  if (day === 1) return month;
  if (d.getDay() === 0 || d.getDay() === 2 || d.getDay() === 4 || d.getDay() === 6)
    return `${weekday} ${day}`;
  return `${month} ${day}`;
}

function nowOffsetPct(data: ChartPoint[], nowTs: number): number {
  if (!data.length) return 50;
  const min = data[0].ts;
  const max = data[data.length - 1].ts;
  if (max === min) return 50;
  const pct = ((nowTs - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}
