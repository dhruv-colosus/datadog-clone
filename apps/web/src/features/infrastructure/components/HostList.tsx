"use client";

import { HostDetailPanel } from "./HostDetailPanel";
import { HostFilters } from "./HostFilters";
import { HostTable } from "./HostTable";
import { HostsHeader } from "./HostsHeader";
import { InfraFooter } from "./InfraFooter";

export function HostList() {
  return (
    <div
      data-testid="infrastructure-page"
      className="flex h-full w-full flex-col bg-white text-[#202124]"
    >
      <HostsHeader title="Host List" />
      <HostFilters />
      <div className="flex flex-1 overflow-hidden">
        <HostTable />
        <HostDetailPanel />
      </div>
      <InfraFooter />
    </div>
  );
}
