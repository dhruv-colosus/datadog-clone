"use client";

import {
  ArrowsCounterClockwise,
  Browser,
  Check,
  Heartbeat,
  Pause,
  PencilSimple,
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
import {
  LOCATIONS,
  locationLabel,
  statusBg,
  statusColor,
} from "../types";
import type {
  AssertionResult,
  SyntheticResult,
  SyntheticTest,
} from "../types";

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

function fmtTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

export function SyntheticTestDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: test, isLoading } = useSyntheticTest(id);
  const { data: results = [] } = useSyntheticResults(id);
  const runMut = useRunSyntheticTest();
  const patchMut = usePatchSyntheticTest(id);
  const deleteMut = useDeleteSyntheticTest();
  const [tab, setTab] = useState<"results" | "config">("results");
  const [selectedResult, setSelectedResult] =
    useState<SyntheticResult | null>(null);

  const currentResult = selectedResult ?? results[0] ?? null;

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
            Synthetics
          </Link>
          <span className="text-[#dadce0]">/</span>
          {test.testType === "browser" ? (
            <Browser size={16} className="text-[#632ca6]" />
          ) : (
            <Heartbeat size={16} className="text-[#632ca6]" />
          )}
          <h1 className="text-[15px] font-medium">{test.name}</h1>
          <StatusPill status={test.lastStatus} />
          {test.testType !== "browser" && (
            <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#1967d2]">
              {test.method}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5f6368]">
            Last ran {fmtAgo(test.lastRunMs)}
          </span>
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

      <div className="grid grid-cols-4 gap-4 border-b border-[#dadce0] bg-[#f8f9fa] px-6 py-3">
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
            {t === "results" ? "Test Runs" : "Configuration"}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {tab === "results" ? (
          <>
            <div className="flex flex-1 flex-col overflow-auto px-6 py-4">
              <ResultsTable
                results={results}
                selectedId={currentResult?.id ?? null}
                onSelect={setSelectedResult}
              />
            </div>
            {currentResult && (
              <ResultDetailPanel
                result={currentResult}
                test={test}
                onClose={() => setSelectedResult(null)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-auto px-6 py-4">
            <ConfigPanel test={test} />
          </div>
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

function ResultsTable({
  results,
  selectedId,
  onSelect,
}: {
  results: SyntheticResult[];
  selectedId: string | null;
  onSelect: (r: SyntheticResult) => void;
}) {
  const [tab, setTab] = useState<"all" | "ok" | "alert">("all");

  const filtered = useMemo(() => {
    if (tab === "all") return results;
    if (tab === "ok") return results.filter((r) => r.status === "OK");
    return results.filter((r) => r.status === "ALERT");
  }, [results, tab]);

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
    <div>
      {aggregate && (
        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatCard
            label="Uptime"
            value={`${((aggregate.ok / aggregate.total) * 100).toFixed(2)}%`}
            sub={`${aggregate.ok} / ${aggregate.total} runs OK`}
            color="#1A8341"
          />
          <StatCard
            label="Avg response time"
            value={`${aggregate.avgMs} ms`}
          />
          <div className="rounded-md border border-[#dadce0] bg-white p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
              Last 100 runs
            </div>
            <div className="mt-1.5 flex h-6 items-end gap-[2px]">
              {results
                .slice(0, 100)
                .reverse()
                .map((r, i) => (
                  <div
                    key={i}
                    title={`${r.status} · ${r.responseTimeMs ?? 0}ms`}
                    className="h-full w-1 rounded-sm"
                    style={{
                      backgroundColor:
                        r.status === "OK" ? "#34a853" : "#d93025",
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="text-[13px] font-medium text-[#202124]">Test Runs</div>
        <div className="mt-1 flex items-center gap-3 text-[12px]">
          <button
            type="button"
            className="border-b-2 border-transparent pb-1 text-[#5f6368] hover:text-[#202124]"
          >
            Events
          </button>
          <button
            type="button"
            className="border-b-2 border-[#006CC2] pb-1 text-[#202124]"
          >
            Test Runs
          </button>
        </div>
      </div>

      <div className="mb-2 flex gap-1">
        {(["all", "ok", "alert"] as const).map((t) => {
          const count =
            t === "all"
              ? results.length
              : t === "ok"
                ? results.filter((r) => r.status === "OK").length
                : results.filter((r) => r.status === "ALERT").length;
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-md border px-2 py-1 text-[12px] uppercase " +
                (active
                  ? "border-[#006CC2] bg-[#e6f1f9] text-[#006CC2]"
                  : "border-[#bdc1c6] bg-white text-[#5f6368] hover:bg-[#f1f3f4]")
              }
            >
              {t} {count > 0 && <span className="ml-1">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-[#5f6368]">
        Showing <strong>the last {filtered.length}</strong> test runs in the
        past 1 hour for selected locations
      </div>

      <table className="mt-2 w-full border-collapse text-[13px]">
        <thead className="bg-[#f8f9fa] text-left text-[12px] font-medium text-[#5f6368]">
          <tr>
            <th className="px-3 py-2 font-medium">STATUS</th>
            <th className="px-2 py-2 font-medium">DATE</th>
            <th className="px-2 py-2 font-medium">LOCATION</th>
            <th className="px-2 py-2 font-medium">HTTP</th>
            <th className="px-2 py-2 font-medium">RESPONSE TIME</th>
            <th className="px-2 py-2 font-medium">ASSERTIONS</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const passed = r.assertionResults.filter((a) => a.passed).length;
            const isSelected = selectedId === r.id;
            return (
              <tr
                key={r.id}
                onClick={() => onSelect(r)}
                className={
                  "cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa] " +
                  (isSelected ? "bg-[#e6f1f9]" : "")
                }
              >
                <td className="px-3 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase"
                    style={{
                      color: r.status === "OK" ? "#1A8341" : "#D93025",
                      backgroundColor:
                        r.status === "OK" ? "#E6F4EA" : "#FCE8E6",
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-[#5f6368]">
                  <span className="font-medium">{fmtAgo(r.executedMs)}</span>
                  <span className="ml-2 text-[11px] text-[#9aa0a6]">
                    {fmtTimestamp(r.executedMs)}
                  </span>
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
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-[#dadce0] bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
        {label}
      </div>
      <div
        className="mt-0.5 text-[18px] font-semibold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#5f6368]">{sub}</div>}
    </div>
  );
}

function ResultDetailPanel({
  result,
  test,
  onClose,
}: {
  result: SyntheticResult;
  test: SyntheticTest;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"test_details" | "trace">("test_details");

  return (
    <aside className="flex w-[560px] flex-shrink-0 flex-col border-l border-[#dadce0] bg-white">
      <div className="flex items-center justify-between border-b border-[#dadce0] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{
              color: result.status === "OK" ? "#1A8341" : "#D93025",
              backgroundColor:
                result.status === "OK" ? "#E6F4EA" : "#FCE8E6",
            }}
          >
            {result.status}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-[#5f6368]">
            <span>{fmtTimestamp(result.executedMs)}</span>
          </span>
          <span className="text-[12px] text-[#5f6368]">
            ⏱ {result.responseTimeMs ?? 0} ms
          </span>
          <span className="text-[12px] text-[#5f6368]">
            📍 {locationLabel(result.location)}
          </span>
          <span className="text-[12px] text-[#5f6368]">Scheduled</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <XIcon size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-[#dadce0] px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
            URL
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#1967d2]">
              {test.method}
            </span>
            <span className="truncate font-mono text-[11px] text-[#202124]">
              {test.url}
            </span>
          </div>
          {result.errorMessage && (
            <div className="mt-1.5 rounded bg-[#fce8e6] px-1.5 py-0.5 text-[10px] font-semibold text-[#d93025]">
              {result.statusCode ?? "—"} {result.errorMessage}
            </div>
          )}
          {!result.errorMessage && result.statusCode && (
            <div className="mt-1.5 inline-block rounded bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-semibold text-[#1a8341]">
              {result.statusCode} OK
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
            RESOLVED IP ADDRESS
          </div>
          <div className="mt-1 font-mono text-[12px] text-[#202124]">
            {fakeIp(result.id)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
            DNS SERVER
          </div>
          <div className="mt-1 font-mono text-[12px] text-[#202124]">1.0.0.1</div>
        </div>
      </div>

      <div className="flex border-b border-[#dadce0]">
        {(["test_details", "trace"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "border-b-2 px-3 py-2 text-[12px] font-medium " +
              (tab === t
                ? "border-[#006CC2] text-[#202124]"
                : "border-transparent text-[#5f6368] hover:text-[#202124]")
            }
          >
            {t === "test_details" ? "Test Details" : "Trace"}
            {t === "trace" && (
              <span className="ml-1.5 rounded-full bg-[#f1f3f4] px-1.5 py-0.5 text-[10px]">
                1
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "test_details" ? (
          <TestDetailsTab result={result} />
        ) : (
          <TraceTab result={result} test={test} />
        )}
      </div>
    </aside>
  );
}

function fakeIp(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${34}.${(h >>> 16) % 256}.${(h >>> 8) % 256}.${h % 256}`;
}

function TestDetailsTab({ result }: { result: SyntheticResult }) {
  const total = result.responseTimeMs ?? 1;
  const phases: { label: string; ms: number; key: keyof SyntheticResult["timings"] }[] = [
    { label: "Total response time", ms: total, key: "ttfbMs" },
    { label: "DNS", ms: result.timings.dnsMs, key: "dnsMs" },
    { label: "Connection", ms: result.timings.connectionMs, key: "connectionMs" },
    { label: "SSL", ms: result.timings.sslMs, key: "sslMs" },
    { label: "Time to first byte", ms: result.timings.ttfbMs, key: "ttfbMs" },
    { label: "Download", ms: result.timings.downloadMs, key: "downloadMs" },
  ];
  return (
    <div>
      <div className="border-b border-[#dadce0] p-4">
        <div className="mb-2 text-[12px] font-semibold text-[#202124]">
          Timings
        </div>
        <div className="space-y-1.5">
          {phases.map((p) => {
            const pct = total > 0 ? Math.min(100, (p.ms / total) * 100) : 0;
            const isTotal = p.label === "Total response time";
            return (
              <div key={p.label} className="flex items-center gap-3">
                <div className="w-[160px] text-[12px] text-[#202124]">
                  {p.label}
                </div>
                <div className="w-[60px] text-right text-[11px] text-[#5f6368]">
                  {((p.ms / total) * 100).toFixed(1)}%
                </div>
                <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-[#f1f3f4]">
                  <div
                    className="absolute left-0 top-0 h-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isTotal ? "#1967d2" : "#34a853",
                    }}
                  />
                </div>
                <div className="w-[60px] text-right font-mono text-[11px] text-[#5f6368]">
                  {p.ms < 1000 ? `${p.ms} ms` : `${(p.ms / 1000).toFixed(1)} s`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-b border-[#dadce0] p-4">
        <div className="mb-2 text-[12px] font-semibold text-[#202124]">
          Assertions ({result.assertionResults.length})
        </div>
        {result.assertionResults.length === 0 ? (
          <div className="text-[11px] text-[#9aa0a6]">
            No assertions configured.
          </div>
        ) : (
          <div className="space-y-1">
            {result.assertionResults.map((a, i) => (
              <AssertionRow key={i} a={a} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 text-[12px] font-semibold text-[#202124]">
          Response Details
        </div>
        <div className="space-y-2">
          <ResponseDetail
            label="STATUS CODE"
            value={
              <span
                className={
                  "rounded px-1.5 py-0.5 font-mono text-[11px] " +
                  (result.statusCode && result.statusCode >= 400
                    ? "bg-[#fce8e6] text-[#d93025]"
                    : "bg-[#e6f4ea] text-[#1a8341]")
                }
              >
                {result.statusCode ?? "—"}
              </span>
            }
          />
          <ResponseDetail
            label="RESPONSE TIME"
            value={
              <span className="font-mono text-[12px]">
                ⏱ {result.responseTimeMs ?? 0} ms
              </span>
            }
          />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
              HEADERS
            </div>
            <div className="mt-1 max-h-[220px] overflow-auto rounded-md border border-[#dadce0] bg-[#f8f9fa] p-2 font-mono text-[11px] text-[#202124]">
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
        </div>
      </div>
    </div>
  );
}

function AssertionRow({ a }: { a: AssertionResult }) {
  const expectedLabel = expectedOpLabel(a);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#f1f3f4] py-1.5 text-[12px]">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-2 w-2 rounded-full " +
            (a.passed ? "bg-[#34a853]" : "bg-[#d93025]")
          }
        />
        <span className="text-[#202124]">
          {humanAssertionType(a.type)}
          {a.target ? ` - ${a.target}` : ""}
          <span className="text-[#5f6368]"> should be </span>
          <strong>{expectedLabel}</strong>
        </span>
      </div>
      <div className="text-right text-[#202124]">
        <div className="text-[10px] text-[#80868b]">Actual Value</div>
        <div
          className={
            "font-mono " +
            (a.passed ? "text-[#1a8341]" : "text-[#d93025]")
          }
        >
          {String(a.actual ?? "—")}
        </div>
      </div>
    </div>
  );
}

function humanAssertionType(t: string): string {
  if (t === "status_code") return "Status Code";
  if (t === "response_time") return "Response Time";
  if (t === "header") return "Header";
  if (t === "body") return "Body";
  if (t === "body_size") return "Body Size";
  return t;
}

function expectedOpLabel(a: AssertionResult): string {
  const exp = a.expected ?? "";
  if (a.operator === "less_than") return `less than ${exp}`;
  if (a.operator === "less_than_or_equal") return `≤ ${exp}`;
  if (a.operator === "greater_than") return `greater than ${exp}`;
  if (a.operator === "greater_than_or_equal") return `≥ ${exp}`;
  if (a.operator === "is_not") return `is not ${exp}`;
  if (a.operator === "contains") return `contains ${exp}`;
  if (a.operator === "not_contains") return `does not contain ${exp}`;
  return String(exp);
}

function ResponseDetail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[140px] text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
        {label}
      </div>
      <div className="text-[12px] text-[#202124]">{value}</div>
    </div>
  );
}

function TraceTab({
  result,
  test,
}: {
  result: SyntheticResult;
  test: SyntheticTest;
}) {
  return (
    <div className="p-4">
      <div className="mb-3 text-[12px] font-semibold text-[#202124]">
        Distributed Trace
      </div>
      <div className="rounded-md border border-[#dadce0] bg-[#f8f9fa] p-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#1967d2]">
            {test.method}
          </span>
          <span className="font-mono text-[#202124]">{test.url}</span>
        </div>
        <div className="mt-3 space-y-1">
          <TraceSpan
            label="synthetics.test"
            service="synthetics"
            ms={result.responseTimeMs ?? 0}
            pct={100}
            depth={0}
            color="#7a3edb"
          />
          <TraceSpan
            label="http.request"
            service="api"
            ms={result.timings.ttfbMs}
            pct={(result.timings.ttfbMs / (result.responseTimeMs || 1)) * 100}
            depth={1}
            color="#1967d2"
          />
          <TraceSpan
            label="postgres.query"
            service="postgres"
            ms={Math.round(result.timings.ttfbMs * 0.4)}
            pct={
              ((result.timings.ttfbMs * 0.4) / (result.responseTimeMs || 1)) *
              100
            }
            depth={2}
            color="#34a853"
          />
          <TraceSpan
            label="redis.get"
            service="redis"
            ms={Math.round(result.timings.ttfbMs * 0.05)}
            pct={
              ((result.timings.ttfbMs * 0.05) / (result.responseTimeMs || 1)) *
              100
            }
            depth={2}
            color="#d93025"
          />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[#5f6368]">
        APM traces are correlated to this synthetic run by trace ID. Click a
        span to drill down to the service in APM.
      </p>
    </div>
  );
}

function TraceSpan({
  label,
  service,
  ms,
  pct,
  depth,
  color,
}: {
  label: string;
  service: string;
  ms: number;
  pct: number;
  depth: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div
        className="w-[160px] truncate font-mono text-[#202124]"
        style={{ paddingLeft: depth * 12 }}
      >
        <span className="font-medium">{service}</span>{" "}
        <span className="text-[#5f6368]">{label}</span>
      </div>
      <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-[#f1f3f4]">
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: `${Math.max(2, pct)}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-[60px] text-right font-mono text-[#5f6368]">{ms} ms</div>
    </div>
  );
}

function ConfigPanel({ test }: { test: SyntheticTest }) {
  return (
    <div className="space-y-4">
      <ConfigBlock title="Request">
        <KV label="Test type" value={test.testType} />
        <KV label="Method" value={test.method} mono />
        <KV label="URL" value={test.url} mono />
        <KV label="Timeout" value={`${test.request.timeoutMs ?? 15000} ms`} />
        <KV
          label="Headers"
          value={
            test.request.headers.length === 0
              ? "—"
              : test.request.headers
                  .map((h) => `${h.key}: ${h.value}`)
                  .join(", ")
          }
        />
        <KV
          label="Query"
          value={
            test.request.query.length === 0
              ? "—"
              : test.request.query
                  .map((q) => `${q.key}=${q.value}`)
                  .join(", ")
          }
        />
        {test.request.body && (
          <KV label="Body" value={test.request.body} mono />
        )}
      </ConfigBlock>

      {test.testType === "browser" && test.browserConfig && (
        <ConfigBlock title="Browser Steps">
          <KV
            label="Starting URL"
            value={test.browserConfig.startingUrl || "—"}
            mono
          />
          <KV
            label="Browsers"
            value={test.browserConfig.browsers?.join(", ") || "—"}
          />
          <KV
            label="Devices"
            value={test.browserConfig.devices?.join(", ") || "—"}
          />
          {test.browserConfig.steps?.length ? (
            <ul className="space-y-1 text-[12px]">
              {test.browserConfig.steps.map((s, i) => (
                <li key={s.id}>
                  <span className="text-[#5f6368]">{i + 1}.</span>{" "}
                  <code className="rounded bg-[#f1f3f4] px-1">
                    {s.type}
                    {s.target ? `(${s.target})` : ""}
                    {s.value ? ` "${s.value}"` : ""}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[12px] text-[#9aa0a6]">No steps recorded</div>
          )}
        </ConfigBlock>
      )}

      <ConfigBlock title="Authentication">
        <KV label="Type" value={test.auth?.type ?? "none"} />
        {test.auth?.type === "basic" && (
          <KV label="Username" value={test.auth.username || "—"} />
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
        <KV
          label="Alert after"
          value={`${test.alertCondition?.failingMinutes ?? 0} min from ${
            test.alertCondition?.fromLocations ?? 1
          } locations`}
        />
        <KV
          label="Retry"
          value={
            test.retry && test.retry.count > 0
              ? `${test.retry.count}× with ${test.retry.intervalMs}ms between`
              : "Disabled"
          }
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
      <div className="w-[120px] shrink-0 text-[#5f6368]">{label}</div>
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
