"use client";

import {
  ArrowsCounterClockwise,
  Check,
  PencilSimple,
  Pause,
  Play,
  Trash,
  Warning,
  X as XIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useDeleteSyntheticTest,
  usePatchSyntheticTest,
  useRunSyntheticTest,
  useSyntheticResults,
  useSyntheticTest,
} from "../hooks";
import { LOCATIONS, statusBg, statusColor } from "../types";
import type { SyntheticResult, SyntheticTest } from "../types";

function fmtAgo(ms: number | null): string {
  if (ms == null) return "Never";
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtFreq(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr`;
  return `${Math.floor(h / 24)}d`;
}

function locationLabel(id: string): string {
  return LOCATIONS.find((l) => l.id === id)?.label ?? id;
}

export function SyntheticTestDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: test, isLoading } = useSyntheticTest(id);
  const { data: results = [] } = useSyntheticResults(id);
  const runMut = useRunSyntheticTest();
  const patchMut = usePatchSyntheticTest(id);
  const deleteMut = useDeleteSyntheticTest();
  const [tab, setTab] = useState<"results" | "config">("results");

  if (isLoading || !test) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-white text-[#202124]">
      <header className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/synthetics/tests"
            className="text-[12px] text-[#1a73e8] hover:underline"
          >
            ← Tests
          </Link>
          <span className="text-[#dadce0]">/</span>
          <StatusPill status={test.lastStatus} />
          <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#1967d2]">
            {test.method}
          </span>
          <h1 className="text-[15px] font-medium">{test.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => runMut.mutate(test.id)}
            disabled={runMut.isPending}
          >
            <ArrowsCounterClockwise size={14} />
            {runMut.isPending ? "Running…" : "Run now"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => patchMut.mutate({ enabled: !test.enabled })}
          >
            {test.enabled ? <Pause size={14} /> : <Play size={14} />}
            {test.enabled ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => router.push(`/synthetics/tests/${test.id}/edit`)}
          >
            <PencilSimple size={14} />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              if (window.confirm(`Delete synthetic test "${test.name}"?`)) {
                deleteMut.mutate(test.id, {
                  onSuccess: () => router.push("/synthetics/tests"),
                });
              }
            }}
          >
            <Trash size={14} />
            Delete
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 border-b border-[#dadce0] bg-[#f8f9fa] px-6 py-4">
        <Stat label="URL" value={test.url} mono />
        <Stat label="Frequency" value={fmtFreq(test.frequencySeconds)} />
        <Stat
          label="Locations"
          value={`${test.locations.length} location${
            test.locations.length === 1 ? "" : "s"
          }`}
        />
        <Stat label="Last run" value={fmtAgo(test.lastRunMs)} />
      </div>

      <div className="border-b border-[#dadce0] bg-white px-6">
        {(["results", "config"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "px-4 py-3 text-[13px] font-medium capitalize " +
              (tab === t
                ? "border-b-2 border-[#006CC2] text-[#202124]"
                : "text-[#5f6368] hover:text-[#202124]")
            }
          >
            {t === "results" ? "Test Results" : "Configuration"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {tab === "results" ? (
          <ResultsTable results={results} />
        ) : (
          <ConfigPanel test={test} />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
        {label}
      </div>
      <div
        className={
          "mt-0.5 truncate text-[13px] text-[#202124] " +
          (mono ? "font-mono" : "")
        }
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SyntheticTest["lastStatus"] }) {
  const Icon = status === "OK" ? Check : status === "ALERT" ? Warning : XIcon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: statusColor(status),
        backgroundColor: statusBg(status),
      }}
    >
      <Icon size={11} weight="bold" />
      {status}
    </span>
  );
}

function ResultsTable({ results }: { results: SyntheticResult[] }) {
  const [selected, setSelected] = useState<SyntheticResult | null>(
    results[0] ?? null,
  );

  const aggregate = useMemo(() => {
    if (results.length === 0) return null;
    const ok = results.filter((r) => r.status === "OK").length;
    const totalRt = results.reduce((s, r) => s + (r.responseTimeMs ?? 0), 0);
    const avg = Math.round(totalRt / results.length);
    return { ok, total: results.length, avgMs: avg };
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
        <div className="text-[14px] font-medium text-[#202124]">
          No results yet
        </div>
        <p className="text-[12px] text-[#5f6368]">
          Click <strong>Run now</strong> or wait for the next scheduled run.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        {aggregate && (
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-[#dadce0] bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
                Uptime
              </div>
              <div className="mt-0.5 text-[18px] font-semibold text-[#1A8341]">
                {((aggregate.ok / aggregate.total) * 100).toFixed(2)}%
              </div>
              <div className="text-[11px] text-[#5f6368]">
                {aggregate.ok} / {aggregate.total} runs OK
              </div>
            </div>
            <div className="rounded-md border border-[#dadce0] bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
                Avg response time
              </div>
              <div className="mt-0.5 text-[18px] font-semibold">
                {aggregate.avgMs} ms
              </div>
            </div>
            <div className="rounded-md border border-[#dadce0] bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
                Last 100 runs
              </div>
              <div className="mt-1 flex h-5 items-end gap-[2px]">
                {results
                  .slice(0, 100)
                  .reverse()
                  .map((r, i) => (
                    <div
                      key={i}
                      title={`${r.status} · ${r.responseTimeMs ?? 0}ms`}
                      className="h-full w-1 rounded-sm"
                      style={{
                        backgroundColor: r.status === "OK" ? "#34a853" : "#d93025",
                      }}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-[#f8f9fa] text-left text-[12px] font-medium text-[#5f6368]">
            <tr>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">When</th>
              <th className="px-2 py-2 font-medium">Location</th>
              <th className="px-2 py-2 font-medium">HTTP</th>
              <th className="px-2 py-2 font-medium">Response time</th>
              <th className="px-2 py-2 font-medium">Assertions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const passed = r.assertionResults.filter((a) => a.passed).length;
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={
                    "cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa] " +
                    (selected?.id === r.id ? "bg-[#e6f1f9]" : "")
                  }
                >
                  <td className="px-3 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        color: r.status === "OK" ? "#1A8341" : "#D93025",
                        backgroundColor: r.status === "OK" ? "#E6F4EA" : "#FCE8E6",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-[#5f6368]">
                    {fmtAgo(r.executedMs)}
                  </td>
                  <td className="px-2 py-2 text-[#5f6368]">
                    {locationLabel(r.location)}
                  </td>
                  <td className="px-2 py-2 font-mono text-[12px]">
                    {r.statusCode ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-[12px] text-[#5f6368]">
                    {r.responseTimeMs ?? "—"} ms
                  </td>
                  <td className="px-2 py-2 text-[#5f6368]">
                    {passed} / {r.assertionResults.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <ResultDetailPanel result={selected} />}
    </div>
  );
}

function ResultDetailPanel({ result }: { result: SyntheticResult }) {
  return (
    <aside className="w-[360px] flex-shrink-0 space-y-3 rounded-md border border-[#dadce0] bg-white p-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
          Result
        </div>
        <div className="text-[13px] text-[#202124]">
          {new Date(result.executedMs).toLocaleString()} ·{" "}
          {locationLabel(result.location)}
        </div>
      </div>

      {result.errorMessage && (
        <div className="rounded-md bg-[#fce8e6] px-2 py-1.5 text-[12px] text-[#d93025]">
          {result.errorMessage}
        </div>
      )}

      <div>
        <div className="mb-1 text-[11px] font-semibold text-[#5f6368]">
          Timings
        </div>
        {(["dnsMs", "connectionMs", "sslMs", "ttfbMs", "downloadMs"] as const).map(
          (k) => {
            const ms = result.timings[k] ?? 0;
            const total = result.responseTimeMs ?? 1;
            const pct = total > 0 ? Math.min(100, (ms / total) * 100) : 0;
            const label = k.replace("Ms", "");
            return (
              <div key={k} className="mb-1 flex items-center gap-2">
                <div className="w-[60px] text-[11px] capitalize text-[#5f6368]">
                  {label}
                </div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-[#f1f3f4]">
                  <div
                    className="absolute left-0 top-0 h-full bg-[#34a853]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-[50px] text-right font-mono text-[11px] text-[#5f6368]">
                  {ms} ms
                </div>
              </div>
            );
          },
        )}
      </div>

      <div>
        <div className="mb-1 text-[11px] font-semibold text-[#5f6368]">
          Assertions
        </div>
        {result.assertionResults.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 border-b border-[#f1f3f4] py-1 text-[12px]"
          >
            <span className="truncate">
              {a.type}
              {a.target ? ` (${a.target})` : ""} {a.operator}{" "}
              <code className="rounded bg-[#f1f3f4] px-1">
                {String(a.expected ?? "")}
              </code>
            </span>
            <span
              className={
                "rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                (a.passed
                  ? "bg-[#E6F4EA] text-[#1A8341]"
                  : "bg-[#FCE8E6] text-[#D93025]")
              }
            >
              {a.passed ? "PASS" : "FAIL"}
            </span>
          </div>
        ))}
        {result.assertionResults.length === 0 && (
          <div className="text-[11px] text-[#9aa0a6]">No assertions configured</div>
        )}
      </div>

      <div>
        <div className="mb-1 text-[11px] font-semibold text-[#5f6368]">
          Response headers
        </div>
        <div className="max-h-[180px] overflow-auto rounded-md border border-[#dadce0] bg-[#f8f9fa] p-2 font-mono text-[11px] text-[#202124]">
          {Object.entries(result.responseHeaders).length === 0 ? (
            <span className="text-[#9aa0a6]">none</span>
          ) : (
            Object.entries(result.responseHeaders).map(([k, v]) => (
              <div key={k} className="break-all">
                <span className="text-[#1967d2]">{k}</span>: {v}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function ConfigPanel({ test }: { test: SyntheticTest }) {
  return (
    <div className="space-y-4">
      <ConfigBlock title="Request">
        <KV label="Method" value={test.method} mono />
        <KV label="URL" value={test.url} mono />
        <KV label="Timeout" value={`${test.request.timeoutMs ?? 15000} ms`} />
        <KV
          label="Headers"
          value={
            test.request.headers.length === 0
              ? "—"
              : test.request.headers.map((h) => `${h.key}: ${h.value}`).join(", ")
          }
        />
        <KV
          label="Query"
          value={
            test.request.query.length === 0
              ? "—"
              : test.request.query.map((q) => `${q.key}=${q.value}`).join(", ")
          }
        />
        {test.request.body && (
          <KV label="Body" value={test.request.body} mono />
        )}
      </ConfigBlock>

      <ConfigBlock title="Assertions">
        {test.assertions.length === 0 ? (
          <div className="text-[12px] text-[#9aa0a6]">None</div>
        ) : (
          <ul className="space-y-1 text-[12px]">
            {test.assertions.map((a, i) => (
              <li key={i}>
                <code className="rounded bg-[#f1f3f4] px-1">
                  {a.type}
                  {a.target ? `(${a.target})` : ""} {a.operator}{" "}
                  {String(a.expected ?? "")}
                </code>
              </li>
            ))}
          </ul>
        )}
      </ConfigBlock>

      <ConfigBlock title="Schedule">
        <KV label="Frequency" value={fmtFreq(test.frequencySeconds)} />
        <KV
          label="Locations"
          value={test.locations.map(locationLabel).join(", ") || "—"}
        />
      </ConfigBlock>

      <ConfigBlock title="Metadata">
        <KV label="Environment" value={test.environment ?? "—"} />
        <KV label="Team" value={test.team ?? "—"} />
        <KV label="Tags" value={test.tags.join(", ") || "—"} />
        <KV label="Enabled" value={test.enabled ? "Yes" : "No"} />
        <KV label="Created" value={new Date(test.createdMs).toLocaleString()} />
        <KV label="Modified" value={new Date(test.modifiedMs).toLocaleString()} />
      </ConfigBlock>
    </div>
  );
}

function ConfigBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#dadce0] bg-white">
      <div className="border-b border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-[12px] font-medium text-[#202124]">
        {title}
      </div>
      <div className="space-y-1.5 px-3 py-2">{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-[12px]">
      <div className="w-[100px] shrink-0 text-[#5f6368]">{label}</div>
      <div
        className={
          "min-w-0 flex-1 break-all text-[#202124] " + (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
