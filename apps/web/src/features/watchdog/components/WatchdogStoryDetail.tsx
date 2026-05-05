"use client";

import {
  ArrowLeft,
  Cube,
  Lightbulb,
  ListMagnifyingGlass,
  Pulse,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { SeverityLevel, StatusKind } from "@/lib/severity";
import { usePatchWatchdogStory, useWatchdogStory } from "../hooks";
import type { WatchdogSeverity } from "../types";

const SEV_TO_LEVEL: Record<WatchdogSeverity, SeverityLevel> = {
  high: "critical",
  medium: "high",
  low: "medium",
};

const KIND_LABEL: Record<string, string> = {
  anomaly: "Anomaly",
  outlier: "Outlier",
  deployment_regression: "Deployment regression",
  deviation: "Deviation",
};

function fmt(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WatchdogStoryDetail({ storyId }: { storyId: string }) {
  const router = useRouter();
  const { data: story, isLoading } = useWatchdogStory(storyId);
  const patch = usePatchWatchdogStory();

  const chartData = useMemo(() => {
    if (!story?.evidence?.points) return [];
    return story.evidence.points.map((p) => ({
      ts: p.ts,
      time: new Date(p.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      value: p.value,
      upper: story.evidence.upper,
      lower: story.evidence.lower,
    }));
  }, [story]);

  if (isLoading || !story) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading story…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Lightbulb}
        title={story.title}
        breadcrumbs={[{ label: "Watchdog", href: "/watchdog" }]}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/watchdog")}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <ArrowLeft size={12} />
              Back
            </button>
            {story.status === "active" && (
              <button
                type="button"
                onClick={() =>
                  patch.mutate({ id: story.id, status: "acknowledged" })
                }
                className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
              >
                Acknowledge
              </button>
            )}
            {story.status !== "resolved" && (
              <button
                type="button"
                onClick={() =>
                  patch.mutate({ id: story.id, status: "resolved" })
                }
                className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9]"
              >
                Resolve
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-4 flex items-center gap-3">
            <SeverityBadge severity={SEV_TO_LEVEL[story.severity]} size="md" />
            <StatusPill status={story.status as StatusKind} size="md" />
            <span className="rounded bg-[#f1f3f4] px-2 py-1 text-[12px] text-[#5f6368]">
              {KIND_LABEL[story.kind]}
            </span>
            <span className="text-[12px] text-[#5f6368]">
              Started {fmt(story.startedMs)}
              {story.endedMs && ` · Ended ${fmt(story.endedMs)}`}
            </span>
          </div>

          <section className="mb-6 rounded-lg border border-[#dadce0] bg-white p-5">
            <h3 className="mb-2 text-[15px] font-semibold text-[#202124]">
              What happened
            </h3>
            <p className="text-[13.5px] leading-relaxed text-[#202124]">
              {story.narrative}
            </p>
          </section>

          {chartData.length > 0 && (
            <section className="mb-6 rounded-lg border border-[#dadce0] bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#202124]">
                  Evidence
                </h3>
                <span className="text-[12px] text-[#5f6368]">
                  {story.metric ?? "metric"} · last 30 minutes
                </span>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer>
                  <ComposedChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "#5f6368" }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#5f6368" }} />
                    <Tooltip />
                    {story.evidence.upper !== undefined && (
                      <ReferenceLine
                        y={story.evidence.upper}
                        stroke="#bdc1c6"
                        strokeDasharray="3 3"
                      />
                    )}
                    {story.evidence.lower !== undefined && (
                      <ReferenceLine
                        y={story.evidence.lower}
                        stroke="#bdc1c6"
                        strokeDasharray="3 3"
                      />
                    )}
                    {story.evidence.baseline !== undefined && (
                      <ReferenceLine
                        y={story.evidence.baseline}
                        stroke="#9aa0a6"
                        strokeDasharray="6 4"
                        label={{
                          value: "baseline",
                          fill: "#9aa0a6",
                          fontSize: 10,
                          position: "right",
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#1a73e8"
                      strokeWidth={1.8}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {story.evidence.sigmas !== undefined && (
                <div className="mt-2 text-[11.5px] text-[#5f6368]">
                  σ deviation: <strong>{story.evidence.sigmas.toFixed(2)}</strong>
                  {story.evidence.baseline !== undefined && (
                    <>
                      {" · "}baseline: <strong>{story.evidence.baseline.toFixed(2)}</strong>
                    </>
                  )}
                  {story.evidence.currentValue !== undefined && (
                    <>
                      {" · "}current: <strong>{story.evidence.currentValue.toFixed(2)}</strong>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </main>

        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-[#dadce0] bg-white px-4 py-4">
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
            Related entities
          </h4>
          <ul className="space-y-1.5 text-[13px]">
            <li>
              <a
                href={`/apm/services/${story.service}`}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[#1a73e8] hover:bg-[#f1f3f4]"
              >
                <Cube size={14} />
                Service: {story.service}
              </a>
            </li>
            {story.metric && (
              <li>
                <a
                  href={`/metric/explore?metric=${encodeURIComponent(story.metric)}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-[#1a73e8] hover:bg-[#f1f3f4]"
                >
                  <Pulse size={14} />
                  Metric: {story.metric}
                </a>
              </li>
            )}
            <li>
              <a
                href={`/logs?service=${encodeURIComponent(story.service)}`}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[#1a73e8] hover:bg-[#f1f3f4]"
              >
                <ListMagnifyingGlass size={14} />
                Service logs
              </a>
            </li>
          </ul>

          <h4 className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
            Suggested next steps
          </h4>
          <ul className="space-y-2 text-[12.5px] text-[#5f6368]">
            <li>· Open the service detail page to inspect resources by p95.</li>
            <li>· Correlate with recent deploys or infra changes.</li>
            <li>· Pivot to logs for the affected window.</li>
            <li>· Declare an incident if customer-facing.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
