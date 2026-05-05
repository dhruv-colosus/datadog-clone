"use client";

import {
  Camera,
  ChartLineUp,
  Code,
  Export,
  FileArrowUp,
  Link as LinkIcon,
  ListChecks,
  Notebook,
  SquareSplitHorizontal,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useExplorerStore } from "../store";
import { Popover } from "./Popover";
import { SaveToDashboardDialog } from "./SaveToDashboardDialog";
import { Toggle } from "./Toggle";

export function ChartActions() {
  const oneGraphPerQuery = useExplorerStore((s) => s.oneGraphPerQuery);
  const toggleOneGraphPerQuery = useExplorerStore(
    (s) => s.toggleOneGraphPerQuery,
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          <ChartLineUp size={14} />
          <span>Save to Dashboard</span>
        </Button>
        <Button>
          <SquareSplitHorizontal size={14} />
          <span>Split Graph</span>
        </Button>
        <Button>
          <Export size={14} />
          <span>Open in Sheets</span>
          <span className="rounded-md bg-[#e8f0fe] px-1.5 py-px text-[10px] font-semibold text-[#1a73e8]">
            NEW
          </span>
        </Button>
        <MoreMenu onSaveToDashboard={() => setDialogOpen(true)} />
        <Toggle
          checked={oneGraphPerQuery}
          onChange={toggleOneGraphPerQuery}
          label="One graph per query"
        />
      </div>
      <SaveToDashboardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

function MoreMenu({
  onSaveToDashboard,
}: {
  onSaveToDashboard: () => void;
}) {
  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[260px] py-1"
      trigger={
        <Button>
          <span>More…</span>
        </Button>
      }
    >
      {({ close }) => (
        <ul>
          <MenuItem
            icon={<ChartLineUp size={14} />}
            label="Save to Dashboard"
            onClick={() => {
              onSaveToDashboard();
              close();
            }}
          />
          <MenuItem
            icon={<Notebook size={14} />}
            label="Save to Notebook"
            onClick={close}
            disabled
          />
          <MenuItem
            icon={<ListChecks size={14} />}
            label="Create Monitor"
            onClick={close}
            disabled
          />
          <li className="my-1 h-px bg-[#bdc1c6]" />
          <MenuItem
            icon={<LinkIcon size={14} />}
            label="Copy link"
            onClick={close}
          />
          <MenuItem
            icon={<Code size={14} />}
            label="View as JSON"
            onClick={close}
          />
          <MenuItem
            icon={<Camera size={14} />}
            label="Download as PNG"
            onClick={close}
          />
          <MenuItem
            icon={<FileArrowUp size={14} />}
            label="Export CSV"
            onClick={close}
          />
        </ul>
      )}
    </Popover>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
          disabled
            ? "text-[#9aa0a6]"
            : "text-[#202124] hover:bg-[#f1f3f4]"
        }`}
      >
        <span className="text-[#5f6368]">{icon}</span>
        <span>{label}</span>
      </button>
    </li>
  );
}
