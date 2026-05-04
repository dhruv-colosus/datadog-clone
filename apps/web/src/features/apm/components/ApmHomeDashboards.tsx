"use client";

import { ChartLine, Clock, Star } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type DashboardSummary = {
  id: string;
  name: string;
};

async function fetchDashboardSummaries(): Promise<DashboardSummary[]> {
  const res = await fetch(`${API_URL}/dashboards`, { credentials: "include" });
  if (!res.ok) return [];
  const list = (await res.json()) as Array<{ id: string; name: string }>;
  return list.map((d) => ({ id: d.id, name: d.name }));
}

export function ApmHomeDashboards() {
  const { data, isLoading } = useQuery({
    queryKey: ["apm", "home-dashboards"],
    queryFn: fetchDashboardSummaries,
    staleTime: 60_000,
  });
  const list = (data ?? []).slice(0, 8);

  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2.5">
        <div className="inline-flex items-center gap-2">
          <ChartLine size={14} weight="bold" className="text-[#5f6368]" />
          <span className="text-[13px] font-semibold text-[#202124]">
            Dashboards
          </span>
        </div>
        <Link
          href="/dashboard/lists"
          className="text-[12.5px] text-[#1a73e8] hover:underline"
        >
          View All →
        </Link>
      </header>
      {isLoading && (
        <div className="px-4 py-6 text-[12.5px] text-[#5f6368]">Loading…</div>
      )}
      {!isLoading && list.length === 0 && (
        <div className="px-4 py-6 text-[12.5px] text-[#5f6368]">
          No dashboards yet.{" "}
          <Link
            href="/dashboard/lists"
            className="text-[#1a73e8] hover:underline"
          >
            Create one
          </Link>
          .
        </div>
      )}
      <ul className="divide-y divide-[#f1f3f4]">
        {list.map((d) => (
          <li key={d.id}>
            <Link
              href={`/dashboard/${d.id}`}
              className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f8f9fb]"
            >
              <Star size={13} className="text-[#bdc1c6]" />
              <Clock size={13} className="text-[#5f6368]" />
              <span className="truncate hover:underline">{d.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
