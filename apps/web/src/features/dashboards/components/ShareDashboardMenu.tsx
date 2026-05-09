"use client";

import {
  CalendarBlank,
  Code,
  Copy,
  DownloadSimple,
  ShareNetwork,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import {
  dashboardJsonString,
  downloadDashboardJson,
} from "../exportJson";
import { useDashboardsStore } from "../store";

type Props = {
  dashboardId: string;
  onShareDashboard: () => void;
  shareEnabled?: boolean;
};

export function ShareDashboardMenu({
  dashboardId,
  onShareDashboard,
  shareEnabled,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const dashboard = useDashboardsStore((s) =>
    s.dashboards.find((d) => d.id === dashboardId),
  );

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const vh = window.innerHeight;
    const panelW = panelRef.current?.offsetWidth ?? 260;
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
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
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

  useEffect(() => {
    if (!copyToast) return;
    const t = window.setTimeout(() => setCopyToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [copyToast]);

  const handleShareDashboard = () => {
    setOpen(false);
    onShareDashboard();
  };

  const handleScheduleReport = () => {
    setOpen(false);
    setCopyToast("Schedule report — coming soon");
  };

  const handleExport = () => {
    if (!dashboard) return;
    setOpen(false);
    downloadDashboardJson(dashboard);
  };

  const handleCopy = async () => {
    if (!dashboard) return;
    setOpen(false);
    const json = dashboardJsonString(dashboard);
    try {
      await navigator.clipboard.writeText(json);
      setCopyToast("Dashboard JSON copied to clipboard");
    } catch {
      setCopyToast("Couldn't access clipboard — try Export instead");
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        active={open || !!shareEnabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {open ? <X size={12} weight="bold" /> : <ShareNetwork size={12} />}
        Share
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
            className="w-[240px] overflow-hidden rounded-md border border-[#bdc1c6] bg-white py-1 shadow-lg"
          >
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
              Share externally
            </div>
            <MenuItem
              icon={<UploadSimple size={14} />}
              label="Share dashboard"
              onClick={handleShareDashboard}
            />
            <MenuItem
              icon={<CalendarBlank size={14} />}
              label="Schedule report"
              onClick={handleScheduleReport}
            />
            <div className="my-1 h-px bg-[#e8eaed]" />
            <MenuItem
              icon={<DownloadSimple size={14} />}
              label="Export dashboard JSON"
              onClick={handleExport}
              disabled={!dashboard}
            />
            <MenuItem
              icon={<Copy size={14} />}
              label="Copy dashboard JSON"
              onClick={handleCopy}
              disabled={!dashboard}
            />
          </div>,
          document.body,
        )}
      {copyToast &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[1400] flex justify-center px-4">
            <div className="pointer-events-auto rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-[12px] text-[#202124] shadow-md">
              <span className="inline-flex items-center gap-2">
                <Code size={12} className="text-[#5f6368]" />
                {copyToast}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
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
    </button>
  );
}
