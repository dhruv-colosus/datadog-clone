"use client";

import { ArrowDown, ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { fetchHostProcesses, type HostProcessDto } from "../api";
import type { Host } from "../types";

type Props = {
  host: Host;
};

export function ProcessesTab({ host }: Props) {
  const [processes, setProcesses] = useState<HostProcessDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProcesses(null);
    setError(null);
    fetchHostProcesses(host.id)
      .then((rows) => {
        if (!cancelled) setProcesses(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [host.id]);

  const filtered = useMemo(() => {
    if (!processes) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return processes;
    return processes.filter(
      (p) =>
        p.command.toLowerCase().includes(q) || String(p.pid).includes(q),
    );
  }, [processes, filter]);

  const maxRss = useMemo(
    () => (processes ?? []).reduce((m, p) => Math.max(m, p.rssMib), 1),
    [processes],
  );
  const maxCpu = useMemo(
    () => (processes ?? []).reduce((m, p) => Math.max(m, p.cpuPercent), 1),
    [processes],
  );

  return (
    <div className="px-5 py-5 text-[13px]">
      <div className="mb-3 flex items-stretch overflow-hidden rounded-md border border-[#bdc1c6] bg-white">
        <div className="flex items-center bg-[#f1f3f4] px-3 text-[#5f6368]">
          Filter by
        </div>
        <div className="flex items-center bg-[#e8eaed] px-2.5 text-[#202124]">
          host:{host.hostname}
        </div>
        <div className="flex flex-1 items-center gap-2 bg-white px-3">
          <MagnifyingGlass size={14} className="text-[#5f6368]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter your Processes"
            className="flex-1 bg-transparent text-[13px] text-[#202124] placeholder:text-[#9aa0a6] focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] text-[#202124]">
          {processes === null && !error ? (
            <span className="text-[#5f6368]">Loading processes…</span>
          ) : error ? (
            <span className="text-[#c5221f]">Failed to load: {error}</span>
          ) : (
            <>
              Showing <strong>1–{filtered.length}</strong> of{" "}
              <strong>{processes?.length ?? 0}</strong> processes.{" "}
              <strong>{filtered.length}</strong> matching processes in total.
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <span>Open in Live Processes</span>
          <ArrowSquareOut size={12} />
        </button>
      </div>

      {processes && processes.length > 0 && (
        <div className="overflow-hidden rounded-md border border-[#e8eaed]">
          <table className="w-full table-fixed border-collapse text-[13px]">
            <colgroup>
              <col />
              <col className="w-[80px]" />
              <col className="w-[140px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead className="bg-white text-[#5f6368]">
              <tr className="border-b border-[#e8eaed]">
                <Th>Process</Th>
                <ThNumeric>PID</ThNumeric>
                <ThNumeric>Total CPU %</ThNumeric>
                <ThNumeric sortActive>RSS Memory</ThNumeric>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProcessRow
                  key={p.pid}
                  process={p}
                  maxRss={maxRss}
                  maxCpu={maxCpu}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
      {children}
    </th>
  );
}

function ThNumeric({
  children,
  sortActive,
}: {
  children: React.ReactNode;
  sortActive?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide ${
        sortActive ? "text-[#202124]" : "text-[#5f6368]"
      }`}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {sortActive && <ArrowDown size={11} weight="bold" />}
        {children}
      </span>
    </th>
  );
}

function ProcessRow({
  process,
  maxRss,
  maxCpu,
}: {
  process: HostProcessDto;
  maxRss: number;
  maxCpu: number;
}) {
  const cpuLabel =
    process.cpuPercent === 0
      ? "0%"
      : process.cpuPercent < 1
        ? "< 1%"
        : `${process.cpuPercent.toFixed(0)}%`;

  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fa]">
      <td className="px-3 py-2.5 align-middle">
        <CommandText command={process.command} />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle text-[#202124] tabular-nums">
        {process.pid}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
        <ValueWithBar
          label={cpuLabel}
          fraction={process.cpuPercent / Math.max(maxCpu, 1)}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
        <ValueWithBar
          label={`${process.rssMib} MiB`}
          fraction={process.rssMib / Math.max(maxRss, 1)}
        />
      </td>
    </tr>
  );
}

function CommandText({ command }: { command: string }) {
  const parts = command.split(/(\s+)/);
  return (
    <div className="truncate" title={command}>
      {parts.map((part, idx) => {
        if (/^\s+$/.test(part)) return <span key={idx}>{part}</span>;
        const isFlag = /^-/.test(part);
        const isPath = /^\//.test(part);
        const colorClass =
          isFlag || isPath ? "text-[#188038]" : "text-[#202124]";
        return (
          <span key={idx} className={colorClass}>
            {part}
          </span>
        );
      })}
    </div>
  );
}

function ValueWithBar({
  label,
  fraction,
}: {
  label: string;
  fraction: number;
}) {
  const pct = Math.max(0.04, Math.min(1, fraction)) * 100;
  return (
    <div className="inline-flex items-center justify-end gap-2 text-[#202124]">
      <span className="tabular-nums">{label}</span>
      <span className="block h-2 w-14 overflow-hidden rounded-sm bg-[#e8eaed]">
        <span
          className="block h-full bg-[#c2d6f9]"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}
