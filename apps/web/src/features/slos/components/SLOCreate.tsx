"use client";

import { CaretRight, Check, Clock, Gauge } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCreateSLO } from "../hooks";
import {
  emptyMetricSource,
  emptyMonitorSource,
  emptyTimeSliceSource,
} from "../types";
import type {
  SLOSourceMetric,
  SLOSourceMonitor,
  SLOSourceTimeSlice,
  SLOType,
} from "../types";
import { MetricQueryPicker } from "./MetricQueryPicker";

type WindowChoice = 1 | 7 | 30 | 90;

const WINDOW_CHOICES: { id: WindowChoice; label: string }[] = [
  { id: 1, label: "1 Day" },
  { id: 7, label: "7 Days" },
  { id: 30, label: "30 Days" },
  { id: 90, label: "90 Days" },
];

export function SLOCreate() {
  const router = useRouter();
  const createMut = useCreateSLO();

  const [type, setType] = useState<SLOType>("metric");
  const [metricSource, setMetricSource] = useState<SLOSourceMetric>(
    emptyMetricSource(),
  );
  const [monitorSource, setMonitorSource] = useState<SLOSourceMonitor>(
    emptyMonitorSource(),
  );
  const [timeSliceSource, setTimeSliceSource] = useState<SLOSourceTimeSlice>(
    emptyTimeSliceSource(),
  );

  const [timeWindow, setTimeWindow] = useState<WindowChoice>(7);
  const [target, setTarget] = useState<string>("99.9");
  const [warning, setWarning] = useState<string>("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const targetNum = Number(target);
  const warningNum = warning.trim() === "" ? null : Number(warning);

  const validity = useMemo(() => {
    if (!name.trim())
      return { ok: false, reason: "Add a name in step 3." };
    if (Number.isNaN(targetNum) || targetNum <= 0 || targetNum > 100)
      return {
        ok: false,
        reason: "Target must be a number between 0 and 100.",
      };
    if (warningNum !== null) {
      if (Number.isNaN(warningNum) || warningNum > 100)
        return {
          ok: false,
          reason: "Warning threshold must be a number ≤ 100.",
        };
      if (warningNum <= targetNum)
        return {
          ok: false,
          reason: `Warning threshold must be higher than the target (${targetNum}%). Leave it blank to skip.`,
        };
    }
    if (type === "metric" && !metricSource.goodQuery.metricName)
      return {
        ok: false,
        reason: "Pick a metric for Good Events in step 1.",
      };
    if (
      type === "metric" &&
      !metricSource.useBadEvents &&
      !metricSource.totalQuery.metricName
    )
      return {
        ok: false,
        reason:
          "Pick a metric for Total Events in step 1 (or toggle to Bad Events).",
      };
    if (
      type === "metric" &&
      metricSource.useBadEvents &&
      !metricSource.badQuery.metricName
    )
      return {
        ok: false,
        reason: "Pick a metric for Bad Events in step 1.",
      };
    if (type === "time_slice" && !timeSliceSource.query.metricName)
      return { ok: false, reason: "Pick a metric in step 1." };
    if (type === "monitor" && monitorSource.monitorIds.length === 0)
      return {
        ok: false,
        reason: "Add at least one monitor ID in step 1.",
      };
    return { ok: true, reason: "" };
  }, [
    name,
    targetNum,
    warningNum,
    type,
    metricSource,
    timeSliceSource,
    monitorSource,
  ]);

  const submit = async (alsoSetAlert: boolean) => {
    if (!validity.ok) return;
    const source =
      type === "metric"
        ? metricSource
        : type === "monitor"
          ? monitorSource
          : timeSliceSource;
    const slo = await createMut.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      type,
      source,
      target_pct: targetNum,
      warning_pct: warningNum,
      time_window_days: timeWindow,
      services,
      teams,
      tags,
    });
    if (alsoSetAlert) {
      router.push(`/slo/${slo.id}?alerts=create`);
    } else {
      router.push(`/slo/${slo.id}`);
    }
  };

  return (
    <div className="flex h-full w-full overflow-auto bg-white text-[#202124]">
      <div className="flex w-full max-w-[1400px] flex-col">
        <Header />

        <div className="grid grid-cols-[1fr_360px] gap-6 px-6 py-6">
          <div className="space-y-8 border-l-2 border-[#a142f4] pl-6">
            <Step number={1} title="Define your SLO measurement">
              <div className="space-y-4">
                <p className="text-[13px] text-[#5f6368]">
                  Select how to measure your SLO
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <TypeCard
                    selected={type === "metric"}
                    icon={<Check size={16} />}
                    title="By Count"
                    description="Measures reliability as a ratio of good / total events."
                    onClick={() => setType("metric")}
                  />
                  <TypeCard
                    selected={type === "monitor"}
                    icon={<Gauge size={16} />}
                    title="By Monitor Uptime"
                    description="Measures the uptime of your monitors."
                    onClick={() => setType("monitor")}
                  />
                  <TypeCard
                    selected={type === "time_slice"}
                    icon={<Clock size={16} />}
                    title="By Time Slices"
                    description="Measure reliability using a custom uptime definition."
                    onClick={() => setType("time_slice")}
                  />
                </div>

                <div className="pt-4">
                  <h3 className="mb-1 text-[14px] font-medium">Define your SLI</h3>
                  {type === "metric" ? (
                    <MetricSourceEditor
                      source={metricSource}
                      onChange={setMetricSource}
                    />
                  ) : type === "time_slice" ? (
                    <TimeSliceSourceEditor
                      source={timeSliceSource}
                      onChange={setTimeSliceSource}
                    />
                  ) : (
                    <MonitorSourceEditor
                      source={monitorSource}
                      onChange={setMonitorSource}
                    />
                  )}
                </div>
              </div>
            </Step>

            <Step number={2} title="Set your target & time window">
              <div className="rounded-md bg-[#fafbfc] p-4">
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span>Evaluate over a rolling time window of</span>
                  <select
                    value={timeWindow}
                    onChange={(e) =>
                      setTimeWindow(Number(e.target.value) as WindowChoice)
                    }
                    className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                  >
                    {WINDOW_CHOICES.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <span>with a target of</span>
                  <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-24 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                  />
                  <span className="rounded-md bg-[#f1f3f4] px-2 py-1">%</span>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
                    Optional
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[13px]">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-1.5 rounded-sm bg-[#f9ab00]" />
                      Warning threshold
                    </span>
                    <input
                      type="text"
                      value={warning}
                      onChange={(e) => setWarning(e.target.value)}
                      placeholder="(99.95)"
                      className="w-24 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none placeholder:text-[#9aa0a6]"
                    />
                    <span className="rounded-md bg-[#f1f3f4] px-2 py-1">%</span>
                  </div>
                </div>
              </div>
            </Step>

            <Step number={3} title="Add name and tags">
              <div className="space-y-4">
                <FormRow label="Name" required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#1a73e8]"
                  />
                </FormRow>
                <FormRow label="Description">
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write an additional description"
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
                  />
                </FormRow>
                <FormRow label="Services">
                  <TagInput
                    value={services}
                    onChange={setServices}
                    placeholder="Add services"
                  />
                </FormRow>
                <FormRow label="Teams">
                  <TagInput
                    value={teams}
                    onChange={setTeams}
                    placeholder="Add teams"
                  />
                </FormRow>
                <FormRow label="Tags">
                  <TagInput
                    value={tags}
                    onChange={setTags}
                    placeholder="Add tags (key:value)"
                  />
                </FormRow>
              </div>
            </Step>

            <div className="flex items-center justify-between gap-3 border-t border-[#dadce0] pt-4">
              <div className="text-[12px] text-[#5f6368]">
                {!validity.ok ? (
                  <span className="inline-flex items-center gap-1.5 text-[#b06000]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[#f9ab00]"
                    />
                    {validity.reason}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#137333]">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[#137333]"
                    />
                    Ready to create.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/slo/manage")}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title={validity.ok ? undefined : validity.reason}
                  disabled={!validity.ok || createMut.isPending}
                  onClick={() => submit(true)}
                >
                  Create &amp; Set Alert
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  title={validity.ok ? undefined : validity.reason}
                  disabled={!validity.ok || createMut.isPending}
                  onClick={() => submit(false)}
                >
                  {createMut.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
            {createMut.isError ? (
              <div className="rounded-md border border-[#fbcec1] bg-[#fce8e6] px-3 py-2 text-[12px] text-[#d93025]">
                {createMut.error.message}
              </div>
            ) : null}
          </div>

          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex h-12 items-center border-b border-[#dadce0] bg-white px-6">
      <div className="flex items-center gap-2 text-[15px] text-[#5f6368]">
        <span className="font-medium text-[#202124]">SLOs</span>
        <CaretRight size={12} />
        <span className="font-medium text-[#202124]">Create SLO</span>
      </div>
    </header>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      <div className="absolute -left-9 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-[#a142f4] bg-white text-[12px] font-medium text-[#a142f4]">
        {number}
      </div>
      <h2 className="mb-3 text-[16px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

function TypeCard({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border-2 px-4 py-3 text-left transition-colors " +
        (selected
          ? "border-[#006CC2] bg-[#e6f1f9]"
          : "border-[#dadce0] bg-white hover:border-[#a8b3be]")
      }
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span style={{ color: selected ? "#006CC2" : "#5f6368" }}>{icon}</span>
        <span
          className={
            "text-[14px] font-medium " +
            (selected ? "text-[#006CC2]" : "text-[#202124]")
          }
        >
          {title}
        </span>
      </div>
      <p className="text-[12px] leading-snug text-[#5f6368]">{description}</p>
    </button>
  );
}

function MetricSourceEditor({
  source,
  onChange,
}: {
  source: SLOSourceMetric;
  onChange: (s: SLOSourceMetric) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[#5f6368]">
        Count-based SLOs are calculated as{" "}
        <code className="rounded bg-[#e6f4ea] px-1 py-0.5 text-[12px] text-[#137333]">
          Good Events
        </code>{" "}
        ÷ (
        <code className="rounded bg-[#e6f4ea] px-1 py-0.5 text-[12px] text-[#137333]">
          Good Events
        </code>{" "}
        +{" "}
        <code className="rounded bg-[#fce8e6] px-1 py-0.5 text-[12px] text-[#d93025]">
          Bad Events
        </code>
        ) × 100
      </p>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-3 w-1.5 rounded-sm bg-[#34a853]" />
          <span className="text-[14px] font-medium">Good Events</span>
        </div>
        <MetricQueryPicker
          badge="a"
          query={source.goodQuery}
          onChange={(q) => onChange({ ...source, goodQuery: q })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-3 w-1.5 rounded-sm bg-[#d93025]" />
          <span className="text-[14px] font-medium">
            {source.useBadEvents ? "Bad Events" : "Total Events"}
          </span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12px] text-[#5f6368]">
            <input
              type="checkbox"
              checked={source.useBadEvents}
              onChange={(e) =>
                onChange({ ...source, useBadEvents: e.target.checked })
              }
              className="h-3.5 w-3.5 accent-[#006CC2]"
            />
            Use bad events instead of total
          </label>
        </div>
        <MetricQueryPicker
          badge="a"
          query={source.useBadEvents ? source.badQuery : source.totalQuery}
          onChange={(q) =>
            onChange(
              source.useBadEvents
                ? { ...source, badQuery: q }
                : { ...source, totalQuery: q },
            )
          }
        />
      </div>
    </div>
  );
}

function TimeSliceSourceEditor({
  source,
  onChange,
}: {
  source: SLOSourceTimeSlice;
  onChange: (s: SLOSourceTimeSlice) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#5f6368]">
        Time-slice SLOs are good when each time bucket satisfies{" "}
        <code className="rounded bg-[#f1f3f4] px-1 py-0.5">value comparator threshold</code>.
      </p>
      <MetricQueryPicker
        badge="a"
        query={source.query}
        onChange={(q) => onChange({ ...source, query: q })}
      />
      <div className="flex items-center gap-2 text-[13px]">
        <span>Bucket is good when value</span>
        <select
          value={source.comparator}
          onChange={(e) =>
            onChange({
              ...source,
              comparator: e.target.value as SLOSourceTimeSlice["comparator"],
            })
          }
          className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
        >
          <option value="<">&lt;</option>
          <option value="<=">≤</option>
          <option value=">">&gt;</option>
          <option value=">=">≥</option>
        </select>
        <input
          type="number"
          step="any"
          value={source.threshold}
          onChange={(e) =>
            onChange({ ...source, threshold: Number(e.target.value) })
          }
          className="w-32 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
        />
      </div>
    </div>
  );
}

function MonitorSourceEditor({
  source,
  onChange,
}: {
  source: SLOSourceMonitor;
  onChange: (s: SLOSourceMonitor) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[#5f6368]">
        Monitor-based SLOs aggregate uptime across one or more monitors. Paste the
        monitor IDs you want to track.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Monitor ID"
          className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px] outline-none"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const v = draft.trim();
            if (!v) return;
            onChange({ monitorIds: [...source.monitorIds, v] });
            setDraft("");
          }}
        >
          Add
        </Button>
      </div>
      {source.monitorIds.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {source.monitorIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded bg-[#e6f1f9] px-2 py-0.5 text-[12px] text-[#006CC2]"
            >
              {id}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    monitorIds: source.monitorIds.filter((m) => m !== id),
                  })
                }
                className="text-[#5f6368] hover:text-[#202124]"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 text-[13px]">
      <label className="pt-1.5 text-[#5f6368]">
        {label}
        {required ? <span className="text-[#d93025]"> *</span> : null}
      </label>
      <div>{children}</div>
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded bg-[#e6f1f9] px-2 py-0.5 text-[12px] text-[#006CC2]"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="text-[#5f6368] hover:text-[#202124]"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            const v = draft.trim().replace(/,$/, "");
            if (v && !value.includes(v)) onChange([...value, v]);
            setDraft("");
          }
          if (e.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] outline-none placeholder:text-[#9aa0a6]"
      />
    </div>
  );
}

function PreviewPanel() {
  return (
    <aside className="rounded-md border border-[#dadce0] bg-[#fafbfc] p-6">
      <h3 className="mb-3 text-[14px] font-medium">Preview</h3>
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-[#5f6368]">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12h4l3-9 4 18 3-9h4"
            stroke="#9aa0a6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-[12px]">Select metrics to see your SLO preview</p>
      </div>
    </aside>
  );
}
