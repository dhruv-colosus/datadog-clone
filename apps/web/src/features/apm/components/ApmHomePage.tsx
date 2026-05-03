"use client";

import { CaretDown, Gear } from "@phosphor-icons/react";
import { ApmHeader } from "./ApmHeader";
import { ApmHomeDashboards } from "./ApmHomeDashboards";
import { ApmHomeRecommendations } from "./ApmHomeRecommendations";
import { ApmHomeWatchdog } from "./ApmHomeWatchdog";
import { ApmServicesTable } from "./ApmServicesTable";

export function ApmHomePage() {
  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <ApmHeader>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <Gear size={12} />
          Settings
          <CaretDown size={10} weight="bold" />
        </button>
      </ApmHeader>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-6 py-6">
          <ApmHomeRecommendations />
          <ApmServicesTable />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <ApmHomeWatchdog />
            <ApmHomeDashboards />
          </div>
        </div>
      </div>
    </div>
  );
}
