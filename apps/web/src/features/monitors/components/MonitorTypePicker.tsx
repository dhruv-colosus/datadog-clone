"use client";

import {
  ArrowRight,
  Bug,
  ChartLine,
  Cube,
  Database,
  FileText,
  Funnel,
  Gauge,
  GitBranch,
  Heartbeat,
  Lightbulb,
  ListBullets,
  MagicWand,
  Pulse,
  Speedometer,
  TrendUp,
  Waveform,
  type Icon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MONITOR_TYPE_OPTIONS } from "../mock-data";
import type { MonitorType } from "../types";

const TYPE_ICONS: Record<MonitorType, Icon> = {
  metric: ChartLine,
  change: TrendUp,
  anomaly: Waveform,
  outlier: Pulse,
  forecast: GitBranch,
  host: Cube,
  "audit-trail": FileText,
  "ci-tests": GitBranch,
  composite: Funnel,
  "data-observability": Database,
  "error-tracking": Bug,
  event: ListBullets,
  integration: Speedometer,
  "live-process": Heartbeat,
  "llm-observability": MagicWand,
  log: ListBullets,
  network: Heartbeat,
  process: Heartbeat,
  rum: Gauge,
  "synthetic-test": Speedometer,
  watchdog: Lightbulb,
};

export function MonitorTypePicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<MonitorType>("metric");

  const selectedOption =
    MONITOR_TYPE_OPTIONS.find((o) => o.id === selected) ??
    MONITOR_TYPE_OPTIONS[0];

  const goConfigure = () => {
    router.push(`/monitor/configure?type=${encodeURIComponent(selected)}`);
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <CreateHeader />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-[#dadce0] bg-white">
          <ul className="py-2">
            {MONITOR_TYPE_OPTIONS.map((opt) => {
              const Icon = TYPE_ICONS[opt.id];
              const active = selected === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(opt.id)}
                    className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors ${
                      active
                        ? "bg-[#1a73e8] text-white"
                        : "text-[#1a73e8] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={active ? "text-white" : "text-[#1a73e8]"}
                    />
                    <span className={active ? "font-medium" : ""}>
                      {opt.label}
                    </span>
                    {active && (
                      <ArrowRight size={14} weight="bold" className="ml-auto" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto px-12 py-10">
            <h2 className="text-[28px] font-semibold leading-tight text-[#202124]">
              {leadHeading(selectedOption.label, selectedOption.id)}
            </h2>
            <p className="mt-6 max-w-[640px] text-[14px] leading-relaxed text-[#202124]">
              {selectedOption.description}{" "}
              <a href="#" className="text-[#1a73e8] hover:underline">
                More Info ↗
              </a>
            </p>

            <div className="mt-12 flex items-center justify-center gap-12">
              <ChartIllustration />
              <DatadogLogo />
              <ChartIllustration alert />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#dadce0] bg-white px-6 py-3">
            <p className="text-[13px] text-[#5f6368]">Pick a monitor type</p>
            <button
              type="button"
              onClick={goConfigure}
              className="rounded-md bg-[#1a73e8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1765cc]"
            >
              {selectedOption.configureLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateHeader() {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-[15px] text-[#202124]">
        <Gauge size={18} className="text-[#202124]" />
        <span>Monitors</span>
        <span className="text-[#bdc1c6]">›</span>
        <span>New Monitor</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          Browse Templates
        </button>
        <button
          type="button"
          className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          Import From JSON
        </button>
      </div>
    </div>
  );
}

function leadHeading(label: string, id: MonitorType): string {
  switch (id) {
    case "metric":
      return "A metric threshold alert compares metric values to a static threshold";
    case "change":
      return "A change alert compares a metric to its value at an earlier point in time";
    case "anomaly":
      return "An anomaly alert detects when a metric deviates from its expected behavior";
    case "outlier":
      return "An outlier alert detects when one member of a group behaves differently";
    case "forecast":
      return "A forecast alert predicts when a metric will cross a threshold in the future";
    case "host":
      return "A host alert notifies you when a host stops reporting to Datadog";
    case "audit-trail":
      return "An audit trail alert fires on matching events in your Datadog audit log";
    case "ci-tests":
      return "A CI alert fires on test regressions and pipeline failures";
    case "composite":
      return "A composite alert combines multiple monitors into a single alert";
    case "data-observability":
      return "A data observability alert fires on data quality regressions";
    case "error-tracking":
      return "An error tracking alert fires when a new or regressing issue is detected";
    case "event":
      return "An event alert fires on matching events in the Event Stream";
    case "integration":
      return "An integration alert fires on the health of an installed integration";
    case "live-process":
      return "A live process alert fires when process counts cross a threshold";
    case "llm-observability":
      return "An LLM observability alert fires on quality, latency, and cost regressions";
    default:
      return `A ${label.toLowerCase()} alert`;
  }
}

function ChartIllustration({ alert }: { alert?: boolean } = {}) {
  return (
    <svg width="170" height="110" viewBox="0 0 170 110" fill="none">
      <rect
        x="2"
        y="2"
        width="166"
        height="106"
        rx="4"
        stroke="#dadce0"
        strokeWidth="1"
      />
      {alert && (
        <rect x="3" y="40" width="164" height="35" fill="#fde7e9" opacity="0.6" />
      )}
      <path
        d={
          alert
            ? "M10 75 L25 70 L40 78 L55 65 L70 60 L85 55 L100 35 L115 50 L130 30 L145 45 L160 40"
            : "M10 80 L25 70 L40 75 L55 62 L70 68 L85 55 L100 60 L115 48 L130 50 L145 42 L160 38"
        }
        stroke="#1a73e8"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function DatadogLogo() {
  return (
    <div className="flex h-[110px] w-[110px] items-center justify-center rounded-md border border-[#1a73e8] bg-white">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1a73e8] text-[20px] font-bold text-white">
          🐶
        </div>
        <p className="mt-1 text-[10px] font-bold tracking-widest text-[#1a73e8]">
          DATADOG
        </p>
      </div>
    </div>
  );
}
