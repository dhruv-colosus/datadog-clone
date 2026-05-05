"use client";

import { useMemo, useState } from "react";
import { ArrowsOut, Gear, Minus, Plus } from "@phosphor-icons/react";
import { useHosts } from "../hooks";
import type { Host } from "../types";
import { HexCluster } from "./HexCluster";
import { HostMapToolbar } from "./HostMapToolbar";
import { HostsHeader } from "./HostsHeader";
import { InfraFooter } from "./InfraFooter";

const ZOOM_STEPS = [40, 56, 80, 110, 160];

type Group = {
  key: string;
  label: string;
  hosts: Host[];
};

export function HostMap() {
  const [zoomIdx, setZoomIdx] = useState(0);
  const { hosts } = useHosts();

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Host[]>();
    hosts.forEach((h) => {
      const key = h.availabilityZone ?? "no availability-zone";
      const arr = map.get(key) ?? [];
      arr.push(h);
      map.set(key, arr);
    });
    const out: Group[] = Array.from(map.entries()).map(([key, hs]) => ({
      key,
      label: key,
      hosts: hs,
    }));
    out.sort((a, b) => b.hosts.length - a.hosts.length);
    return out;
  }, [hosts]);

  const fillRange = useMemo(() => {
    if (hosts.length === 0) return { min: 0, max: 0 };
    const cpus = hosts.map((h) => h.cpuPercent);
    return {
      min: Math.min(...cpus),
      max: Math.max(...cpus),
    };
  }, [hosts]);

  const onlyOne = hosts.length === 1;

  return (
    <div className="flex h-full w-full flex-col bg-white text-[#202124]">
      <HostsHeader title="Host Map" />
      <HostMapToolbar fillRange={fillRange} />
      <div className="relative flex-1 overflow-hidden bg-[#f8f9fa]">
        {onlyOne ? (
          <SingleHostView host={hosts[0]} />
        ) : (
          <MultiClusterView groups={groups} hexSize={ZOOM_STEPS[zoomIdx]} />
        )}
        <ZoomControls
          zoomIdx={zoomIdx}
          setZoomIdx={setZoomIdx}
          maxIdx={ZOOM_STEPS.length - 1}
          disabled={onlyOne}
        />
      </div>
      <InfraFooter />
    </div>
  );
}

function SingleHostView({ host }: { host: Host }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-[14px] text-[#202124]">
        no availability-zone <span className="text-[#5f6368]">1 host</span>
      </div>
      <SingleHexHost host={host} />
    </div>
  );
}

function SingleHexHost({ host }: { host: Host }) {
  const fillColor = "#cce8c4";
  return (
    <div className="relative flex h-44 w-48 items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <polygon
          points="50,3 95,28 95,72 50,97 5,72 5,28"
          fill={fillColor}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={0.6}
        />
      </svg>
      <div className="relative z-[1] flex flex-col items-center gap-2">
        <div className="text-[12px] text-[#202124]">{host.hostname}</div>
        <div className="text-[28px] font-bold leading-none text-[#202124]">
          {Math.round(host.cpuPercent)} %
        </div>
        <div className="mt-3 inline-flex items-center justify-center rounded-full bg-[#5f6368] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          MIN
        </div>
      </div>
    </div>
  );
}

function MultiClusterView({
  groups,
  hexSize,
}: {
  groups: Group[];
  hexSize: number;
}) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
        {groups.map((g) => (
          <ClusterCell key={g.key} group={g} hexSize={hexSize} />
        ))}
      </div>
    </div>
  );
}

function ClusterCell({ group, hexSize }: { group: Group; hexSize: number }) {
  const truncated =
    group.label.length > 24 ? `${group.label.slice(0, 22)}…` : group.label;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span
          className={`font-medium text-[#202124] ${
            group.hosts.length > 200 ? "text-[18px]" : "text-[13px]"
          }`}
        >
          {truncated}
        </span>
        <span className="text-[12px] text-[#5f6368]">{group.hosts.length}</span>
      </div>
      <HexCluster hosts={group.hosts} hexSize={hexSize} />
    </div>
  );
}

function ZoomControls({
  zoomIdx,
  setZoomIdx,
  maxIdx,
  disabled,
}: {
  zoomIdx: number;
  setZoomIdx: (i: number) => void;
  maxIdx: number;
  disabled?: boolean;
}) {
  return (
    <div className="absolute right-4 top-4 flex flex-col items-center gap-2">
      <div className="flex flex-col rounded-md border border-[#e8eaed] bg-white shadow-sm">
        <ZoomButton
          onClick={() => setZoomIdx(Math.min(maxIdx, zoomIdx + 1))}
          disabled={disabled}
          aria-label="Zoom in"
        >
          <Plus size={14} />
        </ZoomButton>
        <ZoomButton
          onClick={() => setZoomIdx(Math.max(0, zoomIdx - 1))}
          disabled={disabled}
          aria-label="Zoom out"
        >
          <Minus size={14} />
        </ZoomButton>
        <ZoomButton aria-label="Fit to view">
          <ArrowsOut size={14} />
        </ZoomButton>
        <ZoomButton aria-label="Settings">
          <Gear size={14} />
        </ZoomButton>
      </div>
      <ZoomSlider zoomIdx={zoomIdx} setZoomIdx={setZoomIdx} maxIdx={maxIdx} />
    </div>
  );
}

function ZoomSlider({
  zoomIdx,
  setZoomIdx,
  maxIdx,
}: {
  zoomIdx: number;
  setZoomIdx: (i: number) => void;
  maxIdx: number;
}) {
  const fraction = 1 - zoomIdx / maxIdx;
  return (
    <div className="flex h-44 w-7 items-center justify-center rounded-md border border-[#e8eaed] bg-white shadow-sm">
      <div className="relative h-32 w-1 rounded-full bg-[#e8eaed]">
        <div
          style={{ top: `${fraction * 100}%` }}
          className="absolute -left-1.5 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#1a73e8] bg-white"
        />
        <input
          type="range"
          min={0}
          max={maxIdx}
          value={zoomIdx}
          onChange={(e) => setZoomIdx(Number(e.target.value))}
          className="absolute -left-3 top-0 h-full w-7 cursor-pointer opacity-0"
          style={{ writingMode: "vertical-lr" as React.CSSProperties["writingMode"] }}
        />
      </div>
    </div>
  );
}

function ZoomButton({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center border-b border-[#e8eaed] text-[#5f6368] last:border-b-0 hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}
