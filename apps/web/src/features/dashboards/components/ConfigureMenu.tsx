"use client";

import {
  ArrowSquareOut,
  Bell,
  CaretDown,
  ClockCounterClockwise,
  Copy,
  Envelope,
  Gear,
  Keyboard,
  Lock,
  MinusSquare,
  Monitor,
  Notebook,
  PlusSquare,
  Stack,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cloneDashboard, responseToDashboard } from "../api";
import { useDashboardsStore } from "../store";

type Props = {
  dashboardId: string;
};

export function ConfigureMenu({ dashboardId }: Props) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = panelRef.current?.offsetWidth ?? 300;
    const panelH = panelRef.current?.offsetHeight ?? 0;

    let top = r.bottom + 4;
    let left = r.right;

    const effectiveLeft = left - panelW;
    if (effectiveLeft < margin) {
      left = margin + panelW;
    }
    if (panelH > 0 && top + panelH > vh - margin) {
      top = Math.max(margin, vh - margin - panelH);
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onResize, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onResize, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
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
  }, [open]);

  return (
    <>
      <Button
        ref={triggerRef}
        active={open}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {open ? <X size={12} weight="bold" /> : <Gear size={12} />}
        Configure
      </Button>
      {open &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: "translateX(-100%)",
              zIndex: 1300,
            }}
            className="w-[300px] overflow-hidden rounded-md border border-[#bdc1c6] bg-white pb-2 shadow-lg"
          >
            <ConfigureMenuContent
              dashboardId={dashboardId}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function ConfigureMenuContent({
  dashboardId,
  onClose,
}: {
  dashboardId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const dashboard = useDashboardsStore((s) =>
    s.dashboards.find((d) => d.id === dashboardId),
  );
  const upsertDashboard = useDashboardsStore((s) => s.upsertDashboard);

  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [increaseDensity, setIncreaseDensity] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [autoOverlays, setAutoOverlays] = useState(true);
  const [layoutOption] = useState<"Grid" | "Free">("Grid");

  const sourceId = dashboard?.serverId ?? dashboardId;
  const sharedCount = dashboard?.share?.public?.enabled ? 1 : 0;

  const handleClone = async () => {
    if (cloning) return;
    setCloning(true);
    setCloneError(null);
    try {
      const cloned = await cloneDashboard(sourceId);
      const dash = responseToDashboard(cloned);
      upsertDashboard(dash);
      onClose();
      router.push(`/dashboard/${dash.id}`);
    } catch (e) {
      setCloneError(
        e instanceof Error ? e.message : "Failed to clone dashboard",
      );
      setCloning(false);
    }
  };

  return (
    <div className="text-[#202124]">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-[12px] text-[#5f6368]">Configuration Actions</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      <MenuItem
        icon={<ClockCounterClockwise size={14} />}
        label="Version history"
        shortcut="Shift+V"
      />
      <MenuItem icon={<Notebook size={14} />} label="View audit events" />
      <MenuItem
        icon={<Copy size={14} />}
        label={cloning ? "Cloning…" : "Clone dashboard"}
        onClick={handleClone}
        disabled={cloning}
      />
      <MenuItem icon={<Envelope size={14} />} label="Schedule a report" />
      <MenuItem
        icon={<UploadSimple size={14} />}
        label={`Manage shared dashboards (${sharedCount})`}
      />

      {cloneError && (
        <div className="mx-3 mt-1 rounded border border-[#fecaca] bg-[#fef2f2] px-2 py-1 text-[11px] text-[#991b1b]">
          {cloneError}
        </div>
      )}

      <div className="my-1 h-px bg-[#e8eaed]" />

      <MenuItem
        icon={<Keyboard size={14} />}
        label="Keyboard shortcuts"
        shortcut="Shift+?"
      />
      <MenuItem label="Display UTC time" />

      <div className="px-3 pt-2">
        <div className="mb-1 text-[11px] text-[#5f6368]">Layout</div>
        <div className="rounded-md border border-[#dadce0] p-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] text-[#202124]"
          >
            {layoutOption}
            <CaretDown size={10} weight="bold" />
          </button>
          <div className="mt-2 text-[11px] text-[#5f6368]">
            Snap widgets into place on a grid
          </div>
        </div>
      </div>

      <div className="mt-1">
        <ToggleItem
          label="Increase density on wide screens"
          checked={increaseDensity}
          onChange={setIncreaseDensity}
        />
        <ToggleItem
          icon={<Monitor size={14} />}
          label="TV mode"
          checked={tvMode}
          onChange={setTvMode}
        />
        <ToggleItem
          icon={<Stack size={14} />}
          label="Auto Display Overlays"
          checked={autoOverlays}
          onChange={setAutoOverlays}
        />
      </div>

      <MenuItem icon={<MinusSquare size={14} />} label="Collapse all groups" />
      <MenuItem icon={<PlusSquare size={14} />} label="Expand all groups" />
      <MenuItem
        icon={<ArrowSquareOut size={14} />}
        label="Duplicate to Screenboard"
      />

      <div className="my-1 h-px bg-[#e8eaed]" />

      <div className="px-3 pt-1 pb-1 text-[11px] text-[#5f6368]">More…</div>
      <MenuItem icon={<Bell size={14} />} label="Notifications…" />
      <MenuItem icon={<Lock size={14} />} label="Permissions…" />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-[#5f6368]">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-[11px] text-[#5f6368]">{shortcut}</span>
      )}
    </button>
  );
}

function ToggleItem({
  icon,
  label,
  checked,
  onChange,
}: {
  icon?: ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-[#202124]">
      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-[#5f6368]">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#1a73e8]" : "bg-[#bdc1c6]"}`}
      >
        <span
          className={`absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${checked ? "left-[16px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
