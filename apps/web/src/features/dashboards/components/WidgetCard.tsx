"use client";

import { DotsThreeVertical, Pencil, Trash } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimeRange } from "@/features/metrics/types";
import { applyTemplateVars, type TemplateVarSelections } from "../templateVars";
import {
  DASHBOARD_GRID_COLS,
  DEFAULT_WIDGET_HEIGHT,
  DEFAULT_WIDGET_WIDTH,
  MIN_WIDGET_HEIGHT,
  MIN_WIDGET_WIDTH,
  WIDGET_HEIGHT_SNAP,
  type TemplateVariable,
  type Widget,
} from "../types";
import { WidgetView } from "./widget-views";

type Props = {
  widget: Widget;
  timeRange: TimeRange;
  onEdit: () => void;
  onDelete: () => void;
  onResize?: (width: number, height: number) => void;
  templateVars?: TemplateVariable[];
  templateVarSelections?: TemplateVarSelections;
};

type ResizeAxis = "x" | "y" | "both";

type DragState = {
  axis: ResizeAxis;
  startX: number;
  startY: number;
  startWidthPx: number;
  startHeightPx: number;
  colWidthPx: number;
};

export function WidgetCard({
  widget,
  timeRange,
  onEdit,
  onDelete,
  onResize,
  templateVars,
  templateVarSelections,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const persistedWidth = widget.width ?? DEFAULT_WIDGET_WIDTH;
  const persistedHeight = widget.height ?? DEFAULT_WIDGET_HEIGHT;

  // Live size during drag — committed on mouseup. null means "use persisted".
  const [liveSize, setLiveSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const colSpan = liveSize?.width ?? persistedWidth;
  const heightPx = liveSize?.height ?? persistedHeight;

  const beginResize = useCallback(
    (axis: ResizeAxis) => (e: React.MouseEvent) => {
      if (!onResize || !cardRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const card = cardRef.current;
      const grid = card.closest(".dashboard-widget-grid") as HTMLElement | null;
      const gridWidth = grid?.clientWidth ?? card.parentElement?.clientWidth ?? 0;
      const gapPx = 16; // matches gap-4 in the grid
      const colWidthPx =
        (gridWidth - gapPx * (DASHBOARD_GRID_COLS - 1)) / DASHBOARD_GRID_COLS;

      dragRef.current = {
        axis,
        startX: e.clientX,
        startY: e.clientY,
        startWidthPx: card.getBoundingClientRect().width,
        startHeightPx: card.getBoundingClientRect().height,
        colWidthPx: Math.max(colWidthPx, 1),
      };
      document.body.style.cursor =
        axis === "x" ? "ew-resize" : axis === "y" ? "ns-resize" : "nwse-resize";
      document.body.style.userSelect = "none";
    },
    [onResize],
  );

  useEffect(() => {
    if (!onResize) return;

    const handleMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;

      let nextWidth = persistedWidth;
      let nextHeight = persistedHeight;

      if (drag.axis === "x" || drag.axis === "both") {
        // N cols span = N * colWidth + (N - 1) * gap
        //             = N * (colWidth + gap) - gap
        // ⇒ N ≈ (targetPx + gap) / (colWidth + gap)
        const gapPx = 16;
        const targetPx = drag.startWidthPx + dx;
        const cols = Math.round(
          (targetPx + gapPx) / (drag.colWidthPx + gapPx),
        );
        nextWidth = Math.max(
          MIN_WIDGET_WIDTH,
          Math.min(DASHBOARD_GRID_COLS, cols),
        );
      } else {
        nextWidth = persistedWidth;
      }

      if (drag.axis === "y" || drag.axis === "both") {
        const targetPx = drag.startHeightPx + dy;
        const snapped =
          Math.round(targetPx / WIDGET_HEIGHT_SNAP) * WIDGET_HEIGHT_SNAP;
        nextHeight = Math.max(MIN_WIDGET_HEIGHT, snapped);
      } else {
        nextHeight = persistedHeight;
      }

      setLiveSize({ width: nextWidth, height: nextHeight });
    };

    const handleUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLiveSize((current) => {
        if (current) onResize(current.width, current.height);
        return null;
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onResize, persistedWidth, persistedHeight]);

  const isResizing = liveSize !== null;

  // Rewrite each query at render time per the active template variable
  // selections. The substitution is pure — React Query naturally re-keys on
  // the new filters and refetches without manual invalidation.
  const effectiveWidget = useMemo<Widget>(() => {
    const vars = templateVars ?? [];
    const selections = templateVarSelections ?? {};
    if (vars.length === 0) return widget;
    return {
      ...widget,
      queries: widget.queries.map((q) =>
        applyTemplateVars(q, vars, selections, widget.id),
      ),
    };
  }, [widget, templateVars, templateVarSelections]);

  return (
    <div
      ref={cardRef}
      className={`group relative flex flex-col rounded-md border bg-white ${
        isResizing
          ? "border-[#1a73e8] shadow-[0_0_0_1px_#1a73e8]"
          : "border-[#dadce0]"
      }`}
      style={{
        gridColumn: `span ${colSpan} / span ${colSpan}`,
        height: `${heightPx}px`,
      }}
    >
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
        <WidgetView widget={effectiveWidget} timeRange={timeRange} />
      </div>

      {onResize && (
        <>
          <div
            role="separator"
            aria-label="Resize widget width"
            onMouseDown={beginResize("x")}
            className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-ew-resize opacity-0 transition-opacity hover:bg-[#1a73e8]/40 hover:opacity-100 group-hover:opacity-100"
          />
          <div
            role="separator"
            aria-label="Resize widget height"
            onMouseDown={beginResize("y")}
            className="absolute bottom-0 left-0 z-10 h-1.5 w-full cursor-ns-resize opacity-0 transition-opacity hover:bg-[#1a73e8]/40 hover:opacity-100 group-hover:opacity-100"
          />
          <div
            role="separator"
            aria-label="Resize widget"
            onMouseDown={beginResize("both")}
            className="absolute bottom-0 right-0 z-20 flex h-3.5 w-3.5 cursor-nwse-resize items-end justify-end opacity-0 transition-opacity group-hover:opacity-100"
          >
            <svg
              viewBox="0 0 10 10"
              className="h-full w-full text-[#5f6368]"
              aria-hidden="true"
            >
              <path
                d="M9 1 L1 9 M9 5 L5 9 M9 9 L9 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          {isResizing && (
            <div className="pointer-events-none absolute right-2 top-2 z-30 rounded bg-[#202124]/85 px-2 py-0.5 text-[11px] font-medium text-white">
              {colSpan} / {DASHBOARD_GRID_COLS} · {heightPx}px
            </div>
          )}
        </>
      )}
    </div>
  );
}
