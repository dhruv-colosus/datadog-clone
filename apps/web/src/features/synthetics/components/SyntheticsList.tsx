"use client";

import {
  Browser,
  CaretDown,
  Check,
  Heartbeat,
  MagnifyingGlass,
  Pause,
  Play,
  Plus,
  Star,
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
  useSyntheticTests,
} from "../hooks";
import { statusBg, statusColor } from "../types";
import type { SyntheticTest, SyntheticTestStatus } from "../types";

const STATUS_KEYS: SyntheticTestStatus[] = ["ALERT", "OK", "NO DATA"];

function fmtAgo(ms: number | null): string {
  if (ms == null) return "Never";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function fmtFreq(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function SyntheticsList() {
  const router = useRouter();
  const { data: tests = [], isLoading } = useSyntheticTests();
  const deleteMut = useDeleteSyntheticTest();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<SyntheticTestStatus>>(
    new Set(),
  );

  const counts = useMemo(() => {
    const c: Record<SyntheticTestStatus, number> & { total: number } = {
      OK: 0,
      ALERT: 0,
      "NO DATA": 0,
      total: tests.length,
    };
    for (const t of tests) c[t.lastStatus] = (c[t.lastStatus] ?? 0) + 1;
    return c;
  }, [tests]);

  const filtered = useMemo(() => {
    let list = tests;
    if (statusFilter.size > 0) {
      list = list.filter((t) => statusFilter.has(t.lastStatus));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.url.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [tests, statusFilter, search]);

  const toggleStatus = (s: SyntheticTestStatus) =>
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <div
      data-testid="synthetics-tests-page"
      className="flex h-full w-full flex-col bg-white text-[#202124]"
    >
      <Header />

      <div className="border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa0a6]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, URL, or tag"
              className="w-full rounded-md border border-[#bdc1c6] bg-white py-1.5 pl-8 pr-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-b border-[#dadce0] bg-white px-6 py-4">
        {STATUS_KEYS.map((k) => (
          <StatusCard
            key={k}
            label={k}
            value={counts[k]}
            color={statusColor(k)}
            bg={statusBg(k)}
            active={statusFilter.has(k)}
            onClick={() => toggleStatus(k)}
          />
        ))}
        <StatusCard
          label="TOTAL"
          value={counts.total}
          color="#202124"
          bg="#f1f3f4"
          active={false}
          onClick={() => undefined}
        />
      </div>

      <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-2">
        <span className="text-[13px] text-[#5f6368]">
          Showing <strong>{filtered.length}</strong> of{" "}
          <strong>{tests.length}</strong>
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
            Loading synthetic tests…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAny={tests.length > 0}
            onCreate={() => router.push("/synthetics/tests/new")}
          />
        ) : (
          <TestsTable
            tests={filtered}
            onOpen={(t) => router.push(`/synthetics/tests/${t.id}`)}
            onDelete={(t) => {
              if (window.confirm(`Delete synthetic test "${t.name}"?`)) {
                deleteMut.mutate(t.id);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[#dadce0] bg-white px-6">
      <div className="flex items-center gap-3">
        <SyntheticsIcon />
        <h1 className="text-[15px] font-medium text-[#202124]">
          Synthetic Tests
        </h1>
        <div className="ml-2 flex items-center gap-1">
          <span className="border-b-2 border-[#006CC2] px-3 py-3 text-[13px] font-medium text-[#202124]">
            Tests
          </span>
          <Link
            href="/synthetics/events"
            className="border-b-2 border-transparent px-3 py-3 text-[13px] font-medium text-[#5f6368] hover:text-[#202124]"
          >
            Events
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          Learn More <CaretDown size={12} />
        </button>
        <Link href="/synthetics/tests/new">
          <Button variant="primary" size="sm" className="gap-1">
            <Plus size={14} />
            New Test
          </Button>
        </Link>
      </div>
    </header>
  );
}

function SyntheticsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="#632ca6" strokeWidth="2" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#632ca6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusCard({
  label,
  value,
  color,
  bg,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-4 py-3 text-left transition-colors " +
        (active
          ? "border-[#006CC2] ring-1 ring-[#006CC2]"
          : "border-[#dadce0] hover:border-[#bdc1c6]")
      }
      style={{ backgroundColor: bg }}
    >
      <div className="text-[10px] font-semibold tracking-wider" style={{ color }}>
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold" style={{ color }}>
        {value}
      </div>
    </button>
  );
}

function EmptyState({
  hasAny,
  onCreate,
}: {
  hasAny: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12">
      <div className="text-[14px] font-medium text-[#202124]">
        {hasAny ? "No tests match your filters" : "No synthetic tests yet"}
      </div>
      <p className="max-w-[460px] text-center text-[13px] text-[#5f6368]">
        Synthetic tests proactively probe your endpoints from multiple
        locations and run on a configurable schedule. Quickly detect
        user-facing issues before your customers do.
      </p>
      <Button variant="primary" size="sm" className="mt-1 gap-1" onClick={onCreate}>
        <Plus size={14} />
        New API Test
      </Button>
    </div>
  );
}

function TestsTable({
  tests,
  onOpen,
  onDelete,
}: {
  tests: SyntheticTest[];
  onOpen: (t: SyntheticTest) => void;
  onDelete: (t: SyntheticTest) => void;
}) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="sticky top-0 z-10 bg-[#f8f9fa] text-left text-[12px] font-medium text-[#5f6368]">
        <tr>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-2 py-2 font-medium">Type</th>
          <th className="px-2 py-2 font-medium">Name</th>
          <th className="px-2 py-2 font-medium">Method</th>
          <th className="px-2 py-2 font-medium">URL</th>
          <th className="px-2 py-2 font-medium">Locations</th>
          <th className="px-2 py-2 font-medium">Frequency</th>
          <th className="px-2 py-2 font-medium">Last Run</th>
          <th className="px-2 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {tests.map((t) => (
          <TestRow
            key={t.id}
            test={t}
            onOpen={() => onOpen(t)}
            onDelete={() => onDelete(t)}
          />
        ))}
      </tbody>
    </table>
  );
}

