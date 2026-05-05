"use client";

import {
  ArrowLeft,
  Check,
  GitBranch,
  GitCommit,
  Play,
  Prohibit,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useCiExecution, useCiTestRuns } from "../hooks";
import type { CiJob, CiJobStatus } from "../types";

type Tab = "waterfall" | "errors" | "logs" | "tests";

const STATUS_COLOR: Record<CiJobStatus, string> = {
  success: "#137333",
  failure: "#d32f2f",
  canceled: "#5f6368",
  skipped: "#9aa0a6",
  running: "#1a73e8",
};

const STATUS_ICON: Record<CiJobStatus, React.ReactNode> = {
  success: <Check size={11} weight="bold" />,
  failure: <X size={11} weight="bold" />,
  canceled: <Prohibit size={11} weight="bold" />,
  skipped: <Prohibit size={11} weight="bold" />,
  running: <Play size={11} weight="bold" />,
};

function fmtDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function PipelineExecutionDetail({
  executionId,
}: {
  executionId: string;
}) {
  const router = useRouter();
  const { data: execution, isLoading } = useCiExecution(executionId);
  const { data: tests } = useCiTestRuns(executionId);
  const [tab, setTab] = useState<Tab>("waterfall");

  const stages = useMemo(() => {
    if (!execution?.jobs) return [];
    const byParent = new Map<string | null, CiJob[]>();
    for (const j of execution.jobs) {
      const p = j.parentJobId ?? null;
      byParent.set(p, [...(byParent.get(p) ?? []), j]);
    }
    return byParent.get(null) ?? [];
  }, [execution]);

  if (isLoading || !execution) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading execution…
      </div>
    );
  }

  const totalDur = execution.durationMs ?? 1;
  const errors = execution.jobs.filter((j) => j.status === "failure");

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={GitBranch}
        title={`${execution.pipelineName} · ${execution.commitSha}`}
        breadcrumbs={[
          { label: "CI Visibility", href: "/ci/pipelines" },
          { label: "Executions", href: "/ci/pipeline-executions" },
        ]}
        actions={
          <button
            type="button"
            onClick={() => router.push("/ci/pipeline-executions")}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            <ArrowLeft size={12} />
            Back
          </button>
        }
      />

      <div className="flex items-center gap-3 border-b border-[#dadce0] bg-white px-6 py-3 text-[12.5px]">
        <span
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] font-medium"
          style={{
            color: STATUS_COLOR[execution.status as CiJobStatus],
            background: `${STATUS_COLOR[execution.status as CiJobStatus]}15`,
          }}
        >
          {STATUS_ICON[execution.status as CiJobStatus]}
          {execution.status}
        </span>
        <span className="inline-flex items-center gap-1 text-[#5f6368]">
          <GitBranch size={11} />
          {execution.branch}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[#5f6368]">
          <GitCommit size={11} />
          {execution.commitSha}
        </span>
        <span className="text-[#5f6368]">{execution.triggeredBy}</span>
        <span className="text-[#5f6368]">
          {fmtDuration(execution.durationMs ?? 0)}
        </span>
        {execution.errorDomain && (
          <span className="rounded bg-[#fde7e7] px-2 py-0.5 text-[11px] text-[#d32f2f]">
            {execution.errorDomain.replace("_", " ")}
          </span>
        )}
      </div>

      <div className="border-b border-[#dadce0] bg-white px-6">
        <div className="flex gap-1">
          {(["waterfall", "errors", "logs", "tests"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-[13px] capitalize transition-colors ${
                tab === t ? "font-medium text-[#1a73e8]" : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1a73e8]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === "waterfall" && (
          <Waterfall
            stages={stages}
            jobs={execution.jobs}
            totalDur={totalDur}
            startMs={execution.startedMs}
          />
        )}
        {tab === "errors" && (
          <Card title={`Errors (${errors.length})`}>
            {errors.length === 0 ? (
              <p className="text-[12.5px] italic text-[#9aa0a6]">
                No failures in this execution.
              </p>
            ) : (
              <ul className="space-y-3">
                {errors.map((j) => (
                  <li key={j.id} className="rounded-md border border-[#dadce0] p-3">
                    <div className="font-medium text-[#d32f2f]">{j.name}</div>
                    <div className="mt-1 font-mono text-[11.5px] text-[#5f6368]">
                      {j.logsExcerpt ?? "(no log excerpt)"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {tab === "logs" && (
          <Card title="Logs">
            <pre className="max-h-[480px] overflow-auto rounded-md bg-[#202124] p-3 font-mono text-[11.5px] text-[#e8eaed]">
              {execution.jobs
                .map((j) => `[${j.kind}] ${j.name}: ${j.logsExcerpt ?? ""}`)
                .join("\n")}
            </pre>
          </Card>
        )}
        {tab === "tests" && (
          <Card title={`Tests (${tests?.length ?? 0})`}>
            <table className="min-w-full text-[12.5px]">
              <thead className="text-[10.5px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5 text-left">Suite</th>
                  <th className="px-2 py-1.5 text-left">Test</th>
                  <th className="px-2 py-1.5 text-left">Duration</th>
                  <th className="px-2 py-1.5 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {(tests ?? []).slice(0, 50).map((t) => (
                  <tr key={t.id} className="border-t border-[#f1f3f4]">
                    <td className="px-2 py-1">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          color:
                            t.status === "passed"
                              ? "#137333"
                              : t.status === "failed"
                                ? "#d32f2f"
                                : t.status === "flaky"
                                  ? "#a07000"
                                  : "#5f6368",
                          background:
                            t.status === "passed"
                              ? "#e1f3e6"
                              : t.status === "failed"
                                ? "#fde7e7"
                                : t.status === "flaky"
                                  ? "#fff9d9"
                                  : "#f1f3f4",
                        }}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-[#5f6368]">{t.suite}</td>
                    <td className="px-2 py-1 font-mono">{t.testName}</td>
                    <td className="px-2 py-1 text-[#5f6368]">
                      {(t.durationMs / 1000).toFixed(2)}s
                    </td>
                    <td className="px-2 py-1 text-[11px] text-[#5f6368]">
                      {t.errorMessage ?? t.skippedReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

function Waterfall({
  stages,
  jobs,
  totalDur,
  startMs,
}: {
  stages: CiJob[];
  jobs: CiJob[];
  totalDur: number;
  startMs: number;
}) {
  const childMap = useMemo(() => {
    const map = new Map<string, CiJob[]>();
    for (const j of jobs) {
      if (!j.parentJobId) continue;
      map.set(j.parentJobId, [...(map.get(j.parentJobId) ?? []), j]);
    }
    return map;
  }, [jobs]);

  return (
    <Card title="Waterfall">
      <div className="space-y-1.5">
        {stages.map((s) => (
          <div key={s.id}>
            <Bar job={s} totalDur={totalDur} startMs={startMs} indent={0} />
            {(childMap.get(s.id) ?? []).map((c) => (
              <Bar
                key={c.id}
                job={c}
                totalDur={totalDur}
                startMs={startMs}
                indent={1}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Bar({
  job,
  totalDur,
  startMs,
  indent,
}: {
  job: CiJob;
  totalDur: number;
  startMs: number;
  indent: number;
}) {
  const offsetPct = ((job.startedMs - startMs) / totalDur) * 100;
  const widthPct = Math.max(0.5, (job.durationMs / totalDur) * 100);
  return (
    <div
      className="relative h-6 rounded bg-[#f8f9fb]"
      style={{ marginLeft: indent * 18 }}
    >
      <div
        className="absolute top-0 flex h-full items-center rounded px-1 text-[10.5px] text-white"
        style={{
          left: `${offsetPct}%`,
          width: `${widthPct}%`,
          background: STATUS_COLOR[job.status],
          minWidth: "60px",
        }}
        title={`${job.name} · ${fmtDuration(job.durationMs)}`}
      >
        <span className="truncate">
          {job.name} · {fmtDuration(job.durationMs)}
        </span>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      {children}
    </section>
  );
}
