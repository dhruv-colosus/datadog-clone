"use client";

import { Faders, Pencil, Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { TemplateVariable } from "../../types";

type Props = {
  variables: TemplateVariable[];
  onEdit: (variableId: string) => void;
  onDelete: (variableId: string) => void;
};

/**
 * The "tune" / sliders icon next to the variable bar. Opens a small menu that
 * lists each defined variable with edit + delete actions — keeps the pills
 * themselves visually clean.
 */
export function ManageVariablesMenu({ variables, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Manage variables"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#5f6368] transition-colors hover:border-[#dadce0] hover:bg-[#f8f9fa] ${
          open ? "border-[#dadce0] bg-[#f1f3f4]" : ""
        }`}
      >
        <Faders size={14} />
      </button>
      {open && (
        <div
          ref={popRef}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg"
        >
          <div className="border-b border-[#f1f3f4] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
            Variables
          </div>
          {variables.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[#5f6368]">
              No variables yet
            </div>
          ) : (
            <ul className="py-1">
              {variables.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-[#f8f9fa]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-mono text-[#202124]">
                      ${v.name}
                    </div>
                    <div className="truncate text-[11px] text-[#5f6368]">
                      {v.tagKey || "—"}
                      {v.type === "group" && " · group"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onEdit(v.id);
                        setOpen(false);
                      }}
                      aria-label={`Edit ${v.name}`}
                      className="rounded p-1 text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#1a73e8]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(v.id);
                        setOpen(false);
                      }}
                      aria-label={`Remove ${v.name}`}
                      className="rounded p-1 text-[#5f6368] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
