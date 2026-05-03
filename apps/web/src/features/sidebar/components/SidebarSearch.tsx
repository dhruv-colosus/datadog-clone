"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

import { useCommandPaletteStore } from "@/features/command-palette";

type SidebarSearchProps = {
  collapsed: boolean;
};

export function SidebarSearch({ collapsed }: SidebarSearchProps) {
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const openPalette = () => setOpen(true);

  if (collapsed) {
    return (
      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          aria-label="Search (⌘K)"
          className="flex h-10 w-10 items-center justify-center rounded text-sidebar-muted hover:bg-[#171920] hover:text-white"
          onClick={openPalette}
        >
          <MagnifyingGlass size={18} />
        </button>
        <div className="mx-auto mt-1 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    );
  }

  return (
    <div className="px-2.5 pt-0.5">
      <button
        type="button"
        onClick={openPalette}
        className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-sidebar-muted transition-colors hover:text-white"
      >
        <MagnifyingGlass size={15} />
        <span className="flex-1 text-[12px]">Go to...</span>
        <span className="flex items-center gap-1 text-[10px] text-sidebar-muted/80">
          <kbd className="rounded bg-white/10 px-1 font-sans">⌘</kbd>
          <span className="opacity-60">+</span>
          <kbd className="rounded bg-white/10 px-1 font-sans">K</kbd>
        </span>
      </button>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}
