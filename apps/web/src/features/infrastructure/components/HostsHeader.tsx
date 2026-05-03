"use client";

import { HOSTS, LIST_HOSTS } from "../mock-data";
import { HexLogo } from "./HexLogo";
import { TimeRangePicker } from "./TimeRangePicker";

type Props = {
  title: string;
  rightSlot?: React.ReactNode;
};

export function HostsHeader({ title, rightSlot }: Props) {
  const dataset = title === "Host List" ? LIST_HOSTS : HOSTS;
  const total = dataset.length;
  const up = dataset.filter((h) => h.status !== "down").length;

  return (
    <header className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-3">
      <HexLogo size={28} />
      <h1 className="text-[18px] font-medium text-[#202124]">{title}</h1>
      {title === "Host List" && (
        <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
          <span className="flex items-center gap-1.5">
            <span className="rounded-sm bg-[#e6f4ea] px-1.5 py-0.5 text-[12px] font-semibold text-[#137333]">
              {up}
            </span>
            <span>hosts up of</span>
            <span className="rounded-sm bg-[#f1f3f4] px-1.5 py-0.5 text-[12px] font-semibold text-[#202124]">
              {total}
            </span>
            <span>total hosts</span>
          </span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
        <TimeRangePicker />
      </div>
    </header>
  );
}
