"use client";

import { List } from "@phosphor-icons/react";
import { useSidebarStore } from "../store";

export function HamburgerButton() {
  const show = useSidebarStore((s) => s.show);

  return (
    <button
      type="button"
      onClick={show}
      aria-label="Open sidebar"
      className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded bg-sidebar-bg text-sidebar-muted shadow-md transition-colors hover:text-white"
    >
      <List size={20} weight="bold" />
    </button>
  );
}
