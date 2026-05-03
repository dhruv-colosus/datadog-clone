"use client";

import {
  CaretDown,
  Code,
  FloppyDisk,
  Lightning,
  MagnifyingGlass,
  Plus,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "@/features/metrics/components/Popover";
import { selectTracesSearchText, useApmTracesStore } from "../store";
import type { ApmSearchToken } from "../types";

const TOKEN_REGEX = /^(@?[\w.-]+):(.+)$/;

export function TracesQueryBar() {
  const tokens = useApmTracesStore((s) => s.tokens);
  const freeText = useApmTracesStore((s) => s.freeText);
  const addToken = useApmTracesStore((s) => s.addToken);
  const removeToken = useApmTracesStore((s) => s.removeToken);
  const setFreeText = useApmTracesStore((s) => s.setFreeText);
  const clearSearch = useApmTracesStore((s) => s.clearSearch);
  const searchMode = useApmTracesStore((s) => s.searchMode);
  const setSearchMode = useApmTracesStore((s) => s.setSearchMode);
  void useApmTracesStore(selectTracesSearchText);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);

  const tryTokenize = (raw: string): boolean => {
    const trimmed = raw.trim();
    const match = trimmed.match(TOKEN_REGEX);
    if (!match) return false;
    addToken(match[1], match[2]);
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "Enter") {
      if (tryTokenize(freeText)) {
        e.preventDefault();
        setFreeText("");
      }
    } else if (
      e.key === "Backspace" &&
      freeText.length === 0 &&
      tokens.length > 0
    ) {
      e.preventDefault();
      removeToken(tokens[tokens.length - 1].id);
    }
  };

  const hasContent = tokens.length > 0 || freeText.length > 0;

  return (
    <div className="space-y-2 border-b border-[#e8eaed] bg-white px-4 pb-3 pt-3">
      <div className="flex items-center gap-3 text-[12.5px]">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#e8eaed] px-2 py-1 text-[#202124] hover:bg-[#dfe1e5]"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#1a73e8] text-white">
            <Lightning size={9} weight="fill" />
          </span>
          <span className="font-medium text-[#1a73e8]">Views</span>
        </button>
        <span className="text-[#5f6368]">Search for</span>
        <div className="inline-flex overflow-hidden rounded-md border border-[#bdc1c6]">
          <button
            type="button"
            onClick={() => setSearchMode("spans")}
            className={`px-2.5 py-1 text-[12.5px] ${
              searchMode === "spans"
                ? "bg-[#1a73e8] text-white"
                : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
            }`}
          >
            Spans
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("traces")}
            className={`border-l border-[#bdc1c6] px-2.5 py-1 text-[12.5px] ${
              searchMode === "traces"
                ? "bg-[#1a73e8] text-white"
                : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
            }`}
          >
            Traces
          </button>
        </div>
        <span className="text-[#5f6368]">in</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 border-b border-dashed border-[#5f6368] text-[#202124]"
        >
          All Ingested Spans (Live Search)
        </button>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#34a853] text-white">
          <Lightning size={11} weight="fill" />
        </span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <FloppyDisk size={12} />
          Save
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e8fd] text-[12.5px] font-semibold text-[#7c3aed]">
          a
        </span>

        <div className="relative flex-1">
          <div
            onClick={() => inputRef.current?.focus()}
            className={`flex min-h-[34px] flex-wrap items-center gap-1 rounded-md border bg-white px-1.5 py-1 transition-colors ${
              focused ? "border-[#1a73e8]" : "border-[#bdc1c6]"
            }`}
          >
            {tokens.map((tok) => (
              <TokenChip
                key={tok.id}
                token={tok}
                onRemove={() => removeToken(tok.id)}
              />
            ))}
            <input
              ref={inputRef}
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={hasContent ? "" : "Search spans"}
              className="h-7 min-w-[80px] flex-1 bg-transparent text-[13px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
            />
            {hasContent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSearch();
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              aria-label="Natural language search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#7c3aed] text-white hover:bg-[#6d28d9]"
            >
              <Sparkle size={14} weight="fill" />
            </button>
            <button
              type="button"
              aria-label="Code editor"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Code size={14} weight="bold" />
            </button>
          </div>
        </div>

        <span className="text-[12.5px] text-[#5f6368]">in</span>
        <Popover
          placement="bottom-end"
          panelClassName="w-[200px] py-1"
          trigger={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-3 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              All Spans
              <CaretDown size={10} weight="bold" />
            </button>
          }
        >
          {() => (
            <ul>
              {["All Spans", "Service Entry Spans", "DB Spans", "Web Spans"].map(
                (s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="flex w-full px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                    >
                      {s}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </Popover>
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1 text-[12.5px] text-[#1a73e8] hover:underline"
      >
        <Plus size={11} weight="bold" />
        Add another span query
      </button>

      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="text-[#5f6368]">Group by</span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#f1f3f4] px-2 text-[12.5px] text-[#5f6368] hover:bg-[#e8eaed]"
        >
          Select value
          <CaretDown size={10} weight="bold" />
        </button>
      </div>

      <VisualizeTabs />
    </div>
  );
}

function TokenChip({
  token,
  onRemove,
}: {
  token: ApmSearchToken;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex h-6 items-center overflow-hidden rounded-md border border-[#e8d5fb] bg-[#faf5ff] text-[12.5px]"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="bg-[#f3e8fd] px-1.5 py-0.5 font-medium text-[#7c3aed]">
        {token.key}
      </span>
      <span className="px-0.5 text-[#7c3aed]">:</span>
      <span className="bg-[#faf5ff] px-1.5 py-0.5 text-[#7c3aed]">
        {token.value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${token.key}:${token.value}`}
        className="flex h-6 w-5 items-center justify-center text-[#7c3aed] hover:bg-[#f3e8fd]"
      >
        <X size={10} weight="bold" />
      </button>
    </span>
  );
}

const VIS_OPTIONS: Array<{
  value:
    | "list"
    | "timeseries"
    | "top-list"
    | "bar"
    | "table"
    | "point"
    | "tree"
    | "pie"
    | "flow";
  label: string;
}> = [
  { value: "list", label: "List" },
  { value: "timeseries", label: "Timeseries" },
  { value: "top-list", label: "Top List" },
  { value: "bar", label: "Bar Chart" },
  { value: "table", label: "Table" },
  { value: "point", label: "Point Plot" },
  { value: "tree", label: "Tree Map" },
  { value: "pie", label: "Pie Chart" },
  { value: "flow", label: "Flow Map" },
];

function VisualizeTabs() {
  const visualization = useApmTracesStore((s) => s.visualization);
  const setVisualization = useApmTracesStore((s) => s.setVisualization);
  return (
    <div className="flex items-center gap-1 text-[12.5px]">
      <span className="mr-2 text-[#5f6368]">Visualize as</span>
      <div className="inline-flex items-center gap-1 overflow-x-auto">
        {VIS_OPTIONS.map((o) => {
          const active = visualization === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setVisualization(o.value)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 ${
                active
                  ? "border-[#a8b3be] bg-[#e8f0fe] text-[#1a73e8]"
                  : "border-transparent text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
            >
              <MagnifyingGlass size={11} className="opacity-0" />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
