"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useInfraStore } from "../store";
import type { Host } from "../types";
import { MiniChart } from "./MiniChart";

type Props = {
  host: Host;
};

const CONTAINER_METRICS = [
  { name: "container.cpu.system", base: 5, amp: 6, stroke: "#4285f4" },
  { name: "container.memory.usage", base: 130, amp: 8, stroke: "#4285f4" },
  { name: "container.cpu.limit", base: 8, amp: 0.05, stroke: "#4285f4" },
  { name: "container.memory.cache", base: 78, amp: 1, stroke: "#4285f4" },
  { name: "container.memory.kernel", base: 4.2, amp: 0.4, stroke: "#4285f4" },
  { name: "container.memory.rss", base: 48, amp: 3, stroke: "#4285f4" },
];

const APPS = ["container", "docker", "ntp", "system"];

export function MetricsTab({ host }: Props) {
  const selectedApp = useInfraStore((s) => s.selectedAppForMetrics);
  const setSelectedApp = useInfraStore((s) => s.setSelectedAppForMetrics);
  const memUsageValue = 93.86;

  return (
    <div className="px-5 py-5">
      <div className="grid grid-cols-3 gap-4">
        <TopChart title="CPU usage (%)">
          <MiniChart
            seed={`${host.id}-cpu-area`}
            base={6}
            amp={4}
            stroke="#4285f4"
            type="area"
            yMin={0}
            yMax={100}
          />
        </TopChart>
        <TopChart title="Processes memory usage">
          <TreemapBlock value={memUsageValue} />
        </TopChart>
        <TopChart title="Load Averages 1-5-15">
          <LoadAveragesChart hostId={host.id} />
        </TopChart>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <span className="text-[13px] text-[#5f6368]">Apps</span>
        <div className="flex flex-wrap gap-1.5">
          {APPS.map((app) => {
            const active = app === selectedApp;
            return (
              <button
                key={app}
                type="button"
                onClick={() => setSelectedApp(app)}
                className={`rounded-sm px-2 py-0.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-[#1a73e8] text-white"
                    : "bg-[#dde7fb] text-[#1a73e8] hover:bg-[#c2d6f9]"
                }`}
              >
                {app}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-[13px] italic text-[#5f6368]">
        Showing 31 metrics for app {selectedApp} (
        <a className="text-[#1a73e8] hover:underline" href="#">
          view {selectedApp} dashboard
        </a>
        )
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {CONTAINER_METRICS.map((m) => (
          <SmallMetricCard key={m.name} title={m.name} hostId={host.id}>
            <MiniChart
              seed={`${host.id}-${m.name}`}
              base={m.base}
              amp={m.amp}
              stroke={m.stroke}
              height={100}
            />
          </SmallMetricCard>
        ))}
      </div>
    </div>
  );
}

function TopChart({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#e8eaed] bg-white">
      <div className="flex items-center justify-between border-b border-[#e8eaed] px-2 py-1.5">
        <button
          type="button"
          className="flex items-center gap-1 text-[12px] text-[#202124] hover:text-[#1a73e8]"
        >
          <span>{title}</span>
          <CaretDown size={9} weight="bold" className="text-[#5f6368]" />
        </button>
      </div>
      <div className="p-1">{children}</div>
    </div>
  );
}

function SmallMetricCard({
  title,
  children,
}: {
  title: string;
  hostId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#e8eaed] bg-white">
      <div className="border-b border-[#e8eaed] px-2 py-1.5 text-[12px] text-[#202124]">
        {title}
      </div>
      <div className="p-1">{children}</div>
    </div>
  );
}

function TreemapBlock({ value }: { value: number }) {
  return (
    <div className="relative flex h-[120px] overflow-hidden rounded-sm">
      <div
        className="flex flex-1 items-center justify-center bg-[#4ec3e0] text-[28px] font-bold text-[#202124]"
      >
        {value.toFixed(2)}
      </div>
      <div className="flex w-3 flex-col">
        <div className="flex-[3] bg-[#dba6e6]" />
        <div className="flex-[2] bg-[#f5d23a]" />
        <div className="flex-1 bg-[#84d99e]" />
        <div className="flex-[6] bg-[#cfd2d6]" />
      </div>
    </div>
  );
}

function LoadAveragesChart({ hostId }: { hostId: string }) {
  return (
    <div className="relative h-[120px]">
      <div className="absolute inset-0">
        <MiniChart seed={`${hostId}-load-1`} base={1.5} amp={1.4} stroke="#4285f4" yMin={0} yMax={3} />
      </div>
      <div className="absolute inset-0">
        <MiniChart seed={`${hostId}-load-5`} base={1.2} amp={0.8} stroke="#5b9bd5" yMin={0} yMax={3} showYTicks={false} />
      </div>
      <div className="absolute inset-0">
        <MiniChart seed={`${hostId}-load-15`} base={1.0} amp={0.5} stroke="#f5a623" yMin={0} yMax={3} showYTicks={false} />
      </div>
    </div>
  );
}
