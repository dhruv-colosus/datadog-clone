"use client";

import {
  ChartLine,
  CodeSimple,
  Database,
  DotsSixVertical,
  Plus,
  Table as TableIcon,
  TextH,
  TextT,
  Trash,
} from "@phosphor-icons/react";
import { useState, type HTMLAttributes } from "react";

export type AddCellKind =
  | "markdown"
  | "heading"
  | "timeseries"
  | "table"
  | "sql"
  | "datasource";

type Props = {
  onAdd: (kind: AddCellKind) => void;
  onRemove: () => void;
  /** Drag listeners from useSortable. Bind these to the 6-dot handle so it acts as a drag handle. */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
};

export function CellMenu({ onAdd, onRemove, dragHandleProps }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute -left-12 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          className="flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
          aria-label="Add cell"
        >
          <Plus size={14} weight="bold" />
        </button>
        {open && (
          <div className="absolute left-0 top-7 z-30 w-48 overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg">
            <MenuItem
              icon={<TextT size={14} />}
              label="Text"
              onClick={() => {
                setOpen(false);
                onAdd("markdown");
              }}
            />
            <MenuItem
              icon={<TextH size={14} weight="bold" />}
              label="Heading"
              onClick={() => {
                setOpen(false);
                onAdd("heading");
              }}
            />
            <div className="border-t border-[#f1f3f4]" />
            <MenuItem
              icon={<ChartLine size={14} />}
              label="Timeseries"
              onClick={() => {
                setOpen(false);
                onAdd("timeseries");
              }}
            />
            <MenuItem
              icon={<TableIcon size={14} />}
              label="Table"
              onClick={() => {
                setOpen(false);
                onAdd("table");
              }}
            />
            <MenuItem
              icon={<CodeSimple size={14} />}
              label="SQL"
              onClick={() => {
                setOpen(false);
                onAdd("sql");
              }}
            />
            <MenuItem
              icon={<Database size={14} />}
              label="Data Source"
              onClick={() => {
                setOpen(false);
                onAdd("datasource");
              }}
            />
            <div className="border-t border-[#f1f3f4]" />
            <MenuItem
              icon={<Trash size={14} className="text-[#d93025]" />}
              label="Delete cell"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
              danger
            />
          </div>
        )}
      </div>
      <button
        type="button"
        {...dragHandleProps}
        className="flex h-5 w-5 cursor-grab items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag handle"
      >
        <DotsSixVertical size={14} weight="bold" />
      </button>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
        danger ? "text-[#d93025]" : "text-[#202124]"
      }`}
    >
      <span className={danger ? "text-[#d93025]" : "text-[#5f6368]"}>{icon}</span>
      {label}
    </button>
  );
}
