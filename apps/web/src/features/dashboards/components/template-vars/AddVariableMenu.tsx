"use client";

import { Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAllTagKeys } from "@/features/metrics/hooks";

type Props = {
  /** Tag keys that already have variables defined — hidden from the recommended list. */
  existingTagKeys: string[];
  onPickRecommended: (tagKey: string) => void;
  onCreateManual: () => void;
  /** "default" → labelled "+ Add Variable" button. "icon" → compact "+" icon button used once at least one variable exists. */
  variant?: "default" | "icon";
  /** When the menu opens via an external trigger (e.g. immediately after adding the first variable). Pair with onOpenChange. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const RECOMMENDED_FALLBACK = ["host", "service", "env", "device", "source"];

export function AddVariableMenu({
  existingTagKeys,
  onPickRecommended,
  onCreateManual,
  variant = "default",
  open: openProp,
  onOpenChange,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (next: boolean) => {
    setOpenInternal(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const tagKeysQuery = useAllTagKeys();

  const recommended = useMemo(() => {
    const all = (tagKeysQuery.data ?? RECOMMENDED_FALLBACK).filter(
      (k) => !existingTagKeys.includes(k),
    );
    if (!search) return all.slice(0, 12);
    const q = search.toLowerCase();
    return all.filter((k) => k.toLowerCase().includes(q));
  }, [tagKeysQuery.data, existingTagKeys, search]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative">
      {variant === "icon" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Add Variable"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#5f6368] transition-colors hover:border-[#dadce0] hover:bg-[#f8f9fa] ${
            open ? "border-[#dadce0] bg-[#f1f3f4]" : ""
          }`}
        >
          <Plus size={14} weight="bold" />
        </button>
      ) : (
        <Button ref={triggerRef} onClick={() => setOpen(!open)}>
          <Plus size={12} weight="bold" />
          Add Variable
        </Button>
      )}
      {open && (
        <div
          ref={popRef}
          role="dialog"
          className={`absolute top-full z-30 mt-1 w-[300px] overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg ${
            variant === "icon" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-[#f1f3f4] px-2 py-1.5">
            <MagnifyingGlass size={12} className="text-[#5f6368]" />
            <input
              type="text"
              placeholder="Search tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[12px] text-[#202124] outline-none placeholder:text-[#9aa0a6]"
              autoFocus
            />
          </div>
          <div className="max-h-[320px] overflow-auto">
            <div className="px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
              Recommended Variables
            </div>
            <ul className="py-1">
              {tagKeysQuery.isLoading && (
                <li className="px-3 py-1.5 text-[12px] text-[#5f6368]">
                  Loading…
                </li>
              )}
              {!tagKeysQuery.isLoading && recommended.length === 0 && (
                <li className="px-3 py-1.5 text-[12px] text-[#5f6368]">
                  No matching tags
                </li>
              )}
              {recommended.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickRecommended(k);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
                  >
                    <Funnel size={12} weight="fill" className="text-[#5f6368]" />
                    <span className="font-mono">{k}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#f1f3f4]">
              <button
                type="button"
                onClick={() => {
                  onCreateManual();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#1a73e8] hover:bg-[#f8f9fa]"
              >
                <Plus size={12} weight="bold" />
                Create variable manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
