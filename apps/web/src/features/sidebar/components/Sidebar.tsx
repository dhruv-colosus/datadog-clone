"use client";

import { useEffect, useState } from "react";
import { useSidebarStore } from "../store";
import { HamburgerButton } from "./HamburgerButton";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNav } from "./SidebarNav";
import { SidebarSearch } from "./SidebarSearch";

export function Sidebar() {
  const mode = useSidebarStore((s) => s.mode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Render the default expanded sidebar on the server / pre-hydration to
  // avoid a flash of the wrong state once persisted prefs load.
  const effectiveMode = hydrated ? mode : "expanded";

  if (effectiveMode === "hidden") {
    return <HamburgerButton />;
  }

  const collapsed = effectiveMode === "collapsed";

  return (
    <aside
      className={`flex h-screen flex-col bg-sidebar-bg text-sidebar-muted transition-[width] duration-200 ease-out ${
        collapsed ? "w-16" : "w-[200px]"
      }`}
    >
      <SidebarHeader collapsed={collapsed} />
      <SidebarSearch collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
