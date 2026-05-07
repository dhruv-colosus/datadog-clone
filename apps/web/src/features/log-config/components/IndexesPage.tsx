"use client";

import { Database } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type LogStats = {
  total_count: number;
  by_status: { status: string; count: number }[];
  by_service: { service: string; count: number }[];
  rate_per_minute: number;
};

async function fetchLogStats(): Promise<LogStats> {
  const res = await fetch(`${API_URL}/logs/stats?hours=24`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("failed to load log stats");
  return res.json();
}

export function IndexesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["log-stats", "24h"],
    queryFn: fetchLogStats,
  });

  const total = data?.total_count ?? 0;
  const ratePerMin = data?.rate_per_minute ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[#e6e7ea] bg-white px-7 py-4">
        <h1 className="text-[20px] font-semibold text-[#202124]">Indexes</h1>
      </div>
      <div className="px-7 py-6">
        <div className="rounded-lg border border-[#e6e7ea] bg-white">
          <div className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-2 border-b border-[#e6e7ea] bg-[#fafbfc] px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#5f6368]">
            <div />
            <div>Index Name</div>
            <div>Volume (24h)</div>
            <div>Rate / min</div>
            <div>Retention</div>
            <div>Filter</div>
          </div>

          <div className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-2 px-5 py-3">
            <Database size={16} weight="duotone" className="text-[#774aa4]" />
            <div className="text-[13px] font-medium text-[#202124]">main</div>
            <div className="text-[13px] text-[#202124]">
              {isLoading ? "—" : total.toLocaleString()}
            </div>
            <div className="text-[13px] text-[#202124]">
              {isLoading ? "—" : ratePerMin.toFixed(1)}
            </div>
            <div className="text-[13px] text-[#202124]">15 days</div>
            <div className="font-mono text-[12px] text-[#5f6368]">*</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[#e6e7ea] bg-white p-4">
            <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
              By status (24h)
            </h3>
            {isLoading && (
              <div className="text-[13px] text-[#5f6368]">Loading…</div>
            )}
            {!isLoading && (
              <ul className="space-y-1.5">
                {(data?.by_status ?? []).map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-[13px]">
                    <span className="capitalize text-[#202124]">{s.status}</span>
                    <span className="font-mono text-[#5f6368]">
                      {s.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-[#e6e7ea] bg-white p-4">
            <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
              Top services (24h)
            </h3>
            {isLoading && (
              <div className="text-[13px] text-[#5f6368]">Loading…</div>
            )}
            {!isLoading && (
              <ul className="space-y-1.5">
                {(data?.by_service ?? []).slice(0, 8).map((s) => (
                  <li key={s.service} className="flex items-center justify-between text-[13px]">
                    <span className="text-[#202124]">{s.service}</span>
                    <span className="font-mono text-[#5f6368]">
                      {s.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
