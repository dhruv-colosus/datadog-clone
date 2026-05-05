"use client";

import { Shield } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listScrubberFindings } from "../api";

function fmt(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function ScrubberFindingsPage() {
  const [days, setDays] = useState(7);
  const { data: findings, isLoading } = useQuery({
    queryKey: ["scrubber-findings", days],
    queryFn: () => listScrubberFindings(days),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Shield}
        title="Scrubber findings"
        breadcrumbs={[
          { label: "Security", href: "/security" },
          { label: "Data Security", href: "/security/data-security" },
        ]}
        subtitle="Sensitive-data matches that have been redacted in incoming logs"
        actions={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12.5px]"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && <div className="text-[13px] text-[#5f6368]">Loading…</div>}
        {findings && (
          <section className="rounded-lg border border-[#dadce0] bg-white">
            <table className="min-w-full text-[13px]">
              <thead className="border-b border-[#dadce0] bg-[#f8f9fb] text-[10.5px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-4 py-2 text-left font-medium">Service</th>
                  <th className="px-4 py-2 text-left font-medium">Pattern</th>
                  <th className="px-4 py-2 text-left font-medium">Redacted as</th>
                </tr>
              </thead>
              <tbody>
                {findings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-[#5f6368]">
                      <Shield size={28} className="mx-auto mb-2 opacity-40" />
                      No findings yet. Enable some scrubber rules to start scrubbing.
                    </td>
                  </tr>
                )}
                {findings.map((f) => (
                  <tr key={f.id} className="border-b border-[#f1f3f4]">
                    <td className="px-4 py-2 text-[#5f6368]">
                      {fmt(f.occurredMs)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[12px] text-[#202124]">
                        {f.service}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[12.5px]">
                      {f.patternMatched}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11.5px] text-[#1a73e8]">
                      {f.excerptRedacted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
