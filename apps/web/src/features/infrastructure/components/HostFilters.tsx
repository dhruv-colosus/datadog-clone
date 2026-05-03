"use client";

import { CaretDown, X } from "@phosphor-icons/react";
import { useInfraStore } from "../store";

export function HostFilters() {
  const search = useInfraStore((s) => s.searchQuery);
  const setSearch = useInfraStore((s) => s.setSearchQuery);
  const groupBy = useInfraStore((s) => s.groupByQuery);
  const setGroupBy = useInfraStore((s) => s.setGroupByQuery);

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-[#e8eaed] bg-white px-4 py-3">
      <FilterField
        label="Search by"
        placeholder="Search or select tags"
        value={search}
        onChange={setSearch}
      />
      <FilterField
        label="Group by"
        placeholder="Select tag keys"
        value={groupBy}
        onChange={setGroupBy}
        showCaret
      />
    </div>
  );
}

function FilterField({
  label,
  placeholder,
  value,
  onChange,
  showCaret,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  showCaret?: boolean;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-[#bdc1c6] bg-white focus-within:border-[#1a73e8]">
      <div className="flex items-center bg-[#f1f3f4] px-3 text-[13px] text-[#5f6368]">
        {label}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-white px-3 py-1.5 text-[13px] text-[#202124] placeholder:text-[#9aa0a6] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex items-center px-2 text-[#5f6368] hover:text-[#202124]"
          aria-label={`Clear ${label.toLowerCase()}`}
        >
          <X size={12} weight="bold" />
        </button>
      )}
      {showCaret && (
        <div className="flex items-center px-2 text-[#5f6368]">
          <CaretDown size={10} weight="bold" />
        </div>
      )}
    </div>
  );
}
