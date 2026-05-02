"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

type SidebarSearchProps = {
  collapsed: boolean;
};

export function SidebarSearch({ collapsed }: SidebarSearchProps) {
  if (collapsed) {
    return (
      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          aria-label="Search (⌘K)"
          className="flex h-10 w-10 items-center justify-center rounded text-sidebar-muted hover:bg-white/5 hover:text-white"
          onClick={() => console.log("TODO: open command palette")}
        >
          <MagnifyingGlass size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-2 pt-1">
      <button
        type="button"
        onClick={() => console.log("TODO: open command palette")}
        className="flex w-full items-center gap-2 rounded border border-white/10 bg-transparent px-2.5 py-1.5 text-left text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white"
      >
        <MagnifyingGlass size={16} />
        <span className="flex-1 text-[13px]">Go to...</span>
        <span className="flex items-center gap-1 text-[11px] text-sidebar-muted/80">
          <kbd className="rounded bg-white/10 px-1 py-0.5 font-sans">⌘</kbd>
          <span className="opacity-60">+</span>
          <kbd className="rounded bg-white/10 px-1 py-0.5 font-sans">K</kbd>
        </span>
      </button>
    </div>
  );
}
