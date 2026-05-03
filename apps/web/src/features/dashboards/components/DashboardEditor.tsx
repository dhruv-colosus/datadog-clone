"use client";

import {
  ArrowSquareOut,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  ChartLineUp,
  CheckCircle,
  Gear,
  MagnifyingGlassMinus,
  Pause,
  Plus,
  PushPin,
  ShareNetwork,
  Square,
  Stack,
  Star,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  TimeRangePicker,
  rangeFromPreset,
  type TimeRange,
} from "@/components/ui/TimeRangePicker";
import { useDashboardsStore } from "../store";
import type { Widget, WidgetType } from "../types";
import { AddWidgetsDrawer } from "./AddWidgetsDrawer";
import { ShareDashboardModal } from "./ShareDashboardModal";
import { WidgetCard } from "./WidgetCard";
import { WidgetEditorModal } from "./WidgetEditorModal";

type Props = {
  dashboardId: string;
};

type EditorState =
  | { mode: "closed" }
  | { mode: "create"; type: WidgetType }
  | { mode: "edit"; widget: Widget };

export function DashboardEditor({ dashboardId }: Props) {
  const router = useRouter();
  const dashboard = useDashboardsStore((s) =>
    s.dashboards.find((d) => d.id === dashboardId),
  );
  const removeWidget = useDashboardsStore((s) => s.removeWidget);

  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    rangeFromPreset("1h"),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToast, setShareToast] = useState<{
    url: string;
    copied: boolean;
  } | null>(null);

  // Auto-dismiss the share toast after 8 seconds.
  useEffect(() => {
    if (!shareToast) return;
    const t = window.setTimeout(() => setShareToast(null), 8000);
    return () => window.clearTimeout(t);
  }, [shareToast]);

  if (!dashboard) {
    return (
      <div className="flex h-full flex-col bg-white text-[#202124]">
        <div className="flex flex-1 items-center justify-center text-[14px] text-[#5f6368]">
          <div className="text-center">
            <p>Dashboard not found.</p>
            <button
              type="button"
              onClick={() => router.push("/dashboard/lists")}
              className="mt-2 text-[#1a73e8] hover:underline"
            >
              Back to dashboards
            </button>
          </div>
        </div>
      </div>
    );
  }

  const widgets = dashboard.widgets ?? [];

  const openEditor = (type: WidgetType) => {
    setDrawerOpen(false);
    setEditor({ mode: "create", type });
  };

  return (
    <div className="relative flex h-full flex-col bg-[#f8f9fa] text-[#202124]">
      <header className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="text-[#5f6368] hover:text-[#f59e0b]"
            aria-label="Star dashboard"
          >
            <Star size={16} />
          </button>
          <h1 className="truncate text-[16px] font-medium text-[#202124]">
            {dashboard.name}
          </h1>
          <button
            type="button"
            className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Dashboard menu"
          >
            <CaretDown size={12} weight="bold" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShareOpen(true)}
            active={!!dashboard.share?.public?.enabled}
          >
            <ShareNetwork size={12} />
            Share
          </Button>
          <Button>
            <Stack size={12} />
            Show Overlays
          </Button>
          <Button>
            <Gear size={12} />
            Configure
          </Button>
          <div className="flex">
            <Button
              variant="primary"
              onClick={() => setDrawerOpen(true)}
              className="rounded-r-none"
            >
              <Plus size={12} weight="bold" />
              Add Widgets
            </Button>
            <Button
              variant="primary"
              iconOnly
              className="rounded-l-none border-l border-white/20"
              aria-label="More add options"
            >
              <CaretDown size={10} weight="bold" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-2">
        <Button>
          <Plus size={12} weight="bold" />
          Add Variable
        </Button>
        <TimeBar value={timeRange} onChange={setTimeRange} />
      </div>

      <main className="flex-1 overflow-auto px-6 py-6">
        {widgets.length === 0 ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-[260px] w-full max-w-[760px] flex-col items-center justify-center rounded-md border border-dashed border-[#dadce0] bg-white text-[#7c3aed] transition-colors hover:bg-[#faf5ff]"
          >
            <Plus size={28} weight="bold" />
            <p className="mt-3 flex items-center gap-1 text-[14px]">
              Add{" "}
              <span className="inline-flex items-center gap-1 text-[#7c3aed]">
                <ChartLineUp size={14} weight="bold" /> Widgets
              </span>{" "}
              or{" "}
              <span className="inline-flex items-center gap-1 text-[#7c3aed]">
                <Square size={14} weight="bold" /> Powerpacks
              </span>
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {widgets.map((w) => (
              <WidgetCard
                key={w.id}
                widget={w}
                timeRange={timeRange}
                onEdit={() => setEditor({ mode: "edit", widget: w })}
                onDelete={() => removeWidget(dashboardId, w.id)}
              />
            ))}
          </div>
        )}
      </main>

      <AddWidgetsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPickWidget={openEditor}
      />

      <WidgetEditorModal
        open={editor.mode !== "closed"}
        dashboardId={dashboardId}
        initialType={editor.mode === "create" ? editor.type : "timeseries"}
        editingWidget={editor.mode === "edit" ? editor.widget : undefined}
        onClose={() => setEditor({ mode: "closed" })}
      />

      <ShareDashboardModal
        open={shareOpen}
        dashboardId={dashboardId}
        onClose={() => setShareOpen(false)}
        onShared={({ url }) => setShareToast({ url, copied: true })}
      />

      {shareToast && (
        <ShareSuccessToast
          url={shareToast.url}
          copied={shareToast.copied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(shareToast.url);
              setShareToast({ url: shareToast.url, copied: true });
            } catch {
              // clipboard unavailable
            }
          }}
          onDismiss={() => setShareToast(null)}
        />
      )}
    </div>
  );
}

