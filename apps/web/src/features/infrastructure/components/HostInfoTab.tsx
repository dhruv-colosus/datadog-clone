"use client";

import { useState } from "react";
import {
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  PencilSimple,
} from "@phosphor-icons/react";
import type { Host } from "../types";

type Props = {
  host: Host;
};

export function HostInfoTab({ host }: Props) {
  return (
    <div className="space-y-6 px-5 py-5 text-[13px]">
      <TopGrid host={host} />
      <Divider />
      <TagsBlock host={host} />
      <Divider />
      <AppsBlock host={host} />
      <Divider />
      <SystemInformation host={host} />
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#e8eaed]" />;
}

function TopGrid({ host }: { host: Host }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div>
        <SectionTitle>System</SectionTitle>
        <KvRow k="CPU cores" v={host.cpuCores} />
        <KvRow k="Logical cores" v={host.logicalCores} />
        <KvRow k="IP Address" v={host.ipAddress} />
        <KvRow k="Memory" v={`${host.memoryGB.toFixed(2)}G`} />
        <KvRow k="Filesystem" v={`${host.filesystemGB.toFixed(2)}G`} />
      </div>
      <div>
        <SectionTitle>Container Info</SectionTitle>
        <KvRow k="Docker Swarm" v={host.dockerSwarm} />
        <KvRow k="Docker Version" v={host.dockerVersion} />
      </div>
      <div>
        <SectionTitle>Service</SectionTitle>
        <div className="text-[13px] text-[#5f6368]">{host.service ?? "—"}</div>
      </div>
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 py-0.5">
      <span className="text-[#5f6368]">{k}:</span>
      <span className="font-semibold text-[#202124]">{v}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
      {children}
    </div>
  );
}

function TagsBlock({ host }: { host: Host }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <SectionTitle>Tags</SectionTitle>
        <div className="ml-2 flex flex-1 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2 py-1">
          <MagnifyingGlass size={14} className="text-[#5f6368]" />
          <input
            type="text"
            placeholder="Search Tags"
            className="flex-1 bg-transparent text-[13px] text-[#202124] placeholder:text-[#9aa0a6] focus:outline-none"
          />
        </div>
      </div>
      <div className="mb-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
          Datadog
        </div>
        <div className="flex flex-wrap gap-1.5">
          {host.tags.map((t) => (
            <TagChip key={`${t.key}:${t.value}`} k={t.key} v={t.value} />
          ))}
        </div>
      </div>
      <div className="mb-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
          User
        </div>
        <div className="text-[13px] text-[#9aa0a6]">—</div>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        <PencilSimple size={12} />
        <span>Add Tags</span>
      </button>
    </div>
  );
}

function TagChip({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-[#e8f0fe] px-1.5 py-0.5 text-[12px]">
      <span className="text-[#5f6368]">{k}:</span>
      <span className="font-medium text-[#1a73e8]">{v}</span>
    </span>
  );
}

function AppsBlock({ host }: { host: Host }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        Apps
      </span>
      <div className="flex flex-wrap gap-1.5">
        {host.apps.map((app) => (
          <span
            key={app}
            className="rounded-sm bg-[#dde7fb] px-1.5 py-0.5 text-[12px] font-medium text-[#1a73e8]"
          >
            {app}
          </span>
        ))}
      </div>
    </div>
  );
}

function SystemInformation({ host }: { host: Host }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        System Information
      </div>
      <CollapsibleSection title="Platform" defaultOpen>
        <KvTable
          rows={[
            ["Hostname", chip(host.hostname)],
            ["OS", chip("GNU/Linux")],
            ["Kernel Name", chip(host.kernelName)],
            ["Processor", chip(host.processor)],
            ["Kernel Release", chip(host.kernelRelease)],
            ["Kernel Version", chip(host.kernelVersion)],
            ["Machine", chip(host.machine)],
            ["Hardware Platform", chip(host.hardwarePlatform)],
          ]}
        />
      </CollapsibleSection>
      <CollapsibleSection title="CPU" defaultOpen>
        <KvTable
          rows={[
            ["Vendor ID", chip(host.cpuVendor)],
            ["Model Name", chip(host.cpuModelName)],
            ["CPU Cores", chip(String(host.cpuCores))],
            ["CPU Logical Processors", chip(String(host.logicalCores))],
            ["MHz", chip(host.cpuMhz.toFixed(3))],
            ["Cache Size", chip(`${host.cpuCacheKb} KB`)],
            ["Family", chip(String(host.cpuFamily))],
            ["Model", chip(String(host.cpuModel))],
            ["Stepping", chip(String(host.cpuStepping))],
          ]}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Network" defaultOpen>
        <KvTable
          rows={[
            ["IP Address", chip(host.ipAddress)],
            ["IPv6 Address", chip(host.ipv6Address)],
            ["MAC Address", chip(host.macAddress)],
          ]}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Memory" defaultOpen>
        <KvTable
          rows={[
            ["Total", chip(`${host.memoryGB.toFixed(2)}G`)],
            ["Swap Total", chip(host.swapTotalGB.toFixed(2))],
          ]}
        />
      </CollapsibleSection>
      <CollapsibleSection title="Filesystem" defaultOpen>
        <ul className="space-y-1">
          {host.filesystemMounts.map((m) => (
            <li
              key={`${m.fs}-${m.mount}`}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="text-[#202124]">{m.fs}</span>
              <span className="text-[#5f6368]">mounted on</span>
              <span className="rounded-sm bg-[#e8f0fe] px-1.5 py-0.5 text-[12px] text-[#1a73e8]">
                {m.mount}
              </span>
              <span className="text-[#202124]">{m.size}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  );
}

function chip(text: string) {
  return (
    <span className="rounded-sm bg-[#e8f0fe] px-1.5 py-0.5 text-[12px] text-[#1a73e8]">
      {text}
    </span>
  );
}

function KvTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-y-1.5">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <div className="text-[#5f6368]">{k}</div>
          <div>{v}</div>
        </div>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-[#202124]"
      >
        {open ? (
          <CaretDown size={11} weight="bold" />
        ) : (
          <CaretRight size={11} weight="bold" />
        )}
        <span>{title}</span>
      </button>
      {open && <div className="pl-4">{children}</div>}
    </div>
  );
}
