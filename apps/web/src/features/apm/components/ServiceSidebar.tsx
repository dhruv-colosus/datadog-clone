"use client";

import {
  BracketsCurly,
  CaretLeft,
  CaretRight,
  ChartLine,
  Cube,
  Database,
  GitBranch,
  Globe,
  ListMagnifyingGlass,
  PuzzlePiece,
  Pulse,
  ShieldCheck,
  Tree,
  Warning,
} from "@phosphor-icons/react";
import { useApmServiceDetailStore, type ApmServiceDetailTab } from "../store";

type Item = {
  id: ApmServiceDetailTab;
  label: string;
  icon: typeof Globe;
};

const ITEMS: Item[] = [
  { id: "summary", label: "Service Summary", icon: Globe },
  { id: "operations", label: "Operations", icon: PuzzlePiece },
  { id: "resources", label: "Resources", icon: BracketsCurly },
  { id: "dependencies", label: "Dependencies", icon: Tree },
  { id: "traces", label: "Traces", icon: Pulse },
  { id: "deployments", label: "Deployments", icon: GitBranch },
  { id: "errors", label: "Errors", icon: Warning },
  { id: "infrastructure", label: "Infrastructure", icon: Cube },
  { id: "databases", label: "Databases", icon: Database },
  { id: "logs", label: "Logs", icon: ListMagnifyingGlass },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export function ServiceSidebar() {
  const tab = useApmServiceDetailStore((s) => s.tab);
  const setTab = useApmServiceDetailStore((s) => s.setTab);

  return (
    <aside className="flex w-[200px] shrink-0 flex-col justify-between border-r border-[#e8eaed] bg-white py-2">
      <div>
        {ITEMS.map((item) => {
          const active = item.id === tab;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                active
                  ? "bg-[#1a73e8] text-white"
                  : "text-[#202124] hover:bg-[#f1f3f4]"
              }`}
            >
              <Icon size={14} className={active ? "text-white" : "text-[#5f6368]"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-[#e8eaed] py-1">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <span className="inline-flex items-center gap-2">
            <ChartLine size={14} className="text-[#5f6368]" />
            Dashboards
          </span>
          <CaretRight size={11} weight="bold" className="text-[#5f6368]" />
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <CaretLeft size={12} weight="bold" />
          Collapse
        </button>
      </div>
    </aside>
  );
}
