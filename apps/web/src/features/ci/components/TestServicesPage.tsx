"use client";

import { GitBranch, Sparkle } from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useCiTestServices } from "../hooks";
import type { CiTestServiceStat } from "../types";

function fmtMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export function TestServicesPage() {
  const { data: stats, isLoading } = useCiTestServices(14);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Sparkle}
        title="Test Impact Analysis"
        breadcrumbs={[{ label: "CI Visibility", href: "/ci/pipelines" }]}
        subtitle="Smart test selection — skipped tests, time saved, per-service trends"
        actions={
          <a
            href="/ci/pipeline-executions"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            <GitBranch size={12} />
            Pipeline executions
          </a>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && (
          <div className="text-[13px] text-[#5f6368]">Loading…</div>
        )}
        {stats && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-4">
              <Summary
                label="Total tests (14d)"
                value={stats.reduce((a, s) => a + s.totalTests, 0).toLocaleString()}
                tone="#202124"
              />
              <Summary
                label="Skipped by ITR"
                value={stats
                  .reduce((a, s) => a + s.skippedByItr, 0)
                  .toLocaleString()}
                tone="#1a73e8"
              />
              <Summary
                label="Time saved"
                value={fmtMs(stats.reduce((a, s) => a + s.timeSavedMs, 0))}
                tone="#137333"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {stats.map((s) => (
                <ServiceCard key={s.service} stat={s} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </section>
  );
}

function ServiceCard({ stat }: { stat: CiTestServiceStat }) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <header className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[13px] text-[#202124]">{stat.service}</div>
        <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 text-[10.5px] font-medium text-[#1a73e8]">
          {stat.skipRatePct.toFixed(0)}% skipped
        </span>
      </header>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <Stat label="Total" value={stat.totalTests.toLocaleString()} />
        <Stat label="Skipped" value={stat.skippedByItr.toLocaleString()} />
        <Stat label="Saved" value={fmtMs(stat.timeSavedMs)} />
      </div>
      <div className="mt-3 h-[60px]">
        <ResponsiveContainer>
          <LineChart data={stat.dailySeries}>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip
              formatter={(v: number) => fmtMs(v)}
              labelFormatter={(l: string) => l}
            />
            <Line
              type="monotone"
              dataKey="timeSavedMs"
              stroke="#1a73e8"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className="text-[13px] font-semibold text-[#202124]">{value}</div>
    </div>
  );
}
