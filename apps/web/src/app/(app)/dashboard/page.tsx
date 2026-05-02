"use client";

import { ChartLine } from "@phosphor-icons/react";

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <div className="border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center gap-2">
          <ChartLine size={20} />
          <h1 className="text-[18px] font-medium">Dashboards</h1>
        </div>
      </div>
      <div className="flex-1 px-6 py-6 text-[14px] text-[#5f6368]">
        Dashboard content will live here. Sidebar scaffold is complete.
      </div>
    </div>
  );
}
