"use client";

import { ChatCircle, DotsThreeVertical, Pencil, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { WidgetView } from "@/features/dashboards/components/widget-views";
import type { TimeRange } from "@/features/metrics/types";
import type { WidgetCell } from "../types";

type Props = {
  cell: WidgetCell;
  timeRange: TimeRange;
  onEdit: () => void;
  onDelete: () => void;
};

export function WidgetCellView({ cell, timeRange, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const w = cell.widget;
  const titleHint = `${aggLabel(w)}:${w.queries[0]?.metricName ?? ""}{*}`;

  return (
    <div className="group rounded-md border border-[#dadce0] bg-white">
      <div className="flex items-center justify-between border-b border-[#f1f3f4] px-3 py-2">
        <span className="truncate text-[13px] font-medium text-[#202124]">
          {w.title || titleHint}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-[#9aa0a6] opacity-0 hover:bg-[#f1f3f4] hover:text-[#5f6368] group-hover:opacity-100"
            aria-label="Comment"
          >
            <ChatCircle size={13} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => window.setTimeout(() => setMenuOpen(false), 100)}
              className="rounded p-1 text-[#5f6368] opacity-0 hover:bg-[#f1f3f4] group-hover:opacity-100"
              aria-label="Cell actions"
            >
              <DotsThreeVertical size={14} weight="bold" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <Trash size={12} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-[300px] px-3 py-3">
        <WidgetView widget={w} timeRange={timeRange} />
      </div>
    </div>
  );
}

function aggLabel(w: { queries: { aggregator: string }[] }): string {
  return w.queries[0]?.aggregator ?? "avg";
}
