"use client";

import { ArrowDown, ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";
import type { Host, HostContainer } from "../types";

type Props = {
  host: Host;
};

export function ContainersTab({ host }: Props) {
  const containers = host.containers;

  return (
    <div className="px-5 py-5 text-[13px]">
      <div className="grid grid-cols-[160px_1fr] gap-y-4">
        <Field label="Docker Swarm" value={host.dockerSwarm} />
        <Field label="Docker Version" value={host.dockerVersion} />
      </div>

      <div className="my-5 border-t border-[#e8eaed]" />

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
            placeholder="Filter your Containers"
            className="flex-1 bg-transparent text-[13px] text-[#202124] placeholder:text-[#9aa0a6] focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] text-[#202124]">
          Showing <strong>1–{containers.length}</strong> of{" "}
          <strong>{containers.length}</strong> containers.{" "}
          <strong>{containers.length}</strong> matching containers in total.
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <span>Open in Live Containers</span>
          <ArrowSquareOut size={12} />
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-[#e8eaed]">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-white text-[#5f6368]">
            <tr className="border-b border-[#e8eaed]">
              <Th>Status</Th>
              <Th>Container</Th>
              <ThNumeric>Total CPU %</ThNumeric>
              <ThNumeric sortActive>RSS Memory</ThNumeric>
              <ThNumeric>Net Bytes Sent (TX)</ThNumeric>
              <ThNumeric>Net Bytes Received (RX)</ThNumeric>
              <Th>Started (Ago)</Th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <ContainerRow key={c.name} container={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </div>
      <div className="text-[13px] text-[#202124]">{value}</div>
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
      <span className="inline-flex items-center gap-1">
        {sortActive && <ArrowDown size={11} weight="bold" />}
        {children}
      </span>
    </th>
  );
}

function ContainerRow({ container }: { container: HostContainer }) {
  const cpuLabel =
    container.cpuPercent < 1 && container.cpuPercent > 0
      ? "< 1%"
      : `${container.cpuPercent.toFixed(0)}%`;
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fa]">
      <td className="px-3 py-2.5 align-middle">
        <StatusBadge status={container.status} />
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2">
          <DockerIcon />
          <span className="font-medium text-[#202124]">{container.name}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right align-middle">
        <ValueWithBar
          label={cpuLabel}
          fraction={container.cpuPercent / container.cpuMaxPercent}
        />
      </td>
      <td className="px-3 py-2.5 text-right align-middle">
        <ValueWithBar
          label={`${container.rssMib} MiB`}
          fraction={container.rssMib / container.rssMaxMib}
        />
      </td>
      <td className="px-3 py-2.5 text-right align-middle text-[#202124]">
        {formatBytes(container.txBytes)}
      </td>
      <td className="px-3 py-2.5 text-right align-middle text-[#202124]">
        {formatBytes(container.rxBytes)}
      </td>
      <td className="px-3 py-2.5 align-middle text-[#202124]">
        {container.startedAgo}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: HostContainer["status"] }) {
  const palette: Record<HostContainer["status"], string> = {
    up: "bg-[#e6f4ea] text-[#137333]",
    down: "bg-[#fce8e6] text-[#c5221f]",
    exited: "bg-[#f1f3f4] text-[#5f6368]",
  };
  return (
    <span
      className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${palette[status]}`}
    >
      {status}
    </span>
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

function formatBytes(value: number): string {
  if (value === 0) return "0 B";
  if (value < 1024) return `${value.toFixed(2)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function DockerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="10" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="5.5" y="10" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="9" y="10" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="12.5" y="10" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="5.5" y="6.5" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="9" y="6.5" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="12.5" y="6.5" width="3" height="3" rx="0.4" fill="#2496ed" />
      <rect x="9" y="3" width="3" height="3" rx="0.4" fill="#2496ed" />
      <path
        d="M22 11.5c-0.3-0.2-1-0.3-1.6-0.2-0.1-0.6-0.5-1.1-1.1-1.5l-0.3-0.2-0.2 0.3c-0.4 0.6-0.5 1.5-0.1 2.2-0.2 0.1-0.5 0.2-1 0.2H2.5c-0.2 1.5 0.4 3.5 1.7 4.6 1.3 1.2 3.2 1.8 5.7 1.8 5.4 0 9.4-2.5 11.3-7 1 0 2-0.3 2.4-0.8l0.2-0.2-0.2-0.2C23.2 11.4 22.6 11.6 22 11.5z"
        fill="#2496ed"
      />
    </svg>
  );
}
