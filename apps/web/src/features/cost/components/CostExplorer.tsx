"use client";

import { Cloud, Question } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  listProviders,
  queryCost,
  type CostGroupBy,
  type CostQueryResponse,
} from "../api";

const GROUP_BY_OPTIONS: { id: CostGroupBy; label: string }[] = [
  { id: "service", label: "Service" },
  { id: "region", label: "Region" },
  { id: "account", label: "Account" },
  { id: "provider", label: "Provider" },
  { id: "resource_type", label: "Resource type" },
];

const DAYS_OPTIONS = [
  { v: 7, label: "7 days" },
  { v: 14, label: "14 days" },
  { v: 30, label: "30 days" },
  { v: 60, label: "60 days" },
  { v: 90, label: "90 days" },
];

const COLORS = [
  "#1a73e8", "#1a73e8", "#137333", "#fbbc04", "#d32f2f",
  "#ff9800", "#9aa0a6", "#5f6368", "#a142f4", "#34a853",
];

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

export function CostExplorer() {
  const [groupBy, setGroupBy] = useState<CostGroupBy>("service");
  const [days, setDays] = useState(30);
  const [provider, setProvider] = useState<string | "">("");

  const { data: providers } = useQuery({
    queryKey: ["cost", "providers"],
    queryFn: listProviders,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cost", "query", groupBy, days, provider],
    queryFn: () =>
      queryCost({
        group_by: groupBy,
        days,
        providers: provider ? [provider] : undefined,
      }),
  });

  const buckets = useMemo(() => {
    if (!data) return [];
    return data.table.map((r) => r.bucket);
  }, [data]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Cloud}
        title="Cloud Cost Explorer"
        breadcrumbs={[{ label: "Cloud Cost", href: "/cost" }]}
        subtitle="Break down spend by service, region, account, and resource type"
        actions={
          <button
            type="button"
            aria-label="Help"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Question size={14} weight="bold" />
          </button>
        }
      />

      <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px]"
        >
          <option value="">All providers</option>
          {providers?.map((p) => (
            <option key={p.provider} value={p.provider}>
              {p.provider} · {fmtUsd(p.totalCost30d)}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-8 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px]"
        >
          {DAYS_OPTIONS.map((d) => (
            <option key={d.v} value={d.v}>
              Last {d.label}
            </option>
          ))}
        </select>
        <span className="text-[11.5px] uppercase text-[#5f6368]">
          Group by:
        </span>
        {GROUP_BY_OPTIONS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroupBy(g.id)}
            className={`rounded-md border px-2 py-1 text-[12px] ${
              groupBy === g.id
                ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]"
            }`}
          >
            {g.label}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-[12.5px] text-[#5f6368]">
            Total: <strong className="text-[#202124]">{fmtUsd(data.totalCost)}</strong>
          </span>
        )}
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && (
          <div className="text-[13px] text-[#5f6368]">Loading…</div>
        )}
        {data && (
          <>
            <Card title={`Cost over time — grouped by ${groupBy.replace("_", " ")}`}>
              <div className="h-[320px]">
                <ResponsiveContainer>
                  <AreaChart data={data.series}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "#5f6368" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#5f6368" }}
                      tickFormatter={(v: number) => fmtUsd(v)}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtUsd(v)}
                    />
                    <Legend />
                    {buckets.map((b, i) => (
                      <Area
                        key={b}
                        type="monotone"
                        dataKey={b}
                        stackId="1"
                        stroke={COLORS[i % COLORS.length]}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.7}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="mt-5">
              <Card title="Breakdown">
                <table className="min-w-full text-[13px]">
                  <thead className="text-[10.5px] uppercase tracking-wide text-[#5f6368]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        {groupBy.replace("_", " ")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Cost (current)
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Cost (previous)
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Change</th>
                      <th className="px-3 py-2 text-left font-medium">% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.map((r, i) => {
                      const pctOfTotal = data.totalCost
                        ? (r.cost / data.totalCost) * 100
                        : 0;
                      return (
                        <tr key={r.bucket} className="border-t border-[#f1f3f4]">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: COLORS[i % COLORS.length] }}
                              />
                              <span className="font-mono">{r.bucket}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {fmtUsd(r.cost)}
                          </td>
                          <td className="px-3 py-2 text-right text-[#5f6368]">
                            {fmtUsd(r.previousCost)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {r.changePct === null ? (
                              <span className="text-[#9aa0a6]">—</span>
                            ) : (
                              <span
                                style={{
                                  color:
                                    r.changePct > 5
                                      ? "#d32f2f"
                                      : r.changePct < -5
                                        ? "#137333"
                                        : "#5f6368",
                                }}
                              >
                                {r.changePct > 0 ? "+" : ""}
                                {r.changePct.toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#5f6368]">
                            <div className="flex items-center gap-2">
                              <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-[#f1f3f4]">
                                <div
                                  className="absolute left-0 top-0 h-full rounded-full"
                                  style={{
                                    width: `${pctOfTotal}%`,
                                    background: COLORS[i % COLORS.length],
                                  }}
                                />
                              </div>
                              <span className="text-[11px]">
                                {pctOfTotal.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      {children}
    </section>
  );
}
