"use client";

import {
  Check,
  GitBranch,
  GitCommit,
  MagnifyingGlass,
  Play,
  Prohibit,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { FacetPanel, type FacetGroup } from "@/components/ui/FacetPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useCiExecutions } from "../hooks";
import type { CiExecutionStatus, CiPipelineExecution } from "../types";

type Hierarchy = "pipeline" | "stage" | "job" | "step" | "command";
const HIERARCHIES: Hierarchy[] = ["pipeline", "stage", "job", "step", "command"];

const STATUS_ICON: Record<CiExecutionStatus, React.ReactNode> = {
  success: <Check size={12} weight="bold" className="text-[#137333]" />,
  failure: <X size={12} weight="bold" className="text-[#d32f2f]" />,
  canceled: <Prohibit size={12} weight="bold" className="text-[#5f6368]" />,
  running: <Play size={12} weight="bold" className="text-[#1a73e8]" />,
};

const STATUS_COLOR: Record<CiExecutionStatus, string> = {
  success: "#137333",
  failure: "#d32f2f",
  canceled: "#5f6368",
  running: "#1a73e8",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function PipelineExecutionsList() {
  const router = useRouter();
  const { data: executions, isLoading } = useCiExecutions();
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [search, setSearch] = useState("");
  const [hierarchy, setHierarchy] = useState<Hierarchy>("pipeline");

  const filtered = useMemo(() => {
    if (!executions) return [];
    return executions.filter((e) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(e.pipelineName ?? "").toLowerCase().includes(q) &&
          !e.commitSha.toLowerCase().includes(q) &&
          !e.branch.toLowerCase().includes(q)
        )
          return false;
      }
      const st = filters.status;
      if (st?.size && !st.has(e.status)) return false;
      const sv = filters.service;
      if (sv?.size && !(e.service && sv.has(e.service))) return false;
      const ed = filters.error_domain;
      if (ed?.size && !(e.errorDomain && ed.has(e.errorDomain))) return false;
      const br = filters.branch;
      if (br?.size && !br.has(e.branch)) return false;
      return true;
    });
  }, [executions, filters, search]);

  const facetGroups: FacetGroup[] = useMemo(() => {
    const stCounts = new Map<string, number>();
    const svCounts = new Map<string, number>();
    const edCounts = new Map<string, number>();
    const brCounts = new Map<string, number>();
    for (const e of executions ?? []) {
      stCounts.set(e.status, (stCounts.get(e.status) ?? 0) + 1);
      if (e.service) svCounts.set(e.service, (svCounts.get(e.service) ?? 0) + 1);
      if (e.errorDomain)
        edCounts.set(e.errorDomain, (edCounts.get(e.errorDomain) ?? 0) + 1);
      brCounts.set(e.branch, (brCounts.get(e.branch) ?? 0) + 1);
    }
    return [
      {
        key: "status",
        title: "Status",
        options: ["success", "failure", "canceled"].map((s) => ({
          value: s,
          label: s,
          count: stCounts.get(s) ?? 0,
        })),
      },
      {
        key: "service",
        title: "Service",
        searchable: true,
        options: Array.from(svCounts.entries()).map(([v, c]) => ({
          value: v,
          count: c,
        })),
      },
      {
        key: "error_domain",
        title: "Error domain",
        options: Array.from(edCounts.entries()).map(([v, c]) => ({
          value: v,
          label: v.replace("_", " "),
          count: c,
        })),
      },
      {
        key: "branch",
        title: "Branch",
        searchable: true,
        options: Array.from(brCounts.entries()).map(([v, c]) => ({
          value: v,
          count: c,
        })),
      },
    ];
  }, [executions]);

  const summary = useMemo(() => {
    if (!filtered.length) return null;
    // Most-active pipelines by count
    const byPipeline = new Map<string, number[]>();
    const failedByDay = new Map<string, number>();
    const execByDay = new Map<string, number>();
    for (const e of filtered) {
      const pn = e.pipelineName ?? "—";
      byPipeline.set(pn, [...(byPipeline.get(pn) ?? []), e.durationMs ?? 0]);
      const day = new Date(e.startedMs).toISOString().slice(0, 10);
      execByDay.set(day, (execByDay.get(day) ?? 0) + 1);
      if (e.status === "failure")
        failedByDay.set(day, (failedByDay.get(day) ?? 0) + 1);
    }
    const topPipelines = Array.from(byPipeline.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([name, durations]) => ({
        name,
        avgSec: durations.reduce((a, b) => a + b, 0) / durations.length / 1000,
      }));
    const days = Array.from(
      new Set([...execByDay.keys(), ...failedByDay.keys()]),
    ).sort();
    const failed = days.map((d) => ({
      day: d.slice(5),
      failed: failedByDay.get(d) ?? 0,
    }));
    const exec = days.map((d) => ({
      day: d.slice(5),
      execs: execByDay.get(d) ?? 0,
    }));
    return { topPipelines, failed, exec };
  }, [filtered]);

  const onToggle = (group: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      const cur = new Set(next[group] ?? new Set<string>());
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      next[group] = cur;
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={GitBranch}
        title="Pipeline Executions"
        breadcrumbs={[{ label: "CI Visibility", href: "/ci/pipelines" }]}
        subtitle="Continuous integration runs across all services"
        actions={
          <a
            href="/ci/test-services"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            Test Impact Analysis
          </a>
        }
      />

      <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2">
        <span className="text-[11.5px] uppercase text-[#5f6368]">Group:</span>
        {HIERARCHIES.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHierarchy(h)}
            className={`rounded-md border px-2 py-1 text-[12px] capitalize ${
              hierarchy === h
                ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]"
            }`}
          >
            {h}
          </button>
        ))}
        <div className="ml-auto flex h-8 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
          <MagnifyingGlass size={13} className="text-[#5f6368]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pipeline, branch, or commit"
            className="w-[280px] bg-transparent text-[12.5px] outline-none placeholder:text-[#5f6368]"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <FacetPanel
          groups={facetGroups}
          selected={filters}
          onToggle={onToggle}
        />

        <main className="flex-1 overflow-y-auto">
          {summary && (
            <div className="grid grid-cols-3 gap-3 border-b border-[#e8eaed] bg-white px-4 py-3">
              <Card title="Most active pipelines">
                <ResponsiveContainer height={120}>
                  <BarChart data={summary.topPipelines}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "#5f6368" }}
                    />
                    <YAxis tick={{ fontSize: 9, fill: "#5f6368" }} />
                    <Tooltip />
                    <Bar dataKey="avgSec" fill="#1a73e8" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Failed over time">
                <ResponsiveContainer height={120}>
                  <LineChart data={summary.failed}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: "#5f6368" }}
                    />
                    <YAxis tick={{ fontSize: 9, fill: "#5f6368" }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#d32f2f"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Executions">
                <ResponsiveContainer height={120}>
                  <LineChart data={summary.exec}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: "#5f6368" }}
                    />
                    <YAxis tick={{ fontSize: 9, fill: "#5f6368" }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="execs"
                      stroke="#1a73e8"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-[#f1f3f4] text-[11px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Pipeline</th>
                  <th className="px-4 py-2 text-left font-medium">Branch</th>
                  <th className="px-4 py-2 text-left font-medium">Commit</th>
                  <th className="px-4 py-2 text-left font-medium">Duration</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                  <th className="px-4 py-2 text-left font-medium">Author</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#5f6368]">
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[#5f6368]">
                      <GitBranch size={32} className="mx-auto mb-2 opacity-40" />
                      No executions match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((e) => (
                  <Row
                    key={e.id}
                    execution={e}
                    onClick={() =>
                      router.push(`/ci/pipeline-executions/${e.id}`)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#dadce0] bg-white p-2">
      <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  execution,
  onClick,
}: {
  execution: CiPipelineExecution;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa]"
    >
      <td className="px-4 py-2.5">
        <span
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium"
          style={{
            color: STATUS_COLOR[execution.status],
            background: `${STATUS_COLOR[execution.status]}15`,
          }}
        >
          {STATUS_ICON[execution.status]}
          {execution.status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="font-medium text-[#202124]">
          {execution.pipelineName}
        </div>
        {execution.service && (
          <div className="mt-0.5 font-mono text-[11px] text-[#5f6368]">
            {execution.service}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="inline-flex items-center gap-1 text-[12px] text-[#5f6368]">
          <GitBranch size={11} />
          {execution.branch}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="inline-flex items-center gap-1 font-mono text-[12px] text-[#5f6368]">
          <GitCommit size={11} />
          {execution.commitSha}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {fmtDuration(execution.durationMs)}
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {relativeTime(execution.startedMs)}
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {execution.triggeredBy ?? "—"}
      </td>
    </tr>
  );
}
