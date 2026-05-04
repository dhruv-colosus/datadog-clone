"use client";

import { ArrowDown, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useRumApplications, useRumViews } from "../hooks";
import { RumHeader } from "./RumHeader";

export function RumExplorerPage() {
  const range = useMemo(() => {
    const to = Date.now();
    return { fromMs: to - 24 * 60 * 60 * 1000, toMs: to };
  }, []);
  const { data: apps = [] } = useRumApplications();
  const app = apps[0];
  const { data: views = [], isLoading } = useRumViews(app?.id, range);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return views;
    const q = search.toLowerCase();
    return views.filter(
      (v) =>
        (v.viewPath ?? "").toLowerCase().includes(q) ||
        (v.userName ?? "").toLowerCase().includes(q) ||
        (v.country ?? "").toLowerCase().includes(q),
    );
  }, [views, search]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <RumHeader range={range} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-6 py-5">
          <section className="flex items-center gap-3 rounded-md border border-[#e8eaed] bg-white px-3 py-2 shadow-[0_1px_0_rgba(60,64,67,0.06)]">
            <div className="flex h-7 flex-1 items-center gap-2 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]">
              <MagnifyingGlass size={12} className="text-[#5f6368]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="@view.path:/dashboard service:web ..."
                className="flex-1 outline-none placeholder:text-[#9aa0a6]"
              />
            </div>
            <span className="text-[12px] text-[#5f6368]">
              {filtered.length.toLocaleString()} views
            </span>
          </section>

          <div className="overflow-hidden rounded-md border border-[#e8eaed] bg-white shadow-[0_1px_0_rgba(60,64,67,0.06)]">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[#e8eaed] bg-[#f8f9fb] text-left text-[11px] uppercase tracking-wide text-[#5f6368]">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">View</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Browser</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 text-right font-medium">Loading</th>
                  <th className="px-3 py-2 text-right font-medium">LCP</th>
                  <th className="px-3 py-2 text-right font-medium">FCP</th>
                  <th className="px-3 py-2 text-right font-medium">CLS</th>
                  <th className="px-3 py-2 text-right font-medium">INP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[#5f6368]">
                      Loading views…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-[#9aa0a6]">
                      No matching views.
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr
                      key={`${v.viewId}`}
                      className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]"
                    >
                      <td className="px-3 py-2 tabular-nums text-[#5f6368]">
                        {fmtAgo(v.ts)}
                      </td>
                      <td className="px-3 py-2 text-[#1a73e8]">{v.viewPath}</td>
                      <td className="px-3 py-2">{v.userName ?? "Anonymous"}</td>
                      <td className="px-3 py-2 text-[#5f6368]">{v.browser ?? "—"}</td>
                      <td className="px-3 py-2 text-[#5f6368]">{v.country ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ms(v.loadingTimeMs)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ms(v.lcpMs)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ms(v.fcpMs)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {v.cls != null ? v.cls.toFixed(3) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{ms(v.inpMs)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ms(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(2)}s`;
  return `${v}ms`;
}

function fmtAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
