"use client";

import { useMemo } from "react";
import {
  ArrowDown,
  CaretDown,
  Export,
  Gear,
  Keyboard,
} from "@phosphor-icons/react";
import { useHosts } from "../hooks";
import { useInfraStore } from "../store";
import type { Host, HostApp } from "../types";
import { AgentIcon, OsIcon } from "./HostStatusIcons";
import { Sparkbars } from "./Sparkbars";

const APP_COLORS: Record<HostApp, string> = {
  container: "bg-[#dde7fb] text-[#1a73e8]",
  docker: "bg-[#dde7fb] text-[#1a73e8]",
  ntp: "bg-[#dde7fb] text-[#1a73e8]",
  system: "bg-[#dde7fb] text-[#1a73e8]",
  agent: "bg-[#ede1fa] text-[#1a73e8]",
  kubernetes: "bg-[#dde7fb] text-[#1a73e8]",
  redis: "bg-[#fde2e2] text-[#a50e0e]",
  postgres: "bg-[#dde7fb] text-[#1a73e8]",
  nginx: "bg-[#dcf3e9] text-[#137333]",
};

export function HostTable() {
  const selectHost = useInfraStore((s) => s.selectHost);
  const selectedId = useInfraStore((s) => s.selectedHostId);
  const searchQuery = useInfraStore((s) => s.searchQuery);
  const { hosts, isLoading, isError } = useHosts();

  const filtered = useMemo(
    () => filterHosts(hosts, searchQuery),
    [hosts, searchQuery],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2 text-[13px]">
        <div className="text-[#202124]">
          Showing <strong>1–{filtered.length}</strong> of{" "}
          <strong>{filtered.length}</strong> host
          {filtered.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[#1a73e8] bg-white px-2.5 py-1 text-[13px] text-[#1a73e8] hover:bg-[#e8f0fe]"
          >
            <span className="text-[14px]">⌕</span>
            <span>Explore Hosts</span>
            <CaretDown size={10} weight="bold" />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard size={14} />
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Export"
          >
            <Export size={14} />
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Gear size={14} />
            <span>Options</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-[1] bg-white text-[#5f6368]">
            <tr className="border-b border-[#e8eaed]">
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                Hostname
              </th>
              <th className="w-16" />
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                Status
              </th>
              <SortableTh label="CPU" active />
              <SortableTh label="IOWait" />
              <SortableTh label="Load 15" />
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                Apps
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((host) => (
              <HostRow
                key={host.id}
                host={host}
                selected={host.id === selectedId}
                onClick={() => selectHost(host.id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-[13px] text-[#5f6368]"
                >
                  {isLoading
                    ? "Loading hosts…"
                    : isError
                      ? "Failed to load hosts."
                      : "No hosts match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#e8eaed] bg-white px-4 py-2 text-[13px] text-[#5f6368]">
        <span>Results per page:</span>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[#202124] hover:bg-[#f1f3f4]"
        >
          50
          <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        </button>
      </div>
    </div>
  );
}

function SortableTh({ label, active }: { label: string; active?: boolean }) {
  return (
    <th
      className={`px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide ${
        active ? "text-[#202124]" : "text-[#5f6368]"
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {active && <ArrowDown size={11} weight="bold" />}
        {label}
      </span>
    </th>
  );
}

function HostRow({
  host,
  selected,
  onClick,
}: {
  host: Host;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-[#f1f3f4] transition-colors ${
        selected ? "bg-[#e8f0fe]" : "hover:bg-[#f8f9fa]"
      }`}
    >
      <td className="px-4 py-2 align-middle font-medium text-[#202124]">
        {host.hostname}
      </td>
      <td className="px-2 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <OsIcon os={host.os} />
          <AgentIcon />
        </div>
      </td>
      <td className="px-2 py-2 align-middle">
        <StatusBadge status={host.status} />
      </td>
      <td className="px-2 py-2 align-middle">
        <MetricCell value={`${host.cpuPercent.toFixed(2)}%`} sparks={host.cpuSparkline} />
      </td>
      <td className="px-2 py-2 align-middle">
        <MetricCell
          value={
            host.iowaitPercent < 0.1
              ? "< 0.1%"
              : `${host.iowaitPercent.toFixed(2)}%`
          }
          sparks={host.iowaitSparkline}
        />
      </td>
      <td className="px-2 py-2 align-middle text-[#202124]">
        {host.load15.toFixed(2)}
      </td>
      <td className="px-4 py-2 align-middle">
        <div className="flex flex-wrap items-center gap-1">
          {host.apps.map((app) => (
            <span
              key={app}
              className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${APP_COLORS[app]}`}
            >
              {app}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: Host["status"] }) {
  const palette: Record<Host["status"], string> = {
    active: "text-[#137333]",
    warning: "text-[#b06000]",
    down: "text-[#c5221f]",
  };
  const label = status.toUpperCase();
  return (
    <span className={`text-[12px] font-semibold ${palette[status]}`}>
      {label}
    </span>
  );
}

function MetricCell({ value, sparks }: { value: string; sparks: number[] }) {
  return (
    <div className="flex items-center gap-2 text-[#202124]">
      <span className="font-medium tabular-nums">{value}</span>
      <Sparkbars values={sparks} />
    </div>
  );
}

function filterHosts(hosts: Host[], rawQuery: string): Host[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return hosts;
  return hosts.filter((host) => hostMatches(host, q));
}

function hostMatches(host: Host, q: string): boolean {
  if (host.hostname.toLowerCase().includes(q)) return true;
  if (host.status.toLowerCase().includes(q)) return true;
  if (host.apps.some((a) => a.toLowerCase().includes(q))) return true;
  if (
    host.tags.some(
      (t) =>
        `${t.key}:${t.value}`.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q),
    )
  ) {
    return true;
  }
  return false;
}
