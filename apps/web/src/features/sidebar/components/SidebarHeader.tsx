"use client";

import Image from "next/image";
import { Minus, X } from "@phosphor-icons/react";
import { useSidebarStore } from "../store";

type SidebarHeaderProps = {
  collapsed: boolean;
};

export function SidebarHeader({ collapsed }: SidebarHeaderProps) {
  const collapse = useSidebarStore((s) => s.collapse);
  const expand = useSidebarStore((s) => s.expand);
  const hide = useSidebarStore((s) => s.hide);

  if (collapsed) {
    return (
      <div className="flex items-center justify-center px-3 py-3">
        <button
          type="button"
          onClick={expand}
          aria-label="Expand sidebar"
          className="flex h-10 w-10 items-center justify-center rounded hover:bg-white/5"
        >
          <Image
            src="/images/logo.svg"
            alt="Datadog"
            width={28}
            height={28}
            className="h-7 w-7"
            priority
          />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center px-4 py-3">
      <Image
        src="/images/logo.svg"
        alt="Datadog"
        width={120}
        height={32}
        className="h-8 w-auto"
        priority
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={collapse}
          aria-label="Collapse sidebar"
          className="flex h-7 w-7 items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-white"
        >
          <Minus size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={hide}
          aria-label="Hide sidebar"
          className="flex h-7 w-7 items-center justify-center rounded text-sidebar-muted hover:bg-white/10 hover:text-white"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
