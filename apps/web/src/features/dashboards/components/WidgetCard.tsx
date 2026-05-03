"use client";

import { DotsThreeVertical, Pencil, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import type { TimeRange } from "@/features/metrics/types";
import type { Widget } from "../types";
import { WidgetView } from "./widget-views";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
  onEdit: () => void;
  onDelete: () => void;
};

export function WidgetCard({ widget, timeRange, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="group relative flex h-[260px] flex-col rounded-md border border-[#dadce0] bg-white">
      <div className="flex items-center justify-between border-b border-[#f1f3f4] px-3 py-2">
        <span className="truncate text-[13px] font-medium text-[#202124]">
          {widget.title}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => window.setTimeout(() => setMenuOpen(false), 100)}
            aria-label="Widget actions"
            className="flex h-6 w-6 items-center justify-center rounded text-[#5f6368] opacity-0 hover:bg-[#f1f3f4] group-hover:opacity-100"
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
      <div className="min-h-0 flex-1 px-2 py-2">
        <WidgetView widget={widget} timeRange={timeRange} />
      </div>
    </div>
  );
}
