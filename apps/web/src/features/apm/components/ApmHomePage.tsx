"use client";

import { CaretDown, Gear } from "@phosphor-icons/react";
import { Popover } from "@/features/metrics/components/Popover";
import { useApmHomeStore } from "../store";
import { ApmHeader } from "./ApmHeader";
import { ApmHomeDashboards } from "./ApmHomeDashboards";
import { ApmHomeIssues } from "./ApmHomeIssues";
import { ApmHomeRecommendations } from "./ApmHomeRecommendations";
import { ApmHomeWatchdog } from "./ApmHomeWatchdog";
import { ApmServicesTable } from "./ApmServicesTable";

const TYPE_OPTIONS: Array<{
  value: "all" | "performance" | "reliability" | "cost";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "performance", label: "Performance" },
  { value: "reliability", label: "Reliability" },
  { value: "cost", label: "Cost" },
];

const ENV_OPTIONS = ["prod", "staging", "dev"];

export function ApmHomePage() {
  const recType = useApmHomeStore((s) => s.recommendationType);
  const setRecType = useApmHomeStore((s) => s.setRecommendationType);
  const env = useApmHomeStore((s) => s.envFilter);
  const setEnv = useApmHomeStore((s) => s.setEnvFilter);

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
          <div className="flex items-center justify-end gap-3">
            <FloatingSelect
              label="Type"
              value={
                TYPE_OPTIONS.find((o) => o.value === recType)?.label ?? "All"
              }
            >
              {({ close }) => (
                <ul>
                  {TYPE_OPTIONS.map((o) => (
                    <li key={o.value}>
                      <button
                        type="button"
                        onClick={() => {
                          setRecType(o.value);
                          close();
                        }}
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] ${
                          o.value === recType
                            ? "bg-[#1a73e8] text-white"
                            : "text-[#202124] hover:bg-[#f1f3f4]"
                        }`}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FloatingSelect>
            <FloatingSelect label="Env" value={env}>
              {({ close }) => (
                <ul>
                  {ENV_OPTIONS.map((opt) => (
                    <li key={opt}>
                      <button
                        type="button"
                        onClick={() => {
                          setEnv(opt);
                          close();
                        }}
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] ${
                          opt === env
                            ? "bg-[#1a73e8] text-white"
                            : "text-[#202124] hover:bg-[#f1f3f4]"
                        }`}
                      >
                        {opt}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FloatingSelect>
          </div>

          <ApmHomeRecommendations />
          <ApmServicesTable />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <ApmHomeWatchdog />
            <ApmHomeDashboards />
          </div>

          <ApmHomeIssues />
        </div>
      </div>
    </div>
  );
}

function FloatingSelect({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: (api: { close: () => void }) => React.ReactNode;
}) {
  return (
    <Popover
      placement="bottom-end"
      panelClassName="w-[180px] py-1"
      trigger={
        <button
          type="button"
          className="relative inline-flex h-9 min-w-[140px] items-center justify-between rounded-md border border-[#bdc1c6] bg-white px-3 text-[13px] text-[#202124] hover:border-[#1a73e8]"
        >
          <span className="absolute left-2 top-0 -translate-y-1/2 bg-white px-1 text-[10px] font-medium text-[#5f6368]">
            {label}
          </span>
          <span>{value}</span>
          <CaretDown size={11} weight="bold" className="ml-2 text-[#5f6368]" />
        </button>
      }
    >
      {children}
    </Popover>
  );
}
