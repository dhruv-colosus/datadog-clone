"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildCommandRegistry,
  routeExists,
  type CommandEntry,
} from "./registry";
import { useCommandPaletteStore } from "./store";

type Group = {
  key: "RECENTS" | "PAGES" | "ACTIONS";
  label: string;
  entries: CommandEntry[];
};

function fuzzyMatch(entry: CommandEntry, query: string): boolean {
  if (!query) return true;
  const haystack = [
    entry.label,
    entry.context ?? "",
    entry.href ?? "",
    ...(entry.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const registry = useMemo(() => buildCommandRegistry(), []);

  const groups: Group[] = useMemo(() => {
    const recents = registry.filter(
      (e) => e.section === "recents" && fuzzyMatch(e, query),
    );
    // Only show the full PAGES list when the user is searching — empty-state
    // keeps the palette focused on RECENTS + ACTIONS.
    const pages = query
      ? registry.filter((e) => e.section === "pages" && fuzzyMatch(e, query))
      : [];
    const actions = registry.filter(
      (e) => e.section === "actions" && fuzzyMatch(e, query),
    );
    const out: Group[] = [];
    if (recents.length) out.push({ key: "RECENTS", label: "RECENTS", entries: recents });
    if (pages.length) out.push({ key: "PAGES", label: "PAGES", entries: pages });
    if (actions.length) out.push({ key: "ACTIONS", label: "ACTIONS", entries: actions });
    return out;
  }, [registry, query]);

  // Flat list (in render order) for keyboard navigation.
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  // Global keyboard listener: ⌘K / Ctrl+K to toggle, Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, toggle]);

  // Reset state every time we re-open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp active index when the filtered list shrinks.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat.length, activeIdx]);

  function runEntry(entry: CommandEntry) {
    if (entry.href) {
      router.push(entry.href);
    }
    setOpen(false);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = flat[activeIdx];
      if (entry) runEntry(entry);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div
        className="relative w-full max-w-[720px] overflow-hidden rounded-lg border border-white/10 bg-[#1B1C1D] text-[#E5E7EB] shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <MagnifyingGlass size={18} className="text-sidebar-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Go to..."
            className="h-12 flex-1 bg-transparent text-[14px] text-white placeholder:text-sidebar-muted focus:outline-none"
          />
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {flat.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-sidebar-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="py-1">
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold tracking-[0.08em] text-sidebar-muted/80">
                  {group.label}
                </div>
                {group.entries.map((entry) => {
                  const idx = flat.indexOf(entry);
                  const active = idx === activeIdx;
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => runEntry(entry)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors ${
                        active
                          ? "bg-[#3B82F6] text-white"
                          : "text-[#E5E7EB] hover:bg-white/5"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={active ? "text-white" : "text-sidebar-muted"}
                      />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{entry.label}</span>
                        {entry.context ? (
                          <span
                            className={`ml-2 text-[12px] ${
                              active ? "text-white/80" : "text-sidebar-muted"
                            }`}
                          >
                            {entry.context}
                          </span>
                        ) : null}
                      </span>
                      {routeExists(entry.href) ? (
                        <span
                          className={`font-mono text-[12px] ${
                            active ? "text-white/90" : "text-sidebar-muted"
                          }`}
                        >
                          {entry.href}
                        </span>
                      ) : entry.shortcut ? (
                        <span
                          className={`font-mono text-[12px] ${
                            active ? "text-white/90" : "text-sidebar-muted"
                          }`}
                        >
                          {entry.shortcut}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
