"use client";

import { ArrowSquareOut, CaretDown, SpeakerSimpleX, X } from "@phosphor-icons/react";
import { getHost } from "../mock-data";
import { useInfraStore } from "../store";
import type { HostInfoTabId } from "../types";
import { ContainersTab } from "./ContainersTab";
import { HostInfoTab } from "./HostInfoTab";
import { AgentIcon, OsIcon } from "./HostStatusIcons";
import { MetricsTab } from "./MetricsTab";

const TABS: { id: HostInfoTabId; label: string }[] = [
  { id: "host-info", label: "Host Info" },
  { id: "metrics", label: "Metrics" },
  { id: "containers", label: "Containers" },
  { id: "processes", label: "Processes" },
  { id: "network", label: "Network" },
  { id: "logs", label: "Logs" },
  { id: "traces", label: "Traces" },
  { id: "profiles", label: "Profiles" },
  { id: "security", label: "Security" },
];

export function HostDetailPanel() {
  const selectedHostId = useInfraStore((s) => s.selectedHostId);
  const selectHost = useInfraStore((s) => s.selectHost);
  const activeTab = useInfraStore((s) => s.activeTab);
  const setActiveTab = useInfraStore((s) => s.setActiveTab);

  if (!selectedHostId) return null;
  const host = getHost(selectedHostId);
  if (!host) return null;

  return (
    <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-[760px] flex-col border-l border-[#bdc1c6] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)]">
      <header className="border-b border-[#e8eaed] bg-white">
        <div className="flex items-start justify-between px-5 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-[#202124]">
                {host.hostname}
              </h2>
              <button
                type="button"
                className="text-[#5f6368] hover:text-[#202124]"
                aria-label="Open host"
              >
                <ArrowSquareOut size={14} />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-[#137333]">
                {host.status.toUpperCase()}
              </span>
              <span className="text-[#bdc1c6]">|</span>
              <span className="inline-flex items-center gap-1 text-[#202124]">
                <OsIcon os={host.os} />
                <span>Linux</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[#202124]">
                <AgentIcon />
                <span>v{host.agentVersion}</span>
              </span>
            </div>
            <div className="mt-1 text-[13px] text-[#5f6368]">Aliases</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <span>Open Host</span>
              <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
            </button>
            <button
              type="button"
              className="text-[#5f6368] hover:text-[#202124]"
              aria-label="Mute"
            >
              <SpeakerSimpleX size={16} />
            </button>
            <button
              type="button"
              onClick={() => selectHost(null)}
              className="text-[#5f6368] hover:text-[#202124]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <nav className="mt-3 flex items-stretch gap-0 border-b border-[#e8eaed] px-3 text-[14px]">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 pb-2 pt-1 transition-colors ${
                  active
                    ? "font-semibold text-[#1a73e8]"
                    : "text-[#5f6368] hover:text-[#202124]"
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute -bottom-px left-2 right-2 h-[2px] bg-[#1a73e8]" />
                )}
              </button>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 overflow-auto">
        {activeTab === "host-info" && <HostInfoTab host={host} />}
        {activeTab === "metrics" && <MetricsTab host={host} />}
        {activeTab === "containers" && <ContainersTab host={host} />}
        {activeTab !== "host-info" &&
          activeTab !== "metrics" &&
          activeTab !== "containers" && (
            <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
              {TABS.find((t) => t.id === activeTab)?.label} view coming soon.
            </div>
          )}
      </div>
    </aside>
  );
}
