"use client";

import { CaretDown, CaretUp, MagnifyingGlass, PencilSimple, X, XCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { MAP_SAVED_QUERIES } from "../mock-data";
import { useInfraStore } from "../store";

type Props = {
  fillRange: { min: number; max: number };
};

export function HostMapToolbar({ fillRange }: Props) {
  const queryId = useInfraStore((s) => s.mapQueryId);
  const setQueryId = useInfraStore((s) => s.setMapQueryId);
  const open = useInfraStore((s) => s.mapQueryPickerOpen);
  const setOpen = useInfraStore((s) => s.setMapQueryPickerOpen);
  const groupBy = useInfraStore((s) => s.mapGroupBy);
  const setGroupBy = useInfraStore((s) => s.setMapGroupBy);
  const fillBy = useInfraStore((s) => s.mapFillBy);
  const mainResource = useInfraStore((s) => s.mapMainResource);

  const current = MAP_SAVED_QUERIES.find((q) => q.id === queryId)!;

  return (
    <div className="relative border-b border-[#e8eaed] bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-[#bdc1c6]">|</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-[15px] text-[#202124] hover:text-[#1a73e8]"
        >
          <span>{current.question}</span>
          {open ? (
            <CaretUp size={12} weight="bold" className="text-[#5f6368]" />
          ) : (
            <CaretDown size={12} weight="bold" className="text-[#5f6368]" />
          )}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <FieldGroup label="Main resource" value={mainResource} />
          <FieldGroup label="Fill by" value={fillBy}>
            <FillRangeBar min={fillRange.min} max={fillRange.max} />
          </FieldGroup>
          <FieldGroup label="Group by" value={groupBy.replace("tags.", "")} clearable onClear={() => setGroupBy("none")} />
          <span className="text-[14px] text-[#bdc1c6]">|</span>
          <FilterField />
          <span className="text-[14px] text-[#bdc1c6]">|</span>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            <PencilSimple size={12} />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {open && <QueryPickerPanel onSelect={setQueryId} currentId={queryId} />}
    </div>
  );
}

function FieldGroup({
  label,
  value,
  children,
  clearable,
  onClear,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[#5f6368]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[13px] text-[#202124]">
          {clearable && (
            <button
              type="button"
              onClick={onClear}
              className="text-[#5f6368] hover:text-[#202124]"
              aria-label="Clear"
            >
              <X size={10} weight="bold" />
            </button>
          )}
          <span>{value}</span>
          {clearable && (
            <button
              type="button"
              className="text-[#9aa0a6] hover:text-[#5f6368]"
              aria-label="Reset"
            >
              <XCircle size={12} weight="fill" />
            </button>
          )}
          <CaretDown size={9} weight="bold" className="text-[#5f6368]" />
        </div>
        {children}
      </div>
    </div>
  );
}

function FillRangeBar({ min, max }: { min: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] tabular-nums text-[#5f6368]">
        {min.toFixed(2)} %
      </span>
      <div
        className="h-2 w-24 rounded-sm"
        style={{
          background:
            "linear-gradient(to right, #a7d5a5 0%, #fadb86 50%, #f0826e 100%)",
        }}
      />
      <span className="text-[12px] tabular-nums text-[#5f6368]">
        {max.toFixed(2)} %
      </span>
    </div>
  );
}

function FilterField() {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[#5f6368]">
        Filter
      </span>
      <input
        type="text"
        placeholder="None"
        className="w-44 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[13px] text-[#202124] placeholder:text-[#9aa0a6] focus:outline-none"
      />
    </div>
  );
}

function QueryPickerPanel({
  onSelect,
  currentId,
}: {
  onSelect: (id: string) => void;
  currentId: string;
}) {
  const [showMine, setShowMine] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        useInfraStore.getState().setMapQueryPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div
      ref={ref}
      className="absolute left-4 top-full z-20 mt-2 w-[640px] rounded-xl border border-[#e8eaed] bg-white p-4 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[14px] text-[#5f6368]">
          Select or create a new query
        </span>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#1763cd]"
        >
          <span className="text-[15px] leading-none">+</span>
          <span>Create</span>
        </button>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5">
          <MagnifyingGlass size={14} className="text-[#5f6368]" />
          <input
            type="text"
            placeholder="Filter views"
            className="flex-1 bg-transparent text-[13px] text-[#202124] placeholder:text-[#9aa0a6] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMine((v) => !v)}
          className="flex items-center gap-2"
        >
          <span
            className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
              showMine ? "bg-[#1a73e8]" : "bg-[#bdc1c6]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                showMine ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
          <span className="text-[13px] text-[#202124]">Show my queries</span>
        </button>
      </div>
      <ul className="max-h-[480px] space-y-1 overflow-auto">
        {MAP_SAVED_QUERIES.map((q) => {
          const active = q.id === currentId;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onSelect(q.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left ${
                  active
                    ? "bg-[#e8f0fe]"
                    : "hover:bg-[#f1f3f4]"
                }`}
              >
                <div>
                  <div className="text-[14px] font-medium text-[#202124]">
                    {q.question}
                  </div>
                  <div className="text-[12px] text-[#5f6368]">{q.meta}</div>
                </div>
                <span className="text-[16px] text-[#5f6368]">→</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
