"use client";

import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAllTagValues } from "@/features/metrics/hooks";
import { TEMPLATE_VAR_WILDCARD, type TemplateVariable } from "../../types";

type Props = {
  variable: TemplateVariable;
  /** Current selection (URL-resolved). */
  value: string;
  onChange: (value: string) => void;
};

/**
 * Notched-outlined "Filter by" input — the floating tag name sits on top of
 * the border, mirroring the Datadog dashboard variable bar.
 */
export function VariableValuePicker({ variable, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const liveQuery = useAllTagValues(open ? variable.tagKey : "");
  const captured = variable.availableValues ?? [];
  const allValues = useMemo<string[]>(() => {
    const live = liveQuery.data ?? [];
    const merged = new Set<string>([...captured, ...live]);
    return Array.from(merged).sort();
  }, [captured, liveQuery.data]);

  const filtered = useMemo(() => {
    if (!search) return allValues;
    const q = search.toLowerCase();
    return allValues.filter((v) => v.toLowerCase().includes(q));
  }, [allValues, search]);

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

  const isWildcard = !value || value === TEMPLATE_VAR_WILDCARD;
  const displayValue = isWildcard ? TEMPLATE_VAR_WILDCARD : value;
  // Active = a real selection is in effect, OR the dropdown is open. Datadog
  // colours the entire control blue in either case so the pill reads as
  // "currently filtering".
  const isActive = open || !isWildcard;
  const borderColor = isActive ? "#1a73e8" : "#bdc1c6";
  const labelColor = isActive ? "#1a73e8" : "#5f6368";
  const valueColor = isActive ? "#1a73e8" : "#202124";
  const caretColor = isActive ? "#1a73e8" : "#5f6368";

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group relative flex min-w-[180px] items-center gap-2 rounded-md border bg-white px-2.5 pb-1 pt-2.5 text-left transition-colors hover:border-[#1a73e8]"
        style={{ borderColor }}
      >
        {/* Notched floating label */}
        <span
          className="pointer-events-none absolute -top-[7px] left-2 bg-white px-1 text-[11px] font-normal leading-none transition-colors"
          style={{ color: labelColor }}
        >
          {variable.name}
        </span>
        <span
          className="flex-1 truncate text-[13px] transition-colors"
          style={{ color: valueColor }}
        >
          {displayValue}
        </span>
        <CaretDown
          size={11}
          weight="fill"
          className="shrink-0 transition-colors"
          style={{ color: caretColor }}
        />
      </button>
      {open && (
        <div
          ref={popRef}
          role="dialog"
          className="absolute left-0 top-full z-30 mt-1 w-[280px] overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-[#f1f3f4] px-2 py-1.5">
            <MagnifyingGlass size={12} className="text-[#5f6368]" />
            <input
              type="text"
              placeholder={`Search ${variable.tagKey || variable.name}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[12px] text-[#202124] outline-none placeholder:text-[#9aa0a6]"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="rounded p-0.5 text-[#5f6368] hover:bg-[#f1f3f4]"
              >
                <X size={10} weight="bold" />
              </button>
            )}
          </div>
          <ul className="max-h-[260px] overflow-auto py-1">
            <li>
              <ValueRow
                label={`${TEMPLATE_VAR_WILDCARD} (All)`}
                selected={isWildcard}
                onClick={() => {
                  onChange(TEMPLATE_VAR_WILDCARD);
                  setOpen(false);
                }}
              />
            </li>
            {liveQuery.isLoading && filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-[#5f6368]">Loading…</li>
            )}
            {!liveQuery.isLoading &&
              !liveQuery.isFetching &&
              filtered.length === 0 && (
                <li className="px-3 py-2 text-[12px] text-[#5f6368]">
                  No values
                </li>
              )}
            {filtered.map((v) => (
              <li key={v}>
                <ValueRow
                  label={v}
                  selected={!isWildcard && v === value}
                  onClick={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ValueRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-1 text-left text-[12px] hover:bg-[#f1f3f4] ${
        selected ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#202124]"
      }`}
    >
      <span className="truncate">{label}</span>
      {selected && <span className="text-[10px] uppercase">selected</span>}
    </button>
  );
}