function ShareSuccessToast({
  url,
  copied,
  onCopy,
  onDismiss,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[1200] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[640px] items-center gap-3 rounded-md border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-2.5 text-[13px] text-[#202124] shadow-lg">
        <CheckCircle
          size={18}
          weight="fill"
          className="shrink-0 text-[#10b981]"
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            Dashboard shared{copied ? " — link copied to clipboard" : ""}
          </div>
          <div className="truncate text-[12px] text-[#5f6368]" title={url}>
            {url}
          </div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded px-2 py-1 text-[12px] font-medium text-[#1a73e8] hover:bg-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] font-medium text-[#1a73e8] hover:bg-white"
        >
          <ArrowSquareOut size={12} weight="bold" />
          Open
        </a>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-[#5f6368] hover:bg-white"
        >
          <X size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function TimeBar({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-[#5f6368]">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1a73e8]">
        UTC{formatTzOffset(new Date().getTimezoneOffset())}
      </span>
      <TimeRangePicker value={value} onChange={onChange} placement="bottom-end" />
      <Button iconOnly aria-label="Pin time">
        <PushPin size={12} />
      </Button>
      <Button iconOnly aria-label="More">
        <CaretDown size={10} weight="bold" />
      </Button>
      <div className="ml-1 flex">
        <Button iconOnly aria-label="Previous range" className="rounded-r-none">
          <CaretDoubleLeft size={10} weight="bold" />
        </Button>
        <Button
          iconOnly
          aria-label="Pause auto-refresh"
          className="rounded-none border-l-0"
        >
          <Pause size={10} weight="fill" />
        </Button>
        <Button
          iconOnly
          aria-label="Next range"
          className="rounded-l-none border-l-0"
        >
          <CaretDoubleRight size={10} weight="bold" />
        </Button>
      </div>
      <Button iconOnly aria-label="Zoom out">
        <MagnifyingGlassMinus size={12} />
      </Button>
    </div>
  );
}

function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
