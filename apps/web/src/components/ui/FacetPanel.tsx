"use client";

import { CaretDown, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

export type FacetOption = {
  value: string;
  label?: string;
  count?: number;
};

export type FacetGroup = {
  key: string;
  title: string;
  options: FacetOption[];
  searchable?: boolean;
  collapsedByDefault?: boolean;
};

type Props = {
  groups: FacetGroup[];
  selected: Record<string, Set<string>>;
  onToggle: (groupKey: string, value: string) => void;
  onClear?: (groupKey: string) => void;
  width?: number;
};

export function FacetPanel({
  groups,
  selected,
  onToggle,
  onClear,
  width = 240,
}: Props) {
  return (
    <aside
      className="shrink-0 overflow-y-auto border-r border-[#dadce0] bg-white"
      style={{ width }}
    >
      {groups.map((group) => (
        <FacetSection
          key={group.key}
          group={group}
          selected={selected[group.key] ?? new Set<string>()}
          onToggle={(value) => onToggle(group.key, value)}
          onClear={() => onClear?.(group.key)}
        />
      ))}
    </aside>
  );
}

function FacetSection({
  group,
  selected,
  onToggle,
  onClear,
}: {
  group: FacetGroup;
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(!group.collapsedByDefault);
  const [query, setQuery] = useState("");

  const visibleOptions = useMemo(() => {
    if (!group.searchable || !query.trim()) return group.options;
    const q = query.trim().toLowerCase();
    return group.options.filter((opt) =>
      (opt.label ?? opt.value).toLowerCase().includes(q),
    );
  }, [group.options, group.searchable, query]);

  return (
    <div className="border-b border-[#f1f3f4] py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] font-medium uppercase tracking-wide text-[#5f6368] hover:text-[#202124]"
      >
        <span className="flex items-center gap-1">
          {open ? <CaretDown size={11} /> : <CaretRight size={11} />}
          {group.title}
        </span>
        {selected.size > 0 && (
          <span
            className="text-[10px] font-normal text-[#1a73e8] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            Clear
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-1">
          {group.searchable && (
            <div className="mb-1.5 flex items-center gap-1 rounded border border-[#dadce0] bg-white px-1.5">
              <MagnifyingGlass size={12} className="text-[#9aa0a6]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent py-1 text-[12px] outline-none placeholder:text-[#9aa0a6]"
              />
            </div>
          )}
          <ul className="max-h-[260px] overflow-y-auto">
            {visibleOptions.map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <li key={opt.value}>
                  <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-[#202124] hover:bg-[#f8f9fa]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(opt.value)}
                      className="h-3 w-3 cursor-pointer accent-[#1a73e8]"
                    />
                    <span className="flex-1 truncate">
                      {opt.label ?? opt.value}
                    </span>
                    {opt.count !== undefined && (
                      <span className="shrink-0 text-[11px] text-[#9aa0a6]">
                        {opt.count.toLocaleString()}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
            {visibleOptions.length === 0 && (
              <li className="py-1 text-[11px] italic text-[#9aa0a6]">
                No matches
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
