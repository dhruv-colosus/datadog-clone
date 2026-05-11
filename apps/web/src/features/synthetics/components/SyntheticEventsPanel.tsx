"use client";

import { CaretDown, FastForward, Pause, Rewind, Star } from "@phosphor-icons/react";
import { useSyntheticEvents } from "../hooks";

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

export function SyntheticEventsPanel() {
  const { data: events = [], isLoading } = useSyntheticEvents();

  return (
    <div className="flex h-full w-full flex-col bg-white text-[#202124]">
      <header className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-[#80868b] hover:text-[#202124]">
            <Star size={14} />
          </button>
          <h1 className="text-[15px] font-medium">Synthetics - API Test Performance</h1>
          <CaretDown size={12} className="text-[#5f6368]" />
        </div>
        <div className="flex items-center gap-3">
          <button className="text-[12px] text-[#5f6368] hover:text-[#202124]">
            ↑ Share
          </button>
          <button className="text-[12px] text-[#5f6368] hover:text-[#202124]">
            ⊞ Show Overlays
          </button>
          <button className="text-[12px] text-[#5f6368] hover:text-[#202124]">
            ⚙ Configure
          </button>
          <button className="flex items-center gap-1 rounded-md bg-[#006CC2] px-2 py-1 text-[12px] font-medium text-white hover:bg-[#0058a3]">
            + Add Widgets
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-2">
        <div className="flex items-center gap-2">
          <Selector label="Saved Views" value="" />
          <Selector label="TestType" value="*" />
          <Selector label="TestID" value="*" />
          <Selector label="RunType" value="*" />
          <Selector label="Team" value="*" />
          <Selector label="Env" value="*" />
          <Selector label="Region" value="*" />
          <button className="ml-2 text-[12px] text-[#1a73e8] hover:underline">
            ✎ Edit
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px]">
            1h
          </button>
          <span className="text-[12px] text-[#202124]">Past 1 Hour</span>
          <button className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]">
            <Rewind size={14} />
          </button>
          <button className="rounded bg-[#1a73e8] p-1 text-white">
            <Pause size={14} />
          </button>
          <button className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]">
            <FastForward size={14} />
          </button>
          <button className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]">
            🔍
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="overflow-hidden rounded-md border border-[#dadce0]">
          <div className="flex items-center justify-center bg-gradient-to-r from-[#7a3edb] to-[#4f29c5] px-4 py-3 text-[15px] font-semibold text-white">
            Events
          </div>
          <div className="bg-white px-4 py-3 text-[13px] text-[#202124]">
            Events are records of notable changes relevant for managing and
            troubleshooting Synthetic test alerts.
            <p className="mt-2 text-[#5f6368]">
              Datadog Events give you a consolidated interface to search,
              analyze, and filter events from Synthetics in one place. |{" "}
              <a
                href="#"
                className="text-[#1a73e8] hover:underline"
                onClick={(e) => e.preventDefault()}
              >
                View Events Docs ↗
              </a>
            </p>
          </div>
          <div className="border-t border-[#dadce0] bg-white">
            <div className="px-4 py-2 text-[13px] font-medium text-[#202124]">
              Events
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-[#f8f9fa] text-left text-[11px] font-medium text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 font-medium">SOURCE</th>
                  <th className="px-4 py-2 font-medium">MESSAGE</th>
                  <th className="px-4 py-2 text-right font-medium">DATE</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[#5f6368]"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-[#5f6368]"
                    >
                      No recent Synthetics events. Run a test to generate one.
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-[#f1f3f4] hover:bg-[#f8f9fa]"
                    >
                      <td className="px-4 py-2">
                        <span
                          className="inline-block h-5 w-1 rounded-sm align-middle"
                          style={{
                            backgroundColor:
                              e.status === "ALERT" ? "#d93025" : "#34a853",
                          }}
                        />
                        <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded bg-[#5e3796] text-[10px] font-bold text-white align-middle">
                          🐾
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[#202124]">{e.message}</td>
                      <td className="px-4 py-2 text-right text-[#5f6368]">
                        {fmtDate(e.executedMs)}
                      </td>
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

function Selector({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#80868b]">
        {label}
      </span>
      <button
        type="button"
        className="flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-0.5 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        {value || "—"}
        <CaretDown size={10} />
      </button>
    </div>
  );
}
