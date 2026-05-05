"use client";

import { useState } from "react";
import { useMetricNames } from "../hooks";
import { Popover } from "./Popover";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function MetricCombobox({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useMetricNames(search);

  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[380px] max-h-[360px] overflow-hidden flex flex-col"
      trigger={
        <button
          type="button"
          className="flex h-7 items-center truncate bg-[#fef7d6] px-2 text-left text-[13px] text-[#202124] hover:bg-[#fdecc4]"
          style={{ minWidth: 200 }}
        >
          {value || <span className="text-[#5f6368]">Select metric</span>}
        </button>
      }
    >
      {({ close }) => (
        <div className="flex flex-col">
          <div className="border-b border-[#bdc1c6] p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics"
              className="w-full rounded-md border border-[#bdc1c6] px-2 py-1 text-[13px] outline-none focus:border-[#1a73e8]"
            />
          </div>
          <div className="overflow-y-auto py-1" style={{ maxHeight: 280 }}>
            {isLoading && (
              <div className="px-3 py-2 text-[12px] text-[#5f6368]">
                Loading…
              </div>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <div className="px-3 py-2 text-[12px] text-[#5f6368]">
                No metrics match.
              </div>
            )}
            {data?.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  onChange(m);
                  close();
                }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
                  m === value ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#202124]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
