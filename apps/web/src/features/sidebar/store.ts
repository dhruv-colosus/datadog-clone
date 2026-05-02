import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarMode = "expanded" | "collapsed" | "hidden";

type SidebarStore = {
  mode: SidebarMode;
  lastOpenMode: Exclude<SidebarMode, "hidden">;
  setMode: (mode: SidebarMode) => void;
  collapse: () => void;
  expand: () => void;
  hide: () => void;
  show: () => void;
};

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set, get) => ({
      mode: "expanded",
      lastOpenMode: "expanded",
      setMode: (mode) =>
        set(
          mode === "hidden"
            ? { mode }
            : { mode, lastOpenMode: mode },
        ),
      collapse: () => set({ mode: "collapsed", lastOpenMode: "collapsed" }),
      expand: () => set({ mode: "expanded", lastOpenMode: "expanded" }),
      hide: () => set({ mode: "hidden" }),
      show: () => set({ mode: get().lastOpenMode }),
    }),
    {
      name: "datadog-clone:sidebar",
    },
  ),
);
