"use client";

import {
  ArrowLeft,
  Bell,
  CaretDown,
  Clipboard,
  Copy,
  Export,
  Eye,
  FastForward,
  Gauge,
  MagnifyingGlassMinus,
  PencilSimple,
  Pause,
  Sparkle,
  SpeakerHigh,
  Warning,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useMonitorsStore } from "../store";
import type { Monitor, MonitorStatus } from "../types";

type Props = {
  monitorId: string;
};

export function MonitorDetail({ monitorId }: Props) {
  const router = useRouter();
  const monitor = useMonitorsStore((s) =>
    s.monitors.find((m) => m.id === monitorId),
  );

  const [autoInvestigate, setAutoInvestigate] = useState(false);
  const [visualization, setVisualization] = useState<
    "Evaluated Data" | "Source Data" | "Transitions"
  >("Evaluated Data");

  if (!monitor) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-[14px] text-[#5f6368]">
        <div className="text-center">
          <p>Monitor not found.</p>
          <button
            type="button"
            onClick={() => router.push("/monitors/manage")}
            className="mt-2 text-[#1a73e8] hover:underline"
          >
            Back to monitors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <TrialBanner />
      <DetailHeader />

      <div className="border-b border-[#dadce0] bg-white px-6 py-4">
        <div className="flex items-center gap-3 text-[13px] text-[#5f6368]">
          <StatusPill status={monitor.status} />
          <button
            type="button"
            className="flex items-center gap-1 rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <SpeakerHigh size={14} />
            Mute
          </button>
          <span className="text-[#bdc1c6]">|</span>
          <span className="flex items-center gap-1.5 text-[#5f6368]">
            <Gauge size={14} />
            {monitor.source}
          </span>
          <span className="text-[#bdc1c6]">|</span>
          <span>Created {formatCreated(monitor.createdMs)}</span>
          <span className="text-[#bdc1c6]">|</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: monitor.author.avatarColor }}
            >
              VN
            </span>
            <span>{monitor.team}</span>
          </span>
          <span className="text-[#bdc1c6]">|</span>
          {monitor.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-sm bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]"
            >
              {t}
            </span>
          ))}
        </div>
        <h1 className="mt-3 text-[26px] font-medium text-[#202124]">
          {monitor.name}
        </h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[1fr_320px] gap-6 px-6 py-6">
          <div className="min-w-0">
            <MonitorBehaviorChart monitor={monitor} />
          </div>
          <SidePanel
            monitor={monitor}
            autoInvestigate={autoInvestigate}
            setAutoInvestigate={setAutoInvestigate}
            visualization={visualization}
            setVisualization={setVisualization}
          />
        </div>

        <div className="border-t border-[#dadce0] px-6 py-6">
          <div className="grid grid-cols-[260px_1fr_300px] gap-8">
            <EventTimeline />
            <MessageTemplate monitor={monitor} />
            <NextSteps />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrialBanner() {
  return (
    <div className="flex items-center justify-between bg-[#202124] px-6 py-2 text-[12px] text-white">
      <div className="flex items-center gap-3">
        <span>
          Welcome, <span className="font-semibold">Vedanta!</span>
        </span>
        <button
          type="button"
          className="flex items-center gap-1 rounded border border-white/20 px-2 py-0.5 text-[11px] hover:bg-white/10"
        >
          Get Started <CaretDown size={10} weight="bold" />
        </button>
        <span className="text-[#bdc1c6]">
          You are{" "}
          <span className="border-b-2 border-[#10b981] text-white">67% done</span>{" "}
          setting up
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[#bdc1c6]">
          You have <span className="font-semibold text-white">13 days</span> left
          in your trial.
        </span>
        <button
          type="button"
          className="rounded bg-[#1a73e8] px-3 py-1 text-[12px] font-medium text-white hover:bg-[#1765cc]"
        >
          Upgrade
        </button>
      </div>
    </div>
  );
}

function DetailHeader() {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-2">
      <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
        <Gauge size={16} className="text-[#202124]" />
        <Link href="/monitors/manage" className="hover:text-[#1a73e8]">
          Monitors
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[#202124]">Status</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex">
          <Button className="gap-1.5 rounded-r-none">
            <Sparkle size={12} weight="fill" className="text-[#7c3aed]" />
            Investigate with Bits AI SRE
          </Button>
          <Button iconOnly className="rounded-l-none border-l-0">
            <CaretDown size={10} weight="bold" />
          </Button>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#5f6368]">
          <Toggle on={false} />
          Auto-investigate
        </label>
        <span className="text-[#bdc1c6]">|</span>
        <Button>
          <PencilSimple size={12} />
          Edit
        </Button>
        <Button>
          <Copy size={12} />
          Clone
        </Button>
        <Button>
          <Export size={12} />
          Export
        </Button>
        <Button>
          More <CaretDown size={10} weight="bold" />
        </Button>
      </div>
    </div>
  );
}

function MonitorBehaviorChart({ monitor }: { monitor: Monitor }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-[#202124]">Monitor behavior</h2>
        <div className="flex items-center gap-2 text-[12px] text-[#5f6368]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1a73e8]">
            UTC+05:30
          </span>
          <Button>
            <span className="inline-flex h-5 w-7 items-center justify-center rounded-md bg-[#f1f3f4] text-[11px] text-[#5f6368]">
              4h
            </span>
            Past 4 Hours
            <CaretDown size={10} weight="bold" />
          </Button>
          <div className="flex">
            <Button iconOnly className="rounded-r-none">
              <ArrowLeft size={12} weight="bold" />
            </Button>
            <Button
              iconOnly
              className="rounded-none border-l-0 bg-[#202124] text-white"
              variant="ghost"
            >
              <Pause size={10} weight="fill" />
            </Button>
            <Button iconOnly className="rounded-l-none border-l-0">
              <FastForward size={10} weight="fill" />
            </Button>
          </div>
          <Button iconOnly>
            <MagnifyingGlassMinus size={12} />
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-[#dadce0] bg-white">
        <div className="relative h-[300px] w-full overflow-hidden">
          <ChartGrid threshold={monitor.threshold} thresholdLabel={monitor.thresholdLabel} />
        </div>
        <div className="flex items-center justify-between border-t border-[#dadce0] px-4 py-1.5 text-[11px] text-[#5f6368]">
          <span>09:30</span>
          <span>10:00</span>
          <span>10:30</span>
          <span>11:00</span>
          <span>11:30</span>
          <span>12:00</span>
          <span>12:30</span>
          <span>13:00</span>
        </div>
      </div>
    </section>
  );
}

function ChartGrid({
  threshold,
  thresholdLabel,
}: {
  threshold: number;
  thresholdLabel: string;
}) {
  return (
    <svg
      viewBox="0 0 800 280"
      className="h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="grid" width="80" height="35" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 35" fill="none" stroke="#f1f3f4" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="800" height="280" fill="#e6f4ea" opacity="0.5" />
      <rect width="800" height="280" fill="url(#grid)" />
      {[0, 2, 4, 6, 8, 10, 12].map((y, i) => (
        <text
          key={y}
          x={4}
          y={280 - i * 35 - 4}
          fontSize="10"
          fill="#5f6368"
          fontFamily="system-ui"
        >
          {y}
        </text>
      ))}
      <line
        x1={0}
        x2={800}
        y1={265}
        y2={265}
        stroke="#d93025"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text x={8} y={258} fontSize="10" fill="#d93025" fontFamily="system-ui">
        y &gt; {threshold}
      </text>
    </svg>
  );
}

function SidePanel({
  monitor,
  autoInvestigate,
  setAutoInvestigate,
  visualization,
  setVisualization,
}: {
  monitor: Monitor;
  autoInvestigate: boolean;
  setAutoInvestigate: (v: boolean) => void;
  visualization: "Evaluated Data" | "Source Data" | "Transitions";
  setVisualization: (v: "Evaluated Data" | "Source Data" | "Transitions") => void;
}) {
  return (
    <aside className="space-y-5 text-[13px]">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-[#5f6368]">Status</p>
        <div className="mt-1.5">
          <StatusPill status={monitor.status} />
        </div>
      </div>

      <div>
        <p className="text-[12px] uppercase tracking-wide text-[#5f6368]">
          Visualize as
        </p>
        <div className="mt-2 inline-flex overflow-hidden rounded-md border border-[#bdc1c6]">
          {(["Evaluated Data", "Source Data", "Transitions"] as const).map(
            (v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisualization(v)}
                className={`px-3 py-1 text-[12px] ${
                  visualization === v
                    ? "bg-[#1a4ba0] text-white"
                    : "bg-white text-[#5f6368] hover:bg-[#f1f3f4]"
                } ${i > 0 ? "border-l border-[#bdc1c6]" : ""}`}
              >
                {v}
              </button>
            ),
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-wide text-[#5f6368]">
            Query
          </p>
          <button
            type="button"
            className="text-[12px] text-[#1a73e8] hover:underline"
          >
            View in Metrics Explorer
          </button>
        </div>
        <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-md bg-[#f8f9fa] px-3 py-2 font-mono text-[12px] text-[#202124]">
          {monitor.query}
        </pre>
      </div>

      <div>
        <p className="text-[12px] uppercase tracking-wide text-[#5f6368]">
          Evaluation
        </p>
        <p className="mt-1.5 text-[#202124]">
          <span className="font-semibold">{monitor.evaluationLabel.split(" ")[0]}</span>{" "}
          {monitor.evaluationLabel.split(" ").slice(1).join(" ")}
        </p>
      </div>

      <div>
        <p className="text-[12px] uppercase tracking-wide text-[#5f6368]">
          Notifications
        </p>
        <p className="mt-1.5 text-[#202124]">
          <span className="font-semibold">0</span> sent to recipients
        </p>
      </div>

      {autoInvestigate && (
        <div>
          <p className="text-[12px] uppercase tracking-wide text-[#5f6368]">
            Auto-investigate
          </p>
          <p className="mt-1.5 text-[#5f6368]">Enabled</p>
          <button onClick={() => setAutoInvestigate(false)} type="button">
            Disable
          </button>
        </div>
      )}
    </aside>
  );
}

function EventTimeline() {
  return (
    <section>
      <h3 className="text-[14px] font-medium text-[#202124]">Event Timeline</h3>
      <p className="mt-3 text-[13px] text-[#5f6368]">No events in scope</p>
    </section>
  );
}

function MessageTemplate({ monitor }: { monitor: Monitor }) {
  return (
    <section className="rounded-md border border-[#dadce0] bg-white p-5">
      <div className="flex items-start justify-between">
        <h3 className="text-[14px] font-medium text-[#202124]">Message Template</h3>
        <button
          type="button"
          className="flex items-center gap-1 text-[12px] text-[#1a73e8] hover:underline"
        >
          <PencilSimple size={12} />
          Edit Monitor
        </button>
      </div>

      <div className="mt-4 space-y-5 text-[13px] text-[#202124]">
        <p className="font-mono text-[12px] text-[#5f6368]">{`{{#is_alert}}`}</p>

        <div>
          <h4 className="flex items-center gap-2 text-[15px] font-semibold">
            <Warning size={16} weight="fill" className="text-[#d93025]" />
            What&apos;s happening
          </h4>
          <p className="mt-2 leading-relaxed text-[#202124]">
            {monitor.message
              .split(/(\{\{[^}]+\}\}|\$application\.name)/g)
              .map((part, i) =>
                part.startsWith("{{") || part === "$application.name" ? (
                  <code
                    key={i}
                    className="rounded-sm bg-[#f1f3f4] px-1 py-0.5 font-mono text-[12px]"
                  >
                    {part}
                  </code>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
          </p>
          <p className="mt-3 leading-relaxed text-[#202124]">
            First triggered at{" "}
            <code className="rounded-sm bg-[#f1f3f4] px-1 py-0.5 font-mono text-[12px]">
              {`{{first_triggered_at}}`}
            </code>
            , active for{" "}
            <code className="rounded-sm bg-[#f1f3f4] px-1 py-0.5 font-mono text-[12px]">
              {`{{triggered_duration_sec}}`}
            </code>{" "}
            seconds.{" "}
            <code className="font-mono text-[12px] text-[#5f6368]">{`{{/is_alert}}`}</code>
          </p>
        </div>

        <p className="font-mono text-[12px] text-[#5f6368]">{`{{#is_recovery}}`}</p>

        <div>
          <h4 className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[#34a853] text-white">
              ✓
            </span>
            Recovered
          </h4>
          <p className="mt-2 leading-relaxed text-[#202124]">
            {monitor.recoveryMessage
              .split(/(\{\{[^}]+\}\}|\$application\.name)/g)
              .map((part, i) =>
                part.startsWith("{{") || part === "$application.name" ? (
                  <code
                    key={i}
                    className="rounded-sm bg-[#f1f3f4] px-1 py-0.5 font-mono text-[12px]"
                  >
                    {part}
                  </code>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}{" "}
            <code className="font-mono text-[12px] text-[#5f6368]">{`{{/is_recovery}}`}</code>
          </p>
          <p className="mt-2 font-mono text-[12px] text-[#5f6368]">{`{{^is_recovery}}`}</p>
        </div>

        <div>
          <h4 className="flex items-center gap-2 text-[15px] font-semibold">
            <span aria-hidden>📈</span>
            Impact
          </h4>
          <p className="mt-2 leading-relaxed text-[#202124]">{monitor.impact}</p>
        </div>

        <div>
          <h4 className="text-[15px] font-semibold">Runbook</h4>
          <h5 className="mt-3 text-[13px] font-semibold">Initial Troubleshooting Steps</h5>
          <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed text-[#202124]">
            {monitor.runbookSteps.map((step, i) => (
              <li key={i}>
                {step
                  .split(/(`[^`]+`|\bRUM Error Tracking\b|\bRUM Explorer\b)/g)
                  .map((p, j) =>
                    p.startsWith("`") && p.endsWith("`") ? (
                      <code
                        key={j}
                        className="rounded-sm bg-[#f1f3f4] px-1 py-0.5 font-mono text-[12px]"
                      >
                        {p.slice(1, -1)}
                      </code>
                    ) : p === "RUM Error Tracking" || p === "RUM Explorer" ? (
                      <a
                        key={j}
                        href="#"
                        className="text-[#1a73e8] hover:underline"
                      >
                        {p}
                      </a>
                    ) : (
                      <span key={j}>{p}</span>
                    ),
                  )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function NextSteps() {
  return (
    <aside className="rounded-md border border-[#dadce0] bg-white p-4">
      <h3 className="text-[14px] font-medium text-[#202124]">Next Steps</h3>
      <button
        type="button"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#bdc1c6] bg-white py-2 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        <SpeakerHigh size={14} />
        Mute
      </button>

      <p className="mt-5 text-[12px] uppercase tracking-wide text-[#5f6368]">
        More Actions
      </p>
      <div className="mt-2 flex">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-l-md border border-[#bdc1c6] bg-white py-2 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <Bell size={14} />
          Declare Incident
        </button>
        <button
          type="button"
          className="flex w-8 items-center justify-center rounded-r-md border border-l-0 border-[#bdc1c6] bg-white text-[#5f6368] hover:bg-[#f1f3f4]"
          aria-label="More incident options"
        >
          <CaretDown size={10} weight="bold" />
        </button>
      </div>
      <button
        type="button"
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#bdc1c6] bg-white py-2 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        <Clipboard size={14} />
        Create Case
      </button>

      <p className="mt-5 text-[12px] uppercase tracking-wide text-[#5f6368]">
        Suggested Resources
      </p>
      <button
        type="button"
        className="mt-2 inline-flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        <span className="flex items-center gap-2">
          <Eye size={14} />
          Event Explorer
        </span>
        <span aria-hidden className="text-[#5f6368]">↗</span>
      </button>
    </aside>
  );
}

function StatusPill({ status }: { status: MonitorStatus }) {
  const styles: Record<MonitorStatus, string> = {
    OK: "bg-[#34a853] text-white",
    Alert: "bg-[#d93025] text-white",
    Warn: "bg-[#f9ab00] text-white",
    "No Data": "bg-[#9aa0a6] text-white",
  };
  const label = status === "No Data" ? "NO DATA" : status.toUpperCase();
  return (
    <span
      className={`inline-flex h-6 min-w-[60px] items-center justify-center rounded-sm px-3 text-[11px] font-semibold tracking-wide ${styles[status]}`}
    >
      {label}
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-[#1a73e8]" : "bg-[#bdc1c6]"
      }`}
    >
      <span
        className={`h-3 w-3 rounded-full bg-white transition-transform ${
          on ? "translate-x-3" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function formatCreated(ms: number): string {
  const d = new Date(ms);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const h12 = ((hours + 11) % 12) + 1;
  return `${month} ${day}, ${year}, ${h12}:${minutes} ${ampm}`;
}