function TestRow({
  test,
  onOpen,
  onDelete,
}: {
  test: SyntheticTest;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const patchMut = usePatchSyntheticTest(test.id);
  const runMut = useRunSyntheticTest();

  return (
    <tr
      className="cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa]"
      onClick={onOpen}
    >
      <td className="px-4 py-2">
        <StatusPill status={test.lastStatus} />
      </td>
      <td className="px-2 py-2">
        {test.testType === "browser" ? (
          <span className="inline-flex items-center gap-1 rounded bg-[#f3e8fd] px-1.5 py-0.5 text-[11px] font-medium text-[#632ca6]">
            <Browser size={12} />
            Browser
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-[#f3e8fd] px-1.5 py-0.5 text-[11px] font-medium text-[#632ca6]">
            <Heartbeat size={12} />
            API
          </span>
        )}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              patchMut.mutate({ favorite: !test.favorite });
            }}
            className="text-[#9aa0a6] hover:text-[#f9ab00]"
            aria-label="Star"
          >
            <Star
              size={14}
              weight={test.favorite ? "fill" : "regular"}
              color={test.favorite ? "#f9ab00" : undefined}
            />
          </button>
          <span className="font-medium text-[#202124]">{test.name}</span>
          {!test.enabled && (
            <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]">
              Paused
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        {test.testType === "browser" ? (
          <span className="text-[12px] text-[#5f6368]">—</span>
        ) : (
          <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#1967d2]">
            {test.method}
          </span>
        )}
      </td>
      <td className="max-w-[360px] truncate px-2 py-2 font-mono text-[12px] text-[#5f6368]">
        {test.url}
      </td>
      <td className="px-2 py-2 text-[#5f6368]">{test.locations.length}</td>
      <td className="px-2 py-2 text-[#5f6368]">{fmtFreq(test.frequencySeconds)}</td>
      <td className="px-2 py-2 text-[#5f6368]">{fmtAgo(test.lastRunMs)}</td>
      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => runMut.mutate(test.id)}
            disabled={runMut.isPending}
            title="Run now"
            className="rounded p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124] disabled:opacity-50"
          >
            <Play size={14} />
          </button>
          <button
            type="button"
            onClick={() => patchMut.mutate({ enabled: !test.enabled })}
            title={test.enabled ? "Pause" : "Resume"}
            className="rounded p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
          >
            {test.enabled ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="rounded p-1.5 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#d93025]"
          >
            <Trash size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: SyntheticTestStatus }) {
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
